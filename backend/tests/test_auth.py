"""Auth endpoint tests."""
import requests


def test_login_success(api_client, base_url):
    r = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "admin@example.com", "password": "admin123"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and isinstance(data["access_token"], str)
    assert data.get("token_type") == "bearer"
    assert data.get("user", {}).get("email") == "admin@example.com"
    assert data["user"].get("role") == "admin"


def test_login_wrong_password(api_client, base_url):
    r = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "admin@example.com", "password": "wrongpass"},
        timeout=30,
    )
    assert r.status_code == 401


def test_login_unknown_user(api_client, base_url):
    r = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "noone@example.com", "password": "x"},
        timeout=30,
    )
    assert r.status_code == 401


def test_me_with_token(api_client, base_url, auth_headers):
    r = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["email"] == "admin@example.com"
    assert body["role"] == "admin"
    assert "id" in body
    assert "password_hash" not in body


def test_me_without_token(api_client, base_url):
    r = api_client.get(f"{base_url}/api/auth/me", timeout=30)
    assert r.status_code == 401


def test_me_invalid_token(api_client, base_url):
    r = api_client.get(
        f"{base_url}/api/auth/me",
        headers={"Authorization": "Bearer invalid.token.value"},
        timeout=30,
    )
    assert r.status_code == 401
