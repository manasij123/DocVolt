"""
Comprehensive backend tests for DocVault multi-tenant FastAPI server.
Run: python /app/backend_test.py
"""
import asyncio
import io
import json
import random
import string
import sys
import uuid

import requests
import websockets

BASE = "http://localhost:8001/api"
WS_BASE = "ws://localhost:8001/api/ws"

results = []  # (name, ok, detail)


def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}  {detail if not ok else ''}")
    results.append((name, ok, detail))


def rand_email():
    s = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"newclient_{s}@test.com"


def make_pdf_bytes():
    # Tiny valid-ish PDF
    return (
        b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
        b"1 0 obj<<>>endobj\n"
        b"trailer<</Root 1 0 R>>\n"
        b"%%EOF\n"
    )


def main():
    admin_token = client_token = new_token = None
    new_client_id = None
    demo_client_id = None
    uploaded_doc_id = None

    # 1. login admin
    r = requests.post(f"{BASE}/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    ok = r.status_code == 200 and r.json().get("user", {}).get("role") == "admin"
    record("1. POST /auth/login admin", ok, f"status={r.status_code} body={r.text[:200]}")
    if ok:
        admin_token = r.json()["access_token"]

    # 2. login client
    r = requests.post(f"{BASE}/auth/login", json={"email": "client@example.com", "password": "client123"})
    ok = r.status_code == 200 and r.json().get("user", {}).get("role") == "client"
    record("2. POST /auth/login client", ok, f"status={r.status_code} body={r.text[:200]}")
    if ok:
        client_token = r.json()["access_token"]

    # 3. login wrong password
    r = requests.post(f"{BASE}/auth/login", json={"email": "admin@example.com", "password": "wrongpass"})
    record("3. POST /auth/login wrong pwd -> 401", r.status_code == 401, f"status={r.status_code} body={r.text[:200]}")

    # 4. register new client
    new_email = rand_email()
    r = requests.post(f"{BASE}/auth/register", json={
        "name": "Tester",
        "email": new_email,
        "password": "test1234",
        "role": "client",
    })
    ok = r.status_code == 200 and r.json().get("user", {}).get("role") == "client"
    record("4. POST /auth/register new client", ok, f"status={r.status_code} body={r.text[:200]}")
    if ok:
        new_token = r.json()["access_token"]
        new_client_id = r.json()["user"]["id"]

    # 5. register duplicate
    r = requests.post(f"{BASE}/auth/register", json={
        "name": "Tester2",
        "email": new_email,
        "password": "test1234",
        "role": "client",
    })
    record("5. POST /auth/register duplicate -> 409", r.status_code == 409, f"status={r.status_code} body={r.text[:200]}")

    # 6. password too short
    r = requests.post(f"{BASE}/auth/register", json={
        "name": "Short",
        "email": rand_email(),
        "password": "12345",
        "role": "client",
    })
    record("6. POST /auth/register short pwd -> 400", r.status_code == 400, f"status={r.status_code} body={r.text[:200]}")

    # 7. /auth/me admin
    r = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    ok = r.status_code == 200 and r.json().get("role") == "admin" and r.json().get("email") == "admin@example.com"
    record("7. GET /auth/me admin", ok, f"status={r.status_code} body={r.text[:200]}")

    # 8. /auth/me no token
    r = requests.get(f"{BASE}/auth/me")
    record("8. GET /auth/me no token -> 401", r.status_code == 401, f"status={r.status_code} body={r.text[:200]}")

    # 9. /clients admin
    r = requests.get(f"{BASE}/clients", headers={"Authorization": f"Bearer {admin_token}"})
    ok = r.status_code == 200 and isinstance(r.json(), list)
    detail = f"status={r.status_code} body={r.text[:300]}"
    if ok:
        clients = r.json()
        emails = {c["email"]: c for c in clients}
        # demo client present?
        demo_present = "client@example.com" in emails
        new_present = new_email in emails
        all_have_doc_count = all("doc_count" in c for c in clients)
        all_have_last_upload = all("last_upload_at" in c for c in clients)
        ok = demo_present and new_present and all_have_doc_count and all_have_last_upload
        detail += f" demo={demo_present} new={new_present} doc_count_field={all_have_doc_count} last_upload_field={all_have_last_upload}"
        if demo_present:
            demo_client_id = emails["client@example.com"]["id"]
    record("9. GET /clients admin", ok, detail)

    # 10. /clients with client token
    r = requests.get(f"{BASE}/clients", headers={"Authorization": f"Bearer {client_token}"})
    record("10. GET /clients client -> 403", r.status_code == 403, f"status={r.status_code} body={r.text[:200]}")

    # 11. /admins/connected with client token
    r = requests.get(f"{BASE}/admins/connected", headers={"Authorization": f"Bearer {client_token}"})
    ok = r.status_code == 200 and isinstance(r.json(), list)
    record("11. GET /admins/connected demo client", ok, f"status={r.status_code} body={r.text[:300]}")

    # 12. /admins/connected with admin token
    r = requests.get(f"{BASE}/admins/connected", headers={"Authorization": f"Bearer {admin_token}"})
    record("12. GET /admins/connected admin -> 403", r.status_code == 403, f"status={r.status_code} body={r.text[:200]}")

    # 13. upload doc
    if demo_client_id:
        files = {"file": ("monthly return Mar'2026.pdf", make_pdf_bytes(), "application/pdf")}
        data = {"client_id": demo_client_id}
        r = requests.post(
            f"{BASE}/documents/upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data=data,
        )
        ok = r.status_code == 200
        body = r.json() if ok else {}
        detail = f"status={r.status_code} body={r.text[:300]}"
        if ok:
            cat_ok = body.get("category") == "MONTHLY_RETURN"
            year_ok = body.get("year") == 2026
            month_ok = body.get("month") == 3
            client_ok = body.get("client_id") == demo_client_id
            admin_ok = bool(body.get("admin_id"))
            ok = cat_ok and year_ok and month_ok and client_ok and admin_ok
            detail += f" cat={cat_ok} year={year_ok} month={month_ok} client_id={client_ok} admin_id={admin_ok}"
            uploaded_doc_id = body.get("id")
        record("13. POST /documents/upload admin", ok, detail)
    else:
        record("13. POST /documents/upload admin", False, "demo_client_id not found")

    # 14. upload missing client_id
    files = {"file": ("test.pdf", make_pdf_bytes(), "application/pdf")}
    r = requests.post(
        f"{BASE}/documents/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files=files,
    )
    record("14. POST /documents/upload no client_id -> 422", r.status_code == 422, f"status={r.status_code} body={r.text[:200]}")

    # 15. upload bad client_id
    files = {"file": ("test.pdf", make_pdf_bytes(), "application/pdf")}
    data = {"client_id": str(uuid.uuid4())}
    r = requests.post(
        f"{BASE}/documents/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files=files,
        data=data,
    )
    ok = r.status_code == 400 and "Target client not found" in r.text
    record("15. POST /documents/upload bad client_id -> 400", ok, f"status={r.status_code} body={r.text[:200]}")

    # 16. upload with client token
    files = {"file": ("test.pdf", make_pdf_bytes(), "application/pdf")}
    data = {"client_id": demo_client_id or str(uuid.uuid4())}
    r = requests.post(
        f"{BASE}/documents/upload",
        headers={"Authorization": f"Bearer {client_token}"},
        files=files,
        data=data,
    )
    record("16. POST /documents/upload client token -> 403", r.status_code == 403, f"status={r.status_code} body={r.text[:200]}")

    # 17. /documents admin no params
    r = requests.get(f"{BASE}/documents", headers={"Authorization": f"Bearer {admin_token}"})
    ok = r.status_code == 200 and isinstance(r.json(), list)
    detail = f"status={r.status_code} count={len(r.json()) if ok else 0}"
    if ok and uploaded_doc_id:
        ids = [d["id"] for d in r.json()]
        ok = uploaded_doc_id in ids
        detail += f" uploaded_present={ok}"
    record("17. GET /documents admin no params", ok, detail)

    # 18. /documents admin filter client_id
    if demo_client_id:
        r = requests.get(f"{BASE}/documents?client_id={demo_client_id}", headers={"Authorization": f"Bearer {admin_token}"})
        ok = r.status_code == 200 and isinstance(r.json(), list)
        if ok:
            all_match = all(d["client_id"] == demo_client_id for d in r.json())
            ok = all_match
        record("18. GET /documents?client_id=demo admin", ok, f"status={r.status_code}")
    else:
        record("18. GET /documents?client_id admin", False, "no demo_client_id")

    # 19. /documents demo client
    r = requests.get(f"{BASE}/documents", headers={"Authorization": f"Bearer {client_token}"})
    ok = r.status_code == 200 and isinstance(r.json(), list)
    detail = f"status={r.status_code} count={len(r.json()) if ok else 0}"
    if ok and uploaded_doc_id:
        ids = [d["id"] for d in r.json()]
        ok = uploaded_doc_id in ids
        detail += f" uploaded_present={ok}"
    record("19. GET /documents demo client", ok, detail)

    # 20. /documents new client
    r = requests.get(f"{BASE}/documents", headers={"Authorization": f"Bearer {new_token}"})
    ok = r.status_code == 200 and r.json() == []
    record("20. GET /documents new client -> []", ok, f"status={r.status_code} body={r.text[:200]}")

    # 21. file fetch admin
    if uploaded_doc_id:
        r = requests.get(f"{BASE}/documents/{uploaded_doc_id}/file", headers={"Authorization": f"Bearer {admin_token}"})
        ok = r.status_code == 200 and r.headers.get("content-type", "").startswith("application/pdf")
        record("21. GET /documents/{id}/file admin", ok, f"status={r.status_code} ct={r.headers.get('content-type')}")
    else:
        record("21. GET /documents/{id}/file admin", False, "no doc id")

    # 22. file fetch demo client
    if uploaded_doc_id:
        r = requests.get(f"{BASE}/documents/{uploaded_doc_id}/file", headers={"Authorization": f"Bearer {client_token}"})
        ok = r.status_code == 200
        record("22. GET /documents/{id}/file demo client", ok, f"status={r.status_code}")

    # 23. file fetch new client (forbidden)
    if uploaded_doc_id:
        r = requests.get(f"{BASE}/documents/{uploaded_doc_id}/file", headers={"Authorization": f"Bearer {new_token}"})
        record("23. GET /documents/{id}/file new client -> 403", r.status_code == 403, f"status={r.status_code} body={r.text[:200]}")

    # 24. PUT /documents/{id} admin
    if uploaded_doc_id:
        r = requests.put(
            f"{BASE}/documents/{uploaded_doc_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"display_name": "Updated Name"},
        )
        ok = r.status_code == 200 and r.json().get("display_name") == "Updated Name"
        record("24. PUT /documents/{id} admin", ok, f"status={r.status_code} body={r.text[:200]}")

    # 25. PUT /documents/{id} client (should be 403, but admin dependency raises 403)
    if uploaded_doc_id:
        r = requests.put(
            f"{BASE}/documents/{uploaded_doc_id}",
            headers={"Authorization": f"Bearer {client_token}"},
            json={"display_name": "Hacker"},
        )
        record("25. PUT /documents/{id} client -> 403", r.status_code == 403, f"status={r.status_code} body={r.text[:200]}")

    # 26. DELETE
    if uploaded_doc_id:
        r = requests.delete(f"{BASE}/documents/{uploaded_doc_id}", headers={"Authorization": f"Bearer {admin_token}"})
        ok = r.status_code == 200 and r.json().get("ok") is True
        record("26a. DELETE /documents/{id} admin", ok, f"status={r.status_code} body={r.text[:200]}")
        r = requests.get(f"{BASE}/documents/{uploaded_doc_id}/file", headers={"Authorization": f"Bearer {admin_token}"})
        record("26b. GET deleted doc file -> 404", r.status_code == 404, f"status={r.status_code} body={r.text[:200]}")

    # WebSocket tests
    asyncio.run(websocket_tests(admin_token))

    # Static site tests
    r = requests.get(f"{BASE}/web/", allow_redirects=True)
    ok = r.status_code == 200 and "<html" in r.text.lower()
    record("WS1. GET /api/web/ -> 200 html", ok, f"status={r.status_code}")

    r = requests.get(f"{BASE}/web/admin/login", allow_redirects=True)
    ok = r.status_code == 200 and "<html" in r.text.lower()
    record("WS2. GET /api/web/admin/login -> 200 html (SPA fallback)", ok, f"status={r.status_code}")

    print()
    print("=" * 70)
    failed = [r for r in results if not r[1]]
    print(f"TOTAL: {len(results)}  PASSED: {len(results) - len(failed)}  FAILED: {len(failed)}")
    if failed:
        print("FAILED CASES:")
        for n, _, d in failed:
            print(f"  - {n}: {d}")
        sys.exit(1)


async def websocket_tests(admin_token):
    # valid token: should get hello
    try:
        async with websockets.connect(f"{WS_BASE}?token={admin_token}", open_timeout=5) as ws:
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            payload = json.loads(msg)
            ok = payload.get("type") == "hello" and payload.get("user", {}).get("role") == "admin"
            record("WS-1. /api/ws valid token handshake + hello", ok, f"msg={msg[:200]}")
    except Exception as e:
        record("WS-1. /api/ws valid token handshake", False, f"exc={e}")

    # missing token: should close with 4401
    try:
        async with websockets.connect(f"{WS_BASE}", open_timeout=5) as ws:
            try:
                await asyncio.wait_for(ws.recv(), timeout=5)
            except websockets.ConnectionClosed as cc:
                ok = cc.code == 4401
                record("WS-2. /api/ws missing token -> close 4401", ok, f"code={cc.code}")
                return
            record("WS-2. /api/ws missing token -> close 4401", False, "no close received")
    except websockets.InvalidStatus as e:
        # If server rejects handshake before accept, capture that
        record("WS-2. /api/ws missing token -> close 4401", False, f"InvalidStatus={e}")
    except Exception as e:
        # Some versions raise ConnectionClosed at connect time
        try:
            code = getattr(e, "code", None) or getattr(getattr(e, "rcvd", None), "code", None)
            ok = code == 4401
            record("WS-2. /api/ws missing token -> close 4401", ok, f"exc={e} code={code}")
        except Exception:
            record("WS-2. /api/ws missing token -> close 4401", False, f"exc={e}")

    # invalid token
    try:
        async with websockets.connect(f"{WS_BASE}?token=invalid.jwt.here", open_timeout=5) as ws:
            try:
                await asyncio.wait_for(ws.recv(), timeout=5)
            except websockets.ConnectionClosed as cc:
                ok = cc.code == 4401
                record("WS-3. /api/ws invalid token -> close 4401", ok, f"code={cc.code}")
                return
            record("WS-3. /api/ws invalid token -> close 4401", False, "no close received")
    except Exception as e:
        code = getattr(e, "code", None) or getattr(getattr(e, "rcvd", None), "code", None)
        ok = code == 4401
        record("WS-3. /api/ws invalid token -> close 4401", ok, f"exc={e} code={code}")


if __name__ == "__main__":
    main()
