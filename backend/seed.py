import asyncio
import structlog
from datetime import date, datetime, timezone
from src.database import engine, Base, dispose_engine, get_session
from src.models import User, GlobalRole
from src.services.security import hash_password
from src.services.common import generate_invite_code

logger = structlog.get_logger(__name__)

async def reset_database():
    """Veritabanını tamamen sıfırlar ve tabloları yeniden oluşturur."""
    logger.info("database.reset_started")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    logger.info("database.reset_completed")

async def seed_admin():
    """Sadece belirtilen admin kullanıcısını ekler."""
    logger.info("seed.admin_started")
    async with get_session() as session:
        admin_email = "octoqusmail@gmail.com"
        admin_password = "Yusuf123456"
        
        # Admin kullanıcısını oluştur
        admin = User(
            name="Octoqus",
            surname="Admin",
            mail=admin_email,
            password=hash_password(admin_password),
            age=25,
            birthday=date(2000, 1, 1),
            phone_number="+905000000000",
            role=GlobalRole.ADMIN,
            is_active=True,
            invite_code="#ADMIN"
        )
        
        try:
            session.add(admin)
            await session.commit()
            logger.info("seed.admin_success", email=admin_email)
            print(f"\n✅ Veritabanı sıfırlandı ve Admin hesabı oluşturuldu!")
            print(f"📧 Email: {admin_email}")
            print(f"🔑 Şifre: {admin_password}\n")
        except Exception as e:
            logger.error("seed.admin_failed", error=str(e))
            await session.rollback()
            raise e

async def main():
    try:
        await reset_database()
        await seed_admin()
    except Exception as e:
        logger.error("seed.main_failed", error=str(e))
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())
