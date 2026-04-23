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
from sanic import Blueprint, Request
from sanic.exceptions import BadRequest, Forbidden, NotFound
from sanic.response import HTTPResponse, json as sanic_json
from sqlalchemy import select

from src.database import get_session
from src.models import Expense, Group, GroupMember
from src.services.cash_flow import calculate_optimized_debts
from src.services.security import protected

logger = structlog.get_logger(__name__)

expenses_bp = Blueprint("expenses", url_prefix="/api/expenses")

# ── Dosya yükleme sabitleri (users.py ile aynı mantık) ────────────────────
RECEIPT_UPLOAD_DIR = Path("./uploads/receipts")
MAX_RECEIPT_SIZE   = 10 * 1024 * 1024  # 10 MB

ALLOWED_MIME_TYPES = frozenset({"image/jpeg", "image/png", "image/gif", "image/webp"})
EXTENSION_TO_MIME  = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                      ".png": "image/png",  ".gif": "image/gif",
                      ".webp": "image/webp"}

MAGIC_SIGNATURES = [
    (b"\xff\xd8\xff",        "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n",  "image/png"),
    (b"GIF87a",             "image/gif"),
    (b"GIF89a",             "image/gif"),
    (b"RIFF",               "image/webp"),
]


# =============================================================================
# Helpers
# =============================================================================

def _detect_mime(data: bytes) -> str | None:
    for sig, mime in MAGIC_SIGNATURES:
        if data[:len(sig)] == sig:
            if mime == "image/webp":
                return mime if len(data) >= 12 and data[8:12] == b"WEBP" else None
            return mime
    return None


async def _save_receipt(body: bytes, original_name: str) -> str:
    """Faturayı diske async yazar, URL yolunu döner."""
    ext = Path(original_name).suffix.lower()
    if ext not in EXTENSION_TO_MIME:
        ext = ".jpg"
    fname = f"{uuid4().hex}{ext}"
    path = RECEIPT_UPLOAD_DIR / fname
    RECEIPT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "wb") as f:
        await f.write(body)
    return f"/uploads/receipts/{fname}"


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
        "id":         exp.id,
        "group_id":   exp.group_id,
        "added_by":   exp.added_by,
        "amount":     float(exp.amount),
        "content":    exp.content,
        "bill_photo": exp.bill_photo,
        "date":       exp.date.isoformat() if exp.date else None,
        "created_at": exp.created_at.isoformat() if exp.created_at else None,
    }


# =============================================================================
# ENDPOINT 1: POST /api/expenses/<group_id> — Harcama Ekle
# =============================================================================

@expenses_bp.post("/<group_id:int>")
@protected
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
        await _get_active_group(session, group_id)
        await _require_approved_member(session, group_id, user_id)

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

            mime = _detect_mime(body)
            if not mime or mime not in ALLOWED_MIME_TYPES:
                raise BadRequest("Geçersiz dosya formatı. JPEG, PNG, GIF veya WebP gönderin.")

            bill_photo_url = await _save_receipt(body, name)

        # ── Veritabanına kaydet ────────────────────────────────────────────
        expense = Expense(
            group_id   = group_id,
            added_by   = user_id,
            amount     = amount,
            content    = content,
            bill_photo = bill_photo_url,
            date       = expense_date,
            is_deleted = False,
        )
        session.add(expense)
        await session.flush()

        logger.info("expense.added", expense_id=expense.id, group_id=group_id, user_id=user_id)

        return sanic_json({"message": "Harcama eklendi.", "expense": _build_expense(expense)}, status=201)


# =============================================================================
# ENDPOINT 2: GET /api/expenses/<group_id> — Aktif Harcamaları Listele
# =============================================================================

@expenses_bp.get("/<group_id:int>")
@protected
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
        await _get_active_group(session, group_id)
        await _require_approved_member(session, group_id, user_id)

        stmt = (
            select(Expense)
            .where(Expense.group_id == group_id, Expense.is_deleted.is_(False))
            .order_by(Expense.date.desc(), Expense.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        expenses = list(await session.scalars(stmt))

        return sanic_json({
            "page":     page,
            "limit":    limit,
            "count":    len(expenses),
            "expenses": [_build_expense(e) for e in expenses],
        }, status=200)


# =============================================================================
# ENDPOINT 3: GET /api/expenses/<group_id>/debts — Borç Optimizasyonu
# =============================================================================

@expenses_bp.get("/<group_id:int>/debts")
@protected
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

        stmt = select(Expense).where(
            Expense.id         == expense_id,
            Expense.group_id   == group_id,
            Expense.is_deleted.is_(False),
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
