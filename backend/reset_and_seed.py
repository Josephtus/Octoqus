import asyncio
import random
import structlog
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import insert, select
from sqlalchemy.orm import selectinload

from src.database import engine, Base, dispose_engine, get_session
from src.models import (
    User, Group, GroupMember, GlobalRole, GroupMemberRole, 
    Message, Report, ReportStatus, follower_table, Expense
)
from src.services.security import hash_password

logger = structlog.get_logger(__name__)

# TEST İÇİN ÜRETİLECEK VERİ SAYILARI
NUM_GROUPS = 40
NUM_USERS = 200
MESSAGES_PER_GROUP = 30
EXPENSES_PER_GROUP = 25
REPORTS_COUNT = 30
FOLLOWS_COUNT = 400

# GERÇEKÇİ VERİ LİSTELERİ
NAMES = ["Ahmet", "Mehmet", "Ayşe", "Fatma", "Can", "Ece", "Burak", "Selin", "Deniz", "Mert", "Zeynep", "Ali", "Veli", "Derya", "Oğuz", "Aslı", "Kerem", "Gökhan", "İrem", "Büşra", "Emre", "Sibel", "Tuna", "Lara", "Cem", "Gizem", "Onur", "Melis", "Bora", "İdil"]
SURNAMES = ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Öztürk", "Arslan", "Doğan", "Kılıç", "Aydın", "Özkan", "Aslan", "Bulut", "Yıldız", "Güneş", "Korkmaz", "Erdoğan", "Yavuz", "Tekin", "Aksoy", "Kocaman", "Sarı", "Kurt", "Özcan"]

GROUP_TEMPLATES = [
    {"name": "Eskişehir Ev", "content": "Kira, faturalar ve mutfak masrafları ortak."},
    {"name": "Yaz Tatili 2024", "content": "Antalya tatili ulaşım, konaklama ve yemek giderleri."},
    {"name": "Ofis Kahve Fonu", "content": "Haftalık kahve ve atıştırmalık masrafları."},
    {"name": "Halı Saha Ekibi", "content": "Saha kirası ve maç sonu su giderleri."},
    {"name": "Doğum Günü Organizasyonu", "content": "Sürpriz parti masrafları."},
    {"name": "Kyk Yurdu 4. Kat", "content": "Ortak alınan temizlik malzemeleri vb."},
    {"name": "Üniversite Proje Ekibi", "content": "Kırtasiye ve yemek masrafları."},
    {"name": "Akşam Yemeği Kulübü", "content": "Her hafta farklı bir yerde yemek."},
    {"name": "Spor Salonu Partnerleri", "content": "Ortak hoca ve suplement giderleri."},
    {"name": "Kamp Meraklıları", "content": "Çadır, ekipman ve kamp yeri ücretleri."},
    {"name": "Sinema Gecesi", "content": "Bilet ve mısır paraları."},
    {"name": "Yemekhane Boykot Ekibi", "content": "Dışarıdan toplu yemek siparişleri."},
    {"name": "Yol Arkadaşları", "content": "Akaryakıt ve otoban geçiş ücretleri."},
    {"name": "Oyun Gecesi", "content": "Pizza ve atıştırmalık giderleri."},
    {"name": "Kira ve Faturalar", "content": "Aylık sabit giderlerin paylaşımı."},
    {"name": "Hediye Fonu", "content": "Ortak alınan hediyelerin ödemeleri."},
    {"name": "Yılbaşı Partisi", "content": "Süsleme ve ikramlık giderleri."},
    {"name": "Kedi Maması Fonu", "content": "Sokak hayvanları için ortak mama alımı."},
]

EXPENSE_CONTENTS = [
    "Market Alışverişi", "Elektrik Faturası", "Su Faturası", "İnternet", "Doğalgaz", 
    "Pizza Siparişi", "Uber Ücreti", "Saha Kirası", "Kahve Alımı", "Kırtasiye Masrafı",
    "Akşam Yemeği", "Sinema Bileti", "Kamp Malzemesi", "Benzin", "Otopark", "Kira",
    "Temizlik Malzemesi", "Damacana Su", "Ekmek ve Gazete", "Tamir Masrafı"
]

MESSAGES = [
    "Selam beyler, dünkü market alışverişini kim ödedi?", "Faturayı ödedim, masrafı ekliyorum.", 
    "Gruptan çıkmak isteyen var mı?", "Bu ayki kira biraz fazla geldi sanki.", "Market fişini buraya atıyorum.",
    "Bana borcu olanlar bi el kaldırsın :D", "Arkadaşlar ödemeleri aksatmayalım lütfen.",
    "Harika bir gündü, herkese teşekkürler!", "Gelecek hafta için plan yapan var mı?",
    "Harcamayı sisteme girdim, onay bekliyorum.", "Oğuz senin borcun hala duruyor haberin olsun.",
    "Selam, yeni üye kabul ediyor muyuz?", "Arkadaşlar bu akşam buluşuyor muyuz?",
    "Ben ödememi yaptım, kontrol eder misiniz?", "Fiyatlar çok artmış gerçekten.",
    "Bu hafta kimse bir şey eklemedi mi?", "Market poşetlerini kapıya bıraktım.",
    "Bir sonraki toplantı ne zaman?", "Bence bu ay tasarruf yapmalıyız.",
    "Selam, ben yeni katıldım.", "Grup kuralları neler?", "Hayırlı olsun beyler."
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
            email = f"user{i}@example.com"
            user = User(
                name=name,
                surname=surname,
                mail=email,
                password=default_pwd,
                age=random.randint(18, 50),
                birthday=date(random.randint(1975, 2005), random.randint(1, 12), random.randint(1, 28)),
                phone_number=f"+905{random.randint(100, 999)}{random.randint(1000000, 9999999)}",
                role=GlobalRole.USER,
                is_active=True
            )
            session.add(user)
            all_users.append(user)
            
        await session.flush()
        logger.info(f"{NUM_USERS} kullanıcı oluşturuldu.")

        # 3. GRUPLAR
        all_groups = []
        group_memberships = [] # (group, member_list)
        
        for i in range(1, NUM_GROUPS + 1):
            tpl = random.choice(GROUP_TEMPLATES)
            g_name = f"{tpl['name']} #{i}"
            is_approved = True if i % 5 != 0 else False # %20'si admin onayı beklesin
            
            group = Group(
                name=g_name,
                content=tpl['content'],
                is_approved=is_approved
            )
            session.add(group)
            all_groups.append(group)
            await session.flush()
            
            # Gruba bir lider ata
            leader = random.choice(all_users)
            leader_member = GroupMember(
                user_id=leader.id, 
                group_id=group.id, 
                role=GroupMemberRole.GROUP_LEADER, 
                is_approved=True
            )
            session.add(leader_member)
            
            # Rastgele 4-12 üye ekle
            members_count = random.randint(4, 12)
            group_users = random.sample(all_users, members_count)
            if leader not in group_users:
                group_users.append(leader)
            
            actual_members = [leader]
            for u in group_users:
                if u.id == leader.id: continue
                # Bazıları onay beklesin
                approved = True if random.random() > 0.15 else False
                member = GroupMember(
                    user_id=u.id, 
                    group_id=group.id, 
                    role=GroupMemberRole.USER, 
                    is_approved=approved
                )
                session.add(member)
                if approved:
                    actual_members.append(u)
            
            group_memberships.append((group, actual_members))
        
        logger.info(f"{NUM_GROUPS} grup ve üyelikleri oluşturuldu.")
        await session.flush()

        # 4. HARCAMALAR (EXPENSES)
        for group, members in group_memberships:
            if not group.is_approved: continue
            
            for _ in range(random.randint(15, EXPENSES_PER_GROUP)):
                payer = random.choice(members)
                expense = Expense(
                    group_id=group.id,
                    added_by=payer.id,
                    amount=round(random.uniform(10, 2500), 2),
                    content=random.choice(EXPENSE_CONTENTS),
                    date=date.today() - timedelta(days=random.randint(0, 60)),
                    created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 60), hours=random.randint(0, 23))
                )
                session.add(expense)
        
        logger.info("Grup harcamaları oluşturuldu.")
        await session.flush()

        # 5. MESAJLAR (CHAT)
        for group, members in group_memberships:
            if not group.is_approved: continue
            
            for _ in range(random.randint(10, MESSAGES_PER_GROUP)):
                sender = random.choice(members)
                msg = Message(
                    group_id=group.id,
                    sender_id=sender.id,
                    message_text=random.choice(MESSAGES),
                    timestamp=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30), minutes=random.randint(0, 1440))
                )
                session.add(msg)
        
        logger.info("Grup mesajları (chat) oluşturuldu.")
        await session.flush()

        # 6. ŞİKAYETLER (REPORTS)
        # Mevcut mesajlardan bazılarını şikayet et
        stmt_msgs = select(Message).limit(100)
        messages_result = await session.scalars(stmt_msgs)
        all_msgs = list(messages_result)

        for _ in range(REPORTS_COUNT):
            reporter = random.choice(all_users)
            target_user = random.choice(all_users)
            target_msg = random.choice(all_msgs) if (all_msgs and random.random() > 0.4) else None
            
            report = Report(
                reporter_id=reporter.id,
                reported_user_id=target_user.id if not target_msg else None,
                reported_message_id=target_msg.id if target_msg else None,
                category=random.choice(CATEGORIES),
                aciklama=random.choice(REPORT_REASONS),
                status=random.choice(list(ReportStatus)),
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 15))
            )
            session.add(report)
        
        logger.info("Sistem şikayetleri oluşturuldu.")

        # 7. TAKİPÇİLER (SOCIAL)
        for _ in range(FOLLOWS_COUNT):
            f1, f2 = random.sample(all_users, 2)
            stmt = insert(follower_table).values(
                follower_id=f1.id,
                following_id=f2.id,
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 60))
            )
            try:
                await session.execute(stmt)
            except: 
                pass

        logger.info("Sosyal ağ bağlantıları oluşturuldu.")

        await session.commit()
        logger.info("TÜM VERİLER BAŞARIYLA KAYDEDİLDİ!")
        logger.info("Admin: admin@admin.com / 123")
        logger.info("Test User: user16@example.com / 123")

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