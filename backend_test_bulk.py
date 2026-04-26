"""
Bulk download endpoint testing — POST /api/documents/bulk-download

Tests cases 1-14 from the review request.
"""
import io
import os
import sys
import zipfile
import hashlib
import uuid
import json
import requests

BASE = os.environ.get("BACKEND_URL", "https://doc-organizer-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
CLIENT_EMAIL = "client@example.com"
CLIENT_PASSWORD = "client123"

PASS = "PASS"
FAIL = "FAIL"
results = []


def record(name, status, detail=""):
    line = f"[{status}] {name} :: {detail}"
    print(line)
    results.append((name, status, detail))


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    r.raise_for_status()
    body = r.json()
    return body["access_token"], body["user"]


def get_docs(token, params=None):
    r = requests.get(f"{API}/documents", headers={"Authorization": f"Bearer {token}"}, params=params or {}, timeout=20)
    r.raise_for_status()
    return r.json()


def get_doc_bytes(token, doc_id):
    r = requests.get(
        f"{API}/documents/{doc_id}/file",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    r.raise_for_status()
    return r.content


def bulk_download(token_header, doc_ids):
    headers = {}
    if token_header is not None:
        headers["Authorization"] = token_header
    return requests.post(
        f"{API}/documents/bulk-download",
        headers=headers,
        json={"doc_ids": doc_ids},
        timeout=120,
    )


def main():
    # ---------- 1. Auth ----------
    try:
        admin_token, admin_user = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        client_token, client_user = login(CLIENT_EMAIL, CLIENT_PASSWORD)
        record("01-auth-login-admin-and-client", PASS,
               f"admin id={admin_user['id'][:8]} client id={client_user['id'][:8]}")
    except Exception as e:
        record("01-auth-login-admin-and-client", FAIL, repr(e))
        return

    # ---------- 2. Discover docs ----------
    try:
        admin_docs = get_docs(admin_token)
        client_docs = get_docs(client_token)
        if not admin_docs:
            record("02-discover-docs", FAIL, "admin has no docs to test with")
            return
        if not client_docs:
            record("02-discover-docs", FAIL, "client has no docs to test with")
            return
        # admin's docs that go to demo client (preferred for happy path)
        admin_to_demo = [d for d in admin_docs if d.get("client_id") == client_user["id"]]
        if len(admin_to_demo) < 2:
            # use any 2 admin docs; they'll still be valid for admin
            admin_to_demo = admin_docs[:2] if len(admin_docs) >= 2 else admin_docs
        record("02-discover-docs", PASS,
               f"admin_docs={len(admin_docs)} client_docs={len(client_docs)} "
               f"admin->demoClient={len(admin_to_demo)}")
    except Exception as e:
        record("02-discover-docs", FAIL, repr(e))
        return

    # ---------- 3. Happy path — admin ----------
    try:
        ids = [d["id"] for d in admin_docs[:2]]
        if len(ids) < 2:
            record("03-happy-admin", FAIL, "need >=2 admin docs")
        else:
            r = bulk_download(f"Bearer {admin_token}", ids)
            ok_status = r.status_code == 200
            ctype = r.headers.get("Content-Type", "")
            cdisp = r.headers.get("Content-Disposition", "")
            ok_ct = ctype.startswith("application/zip")
            ok_cd = cdisp.startswith('attachment; filename="docvault-bundle-')
            try:
                zf = zipfile.ZipFile(io.BytesIO(r.content))
                names = zf.namelist()
                bad = zf.testzip()
                ok_zip = (bad is None) and (len(names) == len(ids))
            except Exception as ze:
                names, ok_zip = [], False
                record("03-happy-admin-zip-parse", FAIL, repr(ze))
            # Compare bytes
            byte_match = True
            mismatches = []
            for i, doc_id in enumerate(ids):
                doc = next(d for d in admin_docs if d["id"] == doc_id)
                expected = get_doc_bytes(admin_token, doc_id)
                # Find this doc's entry — could be display_name.pdf, possibly de-duped
                # Match by size first, fall back to first entry of same size
                match_name = None
                for nm in names:
                    if zf.getinfo(nm).file_size == len(expected):
                        match_name = nm
                        break
                if match_name is None:
                    byte_match = False
                    mismatches.append(f"{doc_id}: no entry of size {len(expected)}")
                    continue
                got = zf.read(match_name)
                if got != expected:
                    byte_match = False
                    mismatches.append(f"{doc_id}: bytes differ")
            overall = ok_status and ok_ct and ok_cd and ok_zip and byte_match
            detail = (f"status={r.status_code} ct={ctype!r} cd_ok={ok_cd} "
                      f"entries={len(names)} names={names[:3]} byte_match={byte_match} "
                      f"{'mismatches=' + str(mismatches) if mismatches else ''}")
            record("03-happy-admin", PASS if overall else FAIL, detail)
    except Exception as e:
        record("03-happy-admin", FAIL, repr(e))

    # ---------- 4. Happy path — client ----------
    try:
        cids = [d["id"] for d in client_docs[:2]]
        if len(cids) < 2:
            record("04-happy-client", FAIL, "need >=2 client docs")
        else:
            r = bulk_download(f"Bearer {client_token}", cids)
            ok_status = r.status_code == 200
            ctype = r.headers.get("Content-Type", "")
            cdisp = r.headers.get("Content-Disposition", "")
            ok_ct = ctype.startswith("application/zip")
            ok_cd = cdisp.startswith('attachment; filename="docvault-bundle-')
            zf = zipfile.ZipFile(io.BytesIO(r.content))
            names = zf.namelist()
            ok_zip = (zf.testzip() is None) and (len(names) == len(cids))
            byte_match = True
            for doc_id in cids:
                expected = get_doc_bytes(client_token, doc_id)
                found = False
                for nm in names:
                    if zf.read(nm) == expected:
                        found = True
                        break
                if not found:
                    byte_match = False
                    break
            overall = ok_status and ok_ct and ok_cd and ok_zip and byte_match
            record("04-happy-client", PASS if overall else FAIL,
                   f"status={r.status_code} entries={len(names)} byte_match={byte_match}")
    except Exception as e:
        record("04-happy-client", FAIL, repr(e))

    # ---------- 5. Cross-role 403 — client requests an admin's doc ----------
    # Find a doc the client should NOT have access to: an admin doc whose client_id != client_user.id
    try:
        forbidden = next(
            (d for d in admin_docs if d.get("client_id") != client_user["id"]),
            None,
        )
        if forbidden is None:
            # Create a second client and an admin doc to that client to obtain a forbidden id.
            email2 = f"forbidtest-{uuid.uuid4().hex[:8]}@example.com"
            r0 = requests.post(f"{API}/auth/register", json={
                "email": email2, "password": "Passw0rd!", "name": "Forbid Test", "role": "client",
                "admin_email": ADMIN_EMAIL,
            }, timeout=20)
            if r0.status_code not in (200, 201):
                record("05-cross-role-forbidden-setup", FAIL, f"could not create 2nd client: {r0.status_code} {r0.text[:120]}")
                forbidden = None
            else:
                body = r0.json()
                client2_id = body["user"]["id"]
                # Upload a small fake PDF to client2 as admin
                pdf = b"%PDF-1.4\n%fakepdf\n%%EOF"
                up = requests.post(
                    f"{API}/documents/upload",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    data={"client_id": client2_id},
                    files={"file": ("forbidden-probe.pdf", pdf, "application/pdf")},
                    timeout=30,
                )
                if up.status_code == 200:
                    forbidden = up.json()
                    # Track for cleanup
                    forbidden["_cleanup"] = True
                else:
                    record("05-cross-role-forbidden-setup", FAIL, f"upload failed: {up.status_code} {up.text[:120]}")
        if forbidden is not None:
            r = bulk_download(f"Bearer {client_token}", [forbidden["id"]])
            ok = r.status_code == 403
            record("05-cross-role-403", PASS if ok else FAIL,
                   f"status={r.status_code} body={r.text[:160]}")
            # Cleanup the test doc if we created it
            if forbidden.get("_cleanup"):
                try:
                    requests.delete(
                        f"{API}/documents/{forbidden['id']}",
                        headers={"Authorization": f"Bearer {admin_token}"},
                        timeout=20,
                    )
                except Exception:
                    pass
        else:
            record("05-cross-role-403", FAIL, "could not obtain a forbidden doc id")
    except Exception as e:
        record("05-cross-role-403", FAIL, repr(e))

    # ---------- 6. Cross-tenant 403 between admins ----------
    try:
        admin2_email = f"adm2-{uuid.uuid4().hex[:8]}@example.com"
        r0 = requests.post(f"{API}/auth/register", json={
            "email": admin2_email, "password": "Passw0rd!", "name": "Admin2", "role": "admin",
        }, timeout=20)
        if r0.status_code not in (200, 201):
            record("06-cross-tenant-admin", FAIL, f"register admin2 failed: {r0.status_code} {r0.text[:120]}")
        else:
            admin2_token = r0.json()["access_token"]
            # admin2 attempts to bulk-download admin1's doc
            r = bulk_download(f"Bearer {admin2_token}", [admin_docs[0]["id"]])
            ok = r.status_code == 403
            record("06-cross-tenant-admin", PASS if ok else FAIL,
                   f"status={r.status_code} body={r.text[:160]}")
    except Exception as e:
        record("06-cross-tenant-admin", FAIL, repr(e))

    # ---------- 7. No auth → 401 ----------
    try:
        r = bulk_download(None, [admin_docs[0]["id"]])
        ok = r.status_code == 401
        record("07-no-auth-401", PASS if ok else FAIL, f"status={r.status_code} body={r.text[:160]}")
    except Exception as e:
        record("07-no-auth-401", FAIL, repr(e))

    # ---------- 8. Bad token → 401 ----------
    try:
        r = bulk_download("Bearer foo", [admin_docs[0]["id"]])
        ok = r.status_code == 401
        record("08-bad-token-401", PASS if ok else FAIL, f"status={r.status_code} body={r.text[:160]}")
    except Exception as e:
        record("08-bad-token-401", FAIL, repr(e))

    # ---------- 9. Empty body → 400 ----------
    try:
        r = bulk_download(f"Bearer {admin_token}", [])
        ok = r.status_code == 400
        body = {}
        try:
            body = r.json()
        except Exception:
            pass
        ok_detail = body.get("detail") == "doc_ids required"
        record("09-empty-list-400", PASS if (ok and ok_detail) else FAIL,
               f"status={r.status_code} body={r.text[:200]}")
    except Exception as e:
        record("09-empty-list-400", FAIL, repr(e))

    # ---------- 10. Too many (>200) → 400 ----------
    try:
        many = [str(uuid.uuid4()) for _ in range(201)]
        r = bulk_download(f"Bearer {admin_token}", many)
        ok = r.status_code == 400
        body = {}
        try:
            body = r.json()
        except Exception:
            pass
        ok_detail = body.get("detail") == "Maximum 200 documents per bulk download"
        record("10-too-many-400", PASS if (ok and ok_detail) else FAIL,
               f"status={r.status_code} body={r.text[:200]}")
    except Exception as e:
        record("10-too-many-400", FAIL, repr(e))

    # ---------- 11. Partial missing → 404 ----------
    try:
        r = bulk_download(f"Bearer {admin_token}", [admin_docs[0]["id"], "non-existent-uuid"])
        ok = r.status_code == 404
        record("11-partial-missing-404", PASS if ok else FAIL,
               f"status={r.status_code} body={r.text[:200]}")
    except Exception as e:
        record("11-partial-missing-404", FAIL, repr(e))

    # ---------- 12. Duplicate display_name de-dup ----------
    # Find two admin docs with the same display_name
    try:
        from collections import Counter
        dn_counts = Counter(d.get("display_name") for d in admin_docs)
        dup_dn = next((dn for dn, c in dn_counts.items() if c >= 2), None)
        if dup_dn is None:
            # Create two synthetic uploads with the same filename to demo client
            pdf = b"%PDF-1.4\n%dup1\n%%EOF"
            pdf2 = b"%PDF-1.4\n%dup2 different bytes\n%%EOF"
            # Need an existing connection — admin already connected to demo client (per seed migration)
            up1 = requests.post(
                f"{API}/documents/upload",
                headers={"Authorization": f"Bearer {admin_token}"},
                data={"client_id": client_user["id"]},
                files={"file": ("dup-name-probe.pdf", pdf, "application/pdf")},
                timeout=30,
            )
            up2 = requests.post(
                f"{API}/documents/upload",
                headers={"Authorization": f"Bearer {admin_token}"},
                data={"client_id": client_user["id"]},
                files={"file": ("dup-name-probe.pdf", pdf2, "application/pdf")},
                timeout=30,
            )
            if up1.status_code == 200 and up2.status_code == 200:
                d1, d2 = up1.json(), up2.json()
                ids = [d1["id"], d2["id"]]
                r = bulk_download(f"Bearer {admin_token}", ids)
                ok_status = r.status_code == 200
                zf = zipfile.ZipFile(io.BytesIO(r.content))
                names = zf.namelist()
                base = "dup-name-probe"
                has_first = any(n == "dup-name-probe.pdf" for n in names)
                has_dup = any("(2)" in n and n.lower().endswith(".pdf") for n in names)
                # Verify both bytes preserved
                bytes_ok = (
                    zf.read("dup-name-probe.pdf") == pdf and
                    any(zf.read(n) == pdf2 for n in names if "(2)" in n)
                )
                overall = ok_status and has_first and has_dup and bytes_ok
                record("12-dedup-name", PASS if overall else FAIL,
                       f"status={r.status_code} names={names} has_first={has_first} has_dup={has_dup} bytes_ok={bytes_ok}")
                # Cleanup
                for did in ids:
                    try:
                        requests.delete(
                            f"{API}/documents/{did}",
                            headers={"Authorization": f"Bearer {admin_token}"},
                            timeout=20,
                        )
                    except Exception:
                        pass
            else:
                record("12-dedup-name", FAIL, f"upload failed: {up1.status_code} / {up2.status_code} :: {up1.text[:80]} | {up2.text[:80]}")
        else:
            ids = [d["id"] for d in admin_docs if d.get("display_name") == dup_dn][:2]
            r = bulk_download(f"Bearer {admin_token}", ids)
            ok_status = r.status_code == 200
            zf = zipfile.ZipFile(io.BytesIO(r.content))
            names = zf.namelist()
            has_dup = any("(2)" in n for n in names)
            record("12-dedup-name", PASS if (ok_status and has_dup) else FAIL,
                   f"status={r.status_code} names={names} has_dup={has_dup}")
    except Exception as e:
        record("12-dedup-name", FAIL, repr(e))

    # ---------- 13. ZIP integrity / sha256 of 3 docs ----------
    try:
        if len(admin_docs) >= 3:
            ids = [d["id"] for d in admin_docs[:3]]
        else:
            ids = [d["id"] for d in admin_docs[:2]]
        r = bulk_download(f"Bearer {admin_token}", ids)
        if r.status_code != 200:
            record("13-zip-integrity-sha256", FAIL, f"status={r.status_code}")
        else:
            zf = zipfile.ZipFile(io.BytesIO(r.content))
            all_match = True
            details = []
            for doc_id in ids:
                expected = get_doc_bytes(admin_token, doc_id)
                exp_sha = hashlib.sha256(expected).hexdigest()
                # Locate the entry whose bytes match (or by size)
                matched = None
                for nm in zf.namelist():
                    if zf.getinfo(nm).file_size == len(expected):
                        body = zf.read(nm)
                        if hashlib.sha256(body).hexdigest() == exp_sha:
                            matched = nm
                            break
                if matched is None:
                    all_match = False
                    details.append(f"{doc_id}: NO sha match (size={len(expected)})")
                else:
                    details.append(f"{doc_id}: ok ({matched})")
            record("13-zip-integrity-sha256", PASS if all_match else FAIL, "; ".join(details))
    except Exception as e:
        record("13-zip-integrity-sha256", FAIL, repr(e))

    # ---------- 14. Content-Length / Content-Disposition headers ----------
    try:
        ids = [d["id"] for d in admin_docs[:2]]
        r = bulk_download(f"Bearer {admin_token}", ids)
        cdisp = r.headers.get("Content-Disposition", "")
        clen = r.headers.get("Content-Length")
        ok_cd = cdisp.startswith('attachment; filename="docvault-bundle-')
        ok_cl = clen is not None and int(clen) == len(r.content)
        record("14-headers", PASS if (ok_cd and ok_cl) else FAIL,
               f"cd={cdisp!r} cl={clen} body_len={len(r.content)}")
    except Exception as e:
        record("14-headers", FAIL, repr(e))

    # ---------- summary ----------
    print("\n=== SUMMARY ===")
    n_pass = sum(1 for _, s, _ in results if s == PASS)
    n_fail = sum(1 for _, s, _ in results if s == FAIL)
    print(f"Total: {len(results)}  PASS: {n_pass}  FAIL: {n_fail}")
    for name, status, _ in results:
        print(f"  {status}  {name}")
    sys.exit(0 if n_fail == 0 else 1)


if __name__ == "__main__":
    main()
