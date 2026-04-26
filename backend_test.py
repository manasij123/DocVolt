"""
Backend test for DELETE /api/connections/{target_id} endpoint.

Verifies:
  1. Auth login for both admin and client.
  2. Connection setup (precondition).
  3. Admin removes connection + WS broadcast.
  4. Re-create then client removes connection + WS broadcast.
  5. 404 for non-existent.
  6. 401 for missing/invalid token.
  7. Documents NOT deleted on connection removal.
  8. Idempotency (already-removed -> 404).
"""
import asyncio
import io
import json
import os
import sys
from urllib.parse import urlparse

import requests
import websockets

BACKEND_URL = os.environ.get(
    "BACKEND_URL", "https://doc-organizer-app.preview.emergentagent.com"
).rstrip("/")
API = f"{BACKEND_URL}/api"

# Build WS URL from BACKEND_URL (https -> wss, http -> ws)
parsed = urlparse(BACKEND_URL)
WS_SCHEME = "wss" if parsed.scheme == "https" else "ws"
WS_BASE = f"{WS_SCHEME}://{parsed.netloc}/api/ws"

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
CLIENT_EMAIL = "client@example.com"
CLIENT_PASSWORD = "client123"

results = []


def record(name, passed, detail=""):
    results.append((name, passed, detail))
    icon = "PASS" if passed else "FAIL"
    print(f"[{icon}] {name} :: {detail}")


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    r.raise_for_status()
    data = r.json()
    return data["access_token"], data["user"]


async def collect_ws_events(token, duration=4.0):
    """Open WS, collect all messages received within `duration` seconds, then close."""
    url = f"{WS_BASE}?token={token}"
    received = []
    try:
        async with websockets.connect(url, open_timeout=10, close_timeout=5) as ws:
            try:
                while True:
                    msg = await asyncio.wait_for(ws.recv(), timeout=duration)
                    try:
                        received.append(json.loads(msg))
                    except Exception:
                        received.append({"raw": msg})
            except asyncio.TimeoutError:
                pass
    except Exception as e:
        return received, str(e)
    return received, None


async def open_ws_listen(token, ready_event, stop_event, bag):
    """Open WS, signal `ready_event` after hello received, then collect msgs until stop_event."""
    url = f"{WS_BASE}?token={token}"
    try:
        async with websockets.connect(url, open_timeout=10, close_timeout=5) as ws:
            # Wait for hello
            try:
                first = await asyncio.wait_for(ws.recv(), timeout=5)
                bag.append(json.loads(first))
            except Exception as e:
                bag.append({"_error_hello": str(e)})
            ready_event.set()
            while not stop_event.is_set():
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=0.5)
                    try:
                        bag.append(json.loads(msg))
                    except Exception:
                        bag.append({"raw": msg})
                except asyncio.TimeoutError:
                    continue
                except websockets.ConnectionClosed:
                    break
    except Exception as e:
        bag.append({"_ws_error": str(e)})


def ensure_connection(client_token, admin_user_id):
    """Make sure connection exists between admin and client. Idempotent."""
    r = requests.post(
        f"{API}/connections",
        json={"peer_email": ADMIN_EMAIL},
        headers={"Authorization": f"Bearer {client_token}"},
        timeout=20,
    )
    return r.status_code in (200, 201), r.status_code, (r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text)


def admin_clients(admin_token):
    r = requests.get(f"{API}/clients", headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    r.raise_for_status()
    return r.json()


def client_admins(client_token):
    r = requests.get(f"{API}/admins/connected", headers={"Authorization": f"Bearer {client_token}"}, timeout=20)
    r.raise_for_status()
    return r.json()


async def perform_delete_with_ws(deleter_token, peer_id, listener_admin_token, listener_client_token):
    """Open BOTH admin and client WS, then perform delete, capture events."""
    admin_bag, client_bag = [], []
    admin_ready, client_ready = asyncio.Event(), asyncio.Event()
    stop_event = asyncio.Event()

    admin_task = asyncio.create_task(open_ws_listen(listener_admin_token, admin_ready, stop_event, admin_bag))
    client_task = asyncio.create_task(open_ws_listen(listener_client_token, client_ready, stop_event, client_bag))

    # Wait until both WS have received hello
    await asyncio.wait_for(admin_ready.wait(), timeout=10)
    await asyncio.wait_for(client_ready.wait(), timeout=10)
    # tiny buffer
    await asyncio.sleep(0.3)

    # Do the delete in a thread to not block the loop
    loop = asyncio.get_event_loop()
    def _do_delete():
        return requests.delete(
            f"{API}/connections/{peer_id}",
            headers={"Authorization": f"Bearer {deleter_token}"},
            timeout=20,
        )
    resp = await loop.run_in_executor(None, _do_delete)

    # Wait for events to propagate
    await asyncio.sleep(2.0)
    stop_event.set()
    await asyncio.gather(admin_task, client_task, return_exceptions=True)
    return resp, admin_bag, client_bag


def upload_doc(admin_token, client_id, filename="test_connection_doc Apr'2026.pdf"):
    # tiny valid-ish PDF bytes
    pdf_bytes = (
        b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\nxref\n0 1\n"
        b"0000000000 65535 f \ntrailer<<>>startxref\n0\n%%EOF\n"
    )
    files = {"file": (filename, io.BytesIO(pdf_bytes), "application/pdf")}
    data = {"client_id": client_id}
    r = requests.post(
        f"{API}/documents/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files=files,
        data=data,
        timeout=30,
    )
    return r


def doc_exists_in_listing(admin_token, client_id, doc_id):
    r = requests.get(
        f"{API}/documents",
        params={"client_id": client_id},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    if r.status_code != 200:
        return False, r.status_code, r.text
    docs = r.json()
    return any(d["id"] == doc_id for d in docs), 200, docs


def main():
    print(f"\n=== DELETE /api/connections/{{target_id}} regression ===")
    print(f"API base: {API}")
    print(f"WS base : {WS_BASE}\n")

    # ---- Test 1: Login both ----
    try:
        admin_token, admin_user = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        client_token, client_user = login(CLIENT_EMAIL, CLIENT_PASSWORD)
        record("T1 login admin+client",
               admin_user["role"] == "admin" and client_user["role"] == "client",
               f"admin id={admin_user['id'][:8]} client id={client_user['id'][:8]}")
    except Exception as e:
        record("T1 login", False, str(e))
        return

    admin_id = admin_user["id"]
    client_id = client_user["id"]

    # ---- Test 2: Setup connection precondition ----
    ok, sc, body = ensure_connection(client_token, admin_id)
    record("T2a precondition POST /connections (client->admin)", ok, f"status={sc} body={body}")
    cs = admin_clients(admin_token)
    in_clients = any(c["id"] == client_id for c in cs)
    admins_list = client_admins(client_token)
    in_admins = any(a["id"] == admin_id for a in admins_list)
    record("T2b connection visible in /clients (admin) and /admins/connected (client)",
           in_clients and in_admins,
           f"in_clients={in_clients} in_admins={in_admins}")

    # ---- Test 3: Admin removes connection + WS broadcast ----
    async def step3():
        return await perform_delete_with_ws(admin_token, client_id, admin_token, client_token)

    resp, admin_bag, client_bag = asyncio.run(step3())
    record("T3a DELETE /connections/{client_id} (admin)",
           resp.status_code in (200, 204),
           f"status={resp.status_code} body={resp.text[:200]}")
    cs = admin_clients(admin_token)
    in_clients = any(c["id"] == client_id for c in cs)
    admins_list = client_admins(client_token)
    in_admins = any(a["id"] == admin_id for a in admins_list)
    record("T3b after admin DELETE: client gone from /clients AND admin gone from /admins/connected",
           (not in_clients) and (not in_admins),
           f"in_clients={in_clients} in_admins={in_admins}")
    admin_removed_evt = [e for e in admin_bag if e.get("type") == "connection:removed"]
    client_removed_evt = [e for e in client_bag if e.get("type") == "connection:removed"]
    record("T3c WS broadcast 'connection:removed' to BOTH admin and client",
           len(admin_removed_evt) >= 1 and len(client_removed_evt) >= 1,
           f"admin_evts={admin_removed_evt} client_evts={client_removed_evt}")

    # ---- Test 4: Re-create + client removes ----
    ok, sc, body = ensure_connection(client_token, admin_id)
    record("T4a re-create connection (client->admin)", ok, f"status={sc}")

    async def step4():
        return await perform_delete_with_ws(client_token, admin_id, admin_token, client_token)
    resp, admin_bag, client_bag = asyncio.run(step4())
    record("T4b DELETE /connections/{admin_id} (client)",
           resp.status_code in (200, 204),
           f"status={resp.status_code} body={resp.text[:200]}")
    cs = admin_clients(admin_token)
    in_clients = any(c["id"] == client_id for c in cs)
    admins_list = client_admins(client_token)
    in_admins = any(a["id"] == admin_id for a in admins_list)
    record("T4c after client DELETE: client gone + admin gone",
           (not in_clients) and (not in_admins),
           f"in_clients={in_clients} in_admins={in_admins}")
    admin_removed_evt = [e for e in admin_bag if e.get("type") == "connection:removed"]
    client_removed_evt = [e for e in client_bag if e.get("type") == "connection:removed"]
    record("T4d WS broadcast on client-initiated remove reaches BOTH peers",
           len(admin_removed_evt) >= 1 and len(client_removed_evt) >= 1,
           f"admin_evts={admin_removed_evt} client_evts={client_removed_evt}")

    # ---- Test 5: 404 for non-existent ----
    r = requests.delete(f"{API}/connections/non-existent-uuid",
                        headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    record("T5 DELETE non-existent target -> 404",
           r.status_code == 404, f"status={r.status_code} body={r.text[:200]}")

    # ---- Test 6: 401 handling ----
    r = requests.delete(f"{API}/connections/{client_id}", timeout=20)
    record("T6a DELETE without Authorization header -> 401",
           r.status_code in (401, 403), f"status={r.status_code} body={r.text[:200]}")
    r = requests.delete(f"{API}/connections/{client_id}",
                        headers={"Authorization": "Bearer invalid.token.here"}, timeout=20)
    record("T6b DELETE with malformed token -> 401",
           r.status_code in (401, 403), f"status={r.status_code} body={r.text[:200]}")

    # ---- Test 7: Documents NOT deleted on connection removal ----
    ok, sc, body = ensure_connection(client_token, admin_id)
    if not ok:
        record("T7 setup re-create connection", False, f"status={sc}")
    else:
        up = upload_doc(admin_token, client_id)
        if up.status_code != 200:
            record("T7a upload doc", False, f"status={up.status_code} body={up.text[:200]}")
        else:
            doc_meta = up.json()
            doc_id = doc_meta["id"]
            record("T7a upload doc as admin", True, f"doc_id={doc_id[:8]}")

            # Remove connection
            r = requests.delete(f"{API}/connections/{client_id}",
                                headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
            record("T7b DELETE connection after upload",
                   r.status_code in (200, 204), f"status={r.status_code}")

            # Re-create connection so we can list docs again as scoped admin
            ok2, sc2, _ = ensure_connection(client_token, admin_id)
            record("T7c re-create connection to inspect docs", ok2, f"status={sc2}")
            present, status, body = doc_exists_in_listing(admin_token, client_id, doc_id)
            record("T7d uploaded doc still present after connection removal",
                   present, f"status={status} found={present}")

            # Clean up the test doc so we don't litter the DB
            requests.delete(f"{API}/documents/{doc_id}",
                            headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)

    # ---- Test 8: Idempotency ----
    # Ensure connection exists, delete it, then delete again -> 404
    ensure_connection(client_token, admin_id)
    r1 = requests.delete(f"{API}/connections/{client_id}",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    r2 = requests.delete(f"{API}/connections/{client_id}",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    record("T8 idempotency: 2nd DELETE returns 404",
           r1.status_code in (200, 204) and r2.status_code == 404,
           f"first={r1.status_code} second={r2.status_code} body2={r2.text[:200]}")

    # ---- Restore: re-create connection so the test DB is left in original state ----
    ok, sc, body = ensure_connection(client_token, admin_id)
    record("CLEANUP re-create connection (leave DB stable)",
           ok, f"status={sc}")

    # ---- Summary ----
    passed = sum(1 for _, p, _ in results if p)
    total = len(results)
    print(f"\n=== Results: {passed}/{total} ===")
    for name, p, detail in results:
        print(f"  [{'PASS' if p else 'FAIL'}] {name}")
    if passed != total:
        print("\nFAILED detail:")
        for name, p, d in results:
            if not p:
                print(f"  - {name} -> {d}")
        sys.exit(1)


if __name__ == "__main__":
    main()
