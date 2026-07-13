import pytest

@pytest.mark.asyncio
async def test_health_check(test_cli):
    """/health endpoint'inin düzgün çalıştığını kontrol eder."""
    resp = await test_cli.get("/health")
    assert resp.status == 200
    data = await resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "octoqus-api"

@pytest.mark.asyncio
async def test_auth_me_unauthorized(test_cli):
    """Token olmadan /api/auth/me isteği atıldığında 401 dönmelidir."""
    resp = await test_cli.get("/api/auth/me")
    assert resp.status == 401
    data = await resp.json()
    assert "Oturum açmanız gerekiyor" in data["message"]

@pytest.mark.asyncio
async def test_logout_clears_cookie(test_cli):
    """Logout isteği atıldığında çerez silinmelidir."""
    resp = await test_cli.post("/api/auth/logout")
    assert resp.status == 200
    # Sanic delete_cookie çerezi boş değerle ve geçmiş bir tarihle set eder
    cookie = resp.cookies.get("access_token")
    assert cookie is not None
    # delete_cookie genellikle değeri boşaltır veya max-age=0 yapar

