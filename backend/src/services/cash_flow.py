"""
src/services/cash_flow.py
=========================
Nakit Akışı Optimizasyon Algoritması — Greedy Debt Minimization

Amaç:
  Grup borçlarını minimum sayıda işlemle sıfırlamak.
  A→B→C zinciri varsa A direkt C'ye öder.

Algoritma: O(n log n) — heapq tabanlı greedy matching
"""

import heapq
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Expense, GroupMember, SettlementStatus

logger = structlog.get_logger(__name__)

_TWO_PLACES = Decimal("0.01")
EPSILON = Decimal("0.01")


def _d(value: float | int | str) -> Decimal:
    return Decimal(str(value)).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)


async def calculate_optimized_debts(
    group_id: int,
    session: AsyncSession,
) -> list[dict[str, Any]]:
    """
    Veritabanından verileri çeker ve optimize edilmiş borç planını hesaplar.
    """
    from sqlalchemy.orm import joinedload
    from src.models import User

    # 1. Verileri Çek
    stmt = (
        select(GroupMember)
        .options(joinedload(GroupMember.user))
        .where(GroupMember.group_id == group_id, GroupMember.is_approved.is_(True))
    )
    members = list(await session.scalars(stmt))
    if len(members) < 2: return []

    expenses = list(await session.scalars(
        select(Expense).where(Expense.group_id == group_id, Expense.is_deleted.is_(False))
    ))
    if not expenses: return []

    # 2. Hesaplama Mantığını Çalıştır (Pure Logic)
    member_ids = [m.user_id for m in members]
    user_names = {m.user_id: f"{m.user.name} {m.user.surname}" for m in members}
    
    return _process_cash_flow_logic(member_ids, expenses, user_names)


def _process_cash_flow_logic(
    member_ids: list[int],
    expenses: list[Expense],
    user_names: dict[int, str]
) -> list[dict[str, Any]]:
    """
    Sadece verilen listeler üzerinden borç hesaplaması yapan saf fonksiyon (Pure Function).
    Database erişimi yoktur, bu yüzden kolayca test edilebilir.
    """
    # Kişi başı harcama & net bakiye
    spent_by: dict[int, Decimal] = {uid: _d(0) for uid in member_ids}
    total_group_expense = _d(0)

    for exp in expenses:
        if exp.is_settlement:
            if exp.settlement_status == SettlementStatus.APPROVED:
                if exp.added_by in spent_by:
                    spent_by[exp.added_by] += _d(exp.amount)
                if exp.recipient_id in spent_by:
                    spent_by[exp.recipient_id] -= _d(exp.amount)
        else:
            if exp.added_by in spent_by:
                amt = _d(exp.amount)
                spent_by[exp.added_by] += amt
                total_group_expense += amt

    if not member_ids: return []
    per_person = (total_group_expense / _d(len(member_ids))).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)

    # Alacaklı / Borçlu ayırımı
    creditors: list[tuple[Decimal, int]] = []
    debtors: list[tuple[Decimal, int]] = []

    for uid in member_ids:
        balance = (spent_by[uid] - per_person).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)
        if balance > EPSILON:
            heapq.heappush(creditors, (-balance, uid))
        elif balance < -EPSILON:
            heapq.heappush(debtors, (balance, uid))

    # Greedy matching
    transactions: list[dict[str, Any]] = []
    while creditors and debtors:
        neg_credit, cred_id = heapq.heappop(creditors)
        neg_debt, debt_id   = heapq.heappop(debtors)

        credit, debt = -neg_credit, -neg_debt
        payment = min(credit, debt).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)
        
        transactions.append({
            "from_user_id": debt_id,
            "from_user_name": user_names.get(debt_id, f"User {debt_id}"),
            "to_user_id":   cred_id,
            "to_user_name":   user_names.get(cred_id, f"User {cred_id}"),
            "amount":       float(payment),
        })

        rem_credit, rem_debt = credit - payment, debt - payment
        if rem_credit > EPSILON: heapq.heappush(creditors, (-rem_credit, cred_id))
        if rem_debt > EPSILON: heapq.heappush(debtors, (-rem_debt, debt_id))

    return transactions

