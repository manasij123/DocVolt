"""Test atomic POST /api/categories with custom_icon_b64 (4 review-request cases)."""
import os, sys, json, requests

BASE = "https://doc-organizer-app.preview.emergentagent.com/api"
ADMIN = ("admin@example.com", "admin123")
CLIENT = ("client@example.com", "client123")

PNG_1x1_RED = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

def login(email, pw):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pw}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]

def excerpt(d, max_len=400):
    s = json.dumps(d) if isinstance(d, (dict, list)) else str(d)
    return s if len(s) <= max_len else s[:max_len] + "...(truncated)"

def main():
    failures = []
    print("=== ATOMIC POST /api/categories WITH custom_icon_b64 ===\n")
    admin_token, admin_user = login(*ADMIN)
    client_token, client_user = login(*CLIENT)
    H = {"Authorization": f"Bearer {admin_token}"}
    client_id = client_user["id"]
    print(f"admin_id={admin_user['id']} client_id={client_id}\n")

    # ---- TEST 1: Atomic create with AI icon ----
    print("[T1] POST /categories WITH custom_icon_b64 (atomic create)")
    body = {
        "client_id": client_id,
        "name": "AI Test Cat",
        "color": "#3B82F6",
        "icon": "folder",
        "keywords": [],
        "custom_icon_b64": PNG_1x1_RED,
    }
    r = requests.post(f"{BASE}/categories", json=body, headers=H, timeout=20)
    print(f"  status={r.status_code} body={excerpt(r.json() if r.ok else r.text)}")
    cat1_id = None
    if r.status_code == 200:
        j = r.json()
        cat1_id = j.get("id")
        if j.get("custom_icon_b64") == PNG_1x1_RED:
            print("  ✅ Response custom_icon_b64 matches sent value")
        else:
            failures.append(f"T1: custom_icon_b64 mismatch. got={excerpt(j.get('custom_icon_b64'),80)}")
            print(f"  ❌ custom_icon_b64 mismatch")
        if j.get("name") == "AI Test Cat" and j.get("color") == "#3B82F6":
            print("  ✅ Other fields persisted")
    else:
        failures.append(f"T1: POST returned {r.status_code} {r.text[:200]}")

    # GET /categories?client_id and verify
    if cat1_id:
        gr = requests.get(f"{BASE}/categories", params={"client_id": client_id}, headers=H, timeout=15)
        if gr.status_code == 200:
            cats = gr.json()
            row = next((c for c in cats if c["id"] == cat1_id), None)
            if row and row.get("custom_icon_b64") == PNG_1x1_RED:
                print("  ✅ GET /categories shows row with same custom_icon_b64")
            else:
                failures.append(f"T1: GET row missing/mismatch custom_icon_b64. row={excerpt(row,200)}")
                print(f"  ❌ GET row issue: {excerpt(row,200)}")
        else:
            failures.append(f"T1: GET /categories failed status={gr.status_code}")

    # ---- TEST 2: Backward compat (no custom_icon_b64) ----
    print("\n[T2] POST /categories WITHOUT custom_icon_b64 (backward compat)")
    body2 = {
        "client_id": client_id,
        "name": "Plain Cat",
        "color": "#10B981",
        "icon": "cash",
        "keywords": ["bill"],
    }
    r = requests.post(f"{BASE}/categories", json=body2, headers=H, timeout=20)
    print(f"  status={r.status_code} body={excerpt(r.json() if r.ok else r.text)}")
    cat2_id = None
    if r.status_code == 200:
        j = r.json()
        cat2_id = j.get("id")
        ci = j.get("custom_icon_b64")
        if ci is None:
            print("  ✅ custom_icon_b64 is null/None")
        else:
            failures.append(f"T2: expected null custom_icon_b64, got {excerpt(ci, 80)}")
            print(f"  ❌ expected null, got {excerpt(ci, 80)}")
        if j.get("name") == "Plain Cat" and j.get("color") == "#10B981" and j.get("keywords") == ["bill"]:
            print("  ✅ Other fields correct (name, color, keywords)")
    else:
        failures.append(f"T2: POST returned {r.status_code} {r.text[:200]}")

    # ---- TEST 3: PUT still works ----
    print("\n[T3] PUT /categories/<cat2_id> set custom_icon_b64")
    if cat2_id:
        r = requests.put(f"{BASE}/categories/{cat2_id}", json={"custom_icon_b64": PNG_1x1_RED}, headers=H, timeout=15)
        print(f"  status={r.status_code} body={excerpt(r.json() if r.ok else r.text)}")
        if r.status_code == 200:
            j = r.json()
            if j.get("custom_icon_b64") == PNG_1x1_RED:
                print("  ✅ PUT response custom_icon_b64 matches")
            else:
                failures.append(f"T3: PUT response mismatch")
            # GET verify
            gr = requests.get(f"{BASE}/categories", params={"client_id": client_id}, headers=H, timeout=15)
            if gr.status_code == 200:
                row = next((c for c in gr.json() if c["id"] == cat2_id), None)
                if row and row.get("custom_icon_b64") == PNG_1x1_RED:
                    print("  ✅ GET shows updated icon")
                else:
                    failures.append(f"T3: GET after PUT - icon not updated. row={excerpt(row,200)}")
        else:
            failures.append(f"T3: PUT returned {r.status_code}")
    else:
        failures.append("T3: skipped (no cat2_id)")

    # ---- TEST 4: Clear via PUT empty string ----
    print("\n[T4] PUT /categories/<cat1_id> clear via custom_icon_b64=\"\"")
    if cat1_id:
        r = requests.put(f"{BASE}/categories/{cat1_id}", json={"custom_icon_b64": ""}, headers=H, timeout=15)
        print(f"  status={r.status_code} body={excerpt(r.json() if r.ok else r.text)}")
        if r.status_code == 200:
            j = r.json()
            if j.get("custom_icon_b64") in (None, ""):
                # Check it's actually cleared (None)
                if j.get("custom_icon_b64") is None:
                    print("  ✅ custom_icon_b64 cleared to None")
                else:
                    print(f"  ⚠️ custom_icon_b64 is empty string, not None: {repr(j.get('custom_icon_b64'))}")
            else:
                failures.append(f"T4: expected null, got {excerpt(j.get('custom_icon_b64'),80)}")
            # GET verify
            gr = requests.get(f"{BASE}/categories", params={"client_id": client_id}, headers=H, timeout=15)
            if gr.status_code == 200:
                row = next((c for c in gr.json() if c["id"] == cat1_id), None)
                if row and row.get("custom_icon_b64") is None:
                    print("  ✅ GET confirms custom_icon_b64 is null")
                elif row:
                    failures.append(f"T4: GET row custom_icon_b64 not null: {repr(row.get('custom_icon_b64'))[:80]}")
        else:
            failures.append(f"T4: PUT returned {r.status_code}")
    else:
        failures.append("T4: skipped (no cat1_id)")

    # ---- CLEANUP ----
    print("\n=== CLEANUP ===")
    for cid, label in [(cat1_id, "AI Test Cat"), (cat2_id, "Plain Cat")]:
        if cid:
            r = requests.delete(f"{BASE}/categories/{cid}", headers=H, timeout=15)
            print(f"  DELETE {label} ({cid}) -> {r.status_code}")

    print("\n=== RESULT ===")
    if failures:
        print(f"❌ {len(failures)} FAILURE(S):")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)
    else:
        print("✅ ALL 4 TESTS PASSED")
        sys.exit(0)

if __name__ == "__main__":
    main()
