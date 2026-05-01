"""Backend test for GET /api/categories self-heal logic.

Tests 7 cases per the review request, runs against the public preview host
(EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env with /api prefix).
"""
import os
import sys
import time
import uuid
import json
import requests
from typing import Tuple, Optional

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://doc-organizer-app.preview.emergentagent.com")
API = BASE.rstrip("/") + "/api"

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASS = "admin123"
CLIENT_EMAIL = "client@example.com"
CLIENT_PASS = "client123"

results = []
created_clients = []  # client ids we registered (for cleanup connections)
created_admins = []
created_categories = []  # (admin_token, cat_id) for cleanup


def log_result(name: str, passed: bool, http_status, body_excerpt: str, note: str = ""):
    status = "PASS" if passed else "FAIL"
    line = f"[{status}] {name} — HTTP {http_status} — {body_excerpt[:300]}"
    if note:
        line += f" — {note}"
    print(line, flush=True)
    results.append({"name": name, "passed": passed, "status": http_status, "body": body_excerpt[:500], "note": note})


def login(email: str, password: str) -> Optional[str]:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code == 200:
        return r.json()["access_token"]
    print(f"LOGIN FAIL {email}: {r.status_code} {r.text[:200]}")
    return None


def register(email: str, password: str, name: str, role: str = "client", admin_email: Optional[str] = None) -> Tuple[Optional[str], Optional[str]]:
    body = {"email": email, "password": password, "name": name, "role": role}
    if admin_email:
        body["admin_email"] = admin_email
    r = requests.post(f"{API}/auth/register", json=body, timeout=30)
    if r.status_code == 200:
        j = r.json()
        return j["access_token"], j["user"]["id"]
    print(f"REGISTER FAIL {email}: {r.status_code} {r.text[:200]}")
    return None, None


def main():
    print(f"BASE = {BASE}")
    print(f"API = {API}")

    admin_token = login(ADMIN_EMAIL, ADMIN_PASS)
    if not admin_token:
        print("FATAL: cannot login admin — aborting.")
        sys.exit(1)
    client_token = login(CLIENT_EMAIL, CLIENT_PASS)
    if not client_token:
        print("FATAL: cannot login client — aborting.")
        sys.exit(1)

    me_admin = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30).json()
    me_client = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {client_token}"}, timeout=30).json()
    admin_id = me_admin["id"]
    seeded_client_id = me_client["id"]
    print(f"Admin id: {admin_id}")
    print(f"Seeded client id: {seeded_client_id}")

    # ============================================================
    # TEST 1
    # ============================================================
    r = requests.get(
        f"{API}/categories",
        params={"client_id": seeded_client_id},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    ok = r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) >= 1
    cats_keys = [c.get("key") for c in (r.json() if r.status_code == 200 else [])]
    log_result(
        "T1 REGRESSION admin already connected",
        ok,
        r.status_code,
        json.dumps(cats_keys),
        f"got {len(r.json()) if r.status_code==200 else 0} cats",
    )

    # ============================================================
    # TEST 2
    # ============================================================
    suffix = uuid.uuid4().hex[:8]
    orphan_email = f"orphan_t2_{suffix}@example.com"
    _, orphan_id = register(orphan_email, "orphanpass1", f"Orphan Tester {suffix}", role="client", admin_email=None)
    if not orphan_id:
        log_result("T2 SETUP register orphan client", False, "n/a", "register failed")
    else:
        created_clients.append(orphan_id)
        r1 = requests.get(
            f"{API}/categories",
            params={"client_id": orphan_id},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        first_ok = r1.status_code == 200 and isinstance(r1.json(), list) and len(r1.json()) >= 1
        first_keys = [c.get("key") for c in (r1.json() if r1.status_code == 200 else [])]
        log_result(
            "T2a SELF-HEAL first GET creates connection",
            first_ok,
            r1.status_code,
            json.dumps(first_keys),
        )

        r2 = requests.get(
            f"{API}/categories",
            params={"client_id": orphan_id},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        second_ok = r2.status_code == 200 and isinstance(r2.json(), list) and len(r2.json()) >= 1
        first_ids = sorted([c.get("id") for c in (r1.json() if r1.status_code == 200 else [])])
        second_ids = sorted([c.get("id") for c in (r2.json() if r2.status_code == 200 else [])])
        idempotent = first_ids == second_ids
        log_result(
            "T2b SELF-HEAL second GET idempotent",
            second_ok and idempotent,
            r2.status_code,
            f"first_ids_count={len(first_ids)}, second_ids_count={len(second_ids)}, same={idempotent}",
        )

        rc = requests.get(f"{API}/clients", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        clients_list = rc.json() if rc.status_code == 200 else []
        found = any(c.get("id") == orphan_id for c in clients_list)
        log_result(
            "T2c SELF-HEAL connection row exists (orphan in /clients)",
            rc.status_code == 200 and found,
            rc.status_code,
            f"found={found}, total_clients={len(clients_list)}",
        )

        post_body = {
            "client_id": orphan_id,
            "name": "Test Self Heal Post",
            "color": "#FF0000",
            "icon": "receipt",
            "keywords": ["selfheal", "test"],
        }
        rp = requests.post(
            f"{API}/categories",
            json=post_body,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        post_ok = rp.status_code == 200 and rp.json().get("name") == "Test Self Heal Post"
        if rp.status_code == 200:
            created_categories.append((admin_token, rp.json()["id"]))
        log_result(
            "T2d SELF-HEAL follow-up POST /categories works",
            post_ok,
            rp.status_code,
            (rp.text or "")[:300],
        )

    # ============================================================
    # TEST 3
    # ============================================================
    fake_id = str(uuid.uuid4())
    r3 = requests.get(
        f"{API}/categories",
        params={"client_id": fake_id},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    body3 = r3.text
    ok3 = r3.status_code == 403 and "Not connected with this client" in body3
    log_result(
        "T3 INVALID TARGET non-existent user → 403",
        ok3,
        r3.status_code,
        body3[:200],
    )

    # ============================================================
    # TEST 4
    # ============================================================
    suffix2 = uuid.uuid4().hex[:8]
    other_admin_email = f"otheradmin_t4_{suffix2}@example.com"
    _, other_admin_id = register(other_admin_email, "otheradminpass1", f"Other Admin {suffix2}", role="admin", admin_email=None)
    if not other_admin_id:
        log_result("T4 SETUP register other admin", False, "n/a", "register failed")
    else:
        created_admins.append(other_admin_id)
        r4 = requests.get(
            f"{API}/categories",
            params={"client_id": other_admin_id},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        body4 = r4.text
        ok4 = r4.status_code == 403 and "Not connected with this client" in body4
        log_result(
            "T4 INVALID TARGET admin role → 403 (no self-heal)",
            ok4,
            r4.status_code,
            body4[:200],
        )

    # ============================================================
    # TEST 5
    # ============================================================
    r5 = requests.get(
        f"{API}/categories",
        params={"admin_id": admin_id},
        headers={"Authorization": f"Bearer {client_token}"},
        timeout=30,
    )
    ok5 = r5.status_code == 200 and isinstance(r5.json(), list) and len(r5.json()) >= 1
    log_result(
        "T5 REGRESSION client-role branch unchanged",
        ok5,
        r5.status_code,
        json.dumps([c.get("key") for c in (r5.json() if r5.status_code == 200 else [])]),
    )

    # ============================================================
    # TEST 6
    # ============================================================
    r6 = requests.get(f"{API}/categories", params={"client_id": seeded_client_id}, timeout=30)
    ok6 = r6.status_code == 401
    log_result(
        "T6 AUTH no header → 401",
        ok6,
        r6.status_code,
        r6.text[:200],
    )

    # ============================================================
    # TEST 7
    # ============================================================
    suffix3 = uuid.uuid4().hex[:8]
    orphan2_email = f"orphan_t7_{suffix3}@example.com"
    _, orphan2_id = register(orphan2_email, "orphanpass2", f"Orphan T7 {suffix3}", role="client", admin_email=None)
    if not orphan2_id:
        log_result("T7 SETUP register orphan client", False, "n/a", "register failed")
    else:
        created_clients.append(orphan2_id)
        post_body = {
            "client_id": orphan2_id,
            "name": "Test Self Heal Post",
            "color": "#FF0000",
            "icon": "receipt",
            "keywords": ["regression"],
        }
        rp = requests.post(
            f"{API}/categories",
            json=post_body,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        ok7 = rp.status_code == 200 and rp.json().get("name") == "Test Self Heal Post" and rp.json().get("color") == "#FF0000"
        if rp.status_code == 200:
            created_categories.append((admin_token, rp.json()["id"]))
        log_result(
            "T7 REGRESSION POST /categories self-heal still works",
            ok7,
            rp.status_code,
            (rp.text or "")[:300],
        )

    # ============================================================
    # CLEANUP
    # ============================================================
    print("\n=== CLEANUP ===")
    for tok, cat_id in created_categories:
        try:
            rd = requests.delete(f"{API}/categories/{cat_id}", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
            print(f"DELETE category {cat_id}: {rd.status_code}")
        except Exception as e:
            print(f"DELETE category error: {e}")

    for cid in created_clients:
        try:
            rd = requests.delete(f"{API}/connections/{cid}", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
            print(f"DELETE connection admin↔{cid}: {rd.status_code} {rd.text[:200]}")
        except Exception as e:
            print(f"DELETE connection error: {e}")

    print("\n=== SUMMARY ===")
    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    print(f"{passed}/{total} cases PASS")
    for r in results:
        marker = "PASS" if r["passed"] else "FAIL"
        print(f"[{marker}] {r['name']} (HTTP {r['status']})")

    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
