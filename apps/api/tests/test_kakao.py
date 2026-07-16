"""카카오 로그인 계약 테스트 (Story 1.3) — 카카오 API는 respx로 모킹."""

import httpx
import pytest
import respx

TOKEN_URL = "https://kauth.kakao.com/oauth/token"
ME_URL = "https://kapi.kakao.com/v2/user/me"
REQ = {"code": "auth-code", "redirect_uri": "http://localhost:3000/auth/kakao/callback"}


def mock_kakao(router, kakao_id=12345, nickname="카카오테스터", email=None, verified=True, valid=True):
    router.post(TOKEN_URL).mock(return_value=httpx.Response(200, json={"access_token": "kakao-at"}))
    account = {"profile": {"nickname": nickname}}
    if email is not None:
        account |= {"email": email, "is_email_verified": verified, "is_email_valid": valid}
    router.get(ME_URL).mock(return_value=httpx.Response(200, json={"id": kakao_id, "kakao_account": account}))


@pytest.mark.asyncio
@respx.mock
async def test_kakao_new_account_and_relogin(client, clean_auth_tables):
    mock_kakao(respx.mock)
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    assert res.status_code == 200
    access = res.json()["access_token"]

    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert me.json()["name"] == "카카오테스터" and me.json()["email"] is None
    first_id = me.json()["id"]

    # 재로그인 — 같은 계정 (AC 2)
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    me2 = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me2.json()["id"] == first_id


@pytest.mark.asyncio
@respx.mock
async def test_kakao_verified_email_stored(client, clean_auth_tables):
    mock_kakao(respx.mock, email="Kakao@Example.com", verified=True, valid=True)
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me.json()["email"] == "kakao@example.com"  # 정규화 저장


@pytest.mark.asyncio
@respx.mock
async def test_kakao_unverified_email_null(client, clean_auth_tables):
    mock_kakao(respx.mock, email="kakao@example.com", verified=False)
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me.json()["email"] is None


@pytest.mark.asyncio
@respx.mock
async def test_kakao_email_conflict_409(client, clean_auth_tables):
    await client.post("/api/v1/auth/signup", json={"email": "dup@example.com", "password": "password123", "name": "이메일러"})
    mock_kakao(respx.mock, email="dup@example.com")
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    assert res.status_code == 409
    assert res.json()["code"] == "email_conflict"


@pytest.mark.asyncio
@respx.mock
async def test_kakao_nickname_fallback(client, clean_auth_tables):
    respx.mock.post(TOKEN_URL).mock(return_value=httpx.Response(200, json={"access_token": "kakao-at"}))
    respx.mock.get(ME_URL).mock(return_value=httpx.Response(200, json={"id": 999, "kakao_account": {}}))
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me.json()["name"] == "카카오 사용자"


@pytest.mark.asyncio
@respx.mock
async def test_kakao_invalid_code_401(client, clean_auth_tables):
    respx.mock.post(TOKEN_URL).mock(return_value=httpx.Response(400, json={"error_code": "KOE320"}))
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_kakao_code"


@pytest.mark.asyncio
@respx.mock
async def test_kakao_timeout_502(client, clean_auth_tables):
    respx.mock.post(TOKEN_URL).mock(side_effect=httpx.ConnectTimeout("timeout"))
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    assert res.status_code == 502
    assert res.json()["code"] == "kakao_unavailable"


@pytest.mark.asyncio
@respx.mock
async def test_kakao_redirect_uri_not_allowlisted_401(client, clean_auth_tables):
    res = await client.post("/api/v1/auth/kakao", json={"code": "auth-code", "redirect_uri": "https://evil.example.com/cb"})
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_kakao_code"


@pytest.mark.asyncio
@respx.mock
async def test_kakao_token_request_includes_required_params(client, clean_auth_tables):
    captured = {}

    def capture(request):
        captured.update(dict(httpx.QueryParams(request.content.decode())))
        return httpx.Response(200, json={"access_token": "kakao-at"})

    respx.mock.post(TOKEN_URL).mock(side_effect=capture)
    respx.mock.get(ME_URL).mock(return_value=httpx.Response(200, json={"id": 777, "kakao_account": {}}))
    await client.post("/api/v1/auth/kakao", json=REQ)
    assert captured["grant_type"] == "authorization_code"
    assert captured["code"] == "auth-code"
    assert captured["redirect_uri"] == REQ["redirect_uri"]
    assert captured["client_id"] and captured["client_secret"]


@pytest.mark.asyncio
@respx.mock
async def test_kakao_me_5xx_502(client, clean_auth_tables):
    respx.mock.post(TOKEN_URL).mock(return_value=httpx.Response(200, json={"access_token": "kakao-at"}))
    respx.mock.get(ME_URL).mock(return_value=httpx.Response(500))
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    assert res.status_code == 502


@pytest.mark.asyncio
@respx.mock
async def test_kakao_non_json_body_502(client, clean_auth_tables):
    respx.mock.post(TOKEN_URL).mock(return_value=httpx.Response(200, text="<html>proxy error</html>"))
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    assert res.status_code == 502


@pytest.mark.asyncio
@respx.mock
async def test_kakao_email_valid_false_null(client, clean_auth_tables):
    mock_kakao(respx.mock, email="v@example.com", verified=True, valid=False)
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me.json()["email"] is None


@pytest.mark.asyncio
@respx.mock
async def test_kakao_weird_identity_shapes(client, clean_auth_tables):
    # id=0 → 401, 100자 초과 닉네임 → 잘려서 저장
    respx.mock.post(TOKEN_URL).mock(return_value=httpx.Response(200, json={"access_token": "at"}))
    respx.mock.get(ME_URL).mock(return_value=httpx.Response(200, json={"id": 0}))
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    assert res.status_code == 401

    long_name = "가" * 150
    respx.mock.get(ME_URL).mock(
        return_value=httpx.Response(200, json={"id": 555, "kakao_account": {"profile": {"nickname": long_name}}})
    )
    res = await client.post("/api/v1/auth/kakao", json=REQ)
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert len(me.json()["name"]) == 100
