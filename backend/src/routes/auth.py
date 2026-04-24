"""
src/routes/auth.py
==================
Kimlik Doğrulama (Authentication) Blueprint
/api/auth prefix'i ile çalışır.

Endpoints:
  POST /api/auth/register  → Yeni kullanıcı kaydı
  POST /api/auth/login     → Giriş ve JWT token alımı
  GET  /api/auth/me        → Mevcut kullanıcı profili (token gerekli)
"""

import structlog
from typing import List, Optional
from datetime import date
from uuid import uuid4
from pydantic import BaseModel, EmailStr, ValidationError, field_validator
from sanic import Blueprint, Request
from sanic.exceptions import BadRequest, NotFound, Unauthorized
from sanic.response import HTTPResponse, json as sanic_json
from sqlalchemy import select

from src.database import get_session
from src.models import GlobalRole, User
from src.services.security import (
    create_access_token,
    hash_password,
    protected,
    verify_password,
)
from src.services.email import send_password_reset_email

logger = structlog.get_logger(__name__)

# Blueprint tanımı — url_prefix tüm endpoint'lere eklenir
auth_bp = Blueprint("auth", url_prefix="/api/auth")


# =============================================================================
# Pydantic Şemaları — Request Body Doğrulama
# =============================================================================

class RegisterRequest(BaseModel):
    """Kayıt isteği validasyon şeması."""

    name: str
    surname: str
    mail: EmailStr
    password: str
    phone_number: str
    age: Optional[int] = None
    birthday: str

    @field_validator("name", "surname")
    @classmethod
    def strip_and_check_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Bu alan boş olamaz.")
        if len(v) > 100:
            raise ValueError("Bu alan en fazla 100 karakter olabilir.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Şifre en az 8 karakter olmalıdır.")
        if len(v) > 128:
            raise ValueError("Şifre en fazla 128 karakter olabilir.")
        return v

    @field_validator("age")
    @classmethod
    def validate_age(cls, v: int | None) -> int | None:
        if v is not None and (v < 13 or v > 120):
            raise ValueError("Yaş 13 ile 120 arasında olmalıdır.")
        return v

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v.startswith("+") or not v[1:].isdigit():
            raise ValueError("Telefon numarası uluslararası formatta olmalıdır. Örn: +905551234567")
        if len(v) < 10 or len(v) > 16:
            raise ValueError("Telefon numarası 10-16 karakter arasında olmalıdır.")
        return v

    @field_validator("birthday")
    @classmethod
    def validate_birthday(cls, v: str) -> str:
        v = v.strip()
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError("Doğum tarihi YYYY-MM-DD formatında olmalıdır. Örn: 2000-01-15")
        return v


class LoginRequest(BaseModel):
    """Giriş isteği validasyon şeması."""

    mail: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def check_password_not_empty(cls, v: str) -> str:
        if not v:
            raise ValueError("Şifre boş olamaz.")
        return v


class ForgotPasswordRequest(BaseModel):
    """Şifremi unuttum isteği."""
    mail: EmailStr


class ResetPasswordRequest(BaseModel):
    """Şifre sıfırlama isteği."""
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Yeni şifre en az 8 karakter olmalıdır.")
        if len(v) > 128:
            raise ValueError("Yeni şifre en fazla 128 karakter olabilir.")
        return v


# =============================================================================
# HELPERS — Tekrar eden veritabanı sorguları
# =============================================================================

async def _get_user_by_email(session, mail: str) -> User | None:
    """E-posta ile aktif (silinmemiş) kullanıcı getirir."""
    stmt = select(User).where(User.mail == mail, User.deleted_at.is_(None))
    return await session.scalar(stmt)


async def _get_user_by_phone(session, phone: str) -> User | None:
    """Telefon numarası ile aktif kullanıcı getirir."""
    stmt = select(User).where(User.phone_number == phone, User.deleted_at.is_(None))
    return await session.scalar(stmt)


def _build_user_response(user: User) -> dict:
    """Kullanıcı nesnesinden hassas alanları çıkararak güvenli dict döner."""
    return {
        "id": user.id,
        "name": user.name,
        "surname": user.surname,
        "mail": user.mail,
        "phone_number": user.phone_number,
        "profile_photo": user.profile_photo,
        "age": user.calculated_age,
        "role": user.role.value,
        "is_active": user.is_active,
        "birthday": user.birthday.isoformat() if user.birthday else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


# =============================================================================
# ENDPOINT 1: POST /api/auth/register
# =============================================================================

@auth_bp.post("/register")
async def register(request: Request) -> HTTPResponse:
    """
    Yeni kullanıcı kaydı.

    Request Body (JSON):
        name        : str (zorunlu)
        surname     : str (zorunlu)
        mail        : str (zorunlu, geçerli email formatı)
        password    : str (zorunlu, min 8 karakter)
        phone_number: str | null (opsiyonel, +9055... formatı)
        age         : int | null (opsiyonel, 13-120)

    Responses:
        201 → Kayıt başarılı, kullanıcı bilgileri döner
        400 → Validasyon hatası veya duplicate email/telefon
        500 → Sunucu hatası
    """
    # ── 1. Request Body Validasyonu ─────────────────────────────────────────
    body = request.json
    if not body:
        raise BadRequest("İstek gövdesi JSON formatında olmalıdır.")

    try:
        data = RegisterRequest.model_validate(body)
    except ValidationError as exc:
        # Pydantic hata mesajlarını düzgün formatta döndür
        errors = [
            {"field": e["loc"][0] if e["loc"] else "unknown", "message": e["msg"]}
            for e in exc.errors()
        ]
        raise BadRequest(f"Validasyon hatası: {errors}")

    # ── 2. Duplicate Kontrol ─────────────────────────────────────────────────
    async with get_session() as session:
        existing_user = await _get_user_by_email(session, data.mail)
        if existing_user:
            logger.warning("auth.register.duplicate_email", mail=data.mail)
            raise BadRequest("Bu e-posta adresi zaten kayıtlı.")

        if data.phone_number:
            existing_phone = await _get_user_by_phone(session, data.phone_number)
            if existing_phone:
                logger.warning("auth.register.duplicate_phone", phone=data.phone_number)
                raise BadRequest("Bu telefon numarası zaten kayıtlı.")

        # ── 3. Şifre Hashleme & Kullanıcı Oluşturma ─────────────────────────
        hashed_pw = hash_password(data.password)

        new_user = User(
            name=data.name,
            surname=data.surname,
            mail=data.mail,
            password=hashed_pw,          # Düz metin ASLA saklanmaz
            phone_number=data.phone_number,
            age=data.age if data.age is not None else (date.today().year - date.fromisoformat(data.birthday).year - ((date.today().month, date.today().day) < (date.fromisoformat(data.birthday).month, date.fromisoformat(data.birthday).day))),
            birthday=date.fromisoformat(data.birthday),
            role=GlobalRole.USER,        # Yeni kayıtlar her zaman USER rolüyle başlar
            is_active=True,
        )

        # Veritabanına ekle
        session.add(new_user)
        await session.flush()  # ID alabilmek için
        await session.refresh(new_user) # İlişkileri/alanları yükle

        logger.info("auth.registered", user_id=new_user.id, mail=new_user.mail)

        return sanic_json(
            {
                "message": "Kayıt başarıyla tamamlandı. Giriş yapabilirsiniz.",
                "user": _build_user_response(new_user),
            },
            status=201,
        )


# =============================================================================
# ENDPOINT 2: POST /api/auth/login
# =============================================================================

@auth_bp.post("/login")
async def login(request: Request) -> HTTPResponse:
    """
    Kullanıcı girişi ve JWT Access Token üretimi.

    Request Body (JSON):
        mail    : str (zorunlu)
        password: str (zorunlu)

    Responses:
        200 → Giriş başarılı, access_token döner
        400 → Validasyon hatası
        401 → Geçersiz kimlik bilgileri (güvenlik: hangi alanın yanlış olduğu belirtilmez)
    """
    # ── 1. Validasyon ────────────────────────────────────────────────────────
    body = request.json
    if not body:
        raise BadRequest("İstek gövdesi JSON formatında olmalıdır.")

    try:
        data = LoginRequest.model_validate(body)
    except ValidationError as exc:
        errors = [
            {"field": e["loc"][0] if e["loc"] else "unknown", "message": e["msg"]}
            for e in exc.errors()
        ]
        raise BadRequest(f"Validasyon hatası: {errors}")

    # ── 2. Kullanıcı Arama ───────────────────────────────────────────────────
    async with get_session() as session:
        user = await _get_user_by_email(session, data.mail)

        # Güvenlik: "kullanıcı bulunamadı" ile "şifre yanlış" ayrıştırılmaz
        # Timing attack önlemi: kullanıcı yoksa bile verify_password çalıştır
        dummy_hash = "$2b$12$invalidhashfortimingprotection00000000000000000000000000"
        stored_hash = user.password if user else dummy_hash

        password_valid = verify_password(data.password, stored_hash)

        if not user or not password_valid:
            logger.warning("auth.login.failed", mail=data.mail)
            raise Unauthorized("E-posta veya şifre hatalı.")

        # ── 3. Hesap Durum Kontrolleri ───────────────────────────────────────
        if user.deleted_at is not None:
            logger.warning("auth.login.deleted_account", user_id=user.id)
            raise Unauthorized("Bu hesap silinmiş.")

        if not user.is_active:
            logger.warning("auth.login.inactive_account", user_id=user.id)
            raise Unauthorized("Hesabınız aktif değil. Lütfen yönetici ile iletişime geçin.")

        # ── 4. JWT Üretimi ───────────────────────────────────────────────────
        access_token = create_access_token(
            user_id=user.id,
            role=user.role.value,
        )

        logger.info("auth.login.success", user_id=user.id, role=user.role.value)

        return sanic_json(
            {
                "access_token": access_token,
                "token_type": "Bearer",
                "expires_in_minutes": int(__import__("os").getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "1440")),
                "user": _build_user_response(user),
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 3: GET /api/auth/me — Mevcut Kullanıcı Profili
# =============================================================================

@auth_bp.get("/me")
@protected
async def get_me(request: Request) -> HTTPResponse:
    """
    Geçerli JWT token ile kimliği doğrulanmış kullanıcının profilini döner.

    Headers:
        Authorization: Bearer <token>

    Responses:
        200 → Kullanıcı profili
        401 → Token eksik veya geçersiz
        404 → Kullanıcı veritabanında bulunamadı (silinmiş olabilir)
    """
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        user = await session.scalar(stmt)

        if not user:
            raise NotFound("Kullanıcı bulunamadı.")

        return sanic_json(
            {"user": _build_user_response(user)},
            status=200,
        )


# =============================================================================
# ENDPOINT 4: POST /api/auth/forgot-password — Şifremi Unuttum
# =============================================================================

@auth_bp.post("/forgot-password")
async def forgot_password(request: Request) -> HTTPResponse:
    """
    Kullanıcıya şifre sıfırlama linki/token'ı gönderir.
    Timing attack/Mail taraması (enumeration) önlemek için kullanıcı
    bulunmasa dahi 200 başarılı dönülür.
    """
    body = request.json
    if not body:
        raise BadRequest("İstek gövdesi JSON formatında olmalıdır.")

    try:
        data = ForgotPasswordRequest.model_validate(body)
    except ValidationError as exc:
        errors = [{"field": e["loc"][0] if e["loc"] else "unknown", "message": e["msg"]} for e in exc.errors()]
        raise BadRequest(f"Validasyon hatası: {errors}")

    async with get_session() as session:
        user = await _get_user_by_email(session, data.mail)

        if user and user.is_active:
            # Token üret ve Redis'e kaydet
            reset_token = uuid4().hex
            redis_key = f"reset_token:{reset_token}"
            
            # 15 dakika (900 saniye) geçerlilik
            await request.app.ctx.redis.setex(redis_key, 900, str(user.id))

            # E-posta gönder (arka planda asenkron çalışsın diye await yapıyoruz ama 
            # asıl SMTP I/O async olduğundan main loop bloklanmaz)
            await send_password_reset_email(data.mail, reset_token)

            logger.info("auth.forgot_password.sent", user_id=user.id)
        else:
            # Kullanıcı yok veya inaktif. Simüle ediyoruz (security).
            logger.info("auth.forgot_password.simulated", mail=data.mail)

    return sanic_json(
        {"message": "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi (kayıtlıysa)."},
        status=200,
    )


# =============================================================================
# ENDPOINT 5: POST /api/auth/reset-password — Şifre Sıfırlama
# =============================================================================

@auth_bp.post("/reset-password")
async def reset_password(request: Request) -> HTTPResponse:
    """
    E-posta ile gelen token'ı kullanarak şifreyi değiştirir.
    Token 15 dk geçerlidir ve tek kullanımlıktır.
    """
    body = request.json
    if not body:
        raise BadRequest("İstek gövdesi JSON formatında olmalıdır.")

    try:
        data = ResetPasswordRequest.model_validate(body)
    except ValidationError as exc:
        errors = [{"field": e["loc"][0] if e["loc"] else "unknown", "message": e["msg"]} for e in exc.errors()]
        raise BadRequest(f"Validasyon hatası: {errors}")

    redis_key = f"reset_token:{data.token}"
    
    # Redis'ten user_id al
    user_id_str = await request.app.ctx.redis.get(redis_key)
    if not user_id_str:
        logger.warning("auth.reset_password.invalid_token", token=data.token)
        raise BadRequest("Geçersiz veya süresi dolmuş bir token kullandınız.")

    user_id = int(user_id_str)

    async with get_session() as session:
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        user = await session.scalar(stmt)

        if not user or not user.is_active:
            raise BadRequest("Kullanıcı hesabı geçerli değil.")

        # Yeni şifreyi hashle ve kaydet
        user.password = hash_password(data.new_password)
        
        # Tek kullanımlık olduğu için token'ı Redis'ten sil
        await request.app.ctx.redis.delete(redis_key)

        logger.info("auth.reset_password.success", user_id=user.id)

        return sanic_json(
            {"message": "Şifreniz başarıyla sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz."},
            status=200,
        )
