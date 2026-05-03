from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import re
import io
import base64
import zipfile
import uuid
import asyncio
import json
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple

from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect, Query
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

# Seed only the OTHERS fallback category — admins build their own taxonomy.
# The domain-specific defaults (Monthly Return / Forwarding Letter / IFA Report)
# were removed at user request on 2026-04-29 — DocVault is a generic doc-vault
# now, not an IFA/compliance-specific tool.
DEFAULT_CATEGORIES: list[dict] = [
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
    custom_icon_b64: Optional[str] = None  # AI-generated PNG (overrides `icon` when present)


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    custom_icon_b64: Optional[str] = None  # null clears, string sets
    keywords: Optional[list[str]] = None
    sort_order: Optional[int] = None


class IconGenerateRequest(BaseModel):
    description: str
    style_hint: Optional[str] = None


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


async def get_current_superadmin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Super admin access required")
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
        "custom_icon_b64": c.get("custom_icon_b64"),
        "keywords": c.get("keywords", []),
        "sort_order": c.get("sort_order", 999),
        "is_default": bool(c.get("is_default", False)),
        "created_at": c.get("created_at"),
        "learned_count": int(c.get("learned_count", 0)),
    }


# ============================================================
# Auto-categorize — Learning from admin's past category choices
# ============================================================
STOPWORDS = {
    "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "by",
    "with", "from", "as", "is", "it", "this", "that", "these", "those",
    "pdf", "doc", "docx", "scan", "copy", "final", "v1", "v2", "v3",
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct",
    "nov", "dec", "january", "february", "march", "april", "june", "july",
    "august", "september", "october", "november", "december",
    "2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028",
    "mr", "mrs", "ms", "dr",
}

def tokenize_filename(name: str) -> List[str]:
    """Split a filename into meaningful lowercase tokens for keyword matching."""
    # drop extension & path
    base = re.split(r"[\\/]", name or "")[-1]
    base = re.sub(r"\.[a-zA-Z0-9]{1,5}$", "", base)
    # replace separators with spaces
    base = re.sub(r"[_\-\.\(\)\[\]\{\}]", " ", base)
    # camelCase → camel Case
    base = re.sub(r"([a-z])([A-Z])", r"\1 \2", base)
    # split on whitespace / non-alphanumerics
    parts = re.split(r"\s+", base.lower())
    out: List[str] = []
    for p in parts:
        p = re.sub(r"[^a-z0-9]", "", p)
        if len(p) < 2:       # drop single-char tokens
            continue
        if p.isdigit():      # drop pure numbers
            continue
        if p in STOPWORDS:
            continue
        out.append(p)
    return out

async def _learn_keywords(admin_id: str, client_id: str, category_id: str, filename: str):
    """
    Update keyword_weights for the given category based on filename tokens.
    Called every time an admin assigns (or re-assigns) a category to a doc.
    """
    tokens = tokenize_filename(filename)
    if not tokens:
        return
    inc = {f"keyword_weights.{t}": 1 for t in set(tokens)}
    await db.categories.update_one(
        {"id": category_id, "admin_id": admin_id, "client_id": client_id},
        {
            "$inc": {**inc, "learned_count": 1},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
    )

def _token_idf(cats: List[dict]) -> Dict[str, float]:
    """
    Compute Inverse-Document-Frequency weight per token across categories.

    A token that appears in MANY categories (e.g. "monthly", "report",
    "statement" when most categories have these in their learned/manual
    keywords) has LOW discrimination power — its IDF should be ≈ 0. A
    token that appears in only 1 category has HIGH IDF (≈ log N).

    This prevents the classic bug:
        File "Monthly_IFA_Report.pdf" getting mis-routed to "Monthly Return"
        simply because "monthly" was learned for that category — when in
        reality "monthly" is also learned for many other categories and
        carries no real signal.
    """
    import math as _m
    N = max(1, len(cats))
    df: Dict[str, int] = {}
    for c in cats:
        tokens = set()
        tokens.update((c.get("keyword_weights") or {}).keys())
        for k in (c.get("keywords") or []):
            if isinstance(k, str):
                tokens.add(k.lower())
        for t in tokens:
            df[t] = df.get(t, 0) + 1
    idf: Dict[str, float] = {}
    for t, d in df.items():
        # smoothed IDF — never below 0.15 so common-but-not-universal tokens
        # still contribute a tiny bit; drops to 0 only when d == N
        idf[t] = max(0.0, _m.log((N + 1) / (d + 0.5)))
    return idf


async def _suggest_combined(
    admin_id: str, client_id: str, filename: str, file_path: Optional[str] = None,
) -> Optional[Tuple[dict, Dict[str, Any]]]:
    """
    Unified scoring that fuses two independent learning signals:
      1. Filename-token score — learned `keyword_weights` + manual `keywords`,
         IDF-weighted so common cross-category words are discounted.
      2. Content-template score — Jaccard similarity with stored
         `content_signatures` of past uploads to each category.

    The filename & content signals complement each other. When content is
    successfully extracted but doesn't meaningfully match ANY category, we
    apply a penalty so a lone weak filename match can't hijack the routing
    (→ the caller falls back to Others).

    Returns (best_category, debug_info) or None if nothing scored.
    """
    cats: List[dict] = []
    async for c in db.categories.find({"admin_id": admin_id, "client_id": client_id}):
        cats.append(c)
    if not cats:
        return None

    tokens = tokenize_filename(filename)
    idf = _token_idf(cats)

    # Content signature (only if a file path was given)
    content_sig: List[str] = []
    if file_path:
        try:
            text = extract_pdf_text(file_path)
            content_sig = content_signature(text)
        except Exception as e:
            logger.warning(f"content_sig extraction failed: {e}")

    # Was enough content extracted to make the content signal meaningful?
    # (Below this we treat content as "unavailable" rather than "mismatched".)
    content_available = len(content_sig) >= 8

    best: Optional[dict] = None
    best_score = 0.0
    best_detail: Dict[str, Any] = {}
    max_ct_score_any = 0.0  # track max content score across all cats

    per_cat: List[Tuple[dict, float, float, List[str], int]] = []

    for c in cats:
        # --- Filename score (IDF-weighted)
        fn_score = 0.0
        fn_matched: List[str] = []
        weights: Dict[str, int] = c.get("keyword_weights", {}) or {}
        manual = [k.lower() for k in (c.get("keywords") or []) if isinstance(k, str)]
        for t in tokens:
            w = idf.get(t, 1.0)  # unseen tokens get full weight
            if t in weights:
                fn_score += (1.0 + (weights[t] ** 0.5)) * w
                fn_matched.append(t)
            elif t in manual:
                fn_score += 1.2 * w
                fn_matched.append(t)
            else:
                for mk in manual:
                    if len(mk) >= 4 and (mk in t or t in mk):
                        fn_score += 0.5 * w
                        break

        # --- Content score (0..1+ Jaccard, boosted by template popularity)
        ct_score = 0.0
        ct_templates = 0
        if content_sig:
            sigs: List[Dict[str, Any]] = c.get("content_signatures", []) or []
            for s in sigs:
                j = _jaccard(content_sig, s.get("tokens", []))
                if j > 0:
                    ct_score = max(ct_score, j * (1.0 + 0.15 * min(5, int(s.get("count", 1)))))
                    ct_templates += int(s.get("count", 1))
        if ct_score > max_ct_score_any:
            max_ct_score_any = ct_score

        per_cat.append((c, fn_score, ct_score, fn_matched, ct_templates))

    # If content is available but no category clears a minimal template
    # similarity (0.12 Jaccard) then the document is probably a *new kind*.
    # We penalize filename-only matches in that case so the caller routes
    # to Others rather than mis-trusting a shared filename word.
    content_says_unknown = content_available and max_ct_score_any < 0.12
    fn_penalty = 0.35 if content_says_unknown else 1.0

    for c, fn_score, ct_score, fn_matched, ct_templates in per_cat:
        combined = fn_score * 1.0 * fn_penalty + ct_score * 4.0
        if combined > best_score:
            best_score = combined
            best = c
            best_detail = {
                "filename_score": round(fn_score, 2),
                "filename_score_penalised": round(fn_score * fn_penalty, 2),
                "filename_matched": fn_matched,
                "content_score": round(ct_score, 2),
                "content_templates": ct_templates,
                "content_available": content_available,
                "content_says_unknown": content_says_unknown,
                "combined_score": round(combined, 2),
            }

    # Threshold — require meaningful combined signal.
    # When content says "unknown", require an even stronger filename signal
    # (effectively forcing Others fallback for ambiguous cases).
    threshold = 1.5 if content_says_unknown else 0.8
    if not best or best_score < threshold:
        return None
    return best, best_detail


async def _suggest_category(admin_id: str, client_id: str, filename: str) -> Optional[dict]:
    """
    Filename-only suggestion (used by pre-upload /categories/suggest endpoint).
    Kept as a thin wrapper around the combined suggester.
    """
    r = await _suggest_combined(admin_id, client_id, filename, file_path=None)
    return r[0] if r else None


# ============================================================
# Content-based learning — read the PDF, build template signatures
# ============================================================
try:
    from pypdf import PdfReader  # type: ignore
    _PYPDF_OK = True
except Exception:  # pragma: no cover
    _PYPDF_OK = False

# Patterns to strip out of content before tokenisation (dates, amounts, ids,
# emails etc. — these change between invoices but the surrounding template
# text stays the same).
_STRIP_PATTERNS = [
    re.compile(r"\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b"),            # dates 01/03/2026
    re.compile(r"\b\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}\b"),              # 2026-03-01
    re.compile(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s*\d{2,4}?\b", re.I),  # March 15, 2026
    re.compile(r"(?:Rs\.?|INR|USD|\$|₹)\s*\d[\d,]*\.?\d*"),           # currency
    re.compile(r"\b\d[\d,]*\.\d{2}\b"),                              # amounts 12,345.67
    re.compile(r"\b[A-Z]{2,5}[0-9]{4,}[A-Z0-9]*\b"),                 # ids/PAN/GSTIN-like
    re.compile(r"\b\d{6,}\b"),                                      # long numbers
    re.compile(r"\b[\w\.-]+@[\w\.-]+\.\w+\b"),                        # emails
    re.compile(r"https?://\S+"),                                    # urls
]

def extract_pdf_text(path_or_bytes, max_chars: int = 5000, max_pages: int = 2) -> str:
    """Extract up to `max_chars` characters of text from the first `max_pages`.
    Accepts either a filesystem path (str) or the raw PDF bytes."""
    if not _PYPDF_OK:
        return ""
    try:
        if isinstance(path_or_bytes, (bytes, bytearray)):
            import io as _io
            reader = PdfReader(_io.BytesIO(path_or_bytes))
        else:
            reader = PdfReader(path_or_bytes)
        chunks: List[str] = []
        total = 0
        for i, page in enumerate(reader.pages[:max_pages]):
            t = page.extract_text() or ""
            chunks.append(t)
            total += len(t)
            if total >= max_chars:
                break
        return "\n".join(chunks)[:max_chars]
    except Exception as e:
        logger.warning(f"extract_pdf_text failed: {e}")
        return ""

def content_signature(text: str, max_tokens: int = 48) -> List[str]:
    """
    Build a template fingerprint: a set of lowercase tokens that represent the
    *constant* text in the document. Strips out amounts, dates, ids and ids,
    then keeps the most common content words (length ≥ 3) — these tend to be
    the form labels ("invoice", "subtotal", "statement", "department" etc.).
    """
    if not text:
        return []
    s = text
    for rx in _STRIP_PATTERNS:
        s = rx.sub(" ", s)
    # replace non-alphanumeric with space, keep apostrophes/dashes inside words
    s = re.sub(r"[^a-zA-Z\s\-']", " ", s)
    s = re.sub(r"[_\-]+", " ", s)
    tokens = [t.lower() for t in s.split() if len(t) >= 3 and not t.isdigit()]
    # drop stopwords
    tokens = [t for t in tokens if t not in STOPWORDS]
    # token frequency
    freq: Dict[str, int] = {}
    for t in tokens:
        freq[t] = freq.get(t, 0) + 1
    # keep the most frequent / most distinctive ones (cap list)
    ranked = sorted(freq.items(), key=lambda x: (-x[1], x[0]))
    out = [t for t, _ in ranked[:max_tokens]]
    return out

def _jaccard(a: List[str], b: List[str]) -> float:
    if not a or not b:
        return 0.0
    sa, sb = set(a), set(b)
    inter = len(sa & sb)
    union = len(sa | sb)
    return inter / union if union else 0.0

async def _learn_content(admin_id: str, client_id: str, category_id: str, file_ref):
    """
    Extract content signature from the uploaded file and either merge it into
    an existing signature for this category (if highly similar) or append a
    brand-new signature (a new template).

    `file_ref` may be a filesystem path OR raw bytes.
    """
    try:
        text = extract_pdf_text(file_ref)
        sig = content_signature(text)
        if len(sig) < 8:   # not enough content to be useful
            return
        cat = await db.categories.find_one({
            "id": category_id, "admin_id": admin_id, "client_id": client_id,
        })
        if not cat:
            return
        sigs: List[Dict[str, Any]] = cat.get("content_signatures", []) or []
        # Try to merge with a close template (same kind of document)
        merged = False
        for s in sigs:
            existing = s.get("tokens", [])
            if _jaccard(sig, existing) >= 0.55:
                # Merge — union of tokens, bump count
                merged_tokens = list(dict.fromkeys(existing + sig))[:64]
                s["tokens"] = merged_tokens
                s["count"] = int(s.get("count", 1)) + 1
                s["updated_at"] = datetime.now(timezone.utc).isoformat()
                merged = True
                break
        if not merged:
            # New template — keep max 10 per category (evict lowest count)
            sigs.append({
                "tokens": sig,
                "count": 1,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            if len(sigs) > 10:
                sigs.sort(key=lambda s: s.get("count", 1), reverse=True)
                sigs = sigs[:10]
        await db.categories.update_one(
            {"id": category_id},
            {"$set": {"content_signatures": sigs, "updated_at": datetime.now(timezone.utc)}},
        )
    except Exception as e:
        logger.warning(f"_learn_content failed: {e}")

async def _suggest_by_content(admin_id: str, client_id: str, file_path: str) -> Optional[Tuple[dict, float, int]]:
    """
    Extract text from the file, score each category by how well it matches
    any of the stored content signatures. Return (category, score, matched_template_count).
    """
    try:
        text = extract_pdf_text(file_path)
        sig = content_signature(text)
        if len(sig) < 8:
            return None
        cats: List[dict] = []
        async for c in db.categories.find({"admin_id": admin_id, "client_id": client_id}):
            cats.append(c)
        if not cats:
            return None
        best: Optional[dict] = None
        best_score = 0.0
        best_count = 0
        for c in cats:
            sigs: List[Dict[str, Any]] = c.get("content_signatures", []) or []
            if not sigs:
                continue
            # Best-template match, weighted by its count
            sc = 0.0
            cnt = 0
            for s in sigs:
                j = _jaccard(sig, s.get("tokens", []))
                if j > 0:
                    sc = max(sc, j * (1.0 + 0.15 * min(5, int(s.get("count", 1)))))
                    cnt += int(s.get("count", 1))
            if sc > best_score:
                best_score = sc
                best = c
                best_count = cnt
        if not best or best_score < 0.30:
            return None
        return best, best_score, best_count
    except Exception as e:
        logger.warning(f"_suggest_by_content failed: {e}")
        return None


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
    existing.sort(key=lambda x: (x.get("sort_order", 999), str(x.get("created_at", ""))))
    return existing


async def _resolve_category_for_upload(
    admin_id: str,
    client_id: str,
    filename: str,
    override_id: Optional[str],
    override_key: Optional[str],
    file_bytes: Optional[bytes] = None,
) -> dict:
    """Pick the right category for an uploaded document.
    Priority:
      1. explicit category_id (validated belongs to the admin+client pair)
      2. explicit category_override legacy key (MONTHLY_RETURN, ...)
      3. Combined ML scoring (filename IDF + PDF content Jaccard) — only
         if the confidence is high enough. This is the only auto-routing
         that considers the actual file contents, so it correctly handles
         ambiguous filenames that share words like "monthly".
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

    # ML-based auto-routing (filename + content). The suggester internally
    # uses IDF-weighted filename scoring + Jaccard content matching, and
    # enforces a confidence threshold — it returns None when the signal is
    # weak or the content says "I haven't seen this kind of doc before".
    try:
        r = await _suggest_combined(admin_id, client_id, filename, file_bytes)
        if r:
            return r[0]
    except Exception as e:
        logger.warning(f"_resolve_category_for_upload ML step failed: {e}")

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
    raw = (payload.email or "").strip()
    # SuperAdmin uses a synthetic username (not a real email). Match by either
    # `username` field OR email so admin/client logins keep working.
    user = await db.users.find_one({"$or": [{"email": raw.lower()}, {"username": raw}]})
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

    # Resolve category via the new per-client categories system — now
    # content-aware: the resolver runs the ML combined scoring (filename
    # IDF + PDF content Jaccard) and routes to OTHERS when confidence is
    # low. This prevents the "Monthly_IFA Report" → wrongly placed into
    # "Monthly Return" class of bugs.
    resolved_cat = await _resolve_category_for_upload(
        admin_id=current["id"],
        client_id=client_id,
        filename=file.filename,
        override_id=category_id,
        override_key=category_override,
        file_bytes=contents,
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

    # 🧠 Auto-learn: record filename tokens under the chosen category so next
    # time the admin uploads something similar we can suggest it.
    content_hint: Optional[dict] = None
    if doc.get("category_id"):
        try:
            await _learn_keywords(current["id"], client_id, doc["category_id"], file.filename)
        except Exception as e:
            logger.warning(f"learn_keywords failed: {e}")
        # 🧠 Also learn the PDF's content fingerprint so next month's
        # similar-template upload auto-routes here.
        try:
            await _learn_content(current["id"], client_id, doc["category_id"], contents)
        except Exception as e:
            logger.warning(f"learn_content failed: {e}")

    # 🧠 Combined (filename + content) smart check — does the unified AI
    # suggestion differ from what the admin selected? If so surface a
    # "Did you mean..." hint. Also emit a reassuring "confirm" hint when
    # content & filename both agree with the admin's choice.
    try:
        combined = await _suggest_combined(
            current["id"], client_id, file.filename, contents,
        )
        if combined:
            best_cat, detail = combined
            if best_cat["id"] != (doc.get("category_id") or ""):
                content_hint = {
                    "suggested_category": cat_to_meta(best_cat),
                    "confidence": detail.get("combined_score", 0) / 5.0,  # normalize 0..1-ish
                    "matched_templates": detail.get("content_templates", 0),
                    "matched_filename_tokens": detail.get("filename_matched", []),
                    "content_score": detail.get("content_score", 0),
                    "filename_score": detail.get("filename_score", 0),
                    "kind": "override",
                }
            else:
                content_hint = {
                    "suggested_category": cat_to_meta(best_cat),
                    "confidence": detail.get("combined_score", 0) / 5.0,
                    "matched_templates": detail.get("content_templates", 0),
                    "matched_filename_tokens": detail.get("filename_matched", []),
                    "content_score": detail.get("content_score", 0),
                    "filename_score": detail.get("filename_score", 0),
                    "kind": "confirm",
                }
    except Exception as e:
        logger.warning(f"content_hint failed: {e}")

    if content_hint:
        meta = dict(meta)
        meta["content_hint"] = content_hint

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

    # 🧠 Auto-learn: if the admin changed the category, update keyword weights
    # for the NEW category based on this doc's filename.
    if "category_id" in update and new_doc.get("category_id"):
        try:
            await _learn_keywords(
                current["id"], new_doc.get("client_id"),
                new_doc["category_id"], new_doc.get("original_name", ""),
            )
        except Exception as e:
            logger.warning(f"learn_keywords on update failed: {e}")

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
            # Self-heal: if the target *user* exists and IS a client, auto-create
            # the connection. Same pattern as POST /categories; unblocks the case
            # where the connection row was lost but the client is still visible
            # in the admin's dashboard.
            target = await db.users.find_one({"id": client_id, "role": "client"}, {"_id": 0, "password_hash": 0})
            if target:
                await _create_connection(user["id"], client_id, user["id"])
                logger.info("list_categories — self-healed missing connection admin=%s client=%s", user["id"], client_id)
            else:
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


@api_router.get("/categories/suggest")
async def suggest_category(
    client_id: str = Query(...),
    filename: str = Query(...),
    current=Depends(get_current_admin),
):
    """
    Given a filename the admin is about to upload, suggest the best-matching
    category for THIS (admin, client) pair based on manual keywords AND
    auto-learned weights from past uploads.
    """
    conn = await db.connections.find_one({"admin_id": current["id"], "client_id": client_id})
    if not conn:
        raise HTTPException(status_code=403, detail="Not connected to this client")
    # Make sure defaults exist so a brand-new admin still gets a meaningful
    # set of categories to score against.
    await _ensure_default_categories(current["id"], client_id)

    best = await _suggest_category(current["id"], client_id, filename)
    if not best:
        return {"suggested": None, "reason": "no-match"}
    tokens = tokenize_filename(filename)
    weights = best.get("keyword_weights", {}) or {}
    matched = [t for t in tokens if t in weights]
    return {
        "suggested": cat_to_meta(best),
        "matched_tokens": matched,
        "learned_count": int(best.get("learned_count", 0)),
    }


@api_router.post("/categories")
async def create_category(payload: CategoryCreate, current=Depends(get_current_admin)):
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    conn = await db.connections.find_one({"admin_id": current["id"], "client_id": payload.client_id})
    if not conn:
        # Diagnostic: list 3 example connections so we can see what IDs the admin actually has.
        sample = []
        async for c in db.connections.find({"admin_id": current["id"]}).limit(3):
            sample.append(c.get("client_id"))
        logger.warning(
            "create_category 403 — admin=%s wants client_id=%r, has %d connections (e.g. %r)",
            current["id"], payload.client_id, len(sample), sample,
        )
        # Self-heal: if the target *user* exists and IS a client, auto-create the
        # connection. This unblocks the case where an admin opens a client they
        # see in /api/clients but the connection row was somehow lost (legacy
        # data, race condition, etc.). Same security boundary as upload — admin
        # is already authenticated; client_id existence is the only gate.
        target = await db.users.find_one({"id": payload.client_id, "role": "client"}, {"_id": 0, "password_hash": 0})
        if target:
            await _create_connection(current["id"], payload.client_id, current["id"])
            logger.info("create_category — self-healed missing connection admin=%s client=%s", current["id"], payload.client_id)
        else:
            raise HTTPException(status_code=403, detail="Client not found or not connected. Open the client from your dashboard and try again.")
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
        "custom_icon_b64": payload.custom_icon_b64 or None,
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


@api_router.post("/categories/generate-icon")
async def generate_category_icon(payload: IconGenerateRequest, current=Depends(get_current_admin)):
    """Generate a unique flat-style icon image for a category using OpenAI gpt-image-1.
    Returns the image base64-encoded so the frontend can preview / save without
    a second round-trip. This does NOT yet attach the icon to a category — the
    admin reviews the preview and explicitly saves it via PUT /categories/{id}.
    """
    desc = (payload.description or "").strip()
    if not desc or len(desc) < 3:
        raise HTTPException(status_code=400, detail="Please describe the icon in a few words")
    if len(desc) > 400:
        raise HTTPException(status_code=400, detail="Description too long (max 400 chars)")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Image generation is not configured (missing key)")

    style = (payload.style_hint or "").strip() or "flat icon, minimalist, vector style, single subject, vibrant solid colors, simple shapes"
    prompt = (
        f"A clean modern app-style icon representing: {desc}. "
        f"Style: {style}. "
        "Center the subject. White or transparent background. No text, no watermarks, "
        "no borders. High contrast. Easy to read at small sizes (32px-64px). "
        "Professional, friendly, glanceable design."
    )

    try:
        from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
        gen = OpenAIImageGeneration(api_key=api_key)
        images = await gen.generate_images(
            prompt=prompt,
            model="gpt-image-1",
            number_of_images=1,
        )
        if not images or len(images) == 0:
            raise HTTPException(status_code=502, detail="Image generation returned no result. Try again.")
        b64 = base64.b64encode(images[0]).decode("utf-8")
        return {"image_base64": b64, "prompt_used": prompt}
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e) or "Image generation failed"
        # Common: rate limit / invalid key / safety block
        if "rate" in msg.lower() or "limit" in msg.lower():
            raise HTTPException(status_code=429, detail="Rate limited. Please try again in a few seconds.")
        if "safety" in msg.lower() or "policy" in msg.lower():
            raise HTTPException(status_code=400, detail="The description was blocked by content safety. Please rephrase.")
        logging.error(f"Icon generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {msg[:120]}")


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
    if payload.custom_icon_b64 is not None:
        # Empty string clears the custom icon, anything else replaces it
        update["custom_icon_b64"] = payload.custom_icon_b64 if payload.custom_icon_b64 else None
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
# Super Admin — read-only system overview (web only)
# ============================================================
SUPERADMIN_USERNAME = "@dM!n#081199"
SUPERADMIN_PASSWORD = "@Dm!N#089191"


@api_router.get("/superadmin/dashboard")
async def superadmin_dashboard(current=Depends(get_current_superadmin)):
    """One-shot read-only snapshot used by the SuperAdmin web console.

    Returns:
      - users:        every registered user (sans password)
      - admins:       admins + per-admin doc_count + connected client_ids
      - clients:      clients + per-client doc_count + connected admin_ids
      - connections:  full admin↔client connection table joined with names
      - stats:        quick counts for the header cards
    """
    users_raw = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(5000)
    users = []
    for u in users_raw:
        users.append({
            "id": u["id"],
            "email": u.get("email"),
            "username": u.get("username"),
            "name": u.get("name") or (u.get("email") or "").split("@")[0],
            "role": u.get("role"),
            "created_at": u.get("created_at"),
        })

    admins_list = [u for u in users if u["role"] == "admin"]
    clients_list = [u for u in users if u["role"] == "client"]

    # All connections
    conns = await db.connections.find({}, {"_id": 0}).to_list(5000)
    by_admin: dict[str, list[str]] = {}
    by_client: dict[str, list[str]] = {}
    for c in conns:
        by_admin.setdefault(c["admin_id"], []).append(c["client_id"])
        by_client.setdefault(c["client_id"], []).append(c["admin_id"])

    # Doc counts per admin and per client
    admin_doc_pipe = [
        {"$group": {"_id": "$admin_id", "count": {"$sum": 1}}},
    ]
    client_doc_pipe = [
        {"$group": {"_id": "$client_id", "count": {"$sum": 1}}},
    ]
    admin_doc_map: dict[str, int] = {}
    async for r in db.documents.aggregate(admin_doc_pipe):
        if r["_id"]:
            admin_doc_map[r["_id"]] = r["count"]
    client_doc_map: dict[str, int] = {}
    async for r in db.documents.aggregate(client_doc_pipe):
        if r["_id"]:
            client_doc_map[r["_id"]] = r["count"]

    user_by_id = {u["id"]: u for u in users}

    admins_out = []
    for a in admins_list:
        connected_client_ids = by_admin.get(a["id"], [])
        admins_out.append({
            **a,
            "doc_count": admin_doc_map.get(a["id"], 0),
            "client_count": len(connected_client_ids),
            "clients": [
                {"id": cid, "name": user_by_id.get(cid, {}).get("name", "?"), "email": user_by_id.get(cid, {}).get("email", "?")}
                for cid in connected_client_ids if cid in user_by_id
            ],
        })

    clients_out = []
    for c in clients_list:
        connected_admin_ids = by_client.get(c["id"], [])
        clients_out.append({
            **c,
            "doc_count": client_doc_map.get(c["id"], 0),
            "admin_count": len(connected_admin_ids),
            "admins": [
                {"id": aid, "name": user_by_id.get(aid, {}).get("name", "?"), "email": user_by_id.get(aid, {}).get("email", "?")}
                for aid in connected_admin_ids if aid in user_by_id
            ],
        })

    # Per-pair doc counts for the connections table
    pair_doc_pipe = [
        {"$group": {"_id": {"a": "$admin_id", "c": "$client_id"}, "count": {"$sum": 1}}},
    ]
    pair_doc_map: dict[tuple, int] = {}
    async for r in db.documents.aggregate(pair_doc_pipe):
        k = (r["_id"].get("a"), r["_id"].get("c"))
        pair_doc_map[k] = r["count"]

    connections_out = []
    for c in conns:
        a = user_by_id.get(c["admin_id"])
        cl = user_by_id.get(c["client_id"])
        connections_out.append({
            "id": c.get("id"),
            "admin_id": c["admin_id"],
            "client_id": c["client_id"],
            "admin_name": (a or {}).get("name", "?"),
            "admin_email": (a or {}).get("email", "?"),
            "client_name": (cl or {}).get("name", "?"),
            "client_email": (cl or {}).get("email", "?"),
            "initiated_by": c.get("initiated_by"),
            "created_at": c.get("created_at"),
            "doc_count": pair_doc_map.get((c["admin_id"], c["client_id"]), 0),
        })

    # Sort newest first wherever there's a created_at.
    users.sort(key=lambda u: u.get("created_at") or "", reverse=True)
    admins_out.sort(key=lambda u: u.get("created_at") or "", reverse=True)
    clients_out.sort(key=lambda u: u.get("created_at") or "", reverse=True)
    connections_out.sort(key=lambda c: c.get("created_at") or "", reverse=True)

    # Documents — admin → client + filename + uploaded_at (newest first)
    docs_raw = await db.documents.find({}, {
        "_id": 0, "id": 1, "admin_id": 1, "client_id": 1,
        "original_name": 1, "category": 1, "category_id": 1,
        "uploaded_at": 1, "size_bytes": 1,
    }).sort("uploaded_at", -1).to_list(2000)
    documents_out = []
    for d in docs_raw:
        a = user_by_id.get(d.get("admin_id"))
        cl = user_by_id.get(d.get("client_id"))
        documents_out.append({
            "id": d.get("id"),
            "filename": d.get("original_name") or "(untitled)",
            "category": d.get("category"),
            "category_id": d.get("category_id"),
            "size_bytes": d.get("size_bytes") or 0,
            "uploaded_at": d.get("uploaded_at"),
            "admin_id": d.get("admin_id"),
            "client_id": d.get("client_id"),
            "admin_name": (a or {}).get("name", "?"),
            "admin_email": (a or {}).get("email", "?"),
            "client_name": (cl or {}).get("name", "?"),
            "client_email": (cl or {}).get("email", "?"),
        })

    total_docs = await db.documents.count_documents({})
    return {
        "stats": {
            "users": len(users),
            "admins": len(admins_out),
            "clients": len(clients_out),
            "connections": len(connections_out),
            "documents": total_docs,
        },
        "users": users,
        "admins": admins_out,
        "clients": clients_out,
        "connections": connections_out,
        "documents": documents_out,
    }


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
# Public marketing stats — real counts for landing trust section
# ============================================================
@app.get("/api/stats/public")
async def public_stats():
    """Publicly visible counts for the landing page. No auth required."""
    admins = await db.users.count_documents({"role": "admin"})
    clients = await db.users.count_documents({"role": "client"})
    docs = await db.documents.count_documents({})
    return {
        "admins": admins,
        "clients": clients,
        "active_users": admins + clients,
        "documents": docs,
        "uptime": "99.9%",  # static for now; real uptime would need monitoring
    }



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

    # Seed SUPER ADMIN — username + password are special, not email-shaped, and
    # this account never appears in /api/clients or /api/admins/connected.
    super_admin = await db.users.find_one({"username": SUPERADMIN_USERNAME})
    if not super_admin:
        super_admin = {
            "id": str(uuid.uuid4()),
            "email": f"superadmin_{uuid.uuid4().hex[:6]}@docvault.local",  # synthetic, unique
            "username": SUPERADMIN_USERNAME,
            "password_hash": hash_password(SUPERADMIN_PASSWORD),
            "name": "System Owner",
            "role": "superadmin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(super_admin)
    elif not verify_password(SUPERADMIN_PASSWORD, super_admin["password_hash"]) or super_admin.get("role") != "superadmin":
        await db.users.update_one(
            {"username": SUPERADMIN_USERNAME},
            {"$set": {
                "password_hash": hash_password(SUPERADMIN_PASSWORD),
                "role": "superadmin",
            }},
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
            response = await super().get_response(path, scope)
        except StarletteHTTPException as ex:
            if ex.status_code == 404:
                index_file = Path(self.directory) / "index.html"
                if index_file.exists():
                    response = FileResponse(index_file)
                else:
                    raise
            else:
                raise
        # Never cache the HTML shell so browsers always pick up the latest
        # hashed asset references after a new build. Hashed assets under
        # /assets/* keep their default long-lived cache (their filename
        # changes when contents change).
        is_html = path.endswith(".html") or path in ("", "/") or "/" not in path.rstrip("/")
        try:
            if is_html and hasattr(response, "headers"):
                response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
                response.headers["Pragma"] = "no-cache"
                response.headers["Expires"] = "0"
        except Exception:
            pass
        return response


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
