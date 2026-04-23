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
from src.services.common import get_active_user, detect_mime
from src.routes.expenses import (
    ALLOWED_MIME_TYPES,
    EXTENSION_TO_MIME,
    MAX_RECEIPT_SIZE,
    _save_receipt,
)
from src.services.security import protected, role_required
from src.services.schemas import BaseUserUpdateSchema

logger = structlog.get_logger(__name__)

admin_bp = Blueprint("admin", url_prefix="/api/admin")


# =============================================================================
# Pydantic Şemaları
# =============================================================================



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
    
    # Şikayet eden bilgisi
    if report.reporter:
        resp["reporter_name"] = f"{report.reporter.name} {report.reporter.surname}"

    # Şikayet edilen mesaj bilgisi
    if report.reported_message:
        resp["message_content"] = report.reported_message.message_text
        if report.reported_message.sender:
            resp["reported_name"] = f"{report.reported_message.sender.name} {report.reported_message.sender.surname}"
    
    # Şikayet edilen kullanıcı bilgisi (eğer direkt kullanıcı şikayet edildiyse)
    elif report.reported_user:
        resp["reported_name"] = f"{report.reported_user.name} {report.reported_user.surname}"

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
# ENDPOINT 1: GET /api/admin/users — Tüm Kullanıcıları Listele
# =============================================================================

@admin_bp.get("/users")
@protected
@role_required(GlobalRole.ADMIN)
async def list_users(request: Request) -> HTTPResponse:
    """
    Sistemdeki tüm kullanıcıları detaylı bilgileriyle listeler.
    Query Params:
        q: Arama terimi (isim, soyisim, email, telefon)
    """
    search_query = request.args.get("q", "").strip()

    async with get_session() as session:
        from sqlalchemy import or_
        from sqlalchemy.orm import selectinload
        from src.models import GroupMember, GroupMemberRole, Group

        stmt = (
            select(User)
            .options(
                selectinload(User.group_memberships).selectinload(GroupMember.group)
            )
            .where(User.deleted_at.is_(None))
        )

        if search_query:
            stmt = stmt.where(
                or_(
                    User.name.ilike(f"%{search_query}%"),
                    User.surname.ilike(f"%{search_query}%"),
                    User.mail.ilike(f"%{search_query}%"),
                    User.phone_number.ilike(f"%{search_query}%")
                )
            )

        stmt = stmt.order_by(User.id.desc())
        users = list(await session.scalars(stmt))
        
        data = []
        for u in users:
            joined_groups = []
            led_groups = []
            
            for membership in u.group_memberships:
                if not membership.group:
                    continue
                    
                group_info = {
                    "id": membership.group.id,
                    "name": membership.group.name,
                    "is_approved": membership.group.is_approved
                }
                
                if membership.role == GroupMemberRole.GROUP_LEADER:
                    led_groups.append(group_info)
                else:
                    joined_groups.append(group_info)

            data.append({
                "id": u.id,
                "name": u.name,
                "surname": u.surname,
                "mail": u.mail,
                "birthday": u.birthday.isoformat() if u.birthday else None,
                "age": u.age,
                "phone_number": u.phone_number,
                "role": u.role.value,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "joined_groups": joined_groups,
                "led_groups": led_groups
            })
            
        return sanic_json({"users": data}, status=200)


# =============================================================================
# ENDPOINT 1.5: PUT /api/admin/users/<user_id>/status — Engelle/Kaldır
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

@admin_bp.post("/groups/<group_id:int>/approve")
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

        # Gruptaki lider(ler)in üyeliğini de onaylı duruma getir (zaten öyle olmalı ama garantiye alalım)
        from src.models import GroupMember, GroupMemberRole
        stmt_leader = select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.role == GroupMemberRole.GROUP_LEADER
        )
        leaders = await session.scalars(stmt_leader)
        for leader in leaders:
            leader.is_approved = True

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
# ENDPOINT 2.5: GET /api/admin/groups — Tüm Grupları Listele
# =============================================================================

@admin_bp.get("/groups")
@protected
@role_required(GlobalRole.ADMIN)
async def list_groups(request: Request) -> HTTPResponse:
    """Sistemdeki tüm grupları (onaylı ve onay bekleyen) listeler."""
    async with get_session() as session:
        from sqlalchemy import func
        # Grup ve üye sayısını birlikte çek
        stmt = (
            select(Group, func.count(GroupMember.id).label("member_count"))
            .outerjoin(GroupMember, GroupMember.group_id == Group.id)
            .group_by(Group.id)
            .order_by(Group.created_at.desc())
        )
        results = await session.execute(stmt)
        
        data = []
        for group, member_count in results:
            data.append({
                "id": group.id,
                "name": group.name,
                "content": group.content,
                "is_approved": group.is_approved,
                "created_at": group.created_at.isoformat() if group.created_at else None,
                "member_count": member_count
            })
            
        return sanic_json({"groups": data}, status=200)


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
                selectinload(Report.reporter),
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
                "reports": [_build_report_response(r) for r in reports],
            },
            status=200,
        )


# =============================================================================
# ENDPOINT 5.5: PUT /api/admin/reports/<report_id>/status — Şikayet Durumu Güncelle
# =============================================================================

@admin_bp.put("/reports/<report_id:int>/status")
@protected
@role_required(GlobalRole.ADMIN)
async def update_report_status(request: Request, report_id: int) -> HTTPResponse:
    """Şikayeti çözüldü (resolved), reddedildi (dismissed) veya incelendi (reviewed) olarak işaretler."""
    admin_id: int = int(request.ctx.user["sub"])
    body = request.json or {}
    new_status = body.get("status")

    if new_status not in [s.value for s in ReportStatus]:
        raise BadRequest(f"Geçersiz durum. Geçerli durumlar: {', '.join([s.value for s in ReportStatus])}")

    async with get_session() as session:
        stmt = select(Report).where(Report.id == report_id)
        report = await session.scalar(stmt)

        if not report:
            raise NotFound("Şikayet bulunamadı.")

        report.status = ReportStatus(new_status)
        
        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="REPORT_STATUS_UPDATE",
            content={"report_id": report_id, "new_status": new_status}
        )

        logger.info("admin.report_updated", admin_id=admin_id, report_id=report_id, status=new_status)

        return sanic_json({"message": f"Şikayet durumu '{new_status}' olarak güncellendi."}, status=200)


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
                "logs": [_build_audit_log_response(log) for log in logs],
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

            mime = detect_mime(body)
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

    try:
        data = BaseUserUpdateSchema.model_validate(body)
    except ValidationError as exc:
        raise BadRequest(f"Validasyon hatası: {exc.errors()}")

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
            .order_by(Message.timestamp.desc())
            .offset(offset)
            .limit(limit)
        )
        messages = list(await session.scalars(stmt))

        data = []
        for msg in messages:
            item = {
                "id": msg.id,
                "content": msg.message_text,
                "created_at": msg.timestamp.isoformat() if msg.timestamp else None,
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
# =============================================================================
# ENDPOINT 14: POST /api/admin/groups — Admin Doğrudan Grup Oluşturma
# =============================================================================

@admin_bp.post("/groups")
@protected
@role_required(GlobalRole.ADMIN)
async def admin_create_group(request: Request) -> HTTPResponse:
    """Admin tarafından doğrudan onaylı grup oluşturur."""
    admin_id: int = int(request.ctx.user["sub"])
    body = request.json
    if not body or "name" not in body:
        raise BadRequest("Grup ismi zorunludur.")

    async with get_session() as session:
        new_group = Group(
            name=body["name"],
            content=body.get("content"),
            is_approved=True # Admin oluşturduğu için direkt onaylı
        )
        session.add(new_group)
        await session.flush()

        # Admini de gruba leader olarak ekleyelim (isteğe bağlı ama takip için iyi)
        from src.models import GroupMember, GroupMemberRole
        leader_membership = GroupMember(
            user_id=admin_id,
            group_id=new_group.id,
            role=GroupMemberRole.GROUP_LEADER,
            is_approved=True
        )
        session.add(leader_membership)
        
        await session.commit()
        await session.refresh(new_group)

        # Audit Log
        await _create_audit_log(
            session,
            admin_id=admin_id,
            process="ADMIN_GROUP_CREATE",
            content={"group_id": new_group.id, "name": new_group.name}
        )

        return sanic_json({
            "message": "Grup admin tarafından oluşturuldu.",
            "group": {
                "id": new_group.id,
                "name": new_group.name,
                "is_approved": True
            }
        }, status=201)


# =============================================================================
# ENDPOINT 16: GET /api/admin/groups/<group_id>/members — Grup Üyelerini Listele
# =============================================================================

@admin_bp.get("/groups/<group_id:int>/members")
@protected
@role_required(GlobalRole.ADMIN)
async def admin_get_group_members(request: Request, group_id: int) -> HTTPResponse:
    """Grubun tüm üyelerini listeler."""
    async with get_session() as session:
        stmt = (
            select(GroupMember)
            .where(GroupMember.group_id == group_id)
            .options(selectinload(GroupMember.user))
            .order_by(GroupMember.role.desc(), GroupMember.joined_at.asc())
        )
        memberships = list(await session.scalars(stmt))

        data = []
        for m in memberships:
            item = {
                "id": m.id,
                "user_id": m.user_id,
                "role": m.role.value,
                "is_approved": m.is_approved,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            }
            if m.user:
                item["user"] = {
                    "name": m.user.name,
                    "surname": m.user.surname,
                    "mail": m.user.mail
                }
            data.append(item)

        return sanic_json({"members": data}, status=200)


# =============================================================================
# ENDPOINT 17: GET /api/admin/users/<user_id>/details — Kullanıcı Detayları
# =============================================================================

@admin_bp.get("/users/<user_id:int>/details")
@protected
@role_required(GlobalRole.ADMIN)
async def get_user_details(request: Request, user_id: int) -> HTTPResponse:
    """
    Belirtilen kullanıcının tüm geçmişini (mesajlar, gruplar, tarihler) getirir.
    """
    async with get_session() as session:
        from sqlalchemy.orm import selectinload
        from src.models import Message, GroupMember, Group

        stmt = (
            select(User)
            .options(
                selectinload(User.group_memberships).selectinload(GroupMember.group),
                selectinload(User.messages_sent).selectinload(Message.group)
            )
            .where(User.id == user_id, User.deleted_at.is_(None))
        )
        user = await session.scalar(stmt)
        if not user:
            raise NotFound("Kullanıcı bulunamadı.")

        # Mesaj geçmişi (en yeniden eskiye)
        messages = [{
            "id": m.id,
            "group_id": m.group_id,
            "group_name": m.group.name if m.group else "Silinmiş Grup",
            "message_text": m.message_text,
            "timestamp": m.timestamp.isoformat() if m.timestamp else None,
            "is_deleted": m.is_deleted
        } for m in sorted(user.messages_sent, key=lambda x: x.timestamp or datetime.min, reverse=True)]

        # Grup üyelikleri
        memberships = [{
            "group_id": m.group_id,
            "group_name": m.group.name if m.group else "Silinmiş Grup",
            "role": m.role.value,
            "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            "is_approved": m.is_approved
        } for m in user.group_memberships]

        return sanic_json({
            "user": {
                "id": user.id,
                "name": user.name,
                "surname": user.surname,
                "mail": user.mail,
                "phone_number": user.phone_number,
                "birthday": user.birthday.isoformat() if user.birthday else None,
                "age": user.age,
                "role": user.role.value,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            },
            "messages": messages,
            "memberships": memberships
        }, status=200)
