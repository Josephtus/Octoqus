"""
src/services/common.py
======================
Ortak yardımcı fonksiyonlar ve veritabanı sorgu yardımcıları.
"""

from sanic.exceptions import NotFound
from sqlalchemy import select
from src.models import User

async def get_active_user(session, user_id: int) -> User:
    """
    Verilen ID'ye sahip, silinmemiş ve aktif kullanıcıyı döner.
    Bulunamazsa 404 (NotFound) fırlatır.
    """
    stmt = select(User).where(
        User.id == user_id,
        User.is_active.is_(True),
        User.deleted_at.is_(None)
    )
    user = await session.scalar(stmt)
    if not user:
        raise NotFound(f"Aktif kullanıcı bulunamadı (ID: {user_id}).")
    return user

# ---------------------------------------------------------------------------
# MIME Tespit Yardımcıları
# ---------------------------------------------------------------------------

MAGIC_SIGNATURES = [
    (b"\xff\xd8\xff", "image/jpeg"),           # JPEG
    (b"\x89PNG\r\n\x1a\n", "image/png"),       # PNG
    (b"GIF87a", "image/gif"),                  # GIF87
    (b"GIF89a", "image/gif"),                  # GIF89
    (b"RIFF", "image/webp"),                   # WebP (RIFF....WEBP)
]

def detect_mime(data: bytes) -> str | None:
    """
    Dosyanın ilk byte'larını okuyarak gerçek MIME tipini tespit eder.
    """
    for signature, mime_type in MAGIC_SIGNATURES:
        if data[: len(signature)] == signature:
            # WebP için ekstra kontrol: RIFF....WEBP
            if mime_type == "image/webp":
                if len(data) >= 12 and data[8:12] == b"WEBP":
                    return mime_type
                return None
            return mime_type
    return None
