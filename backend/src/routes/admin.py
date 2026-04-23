"""
src/routes/admin.py
===================
Admin Paneli ve Denetim İzi (Audit Log) Blueprint
/api/admin prefix'i ile çalışır.

Endpoints:
  PUT    /api/admin/users/<user_id>/status              → Kullanıcıyı engelle/kaldır
  PUT    /api/admin/groups/<group_id>/approve           → Grubu onayla
  DELETE /api/admin/messages/<message_id>               → Mesajı soft-delete yap
  DELETE /api/admin/expenses/<group_id>/<expense_id>    → Harcamayı soft-delete yap
  GET    /api/admin/reports                             → Şikayetleri listele
  GET    /api/admin/audit-logs                          → Denetim izlerini listele

Kurallar:
  - Tüm rotalar @protected ve @role_required(GlobalRole.ADMIN) ile korunur.
  - Veriyi değiştiren her işlem (PUT, DELETE) AuditLog tablosuna kaydedilir.
"""

import json
from datetime import date, datetime, timezone
from pathlib import Path

import structlog
from pydantic import BaseModel, ValidationError, field_validator
from sanic import Blueprint, Request
from sanic.exceptions import BadRequest, NotFound
from sanic.response import HTTPResponse, json as sanic_json
from sqlalchemy import select, case
from sqlalchemy.orm import selectinload

from src.database import get_session
from src.models import (
    AuditLog,
    Expense,
    GlobalRole,
    Group,
    GroupMember,
    Message,
    Report,
    ReportStatus,
    User,
)
from src.routes.expenses import (
    ALLOWED_MIME_TYPES,
    EXTENSION_TO_MIME,
    MAX_RECEIPT_SIZE,
    _detect_mime,
    _save_receipt,
)
from src.services.security import protected, role_required

logger = structlog.get_logger(__name__)

admin_bp = Blueprint("admin", url_prefix="/api/admin")


# =============================================================================
# Pydantic Şemaları
# =============================================================================

class AdminUpdateUserRequest(BaseModel):
    name: str | None = None
    surname: str | None = None
    age: int | None = None
    phone_number: str | None = None
    birthday: str | None = None

    @field_validator("name", "surname")
    @classmethod
    def strip_and_check_empty(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Bu alan boş olamaz.")
            if len(v) > 100:
                raise ValueError("Bu alan en fazla 100 karakter olabilir.")
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
    def validate_birthday(cls, v: str | None) -> str | None:
        if v is not None:
            try:
                date.fromisoformat(v)
            except ValueError:
                raise ValueError("Doğum tarihi YYYY-MM-DD formatında olmalıdır.")
        return v


# =============================================================================
# Helpers
# =============================================================================

async def _create_audit_log(
    session, admin_id: int, process: str, content: dict | str
) -> None:
    """Verilen işlem için AuditLog tablosuna kayıt ekler."""
    if isinstance(content, dict):
        content_str = json.dumps(content, ensure_ascii=False)
    else:
        content_str = str(content)

    log_entry = AuditLog(
        admin_id=admin_id,
        process_performed=process,
        content=content_str,
    )
    session.add(log_entry)
    # session flush / commit işlemi ana akış tarafından yönetilecek


def _build_report_response(report: Report) -> dict:
    resp = {
        "id": report.id,
        "reporter_id": report.reporter_id,
        "reported_message_id": report.reported_message_id,
        "reported_user_id": report.reported_user_id,
        "aciklama": report.aciklama,
        "status": report.status.value,
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }
    
    # Eager load edilmişse ekle
    try:
        if report.reported_message:
            msg = report.reported_message
            resp["reported_message"] = {
                "id": msg.id,
                "content": msg.content,
                "is_deleted": msg.is_deleted,
            }
            try:
                if msg.sender:
                    resp["reported_message"]["sender"] = {
                        "id": msg.sender.id,
                        "name": msg.sender.name,
                        "surname": msg.sender.surname
                    }
            except Exception:
                pass
    except Exception:
        pass

    try:
        if report.reported_user:
            usr = report.reported_user
            resp["reported_user"] = {
                "id": usr.id,
                "name": usr.name,
                "surname": usr.surname,
                "mail": usr.mail
            }
    except Exception:
        pass

    return resp


def _build_audit_log_response(log: AuditLog) -> dict:
    return {
        "id": log.id,
        "admin_id": log.admin_id,
        "process_performed": log.process_performed,
        "content": log.content,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
    }


# =============================================================================
# ENDPOINT 1: PUT /api/admin/users/<user_id>/status — Engelle/Kaldır
# =============================================================================

@admin_bp.put("/users/<user_id:int>/status")
@protected
@role_required(GlobalRole.ADMIN)
async def toggle_user_status(request: Request, user_id: int) -> HTTPResponse:
    """
    Kullanıcının is_active durumunu tersine çevirir (engelle / engeli kaldır).
    Kendini engellemeye izin verilmez.
    """
    admin_id: int = int(request.ctx.user["sub"])

    if admin_id == user_id:
        raise BadRequest("Kendi hesabınızın durumunu değiştiremezsiniz.")

    async with get_session() as session:
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        user = await session.scalar(stmt)

        if not user:
            raise NotFound(f"Kullanıcı bulunamadı (id={user_id}).")

        # Durumu tersine çevir
        user.is_active = not user.is_active
        new_status = "ACTIVE" if user.is_active else "BLOCKED"

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="USER_STATUS_TOGGLE",
            content={"user_id": user_id, "new_status": new_status},
        )

        logger.info(
            "admin.user_status_changed",
            admin_id=admin_id,
            target_user=user_id,
            new_status=new_status,
        )

        return sanic_json(
            {
                "message": f"Kullanıcı durumu güncellendi: {new_status}",
                "user_id": user_id,
                "is_active": user.is_active,
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 2: PUT /api/admin/groups/<group_id>/approve — Grup Onayla
# =============================================================================

@admin_bp.put("/groups/<group_id:int>/approve")
@protected
@role_required(GlobalRole.ADMIN)
async def approve_group(request: Request, group_id: int) -> HTTPResponse:
    """
    Kullanıcıların oluşturduğu grubu onaylar (is_approved=True).
    Zaten onaylıysa hata dönmez, 200 döner (idempotency).
    """
    admin_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = select(Group).where(Group.id == group_id)
        group = await session.scalar(stmt)

        if not group:
            raise NotFound(f"Grup bulunamadı (id={group_id}).")

        if group.is_approved:
            return sanic_json({"message": "Grup zaten onaylı."}, status=200)

        group.is_approved = True

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="GROUP_APPROVE",
            content={"group_id": group_id, "group_name": group.name},
        )

        logger.info("admin.group_approved", admin_id=admin_id, group_id=group_id)

        return sanic_json(
            {"message": f"Grup (id={group_id}) başarıyla onaylandı."},
            status=200,
        )


# =============================================================================
# ENDPOINT 3: DELETE /api/admin/messages/<message_id> — Mesaj Sil
# =============================================================================

@admin_bp.delete("/messages/<message_id:int>")
@protected
@role_required(GlobalRole.ADMIN)
async def delete_message(request: Request, message_id: int) -> HTTPResponse:
    """
    Grup mesajını moderasyon amacıyla soft-delete yapar.
    Ayrıca bu mesajı içeren pending şikayetleri çözüldü olarak işaretler.
    """
    admin_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = select(Message).where(
            Message.id == message_id, Message.is_deleted.is_(False)
        )
        message = await session.scalar(stmt)

        if not message:
            raise NotFound("Mesaj bulunamadı veya zaten silinmiş.")

        # Soft delete
        message.is_deleted = True
        message.deleted_at = datetime.now(timezone.utc)

        # İlgili şikayetleri otomatik RESOLVED yap (opsiyonel kolaylık)
        stmt_reports = select(Report).where(
            Report.reported_message_id == message_id,
            Report.status == ReportStatus.PENDING,
        )
        reports = await session.scalars(stmt_reports)
        for rep in reports:
            rep.status = ReportStatus.RESOLVED

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="MESSAGE_DELETE",
            content={"message_id": message_id, "group_id": message.group_id},
        )

        logger.info(
            "admin.message_deleted", admin_id=admin_id, message_id=message_id
        )

        return sanic_json({"message": "Mesaj başarıyla silindi."}, status=200)


# =============================================================================
# ENDPOINT 4: DELETE /api/admin/expenses/<group_id>/<expense_id> — Harcama Sil
# =============================================================================

@admin_bp.delete("/expenses/<group_id:int>/<expense_id:int>")
@protected
@role_required(GlobalRole.ADMIN)
async def delete_expense(
    request: Request, group_id: int, expense_id: int
) -> HTTPResponse:
    """
    Grubun hatalı bir harcamasını soft-delete yapar.
    """
    admin_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = select(Expense).where(
            Expense.id == expense_id,
            Expense.group_id == group_id,
            Expense.is_deleted.is_(False),
        )
        expense = await session.scalar(stmt)

        if not expense:
            raise NotFound("Harcama bulunamadı veya zaten silinmiş.")

        # Soft delete
        expense.is_deleted = True
        expense.deleted_at = datetime.now(timezone.utc)

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="EXPENSE_DELETE",
            content={
                "expense_id": expense_id,
                "group_id": group_id,
                "amount": float(expense.amount),
            },
        )

        logger.info(
            "admin.expense_deleted", admin_id=admin_id, expense_id=expense_id
        )

        return sanic_json({"message": "Harcama başarıyla silindi."}, status=200)


# =============================================================================
# ENDPOINT 5: GET /api/admin/reports — Şikayetleri Listele
# =============================================================================

@admin_bp.get("/reports")
@protected
@role_required(GlobalRole.ADMIN)
async def list_reports(request: Request) -> HTTPResponse:
    """
    Sistemdeki şikayetleri listeler.
    status=PENDING olanlar en üstte çıkacak şekilde sıralanır.
    """
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 20))))
    except (ValueError, TypeError):
        page, limit = 1, 20

    offset = (page - 1) * limit

    async with get_session() as session:
        # PENDING olanları öncelikli getir, ardından creation date desc
        stmt = (
            select(Report)
            .options(
                selectinload(Report.reported_message).selectinload(Message.sender),
                selectinload(Report.reported_user)
            )
            .order_by(
                case(
                    (Report.status == ReportStatus.PENDING, 0),
                    else_=1
                ),
                Report.created_at.desc()
            )
            .offset(offset)
            .limit(limit)
        )
        reports = list(await session.scalars(stmt))

        return sanic_json(
            {
                "page": page,
                "limit": limit,
                "count": len(reports),
                "data": [_build_report_response(r) for r in reports],
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 6: GET /api/admin/audit-logs — Denetim İzlerini Listele
# =============================================================================

@admin_bp.get("/audit-logs")
@protected
@role_required(GlobalRole.ADMIN)
async def list_audit_logs(request: Request) -> HTTPResponse:
    """
    AuditLog tablosundaki kayıtları listeler.
    En yeniden en eskiye (timestamp desc) sıralanır.
    """
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(200, max(1, int(request.args.get("limit", 50))))
    except (ValueError, TypeError):
        page, limit = 1, 50

    offset = (page - 1) * limit

    async with get_session() as session:
        stmt = (
            select(AuditLog)
            .order_by(AuditLog.timestamp.desc())
            .offset(offset)
            .limit(limit)
        )
        logs = list(await session.scalars(stmt))

        return sanic_json(
            {
                "page": page,
                "limit": limit,
                "count": len(logs),
                "data": [_build_audit_log_response(log) for log in logs],
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 7: POST /api/admin/expenses/<group_id>/on-behalf/<target_user_id>
# =============================================================================

@admin_bp.post("/expenses/<group_id:int>/on-behalf/<target_user_id:int>")
@protected
@role_required(GlobalRole.ADMIN)
async def add_expense_on_behalf(
    request: Request, group_id: int, target_user_id: int
) -> HTTPResponse:
    """
    Adminin, belirtilen kullanıcı adına harcama eklemesi.
    Hedef kullanıcının grupta onaylı üye olması gerekir.
    """
    admin_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        # Grup onaylı mı?
        stmt_group = select(Group).where(Group.id == group_id, Group.is_approved.is_(True))
        group = await session.scalar(stmt_group)
        if not group:
            raise NotFound(f"Onaylı grup bulunamadı (id={group_id}).")

        # Hedef kullanıcı grubun onaylı üyesi mi?
        stmt_member = select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == target_user_id,
            GroupMember.is_approved.is_(True),
        )
        member = await session.scalar(stmt_member)
        if not member:
            raise BadRequest("Hedef kullanıcı bu grubun onaylı üyesi değil.")

        # Form alanlarını al
        form = request.form
        if not form:
            raise BadRequest("multipart/form-data formatında gönderilmeli.")

        # amount
        raw_amount = form.get("amount")
        if not raw_amount:
            raise BadRequest("'amount' alanı zorunludur.")
        try:
            amount = float(raw_amount)
            if amount <= 0:
                raise ValueError
        except ValueError:
            raise BadRequest("'amount' pozitif bir sayı olmalıdır.")

        # date
        raw_date = form.get("date")
        if not raw_date:
            raise BadRequest("'date' alanı zorunludur (YYYY-MM-DD).")
        try:
            expense_date = date.fromisoformat(raw_date)
        except ValueError:
            raise BadRequest("'date' YYYY-MM-DD formatında olmalıdır.")

        content = (form.get("content") or "").strip() or None

        # Fatura fotoğrafı
        bill_photo_url: str | None = None
        upload = request.files.get("bill_photo")
        if upload:
            if isinstance(upload, list):
                upload = upload[0]
            body = upload.body
            name = upload.name or "receipt.jpg"

            if len(body) > MAX_RECEIPT_SIZE:
                raise BadRequest(f"Fatura boyutu çok büyük. Max: {MAX_RECEIPT_SIZE // (1024*1024)} MB")
            if len(body) == 0:
                raise BadRequest("Boş dosya gönderilemez.")

            ext = Path(name).suffix.lower()
            if ext not in EXTENSION_TO_MIME:
                raise BadRequest(f"Geçersiz uzantı: {ext}")

            mime = _detect_mime(body)
            if not mime or mime not in ALLOWED_MIME_TYPES:
                raise BadRequest("Geçersiz dosya formatı. JPEG, PNG, GIF veya WebP gönderin.")

            bill_photo_url = await _save_receipt(body, name)

        # Veritabanına kaydet
        expense = Expense(
            group_id=group_id,
            added_by=target_user_id,
            amount=amount,
            content=content,
            bill_photo=bill_photo_url,
            date=expense_date,
            is_deleted=False,
        )
        session.add(expense)
        await session.flush()

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="EXPENSE_ADD_ON_BEHALF",
            content={
                "expense_id": expense.id,
                "group_id": group_id,
                "target_user_id": target_user_id,
                "amount": amount,
            },
        )

        logger.info(
            "admin.expense_added_on_behalf",
            admin_id=admin_id,
            group_id=group_id,
            target_user=target_user_id,
            expense_id=expense.id,
        )

        return sanic_json(
            {
                "message": f"Harcama (Kullanıcı {target_user_id} adına) başarıyla eklendi.",
                "expense_id": expense.id,
            },
            status=201,
        )


# =============================================================================
# ENDPOINT 8: PUT /api/admin/expenses/<group_id>/<expense_id>
# =============================================================================

@admin_bp.put("/expenses/<group_id:int>/<expense_id:int>")
@protected
@role_required(GlobalRole.ADMIN)
async def update_expense(
    request: Request, group_id: int, expense_id: int
) -> HTTPResponse:
    """
    Adminin mevcut bir harcamayı güncellemesi (Partial update).
    """
    admin_id: int = int(request.ctx.user["sub"])
    body = request.json or {}

    if not body:
        raise BadRequest("Güncellenecek alanlar (JSON formatında) gereklidir.")

    async with get_session() as session:
        stmt = select(Expense).where(
            Expense.id == expense_id,
            Expense.group_id == group_id,
            Expense.is_deleted.is_(False),
        )
        expense = await session.scalar(stmt)

        if not expense:
            raise NotFound("Harcama bulunamadı veya silinmiş.")

        # Eski değerleri sakla
        old_values = {
            "amount": float(expense.amount),
            "content": expense.content,
            "date": expense.date.isoformat() if expense.date else None,
        }
        new_values = {}

        # amount
        if "amount" in body:
            try:
                new_amt = float(body["amount"])
                if new_amt <= 0:
                    raise ValueError
                expense.amount = new_amt
                new_values["amount"] = new_amt
            except (ValueError, TypeError):
                raise BadRequest("'amount' pozitif bir sayı olmalıdır.")

        # content
        if "content" in body:
            new_content = (body["content"] or "").strip() or None
            expense.content = new_content
            new_values["content"] = new_content

        # date
        if "date" in body:
            try:
                new_date = date.fromisoformat(body["date"])
                expense.date = new_date
                new_values["date"] = body["date"]
            except (ValueError, TypeError):
                raise BadRequest("'date' YYYY-MM-DD formatında olmalıdır.")

        if not new_values:
            return sanic_json({"message": "Değişiklik yapılmadı."}, status=200)

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="EXPENSE_UPDATE",
            content={
                "expense_id": expense_id,
                "group_id": group_id,
                "old_values": old_values,
                "new_values": new_values,
            },
        )

        logger.info(
            "admin.expense_updated",
            admin_id=admin_id,
            expense_id=expense_id,
            updated_fields=list(new_values.keys()),
        )

        return sanic_json(
            {
                "message": "Harcama başarıyla güncellendi.",
                "updated_fields": new_values,
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 9: PUT /api/admin/users/<user_id>
# =============================================================================

@admin_bp.put("/users/<user_id:int>")
@protected
@role_required(GlobalRole.ADMIN)
async def admin_update_user(request: Request, user_id: int) -> HTTPResponse:
    """
    Adminin, kullanıcının profil bilgilerini doğrudan güncellemesi.
    """
    admin_id: int = int(request.ctx.user["sub"])
    body = request.json or {}

    if not body:
        raise BadRequest("Güncellenecek alanlar (JSON formatında) gereklidir.")

    try:
        data = AdminUpdateUserRequest.model_validate(body)
    except ValidationError as exc:
        errors = [{"field": e["loc"][0] if e["loc"] else "unknown", "message": e["msg"]} for e in exc.errors()]
        raise BadRequest(f"Validasyon hatası: {errors}")

    async with get_session() as session:
        stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
        user = await session.scalar(stmt)

        if not user:
            raise NotFound("Kullanıcı bulunamadı veya silinmiş.")

        old_values = {
            "name": user.name,
            "surname": user.surname,
            "age": user.age,
            "phone_number": user.phone_number,
            "birthday": user.birthday.isoformat() if user.birthday else None,
        }
        new_values = {}

        if data.name is not None:
            user.name = data.name
            new_values["name"] = data.name
        if data.surname is not None:
            user.surname = data.surname
            new_values["surname"] = data.surname
        if data.age is not None:
            user.age = data.age
            new_values["age"] = data.age
        if data.phone_number is not None:
            user.phone_number = data.phone_number
            new_values["phone_number"] = data.phone_number
        if data.birthday is not None:
            user.birthday = date.fromisoformat(data.birthday)
            new_values["birthday"] = data.birthday

        if not new_values:
            return sanic_json({"message": "Değişiklik yapılmadı."}, status=200)

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="ADMIN_UPDATE_USER",
            content={
                "target_user_id": user_id,
                "old_values": old_values,
                "new_values": new_values,
            },
        )

        logger.info(
            "admin.user_updated",
            admin_id=admin_id,
            target_user=user_id,
            updated_fields=list(new_values.keys())
        )

        return sanic_json(
            {
                "message": "Kullanıcı başarıyla güncellendi.",
                "updated_fields": new_values,
            },
            status=200
        )


# =============================================================================
# ENDPOINT 10: POST /api/admin/groups/<group_id>/members/<target_user_id>
# =============================================================================

@admin_bp.post("/groups/<group_id:int>/members/<target_user_id:int>")
@protected
@role_required(GlobalRole.ADMIN)
async def admin_force_add_member(request: Request, group_id: int, target_user_id: int) -> HTTPResponse:
    """
    Adminin bir kullanıcıyı istediği bir gruba zorla eklemesi veya 
    bekleyen isteğini zorla onaylaması.
    role=USER, is_approved=True olarak kaydedilir.
    """
    admin_id: int = int(request.ctx.user["sub"])

    from src.models import GroupMemberRole # Import here to avoid circular dependencies if any, or it's already imported? Wait, GroupMemberRole is not imported in admin.py. I will add it to the import block above or use it as imported. Ah, let's just import it locally.
    from src.models import GroupMemberRole

    async with get_session() as session:
        # Grup var mı?
        stmt_group = select(Group).where(Group.id == group_id)
        group = await session.scalar(stmt_group)
        if not group:
            raise NotFound("Grup bulunamadı.")

        # Kullanıcı aktif ve mevcut mu?
        stmt_user = select(User).where(User.id == target_user_id, User.deleted_at.is_(None))
        user = await session.scalar(stmt_user)
        if not user or not user.is_active:
            raise NotFound("Aktif bir hedef kullanıcı bulunamadı.")

        from src.models import GroupMember
        stmt_member = select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == target_user_id
        )
        membership = await session.scalar(stmt_member)

        if membership:
            if membership.is_approved:
                raise BadRequest("Bu kullanıcı zaten grubun onaylı bir üyesi.")
            else:
                membership.is_approved = True
        else:
            new_membership = GroupMember(
                user_id=target_user_id,
                group_id=group_id,
                role=GroupMemberRole.USER,
                is_approved=True
            )
            session.add(new_membership)

        await session.flush()

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="ADMIN_FORCE_ADD_MEMBER",
            content={
                "group_id": group_id,
                "target_user_id": target_user_id
            },
        )

        logger.info(
            "admin.force_add_member",
            admin_id=admin_id,
            group_id=group_id,
            target_user=target_user_id
        )

        return sanic_json(
            {"message": f"Kullanıcı (id={target_user_id}) gruba zorla eklendi/onaylandı."},
            status=201
        )


# =============================================================================
# ENDPOINT 11: DELETE /api/admin/groups/<group_id>
# =============================================================================

@admin_bp.delete("/groups/<group_id:int>")
@protected
@role_required(GlobalRole.ADMIN)
async def admin_delete_group(request: Request, group_id: int) -> HTTPResponse:
    """
    Adminin bir grubu veritabanından kalıcı olarak silmesi (Cascade delete).
    """
    admin_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        stmt = select(Group).where(Group.id == group_id)
        group = await session.scalar(stmt)

        if not group:
            raise NotFound("Grup bulunamadı.")

        group_name = group.name

        # Cascade ile sil
        await session.delete(group)
        await session.flush()

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="ADMIN_DELETE_GROUP",
            content={"group_id": group_id, "group_name": group_name},
        )

        logger.info(
            "admin.group_deleted",
            admin_id=admin_id,
            group_id=group_id,
            group_name=group_name
        )

        return sanic_json(
            {"message": f"Grup '{group_name}' başarıyla silindi."},
            status=200
        )


# =============================================================================
# ENDPOINT 12: GET /api/admin/groups/<group_id>/messages
# =============================================================================

@admin_bp.get("/groups/<group_id:int>/messages")
@protected
@role_required(GlobalRole.ADMIN)
async def admin_get_group_messages(request: Request, group_id: int) -> HTTPResponse:
    """
    Grubun aktif mesajlarını listeler. 
    selectinload ile gönderen (sender) bilgisi dahil edilir.
    """
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 50))))
    except (ValueError, TypeError):
        page, limit = 1, 50

    offset = (page - 1) * limit

    async with get_session() as session:
        stmt = (
            select(Message)
            .where(Message.group_id == group_id, Message.is_deleted.is_(False))
            .options(selectinload(Message.sender))
            .order_by(Message.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        messages = list(await session.scalars(stmt))

        data = []
        for msg in messages:
            item = {
                "id": msg.id,
                "content": msg.content,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            }
            if msg.sender:
                item["sender"] = {
                    "id": msg.sender.id,
                    "name": msg.sender.name,
                    "surname": msg.sender.surname
                }
            data.append(item)

        return sanic_json(
            {
                "page": page,
                "limit": limit,
                "count": len(data),
                "data": data,
            },
            status=200
        )


# =============================================================================
# ENDPOINT 13: GET /api/admin/groups/<group_id>/expenses
# =============================================================================

@admin_bp.get("/groups/<group_id:int>/expenses")
@protected
@role_required(GlobalRole.ADMIN)
async def admin_get_group_expenses(request: Request, group_id: int) -> HTTPResponse:
    """
    Grubun aktif harcamalarını listeler.
    selectinload ile ekleyen bilgisi (added_by_user) dahil edilir.
    """
    async with get_session() as session:
        stmt = (
            select(Expense)
            .where(Expense.group_id == group_id, Expense.is_deleted.is_(False))
            .options(selectinload(Expense.added_by_user))
            .order_by(Expense.date.desc(), Expense.created_at.desc())
        )
        expenses = list(await session.scalars(stmt))

        data = []
        for exp in expenses:
            item = {
                "id": exp.id,
                "amount": float(exp.amount),
                "content": exp.content,
                "date": exp.date.isoformat() if exp.date else None,
                "bill_photo": exp.bill_photo,
            }
            if exp.added_by_user:
                item["added_by"] = {
                    "id": exp.added_by_user.id,
                    "name": exp.added_by_user.name,
                    "surname": exp.added_by_user.surname
                }
            data.append(item)

        return sanic_json(
            {
                "count": len(data),
                "data": data,
            },
            status=200
        )
