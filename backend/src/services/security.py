"""
src/services/security.py
========================
Güvenlik Hizmetleri — Şifre Hashleme, JWT ve Erişim Kontrol Decorator'ları

Bu modül şunları sağlar:
  - Bcrypt ile şifre hashleme / doğrulama
  - PyJWT ile Access Token üretme / decode etme
  - Sanic route'larını koruyan @protected decorator
  - Rol tabanlı erişim kontrolü için @role_required decorator
"""

import os
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any, Callable, Sequence

import bcrypt
import jwt
import structlog
from sanic import Request
from sanic.exceptions import Forbidden, Unauthorized

from sanic.response import json as sanic_json
from redis.exceptions import RedisError

logger = structlog.get_logger(__name__)

# =============================================================================
# BÖLÜM 0: @rate_limit — Özel Rate Limit Decorator'ı
# =============================================================================

def rate_limit(limit: int, window: int = 60, key_prefix: str = "rate_limit_route"):
    """
    Belirli bir route için IP bazlı rate limiting uygular.
    
    Args:
        limit: Pencere içindeki maksimum istek sayısı
        window: Saniye cinsinden zaman penceresi (default: 60)
        key_prefix: Redis anahtarı için ön ek
    """
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        async def wrapper(request: Request, *args: Any, **kwargs: Any) -> Any:
            client_ip: str = (
                request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
                or request.ip
                or "unknown"
            )
            
            redis = request.app.ctx.redis
            # Endpoint path'ini de anahtara ekle ki farklı uçlar birbirini etkilemesin
            key = f"{key_prefix}:{request.path}:{client_ip}"
            
            try:
                current = await redis.incr(key)
                if current == 1:
                    await redis.expire(key, window)
                
                if current > limit:
                    ttl = await redis.ttl(key)
                    logger.warning("security.rate_limit_exceeded", ip=client_ip, path=request.path, limit=limit)
                    return sanic_json(
                        {
                            "error": "Rate limit exceeded",
                            "message": f"Bu işlem için limit aşıldı. Lütfen {ttl} saniye sonra tekrar deneyin.",
                            "retry_after": ttl
                        },
                        status=429,
                        headers={"Retry-After": str(ttl)}
                    )
            except RedisError as exc:
                # Redis hatası durumunda işlemi engelleme (fail-open)
                logger.error("security.rate_limit.redis_error", error=str(exc))
            
            return await f(request, *args, **kwargs)
        return wrapper
    return decorator

# ---------------------------------------------------------------------------
# Ortam Değişkenleri (runtime'da okunur — import sırasında crash olmaması için)
# ---------------------------------------------------------------------------

def _get_secret() -> str:
    secret = os.environ.get("JWT_SECRET_KEY", "")
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY environment variable is not set!")
    return secret


def _get_algorithm() -> str:
    return os.getenv("JWT_ALGORITHM", "HS256")


def _get_access_token_expire_minutes() -> int:
    # Varsayılan: 24 saat (1440 dakika)
    return int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))


def _get_bcrypt_rounds() -> int:
    return int(os.getenv("BCRYPT_ROUNDS", "12"))


# =============================================================================
# BÖLÜM 1: Şifre Hashleme & Doğrulama (Bcrypt)
# =============================================================================

def hash_password(plain_text: str) -> str:
    """
    Düz metin şifreyi bcrypt ile hashler.

    Args:
        plain_text: Kullanıcının girdiği ham şifre

    Returns:
        UTF-8 kodlanmış bcrypt hash string
    """
    if not plain_text:
        raise ValueError("Şifre boş olamaz.")

    rounds = _get_bcrypt_rounds()
    salt = bcrypt.gensalt(rounds=rounds)
    hashed = bcrypt.hashpw(plain_text.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_text: str, hashed: str) -> bool:
    """
    Düz metin şifreyi bcrypt hash ile karşılaştırır.

    Args:
        plain_text: Kullanıcının giriş sırasında girdiği şifre
        hashed: Veritabanından okunan bcrypt hash

    Returns:
        True → şifre doğru, False → yanlış
    """
    try:
        return bcrypt.checkpw(
            plain_text.encode("utf-8"),
            hashed.encode("utf-8"),
        )
    except Exception as exc:
        logger.warning("password.verify_error", error=str(exc))
        return False


# =============================================================================
# BÖLÜM 2: JWT Token Üretme & Decode Etme
# =============================================================================

def create_access_token(user_id: int, role: str) -> str:
    """
    Kullanıcı kimliği ve rolünü içeren imzalı JWT Access Token üretir.

    Payload alanları:
      - sub  : Kullanıcı ID'si (string — JWT standardı)
      - role : Kullanıcının global rolü (user / group_leader / admin)
      - iat  : Token üretim zamanı (issued-at)
      - exp  : Token sona erme zamanı

    Args:
        user_id: Veritabanındaki kullanıcı birincil anahtarı
        role   : GlobalRole enum değeri (.value olarak geçilmeli)

    Returns:
        İmzalı JWT string
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=_get_access_token_expire_minutes())

    payload: dict[str, Any] = {
        "sub": str(user_id),      # Subject — JWT RFC'ye göre string olmalı
        "role": role,
        "iat": now,
        "exp": expire,
    }

    token = jwt.encode(
        payload,
        _get_secret(),
        algorithm=_get_algorithm(),
    )

    logger.info("jwt.created", user_id=user_id, role=role, expires_at=expire.isoformat())
    return token


def decode_access_token(token: str) -> dict[str, Any]:
    """
    JWT token'ı doğrular ve payload'ı döner.

    Hata Durumları:
      - Süresi dolmuşsa     → HTTP 401 (Unauthorized) fırlatır
      - Geçersiz imzaysa    → HTTP 401 (Unauthorized) fırlatır
      - Başka bir hata varsa → HTTP 401 (Unauthorized) fırlatır

    Args:
        token: 'Bearer <token>' formatından ayrıştırılmış raw token

    Returns:
        Decode edilmiş payload dictionary (sub, role, iat, exp)
    """
    try:
        payload = jwt.decode(
            token,
            _get_secret(),
            algorithms=[_get_algorithm()],
        )
        return payload

    except jwt.ExpiredSignatureError:
        logger.warning("jwt.expired")
        raise Unauthorized("Token süresi dolmuş. Lütfen tekrar giriş yapın.")

    except jwt.InvalidSignatureError:
        logger.warning("jwt.invalid_signature")
        raise Unauthorized("Geçersiz token imzası.")

    except jwt.DecodeError as exc:
        logger.warning("jwt.decode_error", error=str(exc))
        raise Unauthorized("Token decode edilemedi.")

    except jwt.PyJWTError as exc:
        logger.warning("jwt.generic_error", error=str(exc))
        raise Unauthorized("Geçersiz token.")


# =============================================================================
# BÖLÜM 3: @protected — JWT Zorunlu Erişim Decorator'ı
# =============================================================================

def protected(route_fn: Callable) -> Callable:
    """
    Sanic route handler'larını JWT ile korur.

    Gelen istek Authorization: Bearer <token> başlığını kontrol eder.
    Token decode edilirse payload request.ctx.user'a enjekte edilir.
    Aksi hâlde HTTP 401 döner.

    Kullanım:
        @auth_bp.get("/me")
        @protected
        async def get_me(request: Request):
            user_id = request.ctx.user["sub"]
            role    = request.ctx.user["role"]
    """
    @wraps(route_fn)
    async def wrapper(request: Request, *args: Any, **kwargs: Any) -> Any:
        auth_header: str = request.headers.get("Authorization", "")

        if not auth_header:
            raise Unauthorized(
                "Authorization başlığı eksik.",
                scheme="Bearer",
            )

        if not auth_header.startswith("Bearer "):
            raise Unauthorized(
                "Authorization başlığı 'Bearer <token>' formatında olmalı.",
                scheme="Bearer",
            )

        raw_token = auth_header.split(" ", 1)[1].strip()
        if not raw_token:
            raise Unauthorized("Token boş olamaz.", scheme="Bearer")

        # Token'ı doğrula ve payload'ı request context'ine enjekte et
        payload = decode_access_token(raw_token)
        request.ctx.user = payload  # {"sub": "42", "role": "user", ...}

        return await route_fn(request, *args, **kwargs)

    return wrapper


# =============================================================================
# BÖLÜM 4: @role_required — Rol Tabanlı Erişim Kontrolü
# =============================================================================

def role_required(*allowed_roles: str) -> Callable:
    """
    Belirli rollere sahip kullanıcıların route'a erişimini kısıtlar.
    @protected'dan SONRA kullanılmalıdır (önce JWT doğrulanmalı).

    Args:
        *allowed_roles: İzin verilen rol string'leri
                        Örn: "admin", "group_leader"

    Raises:
        HTTP 403 (Forbidden) → Kullanıcının rolü izin verilenler arasında değil

    Kullanım:
        @admin_bp.delete("/users/<user_id:int>")
        @protected
        @role_required("admin")
        async def delete_user(request: Request, user_id: int):
            ...
    """
    def decorator(route_fn: Callable) -> Callable:
        @wraps(route_fn)
        async def wrapper(request: Request, *args: Any, **kwargs: Any) -> Any:
            # request.ctx.user @protected tarafından set edilmiş olmalı
            if not hasattr(request.ctx, "user"):
                raise Unauthorized(
                    "Bu endpoint'e erişmek için önce giriş yapmalısınız."
                )

            user_role: str = request.ctx.user.get("role", "")
            if user_role not in allowed_roles:
                logger.warning(
                    "access.forbidden",
                    user_id=request.ctx.user.get("sub"),
                    user_role=user_role,
                    required_roles=allowed_roles,
                    path=request.path,
                )
                raise Forbidden(
                    f"Bu işlem için yetkiniz yok. Gerekli rol: {', '.join(allowed_roles)}"
                )

            return await route_fn(request, *args, **kwargs)

        return wrapper
    return decorator
