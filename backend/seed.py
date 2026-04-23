import asyncio
from datetime import date, datetime
import structlog
from sqlalchemy import select

from src.database import get_session, dispose_engine
from src.models import User, GlobalRole
from src.services.security import hash_password

logger = structlog.get_logger(__name__)

async def seed_admin():
    logger.info("Veritabanına bağlanılıyor ve Admin kullanıcısı kontrol ediliyor...")
    
    async with get_session() as session:
        # admin@admin.com mail adresine sahip kullanıcıyı kontrol et
        stmt = select(User).where(User.mail == "admin@admin.com")
        result = await session.execute(stmt)
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin:
            print("Admin zaten mevcut.")
            logger.info("Admin kullanıcısı halihazırda var. İşlem sonlandırılıyor.")
            return
            
        # Kullanıcı yoksa, yeni Admin nesnesini oluştur
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
        
        # Session'a ekle (get_session() context manager'ı çıkışta otomatik commit atar)
        session.add(admin_user)
        
        print("Yeni Admin kullanıcısı başarıyla eklendi.")
        logger.info("Admin kullanıcısı 'admin@admin.com' başarıyla veritabanına eklendi.")

async def run_seed():
    try:
        await seed_admin()
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(run_seed())
