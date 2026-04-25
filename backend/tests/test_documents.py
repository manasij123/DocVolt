"""Documents endpoints tests."""
import os
import io
import time
import pytest
import requests
from pathlib import Path

UPLOAD_DIR = Path("/app/backend/uploads")

# Minimal valid PDF bytes
PDF_BYTES = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\nxref\n0 3\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n98\n%%EOF\n"


def _upload(api_client, base_url, headers, filename, extra=None):
    files = {"file": (filename, io.BytesIO(PDF_BYTES), "application/pdf")}
    data = extra or {}
    r = api_client.post(
        f"{base_url}/api/documents/upload",
        headers=headers,
        files=files,
        data=data,
        timeout=30,
    )
    return r


# -------- Upload auth & validation --------

def test_upload_without_auth(api_client, base_url):
    files = {"file": ("test.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    r = api_client.post(f"{base_url}/api/documents/upload", files=files, timeout=30)
    assert r.status_code == 401


def test_upload_non_pdf_rejected(api_client, base_url, auth_headers):
    files = {"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")}
    r = api_client.post(
        f"{base_url}/api/documents/upload",
        headers=auth_headers,
        files=files,
        timeout=30,
    )
    assert r.status_code == 400


# -------- Auto-categorization --------

@pytest.fixture
def created_ids(api_client, base_url, auth_headers):
    ids = []
    yield ids
    # cleanup
    for i in ids:
        try:
            api_client.delete(f"{base_url}/api/documents/{i}", headers=auth_headers, timeout=15)
        except Exception:
            pass


def test_upload_monthly_return(api_client, base_url, auth_headers, created_ids):
    r = _upload(api_client, base_url, auth_headers, "monthly return Feb'2026.pdf")
    assert r.status_code == 200, r.text
    body = r.json()
    created_ids.append(body["id"])
    assert body["category"] == "MONTHLY_RETURN"
    assert body["year"] == 2026
    assert body["month"] == 2
    assert body["month_label"] == "Feb"


def test_upload_forwarding_letter(api_client, base_url, auth_headers, created_ids):
    r = _upload(api_client, base_url, auth_headers, "Feb'26MDM_UC_Forwarding-Letter.pdf")
    assert r.status_code == 200, r.text
    body = r.json()
    created_ids.append(body["id"])
    assert body["category"] == "FORWARDING_LETTER"
    assert body["year"] == 2026
    assert body["month"] == 2


def test_upload_ifa_report(api_client, base_url, auth_headers, created_ids):
    r = _upload(api_client, base_url, auth_headers, "Monthly _IFA Report Feb'26.pdf")
    assert r.status_code == 200, r.text
    body = r.json()
    created_ids.append(body["id"])
    assert body["category"] == "IFA_REPORT"
    assert body["year"] == 2026
    assert body["month"] == 2


def test_upload_random_falls_others(api_client, base_url, auth_headers, created_ids):
    r = _upload(api_client, base_url, auth_headers, "TEST_random_doc.pdf")
    assert r.status_code == 200, r.text
    body = r.json()
    created_ids.append(body["id"])
    assert body["category"] == "OTHERS"


def test_upload_category_override(api_client, base_url, auth_headers, created_ids):
    # filename hints monthly return, override to OTHERS
    r = _upload(
        api_client, base_url, auth_headers,
        "monthly return Mar'2025.pdf",
        extra={"category_override": "OTHERS", "year_override": "2025", "month_override": "3"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    created_ids.append(body["id"])
    assert body["category"] == "OTHERS"
    assert body["year"] == 2025
    assert body["month"] == 3


# -------- List & filters --------

def test_list_documents_no_auth(api_client, base_url):
    r = api_client.get(f"{base_url}/api/documents", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_list_filter_by_category(api_client, base_url, auth_headers, created_ids):
    r = _upload(api_client, base_url, auth_headers, "monthly return Jan'2026.pdf")
    assert r.status_code == 200
    created_ids.append(r.json()["id"])

    r2 = api_client.get(f"{base_url}/api/documents", params={"category": "MONTHLY_RETURN"}, timeout=30)
    assert r2.status_code == 200
    docs = r2.json()
    assert len(docs) >= 1
    assert all(d["category"] == "MONTHLY_RETURN" for d in docs)


def test_list_filter_by_year(api_client, base_url, auth_headers, created_ids):
    r = _upload(api_client, base_url, auth_headers, "monthly return Apr'2024.pdf")
    assert r.status_code == 200
    created_ids.append(r.json()["id"])

    r2 = api_client.get(f"{base_url}/api/documents", params={"year": 2024}, timeout=30)
    assert r2.status_code == 200
    docs = r2.json()
    assert len(docs) >= 1
    assert all(d["year"] == 2024 for d in docs)


def test_years_aggregation(api_client, base_url, auth_headers, created_ids):
    r = _upload(api_client, base_url, auth_headers, "monthly return May'2026.pdf")
    assert r.status_code == 200
    created_ids.append(r.json()["id"])

    r2 = api_client.get(f"{base_url}/api/documents/years", timeout=30)
    assert r2.status_code == 200
    out = r2.json()
    assert isinstance(out, list)
    assert len(out) >= 1
    item = out[0]
    assert "category" in item and "year" in item and "count" in item
    # at least one entry should have MONTHLY_RETURN/2026
    assert any(i["category"] == "MONTHLY_RETURN" and i["year"] == 2026 for i in out)


# -------- File streaming --------

def test_get_file_no_auth(api_client, base_url, auth_headers, created_ids):
    r = _upload(api_client, base_url, auth_headers, "TEST_stream Feb'2026.pdf")
    assert r.status_code == 200
    doc_id = r.json()["id"]
    created_ids.append(doc_id)

    r2 = api_client.get(f"{base_url}/api/documents/{doc_id}/file", timeout=30)
    assert r2.status_code == 200
    assert r2.headers.get("content-type", "").startswith("application/pdf")
    assert r2.content.startswith(b"%PDF")


def test_get_file_not_found(api_client, base_url):
    r = api_client.get(f"{base_url}/api/documents/does-not-exist/file", timeout=30)
    assert r.status_code == 404


# -------- Update --------

def test_update_metadata(api_client, base_url, auth_headers, created_ids):
    r = _upload(api_client, base_url, auth_headers, "TEST_edit Feb'2026.pdf")
    assert r.status_code == 200
    doc_id = r.json()["id"]
    created_ids.append(doc_id)

    r2 = api_client.put(
        f"{base_url}/api/documents/{doc_id}",
        headers=auth_headers,
        json={"display_name": "Renamed Doc", "category": "IFA_REPORT", "year": 2025, "month": 6},
        timeout=30,
    )
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["display_name"] == "Renamed Doc"
    assert body["category"] == "IFA_REPORT"
    assert body["year"] == 2025
    assert body["month"] == 6
    assert body["month_label"] == "Jun"

    # verify via list/filter persists
    r3 = api_client.get(f"{base_url}/api/documents", params={"year": 2025}, timeout=30)
    found = [d for d in r3.json() if d["id"] == doc_id]
    assert len(found) == 1
    assert found[0]["display_name"] == "Renamed Doc"


def test_update_without_auth(api_client, base_url, auth_headers, created_ids):
    r = _upload(api_client, base_url, auth_headers, "TEST_edit_noauth Feb'2026.pdf")
    assert r.status_code == 200
    doc_id = r.json()["id"]
    created_ids.append(doc_id)

    r2 = api_client.put(
        f"{base_url}/api/documents/{doc_id}",
        json={"display_name": "X"},
        timeout=30,
    )
    assert r2.status_code == 401


def test_update_invalid_category(api_client, base_url, auth_headers, created_ids):
    r = _upload(api_client, base_url, auth_headers, "TEST_invalid_cat.pdf")
    assert r.status_code == 200
    doc_id = r.json()["id"]
    created_ids.append(doc_id)

    r2 = api_client.put(
        f"{base_url}/api/documents/{doc_id}",
        headers=auth_headers,
        json={"category": "NOPE"},
        timeout=30,
    )
    assert r2.status_code == 400


# -------- Delete --------

def test_delete_without_auth(api_client, base_url, auth_headers):
    r = _upload(api_client, base_url, auth_headers, "TEST_del_noauth.pdf")
    assert r.status_code == 200
    doc_id = r.json()["id"]
    r2 = api_client.delete(f"{base_url}/api/documents/{doc_id}", timeout=30)
    assert r2.status_code == 401
    # cleanup
    api_client.delete(f"{base_url}/api/documents/{doc_id}", headers=auth_headers, timeout=15)


def test_delete_removes_file(api_client, base_url, auth_headers):
    r = _upload(api_client, base_url, auth_headers, "TEST_to_delete.pdf")
    assert r.status_code == 200
    doc_id = r.json()["id"]

    expected_path = UPLOAD_DIR / f"{doc_id}.pdf"
    # only assert file existence if test runs on same host; otherwise skip the FS check
    fs_check = expected_path.exists()

    r2 = api_client.delete(f"{base_url}/api/documents/{doc_id}", headers=auth_headers, timeout=30)
    assert r2.status_code == 200
    assert r2.json().get("ok") is True

    # GET file should now 404
    r3 = api_client.get(f"{base_url}/api/documents/{doc_id}/file", timeout=30)
    assert r3.status_code == 404

    if fs_check:
        # give FS a moment
        time.sleep(0.3)
        assert not expected_path.exists(), "PDF file was not removed from disk"


def test_delete_not_found(api_client, base_url, auth_headers):
    r = api_client.delete(
        f"{base_url}/api/documents/non-existent-id",
        headers=auth_headers,
        timeout=30,
    )
    assert r.status_code == 404


# -------- Admin seed verification --------

def test_admin_seed_exists(api_client, base_url):
    """Verify admin@example.com can authenticate, proving seed ran."""
    r = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "admin@example.com", "password": "admin123"},
        timeout=30,
    )
    assert r.status_code == 200
    user = r.json()["user"]
    assert user["email"] == "admin@example.com"
    assert user["role"] == "admin"
