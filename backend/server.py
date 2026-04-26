from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import re
import uuid
import asyncio
import json
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId
from pydantic import BaseModel, Field, EmailStr


# ============================================================
# Setup
# ============================================================
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
fs_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="pdfs")

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

CATEGORIES = ["MONTHLY_RETURN", "FORWARDING_LETTER", "IFA_REPORT", "OTHERS"]

MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ============================================================
# WebSocket connection manager (per-user broadcast)
# ============================================================
class ConnectionManager:
    """Tracks active sockets and lets us broadcast either to everyone
    or only to a particular role / user — enabling per-client privacy."""

    def __init__(self):
        # entry: (websocket, user_id, role)
        self.active: list[tuple[WebSocket, str, str]] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, user_id: str, role: str):
        await ws.accept()
        async with self._lock:
            self.active.append((ws, user_id, role))

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self.active = [t for t in self.active if t[0] is not ws]

    async def _send(self, ws: WebSocket, payload: dict):
        try:
            await ws.send_text(json.dumps(payload, default=str))
        except Exception:
            pass

    async def send_to_user(self, user_id: str, payload: dict):
        async with self._lock:
            targets = [t[0] for t in self.active if t[1] == user_id]
        for ws in targets:
            await self._send(ws, payload)

    async def send_to_role(self, role: str, payload: dict):
        async with self._lock:
            targets = [t[0] for t in self.active if t[2] == role]
        for ws in targets:
            await self._send(ws, payload)

    async def broadcast(self, payload: dict):
        async with self._lock:
            targets = [t[0] for t in self.active]
        for ws in targets:
            await self._send(ws, payload)


manager = ConnectionManager()


# ============================================================
# Models
# ============================================================
class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Optional[str] = "client"  # "client" or "admin"
    admin_email: Optional[str] = None  # if a client registers WITH an admin's email,
    # we instantly create a connection so the client lands inside that admin's space.


class ConnectRequest(BaseModel):
    peer_email: str  # email of the other side (admin's email if I'm a client, & vice versa)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class DocumentUpdate(BaseModel):
    display_name: Optional[str] = None
    category: Optional[str] = None
    year: Optional[int] = None
    month: Optional[int] = None


# ============================================================
# Auth helpers
# ============================================================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def safe_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name") or user["email"].split("@")[0],
        "role": user["role"],
    }


def _decode_token_or_none(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


async def _user_from_request(request: Request) -> Optional[dict]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    payload = _decode_token_or_none(auth_header[7:])
    if not payload or payload.get("type") != "access":
        return None
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    return user


async def get_current_user(request: Request) -> dict:
    user = await _user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def get_current_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def get_current_client(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "client":
        raise HTTPException(status_code=403, detail="Client access required")
    return user


# ============================================================
# Categorization
# ============================================================
def categorize_filename(name: str) -> str:
    n = name.lower()
    if "monthly return" in n or "monthly_return" in n:
        return "MONTHLY_RETURN"
    if "forwarding-letter" in n or "forwarding letter" in n or "forwarding_letter" in n:
        return "FORWARDING_LETTER"
    if "ifa report" in n or "ifa_report" in n or "ifareport" in n:
        return "IFA_REPORT"
    return "OTHERS"


def extract_month_year(name: str):
    n = name.replace("_", " ").replace("-", " ")
    pattern = re.compile(r"\b([A-Za-z]{3,9})\s*['\u2019]?\s*(\d{2,4})(?!\d)")
    for match in pattern.finditer(n):
        mon_str = match.group(1).lower()
        year_str = match.group(2)
        if mon_str in MONTH_MAP:
            month = MONTH_MAP[mon_str]
            year = int(year_str)
            if year < 100:
                year += 2000
            if 1900 < year < 2200:
                return month, year
    year_match = re.search(r"\b(20\d{2})\b", n)
    if year_match:
        return None, int(year_match.group(1))
    return None, None


def month_label(month: Optional[int]) -> Optional[str]:
    if not month:
        return None
    names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    if 1 <= month <= 12:
        return names[month - 1]
    return None


def doc_to_meta(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "original_name": doc["original_name"],
        "display_name": doc.get("display_name") or doc["original_name"],
        "category": doc["category"],
        "year": doc["year"],
        "month": doc.get("month"),
        "month_label": month_label(doc.get("month")),
        "size": doc.get("size", 0),
        "uploaded_at": doc.get("uploaded_at"),
        "admin_id": doc.get("admin_id"),
        "client_id": doc.get("client_id"),
    }


# ============================================================
# Auth routes
# ============================================================
@api_router.get("/")
async def root():
    return {"message": "DocVault API"}


@api_router.post("/auth/register", response_model=TokenResponse)
async def register(payload: RegisterRequest):
    """Anyone can self-register as a client OR admin (admin self-signup is allowed
    because the user wants multi-admin tenancy)."""
    role = (payload.role or "client").lower()
    if role not in ("client", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    email = payload.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already registered")

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"], user["email"], user["role"])

    # Optional instant connection at registration time (clients can paste an admin email)
    auto_admin = None
    if role == "client" and payload.admin_email:
        target_email = payload.admin_email.strip().lower()
        admin_user = await db.users.find_one(
            {"email": target_email, "role": "admin"}, {"_id": 0, "password_hash": 0}
        )
        if admin_user:
            await _create_connection(admin_user["id"], user["id"], user["id"])
            auto_admin = safe_user(admin_user)

    # Notify admins about a new client signup so they can choose to connect later
    if role == "client":
        await manager.send_to_role("admin", {"type": "client:registered", "client": safe_user(user)})

    resp = TokenResponse(access_token=token, user=safe_user(user))
    if auto_admin:
        # add auto-connection info onto the response (extra dict field is fine for pydantic)
        return {**resp.model_dump(), "auto_connected_admin": auto_admin}
    return resp


async def _create_connection(admin_id: str, client_id: str, initiated_by: str) -> bool:
    """Idempotently create an admin↔client connection. Returns True if newly created."""
    existing = await db.connections.find_one({"admin_id": admin_id, "client_id": client_id})
    if existing:
        return False
    await db.connections.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "client_id": client_id,
        "initiated_by": initiated_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    # Live notify both endpoints
    admin_user = await db.users.find_one({"id": admin_id}, {"_id": 0, "password_hash": 0})
    client_user = await db.users.find_one({"id": client_id}, {"_id": 0, "password_hash": 0})
    if admin_user and client_user:
        await manager.send_to_user(admin_id, {"type": "connection:created", "peer": safe_user(client_user)})
        await manager.send_to_user(client_id, {"type": "connection:created", "peer": safe_user(admin_user)})
    return True


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"], user["role"])
    return TokenResponse(access_token=token, user=safe_user(user))


@api_router.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return safe_user(current)


# ============================================================
# Clients & Admins listing
# ============================================================
@api_router.get("/clients")
async def list_clients(current=Depends(get_current_admin)):
    """Clients connected to the current admin (via /api/connections), with the
    current admin's per-client document counts attached."""
    client_ids = [c["client_id"] async for c in db.connections.find({"admin_id": current["id"]})]
    if not client_ids:
        return []

    clients = await db.users.find(
        {"id": {"$in": client_ids}, "role": "client"}, {"_id": 0, "password_hash": 0}
    ).to_list(2000)

    pipeline = [
        {"$match": {"admin_id": current["id"], "client_id": {"$in": client_ids}}},
        {"$group": {"_id": "$client_id", "count": {"$sum": 1}, "last": {"$max": "$uploaded_at"}}},
    ]
    counts = {c["_id"]: c async for c in db.documents.aggregate(pipeline)}

    out = []
    for c in clients:
        info = counts.get(c["id"])
        out.append({
            **safe_user(c),
            "created_at": c.get("created_at"),
            "doc_count": (info or {}).get("count", 0),
            "last_upload_at": (info or {}).get("last"),
        })
    out.sort(key=lambda x: x.get("last_upload_at") or x.get("created_at") or "", reverse=True)
    return out


@api_router.get("/admins/connected")
async def connected_admins(current=Depends(get_current_client)):
    """Admins this client is connected to."""
    admin_ids = [c["admin_id"] async for c in db.connections.find({"client_id": current["id"]})]
    if not admin_ids:
        return []
    admins = await db.users.find(
        {"id": {"$in": admin_ids}, "role": "admin"}, {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    pipeline = [
        {"$match": {"client_id": current["id"], "admin_id": {"$in": admin_ids}}},
        {"$group": {"_id": "$admin_id", "count": {"$sum": 1}, "last": {"$max": "$uploaded_at"}}},
    ]
    counts = {c["_id"]: c async for c in db.documents.aggregate(pipeline)}
    out = []
    for a in admins:
        info = counts.get(a["id"])
        out.append({**safe_user(a), "doc_count": (info or {}).get("count", 0), "last_upload_at": (info or {}).get("last")})
    out.sort(key=lambda x: x.get("last_upload_at") or "", reverse=True)
    return out


# ============================================================
# Connections (admin <-> client linkage)
# ============================================================
@api_router.get("/users/lookup")
async def lookup_user(email: str, role: Optional[str] = None, current=Depends(get_current_user)):
    """Look up a user by email. Used by the 'Connect' UI to verify the peer
    exists before forming a connection. Optionally restricted by role."""
    user = await db.users.find_one({"email": email.strip().lower()}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="No user with that email")
    if role and user["role"] != role:
        raise HTTPException(status_code=404, detail=f"That email is not a {role} account")
    if user["id"] == current["id"]:
        raise HTTPException(status_code=400, detail="That's your own account")
    return safe_user(user)


@api_router.post("/connections")
async def connect_to_peer(payload: ConnectRequest, current=Depends(get_current_user)):
    peer = await db.users.find_one(
        {"email": payload.peer_email.strip().lower()}, {"_id": 0, "password_hash": 0}
    )
    if not peer:
        raise HTTPException(status_code=404, detail="No user with that email")
    if peer["id"] == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot connect to yourself")
    # Determine which side is admin / client
    if current["role"] == "admin" and peer["role"] == "client":
        admin_id, client_id = current["id"], peer["id"]
    elif current["role"] == "client" and peer["role"] == "admin":
        admin_id, client_id = peer["id"], current["id"]
    else:
        raise HTTPException(status_code=400, detail="Connections must be between an admin and a client")

    created = await _create_connection(admin_id, client_id, current["id"])
    return {"status": "created" if created else "exists", "peer": safe_user(peer)}


@api_router.delete("/connections/{peer_id}")
async def remove_connection(peer_id: str, current=Depends(get_current_user)):
    """Either side can break the connection."""
    if current["role"] == "admin":
        q = {"admin_id": current["id"], "client_id": peer_id}
    else:
        q = {"client_id": current["id"], "admin_id": peer_id}
    res = await db.connections.delete_one(q)
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    await manager.send_to_user(current["id"], {"type": "connection:removed", "peer_id": peer_id})
    await manager.send_to_user(peer_id, {"type": "connection:removed", "peer_id": current["id"]})
    return {"ok": True}


# ============================================================
# Documents
# ============================================================
@api_router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    client_id: str = Form(...),
    category_override: Optional[str] = Form(None),
    year_override: Optional[int] = Form(None),
    month_override: Optional[int] = Form(None),
    current=Depends(get_current_admin),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Validate target client exists AND is connected to this admin
    target = await db.users.find_one({"id": client_id, "role": "client"}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=400, detail="Target client not found")
    conn = await db.connections.find_one({"admin_id": current["id"], "client_id": client_id})
    if not conn:
        raise HTTPException(status_code=403, detail="You are not connected with this client")

    file_id = str(uuid.uuid4())
    contents = await file.read()

    gridfs_id = await fs_bucket.upload_from_stream(
        file.filename,
        contents,
        metadata={"content_type": "application/pdf", "doc_id": file_id},
    )

    detected_category = categorize_filename(file.filename)
    detected_month, detected_year = extract_month_year(file.filename)

    category = (category_override or detected_category).upper()
    if category not in CATEGORIES:
        category = "OTHERS"

    year = year_override or detected_year or datetime.now().year
    month = month_override if month_override is not None else detected_month

    doc = {
        "id": file_id,
        "admin_id": current["id"],
        "client_id": client_id,
        "original_name": file.filename,
        "display_name": file.filename.rsplit(".", 1)[0],
        "category": category,
        "year": int(year),
        "month": int(month) if month else None,
        "size": len(contents),
        "gridfs_id": str(gridfs_id),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.documents.insert_one(doc)
    doc.pop("_id", None)
    meta = doc_to_meta(doc)

    # Live updates: send to the admin (any of their open consoles) and the receiving client
    payload = {"type": "doc:created", "doc": meta}
    await manager.send_to_user(current["id"], payload)
    await manager.send_to_user(client_id, payload)
    return meta


@api_router.get("/documents")
async def list_documents(
    request: Request,
    category: Optional[str] = None,
    year: Optional[int] = None,
    client_id: Optional[str] = None,
    admin_id: Optional[str] = None,
):
    """Scoped listing.
    - Admin: must pass client_id (or omit to see all of their own uploads).
    - Client: must pass admin_id (or omit to see everything sent to them).
    """
    user = await _user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    q: dict = {}
    if user["role"] == "admin":
        q["admin_id"] = user["id"]
        if client_id:
            q["client_id"] = client_id
    elif user["role"] == "client":
        q["client_id"] = user["id"]
        if admin_id:
            q["admin_id"] = admin_id
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    if category:
        q["category"] = category.upper()
    if year:
        q["year"] = year

    docs = await db.documents.find(q, {"_id": 0}).sort([
        ("year", -1), ("month", -1), ("uploaded_at", -1)
    ]).to_list(2000)
    return [doc_to_meta(d) for d in docs]


@api_router.get("/documents/{doc_id}/file")
async def get_document_file(doc_id: str, request: Request):
    user = await _user_from_request(request)

    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Auth: the uploader admin OR the receiving client may fetch the file
    if user is None or (
        user["role"] == "admin" and doc.get("admin_id") != user["id"]
    ) or (
        user["role"] == "client" and doc.get("client_id") != user["id"]
    ):
        raise HTTPException(status_code=403, detail="Forbidden")

    gridfs_id = doc.get("gridfs_id")
    if not gridfs_id:
        raise HTTPException(status_code=404, detail="File missing on server")

    try:
        grid_out = await fs_bucket.open_download_stream(ObjectId(gridfs_id))
    except Exception:
        raise HTTPException(status_code=404, detail="File missing on server")

    async def streamer():
        while True:
            chunk = await grid_out.readchunk()
            if not chunk:
                break
            yield chunk

    safe_name = doc["original_name"].replace('"', "")
    return StreamingResponse(
        streamer(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{safe_name}"',
            "Content-Length": str(doc.get("size", grid_out.length)),
        },
    )


@api_router.put("/documents/{doc_id}")
async def update_document(doc_id: str, payload: DocumentUpdate, current=Depends(get_current_admin)):
    doc = await db.documents.find_one({"id": doc_id, "admin_id": current["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    update = {}
    if payload.display_name is not None:
        update["display_name"] = payload.display_name
    if payload.category is not None:
        cat = payload.category.upper()
        if cat not in CATEGORIES:
            raise HTTPException(status_code=400, detail="Invalid category")
        update["category"] = cat
    if payload.year is not None:
        update["year"] = int(payload.year)
    if payload.month is not None:
        if not (1 <= int(payload.month) <= 12):
            raise HTTPException(status_code=400, detail="Invalid month")
        update["month"] = int(payload.month)
    if update:
        await db.documents.update_one({"id": doc_id}, {"$set": update})
    new_doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    meta = doc_to_meta(new_doc)
    payload2 = {"type": "doc:updated", "doc": meta}
    await manager.send_to_user(meta["admin_id"], payload2)
    await manager.send_to_user(meta["client_id"], payload2)
    return meta


@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current=Depends(get_current_admin)):
    doc = await db.documents.find_one({"id": doc_id, "admin_id": current["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    gridfs_id = doc.get("gridfs_id")
    if gridfs_id:
        try:
            await fs_bucket.delete(ObjectId(gridfs_id))
        except Exception:
            pass

    await db.documents.delete_one({"id": doc_id})
    payload = {"type": "doc:deleted", "id": doc_id, "admin_id": doc.get("admin_id"), "client_id": doc.get("client_id")}
    await manager.send_to_user(doc.get("admin_id"), payload)
    await manager.send_to_user(doc.get("client_id"), payload)
    return {"ok": True}


# ============================================================
# WebSocket — token-authenticated so events can be scoped per user
# ============================================================
@api_router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, token: Optional[str] = None):
    payload = _decode_token_or_none(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4401)
        return
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        await websocket.close(code=4401)
        return

    await manager.connect(websocket, user["id"], user["role"])
    try:
        await websocket.send_text(json.dumps({"type": "hello", "user": safe_user(user)}))
        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    finally:
        await manager.disconnect(websocket)


# ============================================================
# Startup — seed admin + demo client + migrate legacy docs
# ============================================================
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.documents.create_index([("admin_id", 1), ("client_id", 1), ("year", -1)])
    await db.documents.create_index([("client_id", 1), ("admin_id", 1)])

    # Seed primary admin
    admin = await db.users.find_one({"email": ADMIN_EMAIL})
    if not admin:
        admin = {
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(admin)
    elif not verify_password(ADMIN_PASSWORD, admin["password_hash"]):
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}},
        )

    # Seed demo client (so the multi-tenant UI has at least one row to start with)
    DEMO_CLIENT_EMAIL = "client@example.com"
    DEMO_CLIENT_PASSWORD = "client123"
    demo_client = await db.users.find_one({"email": DEMO_CLIENT_EMAIL})
    if not demo_client:
        demo_client = {
            "id": str(uuid.uuid4()),
            "email": DEMO_CLIENT_EMAIL,
            "password_hash": hash_password(DEMO_CLIENT_PASSWORD),
            "name": "Demo Client",
            "role": "client",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(demo_client)
    elif not verify_password(DEMO_CLIENT_PASSWORD, demo_client["password_hash"]):
        await db.users.update_one(
            {"email": DEMO_CLIENT_EMAIL},
            {"$set": {"password_hash": hash_password(DEMO_CLIENT_PASSWORD)}},
        )

    # Re-fetch in case of inserts above
    admin = await db.users.find_one({"email": ADMIN_EMAIL})
    demo_client = await db.users.find_one({"email": DEMO_CLIENT_EMAIL})

    # Migrate legacy docs (no admin_id / client_id) to (primary admin, demo client)
    if admin and demo_client:
        await db.documents.update_many(
            {"$or": [{"admin_id": {"$exists": False}}, {"admin_id": None}]},
            {"$set": {"admin_id": admin["id"]}},
        )
        await db.documents.update_many(
            {"$or": [{"client_id": {"$exists": False}}, {"client_id": None}]},
            {"$set": {"client_id": demo_client["id"]}},
        )

    # Auto-create connections for any (admin_id, client_id) pair that has docs
    # but no connection yet. Keeps multi-tenant pages populated for legacy data.
    await db.connections.create_index([("admin_id", 1), ("client_id", 1)], unique=True)
    seen_pairs: set[tuple[str, str]] = set()
    async for d in db.documents.find({}, {"admin_id": 1, "client_id": 1, "_id": 0}):
        a, c = d.get("admin_id"), d.get("client_id")
        if a and c:
            seen_pairs.add((a, c))
    for a, c in seen_pairs:
        try:
            await db.connections.update_one(
                {"admin_id": a, "client_id": c},
                {
                    "$setOnInsert": {
                        "id": str(uuid.uuid4()),
                        "admin_id": a,
                        "client_id": c,
                        "initiated_by": a,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
                upsert=True,
            )
        except Exception:
            pass

    # Migrate any legacy disk-based files to GridFS (kept from previous version)
    async for doc in db.documents.find({"gridfs_id": {"$in": [None, ""]}}):
        legacy_path = doc.get("file_path")
        if not legacy_path:
            continue
        path = Path(legacy_path)
        if path.exists():
            try:
                with open(path, "rb") as f:
                    content = f.read()
                gid = await fs_bucket.upload_from_stream(
                    doc["original_name"],
                    content,
                    metadata={"content_type": "application/pdf", "doc_id": doc["id"]},
                )
                await db.documents.update_one(
                    {"id": doc["id"]},
                    {"$set": {"gridfs_id": str(gid)}, "$unset": {"file_path": ""}},
                )
                try:
                    path.unlink()
                except Exception:
                    pass
            except Exception as e:
                logging.error(f"Migration failed for doc {doc.get('id')}: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# Mount routes & middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Static website (Vite build) — served at /api/web/*
# We look for the built site in two locations so it works both in
# local dev (where /app/website/dist is built by yarn) AND in the
# deployed backend container (where only /app/backend/* ships, so we
# keep a copy in /app/backend/website_dist that is NOT gitignored).
# ============================================================
WEBSITE_DIR_CANDIDATES = [
    Path(__file__).parent / "website_dist",   # bundled with backend (deploy)
    Path("/app/website/dist"),                 # local dev
]
WEBSITE_DIR = next((p for p in WEBSITE_DIR_CANDIDATES if p.exists()), None)


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as ex:
            if ex.status_code == 404:
                index_file = Path(self.directory) / "index.html"
                if index_file.exists():
                    return FileResponse(index_file)
            raise


if WEBSITE_DIR is not None:
    app.mount(
        "/api/web",
        SPAStaticFiles(directory=str(WEBSITE_DIR), html=True),
        name="website",
    )

    # Friendly root: redirect bare-domain requests (e.g. https://doc-organizer-app.emergent.host/)
    # to the actual SPA at /api/web/. This is what users get when the production domain is
    # opened directly in a browser. Add common SPA-route prefixes so deep links survive.
    @app.get("/", include_in_schema=False)
    async def _root_redirect():
        return RedirectResponse(url="/api/web/", status_code=307)

    @app.get("/admin", include_in_schema=False)
    @app.get("/admin/{path:path}", include_in_schema=False)
    async def _admin_redirect(path: str = ""):
        suffix = f"/{path}" if path else ""
        return RedirectResponse(url=f"/api/web/admin{suffix}", status_code=307)

    @app.get("/client", include_in_schema=False)
    @app.get("/client/{path:path}", include_in_schema=False)
    async def _client_redirect(path: str = ""):
        suffix = f"/{path}" if path else ""
        return RedirectResponse(url=f"/api/web/client{suffix}", status_code=307)


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
