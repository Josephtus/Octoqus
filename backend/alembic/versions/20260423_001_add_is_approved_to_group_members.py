# -*- coding: utf-8 -*-
"""Alembic Migration: add is_approved to group_members

Revision ID: 20260423_001
Revises: (başlangıç — önceki revision yoksa boş bırakılır)
Create Date: 2026-04-23

Açıklama:
    GroupMember tablosuna `is_approved` (Boolean, default=False) sütunu eklendi.
    Bu sütun grup katılım isteklerinin onay durumunu tutar.
    Mevcut kayıtlar için server_default=0 (False) atanır.

Çalıştırma:
    cd backend/
    alembic upgrade head

Geri alma:
    alembic downgrade -1
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# ---------------------------------------------------------------------------
# Revision Identifiers — Alembic bu değerleri migration chain için kullanır
# ---------------------------------------------------------------------------
revision: str = "20260423_001"
down_revision: Union[str, None] = None   # İlk migration ise None; zincir varsa önceki ID
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# =============================================================================
# UPGRADE — Değişikliği veritabanına uygula
# =============================================================================
def upgrade() -> None:
    """
    group_members tablosuna is_approved sütunu ekler.

    NOT: server_default="0" ile mevcut satırlar False olarak işaretlenir.
         Yeni kayıtlarda Python tarafı default=False zaten uygulanır.
    """
    op.add_column(
        "group_members",
        sa.Column(
            "is_approved",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),   # MySQL: 0 = False
            comment="Grup lideri onaylayana kadar False. True ise üye aktif kabul edilir.",
        ),
    )

    # Performans için index ekle — onay durumuna göre sık sorgu yapılacak
    op.create_index(
        "ix_group_members_is_approved",
        "group_members",
        ["is_approved"],
        unique=False,
    )


# =============================================================================
# DOWNGRADE — Değişikliği geri al
# =============================================================================
def downgrade() -> None:
    """
    group_members tablosundan is_approved sütununu ve index'ini kaldırır.
    """
    op.drop_index("ix_group_members_is_approved", table_name="group_members")
    op.drop_column("group_members", "is_approved")
