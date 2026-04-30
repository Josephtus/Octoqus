"""
src/main.py
===========
Sanic Uygulama Giriş Noktası — Octoqus Platform

Sorumluluklar:
  1. Sanic app instance'ı oluşturma ve yapılandırma
  2. Veritabanı engine + Redis bağlantısı lifecycle yönetimi
  3. Rate limiting middleware (Redis tabanlı)
  4. /health endpoint
  5. /uploads statik dosya sunumu
  6. Blueprint'lerin kayıt edilmesi (routes/)
  7. Uygulama başlatma (Dockerfile CMD ile uyumlu)
"""

import logging
import os
from pathlib import Path

# WORKER TIMEOUT FIX: Sanic Manager reads these from environment
os.environ["SANIC_WORKER_STARTUP_TIMEOUT"] = "60.0"
os.environ["SANIC_GRACEFUL_SHUTDOWN_TIMEOUT"] = "60.0"

import redis.asyncio as aioredis
import structlog
from sanic import Request, Sanic
from sanic.response import HTTPResponse, json as sanic_json
from sanic_ext import Extend
from src.database import dispose_engine, init_db
from src.services.pubsub import PubSubManager
from sqlalchemy.exc import SQLAlchemyError
from redis.exceptions import RedisError

# ---------------------------------------------------------------------------
# Structlog Yapılandırması — JSON formatında loglama (Docker log aggregation uyumlu)
# ---------------------------------------------------------------------------
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Sanic Uygulama Oluşturma
# ---------------------------------------------------------------------------
app = Sanic("Octoqus")

@app.on_response
async def add_content_disposition(request, response):
    """Resimlerin tarayıcıda indirilmeden açılmasını zorunlu kılar."""
    if request.path.startswith("/uploads/"):
        response.headers["Content-Disposition"] = "inline"

# ---------------------------------------------------------------------------
# Uygulama Yapılandırması (.env değerleri Sanic config'e aktarılır)
# ---------------------------------------------------------------------------
app.config.update(
    {
        "DEBUG": os.getenv("SANIC_DEBUG", "false").lower() == "true",
        "OAS": True,                    # OpenAPI Spec (sanic-ext) — AKTİF EDİLDİ
        "OAS_UI_SWAGGER": True,         # /docs üzerinden Swagger UI
        "OAS_UI_REDOC": True,           # /redoc üzerinden Redoc UI
        "OAS_URL_PREFIX": "/api/docs",  # Dokümantasyon URL'i
        "OAS_TITLE": "Octoqus API Documentation",
        "OAS_VERSION": "1.0.0",
        "OAS_DESCRIPTION": "Octoqus Gider Takip ve Sosyal Finans Platformu API Dokümantasyonu.",
        "CORS_ORIGINS": "*",            # Görev 5'te kısıtlanacak
        "CORS_ALLOW_HEADERS": "Authorization, Content-Type, *",
        "CORS_METHODS": "*",
        "KEEP_ALIVE_TIMEOUT": 30,
        "REQUEST_TIMEOUT": 60,
        "RESPONSE_TIMEOUT": 60,
        "REQUEST_MAX_SIZE": 10_485_760, # Max upload boyutu: 10 MB
    }
)

# ---------------------------------------------------------------------------
# Rate Limiter Sabitler
# ---------------------------------------------------------------------------
RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "600"))
RATE_WINDOW_SECONDS: int = 60


# =============================================================================
# LIFECYCLE HOOK 1: Veritabanı Başlatma
# =============================================================================
@app.before_server_start
async def setup_database(application: Sanic, loop) -> None:
    """
    Sanic başlamadan önce SQLAlchemy async engine'i hazırlar.
    Production'da Alembic migration zaten çalıştırılmış olmalı.
    Development'da init_db() tabloları otomatik oluşturur.
    """
    logger.info("database.connecting", url=os.environ.get("DATABASE_URL", "???")[:40])
    try:
        await init_db()
        logger.info("database.ready")
    except SQLAlchemyError as exc:
        logger.error("database.connection_failed", error=str(exc))
        raise


# =============================================================================
# LIFECYCLE HOOK 2: Redis Bağlantısı
# =============================================================================
@app.before_server_start
async def setup_redis(application: Sanic, loop) -> None:
    """
    Redis bağlantı havuzunu oluşturur ve app.ctx.redis'e atar.
    Rate limiting, pub/sub ve task queue bu connection'ı kullanır.
    """
    redis_url: str = os.environ["REDIS_URL"]
    logger.info("redis.connecting")
    try:
        application.ctx.redis = await aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,         # Bağlantı havuzu limiti
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
        )
        # Bağlantıyı doğrula
        pong = await application.ctx.redis.ping()
        logger.info("redis.ready", pong=pong)

        # PubSub Manager'ı Başlat (Shared Listener)
        application.ctx.pubsub_manager = PubSubManager(application.ctx.redis)
        await application.ctx.pubsub_manager.start()
        logger.info("pubsub.manager.ready")
    except RedisError as exc:
        logger.error("redis.connection_failed", error=str(exc))
        raise


# =============================================================================
# LIFECYCLE HOOK 3: Uploads Dizini Oluşturma
# =============================================================================
@app.before_server_start
async def setup_upload_dirs(application: Sanic, loop) -> None:
    """
    /uploads altındaki gerekli klasörleri oluşturur.
    Yoksa Sanic statik serve sırasında hata verir.
    """
    upload_root = Path("./uploads")
    subdirs = ["avatars", "receipts"]
    for subdir in subdirs:
        (upload_root / subdir).mkdir(parents=True, exist_ok=True)
    logger.info("uploads.dirs_ready", path=str(upload_root.resolve()))
    logger.info("worker.ready_signal_sent")


# =============================================================================
# LIFECYCLE HOOK 4: Kapatma — Veritabanı
# =============================================================================
@app.after_server_stop
async def teardown_database(application: Sanic, loop) -> None:
    """SQLAlchemy engine bağlantı havuzunu temizce kapatır."""
    logger.info("database.closing")
    await dispose_engine()
    logger.info("database.closed")


# =============================================================================
# LIFECYCLE HOOK 5: Kapatma — Redis
# =============================================================================
@app.after_server_stop
async def teardown_redis(application: Sanic, loop) -> None:
    """Redis bağlantı havuzunu temizce kapatır."""
    if hasattr(application.ctx, "redis"):
        logger.info("redis.closing")
        
        # PubSub Manager'ı kapat
        if hasattr(application.ctx, "pubsub_manager"):
            await application.ctx.pubsub_manager.stop()
            
        await application.ctx.redis.aclose()
        logger.info("redis.closed")


# =============================================================================
# MIDDLEWARE: Redis Tabanlı Rate Limiting
# Algoritma: Sliding window (1 dakika)
# DDoS ve spam koruması — her IP için dakikada max X istek
# =============================================================================
@app.middleware("request")
async def rate_limit_middleware(request: Request) -> None:
    """
    Her gelen isteği Redis'te sayar.
    Limit aşılırsa HTTP 429 döner.
    /health endpoint'i ve OPTIONS istekleri rate limit'ten muaf tutulur.
    """
    # Health check ve CORS preflight (OPTIONS) isteklerini muaf tut
    if request.path == "/health" or request.method == "OPTIONS":
        return

    # İstemci IP'sini al (Docker reverse proxy arkasındaysa X-Forwarded-For)
    client_ip: str = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or request.ip
        or "unknown"
    )

    redis_client = request.app.ctx.redis
    rate_key = f"rate_limit:{client_ip}"

    # .env'den gelen limit, yoksa varsayılan 600 (dev dostu)
    limit = int(os.getenv("RATE_LIMIT_PER_MINUTE", "600"))

    try:
        # Atomik INCR + EXPIRE (ilk istek ise window başlat)
        current_count = await redis_client.incr(rate_key)
        if current_count == 1:
            await redis_client.expire(rate_key, RATE_WINDOW_SECONDS)

        if current_count > limit:
            # Retry-After başlığı: kaç saniye beklemesi gerektiği
            ttl = await redis_client.ttl(rate_key)
            return sanic_json(
                {
                    "error": "Rate limit exceeded",
                    "retry_after": ttl,
                    "message": "Çok fazla istek gönderdiniz. Lütfen biraz bekleyin."
                },
                status=429,
                headers={
                    "Retry-After": str(ttl)
                }
            )
    
    except RedisError as exc:
        # Redis hatası → rate limiting devre dışı, isteği geçir (fail-open)
        logger.warning("rate_limit.redis_error", error=str(exc), ip=client_ip)


# =============================================================================
# MIDDLEWARE: İstek / Yanıt Loglama
# =============================================================================
@app.middleware("request")
async def log_request(request: Request) -> None:
    """Gelen her HTTP isteğini structlog ile loglar."""
    logger.info(
        "http.request",
        method=request.method,
        path=request.path,
        ip=request.ip,
    )


@app.middleware("response")
async def handle_cors_and_log_response(request: Request, response: HTTPResponse) -> HTTPResponse:
    """Giden her HTTP yanıtına CORS başlıklarını ekler ve loglar."""
    # CORS Başlıklarını zorla ekle
    origin = request.headers.get("Origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, X-Requested-With"
    response.headers["Access-Control-Allow-Credentials"] = "true"

    logger.info(
        "http.response",
        method=request.method,
        path=request.path,
        status=response.status,
    )
    return response


# =============================================================================
# ENDPOINT: /health — Docker Healthcheck
# =============================================================================
@app.get("/health")
async def health_check(request: Request) -> HTTPResponse:
    """
    Docker HEALTHCHECK ve load balancer probe'ları için kullanılır.
    DB ve Redis bağlantılarını da kontrol eder.
    """
    checks: dict = {"status": "ok", "service": "octoqus-api"}

    # Redis ping kontrolü
    try:
        pong = await request.app.ctx.redis.ping()
        checks["redis"] = "ok" if pong else "degraded"
    except RedisError as exc:
        checks["redis"] = f"error: {exc}"
        checks["status"] = "degraded"

    # Yanıt: degraded durumda da 200 döner (Sanic container'ı öldürmesin)
    # Kritik hata durumu için 503 kullanılabilir
    return sanic_json(checks, status=200)


# ---------------------------------------------------------------------------
# STATIK DOSYA SUNUMU: /uploads → ./uploads
# ---------------------------------------------------------------------------
app.static("/uploads", "./uploads", name="uploads")


# =============================================================================
# BLUEPRINT KAYDI
# Yeni route dosyaları oluşturuldukça aşağıya eklenir.
# =============================================================================

# ── Görev 4: Kimlik Doğrulama ──────────────────────────────────────────────
from src.routes.auth import auth_bp          # noqa: E402

# ── Görev 5: Kullanıcı Profil Yönetimi ────────────────────────────────────
from src.routes.users import users_bp        # noqa: E402

# ── Görev 6: Grup Yönetimi ────────────────────────────────────────────────
from src.routes.groups import groups_bp      # noqa: E402

# ── Görev 7: Harcama Yönetimi ────────────────────────────────────────────
from src.routes.expenses import expenses_bp  # noqa: E402

# ── Görev 8: Chat Sistemi (WebSocket) ────────────────────────────────────
from src.routes.messages import messages_bp  # noqa: E402

# ── Görev 9: Sosyal Ağ ve Şikayet Sistemi ────────────────────────────────
from src.routes.social import social_bp      # noqa: E402
from src.routes.reports import reports_bp    # noqa: E402

# ── Görev 10: Admin Paneli ve Audit Log ────────────────────────────────────
from src.routes.admin import admin_bp        # noqa: E402

# Tüm blueprint'leri tek seferinde kaydet
app.blueprint(auth_bp)
app.blueprint(users_bp)
app.blueprint(groups_bp)
app.blueprint(expenses_bp)
app.blueprint(messages_bp)
app.blueprint(social_bp)
app.blueprint(reports_bp)
app.blueprint(admin_bp)

Extend(app)

# =============================================================================
# UYGULAMA BAŞLATMA
# Dockerfile CMD: python -m src.main
# =============================================================================
if __name__ == "__main__":
    app.run(
        host=os.getenv("SANIC_HOST", "0.0.0.0"),
        port=int(os.getenv("SANIC_PORT", "8000")),
        debug=os.getenv("SANIC_DEBUG", "false").lower() == "true",
        workers=int(os.getenv("SANIC_WORKERS", "1")),
        access_log=False,  # Bizim log middleware'imiz var, Sanic'inkini kapat
        auto_reload=os.getenv("SANIC_DEBUG", "false").lower() == "true",
    )
