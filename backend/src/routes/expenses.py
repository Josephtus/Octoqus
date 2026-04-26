"""
src/routes/expenses.py
======================
Harcama Yönetimi Blueprint
/api/expenses prefix'i ile çalışır.

Endpoints:
  POST   /api/expenses/<group_id>                → Harcama ekle (multipart)
  GET    /api/expenses/<group_id>                → Aktif harcamaları listele
  DELETE /api/expenses/<group_id>/<expense_id>   → Soft delete (yalnızca ekleyen)
  GET    /api/expenses/<group_id>/debts          → Borç optimizasyonu
"""

from datetime import date, datetime, timezone
from pathlib import Path
from uuid import uuid4

import aiofiles
import structlog
from pydantic import BaseModel, ValidationError, field_validator
from sanic import Blueprint, Request
from sanic.exceptions import BadRequest, Forbidden, NotFound
from sanic.response import HTTPResponse, json as sanic_json
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from sanic_ext import openapi
from src.database import get_session
from src.models import Expense, Group, GroupMember, User, GroupMemberRole, SettlementStatus
from src.services.cash_flow import calculate_optimized_debts
from src.services.security import protected

logger = structlog.get_logger(__name__)

expenses_bp = Blueprint("expenses", url_prefix="/api/expenses")

from src.services.common import detect_mime

# ── Dosya yükleme sabitleri ────────────────────
RECEIPT_UPLOAD_DIR = Path("./uploads/receipts")
MAX_RECEIPT_SIZE   = 10 * 1024 * 1024  # 10 MB

ALLOWED_MIME_TYPES = frozenset({"image/jpeg", "image/png", "image/gif", "image/webp"})
EXTENSION_TO_MIME  = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                      ".png": "image/png",  ".gif": "image/gif",
                      ".webp": "image/webp"}

class UpdateExpenseRequest(BaseModel):
    """Kendi harcamasını güncelleme isteği (partial update)."""
    amount: float | None = None
    content: str | None = None
    date: str | None = None
    category: str | None = None
    remove_bill_photo: bool | str | None = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("Tutar pozitif olmalıdır.")
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip() or None
        return v

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str | None) -> str | None:
        if v is not None:
            try:
                date.fromisoformat(v)
            except ValueError:
                raise ValueError("Tarih YYYY-MM-DD formatında olmalıdır.")
        return v


async def _save_receipt(body: bytes, original_name: str) -> str:
    """Faturayı diske async yazar, URL yolunu döner."""
    try:
        ext = Path(original_name).suffix.lower()
        if ext not in EXTENSION_TO_MIME:
            ext = ".jpg"
        fname = f"{uuid4().hex}{ext}"
        path = RECEIPT_UPLOAD_DIR / fname
        RECEIPT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(path, "wb") as f:
            await f.write(body)
        return f"/uploads/receipts/{fname}"
    except (OSError, IOError) as exc:
        logger.error("expense.save_receipt_failed", error=str(exc))
        raise BadRequest("Fatura dosyası kaydedilemedi.")


async def _require_approved_member(session, group_id: int, user_id: int) -> GroupMember:
    """Kullanıcının grupta onaylı üye olup olmadığını doğrular, değilse 403."""
    stmt = select(GroupMember).where(
        GroupMember.group_id == group_id,
        GroupMember.user_id  == user_id,
        GroupMember.is_approved.is_(True),
    )
    member = await session.scalar(stmt)
    if not member:
        raise Forbidden("Bu grubun onaylı üyesi değilsiniz.")
    return member


async def _get_active_group(session, group_id: int) -> Group:
    stmt = select(Group).where(Group.id == group_id, Group.is_approved.is_(True))
    group = await session.scalar(stmt)
    if not group:
        raise NotFound(f"Onaylı grup bulunamadı (id={group_id}).")
    return group


def _build_expense(exp: Expense) -> dict:
    return {
        "id":            exp.id,
        "group_id":      exp.group_id,
        "added_by":      exp.added_by,
        "added_by_name": exp.added_by_user.name if exp.added_by_user else "Bilinmiyor",
        "amount":        float(exp.amount),
        "content":       exp.content,
        "bill_photo":    exp.bill_photo,
        "date":          exp.date.isoformat() if exp.date else None,
        "is_settlement": exp.is_settlement,
        "status":        exp.settlement_status.value if exp.settlement_status else None,
        "category":      exp.category,
        "created_at":    exp.created_at.isoformat() if exp.created_at else None,
        "updated_at":    exp.updated_at.isoformat() if exp.updated_at else None,
    }


# =============================================================================
# ENDPOINT 1: POST /api/expenses/<group_id> — Harcama Ekle
# =============================================================================

@expenses_bp.post("/<group_id:int>")
@protected
@openapi.summary("Gruba harcama ekle")
@openapi.description("Belirtilen gruba yeni bir harcama ekler. Resim yükleme desteği (multipart/form-data) mevcuttur.")
@openapi.parameter("group_id", int, location="path", required=True, description="Grup ID'si")
@openapi.parameter("Authorization", str, location="header", required=True, description="Bearer <token>")
@openapi.response(201, {"application/json": dict}, "Harcama başarıyla eklendi")
async def add_expense(request: Request, group_id: int) -> HTTPResponse:
    """
    Gruba yeni harcama ekler. multipart/form-data beklenir.

    Form Fields:
        amount    : float (zorunlu)
        content   : str   (opsiyonel)
        date      : str   YYYY-MM-DD (zorunlu)
        bill_photo: file  (opsiyonel)

    Kurallar:
        - Yalnızca onaylı (is_approved=True) grup üyeleri ekleyebilir.
        - Fotoğraf varsa magic byte doğrulaması yapılır.
        - Fotoğraf ./uploads/receipts/<uuid>.ext diskine yazılır.
    """
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        logger.debug("expense.add_started", group_id=group_id, user_id=user_id)
        await _get_active_group(session, group_id)
        logger.debug("expense.group_verified", group_id=group_id)
        await _require_approved_member(session, group_id, user_id)
        logger.debug("expense.member_verified", group_id=group_id)


        # ── Form alanları ──────────────────────────────────────────────────
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

        # ── Fatura fotoğrafı (opsiyonel) ──────────────────────────────────
        bill_photo_url: str | None = None
        upload = request.files.get("bill_photo")
        if upload:
            if isinstance(upload, list):
                upload = upload[0]
            body = upload.body
            name = upload.name or "receipt.jpg"

            if len(body) > MAX_RECEIPT_SIZE:
                raise BadRequest(
                    f"Fatura boyutu çok büyük. Max: {MAX_RECEIPT_SIZE // (1024*1024)} MB"
                )
            if len(body) == 0:
                raise BadRequest("Boş dosya gönderilemez.")

            ext = Path(name).suffix.lower()
            if ext not in EXTENSION_TO_MIME:
                raise BadRequest(f"Geçersiz uzantı: {ext}")

            mime = detect_mime(body)
            if not mime or mime not in ALLOWED_MIME_TYPES:
                raise BadRequest("Geçersiz dosya formatı. JPEG, PNG, GIF veya WebP gönderin.")

            bill_photo_url = await _save_receipt(body, name)

        # ── Veritabanına kaydet ────────────────────────────────────────────
        category = (form.get("category") or "").strip() or None

        expense = Expense(
            group_id   = group_id,
            added_by   = user_id,
            amount     = amount,
            content    = content,
            bill_photo = bill_photo_url,
            date       = expense_date,
            category   = category,
            is_deleted = False,
        )
        try:
            session.add(expense)
            await session.commit()
            logger.debug("expense.committed", expense_id=expense.id)
            
            # Kullanıcı bilgisini de içeren güncel harcamayı çek (Lazy-loading hatasını önlemek için)
            stmt = select(Expense).options(joinedload(Expense.added_by_user)).where(Expense.id == expense.id)
            result = await session.execute(stmt)
            expense = result.scalars().unique().one()
            logger.debug("expense.reloaded", expense_id=expense.id)

            logger.info("expense.added", expense_id=expense.id, group_id=group_id, user_id=user_id)

            return sanic_json({"message": "Harcama eklendi.", "expense": _build_expense(expense)}, status=201)
        except SQLAlchemyError as exc:
            logger.error("expense.add_db_error", error=str(exc))
            await session.rollback()
            raise BadRequest("Harcama kaydedilirken veritabanı hatası oluştu.")


# =============================================================================
# ENDPOINT 2: GET /api/expenses/<group_id> — Aktif Harcamaları Listele
# =============================================================================

@expenses_bp.get("/<group_id:int>")
@protected
@openapi.summary("Grup harcamalarını listele")
@openapi.description("Bir gruba ait silinmemiş normal harcamaları sayfalı olarak getirir.")
@openapi.parameter("group_id", int, location="path", required=True, description="Grup ID'si")
@openapi.parameter("page", int, location="query", description="Sayfa numarası (default: 1)")
@openapi.parameter("limit", int, location="query", description="Sayfa başı kayıt (default: 20)")
@openapi.parameter("Authorization", str, location="header", required=True, description="Bearer <token>")
@openapi.response(200, {"application/json": dict}, "Harcama listesi")
async def list_expenses(request: Request, group_id: int) -> HTTPResponse:
    """
    Grubun is_deleted=False olan harcamalarını listeler.
    Yalnızca onaylı üyeler görebilir.

    Query Params:
        page  (default: 1)
        limit (default: 20, max: 100)
    """
    user_id: int = int(request.ctx.user["sub"])

    try:
        page  = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 20))))
    except (ValueError, TypeError):
        page, limit = 1, 20
    offset = (page - 1) * limit

    async with get_session() as session:
        from sqlalchemy import func
        logger.debug("expenses.list_started", group_id=group_id, user_id=user_id)
        
        await _get_active_group(session, group_id)
        logger.debug("expenses.group_found", group_id=group_id)
        
        await _require_approved_member(session, group_id, user_id)
        logger.debug("expenses.member_verified", group_id=group_id)


        # Toplam sayıyı al
        count_stmt = select(func.count(Expense.id)).where(
            Expense.group_id == group_id, Expense.is_deleted.is_(False), Expense.is_settlement.is_(False)
        )
        total_count = await session.scalar(count_stmt) or 0

        logger.debug("expenses.list_request", group_id=group_id, page=page, limit=limit, total_count=total_count)

        # Filtreler: Sadece normal harcamalar
        stmt = (
            select(Expense)
            .options(joinedload(Expense.added_by_user))
            .where(
                Expense.group_id == group_id,
                Expense.is_deleted.is_(False),
                Expense.is_settlement.is_(False) # Hesaplaşmaları burada gösterme
            )
            .order_by(Expense.date.desc(), Expense.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.execute(stmt)
        expenses = list(result.scalars().unique().all())
        
        logger.debug("expenses.list_results", group_id=group_id, count=len(expenses))



        return sanic_json({
            "page":         page,
            "limit":        limit,
            "total_count":  total_count,
            "count":        len(expenses),
            "expenses":     [_build_expense(e) for e in expenses],
        }, status=200)


# =============================================================================
# ENDPOINT 3: GET /api/expenses/<group_id>/debts — Borç Optimizasyonu
# =============================================================================

@expenses_bp.get("/<group_id:int>/debts")
@protected
@openapi.summary("Borç optimizasyonunu hesapla")
@openapi.description("Gruptaki harcamalara göre kimin kime ne kadar borcu olduğunu optimize edilmiş (minimum işlem) şekilde döner.")
@openapi.parameter("group_id", int, location="path", required=True, description="Grup ID'si")
@openapi.parameter("Authorization", str, location="header", required=True, description="Bearer <token>")
@openapi.response(200, {"application/json": dict}, "Optimize edilmiş borç listesi")
async def get_debts(request: Request, group_id: int) -> HTTPResponse:
    """
    Grubun kimin kime ne kadar ödemesi gerektiğini hesaplar.
    Greedy Cash Flow Minimization algoritması kullanılır.

    Yanıt:
        {
            "group_id": 1,
            "per_person_share": 150.00,   (bilgi amaçlı)
            "transactions": [
                {"from_user_id": 3, "to_user_id": 1, "amount": 75.50},
                ...
            ]
        }
    """
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        await _get_active_group(session, group_id)
        await _require_approved_member(session, group_id, user_id)

        transactions = await calculate_optimized_debts(group_id, session)

        return sanic_json({
            "group_id":     group_id,
            "transactions": transactions,
            "tx_count":     len(transactions),
            "settled":      len(transactions) == 0,
        }, status=200)


# =============================================================================
# ENDPOINT 4: DELETE /api/expenses/<group_id>/<expense_id> — Soft Delete
# =============================================================================

@expenses_bp.delete("/<group_id:int>/<expense_id:int>")
@protected
async def delete_expense(request: Request, group_id: int, expense_id: int) -> HTTPResponse:
    """
    Harcamayı soft delete yapar (is_deleted=True, deleted_at=now).

    Kural:
        Yalnızca harcamayı ekleyen kişi silebilir.
        Admin silmesi → Admin Blueprint'inde (AuditLog ile) yapılacak.
    """
    user_id: int = int(request.ctx.user["sub"])

    async with get_session() as session:
        await _get_active_group(session, group_id)
        await _require_approved_member(session, group_id, user_id)

        stmt = (
            select(Expense)
            .options(joinedload(Expense.added_by_user))
            .where(
                Expense.id         == expense_id,
                Expense.group_id   == group_id,
                Expense.is_deleted.is_(False),
            )
        )
        expense = await session.scalar(stmt)


        if not expense:
            raise NotFound(f"Aktif harcama bulunamadı (id={expense_id}).")

        if expense.added_by != user_id:
            raise Forbidden("Bu harcamayı yalnızca ekleyen kişi silebilir.")

        # Soft delete
        expense.is_deleted = True
        expense.deleted_at = datetime.now(timezone.utc)

        logger.info("expense.soft_deleted", expense_id=expense_id, by_user=user_id)

        return sanic_json({
            "message":    "Harcama silindi.",
            "expense_id": expense_id,
        }, status=200)


# =============================================================================
# ENDPOINT 5: PUT /api/expenses/<group_id>/<expense_id> — Harcama Düzenle
# =============================================================================

@expenses_bp.put("/<group_id:int>/<expense_id:int>")
@protected
async def update_expense(request: Request, group_id: int, expense_id: int) -> HTTPResponse:
    """
    Kullanıcının kendi eklediği harcamayı güncellemesi.
    Miktar, içerik, tarih ve fatura fotoğrafı güncellenebilir.
    """
    user_id: int = int(request.ctx.user["sub"])
    
    # Multipart mı yoksa JSON mı kontrol et
    is_multipart = request.content_type and request.content_type.startswith("multipart/form-data")
    
    data_dict = {}
    if is_multipart:
        data_dict = {k: v[0] if isinstance(v, list) else v for k, v in request.form.items()}
    else:
        data_dict = request.json or {}

    try:
        data = UpdateExpenseRequest.model_validate(data_dict)
    except ValidationError as exc:
        errors = [{"field": e["loc"][0] if e["loc"] else "unknown", "message": e["msg"]} for e in exc.errors()]
        raise BadRequest(f"Validasyon hatası: {errors}")

    async with get_session() as session:
        await _get_active_group(session, group_id)
        await _require_approved_member(session, group_id, user_id)

        stmt = (
            select(Expense)
            .options(joinedload(Expense.added_by_user))
            .where(
                Expense.id == expense_id,
                Expense.group_id == group_id,
                Expense.is_deleted.is_(False),
            )
        )
        expense = await session.scalar(stmt)

        if not expense:
            raise NotFound("Harcama bulunamadı veya silinmiş.")

        if expense.added_by != user_id:
            raise Forbidden("Yalnızca kendi eklediğiniz harcamayı güncelleyebilirsiniz.")

        updated_fields = {}

        if data.amount is not None:
            expense.amount = data.amount
            updated_fields["amount"] = data.amount
        
        if data.content is not None:
            expense.content = data.content
            updated_fields["content"] = data.content
            
        if data.date is not None:
            expense.date = date.fromisoformat(data.date)
            updated_fields["date"] = data.date

        if data.category is not None:
            expense.category = data.category
            updated_fields["category"] = data.category

        # ── Fatura fotoğrafı işlemleri ──────────────────────────────────
        
        # 1. Fotoğrafı Kaldır
        remove_photo = data_dict.get("remove_bill_photo")
        if remove_photo in (True, "true", "1"):
            if expense.bill_photo:
                # Fiziksel dosyayı silmeyi deneyebiliriz (opsiyonel)
                try:
                    p = Path("." + expense.bill_photo)
                    if p.exists(): p.unlink()
                except: pass
                expense.bill_photo = None
                updated_fields["bill_photo"] = None

        # 2. Yeni Fotoğraf Yükle
        upload = request.files.get("bill_photo")
        if upload:
            if isinstance(upload, list):
                upload = upload[0]
            body = upload.body
            name = upload.name or "receipt.jpg"

            if len(body) > MAX_RECEIPT_SIZE:
                raise BadRequest(f"Fatura boyutu çok büyük. Max: {MAX_RECEIPT_SIZE // (1024*1024)} MB")
            
            ext = Path(name).suffix.lower()
            if ext not in EXTENSION_TO_MIME:
                raise BadRequest(f"Geçersiz uzantı: {ext}")

            mime = detect_mime(body)
            if not mime or mime not in ALLOWED_MIME_TYPES:
                raise BadRequest("Geçersiz dosya formatı.")

            # Eski fotoğrafı sil
            if expense.bill_photo:
                try:
                    p = Path("." + expense.bill_photo)
                    if p.exists(): p.unlink()
                except: pass

            expense.bill_photo = await _save_receipt(body, name)
            updated_fields["bill_photo"] = expense.bill_photo

        if not updated_fields:
            return sanic_json({"message": "Değişiklik yapılmadı."}, status=200)

        expense.updated_at = datetime.now(timezone.utc)

        try:
            await session.commit()
            logger.info("expense.updated", expense_id=expense_id, user_id=user_id, updated_fields=list(updated_fields.keys()))

            return sanic_json(
                {
                    "message": "Harcama başarıyla güncellendi.",
                    "expense": _build_expense(expense)
                }, 
                status=200
            )
        except SQLAlchemyError as exc:
            logger.error("expense.update_db_error", error=str(exc))
            await session.rollback()
            raise BadRequest("Harcama güncellenirken veritabanı hatası oluştu.")


# =============================================================================
# ENDPOINT 6: POST /api/expenses/<group_id>/settle — Hesaplaşma İsteği
# =============================================================================

class SettleRequest(BaseModel):
    recipient_id: int
    amount: float

@expenses_bp.post("/<group_id:int>/settle")
@protected
async def create_settlement(request: Request, group_id: int) -> HTTPResponse:
    """Borçlu kişinin alacaklıya 'ödedim' bildirimi göndermesi."""
    user_id: int = int(request.ctx.user["sub"])
    body = request.json or {}
    
    try:
        data = SettleRequest.model_validate(body)
    except ValidationError as exc:
        raise BadRequest(f"Validasyon hatası: {exc.errors()}")

    if data.amount <= 0:
        raise BadRequest("Tutar pozitif olmalıdır.")

    async with get_session() as session:
        await _get_active_group(session, group_id)
        await _require_approved_member(session, group_id, user_id)
        await _require_approved_member(session, group_id, data.recipient_id)

        # Bu bir 'Harcama' kaydı olarak sisteme girer ama tipi 'settlement'
        settlement = Expense(
            group_id=group_id,
            added_by=user_id,
            recipient_id=data.recipient_id,
            amount=data.amount,
            content=f"Borç Ödemesi (Onay Bekliyor)",
            date=datetime.now().date(),
            is_settlement=True,
            settlement_status=SettlementStatus.PENDING
        )
        session.add(settlement)
        await session.commit()
        
        return sanic_json({"message": "Ödeme bildirimi gönderildi. Onay bekleniyor."}, status=201)


# =============================================================================
# ENDPOINT 7: GET /api/expenses/<group_id>/settlements — Bekleyen Hesaplaşmalar
# =============================================================================

@expenses_bp.get("/<group_id:int>/settlements")
@protected
async def list_settlements(request: Request, group_id: int) -> HTTPResponse:
    """Gruptaki ilgili ödeme bildirimlerini listeler."""
    user_id: int = int(request.ctx.user["sub"])
    
    async with get_session() as session:
        await _get_active_group(session, group_id)
        await _require_approved_member(session, group_id, user_id)

        # Kullanıcının gönderdiği veya ona gelen bekleyen hesaplaşmalar
        stmt = (
            select(Expense)
            .options(joinedload(Expense.added_by_user), joinedload(Expense.recipient_user))
            .where(
                Expense.group_id == group_id,
                Expense.is_settlement == True,
                Expense.is_deleted == False,
                (Expense.added_by == user_id) | (Expense.recipient_id == user_id)
            )
            .order_by(Expense.created_at.desc())
        )
        result = await session.execute(stmt)
        settlements = result.scalars().unique().all()

        return sanic_json({
            "settlements": [
                {
                    "id": s.id,
                    "from_user_id": s.added_by,
                    "from_user_name": f"{s.added_by_user.name} {s.added_by_user.surname}" if s.added_by_user else "Bilinmeyen",
                    "to_user_id": s.recipient_id,
                    "to_user_name": f"{s.recipient_user.name} {s.recipient_user.surname}" if s.recipient_user else "Bilinmeyen",
                    "amount": float(s.amount),
                    "status": s.settlement_status.value if s.settlement_status else "PENDING",
                    "created_at": s.created_at.isoformat()
                } for s in settlements
            ]
        })


# =============================================================================
# ENDPOINT 8: POST /api/expenses/<group_id>/settlements/<id>/approve — Onayla
# =============================================================================

@expenses_bp.post("/<group_id:int>/settlements/<expense_id:int>/approve")
@protected
async def approve_settlement(request: Request, group_id: int, expense_id: int) -> HTTPResponse:
    """Alacaklı kişinin ödemeyi onaylaması."""
    user_id: int = int(request.ctx.user["sub"])
    
    async with get_session() as session:
        stmt = select(Expense).where(
            Expense.id == expense_id, 
            Expense.group_id == group_id,
            Expense.is_settlement == True
        )
        settlement = await session.scalar(stmt)
        
        if not settlement:
            raise NotFound("Hesaplaşma kaydı bulunamadı.")
        
        if settlement.recipient_id != user_id:
            raise Forbidden("Yalnızca alacaklı kişi bu ödemeyi onaylayabilir.")
        
        if settlement.settlement_status != SettlementStatus.PENDING:
            raise BadRequest(f"Bu işlem zaten {settlement.settlement_status.value} durumunda.")

        settlement.settlement_status = SettlementStatus.APPROVED
        settlement.content = "Borç Ödemesi (Onaylandı)"
        await session.commit()
        
        return sanic_json({"message": "Ödeme onaylandı. Borç kapatıldı."})


# =============================================================================
# ENDPOINT 9: POST /api/expenses/<group_id>/settlements/<id>/reject — Reddet
# =============================================================================

@expenses_bp.post("/<group_id:int>/settlements/<expense_id:int>/reject")
@protected
async def reject_settlement(request: Request, group_id: int, expense_id: int) -> HTTPResponse:
    """Alacaklı kişinin ödemeyi reddetmesi."""
    user_id: int = int(request.ctx.user["sub"])
    
    async with get_session() as session:
        stmt = select(Expense).where(
            Expense.id == expense_id, 
            Expense.group_id == group_id,
            Expense.is_settlement == True
        )
        settlement = await session.scalar(stmt)
        
        if not settlement:
            raise NotFound("Hesaplaşma kaydı bulunamadı.")
        
        if settlement.recipient_id != user_id:
            raise Forbidden("Yalnızca alacaklı kişi bu ödemeyi reddedebilir.")
        
        if settlement.settlement_status != SettlementStatus.PENDING:
            raise BadRequest(f"Bu işlem zaten {settlement.settlement_status.value} durumunda.")

        settlement.settlement_status = SettlementStatus.REJECTED
        settlement.content = "Borç Ödemesi (Reddedildi)"
        await session.commit()
        
        return sanic_json({"message": "Ödeme reddedildi."})
