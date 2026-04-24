"""
src/routes/social.py
====================
Sosyal Ağ ve Takip Sistemi Blueprint
/api/social prefix'i ile çalışır.

Endpoints:
  POST   /api/social/follow/<target_user_id>   → Belirtilen kullanıcıyı takip et
  DELETE /api/social/unfollow/<target_user_id> → Takipten çık
  GET    /api/social/<user_id>/followers       → Kullanıcının takipçilerini listele
  GET    /api/social/<user_id>/following       → Kullanıcının takip ettiklerini listele
"""

import structlog
from sanic import Blueprint, Request
from sanic.exceptions import BadRequest, NotFound
from sanic.response import HTTPResponse, json as sanic_json
from sqlalchemy import delete, insert, select, func
from sqlalchemy.exc import IntegrityError

from src.database import get_session
from src.models import User, follower_table
from src.services.security import protected

logger = structlog.get_logger(__name__)

social_bp = Blueprint("social", url_prefix="/api/social")


# =============================================================================
# Helpers
# =============================================================================

from src.services.common import get_active_user

# (Removed local _get_active_user, using src.services.common.get_active_user)


def _build_public_user(user: User) -> dict:
    return {
        "id":            user.id,
        "name":          user.name,
        "surname":       user.surname,
        "mail":          user.mail,
        "age":           user.age,
        "profile_photo": user.profile_photo,
    }


# =============================================================================
# ENDPOINT 1: POST /api/social/follow/<target_user_id> — Takip Et
# =============================================================================

@social_bp.post("/follow/<target_user_id:int>")
@protected
async def follow_user(request: Request, target_user_id: int) -> HTTPResponse:
    """
    Belirtilen kullanıcıyı takip eder.
    Kendini takip etmeyi engeller. Zaten takip ediyorsa 400 döner.
    """
    follower_id: int = int(request.ctx.user["sub"])

    if follower_id == target_user_id:
        raise BadRequest("Kendinizi takip edemezsiniz.")

    async with get_session() as session:
        # Hedef kullanıcı var mı ve aktif mi?
        await get_active_user(session, target_user_id)

        # Takip ilişkisini ekle
        stmt = insert(follower_table).values(
            follower_id=follower_id,
            following_id=target_user_id
        )

        try:
            await session.execute(stmt)
            logger.info("social.follow", follower=follower_id, following=target_user_id)
        except IntegrityError:
            # Composite primary key (follower_id, following_id) hatası = Zaten takip ediliyor
            raise BadRequest("Bu kullanıcıyı zaten takip ediyorsunuz.")

        return sanic_json(
            {"message": f"Kullanıcı (id={target_user_id}) başarıyla takip edildi."},
            status=201
        )


# =============================================================================
# ENDPOINT 2: DELETE /api/social/unfollow/<target_user_id> — Takipten Çık
# =============================================================================

@social_bp.delete("/unfollow/<target_user_id:int>")
@protected
async def unfollow_user(request: Request, target_user_id: int) -> HTTPResponse:
    """
    Belirtilen kullanıcıyı takipten çıkar.
    Takip edilmiyorsa 400 döner.
    """
    follower_id: int = int(request.ctx.user["sub"])

    if follower_id == target_user_id:
        raise BadRequest("Kendinizi takipten çıkamazsınız.")

    async with get_session() as session:
        # Silme sorgusu
        stmt = delete(follower_table).where(
            follower_table.c.follower_id == follower_id,
            follower_table.c.following_id == target_user_id
        )
        
        result = await session.execute(stmt)
        
        if result.rowcount == 0:
            raise BadRequest("Bu kullanıcıyı zaten takip etmiyorsunuz.")

        logger.info("social.unfollow", follower=follower_id, following=target_user_id)

        return sanic_json(
            {"message": f"Kullanıcı (id={target_user_id}) takipten çıkarıldı."},
            status=200
        )


# =============================================================================
# ENDPOINT 3: GET /api/social/<user_id>/followers — Takipçileri Listele
# =============================================================================

@social_bp.get("/<user_id:int>/followers")
@protected
async def list_followers(request: Request, user_id: int) -> HTTPResponse:
    """
    Belirtilen kullanıcının takipçilerini (onu takip edenleri) listeler.
    Sadece aktif ve silinmemiş kullanıcılar döner.
    """
    try:
        page  = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 20))))
    except (ValueError, TypeError):
        page, limit = 1, 20
    offset = (page - 1) * limit

    async with get_session() as session:
        await get_active_user(session, user_id)

        # Sorgu: follower_table ile User tablosunu joinleyip "follower_id" leri çeker
        stmt = (
            select(User)
            .join(follower_table, User.id == follower_table.c.follower_id)
            .where(
                follower_table.c.following_id == user_id,
                User.is_active.is_(True),
                User.deleted_at.is_(None)
            )
            .order_by(follower_table.c.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = await session.scalar(count_stmt) or 0

        # Execute
        followers = list(await session.scalars(stmt))

        return sanic_json(
            {
                "user_id": user_id,
                "page":    page,
                "limit":   limit,
                "total_count": total_count,
                "data":    [_build_public_user(u) for u in followers],
            },
            status=200
        )


# =============================================================================
# ENDPOINT 4: GET /api/social/<user_id>/following — Takip Edilenleri Listele
# =============================================================================

@social_bp.get("/<user_id:int>/following")
@protected
async def list_following(request: Request, user_id: int) -> HTTPResponse:
    """
    Belirtilen kullanıcının takip ettiklerini listeler.
    Sadece aktif ve silinmemiş kullanıcılar döner.
    """
    try:
        page  = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 20))))
    except (ValueError, TypeError):
        page, limit = 1, 20
    offset = (page - 1) * limit

    async with get_session() as session:
        await get_active_user(session, user_id)

        # Sorgu: follower_table ile User tablosunu joinleyip "following_id" leri çeker
        stmt = (
            select(User)
            .join(follower_table, User.id == follower_table.c.following_id)
            .where(
                follower_table.c.follower_id == user_id,
                User.is_active.is_(True),
                User.deleted_at.is_(None)
            )
            .order_by(follower_table.c.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = await session.scalar(count_stmt) or 0

        # Execute
        following = list(await session.scalars(stmt))

        return sanic_json(
            {
                "user_id": user_id,
                "page":    page,
                "limit":   limit,
                "total_count": total_count,
                "data":    [_build_public_user(u) for u in following],
            },
            status=200
        )

