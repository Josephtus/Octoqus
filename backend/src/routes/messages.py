"""
src/routes/messages.py
======================
Gerçek Zamanlı Grup Chat Sistemi
WebSocket + Redis Pub/Sub + MySQL kalıcı depolama

/api/messages prefix'i ile çalışır.

Endpoints:
  GET       /api/messages/<group_id>/history → Sayfalı mesaj geçmişi
  WEBSOCKET /api/messages/ws/<group_id>      → Gerçek zamanlı chat

WebSocket Mimarisi:
  ┌─────────┐  send msg   ┌─────────────┐  publish  ┌─────────┐
  │ Client  │ ──────────→ │  Sanic WS   │ ────────→ │  Redis  │
  │   A     │             │  Handler    │           │ Pub/Sub │
  └─────────┘             └─────────────┘           └────┬────┘
                                                         │ subscribe
  ┌─────────┐  recv msg   ┌──────────────┐  listen  ┌───┴─────┐
  │ Client  │ ←────────── │ Listener     │ ←─────── │  Redis  │
  │   B     │             │ Task (async) │          │ Channel │
  └─────────┘             └──────────────┘          └─────────┘

JWT Doğrulama:
  WebSockets standart Bearer header gönderemez.
  Token query string'den alınır: ws://.../ws/1?token=<jwt>
  Sonra veritabanında grup üyeliği kontrol edilir.
"""

import asyncio
import json
import os
from datetime import datetime, timezone

import redis.asyncio as aioredis
import structlog
from sanic import Blueprint, Request
from sanic.exceptions import Forbidden, NotFound, Unauthorized
from sanic.response import HTTPResponse, json as sanic_json
from sanic.server.websockets.impl import WebsocketImplProtocol
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from redis.exceptions import RedisError
from websockets.exceptions import ConnectionClosedError

from src.database import get_session
from src.models import Group, GroupMember, Message
from src.services.security import decode_access_token, protected

logger = structlog.get_logger(__name__)

messages_bp = Blueprint("messages", url_prefix="/api/messages")

# Redis kanal isim şablonu
CHANNEL_TEMPLATE = "group_{group_id}"

# Mesaj boyut limiti (50 KB)
MAX_MESSAGE_SIZE = 50 * 1024


# =============================================================================
# Helpers
# =============================================================================

def _build_message(msg: Message) -> dict:
    return {
        "id":           msg.id,
        "group_id":     msg.group_id,
        "sender_id":    msg.sender_id,
        "sender_name":  msg.sender.name if msg.sender else "Bilinmeyen",
        "sender_surname": msg.sender.surname if msg.sender else "Kullanıcı",
        "message_text": msg.message_text,
        "timestamp":    msg.timestamp.isoformat() if msg.timestamp else None,
    }


async def _require_approved_member(session, group_id: int, user_id: int) -> None:
    """Kullanıcının onaylı grup üyesi olduğunu doğrular, değilse exception fırlatır."""
    stmt = select(GroupMember).where(
        GroupMember.group_id    == group_id,
        GroupMember.user_id     == user_id,
        GroupMember.is_approved.is_(True),
    )
    member = await session.scalar(stmt)
    if not member:
        raise Forbidden("Bu grubun onaylı üyesi değilsiniz.")


async def _get_approved_group(session, group_id: int) -> Group:
    stmt = select(Group).where(Group.id == group_id, Group.is_approved.is_(True))
    group = await session.scalar(stmt)
    if not group:
        raise NotFound(f"Onaylı grup bulunamadı (id={group_id}).")
    return group


async def _publish_message(request: Request, channel: str, message_data: dict) -> None:
    """Mesajı Redis üzerinden tüm abonelere yayınlar."""
    try:
        await request.app.ctx.redis.publish(channel, json.dumps(message_data))
    except RedisError as exc:
        logger.error("pubsub.publish_error", error=str(exc), channel=channel)


async def _check_chat_rate_limit(request: Request, user_id: int, group_id: int) -> bool:
    """
    Kullanıcının gruptaki mesaj hızını kontrol eder (Anti-Spam).
    Limit: 10 saniyede 5 mesaj.
    """
    key = f"chat_rate:{group_id}:{user_id}"
    limit = 5
    window = 10

    try:
        count = await request.app.ctx.redis.incr(key)
        if count == 1:
            await request.app.ctx.redis.expire(key, window)

        return count <= limit
    except RedisError as exc:
        logger.warning("chat.rate_limit.redis_error", error=str(exc), user_id=user_id)
        return True


# =============================================================================
# ENDPOINT 1: GET /api/messages/<group_id>/history — Mesaj Geçmişi
# =============================================================================

@messages_bp.get("/<group_id:int>/history")
@protected
async def get_message_history(request: Request, group_id: int) -> HTTPResponse:
    """
    Grubun silinmemiş mesajlarını en yeniden en eskiye doğru listeler.
    Yalnızca onaylı üyeler erişebilir.

    Query Params:
        page  (default: 1)
        limit (default: 50, max: 200)

    Responses:
        200 → Mesaj listesi (pagination dahil)
        403 → Onaylı üye değil
        404 → Grup bulunamadı
    """
    user_id: int = int(request.ctx.user["sub"])

    try:
        page  = max(1, int(request.args.get("page", 1)))
        limit = min(200, max(1, int(request.args.get("limit", 50))))
    except (ValueError, TypeError):
        page, limit = 1, 50

    offset = (page - 1) * limit

    async with get_session() as session:
        await _get_approved_group(session, group_id)
        await _require_approved_member(session, group_id, user_id)

        from sqlalchemy.orm import selectinload
        stmt = (
            select(Message)
            .options(selectinload(Message.sender))
            .where(
                Message.group_id   == group_id,
                Message.is_deleted.is_(False),
            )
            .order_by(Message.timestamp.desc())
            .offset(offset)
            .limit(limit)
        )
        messages = list(await session.scalars(stmt))

        return sanic_json(
            {
                "group_id": group_id,
                "page":     page,
                "limit":    limit,
                "count":    len(messages),
                "messages": [_build_message(m) for m in messages],
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 1.5: POST /api/messages/<group_id> — Mesaj Gönder (REST)
# =============================================================================

@messages_bp.post("/<group_id:int>")
@protected
async def send_message_rest(request: Request, group_id: int) -> HTTPResponse:
    """
    Gruba yeni bir mesaj gönderir (REST API).
    WebSocket bağlantısı olmayan veya sorun yaşayan istemciler için alternatiftir.
    """
    user_id: int = int(request.ctx.user["sub"])
    body = request.json or {}
    message_text = (body.get("text") or "").strip()

    if not message_text:
        raise BadRequest("Mesaj metni boş olamaz.")

    if len(message_text) > MAX_MESSAGE_SIZE:
        raise BadRequest(f"Mesaj çok uzun. Max: {MAX_MESSAGE_SIZE // 1024} KB")

    # Anti-Spam Kontrolü
    if not await _check_chat_rate_limit(request, user_id, group_id):
        raise Forbidden("Çok hızlı mesaj gönderiyorsunuz. Lütfen biraz bekleyin.")

    async with get_session() as session:
        await _get_approved_group(session, group_id)
        await _require_approved_member(session, group_id, user_id)

        # Kullanıcı bilgilerini al (Broadcast için)
        from src.models import User
        user_obj = await session.get(User, user_id)
        user_name = user_obj.name if user_obj else "Bilinmeyen"
        user_surname = user_obj.surname if user_obj else "Kullanıcı"

        # DB'ye kaydet
        now = datetime.now(timezone.utc)
        new_msg = Message(
            group_id     = group_id,
            sender_id    = user_id,
            message_text = message_text,
            timestamp    = now,
            is_deleted   = False,
        )
        session.add(new_msg)
        await session.flush()
        
        msg_data = {
            "type":         "message",
            "id":           new_msg.id,
            "group_id":     group_id,
            "sender_id":    user_id,
            "sender_name":  user_name,
            "sender_surname": user_surname,
            "message_text": message_text,
            "timestamp":    now.isoformat(),
        }

        # Redis'e publish et (WebSocket üzerinden bağlı olanlar için)
        channel = CHANNEL_TEMPLATE.format(group_id=group_id)
        await _publish_message(request, channel, msg_data)

        await session.commit()

        return sanic_json(msg_data, status=201)


@messages_bp.delete("/<message_id:int>")
@protected
async def delete_own_message(request: Request, message_id: int) -> HTTPResponse:
    """
    Kullanıcının kendi gönderdiği mesajı silmesini sağlar (Soft-Delete).
    Silinen mesaj tüm bağlı istemcilere WebSocket üzerinden bildirilir.
    """
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = select(Message).where(Message.id == message_id, Message.is_deleted.is_(False))
        message = await session.scalar(stmt)

        if not message:
            raise NotFound("Mesaj bulunamadı.")

        if message.sender_id != user_id:
            raise Forbidden("Yalnızca kendi mesajlarınızı silebilirsiniz.")

        # Soft delete
        message.is_deleted = True
        message.deleted_at = datetime.now(timezone.utc)

        # Broadcast deletion (Diğer istemcilerin UI'dan kaldırması için)
        channel = CHANNEL_TEMPLATE.format(group_id=message.group_id)
        await _publish_message(request, channel, {
            "type": "delete",
            "id": message_id,
            "group_id": message.group_id
        })

        await session.commit()

        return sanic_json({"message": "Mesaj başarıyla silindi."}, status=200)


# =============================================================================
# ENDPOINT 2: WEBSOCKET /api/messages/ws/<group_id> — Gerçek Zamanlı Chat
# =============================================================================

@messages_bp.websocket("/ws/<group_id:int>")
async def chat_websocket(
    request: Request,
    ws: WebsocketImplProtocol,
    group_id: int,
) -> None:
    """
    Gerçek zamanlı grup sohbeti WebSocket endpoint'i.

    Bağlantı Akışı:
      1. ?token=<jwt> query string'den JWT al ve doğrula
      2. Grubun varlığını ve kullanıcının onaylı üyeliğini kontrol et
      3. Bu bağlantı için ayrı bir Redis pub/sub connection oluştur
      4. asyncio.create_task ile listener görevi başlat
      5. Gelen WebSocket mesajlarını al → DB'ye kaydet → Redis'e publish et
      6. Bağlantı kapandığında listener task'ı temizle

    İstemci Mesaj Formatları (her ikisi de kabul edilir):
      - JSON: {"text": "Merhaba!"}
      - Düz metin: "Merhaba!"

    Sunucu Mesaj Formatı:
      {
        "type":         "message",
        "id":           123,
        "group_id":     1,
        "sender_id":    42,
        "message_text": "Merhaba!",
        "timestamp":    "2026-04-23T12:00:00+00:00"
      }

    Sistem Mesajları (sunucudan istemciye):
      {"type": "system", "message": "..."}
      {"type": "error",  "message": "..."}
    """
    # =========================================================================
    # ADIM 1: JWT Kimlik Doğrulama (Query String)
    # =========================================================================
    token: str | None = request.args.get("token")

    if not token:
        await ws.send(json.dumps({"type": "error", "message": "Token gerekli: ?token=<jwt>"}))
        await ws.close()
        return

    try:
        payload = decode_access_token(token)
    except Unauthorized as exc:
        await ws.send(json.dumps({"type": "error", "message": str(exc)}))
        await ws.close()
        return

    user_id: int = int(payload["sub"])

    # =========================================================================
    # ADIM 2: Grup Üyeliği ve Kullanıcı Bilgisi Doğrulama
    # =========================================================================
    user_name = "Bilinmeyen"
    user_surname = "Kullanıcı"

    try:
        async with get_session() as session:
            await _get_approved_group(session, group_id)
            await _require_approved_member(session, group_id, user_id)
            
            # Kullanıcı adını al
            from src.models import User
            stmt_user = select(User).where(User.id == user_id)
            user_obj = await session.scalar(stmt_user)
            if user_obj:
                user_name = user_obj.name
                user_surname = user_obj.surname
    except (NotFound, Forbidden) as exc:
        await ws.send(json.dumps({"type": "error", "message": str(exc)}))
        await ws.close()
        return
    except SQLAlchemyError as exc:
        logger.error("ws.auth_db_error", error=str(exc))
        await ws.send(json.dumps({"type": "error", "message": "Sunucu hatası."}))
        await ws.close()
        return

    channel: str = CHANNEL_TEMPLATE.format(group_id=group_id)

    logger.info("ws.connected", user_id=user_id, group_id=group_id, name=user_name)

    # Bağlantı onayı gönder
    await ws.send(json.dumps({
        "type":    "system",
        "message": f"Gruba bağlandınız (id={group_id}). Mesajlaşabilirsiniz.",
    }))

    # =========================================================================
    # ADIM 3: PubSub Manager'a abone ol
    # Artık her WS bağlantısı kendi subscriber'ını açmaz.
    # Global PubSubManager (main.py'de başlatıldı) kullanılır.
    # =========================================================================
    pubsub_manager = request.app.ctx.pubsub_manager
    await pubsub_manager.subscribe(channel, ws)

    # =========================================================================
    # ADIM 4: Mesaj Alıcı Döngüsü — WebSocket → DB + Redis publish
    # =========================================================================
    try:
        async for raw_data in ws:

            # Boyut kontrolü
            if len(raw_data) > MAX_MESSAGE_SIZE:
                await ws.send(json.dumps({
                    "type":    "error",
                    "message": f"Mesaj çok uzun. Max: {MAX_MESSAGE_SIZE // 1024} KB",
                }))
                continue

            # Anti-Spam Kontrolü
            if not await _check_chat_rate_limit(request, user_id, group_id):
                await ws.send(json.dumps({
                    "type":    "error",
                    "message": "Çok hızlı mesaj gönderiyorsunuz. Lütfen biraz bekleyin.",
                }))
                continue

            # Mesaj içeriğini ayrıştır (JSON veya düz metin)
            message_text: str = ""
            if raw_data.strip().startswith("{"):
                try:
                    parsed = json.loads(raw_data)
                    message_text = (parsed.get("text") or "").strip()
                except json.JSONDecodeError:
                    message_text = raw_data.strip()
            else:
                message_text = raw_data.strip()

            if not message_text:
                continue

            # ── DB'ye kaydet ────────────────────────────────────────────────
            now = datetime.now(timezone.utc)
            msg_id: int = 0

            try:
                async with get_session() as session:
                    new_msg = Message(
                        group_id     = group_id,
                        sender_id    = user_id,
                        message_text = message_text,
                        timestamp    = now,
                        is_deleted   = False,
                    )
                    session.add(new_msg)
                    await session.flush()
                    msg_id = new_msg.id
            except SQLAlchemyError as exc:
                logger.error("ws.db_save_error", error=str(exc))
                await ws.send(json.dumps({
                    "type":    "error",
                    "message": "Mesaj kaydedilemedi. Lütfen tekrar deneyin.",
                }))
                continue

            # ── Redis'e publish et ──────────────────────────────────────────
            publish_payload = {
                "type":         "message",
                "id":           msg_id,
                "group_id":     group_id,
                "sender_id":    user_id,
                "sender_name":  user_name,
                "sender_surname": user_surname,
                "message_text": message_text,
                "timestamp":    now.isoformat(),
            }

            await _publish_message(request, channel, publish_payload)
            logger.info(
                "ws.msg_published",
                msg_id=msg_id,
                group_id=group_id,
                sender=user_id,
            )

    except ConnectionClosedError as exc:
        # WebSocket bağlantısı kapandı
        logger.info("ws.disconnected", user_id=user_id, group_id=group_id, reason=str(exc))

    finally:
        # =========================================================================
        # ADIM 5: Temizlik — Bağlantı kapandığında kaynakları serbest bırak
        # =========================================================================
        try:
            await pubsub_manager.unsubscribe(channel, ws)
        except Exception as exc:
            logger.warning("ws.cleanup_error", error=str(exc))

        logger.info("ws.closed_clean", user_id=user_id, group_id=group_id)
