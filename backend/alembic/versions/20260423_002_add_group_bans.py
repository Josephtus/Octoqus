# -*- coding: utf-8 -*-
"""Alembic Migration: add group bans

Revision ID: 20260423_002
Revises: 20260423_001
Create Date: 2026-04-23

Açıklama:
    GroupBan tablosu eklendi. Gruptan kalıcı uzaklaştırılan üyeleri takip eder.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# ---------------------------------------------------------------------------
# Revision Identifiers
# ---------------------------------------------------------------------------
revision: str = "20260423_002"
down_revision: Union[str, None] = "20260423_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# =============================================================================
# UPGRADE
# =============================================================================
def upgrade() -> None:
    op.create_table(
        "group_bans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("banned_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("group_id", "user_id", name="uq_group_user_ban"),
    )


# =============================================================================
# DOWNGRADE
# =============================================================================
def downgrade() -> None:
    op.drop_table("group_bans")
