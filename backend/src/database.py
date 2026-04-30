"""
database.py
===========
SQLAlchemy 2.0 Async engine ve session factory.
Tüm modeller bu modüldeki `Base`'i miras alır.
"""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


# ---------------------------------------------------------------------------
# DeclarativeBase — Tüm modeller bu sınıfı miras alır
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    """Merkezi ORM tabanı. Metadata ve tip eşlemeleri burada yönetilir."""
    pass


# ---------------------------------------------------------------------------
# Async Engine
# ---------------------------------------------------------------------------
DATABASE_URL: str = os.environ["DATABASE_URL"]
# Örnek: mysql+aiomysql://expense_user:pass@db:3306/expense_tracking

engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SANIC_DEBUG", "false").lower() == "true",  # SQL loglarını yalnızca debug modda göster
    pool_size=10,           # Havuzdaki kalıcı bağlantı sayısı
    max_overflow=20,        # Havuz dolduğunda açılabilecek ekstra bağlantı
    pool_recycle=3600,      # 1 saatte bir bağlantıyı yenile (MySQL timeout önlemi)
    pool_pre_ping=True,     # Kullanmadan önce bağlantının sağlıklı olup olmadığını kontrol et
)

# ---------------------------------------------------------------------------
# Session Factory
# ---------------------------------------------------------------------------
AsyncSessionFactory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # commit sonrası nesneleri bellekten atmaz → performans
    autoflush=False,         # Manuel flush kontrolü
    autocommit=False,
)


# ---------------------------------------------------------------------------
# Dependency: Request başına session sağlayan context manager
# ---------------------------------------------------------------------------
@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Sanic route handler'larında kullanılacak async session context manager.

    Kullanım:
        async with get_session() as session:
            result = await session.execute(select(User))
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Uygulama başlangıcında tabloları oluştur (Alembic yoksa dev amaçlı)
# ---------------------------------------------------------------------------
async def init_db() -> None:
    """
    Alembic migration çalıştırılmadan önce tabloları oluşturur.
    """
    async with engine.begin() as conn:
        # 1. Tabloları oluştur (yoksa)
        await conn.run_sync(Base.metadata.create_all)
        
        # 2. Manuel Migrationlar (Opsiyonel/Hızlı Kontroller)
        # Sadece kolonlar yoksa ekle
        from sqlalchemy import text
        
        # Mevcut kolonları kontrol et (MySQL için)
        async def column_exists(table, column):
            res = await conn.execute(text(f"SHOW COLUMNS FROM `{table}` LIKE '{column}'"))
            return res.fetchone() is not None

        # Sadece eksik kolonları ekle
        if not await column_exists("reports", "category"):
            try: await conn.execute(text("ALTER TABLE reports ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'GENEL'"))
            except: pass

        if not await column_exists("expenses", "is_settlement"):
            try: await conn.execute(text("ALTER TABLE expenses ADD COLUMN is_settlement BOOLEAN NOT NULL DEFAULT FALSE"))
            except: pass

        if not await column_exists("expenses", "recipient_id"):
            try: await conn.execute(text("ALTER TABLE expenses ADD COLUMN recipient_id INTEGER REFERENCES users(id)"))
            except: pass

        if not await column_exists("expenses", "category"):
            try: await conn.execute(text("ALTER TABLE expenses ADD COLUMN category VARCHAR(100) NULL"))
            except: pass

        if not await column_exists("groups", "custom_categories"):
            try: await conn.execute(text("ALTER TABLE groups ADD COLUMN custom_categories TEXT NULL"))
            except: pass

        if not await column_exists("group_members", "is_starred"):
            try: await conn.execute(text("ALTER TABLE group_members ADD COLUMN is_starred BOOLEAN NOT NULL DEFAULT FALSE"))
            except: pass

        if not await column_exists("group_members", "last_accessed_at"):
            try: await conn.execute(text("ALTER TABLE group_members ADD COLUMN last_accessed_at DATETIME NULL"))
            except: pass


async def dispose_engine() -> None:
    """Sanic shutdown hook'unda engine bağlantı havuzunu kapat."""
    await engine.dispose()
