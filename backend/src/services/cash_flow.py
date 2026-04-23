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

from src.models import Expense, GroupMember

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
    Grup için minimum sayıda işlemle tüm borçları kapatan ödeme planı.

    Returns:
        [{"from_user_id": int, "to_user_id": int, "amount": float}, ...]
    """
    # ── 1. Onaylı üyeler ───────────────────────────────────────────────────
    members = list(await session.scalars(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.is_approved.is_(True),
        )
    ))

    if len(members) < 2:
        return []

    member_ids = [m.user_id for m in members]

    # ── 2. Aktif harcamalar ────────────────────────────────────────────────
    expenses = list(await session.scalars(
        select(Expense).where(
            Expense.group_id == group_id,
            Expense.is_deleted.is_(False),
        )
    ))

    if not expenses:
        return []

    # ── 3. Kişi başı harcama & net bakiye ─────────────────────────────────
    spent_by: dict[int, Decimal] = {uid: _d(0) for uid in member_ids}
    total = _d(0)

    for exp in expenses:
        if exp.added_by in spent_by:
            amt = _d(exp.amount)
            spent_by[exp.added_by] += amt
            total += amt

    per_person = (total / _d(len(members))).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)

    logger.info(
        "cash_flow.calc",
        group_id=group_id,
        total=str(total),
        per_person=str(per_person),
        members=len(members),
    )

    # ── 4. Alacaklı / Borçlu ayırımı (max-heap) ────────────────────────────
    creditors: list[tuple[Decimal, int]] = []
    debtors: list[tuple[Decimal, int]] = []

    for uid in member_ids:
        balance = (spent_by[uid] - per_person).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)
        if balance > EPSILON:
            heapq.heappush(creditors, (-balance, uid))
        elif balance < -EPSILON:
            heapq.heappush(debtors, (balance, uid))  # zaten negatif

    # ── 5. Greedy matching ─────────────────────────────────────────────────
    transactions: list[dict[str, Any]] = []

    while creditors and debtors:
        neg_credit, cred_id = heapq.heappop(creditors)
        neg_debt, debt_id   = heapq.heappop(debtors)

        credit = -neg_credit
        debt   = -neg_debt

        payment = min(credit, debt).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)
        transactions.append({
            "from_user_id": debt_id,
            "to_user_id":   cred_id,
            "amount":       float(payment),
        })

        rem_credit = (credit - payment).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)
        rem_debt   = (debt   - payment).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)

        if rem_credit > EPSILON:
            heapq.heappush(creditors, (-rem_credit, cred_id))
        if rem_debt > EPSILON:
            heapq.heappush(debtors, (-rem_debt, debt_id))

    logger.info("cash_flow.done", group_id=group_id, tx_count=len(transactions))
    return transactions
