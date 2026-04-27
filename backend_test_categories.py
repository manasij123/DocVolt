"""Phase-3A per-client dynamic categories backend test.

Tests the new /api/categories CRUD + integration with /api/documents.
Run: python /app/backend_test_categories.py
"""
import io
import os
import json
import requests
import sys

BASE = "https://doc-organizer-app.preview.emergentagent.com/api"

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASS = "admin123"
CLIENT_EMAIL = "client@example.com"
CLIENT_PASS = "client123"

results = []  # (name, ok, info)


def record(name, ok, info=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}  {info}")
    results.append((name, ok, info))


def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=20)
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


def make_pdf_bytes(label="Hello"):
    # minimal valid PDF
    return (
        b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\n"
        b"trailer<</Root 1 0 R>>\n%%EOF\n"
    )


def main():
    # 0. Login both
    try:
        admin_token, admin_user = login(ADMIN_EMAIL, ADMIN_PASS)
        client_token, client_user = login(CLIENT_EMAIL, CLIENT_PASS)
        record("0. login admin+client", True, f"admin_id={admin_user['id'][:8]}.. client_id={client_user['id'][:8]}..")
    except Exception as e:
        record("0. login admin+client", False, str(e))
        return summary()

    admin_id = admin_user["id"]
    client_id = client_user["id"]

    # 1. GET /api/categories as admin with client_id -> 4 defaults
    try:
        r = requests.get(f"{BASE}/categories", params={"client_id": client_id},
                         headers=hdr(admin_token), timeout=20)
        ok = r.status_code == 200
        cats = r.json() if ok else []
        keys = [c.get("key") for c in cats] if isinstance(cats, list) else []
        expected = {"MONTHLY_RETURN", "FORWARDING_LETTER", "IFA_REPORT", "OTHERS"}
        ok2 = expected.issubset(set(keys))
        # validate each default
        valid_shape = True
        for c in cats:
            if c.get("key") in expected:
                if not (isinstance(c.get("id"), str) and c.get("name") and c.get("color", "").startswith("#")
                        and c.get("icon") and isinstance(c.get("keywords"), list)
                        and isinstance(c.get("sort_order"), int) and c.get("is_default") is True):
                    valid_shape = False
        record("1. GET /categories as admin (4 defaults shape)", ok and ok2 and valid_shape,
               f"status={r.status_code} keys={keys}")
        # capture defaults
        defaults_by_key = {c["key"]: c for c in cats if c.get("key") in expected}
        monthly_return_id = defaults_by_key["MONTHLY_RETURN"]["id"]
        others_id = defaults_by_key["OTHERS"]["id"]
    except Exception as e:
        record("1. GET /categories as admin", False, str(e))
        return summary()

    # 2. GET /api/categories as client with admin_id -> same 4 defaults (same ids)
    try:
        r = requests.get(f"{BASE}/categories", params={"admin_id": admin_id},
                         headers=hdr(client_token), timeout=20)
        cats_c = r.json() if r.status_code == 200 else []
        keys_c = {c.get("key") for c in cats_c}
        # ids should match
        ids_match = all(
            next((c["id"] for c in cats_c if c["key"] == k), None) ==
            defaults_by_key[k]["id"] for k in defaults_by_key
        )
        ok = r.status_code == 200 and {"MONTHLY_RETURN", "FORWARDING_LETTER", "IFA_REPORT", "OTHERS"}.issubset(keys_c) and ids_match
        record("2. GET /categories as client (same 4 defaults)", ok,
               f"status={r.status_code} keys={keys_c} ids_match={ids_match}")
    except Exception as e:
        record("2. GET /categories as client", False, str(e))

    # 3a. Admin without client_id -> 400
    try:
        r = requests.get(f"{BASE}/categories", headers=hdr(admin_token), timeout=20)
        ok = r.status_code == 400
        record("3a. admin GET /categories without client_id -> 400", ok, f"status={r.status_code} body={r.text[:120]}")
    except Exception as e:
        record("3a. admin GET /categories without client_id", False, str(e))

    # 3b. Admin with disconnected client_id -> 403
    # Register a brand-new client (not connected) to test
    new_client_email = f"unconnected_{os.urandom(4).hex()}@example.com"
    try:
        r = requests.post(f"{BASE}/auth/register", json={
            "email": new_client_email, "password": "secret123",
            "name": "Unconnected Tester", "role": "client",
        }, timeout=20)
        if r.status_code != 200:
            record("3b setup: register unconnected client", False, f"status={r.status_code} body={r.text[:120]}")
            unconnected_id = None
        else:
            unconnected_id = r.json()["user"]["id"]
    except Exception as e:
        record("3b setup: register unconnected client", False, str(e))
        unconnected_id = None

    if unconnected_id:
        try:
            r = requests.get(f"{BASE}/categories", params={"client_id": unconnected_id},
                             headers=hdr(admin_token), timeout=20)
            ok = r.status_code == 403
            record("3b. admin GET /categories disconnected client -> 403", ok,
                   f"status={r.status_code} body={r.text[:120]}")
        except Exception as e:
            record("3b. admin GET /categories disconnected client", False, str(e))

    # 4a. POST /api/categories as admin -> create "Invoice"
    invoice_id = None
    try:
        r = requests.post(f"{BASE}/categories", json={
            "client_id": client_id, "name": "Invoice", "color": "#10B981",
            "icon": "receipt", "keywords": ["invoice", "bill"],
        }, headers=hdr(admin_token), timeout=20)
        ok = r.status_code == 200
        body = r.json() if ok else {}
        ok2 = (
            ok and body.get("name") == "Invoice" and body.get("key") == "INVOICE"
            and body.get("is_default") is False and body.get("color") == "#10B981"
            and body.get("icon") == "receipt"
            and isinstance(body.get("id"), str)
            and set(body.get("keywords", [])) == {"invoice", "bill"}
        )
        record("4a. POST /categories Invoice -> key=INVOICE is_default=false", ok2,
               f"status={r.status_code} body={json.dumps(body)[:240]}")
        invoice_id = body.get("id")
    except Exception as e:
        record("4a. POST /categories Invoice", False, str(e))

    # 4b. Same name again -> key auto-dedupe to INVOICE_2
    invoice2_id = None
    try:
        r = requests.post(f"{BASE}/categories", json={
            "client_id": client_id, "name": "Invoice", "color": "#10B981",
            "icon": "receipt", "keywords": ["invoice"],
        }, headers=hdr(admin_token), timeout=20)
        body = r.json() if r.status_code == 200 else {}
        ok = r.status_code == 200 and body.get("key") == "INVOICE_2"
        record("4b. POST /categories duplicate name -> key=INVOICE_2", ok,
               f"status={r.status_code} key={body.get('key')}")
        invoice2_id = body.get("id")
    except Exception as e:
        record("4b. POST /categories duplicate", False, str(e))

    # 5. POST as client -> 401/403
    try:
        r = requests.post(f"{BASE}/categories", json={
            "client_id": client_id, "name": "ShouldFail", "color": "#000000",
            "icon": "x", "keywords": [],
        }, headers=hdr(client_token), timeout=20)
        ok = r.status_code in (401, 403)
        record("5. POST /categories as client -> 401/403", ok,
               f"status={r.status_code} body={r.text[:120]}")
    except Exception as e:
        record("5. POST /categories as client", False, str(e))

    # 6. PUT /api/categories/{id}: rename + change color
    if invoice_id:
        try:
            r = requests.put(f"{BASE}/categories/{invoice_id}", json={
                "name": "Bill / Invoice", "color": "#F59E0B",
            }, headers=hdr(admin_token), timeout=20)
            body = r.json() if r.status_code == 200 else {}
            ok = (r.status_code == 200 and body.get("name") == "Bill / Invoice"
                  and body.get("color") == "#F59E0B" and body.get("id") == invoice_id
                  and body.get("key") == "INVOICE")  # key should not change
            record("6. PUT /categories rename+color", ok,
                   f"status={r.status_code} name={body.get('name')} color={body.get('color')} key={body.get('key')}")
        except Exception as e:
            record("6. PUT /categories rename+color", False, str(e))

    # 7. DELETE custom Invoice (with no docs) -> {ok:true, moved_to_others:0}
    if invoice_id:
        try:
            r = requests.delete(f"{BASE}/categories/{invoice_id}",
                                headers=hdr(admin_token), timeout=20)
            body = r.json() if r.status_code == 200 else {}
            ok = r.status_code == 200 and body.get("ok") is True and body.get("moved_to_others") == 0
            record("7. DELETE /categories/{invoice_id} -> ok, moved=0", ok,
                   f"status={r.status_code} body={body}")
        except Exception as e:
            record("7. DELETE /categories invoice", False, str(e))

    # 8. DELETE OTHERS default -> 400
    try:
        r = requests.delete(f"{BASE}/categories/{others_id}",
                            headers=hdr(admin_token), timeout=20)
        body = r.text
        ok = r.status_code == 400 and "fallback" in body.lower()
        record("8. DELETE OTHERS default -> 400 fallback msg", ok,
               f"status={r.status_code} body={body[:200]}")
    except Exception as e:
        record("8. DELETE OTHERS default", False, str(e))

    # 9a. Upload with category_id=monthly_return_id
    upload_doc_id_a = None
    try:
        files = {"file": ("test_upload_cat.pdf", make_pdf_bytes(), "application/pdf")}
        data = {"client_id": client_id, "category_id": monthly_return_id}
        r = requests.post(f"{BASE}/documents/upload", headers=hdr(admin_token),
                          files=files, data=data, timeout=30)
        body = r.json() if r.status_code == 200 else {}
        ok = (r.status_code == 200 and body.get("category_id") == monthly_return_id
              and body.get("category") == "MONTHLY_RETURN")
        record("9a. upload with category_id=MONTHLY_RETURN", ok,
               f"status={r.status_code} cat_id={body.get('category_id')==monthly_return_id} cat={body.get('category')}")
        upload_doc_id_a = body.get("id")
    except Exception as e:
        record("9a. upload with category_id", False, str(e))

    # 9b. Upload with category_override=MONTHLY_RETURN -> same category_id
    upload_doc_id_b = None
    try:
        files = {"file": ("test_upload_legacy.pdf", make_pdf_bytes(), "application/pdf")}
        data = {"client_id": client_id, "category_override": "MONTHLY_RETURN"}
        r = requests.post(f"{BASE}/documents/upload", headers=hdr(admin_token),
                          files=files, data=data, timeout=30)
        body = r.json() if r.status_code == 200 else {}
        ok = (r.status_code == 200 and body.get("category_id") == monthly_return_id
              and body.get("category") == "MONTHLY_RETURN")
        record("9b. upload with category_override=MONTHLY_RETURN -> same id", ok,
               f"status={r.status_code} cat_id={body.get('category_id')} cat={body.get('category')}")
        upload_doc_id_b = body.get("id")
    except Exception as e:
        record("9b. upload with category_override", False, str(e))

    # 10a. List filter category_id
    try:
        r = requests.get(f"{BASE}/documents",
                         params={"client_id": client_id, "category_id": monthly_return_id},
                         headers=hdr(admin_token), timeout=20)
        docs = r.json() if r.status_code == 200 else []
        ids = {d["id"] for d in docs}
        ok = (r.status_code == 200 and isinstance(docs, list) and len(docs) > 0
              and all(d.get("category_id") == monthly_return_id for d in docs))
        contained = (upload_doc_id_a in ids) and (upload_doc_id_b in ids if upload_doc_id_b else True)
        record("10a. GET /documents?category_id=monthly_return", ok and contained,
               f"status={r.status_code} count={len(docs)} contains_uploads={contained}")
    except Exception as e:
        record("10a. GET /documents?category_id=", False, str(e))

    # 10b. Legacy ?category=MONTHLY_RETURN
    try:
        r = requests.get(f"{BASE}/documents",
                         params={"client_id": client_id, "category": "MONTHLY_RETURN"},
                         headers=hdr(admin_token), timeout=20)
        docs = r.json() if r.status_code == 200 else []
        ok = (r.status_code == 200 and len(docs) > 0
              and all(d.get("category") == "MONTHLY_RETURN" for d in docs))
        record("10b. GET /documents?category=MONTHLY_RETURN (legacy)", ok,
               f"status={r.status_code} count={len(docs)}")
    except Exception as e:
        record("10b. legacy category filter", False, str(e))

    # 11. Migration — every doc with admin_id+client_id should have category_id
    try:
        r = requests.get(f"{BASE}/documents", params={"client_id": client_id},
                         headers=hdr(admin_token), timeout=20)
        docs = r.json() if r.status_code == 200 else []
        missing = [d["id"] for d in docs if not d.get("category_id")]
        ok = r.status_code == 200 and len(docs) > 0 and len(missing) == 0
        record("11. migration — every existing doc has category_id populated", ok,
               f"total={len(docs)} missing_category_id={len(missing)}")
    except Exception as e:
        record("11. migration", False, str(e))

    # 12. Delete with docs fallback — create new cat, move doc, delete cat
    try:
        # create category "TempBills"
        r = requests.post(f"{BASE}/categories", json={
            "client_id": client_id, "name": "TempBills", "color": "#EF4444",
            "icon": "receipt", "keywords": [],
        }, headers=hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        tempcat = r.json()
        tempcat_id = tempcat["id"]
        # upload a doc
        files = {"file": ("temp_for_move.pdf", make_pdf_bytes(), "application/pdf")}
        data = {"client_id": client_id, "category_id": tempcat_id}
        r2 = requests.post(f"{BASE}/documents/upload", headers=hdr(admin_token),
                           files=files, data=data, timeout=30)
        assert r2.status_code == 200, r2.text
        moved_doc_id = r2.json()["id"]
        # confirm doc has tempcat_id
        # delete category
        r3 = requests.delete(f"{BASE}/categories/{tempcat_id}",
                             headers=hdr(admin_token), timeout=20)
        body = r3.json() if r3.status_code == 200 else {}
        ok_del = r3.status_code == 200 and body.get("ok") is True and body.get("moved_to_others") == 1
        # check the doc now has category_id == others_id
        r4 = requests.get(f"{BASE}/documents", params={"client_id": client_id, "category_id": others_id},
                          headers=hdr(admin_token), timeout=20)
        docs4 = r4.json() if r4.status_code == 200 else []
        ids4 = {d["id"] for d in docs4}
        moved_ok = moved_doc_id in ids4
        record("12. delete category w/docs -> moved_to_others=1, doc now in OTHERS", ok_del and moved_ok,
               f"del_body={body} moved_doc_in_OTHERS={moved_ok}")
        # cleanup the test doc
        requests.delete(f"{BASE}/documents/{moved_doc_id}", headers=hdr(admin_token), timeout=10)
    except Exception as e:
        record("12. delete-with-docs fallback", False, str(e))

    # Cleanup: invoice2 + uploaded test docs
    if invoice2_id:
        try:
            requests.delete(f"{BASE}/categories/{invoice2_id}", headers=hdr(admin_token), timeout=10)
        except Exception:
            pass
    for did in [upload_doc_id_a, upload_doc_id_b]:
        if did:
            try:
                requests.delete(f"{BASE}/documents/{did}", headers=hdr(admin_token), timeout=10)
            except Exception:
                pass

    return summary()


def summary():
    print("\n========= SUMMARY =========")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    for name, ok, info in results:
        print(f"{'OK ' if ok else 'XX '} {name}")
    print(f"\n{passed}/{total} tests passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
