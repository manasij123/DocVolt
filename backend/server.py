from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import re
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId
from pydantic import BaseModel, Field


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
# Models
# ============================================================
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class DocumentMeta(BaseModel):
    id: str
    original_name: str
    display_name: str
    category: str
    year: int
    month: Optional[int]
    month_label: Optional[str]
    size: int
    uploaded_at: str


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


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_admin(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user or user.get("role") != "admin":
            raise HTTPException(status_code=401, detail="Not authorized")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


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
    """Extract month (int) and year (int) from filename like Feb'2026, Feb'26."""
    n = name.replace("_", " ").replace("-", " ")
    # patterns like: Feb'2026, Feb'26, Feb 2026, Feb 26, February 2026
    pattern = re.compile(
        r"\b([A-Za-z]{3,9})\s*['\u2019]?\s*(\d{2,4})(?!\d)"
    )
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
    # fallback: standalone year
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
    }


# ============================================================
# Routes
# ============================================================
@api_router.get("/")
async def root():
    return {"message": "PDF Storage API"}


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    safe_user = {"id": user["id"], "email": user["email"], "name": user.get("name"), "role": user["role"]}
    return TokenResponse(access_token=token, user=safe_user)


@api_router.get("/auth/me")
async def me(current=Depends(get_current_admin)):
    return current


@api_router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    category_override: Optional[str] = Form(None),
    year_override: Optional[int] = Form(None),
    month_override: Optional[int] = Form(None),
    current=Depends(get_current_admin),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_id = str(uuid.uuid4())
    contents = await file.read()

    # Store in GridFS (persistent across restarts)
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
        "original_name": file.filename,
        "display_name": file.filename.rsplit(".", 1)[0],
        "category": category,
        "year": int(year),
        "month": int(month) if month else None,
        "size": len(contents),
        "gridfs_id": str(gridfs_id),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": current["id"],
    }
    await db.documents.insert_one(doc)
    doc.pop("_id", None)
    return doc_to_meta(doc)


@api_router.get("/documents")
async def list_documents(category: Optional[str] = None, year: Optional[int] = None):
    q = {}
    if category:
        q["category"] = category.upper()
    if year:
        q["year"] = year
    docs = await db.documents.find(q, {"_id": 0}).sort([("year", -1), ("month", -1), ("uploaded_at", -1)]).to_list(1000)
    return [doc_to_meta(d) for d in docs]


@api_router.get("/documents/years")
async def list_years(category: Optional[str] = None):
    """Return distinct years grouped by category, with counts."""
    match = {}
    if category:
        match["category"] = category.upper()
    pipeline = [
        {"$match": match} if match else {"$match": {}},
        {"$group": {"_id": {"category": "$category", "year": "$year"}, "count": {"$sum": 1}}},
        {"$sort": {"_id.year": -1}},
    ]
    out = await db.documents.aggregate(pipeline).to_list(1000)
    return [
        {"category": item["_id"]["category"], "year": item["_id"]["year"], "count": item["count"]}
        for item in out
    ]


@api_router.get("/documents/{doc_id}/file")
async def get_document_file(doc_id: str):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

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
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
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
    return doc_to_meta(new_doc)


@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current=Depends(get_current_admin)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    gridfs_id = doc.get("gridfs_id")
    if gridfs_id:
        try:
            await fs_bucket.delete(ObjectId(gridfs_id))
        except Exception:
            pass

    await db.documents.delete_one({"id": doc_id})
    return {"ok": True}


# ============================================================
# Startup
# ============================================================
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.documents.create_index([("category", 1), ("year", -1)])

    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}},
        )

    # Migrate any legacy disk-based files to GridFS
    legacy_dir = ROOT_DIR / "uploads"
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
