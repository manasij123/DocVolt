from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import re
import io
import zipfile
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

# Seed defaults for every (admin, client) pair. Admins can rename / add more
# later — but these four are always created so legacy data keeps working.
# `key` is the uppercase slug that maps to the legacy `documents.category` enum.
DEFAULT_CATEGORIES: list[dict] = [
    {"key": "MONTHLY_RETURN",    "name": "Monthly Return",   "color": "#3B82F6", "icon": "stats-chart",  "keywords": ["monthly return", "monthly_return"]},
    {"key": "FORWARDING_LETTER", "name": "Forwarding Letter","color": "#8B5CF6", "icon": "paper-plane",   "keywords": ["forwarding letter", "forwarding_letter", "forwarding-letter"]},
    {"key": "IFA_REPORT",        "name": "IFA Report",       "color": "#10B981", "icon": "podium",        "keywords": ["ifa report", "ifa_report", "ifa-report"]},
    {"key": "OTHERS",            "name": "Others",           "color": "#6B7280", "icon": "folder-open",   "keywords": []},
]

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
    category_id: Optional[str] = None
    year: Optional[int] = None
    month: Optional[int] = None


class CategoryCreate(BaseModel):
    client_id: str
    name: str
    color: Optional[str] = "#3B82F6"
    icon: Optional[str] = "folder"
    keywords: Optional[list[str]] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    keywords: Optional[list[str]] = None
    sort_order: Optional[int] = None


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
        "category": doc["category"],                    # legacy enum key (MONTHLY_RETURN, …)
        "category_id": doc.get("category_id"),          # new per-client FK
        "year": doc["year"],
        "month": doc.get("month"),
        "month_label": month_label(doc.get("month")),
        "size": doc.get("size", 0),
        "uploaded_at": doc.get("uploaded_at"),
        "admin_id": doc.get("admin_id"),
        "client_id": doc.get("client_id"),
    }


def cat_to_meta(c: dict) -> dict:
    return {
        "id": c["id"],
        "admin_id": c["admin_id"],
        "client_id": c["client_id"],
        "key": c.get("key"),
        "name": c["name"],
        "color": c.get("color", "#3B82F6"),
        "icon": c.get("icon", "folder"),
        "keywords": c.get("keywords", []),
        "sort_order": c.get("sort_order", 999),
        "is_default": bool(c.get("is_default", False)),
        "created_at": c.get("created_at"),
    }


def _slugify_cat(name: str) -> str:
    """Generate an uppercase slug usable as legacy `category` enum."""
    s = re.sub(r"[^A-Za-z0-9]+", "_", name.strip()).strip("_").upper()
    return s or "CATEGORY"


async def _ensure_default_categories(admin_id: str, client_id: str) -> list[dict]:
    """Make sure the 4 default categories exist for this (admin, client).
    Returns the full list of categories (existing + newly inserted) for the pair.
    """
    existing = await db.categories.find(
        {"admin_id": admin_id, "client_id": client_id},
        {"_id": 0},
    ).to_list(500)
    existing_keys = {c.get("key") for c in existing}
    to_insert: list[dict] = []
    for idx, d in enumerate(DEFAULT_CATEGORIES):
        if d["key"] in existing_keys:
            continue
        to_insert.append({
            "id": str(uuid.uuid4()),
            "admin_id": admin_id,
            "client_id": client_id,
            "key": d["key"],
            "name": d["name"],
            "color": d["color"],
            "icon": d["icon"],
            "keywords": d["keywords"],
            "sort_order": idx,
            "is_default": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    if to_insert:
        await db.categories.insert_many(to_insert)
        existing.extend(to_insert)
    existing.sort(key=lambda x: (x.get("sort_order", 999), x.get("created_at", "")))
    return existing


async def _resolve_category_for_upload(
    admin_id: str,
    client_id: str,
    filename: str,
    override_id: Optional[str],
    override_key: Optional[str],
) -> dict:
    """Pick the right category for an uploaded document.
    Priority:
      1. explicit category_id (validated belongs to the admin+client pair)
      2. explicit category_override legacy key (MONTHLY_RETURN, ...)
      3. keyword match against the pair's categories
      4. fallback to OTHERS category (seeded if missing)
    Returns the category dict.
    """
    cats = await _ensure_default_categories(admin_id, client_id)
    if override_id:
        for c in cats:
            if c["id"] == override_id:
                return c
    if override_key:
        k = override_key.upper().strip()
        for c in cats:
            if (c.get("key") or "").upper() == k:
                return c
    # keyword-based auto detect
    lower = (filename or "").lower()
    best: Optional[dict] = None
    for c in cats:
        for kw in (c.get("keywords") or []):
            if kw and kw.lower() in lower:
                best = c
                break
        if best:
            break
    if best:
        return best
    # fallback OTHERS
    for c in cats:
        if c.get("key") == "OTHERS":
            return c
    return cats[-1] if cats else {"id": "", "key": "OTHERS", "name": "Others"}


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
    category_id: Optional[str] = Form(None),
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

    # Resolve category via the new per-client categories system (falls back to
    # legacy keyword auto-detect + OTHERS). Also keeps the legacy `category`
    # string populated for backward compatibility.
    resolved_cat = await _resolve_category_for_upload(
        admin_id=current["id"],
        client_id=client_id,
        filename=file.filename,
        override_id=category_id,
        override_key=category_override,
    )
    detected_month, detected_year = extract_month_year(file.filename)

    year = year_override or detected_year or datetime.now().year
    month = month_override if month_override is not None else detected_month

    doc = {
        "id": file_id,
        "admin_id": current["id"],
        "client_id": client_id,
        "original_name": file.filename,
        "display_name": file.filename.rsplit(".", 1)[0],
        "category": resolved_cat.get("key") or _slugify_cat(resolved_cat.get("name", "OTHERS")),
        "category_id": resolved_cat.get("id"),
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
    category_id: Optional[str] = None,
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

    if category_id:
        q["category_id"] = category_id
    elif category:
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


# ============================================================
# Bulk download — POST a list of doc_ids, get back a single .zip
# ============================================================
class BulkDownloadRequest(BaseModel):
    doc_ids: List[str]


def _safe_zip_filename(name: str) -> str:
    """Strip path separators and dangerous chars; keep the filename short."""
    cleaned = re.sub(r"[\\/\x00-\x1f]", "_", name).strip().lstrip(".")
    if not cleaned:
        cleaned = "document.pdf"
    return cleaned[:200]


@api_router.post("/documents/bulk-download")
async def bulk_download_documents(payload: BulkDownloadRequest, request: Request):
    """Stream a ZIP archive containing multiple documents.

    Auth (mirrors single-file download):
      - admin role: each doc.admin_id MUST equal the admin's id
      - client role: each doc.client_id MUST equal the client's id
    Any doc the caller cannot access fails the whole request with 403.
    Up to 200 docs per request to keep memory usage bounded.
    """
    user = await _user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    ids = [i for i in (payload.doc_ids or []) if isinstance(i, str)]
    if not ids:
        raise HTTPException(status_code=400, detail="doc_ids required")
    if len(ids) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 documents per bulk download")

    docs = await db.documents.find({"id": {"$in": ids}}, {"_id": 0}).to_list(len(ids))
    found_ids = {d["id"] for d in docs}
    missing = [i for i in ids if i not in found_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Documents not found: {len(missing)}")

    # Auth check per doc
    for d in docs:
        if user["role"] == "admin" and d.get("admin_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Forbidden")
        if user["role"] == "client" and d.get("client_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Forbidden")

    # Build the ZIP in memory and stream the bytes back. Using STORED (no
    # compression) — PDFs compress very poorly, and skipping deflate saves CPU.
    buffer = io.BytesIO()
    used_names: set[str] = set()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_STORED) as zf:
        for d in docs:
            display = d.get("display_name") or d.get("original_name") or f"{d['id']}.pdf"
            if not display.lower().endswith(".pdf"):
                display = f"{display}.pdf"
            zip_name = _safe_zip_filename(display)
            # De-duplicate names within the archive
            base, ext = os.path.splitext(zip_name)
            n = 2
            while zip_name in used_names:
                zip_name = f"{base} ({n}){ext}"
                n += 1
            used_names.add(zip_name)

            gridfs_id = d.get("gridfs_id")
            if not gridfs_id:
                continue
            try:
                grid_out = await fs_bucket.open_download_stream(ObjectId(gridfs_id))
            except Exception:
                continue
            chunks: list[bytes] = []
            while True:
                chunk = await grid_out.readchunk()
                if not chunk:
                    break
                chunks.append(chunk)
            zf.writestr(zip_name, b"".join(chunks))

    zip_bytes = buffer.getvalue()
    buffer.close()
    if not zip_bytes:
        raise HTTPException(status_code=500, detail="Could not assemble archive")

    archive_name = f"docvault-bundle-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.zip"
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{archive_name}"',
            "Content-Length": str(len(zip_bytes)),
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
    if payload.category_id is not None:
        cat = await db.categories.find_one(
            {"id": payload.category_id, "admin_id": current["id"], "client_id": doc.get("client_id")},
            {"_id": 0},
        )
        if not cat:
            raise HTTPException(status_code=400, detail="Category not found for this client")
        update["category_id"] = cat["id"]
        update["category"] = cat.get("key") or _slugify_cat(cat.get("name", "OTHERS"))
    elif payload.category is not None:
        # Legacy path: accept a category key, map to a category_id on this pair.
        cats = await _ensure_default_categories(current["id"], doc.get("client_id"))
        k = payload.category.upper().strip()
        matched = next((c for c in cats if (c.get("key") or "").upper() == k), None)
        if not matched:
            raise HTTPException(status_code=400, detail="Invalid category")
        update["category_id"] = matched["id"]
        update["category"] = matched.get("key") or k
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


# ============================================================
# Per-client categories — CRUD
# ============================================================
@api_router.get("/categories")
async def list_categories(
    request: Request,
    client_id: Optional[str] = None,
    admin_id: Optional[str] = None,
):
    """Return categories scoped to the (admin, client) pair.
    - Admin role: pass client_id (required). Admin owns the categories.
    - Client role: pass admin_id (required). Client reads the admin's set.
    Seeds the 4 defaults on first access so the UI always has something to show.
    """
    user = await _user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user["role"] == "admin":
        if not client_id:
            raise HTTPException(status_code=400, detail="client_id is required")
        # Ensure connection exists — admins can only manage categories
        # for clients they are connected to.
        conn = await db.connections.find_one({"admin_id": user["id"], "client_id": client_id})
        if not conn:
            raise HTTPException(status_code=403, detail="Not connected with this client")
        cats = await _ensure_default_categories(user["id"], client_id)
    elif user["role"] == "client":
        if not admin_id:
            raise HTTPException(status_code=400, detail="admin_id is required")
        conn = await db.connections.find_one({"admin_id": admin_id, "client_id": user["id"]})
        if not conn:
            raise HTTPException(status_code=403, detail="Not connected with this admin")
        cats = await _ensure_default_categories(admin_id, user["id"])
    else:
        raise HTTPException(status_code=403, detail="Forbidden")
    return [cat_to_meta(c) for c in cats]


@api_router.post("/categories")
async def create_category(payload: CategoryCreate, current=Depends(get_current_admin)):
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    conn = await db.connections.find_one({"admin_id": current["id"], "client_id": payload.client_id})
    if not conn:
        raise HTTPException(status_code=403, detail="Not connected with this client")
    # Seed defaults first so the slot count is correct.
    existing = await _ensure_default_categories(current["id"], payload.client_id)
    name = payload.name.strip()
    key = _slugify_cat(name)
    # Make the key unique within the pair
    taken_keys = {c.get("key") for c in existing}
    if key in taken_keys:
        base = key
        i = 2
        while f"{base}_{i}" in taken_keys:
            i += 1
        key = f"{base}_{i}"
    sort_order = max([c.get("sort_order", 0) for c in existing], default=0) + 1
    cat = {
        "id": str(uuid.uuid4()),
        "admin_id": current["id"],
        "client_id": payload.client_id,
        "key": key,
        "name": name,
        "color": payload.color or "#3B82F6",
        "icon": payload.icon or "folder",
        "keywords": [k.strip().lower() for k in (payload.keywords or []) if k and k.strip()],
        "sort_order": sort_order,
        "is_default": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.categories.insert_one(cat)
    cat.pop("_id", None)
    meta = cat_to_meta(cat)
    evt = {"type": "category:created", "category": meta}
    await manager.send_to_user(current["id"], evt)
    await manager.send_to_user(payload.client_id, evt)
    return meta


@api_router.put("/categories/{cat_id}")
async def update_category(cat_id: str, payload: CategoryUpdate, current=Depends(get_current_admin)):
    cat = await db.categories.find_one({"id": cat_id, "admin_id": current["id"]}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    update: dict = {}
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        update["name"] = name
    if payload.color is not None:
        update["color"] = payload.color
    if payload.icon is not None:
        update["icon"] = payload.icon
    if payload.keywords is not None:
        update["keywords"] = [k.strip().lower() for k in payload.keywords if k and k.strip()]
    if payload.sort_order is not None:
        update["sort_order"] = int(payload.sort_order)
    if update:
        await db.categories.update_one({"id": cat_id}, {"$set": update})
    new_cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    meta = cat_to_meta(new_cat)
    evt = {"type": "category:updated", "category": meta}
    await manager.send_to_user(current["id"], evt)
    await manager.send_to_user(cat.get("client_id"), evt)
    return meta


@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, current=Depends(get_current_admin)):
    cat = await db.categories.find_one({"id": cat_id, "admin_id": current["id"]}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if cat.get("key") == "OTHERS":
        raise HTTPException(status_code=400, detail="'Others' is the fallback category and cannot be deleted")
    # Move every doc currently in this category to the OTHERS fallback for the
    # same (admin, client) pair, then drop the row.
    others = await db.categories.find_one(
        {"admin_id": cat["admin_id"], "client_id": cat["client_id"], "key": "OTHERS"},
        {"_id": 0},
    )
    if not others:
        # Safety net — re-seed if somehow missing
        await _ensure_default_categories(cat["admin_id"], cat["client_id"])
        others = await db.categories.find_one(
            {"admin_id": cat["admin_id"], "client_id": cat["client_id"], "key": "OTHERS"},
            {"_id": 0},
        )
    moved = 0
    if others:
        res = await db.documents.update_many(
            {"category_id": cat_id},
            {"$set": {"category_id": others["id"], "category": others.get("key", "OTHERS")}},
        )
        moved = res.modified_count if res else 0
    await db.categories.delete_one({"id": cat_id})
    evt = {
        "type": "category:deleted",
        "id": cat_id,
        "admin_id": cat.get("admin_id"),
        "client_id": cat.get("client_id"),
        "moved_to_others": moved,
    }
    await manager.send_to_user(cat.get("admin_id"), evt)
    await manager.send_to_user(cat.get("client_id"), evt)
    return {"ok": True, "moved_to_others": moved}


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

    # -------- Categories migration (one-time, idempotent) --------
    # 1) Unique index per (admin_id, client_id, key) so default seeding can't duplicate
    try:
        await db.categories.create_index(
            [("admin_id", 1), ("client_id", 1), ("key", 1)], unique=True
        )
    except Exception:
        pass
    # 2) For every existing connection, seed the default 4 categories if missing
    async for conn in db.connections.find({}, {"_id": 0, "admin_id": 1, "client_id": 1}):
        a_id = conn.get("admin_id")
        c_id = conn.get("client_id")
        if a_id and c_id:
            try:
                await _ensure_default_categories(a_id, c_id)
            except Exception as e:
                logging.error(f"Seeding categories failed for {a_id}/{c_id}: {e}")
    # 3) Back-fill `category_id` on any documents that don't have it yet
    async for doc in db.documents.find(
        {"$or": [{"category_id": {"$exists": False}}, {"category_id": None}, {"category_id": ""}]},
        {"_id": 0, "id": 1, "admin_id": 1, "client_id": 1, "category": 1},
    ):
        a_id = doc.get("admin_id")
        c_id = doc.get("client_id")
        key = (doc.get("category") or "OTHERS").upper()
        if not (a_id and c_id):
            continue
        cats = await _ensure_default_categories(a_id, c_id)
        matched = next((c for c in cats if (c.get("key") or "").upper() == key), None)
        if not matched:
            matched = next((c for c in cats if c.get("key") == "OTHERS"), None)
        if matched:
            await db.documents.update_one(
                {"id": doc["id"]},
                {"$set": {"category_id": matched["id"], "category": matched.get("key") or "OTHERS"}},
            )


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
