"""이메일 가입·로그인·refresh 회전·로그아웃 계약 테스트 (Story 1.2)."""

import pytest

SIGNUP = {"email": "Test@Example.com", "password": "password123", "name": "테스터", "phone": "01012345678"}


@pytest.mark.asyncio
async def test_signup_issues_tokens_and_normalizes_email(client, clean_auth_tables):
    res = await client.post("/api/v1/auth/signup", json=SIGNUP)
    assert res.status_code == 201
    body = res.json()
    assert body["access_token"] and body["refresh_token"] and body["token_type"] == "bearer"

    # 대문자 이메일로도 로그인 가능 (lowercase 정규화)
    res = await client.post("/api/v1/auth/login", json={"email": "test@example.com", "password": "password123"})
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_signup_duplicate_email_409(client, clean_auth_tables):
    await client.post("/api/v1/auth/signup", json=SIGNUP)
    res = await client.post("/api/v1/auth/signup", json=SIGNUP)
    assert res.status_code == 409
    assert res.json()["code"] == "email_already_exists"


@pytest.mark.asyncio
async def test_signup_short_password_422(client):
    res = await client.post("/api/v1/auth/signup", json={**SIGNUP, "password": "short"})
    assert res.status_code == 422
    assert res.json()["code"] == "validation_error"


@pytest.mark.asyncio
async def test_login_wrong_password_401(client, clean_auth_tables):
    await client.post("/api/v1/auth/signup", json=SIGNUP)
    res = await client.post("/api/v1/auth/login", json={"email": SIGNUP["email"], "password": "wrong-password"})
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_credentials"

    # 존재하지 않는 이메일도 같은 code (계정 존재 비노출)
    res = await client.post("/api/v1/auth/login", json={"email": "no@one.com", "password": "wrong-password"})
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_credentials"


@pytest.mark.asyncio
async def test_refresh_rotation(client, clean_auth_tables):
    signup = await client.post("/api/v1/auth/signup", json=SIGNUP)
    old_refresh = signup.json()["refresh_token"]

    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert res.status_code == 200
    new_refresh = res.json()["refresh_token"]
    assert new_refresh != old_refresh

    # 회전된(폐기된) 이전 토큰 재사용 → 401
    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_token"


@pytest.mark.asyncio
async def test_logout_revokes_refresh(client, clean_auth_tables):
    signup = await client.post("/api/v1/auth/signup", json=SIGNUP)
    refresh = signup.json()["refresh_token"]

    res = await client.post("/api/v1/auth/logout", json={"refresh_token": refresh})
    assert res.status_code == 204

    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth(client, clean_auth_tables):
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert res.json()["code"] == "unauthorized"

    signup = await client.post("/api/v1/auth/signup", json=SIGNUP)
    access = signup.json()["access_token"]
    res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "test@example.com" and body["name"] == "테스터"
