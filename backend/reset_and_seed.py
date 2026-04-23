import asyncio
import random
import structlog
from datetime import date

from src.database import engine, Base, dispose_engine, get_session
from src.models import User, Group, GroupMember, GlobalRole, GroupMemberRole
from src.services.security import hash_password

logger = structlog.get_logger(__name__)

async def reset_database():
    """Veritabanındaki tüm tabloları siler ve yeniden oluşturur."""
    logger.info("Veritabanı sıfırlanıyor (Drop & Create)...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Tablolar başarıyla yeniden oluşturuldu.")

async def seed_data():
    """Admin, grup liderleri, gruplar ve normal üyeleri oluşturup birbirine bağlar."""
    logger.info("Örnek veriler (Seed Data) veritabanına ekleniyor...")
    
    async with get_session() as session:
        # Ortak kullanılacak varsayılan şifre
        default_pwd = hash_password("123")
        
        # ---------------------------------------------------------
        # 1. SUPER ADMIN OLUŞTURMA
        # ---------------------------------------------------------
        admin_user = User(
            name="Super",
            surname="Admin",
            mail="admin@admin.com",
            password=default_pwd,
            age=30,
            birthday=date(1994, 1, 1),
            phone_number="+905000000000",
            role=GlobalRole.ADMIN,
            is_active=True
        )
        session.add(admin_user)
        
        # ---------------------------------------------------------
        # 2. GRUP LİDERLERİNİ OLUŞTURMA (4 KİŞİ)
        # ---------------------------------------------------------
        group_leaders = []
        for i in range(1, 5):
            leader = User(
                name="Leader",
                surname=str(i),
                mail=f"leader{i}@example.com",
                password=default_pwd,
                age=25,
                birthday=date(1998, 5, 10),
                phone_number=f"+90555111000{i}",
                role=GlobalRole.GROUP_LEADER,
                is_active=True
            )
            session.add(leader)
            group_leaders.append(leader)
            
        # ID'lerin oluşması için veritabanına flush atıyoruz
        await session.flush() 

        # ---------------------------------------------------------
        # 3. GRUPLARI OLUŞTURMA VE LİDERLERİ ATAMA (4 GRUP)
        # ---------------------------------------------------------
        groups = []
        for i, leader in enumerate(group_leaders, 1):
            # Grubu oluştur (Admin onaylamış sayıyoruz)
            group = Group(
                name=f"Grup {i}",
                content=f"{i}. Test Harcama Grubu",
                is_approved=True 
            )
            session.add(group)
            await session.flush() # Grubun ID'sini almak için flush
            groups.append(group)
            
            # Lideri, kendi grubuna 'GROUP_LEADER' rolüyle ekle
            gm_leader = GroupMember(
                user_id=leader.id,
                group_id=group.id,
                role=GroupMemberRole.GROUP_LEADER,
                is_approved=True
            )
            session.add(gm_leader)

        # ---------------------------------------------------------
        # 4. NORMAL ÜYELERİ OLUŞTURMA (16 KİŞİ) VE GRUPLARA DAĞITMA
        # ---------------------------------------------------------
        for i in range(1, 17):
            user = User(
                name="User",
                surname=str(i),
                mail=f"user{i}@example.com",
                password=default_pwd,
                age=22,
                birthday=date(2002, 3, 15),
                phone_number=f"+90555222{(str(i).zfill(3))}",
                role=GlobalRole.USER,
                is_active=True
            )
            session.add(user)
            await session.flush() # Kullanıcı ID'si için flush
            
            # Üyeyi rastgele bir gruba 'USER' rolüyle ata
            random_group = random.choice(groups)
            gm_user = GroupMember(
                user_id=user.id,
                group_id=random_group.id,
                role=GroupMemberRole.USER,
                is_approved=True  # Test için doğrudan onaylı başlatıyoruz
            )
            session.add(gm_user)

        # Tüm işlemleri veritabanına kalıcı olarak kaydet
        await session.commit()
        
    logger.info("Admin (1), Grup Lideri (4), Grup (4) ve Normal Üyeler (16) başarıyla oluşturuldu!")

async def main():
    try:
        await reset_database()
        await seed_data()
    except Exception as e:
        logger.error(f"Beklenmeyen bir hata oluştu: {str(e)}")
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())