"""Backend regression for the NEW connection flow.

Covers admin↔client connections, lookup, upload guarding, deletion of
connections, and a quick websocket smoke check.

Public base URL is read from /app/frontend/.env (EXPO_PUBLIC_BACKEND_URL)
and all routes are prefixed with /api per ingress rules.
"""
import io
import json
import os
import random
import string
import sys
import time
from pathlib import Path

import requests
import websockets
import asyncio


def _read_backend_url() -> str:
    env_path = Path("/app/frontend/.env")
    for line in env_path.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("EXPO_PUBLIC_BACKEND_URL missing")


BASE = _read_backend_url().rstrip("/")
API = f"{BASE}/api"
WS_BASE = "wss://" + BASE.split("://", 1)[1] + "/api/ws"

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
DEMO_CLIENT_EMAIL = "client@example.com"
DEMO_CLIENT_PASSWORD = "client123"


# --- Tiny test runner -------------------------------------------------------
results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> bool:
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'} | {name} | {detail}")
    return ok


def rand_suffix(n: int = 8) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def login(email: str, password: str) -> tuple[int, dict]:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text}
    return r.status_code, body


def register(name: str, email: str, password: str, role: str = "client", admin_email: str | None = None) -> tuple[int, dict]:
    body = {"name": name, "email": email, "password": password, "role": role}
    if admin_email:
        body["admin_email"] = admin_email
    r = requests.post(f"{API}/auth/register", json=body, timeout=20)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, {"raw": r.text}


# --- Tests ------------------------------------------------------------------

def make_minimal_pdf(name: str = "doc.pdf") -> bytes:
    # Real-ish minimal PDF
    return (
        b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
    )


def main() -> int:
    # 1. admin login
    code, body = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not record(
        "1. POST /auth/login admin", code == 200 and body.get("user", {}).get("role") == "admin",
        f"status={code} body_keys={list(body.keys())}",
    ):
        return _summary()
    admin_token = body["access_token"]
    admin_id = body["user"]["id"]

    # 2. client login
    code, body = login(DEMO_CLIENT_EMAIL, DEMO_CLIENT_PASSWORD)
    if not record(
        "2. POST /auth/login demo client",
        code == 200 and body.get("user", {}).get("role") == "client",
        f"status={code}",
    ):
        return _summary()
    demo_client_token = body["access_token"]
    demo_client_id = body["user"]["id"]

    # 3. GET /clients admin → includes demo client (doc_count >= 1, expected 6)
    r = requests.get(f"{API}/clients", headers=auth_headers(admin_token), timeout=20)
    arr = r.json() if r.ok else []
    demo_row = next((c for c in arr if c.get("email") == DEMO_CLIENT_EMAIL), None)
    record(
        "3. GET /clients (admin) includes demo client",
        r.status_code == 200 and demo_row is not None,
        f"status={r.status_code} found={bool(demo_row)} doc_count={(demo_row or {}).get('doc_count')}",
    )
    if demo_row is not None and demo_row.get("doc_count") != 6:
        record(
            "3b. demo client doc_count == 6 (legacy migration)",
            False,
            f"actual={demo_row.get('doc_count')} (expected 6 from legacy migration)",
        )
    else:
        record("3b. demo client doc_count == 6", demo_row is not None, "ok")

    # 4. GET /admins/connected client → includes admin
    r = requests.get(f"{API}/admins/connected", headers=auth_headers(demo_client_token), timeout=20)
    arr = r.json() if r.ok else []
    has_admin = any(a.get("email") == ADMIN_EMAIL for a in arr)
    record(
        "4. GET /admins/connected (demo client) includes admin",
        r.status_code == 200 and has_admin,
        f"status={r.status_code} count={len(arr)} has_admin={has_admin}",
    )

    # 5. Solo client (no admin_email)
    solo_email = f"solo_{rand_suffix()}@test.com"
    code, body = register("Solo", solo_email, "test123", role="client")
    record(
        "5a. POST /auth/register Solo (no admin_email)",
        code == 200 and body.get("user", {}).get("role") == "client",
        f"status={code}",
    )
    if code != 200:
        return _summary()
    solo_token = body["access_token"]
    solo_id = body["user"]["id"]

    r = requests.get(f"{API}/admins/connected", headers=auth_headers(solo_token), timeout=20)
    arr = r.json() if r.ok else None
    record(
        "5b. Solo /admins/connected returns []",
        r.status_code == 200 and arr == [],
        f"status={r.status_code} body={arr}",
    )

    r = requests.get(f"{API}/clients", headers=auth_headers(admin_token), timeout=20)
    arr = r.json() if r.ok else []
    has_solo = any(c.get("id") == solo_id for c in arr)
    record(
        "5c. /clients (admin) does NOT include Solo (no connection)",
        r.status_code == 200 and not has_solo,
        f"has_solo={has_solo}",
    )

    # 6. Register brand new admin Boss
    boss_email = f"boss_{rand_suffix()}@test.com"
    code, body = register("Boss", boss_email, "test123", role="admin")
    record(
        "6. POST /auth/register Boss (role=admin)",
        code == 200 and body.get("user", {}).get("role") == "admin",
        f"status={code} role={body.get('user', {}).get('role')}",
    )
    if code != 200:
        return _summary()
    boss_token = body["access_token"]
    boss_id = body["user"]["id"]

    # 7. Auto-connect client with Boss
    auto_email = f"auto_{rand_suffix()}@test.com"
    code, body = register("Auto", auto_email, "test123", role="client", admin_email=boss_email)
    record(
        "7a. POST /auth/register Auto with admin_email=Boss",
        code == 200 and body.get("user", {}).get("role") == "client",
        f"status={code}",
    )
    if code != 200:
        return _summary()
    auto_token = body["access_token"]
    auto_id = body["user"]["id"]

    r = requests.get(f"{API}/admins/connected", headers=auth_headers(auto_token), timeout=20)
    arr = r.json() if r.ok else []
    has_boss = any(a.get("id") == boss_id for a in arr)
    record(
        "7b. Auto /admins/connected includes Boss",
        r.status_code == 200 and has_boss,
        f"status={r.status_code} has_boss={has_boss}",
    )

    r = requests.get(f"{API}/clients", headers=auth_headers(boss_token), timeout=20)
    arr = r.json() if r.ok else []
    has_auto = any(c.get("id") == auto_id for c in arr)
    record(
        "7c. Boss /clients includes Auto",
        r.status_code == 200 and has_auto,
        f"status={r.status_code} has_auto={has_auto}",
    )

    # 8. Lookup user
    r = requests.get(
        f"{API}/users/lookup",
        params={"email": ADMIN_EMAIL},
        headers=auth_headers(solo_token),
        timeout=20,
    )
    record(
        "8a. /users/lookup admin email (solo client)",
        r.status_code == 200 and r.json().get("email") == ADMIN_EMAIL,
        f"status={r.status_code}",
    )

    r = requests.get(
        f"{API}/users/lookup",
        params={"email": ADMIN_EMAIL, "role": "client"},
        headers=auth_headers(solo_token),
        timeout=20,
    )
    record(
        "8b. /users/lookup admin email with role=client → 404",
        r.status_code == 404,
        f"status={r.status_code}",
    )

    r = requests.get(
        f"{API}/users/lookup",
        params={"email": f"nonexistent_{rand_suffix()}@test.com"},
        headers=auth_headers(solo_token),
        timeout=20,
    )
    record(
        "8c. /users/lookup nonexistent → 404",
        r.status_code == 404,
        f"status={r.status_code}",
    )

    # 9. Solo client adds admin connection
    r = requests.post(
        f"{API}/connections",
        json={"peer_email": ADMIN_EMAIL},
        headers=auth_headers(solo_token),
        timeout=20,
    )
    body = r.json() if r.ok else {}
    record(
        "9a. POST /connections (solo→admin) status=created",
        r.status_code == 200 and body.get("status") == "created" and body.get("peer", {}).get("email") == ADMIN_EMAIL,
        f"status={r.status_code} body={body}",
    )

    r = requests.post(
        f"{API}/connections",
        json={"peer_email": ADMIN_EMAIL},
        headers=auth_headers(solo_token),
        timeout=20,
    )
    body = r.json() if r.ok else {}
    record(
        "9b. POST /connections again → status=exists",
        r.status_code == 200 and body.get("status") == "exists",
        f"status={r.status_code} body_status={body.get('status')}",
    )

    r = requests.get(f"{API}/admins/connected", headers=auth_headers(solo_token), timeout=20)
    arr = r.json() if r.ok else []
    has_admin = any(a.get("email") == ADMIN_EMAIL for a in arr)
    record(
        "9c. Solo /admins/connected now includes admin",
        r.status_code == 200 and has_admin,
        f"has_admin={has_admin}",
    )

    r = requests.get(f"{API}/clients", headers=auth_headers(admin_token), timeout=20)
    arr = r.json() if r.ok else []
    has_solo = any(c.get("id") == solo_id for c in arr)
    record(
        "9d. /clients (admin) now includes Solo",
        r.status_code == 200 and has_solo,
        f"has_solo={has_solo}",
    )

    # 10. Admin adds Solo client → exists
    r = requests.post(
        f"{API}/connections",
        json={"peer_email": solo_email},
        headers=auth_headers(admin_token),
        timeout=20,
    )
    body = r.json() if r.ok else {}
    record(
        "10. POST /connections (admin→solo) status=exists",
        r.status_code == 200 and body.get("status") == "exists",
        f"status={r.status_code} body_status={body.get('status')}",
    )

    # 11. Admin connecting to another admin → 400
    r = requests.post(
        f"{API}/connections",
        json={"peer_email": boss_email},
        headers=auth_headers(admin_token),
        timeout=20,
    )
    try:
        body = r.json()
    except Exception:
        body = {}
    record(
        "11. POST /connections admin→admin → 400",
        r.status_code == 400 and "admin and a client" in (body.get("detail") or ""),
        f"status={r.status_code} detail={body.get('detail')}",
    )

    # 12. Self-connect
    r = requests.post(
        f"{API}/connections",
        json={"peer_email": ADMIN_EMAIL},
        headers=auth_headers(admin_token),
        timeout=20,
    )
    try:
        body = r.json()
    except Exception:
        body = {}
    record(
        "12. POST /connections self → 400",
        r.status_code == 400 and "yourself" in (body.get("detail") or "").lower(),
        f"status={r.status_code} detail={body.get('detail')}",
    )

    # 13a. Upload to a non-client (boss admin id) → 400 Target client not found
    pdf_bytes = make_minimal_pdf()
    files = {"file": ("monthly return Mar'2026.pdf", pdf_bytes, "application/pdf")}
    data = {"client_id": boss_id}
    r = requests.post(
        f"{API}/documents/upload", headers=auth_headers(admin_token), files=files, data=data, timeout=30,
    )
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    record(
        "13a. Upload with client_id=boss(admin) → 400 Target client not found",
        r.status_code == 400 and "Target client not found" in body.get("detail", ""),
        f"status={r.status_code} detail={body.get('detail')}",
    )

    # 13b. Upload to a client we are NOT connected to (Detached, no admin_email)
    detached_email = f"detached_{rand_suffix()}@test.com"
    code, body = register("Detached", detached_email, "test123", role="client")
    record(
        "13b-pre. register Detached client",
        code == 200,
        f"status={code}",
    )
    detached_id = body["user"]["id"]

    files = {"file": ("ifa report Mar'2026.pdf", pdf_bytes, "application/pdf")}
    data = {"client_id": detached_id}
    r = requests.post(
        f"{API}/documents/upload", headers=auth_headers(admin_token), files=files, data=data, timeout=30,
    )
    try:
        body = r.json()
    except Exception:
        body = {}
    record(
        "13b. Upload to non-connected client → 403 not connected",
        r.status_code == 403 and "not connected" in body.get("detail", "").lower(),
        f"status={r.status_code} detail={body.get('detail')}",
    )

    # 14. DELETE /connections/{peer_id}
    r = requests.delete(
        f"{API}/connections/{admin_id}", headers=auth_headers(solo_token), timeout=20,
    )
    body = r.json() if r.ok else {}
    record(
        "14a. DELETE /connections/admin (solo) → ok",
        r.status_code == 200 and body.get("ok") is True,
        f"status={r.status_code} body={body}",
    )

    r = requests.get(f"{API}/admins/connected", headers=auth_headers(solo_token), timeout=20)
    arr = r.json() if r.ok else []
    record(
        "14b. After delete, /admins/connected does NOT include admin",
        r.status_code == 200 and not any(a.get("email") == ADMIN_EMAIL for a in arr),
        f"count={len(arr)}",
    )

    r = requests.delete(
        f"{API}/connections/{admin_id}", headers=auth_headers(solo_token), timeout=20,
    )
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    record(
        "14c. DELETE again → 404",
        r.status_code == 404,
        f"status={r.status_code} detail={body.get('detail')}",
    )

    # 15. WebSocket smoke
    async def ws_check():
        url = f"{WS_BASE}?token={admin_token}"
        try:
            async with websockets.connect(url, open_timeout=15, close_timeout=5) as ws:
                # First message must be 'hello'
                msg = await asyncio.wait_for(ws.recv(), timeout=10)
                payload = json.loads(msg)
                return payload.get("type") == "hello" and payload.get("user", {}).get("role") == "admin", payload
        except Exception as e:
            return False, str(e)

    ok, payload = asyncio.run(ws_check())
    record(
        "15. WebSocket /api/ws connect with valid token → hello",
        ok,
        f"payload={payload}",
    )

    return _summary()


def _summary() -> int:
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    fails = [r for r in results if not r[1]]
    for name, ok, detail in results:
        flag = "✅" if ok else "❌"
        print(f"{flag} {name}")
        if not ok:
            print(f"     -> {detail}")
    print(f"\nTotal: {len(results)} | Passed: {len(results)-len(fails)} | Failed: {len(fails)}")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
