"""
src/routes/reports.py
=====================
Şikayet (Report) Sistemi Blueprint
/api/reports prefix'i ile çalışır.

Endpoints:
  POST /api/reports/message/<message_id> → Bir mesajı şikayet et
  POST /api/reports/user/<target_user_id> → Bir kullanıcıyı şikayet et

Kurallar:
  - Sadece @protected rotalar.
  - Şikayet edilen mesajın olduğu grubun aktif üyesi olma şartı var.
  - Gövdede "aciklama" (str) parametresi zorunlu.
"""

import structlog
from pydantic import BaseModel, ValidationError, field_validator
from sanic import Blueprint, Request
from sanic.exceptions import BadRequest, Forbidden, NotFound
from sanic.response import HTTPResponse, json as sanic_json
from sqlalchemy import select

from src.database import get_session
from src.models import GroupMember, Message, Report, User
from src.services.security import protected

logger = structlog.get_logger(__name__)

reports_bp = Blueprint("reports", url_prefix="/api/reports")


# =============================================================================
# Pydantic Şemaları
# =============================================================================

class CreateReportRequest(BaseModel):
    """Şikayet oluşturma isteği."""
    aciklama: str
    category: str = "GENEL"

    @field_validator("aciklama")
    @classmethod
    def validate_aciklama(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Açıklama boş olamaz.")
        if len(v) < 10:
            raise ValueError("Açıklama çok kısa, lütfen detaylandırın (min 10 karakter).")
        return v


# =============================================================================
# ENDPOINT 0: POST /api/reports — Genel Şikayet/Geri Bildirim
# =============================================================================

@reports_bp.post("/")
@protected
async def create_general_report(request: Request) -> HTTPResponse:
    """
    Genel bir şikayet veya geri bildirim oluşturur.
    """
    body = request.json
    if not body:
        raise BadRequest("İstek gövdesi JSON formatında olmalıdır.")

    # Frontend "content" gönderiyor olabilir, "aciklama"ya çevir
    if "content" in body and "aciklama" not in body:
        body["aciklama"] = body["content"]

    try:
        data = CreateReportRequest.model_validate(body)
    except ValidationError as exc:
        raise BadRequest(f"Validasyon hatası: {exc.errors()}")

    reporter_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        new_report = Report(
            reporter_id=reporter_id,
            aciklama=data.aciklama,
            category=data.category
        )
        session.add(new_report)
        await session.flush()

        logger.info("report.general_created", report_id=new_report.id, category=data.category)

        return sanic_json(
            {"message": "Bildiriminiz başarıyla iletildi."},
            status=201
        )


@reports_bp.post("/message/<message_id:int>")
@protected
async def report_message(request: Request, message_id: int) -> HTTPResponse:
    """
    Belirtilen bir mesajı şikayet eder.
    Şikayet eden kişi, o mesajın ait olduğu grubun aktif (is_approved=True) üyesi olmalıdır.
    """
    body = request.json
    if not body:
        raise BadRequest("İstek gövdesi JSON formatında olmalıdır.")

    try:
        data = CreateReportRequest.model_validate(body)
    except ValidationError as exc:
        errors = [{"field": e["loc"][0] if e["loc"] else "unknown", "message": e["msg"]} for e in exc.errors()]
        raise BadRequest(f"Validasyon hatası: {errors}")

    reporter_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        # Mesajı ve grubunu kontrol et
        stmt_msg = select(Message).where(
            Message.id == message_id,
            Message.is_deleted.is_(False)
        )
        message = await session.scalar(stmt_msg)
        if not message:
            raise NotFound("Şikayet edilecek aktif mesaj bulunamadı.")

        if message.sender_id == reporter_id:
            raise BadRequest("Kendi mesajınızı şikayet edemezsiniz.")

        # Kullanıcı, mesajın grubunda aktif üye mi?
        stmt_member = select(GroupMember).where(
            GroupMember.group_id == message.group_id,
            GroupMember.user_id == reporter_id,
            GroupMember.is_approved.is_(True)
        )
        member = await session.scalar(stmt_member)
        if not member:
            raise Forbidden("Bu mesajı şikayet etmek için o grubun onaylı bir üyesi olmalısınız.")

        # Şikayeti oluştur
        new_report = Report(
            reporter_id=reporter_id,
            reported_message_id=message_id,
            aciklama=data.aciklama,
            category=data.category or "MESAJ"
        )
        session.add(new_report)
        await session.flush()

        logger.info(
            "report.message_created",
            report_id=new_report.id,
            reporter=reporter_id,
            reported_message=message_id
        )

        return sanic_json(
            {"message": "Mesaj şikayetiniz başarıyla alındı. Yönetim inceleyecektir."},
            status=201
        )


# =============================================================================
# ENDPOINT 2: POST /api/reports/user/<target_user_id> — Kullanıcı Şikayet Et
# =============================================================================

@reports_bp.post("/user/<target_user_id:int>")
@protected
async def report_user(request: Request, target_user_id: int) -> HTTPResponse:
    """
    Bir kullanıcıyı şikayet eder.
    Herhangi bir aktif kullanıcıyı şikayet edebilir (örneğin grup liderini).
    """
    body = request.json
    if not body:
        raise BadRequest("İstek gövdesi JSON formatında olmalıdır.")

    try:
        data = CreateReportRequest.model_validate(body)
    except ValidationError as exc:
        errors = [{"field": e["loc"][0] if e["loc"] else "unknown", "message": e["msg"]} for e in exc.errors()]
        raise BadRequest(f"Validasyon hatası: {errors}")

    reporter_id: int = int(request.ctx.user["sub"])

    if reporter_id == target_user_id:
        raise BadRequest("Kendinizi şikayet edemezsiniz.")

    async with get_session() as session:
        # Şikayet edilecek kullanıcı mevcut ve aktif mi?
        stmt_user = select(User).where(
            User.id == target_user_id,
            User.is_active.is_(True),
            User.deleted_at.is_(None)
        )
        target_user = await session.scalar(stmt_user)
        if not target_user:
            raise NotFound("Şikayet edilecek aktif kullanıcı bulunamadı.")

        # Şikayeti oluştur
        new_report = Report(
            reporter_id=reporter_id,
            reported_user_id=target_user_id,
            aciklama=data.aciklama,
            category=data.category or "KULLANICI"
        )
        session.add(new_report)
        await session.flush()

        logger.info(
            "report.user_created",
            report_id=new_report.id,
            reporter=reporter_id,
            reported_user=target_user_id
        )

        return sanic_json(
            {"message": "Kullanıcı şikayetiniz başarıyla alındı. Yönetim inceleyecektir."},
            status=201
        )
