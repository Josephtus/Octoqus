"""
src/routes/users.py
===================
Kullanıcı Profil Yönetimi Blueprint
/api/users prefix'i ile çalışır.

Endpoints:
  PUT  /api/users/me            → Profil bilgilerini güncelle
  PUT  /api/users/me/password   → Şifre değiştir
  POST /api/users/me/avatar     → Profil fotoğrafı yükle (multipart)
  GET  /api/users/<user_id:int> → Başka kullanıcının herkese açık profili
"""

import os
from datetime import date, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

import aiofiles
import structlog
from pydantic import BaseModel, ValidationError, field_validator
from sanic import Blueprint, Request
from sanic.exceptions import BadRequest, NotFound
from sanic.response import HTTPResponse, json as sanic_json
from sqlalchemy import select

from src.database import get_session
from src.models import User
from src.services.security import hash_password, protected, verify_password
from src.services.schemas import BaseUserUpdateSchema
from src.services.common import get_active_user, detect_mime

logger = structlog.get_logger(__name__)

users_bp = Blueprint("users", url_prefix="/api/users")


# =============================================================================
# Sabitler — Dosya Yükleme Konfigürasyonu
# =============================================================================

AVATAR_UPLOAD_DIR: Path = Path("./uploads/avatars")
MAX_AVATAR_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB

# Kabul edilen MIME tipleri
ALLOWED_MIME_TYPES: frozenset[str] = frozenset(
    {"image/jpeg", "image/png", "image/gif", "image/webp"}
)

# Dosya uzantısı → MIME tipi eşlemesi (ek güvenlik katmanı)
EXTENSION_TO_MIME: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}

# Magic Bytes — Dosyanın gerçek tipini ilk byte'lardan tespit et (MIME spoofing önlemi)
# Uzunluk → Signature → MIME type
MAGIC_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),           # JPEG
    (b"\x89PNG\r\n\x1a\n", "image/png"),       # PNG
    (b"GIF87a", "image/gif"),                  # GIF87
    (b"GIF89a", "image/gif"),                  # GIF89
    (b"RIFF", "image/webp"),                   # WebP (RIFF....WEBP)
]


# =============================================================================
# Pydantic Şemaları
# =============================================================================

class ChangePasswordRequest(BaseModel):
    """Şifre değiştirme isteği şeması."""
    current_password: str
    new_password: str
    new_password_confirm: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Yeni şifre en az 8 karakter olmalıdır.")
        if len(v) > 128:
            raise ValueError("Yeni şifre en fazla 128 karakter olabilir.")
        return v

    @field_validator("new_password_confirm")
    @classmethod
    def passwords_must_match(cls, v: str, info: Any) -> str:
        new_pw = info.data.get("new_password")
        if new_pw and v != new_pw:
            raise ValueError("Yeni şifre ile tekrarı eşleşmiyor.")
        return v


# =============================================================================
# Helpers — Ortak kullanılan yardımcı fonksiyonlar
# =============================================================================

def _build_public_profile(user: User) -> dict:
    """Herkese açık kullanıcı profili (hassas alanlar yok)."""
    return {
        "id": user.id,
        "name": user.name,
        "surname": user.surname,
        "profile_photo": user.profile_photo,
        "age": user.age,
        "role": user.role.value,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _build_private_profile(user: User) -> dict:
    """Kullanıcının kendi profil bilgileri (telefon, mail dahil)."""
    profile = _build_public_profile(user)
    profile.update(
        {
            "mail": user.mail,
            "phone_number": user.phone_number,
            "birthday": user.birthday.isoformat() if user.birthday else None,
            "is_active": user.is_active,
        }
    )
    return profile




async def _save_avatar(file_body: bytes, original_filename: str) -> str:
    """
    Avatar dosyasını UUID adıyla diske kaydeder.

    Args:
        file_body        : Yüklenen dosyanın binary içeriği
        original_filename: Orijinal dosya adı (uzantı tespiti için)

    Returns:
        Veritabanına kaydedilecek URL yolu: /uploads/avatars/<uuid>.<ext>
    """
    # Orijinal uzantıyı al (küçük harfe çevir)
    suffix = Path(original_filename).suffix.lower()
    if suffix not in EXTENSION_TO_MIME:
        suffix = ".jpg"  # Uzantı yoksa veya tanımsızsa varsayılan

    # Benzersiz dosya adı: <uuid4_hex>.<uzantı>
    unique_name = f"{uuid4().hex}{suffix}"
    file_path = AVATAR_UPLOAD_DIR / unique_name

    # Dizinin varlığını garantile (race condition'a karşı)
    AVATAR_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Async yazma — event loop'u bloklama
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(file_body)

    logger.info("avatar.saved", path=str(file_path), size_bytes=len(file_body))

    # Dışarıdan erişilebilir URL yolu (Sanic static route ile sunulur)
    return f"/uploads/avatars/{unique_name}"


# (Removed local _get_active_user, using src.services.common.get_active_user)


# =============================================================================
# ENDPOINT 1: PUT /api/users/me — Profil Güncelleme
# =============================================================================

@users_bp.put("/me")
@protected
async def update_profile(request: Request) -> HTTPResponse:
    """
    Kimliği doğrulanmış kullanıcının profil bilgilerini günceller.
    Yalnızca gönderilen alanlar değiştirilir (partial update).

    Headers:
        Authorization: Bearer <token>

    Request Body (JSON — tüm alanlar opsiyonel):
        name, surname, age, phone_number, birthday

    Responses:
        200 → Güncellenmiş profil
        400 → Validasyon hatası veya duplicate telefon
        401 → Token eksik/geçersiz
        404 → Kullanıcı bulunamadı
    """
    body = request.json or {}

    # En az bir alan gönderilmeli
    if not body:
        raise BadRequest("Güncellenecek en az bir alan gönderilmelidir.")

    try:
        data = BaseUserUpdateSchema.model_validate(body)
    except ValidationError as exc:
        raise BadRequest(f"Validasyon hatası: {exc.errors()}")

    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        user = await get_active_user(session, user_id)

        # Telefon duplicate kontrolü (başka bir kullanıcıda var mı?)
        if data.phone_number and data.phone_number != user.phone_number:
            stmt = select(User).where(
                User.phone_number == data.phone_number,
                User.id != user_id,
                User.deleted_at.is_(None),
            )
            existing = await session.scalar(stmt)
            if existing:
                raise BadRequest("Bu telefon numarası başka bir kullanıcı tarafından kullanılıyor.")

        # Yalnızca gönderilen alanları güncelle
        updated_fields: list[str] = []

        if data.name is not None:
            user.name = data.name
            updated_fields.append("name")
        if data.surname is not None:
            user.surname = data.surname
            updated_fields.append("surname")
        if data.age is not None:
            user.age = data.age
            updated_fields.append("age")
        if data.phone_number is not None:
            user.phone_number = data.phone_number
            updated_fields.append("phone_number")
        if data.birthday is not None:
            user.birthday = date.fromisoformat(data.birthday)
            # Yaşı otomatik güncelle
            user.age = user.calculated_age
            updated_fields.append("birthday")
            updated_fields.append("age")

        # get_session context manager commit'i yönetir
        logger.info(
            "user.profile.updated",
            user_id=user_id,
            updated_fields=updated_fields,
        )

        return sanic_json(
            {
                "message": "Profil başarıyla güncellendi.",
                "updated_fields": updated_fields,
                "user": _build_private_profile(user),
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 2: PUT /api/users/me/password — Şifre Değiştirme
# =============================================================================

@users_bp.put("/me/password")
@protected
async def change_password(request: Request) -> HTTPResponse:
    """
    Kullanıcının kendi şifresini değiştirmesini sağlar.
    Mevcut şifrenin doğrulanması zorunludur.

    Request Body (JSON):
        current_password   : Mevcut şifre (doğrulama için)
        new_password       : Yeni şifre (min 8 karakter)
        new_password_confirm: Yeni şifre tekrarı

    Responses:
        200 → Şifre başarıyla değiştirildi
        400 → Validasyon hatası veya şifreler eşleşmiyor
        401 → Token geçersiz veya mevcut şifre yanlış
    """
    body = request.json
    if not body:
        raise BadRequest("İstek gövdesi JSON formatında olmalıdır.")

    try:
        data = ChangePasswordRequest.model_validate(body)
    except ValidationError as exc:
        errors = [
            {"field": e["loc"][0] if e["loc"] else "unknown", "message": e["msg"]}
            for e in exc.errors()
        ]
        raise BadRequest(f"Validasyon hatası: {errors}")

    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        user = await get_active_user(session, user_id)

        # Mevcut şifreyi doğrula
        if not verify_password(data.current_password, user.password):
            logger.warning("user.password.wrong_current", user_id=user_id)
            # Güvenlik: "mevcut şifre yanlış" yerine genel mesaj
            raise BadRequest("Mevcut şifre hatalı.")

        # Yeni şifreyi hashle ve kaydet
        user.password = hash_password(data.new_password)

        logger.info("user.password.changed", user_id=user_id)

        return sanic_json(
            {"message": "Şifreniz başarıyla güncellendi."},
            status=200,
        )


# =============================================================================
# ENDPOINT 3: POST /api/users/me/avatar — Profil Fotoğrafı Yükleme
# =============================================================================

@users_bp.post("/me/avatar")
@protected
async def upload_avatar(request: Request) -> HTTPResponse:
    """
    Profil fotoğrafı yükler. multipart/form-data formatında gönderilmeli.
    Form field adı: 'avatar'

    Doğrulama Adımları:
      1. Dosya mevcut mu?
      2. Boyut limiti (max 5 MB)
      3. Uzantı kabul edilen listede mi?
      4. Magic byte kontrolü (MIME spoofing önlemi)

    Depolama:
      - Disk: ./uploads/avatars/<uuid>.<ext>
      - DB:   /uploads/avatars/<uuid>.<ext>  (Sanic static route ile sunulur)

    Responses:
        200 → Fotoğraf yüklendi, profil_photo URL'si döner
        400 → Dosya eksik, boyut aşımı veya geçersiz format
        401 → Token eksik/geçersiz
    """
    # ── 1. Dosya Varlık Kontrolü ─────────────────────────────────────────────
    upload_file = request.files.get("avatar")
    if not upload_file:
        raise BadRequest(
            "Dosya bulunamadı. Lütfen 'avatar' form alanıyla bir dosya gönderin."
        )

    # Sanic, aynı isimde birden fazla dosya gönderilirse liste döner
    if isinstance(upload_file, list):
        upload_file = upload_file[0]

    file_body: bytes = upload_file.body
    file_name: str = upload_file.name or "avatar.jpg"
    reported_mime: str = (upload_file.type or "").lower()

    # ── 2. Boyut Kontrolü ────────────────────────────────────────────────────
    if len(file_body) > MAX_AVATAR_SIZE_BYTES:
        raise BadRequest(
            f"Dosya boyutu çok büyük. Maksimum izin verilen boyut: "
            f"{MAX_AVATAR_SIZE_BYTES // (1024 * 1024)} MB"
        )

    if len(file_body) == 0:
        raise BadRequest("Boş dosya gönderilemez.")

    # ── 3. Uzantı Kontrolü ───────────────────────────────────────────────────
    file_ext = Path(file_name).suffix.lower()
    if file_ext not in EXTENSION_TO_MIME:
        raise BadRequest(
            f"Geçersiz dosya uzantısı: '{file_ext}'. "
            f"İzin verilenler: {', '.join(EXTENSION_TO_MIME.keys())}"
        )

    # ── 4. Magic Byte Doğrulaması (MIME Spoofing Önlemi) ────────────────────
    detected_mime = detect_mime(file_body)
    if detected_mime is None:
        raise BadRequest(
            "Dosya formatı tanınamadı. Lütfen geçerli bir görsel dosyası yükleyin."
        )
    if detected_mime not in ALLOWED_MIME_TYPES:
        raise BadRequest(
            f"Geçersiz dosya formatı: '{detected_mime}'. "
            f"İzin verilen formatlar: JPEG, PNG, GIF, WebP"
        )

    logger.info(
        "avatar.upload.validation_passed",
        filename=file_name,
        size=len(file_body),
        reported_mime=reported_mime,
        detected_mime=detected_mime,
    )

    # ── 5. Async Dosya Yazma & DB Güncelleme ─────────────────────────────────
    user_id: int = int(request.ctx.user["sub"])

    # Dosyayı diske async yaz
    avatar_url = await _save_avatar(file_body, file_name)

    async with get_session() as session:
        user = await get_active_user(session, user_id)

        # Eski fotoğrafı disk'ten sil (opsiyonel — veri bütünlüğü için)
        if user.profile_photo:
            old_path = Path("." + user.profile_photo)
            try:
                if old_path.exists():
                    old_path.unlink()
                    logger.info("avatar.old_deleted", path=str(old_path))
            except OSError as exc:
                # Silme başarısız olsa bile işlemi engelleme — sadece logla
                logger.warning("avatar.old_delete_failed", error=str(exc))

        # Yeni URL'yi veritabanına kaydet
        user.profile_photo = avatar_url

        logger.info("user.avatar.updated", user_id=user_id, url=avatar_url)

        return sanic_json(
            {
                "message": "Profil fotoğrafı başarıyla güncellendi.",
                "profile_photo": avatar_url,
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 4: DELETE /api/users/me/avatar — Profil Fotoğrafı Silme
# =============================================================================

@users_bp.delete("/me/avatar")
@protected
async def delete_avatar(request: Request) -> HTTPResponse:
    """
    Kullanıcının profil fotoğrafını hem diskten hem veritabanından kalıcı olarak siler (Hard Delete).
    """
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        user = await get_active_user(session, user_id)

        if not user.profile_photo:
            raise BadRequest("Silinecek bir profil fotoğrafı bulunmuyor.")

        # Fiziksel dosya yolu tespiti (Hard Delete)
        # Örn: /uploads/avatars/abc.jpg -> ./uploads/avatars/abc.jpg
        file_path = Path("." + user.profile_photo)
        
        try:
            if file_path.exists() and file_path.is_file():
                file_path.unlink()
                logger.info("avatar.hard_deleted", user_id=user_id, path=str(file_path))
        except Exception as exc:
            logger.error("avatar.hard_delete_failed", user_id=user_id, error=str(exc))
            # Dosya silinemese bile DB'yi temizle (veya kullanıcıya hata dön)
            # Burada kritik bir hata olmadığı sürece devam edelim.

        # Veritabanını güncelle
        user.profile_photo = None
        
        logger.info("user.avatar.removed", user_id=user_id)

        return sanic_json(
            {"message": "Profil fotoğrafı başarıyla kaldırıldı."},
            status=200,
        )


# =============================================================================
# ENDPOINT 4: GET /api/users/<user_id:int> — Herkese Açık Profil
# =============================================================================

@users_bp.get("/<user_id:int>")
@protected
async def get_user_public_profile(request: Request, user_id: int) -> HTTPResponse:
    """
    Belirtilen kullanıcının herkese açık profil bilgilerini döner.
    Takip sistemi ve grup üyeliği özellikleri için kullanılacak.

    Path Parameters:
        user_id: Hedef kullanıcının ID'si

    Responses:
        200 → Kullanıcının herkese açık profili
        401 → Token eksik/geçersiz
        404 → Kullanıcı bulunamadı veya silinmiş
    """
    async with get_session() as session:
        stmt = select(User).where(
            User.id == user_id,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
        user = await session.scalar(stmt)

        if not user:
            raise NotFound(f"Kullanıcı bulunamadı (id={user_id}).")

        return sanic_json(
            {"user": _build_public_profile(user)},
            status=200,
        )


# =============================================================================
# ENDPOINT 5: GET /api/users/search — Kullanıcı Arama
# =============================================================================

@users_bp.get("/search")
@protected
async def search_users(request: Request) -> HTTPResponse:
    """
    Kullanıcıları isim, soyisim veya e-posta ile arar.
    Sosyal ağda arkadaş bulmak için kullanılır. Sayfalama destekler.
    """
    query = request.args.get("q", "").strip()
    if not query:
        return sanic_json({"data": [], "total_count": 0}, status=200)

    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 6))))
    except (ValueError, TypeError):
        page, limit = 1, 6
    offset = (page - 1) * limit

    async with get_session() as session:
        from sqlalchemy import or_, func
        
        # Base query
        stmt = select(User).where(
            or_(
                User.name.ilike(f"%{query}%"),
                User.surname.ilike(f"%{query}%"),
                User.mail.ilike(f"%{query}%")
            ),
            User.is_active.is_(True),
            User.deleted_at.is_(None)
        )

        # Count total matches
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = await session.scalar(count_stmt) or 0

        # Execute paginated query
        stmt = stmt.order_by(User.name.asc()).offset(offset).limit(limit)
        users = list(await session.scalars(stmt))

        return sanic_json(
            {
                "query": query,
                "total_count": total_count,
                "page": page,
                "limit": limit,
                "data": [_build_public_profile(u) for u in users]
            },
            status=200
        )
