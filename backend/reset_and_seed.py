import asyncio
import random
import structlog
from datetime import date, datetime, timedelta
from sqlalchemy import insert

from src.database import engine, Base, dispose_engine, get_session
from src.models import (
    User, Group, GroupMember, GlobalRole, GroupMemberRole, 
    Message, Report, ReportStatus, follower_table
)
from src.services.security import hash_password

logger = structlog.get_logger(__name__)

# TEST İÇİN ÜRETİLECEK VERİ SAYILARI
NUM_GROUPS = 30
NUM_USERS = 200
MESSAGES_PER_GROUP = 15
REPORTS_COUNT = 25
FOLLOWS_COUNT = 300

# GERÇEKÇİ VERİ LİSTELERİ
NAMES = ["Ahmet", "Mehmet", "Ayşe", "Fatma", "Can", "Ece", "Burak", "Selin", "Deniz", "Mert", "Zeynep", "Ali", "Veli", "Derya", "Oğuz", "Aslı", "Kerem", "Gökhan", "İrem", "Büşra"]
SURNAMES = ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Öztürk", "Arslan", "Doğan", "Kılıç", "Aydın", "Özkan", "Aslan", "Bulut", "Yıldız", "Güneş", "Korkmaz", "Erdoğan", "Yavuz"]
GROUP_NAMES = [
    "Ev Arkadaşları 2024", "Yaz Tatili Planı", "Ofis Kahve Grubu", "Haftalık Maç Giderleri", 
    "Doğum Günü Sürprizi", "Kyk Yurdu 4. Kat", "Üniversite Proje Ekibi", "Akşam Yemeği Ekibi",
    "Spor Salonu Ortaklık", "Kamp Meraklıları", "Sinema Gecesi", "Yemekhane Boykot Ekibi",
    "Yol Arkadaşları", "Hediye Fonu", "Oyun Gecesi Giderleri", "Kira ve Faturalar"
]
MESSAGES = [
    "Selam beyler, dünkü market alışverişini kim ödedi?", "Faturayı ödedim, masrafı ekliyorum.", 
    "Gruptan çıkmak isteyen var mı?", "Bu ayki kira biraz fazla geldi sanki.", "Market fişini buraya atıyorum.",
    "Bana borcu olanlar bi el kaldırsın :D", "Arkadaşlar ödemeleri aksatmayalım lütfen.",
    "Harika bir gündü, herkese teşekkürler!", "Gelecek hafta için plan yapan var mı?",
    "Harcamayı sisteme girdim, onay bekliyorum.", "Oğuz senin borcun hala duruyor haberin olsun.",
    "Selam, yeni üye kabul ediyor muyuz?", "Arkadaşlar bu akşam buluşuyor muyuz?"
]
REPORT_REASONS = [
    "Sürekli küfürlü konuşuyor.", "Grupta alakasız şeyler paylaşıyor.", "Borcunu asla ödemiyor.",
    "Taciz edici mesajlar gönderiyor.", "Sahte makbuz yüklüyor.", "Sistem açığını kullanıyor.",
    "Dolandırıcılık şüphesi var.", "İnsanlara hakaret ediyor.", "Spam yapıyor."
]
CATEGORIES = ["HAKARET", "DOLANDIRICILIK", "SPAM", "UYGUNSUZ_İÇERİK", "DİĞER"]

async def reset_database():
    """Veritabanındaki tüm tabloları siler ve yeniden oluşturur."""
    logger.info("Veritabanı sıfırlanıyor (Drop & Create)...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Tablolar başarıyla yeniden oluşturuldu.")

async def seed_data():
    """Gerçekçi verilerle sistemi doldurur."""
    logger.info("Gerçekçi verilerle seeding işlemi başlatılıyor...")
    
    async with get_session() as session:
        default_pwd = hash_password("123")
        
        # 1. ADMIN
        admin = User(
            name="Admin",
            surname="User",
            mail="admin@admin.com",
            password=default_pwd,
            age=30,
            birthday=date(1994, 1, 1),
            phone_number="+905000000000",
            role=GlobalRole.ADMIN,
            is_active=True
        )
        session.add(admin)
        
        # 2. KULLANICILAR
        all_users = []
        for i in range(1, NUM_USERS + 1):
            name = random.choice(NAMES)
            surname = random.choice(SURNAMES)
            user = User(
                name=name,
                surname=surname,
                mail=f"user{i}@example.com",
                password=default_pwd,
                age=random.randint(18, 50),
                birthday=date(random.randint(1975, 2005), random.randint(1, 12), random.randint(1, 28)),
                phone_number=f"+905{random.randint(100, 999)}{random.randint(1000000, 9999999)}",
                role=GlobalRole.USER if i > 5 else GlobalRole.GROUP_LEADER,
                is_active=True
            )
            session.add(user)
            all_users.append(user)
            
        await session.flush()
        logger.info(f"{NUM_USERS} kullanıcı oluşturuldu.")

        # 3. GRUPLAR VE ÜYELİKLER
        all_groups = []
        leaders = [u for u in all_users if u.role == GlobalRole.GROUP_LEADER]
        
        for i in range(1, NUM_GROUPS + 1):
            g_name = random.choice(GROUP_NAMES) + f" #{i}"
            leader = random.choice(leaders)
            group = Group(
                name=g_name,
                content=f"{g_name} için harcama takip ve koordinasyon grubu.",
                is_approved=True if i % 4 != 0 else False # Bazılarını onaylanmamış bırak
            )
            session.add(group)
            all_groups.append(group)
            await session.flush()
            
            # Lideri ekle
            session.add(GroupMember(user_id=leader.id, group_id=group.id, role=GroupMemberRole.GROUP_LEADER, is_approved=True))
            
            # Rastgele 5-15 üye ekle
            members_count = random.randint(5, 15)
            potential_members = random.sample(all_users, members_count)
            for m in potential_members:
                if m.id == leader.id: continue
                # Bazıları onay bekleyen (Group Join Request) olsun
                approved = True if random.random() > 0.2 else False
                session.add(GroupMember(user_id=m.id, group_id=group.id, role=GroupMemberRole.USER, is_approved=approved))
        
        logger.info(f"{NUM_GROUPS} grup ve üyelikleri oluşturuldu.")
        await session.flush()

        # 4. MESAJLAR (CHAT)
        all_messages = []
        for g in all_groups:
            if not g.is_approved: continue
            # Bu grubun üyelerini bul (flush edildiği için ID'ler var)
            # Ama biz daha basitçe all_users'tan seçelim (gerçekçilik için o grubun üyesi olmalı ama seed'de hızlılık için rastgele seçiyoruz)
            # Doğru olan o grubun üyelerini çekmek:
            for _ in range(MESSAGES_PER_GROUP):
                sender = random.choice(all_users)
                msg = Message(
                    group_id=g.id,
                    sender_id=sender.id,
                    message_text=random.choice(MESSAGES),
                    timestamp=datetime.now() - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
                )
                session.add(msg)
                all_messages.append(msg)
        
        logger.info("Grup mesajları oluşturuldu.")
        await session.flush()

        # 5. ŞİKAYETLER (REPORTS)
        for _ in range(REPORTS_COUNT):
            reporter = random.choice(all_users)
            target_user = random.choice(all_users)
            target_msg = random.choice(all_messages) if random.random() > 0.5 else None
            
            report = Report(
                reporter_id=reporter.id,
                reported_user_id=target_user.id if not target_msg else None,
                reported_message_id=target_msg.id if target_msg else None,
                category=random.choice(CATEGORIES),
                aciklama=random.choice(REPORT_REASONS),
                status=random.choice(list(ReportStatus)),
                created_at=datetime.now() - timedelta(days=random.randint(0, 10))
            )
            session.add(report)
        
        logger.info("Sistem şikayetleri oluşturuldu.")

        # 6. TAKİPÇİLER (SOCIAL)
        for _ in range(FOLLOWS_COUNT):
            f1, f2 = random.sample(all_users, 2)
            stmt = insert(follower_table).values(
                follower_id=f1.id,
                following_id=f2.id,
                created_at=datetime.now() - timedelta(days=random.randint(0, 60))
            )
            try:
                await session.execute(stmt)
            except: # Duplicate entry'leri yoksay
                pass

        logger.info("Sosyal ağ bağlantıları oluşturuldu.")

        await session.commit()
        logger.info("TÜM VERİLER BAŞARIYLA KAYDEDİLDİ!")

async def main():
    try:
        await reset_database()
        await seed_data()
    except Exception as e:
        logger.error(f"Beklenmeyen bir hata oluştu: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())