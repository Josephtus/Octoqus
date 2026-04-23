import asyncio
import structlog
from src.database import engine, Base, dispose_engine, get_session
from src.models import User, GlobalRole
from src.services.security import hash_password
from datetime import date

logger = structlog.get_logger(__name__)

async def reset_database():
    logger.info("Veritabanı sıfırlanıyor (Drop & Create)...")
    async with engine.begin() as conn:
        # Önce tabloları sil
        await conn.run_sync(Base.metadata.drop_all)
        # Sonra tekrar oluştur
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Tablolar başarıyla yeniden oluşturuldu.")

async def seed_admin():
    logger.info("Admin kullanıcısı ekleniyor...")
    async with get_session() as session:
        hashed_pwd = hash_password("123")
        admin_user = User(
            name="Super",
            surname="Admin",
            mail="admin@admin.com",
            password=hashed_pwd,
            age=0,
            birthday=date(1970, 1, 1),
            phone_number="SYSTEM_ADMIN",
            role=GlobalRole.ADMIN,
            is_active=True
        )
        session.add(admin_user)
        # get_session automatically commits
    logger.info("Admin başarıyla eklendi.")

async def main():
    try:
        await reset_database()
        await seed_admin()
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())
