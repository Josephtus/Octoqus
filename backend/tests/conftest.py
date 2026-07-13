import os
import pytest

# Environment variables must be set BEFORE importing the app
os.environ.setdefault("DATABASE_URL", "mysql+aiomysql://test:test@localhost:3306/test_db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET_KEY", "test_secret_key_123")
os.environ["SANIC_DEBUG"] = "true"

from src.main import app as octoqus_app

@pytest.fixture
def app():
    # Testler için app instance'ını döndürür
    return octoqus_app

@pytest.fixture
def test_cli(loop, app, sanic_client):
    # Sanic test client'ı oluşturur
    return loop.run_until_complete(sanic_client(app))
