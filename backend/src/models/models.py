"""
models.py
=========
SQLAlchemy 2.0 (Mapped / mapped_column API) ORM Modelleri.
Expense Tracking & Social Finance Platform — Tüm tablolar bu dosyada.

Tasarım Kararları:
  - Soft Delete: User → deleted_at (DateTime), Expense & Message → is_deleted (Boolean)
  - Fotoğraflar: Yerel disk yolu string olarak saklanır (örn: /uploads/receipts/x.jpg)
  - Roller: Python Enum ile tip güvenliği sağlanır
  - Self-referential M2M: Follower ayrı bir Table olarak tanımlanır
  - Tüm PK'lar INTEGER AUTO_INCREMENT; UUID gerekirse ileride geçilebilir
"""

import enum
from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Table,
    Text,
    UniqueConstraint,
    Column,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base


# =============================================================================
# ENUM Tanımları
# =============================================================================

class GlobalRole(str, enum.Enum):
    """Sistemdeki genel kullanıcı rolü."""
    USER         = "USER"
    GROUP_LEADER = "GROUP_LEADER"
    ADMIN        = "ADMIN"


class GroupMemberRole(str, enum.Enum):
    """Bir grup içindeki üye rolü."""
    USER         = "USER"
    GROUP_LEADER = "GROUP_LEADER"


class ReportStatus(str, enum.Enum):
    """Şikayet/Rapor durumu."""
    PENDING   = "pending"    # Bekliyor
    REVIEWED  = "reviewed"   # İnceleniyor
    RESOLVED  = "resolved"   # Çözüldü
    DISMISSED = "dismissed"  # Reddedildi


class SettlementStatus(str, enum.Enum):
    """Hesaplaşma/Ödeme onay durumu."""
    PENDING   = "pending"
    APPROVED  = "approved"
    REJECTED  = "rejected"


# =============================================================================
# FOLLOWER — Self-Referential Many-to-Many (Association Table)
# =============================================================================
# Not: Ek sütun olmadığı için (takip tarihi dışında) saf Table kullanıyoruz.
# Takip tarihi eklemek gerekirse mapped class'a dönüştürülebilir.

follower_table = Table(
    "followers",
    Base.metadata,
    Column(
        "follower_id",
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        comment="Takip eden kullanıcı",
    ),
    Column(
        "following_id",
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        comment="Takip edilen kullanıcı",
    ),
    Column(
        "created_at",
        DateTime,
        server_default=func.now(),
        nullable=False,
        comment="Takip ilişkisinin başlangıç tarihi",
    ),
    # Composite PK zaten unique garantisi veriyor; yine de açıkça belirt
    UniqueConstraint("follower_id", "following_id", name="uq_follower_following"),
)


# =============================================================================
# MODEL 1: User
# =============================================================================

class User(Base):
    """
    Platform kullanıcısı.
    Soft Delete: deleted_at alanı None ise kullanıcı aktif demektir.
    """
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_mail", "mail"),           # Login sorgusu için
        Index("ix_users_phone", "phone_number"),  # Telefon ile arama için
        Index("ix_users_deleted_at", "deleted_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Kişisel bilgiler
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    surname: Mapped[str] = mapped_column(String(100), nullable=False)
    age: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    birthday: Mapped[date] = mapped_column(Date, nullable=False)
    phone_number: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, comment="Uluslararası formatta: +905xxxxxxxxx"
    )

    # Kimlik doğrulama
    mail: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, comment="Giriş e-postası, benzersiz olmalı"
    )
    password: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Bcrypt hash — düz metin asla saklanmaz"
    )

    # Profil
    profile_photo: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Yerel disk yolu: /uploads/avatars/<filename>",
    )

    # Yetkilendirme & Durum
    role: Mapped[GlobalRole] = mapped_column(
        Enum(GlobalRole), nullable=False, default=GlobalRole.USER
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Zaman damgaları
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, default=None, comment="Soft delete: dolu ise kullanıcı silinmiş sayılır"
    )

    # ── İlişkiler ───────────────────────────────────────────────────────────
    group_memberships: Mapped[List["GroupMember"]] = relationship(
        "GroupMember", back_populates="user", cascade="all, delete-orphan"
    )
    expenses_added: Mapped[List["Expense"]] = relationship(
        "Expense", back_populates="added_by_user", foreign_keys="Expense.added_by"
    )
    messages_sent: Mapped[List["Message"]] = relationship(
        "Message", back_populates="sender", foreign_keys="Message.sender_id"
    )
    reports_filed: Mapped[List["Report"]] = relationship(
        "Report", back_populates="reporter", foreign_keys="Report.reporter_id"
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog", back_populates="admin", foreign_keys="AuditLog.admin_id"
    )

    # Self-referential M2M: Takipçiler / Takip edilenler
    following: Mapped[List["User"]] = relationship(
        "User",
        secondary=follower_table,
        primaryjoin=lambda: User.id == follower_table.c.follower_id,
        secondaryjoin=lambda: User.id == follower_table.c.following_id,
        back_populates="followers",
    )
    followers: Mapped[List["User"]] = relationship(
        "User",
        secondary=follower_table,
        primaryjoin=lambda: User.id == follower_table.c.following_id,
        secondaryjoin=lambda: User.id == follower_table.c.follower_id,
        back_populates="following",
    )

    @property
    def calculated_age(self) -> int:
        """Doğum tarihinden bugünkü yaşı hesaplar."""
        today = date.today()
        return today.year - self.birthday.year - ((today.month, today.day) < (self.birthday.month, self.birthday.day))

    def __repr__(self) -> str:
        return f"<User id={self.id} mail={self.mail!r} age={self.calculated_age}>"


# =============================================================================
# MODEL 2: Group
# =============================================================================

class Group(Base):
    """
    Harcama grubu.
    Admin onayı olmadan (is_approved=False) grup aktif olmaz.
    """
    __tablename__ = "groups"
    __table_args__ = (
        Index("ix_groups_is_approved", "is_approved"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="Grubun açıklaması / amacı"
    )
    is_approved: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Admin onaylayana kadar False. True olmadan grup kullanılamaz.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    custom_categories: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="JSON string list of {name, icon}"
    )

    # ── İlişkiler ───────────────────────────────────────────────────────────
    members: Mapped[List["GroupMember"]] = relationship(
        "GroupMember", back_populates="group", cascade="all, delete-orphan"
    )
    expenses: Mapped[List["Expense"]] = relationship(
        "Expense", back_populates="group", cascade="all, delete-orphan"
    )
    messages: Mapped[List["Message"]] = relationship(
        "Message", back_populates="group", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Group id={self.id} name={self.name!r} approved={self.is_approved}>"


# =============================================================================
# MODEL 3: GroupMember (Association Object — rol sütunu var)
# =============================================================================

class GroupMember(Base):
    """
    Kullanıcı ↔ Grup ara tablosu.
    Rol bilgisi (user / group_leader) bu tabloda tutulur.
    Bir kullanıcı birden fazla gruba farklı rollerle katılabilir.
    """
    __tablename__ = "group_members"
    __table_args__ = (
        UniqueConstraint("user_id", "group_id", name="uq_group_member"),
        Index("ix_group_members_group_id", "group_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[GroupMemberRole] = mapped_column(
        Enum(GroupMemberRole),
        nullable=False,
        default=GroupMemberRole.USER,
        comment="Grup içi rol: user veya group_leader",
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    is_approved: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Grup lideri onaylayana kadar False. True ise üye aktif kabul edilir.",
    )

    # ── İlişkiler ───────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="group_memberships")
    group: Mapped["Group"] = relationship("Group", back_populates="members")

    def __repr__(self) -> str:
        return f"<GroupMember user={self.user_id} group={self.group_id} role={self.role} approved={self.is_approved}>"


# =============================================================================
# MODEL 4: Expense (Harcama)
# =============================================================================

class Expense(Base):
    """
    Grup harcaması.
    Soft Delete: is_deleted=True ise harcama silinmiş sayılır.
    Cash Flow algoritması bu tablodaki verileri okur.
    """
    __tablename__ = "expenses"
    __table_args__ = (
        Index("ix_expenses_group_id", "group_id"),
        Index("ix_expenses_added_by", "added_by"),
        Index("ix_expenses_is_deleted", "is_deleted"),
        Index("ix_expenses_date", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    added_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Harcamayı sisteme ekleyen kullanıcı",
    )

    # Harcama bilgileri
    amount: Mapped[float] = mapped_column(
        nullable=False, comment="Harcama tutarı (TL cinsinden)"
    )
    content: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="Harcama açıklaması"
    )
    bill_photo: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Fatura fotoğrafı yerel disk yolu: /uploads/receipts/<filename>",
    )
    date: Mapped[date] = mapped_column(
        Date, nullable=False, comment="Harcamanın gerçekleştiği tarih"
    )
    category: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="Harcama kategorisi (örn: Market, Fatura)"
    )

    # Soft delete & zaman
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, comment="True ise harcama soft-deleted"
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # ── Hesaplaşma (Settlement) Alanları ──────────────────────────────────
    # Borç kapatmak için eklenen 'ödedim' kayıtları
    is_settlement: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, comment="True ise bu bir borç ödeme kaydıdır"
    )
    recipient_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        comment="Ödeme yapılan kişi (is_settlement=True ise zorunlu)"
    )
    settlement_status: Mapped[Optional[SettlementStatus]] = mapped_column(
        Enum(SettlementStatus), nullable=True, default=None,
        comment="Ödeme onay durumu"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, onupdate=func.now()
    )

    # ── İlişkiler ───────────────────────────────────────────────────────────
    group: Mapped["Group"] = relationship("Group", back_populates="expenses")
    added_by_user: Mapped[Optional["User"]] = relationship(
        "User", back_populates="expenses_added", foreign_keys=[added_by]
    )
    recipient_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[recipient_id]
    )

    def __repr__(self) -> str:
        return f"<Expense id={self.id} group={self.group_id} amount={self.amount}>"


# =============================================================================
# MODEL 5: Message (Grup Chat)
# =============================================================================

class Message(Base):
    """
    Grup içi gerçek zamanlı mesajlaşma.
    Soft Delete: is_deleted=True ile mesaj moderasyon sonucu kaldırılır.
    Redis Pub/Sub üzerinden canlı iletilir; bu tablo kalıcı geçmişi saklar.
    """
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_group_id", "group_id"),
        Index("ix_messages_sender_id", "sender_id"),
        Index("ix_messages_timestamp", "timestamp"),
        Index("ix_messages_is_deleted", "is_deleted"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    sender_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Gönderen kullanıcı (silinse bile mesaj geçmişi korunur)",
    )
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), comment="Mesajın gönderilme zamanı"
    )

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, comment="True ise mesaj moderasyon sonucu kaldırıldı"
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # ── İlişkiler ───────────────────────────────────────────────────────────
    group: Mapped["Group"] = relationship("Group", back_populates="messages")
    sender: Mapped[Optional["User"]] = relationship(
        "User", back_populates="messages_sent", foreign_keys=[sender_id]
    )
    reports: Mapped[List["Report"]] = relationship(
        "Report", back_populates="reported_message", foreign_keys="Report.reported_message_id"
    )

    def __repr__(self) -> str:
        return f"<Message id={self.id} group={self.group_id} sender={self.sender_id}>"


# =============================================================================
# MODEL 6: Report / Complaint (Şikayet)
# =============================================================================

class Report(Base):
    """
    Kullanıcı şikayetleri.
    Ya bir mesajı ya da bir kullanıcıyı şikayet etmek için kullanılır.
    İkisi de opsiyonel ama en az birinin dolu olması uygulama katmanında zorunlu tutulmalı.
    """
    __tablename__ = "reports"
    __table_args__ = (
        Index("ix_reports_reporter_id", "reporter_id"),
        Index("ix_reports_status", "status"),
        Index("ix_reports_reported_user_id", "reported_user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Şikayet eden
    reporter_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Şikayet edilen varlık (mesaj VEYA kullanıcı)
    reported_message_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        comment="Şikayet edilen mesaj (opsiyonel)",
    )
    reported_user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Şikayet edilen kullanıcı (opsiyonel)",
    )

    # Şikayet detayları
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, default="GENEL", server_default="GENEL"
    )
    aciklama: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Şikayetin ayrıntılı açıklaması"
    )
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus),
        nullable=False,
        default=ReportStatus.PENDING,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, onupdate=func.now()
    )

    # ── İlişkiler ───────────────────────────────────────────────────────────
    reporter: Mapped["User"] = relationship(
        "User", back_populates="reports_filed", foreign_keys=[reporter_id]
    )
    reported_message: Mapped[Optional["Message"]] = relationship(
        "Message", back_populates="reports", foreign_keys=[reported_message_id]
    )
    reported_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[reported_user_id]
    )

    def __repr__(self) -> str:
        return f"<Report id={self.id} status={self.status} reporter={self.reporter_id}>"


# =============================================================================
# MODEL 7: AuditLog (Admin Denetim İzi)
# =============================================================================

class AuditLog(Base):
    """
    Admin işlemlerinin değiştirilemez kaydı (Audit Trail).
    Harcama silme, üye atama/çıkarma gibi kritik işlemler burada loglanır.
    UYARI: Bu tabloda asla güncelleme veya silme yapılmaz — yalnızca INSERT.
    """
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_admin_id", "admin_id"),
        Index("ix_audit_logs_timestamp", "timestamp"),
        Index("ix_audit_logs_process", "process_performed"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    admin_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="İşlemi yapan admin (silinse bile log korunur)",
    )
    process_performed: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Yapılan işlem tipi: EXPENSE_DELETE, MEMBER_KICK, GROUP_APPROVE vb.",
    )
    content: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="İşlemin ayrıntılı açıklaması veya etkilenen kayıt bilgisi (JSON string olabilir)",
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        comment="İşlemin gerçekleştiği UTC zaman damgası",
    )

    # ── İlişkiler ───────────────────────────────────────────────────────────
    admin: Mapped[Optional["User"]] = relationship(
        "User", back_populates="audit_logs", foreign_keys=[admin_id]
    )

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} admin={self.admin_id} process={self.process_performed!r}>"


# =============================================================================
# BANS
# =============================================================================

class GroupBan(Base):
    """
    Gruptan kalıcı olarak uzaklaştırılan (banlanan) kullanıcılar tablosu.
    """
    __tablename__ = "group_bans"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_user_ban"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    banned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc)
    )

    group: Mapped["Group"] = relationship()
    user: Mapped["User"] = relationship()

    def __repr__(self) -> str:
        return f"<GroupBan id={self.id} group={self.group_id} user={self.user_id}>"
