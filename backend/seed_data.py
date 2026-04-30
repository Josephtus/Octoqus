import asyncio
import random
import structlog
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import select
from src.database import engine, Base, dispose_engine, get_session
from src.models import (
    User, Group, GroupMember, GlobalRole, GroupMemberRole, 
    Message, Report, ReportStatus, Friendship, FriendshipStatus, Expense, 
    SettlementStatus, AuditLog
)
from src.services.security import hash_password
from src.services.common import generate_invite_code

logger = structlog.get_logger(__name__)

# --- YAPILANDIRMA ---
NUM_USERS = 100
NUM_GROUPS = 20
EXPENSES_PER_GROUP = 25
MESSAGES_PER_GROUP = 40
FRIENDSHIPS_COUNT = 300
REPORTS_COUNT = 30

# --- VERİ SETLERİ ---
NAMES = ["Ali", "Ayşe", "Mehmet", "Fatma", "Can", "Zeynep", "Mert", "Ece", "Burak", "Selin", "Deniz", "İrem", "Emre", "Büşra", "Gökhan", "Gizem"]
SURNAMES = ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Öztürk", "Arslan", "Doğan", "Kılıç", "Aydın"]
GROUP_NAMES = [
    ("Eskişehir Evi", "Ev arkadaşları masraf paylaşımı"),
    ("Yaz Tatili 2026", "Antalya tatili ulaşım ve konaklama"),
    ("Ofis Kahve Grubu", "Haftalık kahve ve atıştırmalıklar"),
    ("Halı Saha Ekibi", "Saha kirası ve su masrafları"),
    ("Yol Arkadaşları", "Yakıt ve otoban giderleri"),
    ("Oyun Gecesi", "Pizza ve oyun abonelikleri"),
    ("Yatırım Kulübü", "Ortak alınan eğitim ve kitaplar")
]
CATEGORIES = ["Market", "Fatura", "Gıda", "Ulaşım", "Eğlence", "Eğitim", "Diğer"]
CHAT_MESSAGES = [
    "Selam çocuklar, faturayı kim ödedi?",
    "Market alışverişini sisteme girdim.",
    "Bana borcu olanlar ödeme yapabilir mi?",
    "Harika bir akşamdı, teşekkürler!",
    "Ödemeyi yaptım, onaylar mısın?",
    "Bu ay masraflar biraz fazla çıktı.",
    "Yeni harcama ekledim, fişi Drive'da.",
    "Arkadaşlar kirayı unutmayalım."
]

async def seed_test_data():
    logger.info("seed.test_data_started")
    async with get_session() as session:
        # 1. Mevcut Admin'i bul (Hata almamak için)
        stmt_admin = select(User).where(User.role == GlobalRole.ADMIN)
        admin = await session.scalar(stmt_admin)
        
        default_pwd = hash_password("123456")
        
        # 2. Kullanıcılar
        users = []
        logger.info("seed.creating_users", count=NUM_USERS)
        for i in range(NUM_USERS):
            user = User(
                name=random.choice(NAMES),
                surname=random.choice(SURNAMES),
                mail=f"testuser{i}@example.com",
                password=default_pwd,
                age=random.randint(18, 50),
                birthday=date(random.randint(1980, 2005), random.randint(1, 12), random.randint(1, 28)),
                phone_number=f"+905{random.randint(300, 599)}{random.randint(1000000, 9999999)}",
                role=GlobalRole.USER,
                is_active=True,
                invite_code=generate_invite_code()
            )
            session.add(user)
            users.append(user)
        
        await session.flush()

        # 3. Gruplar ve Üyelikler
        groups = []
        logger.info("seed.creating_groups", count=NUM_GROUPS)
        for i in range(NUM_GROUPS):
            g_name, g_content = random.choice(GROUP_NAMES)
            group = Group(
                name=f"{g_name} #{i+1}",
                content=g_content,
                is_approved=True,
                invite_code=generate_invite_code()
            )
            session.add(group)
            await session.flush()
            groups.append(group)
            
            # Her gruba 5-15 rastgele üye ekle
            group_members = random.sample(users, random.randint(5, 15))
            for idx, member in enumerate(group_members):
                role = GroupMemberRole.GROUP_LEADER if idx == 0 else GroupMemberRole.USER
                gm = GroupMember(
                    user_id=member.id,
                    group_id=group.id,
                    role=role,
                    is_approved=True
                )
                session.add(gm)
            
            # 4. Harcamalar
            for _ in range(random.randint(10, EXPENSES_PER_GROUP)):
                payer = random.choice(group_members)
                amount = round(random.uniform(50, 2500), 2)
                cat = random.choice(CATEGORIES)
                expense = Expense(
                    group_id=group.id,
                    added_by=payer.id,
                    amount=amount,
                    content=f"{cat} Masrafı",
                    category=cat,
                    date=date.today() - timedelta(days=random.randint(0, 30)),
                    is_deleted=False
                )
                session.add(expense)

            # 5. Mesajlar
            for _ in range(random.randint(10, MESSAGES_PER_GROUP)):
                sender = random.choice(group_members)
                msg = Message(
                    group_id=group.id,
                    sender_id=sender.id,
                    message_text=random.choice(CHAT_MESSAGES),
                    timestamp=datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 100))
                )
                session.add(msg)

        # 6. Arkadaşlıklar
        logger.info("seed.creating_friendships")
        friendships_added = set()
        count = 0
        while count < FRIENDSHIPS_COUNT:
            u1, u2 = random.sample(users, 2)
            # Çift yönlü kontrol için sıralı tuple kullan
            pair = tuple(sorted((u1.id, u2.id)))
            if pair not in friendships_added:
                status = random.choice([FriendshipStatus.ACCEPTED, FriendshipStatus.PENDING])
                session.add(Friendship(user_id=u1.id, friend_id=u2.id, status=status))
                friendships_added.add(pair)
                count += 1

        # 7. Şikayetler (Rastgele mesajları şikayet et)
        logger.info("seed.creating_reports")
        await session.flush() # Mesaj ID'lerini almak için
        stmt_msgs = select(Message).limit(100)
        messages_to_report = (await session.scalars(stmt_msgs)).all()
        
        for _ in range(REPORTS_COUNT):
            reporter = random.choice(users)
            msg = random.choice(messages_to_report)
            report = Report(
                reporter_id=reporter.id,
                reported_message_id=msg.id,
                category="GENEL",
                aciklama="Uygunsuz içerik bildirimi.",
                status=ReportStatus.PENDING
            )
            session.add(report)

        await session.commit()
        logger.info("seed.test_data_success")
        print("\n✅ Kapsamlı test verileri başarıyla eklendi!")
        print(f"👥 {NUM_USERS} Kullanıcı")
        print(f"🏠 {NUM_GROUPS} Grup")
        print(f"💰 Binlerce Harcama ve Mesaj\n")

async def main():
    try:
        await seed_test_data()
    except Exception as e:
        logger.error("seed.main_failed", error=str(e))
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())
