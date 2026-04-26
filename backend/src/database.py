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
    Production'da yerine `alembic upgrade head` kullanılmalıdır.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Manuel Migration: Yeni sütunları ekle (yoksa)
        from sqlalchemy import text
        try:
            await conn.execute(text("ALTER TABLE reports ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'GENEL'"))
        except Exception: pass

        try:
            await conn.execute(text("ALTER TABLE expenses ADD COLUMN is_settlement BOOLEAN NOT NULL DEFAULT FALSE"))
        except Exception: pass

        try:
            await conn.execute(text("ALTER TABLE expenses ADD COLUMN recipient_id INTEGER REFERENCES users(id)"))
        except Exception: pass

        try:
            # ENUM değerlerini Python modelindeki gibi (lowercase) kullan
            try:
                await conn.execute(text("ALTER TABLE expenses ADD COLUMN settlement_status ENUM('PENDING', 'APPROVED', 'REJECTED') NULL"))
            except Exception:
                await conn.execute(text("ALTER TABLE expenses MODIFY COLUMN settlement_status ENUM('PENDING', 'APPROVED', 'REJECTED') NULL"))
        except Exception: pass

        try:
            await conn.execute(text("ALTER TABLE expenses ADD COLUMN category VARCHAR(100) NULL"))
        except Exception: pass

        try:
            await conn.execute(text("ALTER TABLE groups ADD COLUMN custom_categories TEXT NULL"))
        except Exception: pass


async def dispose_engine() -> None:
    """Sanic shutdown hook'unda engine bağlantı havuzunu kapat."""
    await engine.dispose()
