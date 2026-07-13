"""
src/routes/social.py
====================
Arkadaşlık Sistemi Blueprint
/api/social prefix'i ile çalışır.

Endpoints:
  POST   /api/social/friend-request/<target_user_id>   → Arkadaşlık isteği gönder
  POST   /api/social/accept-request/<target_user_id>   → Arkadaşlık isteğini kabul et
  POST   /api/social/decline-request/<target_user_id>  → Arkadaşlık isteğini reddet
  DELETE /api/social/remove-friend/<target_user_id>    → Arkadaşı çıkar / İsteği iptal et
  GET    /api/social/friends                           → Arkadaş listesi
  GET    /api/social/friend-requests                    → Gelen arkadaşlık istekleri
"""

import structlog
from sanic import Blueprint, Request
from sanic.exceptions import BadRequest, NotFound
from sanic.response import HTTPResponse, json as sanic_json
from sqlalchemy import delete, insert, select, func, or_, and_
from sqlalchemy.exc import IntegrityError

from src.database import get_session
from src.models import User, Friendship, FriendshipStatus
from src.services.security import protected
from src.services.common import get_active_user

logger = structlog.get_logger(__name__)

social_bp = Blueprint("social", url_prefix="/api/social")


# =============================================================================
# Helpers
# =============================================================================

def _build_public_user(user: User, friendship_status: str = None) -> dict:
    return {
        "id":            user.id,
        "name":          user.name,
        "surname":       user.surname,
        "mail":          user.mail,
        "age":           user.age,
        "profile_photo": user.profile_photo,
        "invite_code":   user.invite_code,
        "friendship_status": friendship_status
    }


# =============================================================================
# ENDPOINT 1: POST /api/social/friend-request/<target_user_id>
# =============================================================================

@social_bp.post("/friend-request/<target_user_id:int>")
@protected
async def send_friend_request(request: Request, target_user_id: int) -> HTTPResponse:
    """Arkadaşlık isteği gönderir."""
    user_id: int = int(request.ctx.user["sub"])

    if user_id == target_user_id:
        raise BadRequest("Kendinize arkadaşlık isteği gönderemezsiniz.")

    async with get_session() as session:
        # Hedef kullanıcı aktif mi?
        await get_active_user(session, target_user_id)

        # Mevcut ilişki var mı?
        stmt = select(Friendship).where(
            or_(
                and_(Friendship.user_id == user_id, Friendship.friend_id == target_user_id),
                and_(Friendship.user_id == target_user_id, Friendship.friend_id == user_id)
            )
        )
        existing = await session.scalar(stmt)

        if existing:
            if existing.status == FriendshipStatus.ACCEPTED:
                raise BadRequest("Zaten arkadaşsınız.")
            elif existing.status == FriendshipStatus.PENDING:
                if existing.user_id == user_id:
                    raise BadRequest("Zaten bir istek gönderdiniz.")
                else:
                    raise BadRequest("Bu kullanıcı size zaten bir istek göndermiş. Kabul edebilirsiniz.")

        # İstek oluştur
        new_friendship = Friendship(
            user_id=user_id,
            friend_id=target_user_id,
            status=FriendshipStatus.PENDING
        )
        session.add(new_friendship)
        
        logger.info("social.friend_request.sent", user_id=user_id, target_id=target_user_id)
        return sanic_json({"message": "Arkadaşlık isteği gönderildi."}, status=201)


# =============================================================================
# ENDPOINT 2: POST /api/social/accept-request/<target_user_id>
# =============================================================================

@social_bp.post("/accept-request/<target_user_id:int>")
@protected
async def accept_friend_request(request: Request, target_user_id: int) -> HTTPResponse:
    """Gelen arkadaşlık isteğini kabul eder."""
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = select(Friendship).where(
            Friendship.user_id == target_user_id,
            Friendship.friend_id == user_id,
            Friendship.status == FriendshipStatus.PENDING
        )
        friendship = await session.scalar(stmt)

        if not friendship:
            raise NotFound("Bekleyen arkadaşlık isteği bulunamadı.")

        friendship.status = FriendshipStatus.ACCEPTED
        
        logger.info("social.friend_request.accepted", user_id=user_id, target_id=target_user_id)
        return sanic_json({"message": "Arkadaşlık isteği kabul edildi."})


# =============================================================================
# ENDPOINT 3: POST /api/social/decline-request/<target_user_id>
# =============================================================================

@social_bp.post("/decline-request/<target_user_id:int>")
@protected
async def decline_friend_request(request: Request, target_user_id: int) -> HTTPResponse:
    """Gelen arkadaşlık isteğini reddeder."""
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = delete(Friendship).where(
            Friendship.user_id == target_user_id,
            Friendship.friend_id == user_id,
            Friendship.status == FriendshipStatus.PENDING
        )
        result = await session.execute(stmt)

        if result.rowcount == 0:
            raise NotFound("Bekleyen arkadaşlık isteği bulunamadı.")

        logger.info("social.friend_request.declined", user_id=user_id, target_id=target_user_id)
        return sanic_json({"message": "Arkadaşlık isteği reddedildi."})


# =============================================================================
# ENDPOINT 4: DELETE /api/social/remove-friend/<target_user_id>
# =============================================================================

@social_bp.delete("/remove-friend/<target_user_id:int>")
@protected
async def remove_friend(request: Request, target_user_id: int) -> HTTPResponse:
    """Arkadaşlıktan çıkarır veya gönderilen isteği iptal eder."""
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = delete(Friendship).where(
            or_(
                and_(Friendship.user_id == user_id, Friendship.friend_id == target_user_id),
                and_(Friendship.user_id == target_user_id, Friendship.friend_id == user_id)
            )
        )
        result = await session.execute(stmt)

        if result.rowcount == 0:
            raise NotFound("Arkadaşlık ilişkisi bulunamadı.")

        logger.info("social.friendship.removed", user_id=user_id, target_id=target_user_id)
        return sanic_json({"message": "İşlem başarılı."})


# =============================================================================
# ENDPOINT 5: GET /api/social/friends
# =============================================================================

@social_bp.get("/friends")
@protected
async def list_friends(request: Request) -> HTTPResponse:
    """Kullanıcının arkadaşlarını listeler (Sayfalamalı ve alfabetik)."""
    user_id: int = int(request.ctx.user["sub"])
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 6))
    offset = (page - 1) * limit

    async with get_session() as session:
        from sqlalchemy import func
        # Base query
        stmt_base = select(User).join(
            Friendship,
            or_(
                and_(Friendship.user_id == user_id, Friendship.friend_id == User.id),
                and_(Friendship.friend_id == user_id, Friendship.user_id == User.id)
            )
        ).where(
            Friendship.status == FriendshipStatus.ACCEPTED,
            User.is_active.is_(True),
            User.deleted_at.is_(None)
        )

        # Count total
        count_stmt = select(func.count()).select_from(stmt_base.subquery())
        total_count = await session.scalar(count_stmt) or 0

        # Paged & Sorted query
        stmt = stmt_base.order_by(User.name.asc(), User.surname.asc()).limit(limit).offset(offset)
        friends = list(await session.scalars(stmt))

        return sanic_json({
            "data": [_build_public_user(u, "ACCEPTED") for u in friends],
            "pagination": {
                "total": total_count,
                "page": page,
                "limit": limit,
                "total_pages": (total_count + limit - 1) // limit
            }
        })


# =============================================================================
# ENDPOINT 6: GET /api/social/friend-requests
# =============================================================================

@social_bp.get("/friend-requests")
@protected
async def list_friend_requests(request: Request) -> HTTPResponse:
    """Kullanıcıya gelen bekleyen arkadaşlık isteklerini listeler (Sayfalamalı ve alfabetik)."""
    user_id: int = int(request.ctx.user["sub"])
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 6))
    offset = (page - 1) * limit

    async with get_session() as session:
        from sqlalchemy import func
        # Base query
        stmt_base = select(User).join(
            Friendship,
            and_(Friendship.user_id == User.id, Friendship.friend_id == user_id)
        ).where(
            Friendship.status == FriendshipStatus.PENDING,
            User.is_active.is_(True),
            User.deleted_at.is_(None)
        )

        # Count total
        count_stmt = select(func.count()).select_from(stmt_base.subquery())
        total_count = await session.scalar(count_stmt) or 0

        # Paged & Sorted query
        stmt = stmt_base.order_by(User.name.asc(), User.surname.asc()).limit(limit).offset(offset)
        requests = list(await session.scalars(stmt))

        return sanic_json({
            "data": [_build_public_user(u, "PENDING") for u in requests],
            "pagination": {
                "total": total_count,
                "page": page,
                "limit": limit,
                "total_pages": (total_count + limit - 1) // limit
            }
        })

@social_bp.get("/status/<target_user_id:int>")
@protected
async def get_friendship_status(request: Request, target_user_id: int) -> HTTPResponse:
    """İki kullanıcı arasındaki arkadaşlık durumunu döner."""
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = select(Friendship).where(
            or_(
                and_(Friendship.user_id == user_id, Friendship.friend_id == target_user_id),
                and_(Friendship.user_id == target_user_id, Friendship.friend_id == user_id)
            )
        )
        f = await session.scalar(stmt)
        
        if not f:
            return sanic_json({"status": None})
        
        # Eğer pending ise kimin gönderdiği önemli
        res = {"status": f.status.value, "sender_id": f.user_id}
        return sanic_json(res)
