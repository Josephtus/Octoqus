"""
backend/src/models/__init__.py
==============================
Model paketinin public API'si.
Tüm modelleri tek noktadan import etmeyi sağlar.

Kullanım:
    from src.models import User, Group, Expense, AuditLog, GroupBan
"""

from src.models.models import (
    AuditLog,
    Expense,
    GlobalRole,
    Group,
    GroupMember,
    GroupMemberRole,
    Message,
    Report,
    ReportStatus,
    User,
    follower_table,
    GroupBan,
    SettlementStatus,
)

__all__ = [
    # Modeller
    "User",
    "Group",
    "GroupMember",
    "Expense",
    "Message",
    "Report",
    "AuditLog",
    # Association Table
    "follower_table",
    # Enum'lar
    "GlobalRole",
    "GroupMemberRole",
    "ReportStatus",
    "SettlementStatus",
]
