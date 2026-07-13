"""
alembic/env.py
==============
Alembic Async Migration Ortamı
================================
SQLAlchemy varsayılan olarak senkron çalışır.
Bu dosya aiomysql (async) sürücüsünü desteklemek için
asyncio.run() + AsyncEngine kullanır.

Çalıştırma:
    cd backend/
    alembic revision --autogenerate -m "initial_schema"
    alembic upgrade head
"""

import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

# ---------------------------------------------------------------------------
# sys.path Ayarı
# alembic.ini'deki prepend_sys_path = . zaten backend/ ekler,
# ama Docker içinde güvence için burada da ekliyoruz.
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# ---------------------------------------------------------------------------
# Alembic config objesi (alembic.ini değerlerini okur)
# ---------------------------------------------------------------------------
config = context.config

# Python logging konfigürasyonunu alembic.ini'den yükle
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------------------------
# Metadata — Tüm modelleri import et → tablolar Base.metadata'ya kaydolur
# ---------------------------------------------------------------------------
# Bu import ZORUNLU: Modeller import edilmeden metadata boş kalır
# ve autogenerate hiçbir tablo üretmez.
from src.database import Base  # noqa: E402
from src.models import (  # noqa: E402, F401 — yan etki amaçlı import
    AuditLog,
    Expense,
    Group,
    GroupMember,
    Message,
    Report,
    User,
    follower_table,
)

target_metadata = Base.metadata

# ---------------------------------------------------------------------------
# DATABASE_URL — .env'den alınır, alembic.ini'deki boş değeri override eder
# ---------------------------------------------------------------------------
DATABASE_URL: str = os.environ["DATABASE_URL"]
# aiomysql async sürücüsünü kullan (alembic run_sync içinde bile gerekli)


# =============================================================================
# OFFLINE MIGRATION (Veritabanına bağlanmadan SQL üret)
# Kullanım: alembic upgrade head --sql > migration.sql
# =============================================================================
def run_migrations_offline() -> None:
    """
    Veritabanı bağlantısı olmadan SQL script üretir.
    CI/CD pipeline'larında DBA incelemesi için kullanışlıdır.
    """
    # Offline modda senkron URL kullanılır (aiomysql → pymysql dönüşümü)
    sync_url = DATABASE_URL.replace("mysql+aiomysql", "mysql+pymysql")

    context.configure(
        url=sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,              # Sütun tipi değişimlerini yakala
        compare_server_default=True,    # Sunucu default değişimlerini yakala
        include_schemas=False,
    )

    with context.begin_transaction():
        context.run_migrations()


# =============================================================================
# ONLINE MIGRATION (Async engine ile veritabanına bağlan ve uygula)
# =============================================================================
def do_run_migrations(connection) -> None:
    """
    Alembic context'ini sync bağlantıyla yapılandırır ve migration'ları çalıştırır.
    AsyncEngine.run_sync() tarafından çağrılır.
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        include_schemas=False,
        # Enum değişikliklerini render et
        render_as_batch=False,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """
    Async engine oluşturur, bağlantıyı açar ve sync callback üzerinden migration çalıştırır.
    NullPool: Migration işlemleri connection pool'a ihtiyaç duymaz.
    """
    engine: AsyncEngine = create_async_engine(
        DATABASE_URL,
        poolclass=pool.NullPool,  # Migration sırasında pool gereksiz — bellek tasarrufu
        echo=False,
    )

    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await engine.dispose()


def run_migrations_online() -> None:
    """
    Online migration giriş noktası.
    asyncio.run() ile async migration fonksiyonunu senkron ortamdan başlatır.
    """
    asyncio.run(run_async_migrations())


# =============================================================================
# Alembic'in çağıracağı giriş noktası
# =============================================================================
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
