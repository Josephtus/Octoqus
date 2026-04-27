import asyncio
import random
import secrets
import string
import structlog
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import insert, select
from sqlalchemy.orm import selectinload

from src.database import engine, Base, dispose_engine, get_session
from src.models import (
    User, Group, GroupMember, GlobalRole, GroupMemberRole, 
    Message, Report, ReportStatus, follower_table, Expense, 
    SettlementStatus, AuditLog, GroupBan
)
from src.services.security import hash_password

logger = structlog.get_logger(__name__)

def gen_invite_code(length=12):
    chars = string.ascii_uppercase + string.digits
    return "#" + "".join(secrets.choice(chars) for _ in range(length))

async def _get_auto_nickname(session, user_id: int, group_name: str, exclude_group_id: int | None = None) -> str | None:
    stmt = (
        select(Group.name, GroupMember.nickname)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == user_id, GroupMember.is_approved.is_(True))
    )
    if exclude_group_id:
        stmt = stmt.where(Group.id != exclude_group_id)
        
    result = await session.execute(stmt)
    rows = result.all()
    has_same_name = any(row.name == group_name for row in rows)
    if not has_same_name:
        return None
    used_labels = [row.nickname if row.nickname else row.name for row in rows]
    count = 2
    while f"{group_name}({count})" in used_labels:
        count += 1
    return f"{group_name}({count})"

# MEGA SEEDER AYARLARI
NUM_USERS = 800
NUM_GROUPS = 150
EXPENSES_PER_GROUP = 60
MESSAGES_PER_GROUP = 80
REPORTS_COUNT = 150
FOLLOWS_COUNT = 4000

# GERÇEKÇİ VERİ LİSTELERİ
NAMES = ["Can", "Mert", "Deniz", "Ece", "Burak", "Zeynep", "Ali", "Ayşe", "Fatma", "Mehmet", "Ahmet", "Selin", "Derya", "Oğuz", "Aslı", "Kerem", "Gökhan", "İrem", "Büşra", "Emre", "Sibel", "Tuna", "Lara", "Cem", "Gizem", "Onur", "Melis", "Bora", "İdil", "Efe", "Ada", "Kaan", "Nil", "Eren", "Derin", "Arda", "Pelin", "Tolga", "Sude", "Mete", "Umut", "Beren", "Sarp", "Mira", "Taylan", "Yeliz", "Batu", "Selinay", "Koray", "Damla", "Caner", "Ezgi"]
SURNAMES = ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Öztürk", "Arslan", "Doğan", "Kılıç", "Aydın", "Özkan", "Aslan", "Bulut", "Yıldız", "Güneş", "Korkmaz", "Erdoğan", "Yavuz", "Tekin", "Aksoy", "Kocaman", "Sarı", "Kurt", "Özcan", "Ünal", "Güler", "Yalçın", "Gül", "Polat", "Keskin", "Turan", "Avcı", "Eren", "Taş", "Koç", "Yiğit", "Gök", "Şen"]

GROUP_TEMPLATES = [
    {"name": "Eskişehir Ev", "content": "Kira, faturalar ve mutfak masrafları ortak."},
    {"name": "Yaz Tatili", "content": "Tatil ulaşım, konaklama ve yemek giderleri."},
    {"name": "Ofis Kahve Fonu", "content": "Haftalık kahve ve atıştırmalık masrafları."},
    {"name": "Halı Saha Ekibi", "content": "Saha kirası ve maç sonu su giderleri."},
    {"name": "Doğum Günü", "content": "Sürpriz parti masrafları."},
    {"name": "Kyk Yurdu 4. Kat", "content": "Ortak alınan temizlik malzemeleri."},
    {"name": "Üniversite Projesi", "content": "Kırtasiye ve yemek masrafları."},
    {"name": "Akşam Yemeği Kulübü", "content": "Her hafta farklı bir yerde yemek."},
    {"name": "Kamp Meraklıları", "content": "Çadır, ekipman ve kamp yeri ücretleri."},
    {"name": "Yol Arkadaşları", "content": "Akaryakıt ve otoban geçiş ücretleri."},
    {"name": "Oyun Gecesi", "content": "Pizza ve atıştırmalık giderleri."},
    {"name": "Kayak Tatili", "content": "Skipass ve ekipman kiralama."},
    {"name": "Yatırım Kulübü", "content": "Ortak alınan kitaplar ve abonelikler."},
    {"name": "Müzik Grubu", "content": "Stüdyo kirası ve tel masrafları."},
    {"name": "Yoga Sınıfı", "content": "Hoca ücreti ve salon gideri."},
    {"name": "Ankara Ev", "content": "Ankara'daki paylaşımlı ev giderleri."},
    {"name": "İstanbul Gezisi", "content": "Hafta sonu İstanbul turu giderleri."},
    {"name": "Beslenme Grubu", "content": "Sporcu gıdaları ve ortak alışveriş."}
]

EXPENSE_DATA = [
    {"content": "Market Alışverişi", "category": "Market", "min": 200, "max": 2000},
    {"content": "Elektrik Faturası", "category": "Fatura", "min": 400, "max": 1500},
    {"content": "Su Faturası", "category": "Fatura", "min": 100, "max": 500},
    {"content": "İnternet", "category": "Fatura", "min": 200, "max": 600},
    {"content": "Doğalgaz", "category": "Fatura", "min": 600, "max": 4000},
    {"content": "Pizza Siparişi", "category": "Gıda", "min": 400, "max": 1500},
    {"content": "Uber / Taksi", "category": "Ulaşım", "min": 100, "max": 800},
    {"content": "Saha Kirası", "category": "Eğlence", "min": 800, "max": 1200},
    {"content": "Kahve / Starbucks", "category": "İçecek", "min": 200, "max": 500},
    {"content": "Kırtasiye", "category": "Eğitim", "min": 100, "max": 500},
    {"content": "Akşam Yemeği", "category": "Gıda", "min": 1000, "max": 6000},
    {"content": "Sinema Bileti", "category": "Eğlence", "min": 300, "max": 800},
    {"content": "Kira Ödemesi", "category": "Barınma", "min": 8000, "max": 35000}
]

MESSAGES = [
    "Selam, market alışverişini kim yaptı?", "Faturayı ödedim, sisteme ekliyorum.", 
    "Bu ayki masraflar biraz fazla.", "Fişi buraya atıyorum.",
    "Bana borcu olanlar ödeme yapabilir mi?", "Ödemeleri aksatmayalım.",
    "Harika bir gündü!", "Haftaya plan var mı?",
    "Harcamayı girdim, onaylar mısınız?", "Oğuz borcun hala duruyor.",
    "Selam, yeni üye alıyor muyuz?", "Akşam buluşuyor muyuz?",
    "Ben ödememi yaptım.", "Fiyatlar çok artmış.",
    "Yeni katıldım, selamlar.", "Grup kuralları nedir?",
    "Borçları kapatalım artık.", "Ekmek almayı unutmayın.",
    "Saha kirası ne kadar tuttu?", "Herkes payına düşeni ödesin."
]

REPORT_REASONS = [
    "Sürekli küfür ediyor.", "Spam yapıyor.", "Borcunu ödemiyor.",
    "Taciz edici mesaj.", "Sahte makbuz.", "Hakaret ediyor."
]
REPORT_CATEGORIES = ["HAKARET", "DOLANDIRICILIK", "SPAM", "UYGUNSUZ_İÇERİK", "DİĞER"]

async def reset_database():
    logger.info("Veritabanı sıfırlanıyor...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Tablolar oluşturuldu.")

async def seed_data():
    logger.info("Mega Seeding başlatıldı...")
    async with get_session() as session:
        default_pwd = hash_password("123")
        
        # 1. ADMIN
        admin = User(
            name="Sistem", surname="Yöneticisi", mail="admin@octoqus.com", password=default_pwd, 
            age=30, birthday=date(1994, 1, 1), phone_number="+900000000000", 
            role=GlobalRole.ADMIN, is_active=True
        )
        session.add(admin)
        
        # 2. KULLANICILAR
        all_users = []
        for i in range(1, NUM_USERS + 1):
            user = User(
                name=random.choice(NAMES), surname=random.choice(SURNAMES), 
                mail=f"user{i}@octoqus.com", password=default_pwd,
                age=random.randint(18, 55), birthday=date(random.randint(1975, 2005), random.randint(1, 12), random.randint(1, 28)),
                phone_number=f"+905{random.randint(30, 59)}{random.randint(100, 999)}{random.randint(1000, 9999)}",
                role=GlobalRole.USER, is_active=True
            )
            session.add(user)
            all_users.append(user)
        await session.flush()
        logger.info(f"{NUM_USERS} kullanıcı oluşturuldu.")

        # 3. GRUPLAR & ÜYELİKLER
        all_groups = []
        for i in range(1, NUM_GROUPS + 1):
            tpl = random.choice(GROUP_TEMPLATES)
            is_approved = random.random() > 0.10 # %90 onaylı
            
            group = Group(
                name=f"{tpl['name']} #{i}", 
                content=tpl['content'], 
                is_approved=is_approved,
                invite_code=gen_invite_code()
            )
            session.add(group)
            await session.flush()
            all_groups.append(group)
            
            # Lider
            leader = random.choice(all_users)
            # Lider için nickname kontrolü
            auto_nick = await _get_auto_nickname(session, leader.id, group.name, exclude_group_id=group.id)
            session.add(GroupMember(user_id=leader.id, group_id=group.id, role=GroupMemberRole.GROUP_LEADER, is_approved=True, nickname=auto_nick))
            
            # Üyeler
            members_count = random.randint(4, 12)
            potential_members = random.sample(all_users, members_count)
            for u in potential_members:
                if u.id == leader.id: continue
                approved = random.random() > 0.20 # %80 onaylı
                # Onaylı ise nickname kontrolü
                auto_nick = None
                if approved:
                    auto_nick = await _get_auto_nickname(session, u.id, group.name, exclude_group_id=group.id)
                
                session.add(GroupMember(user_id=u.id, group_id=group.id, role=GroupMemberRole.USER, is_approved=approved, nickname=auto_nick))
        
        await session.flush()
        logger.info(f"{NUM_GROUPS} grup ve ilişkili üyelikler oluşturuldu.")

        # 4. HARCAMALAR & HESAPLAŞMALAR
        for group in all_groups:
            if not group.is_approved: continue
            
            stmt = select(User).join(GroupMember).where(GroupMember.group_id == group.id, GroupMember.is_approved == True)
            members = (await session.scalars(stmt)).all()
            if not members: continue

            # Harcamalar
            for _ in range(random.randint(15, EXPENSES_PER_GROUP)):
                payer = random.choice(members)
                item = random.choice(EXPENSE_DATA)
                days_ago = random.randint(0, 150)
                expense = Expense(
                    group_id=group.id, added_by=payer.id,
                    amount=round(random.uniform(item["min"], item["max"]), 2),
                    content=item["content"], category=item["category"],
                    date=date.today() - timedelta(days=days_ago),
                    created_at=datetime.now(timezone.utc) - timedelta(days=days_ago, hours=random.randint(0, 23)),
                    is_deleted=False, is_settlement=False
                )
                session.add(expense)
            
            # Hesaplaşmalar
            for _ in range(random.randint(1, 4)):
                p1, p2 = random.sample(members, 2)
                status = random.choice(list(SettlementStatus))
                session.add(Expense(
                    group_id=group.id, added_by=p1.id, recipient_id=p2.id,
                    amount=round(random.uniform(100, 1000), 2),
                    content="Borç Transferi", date=date.today() - timedelta(days=random.randint(0, 30)),
                    is_settlement=True, settlement_status=status, is_deleted=False
                ))
        
        await session.flush()
        logger.info("Harcamalar ve hesaplaşmalar eklendi.")

        # 5. MESAJLAR
        for group in all_groups:
            if not group.is_approved: continue
            stmt = select(User).join(GroupMember).where(GroupMember.group_id == group.id, GroupMember.is_approved == True)
            members = (await session.scalars(stmt)).all()
            if not members: continue

            for _ in range(random.randint(10, MESSAGES_PER_GROUP)):
                sender = random.choice(members)
                msg = Message(
                    group_id=group.id, sender_id=sender.id,
                    message_text=random.choice(MESSAGES),
                    timestamp=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30), minutes=random.randint(0, 1440))
                )
                session.add(msg)
        
        await session.flush()
        logger.info("Grup içi mesajlar oluşturuldu.")

        # 6. ŞİKAYETLER
        stmt_msgs = select(Message).limit(300)
        all_msgs = (await session.scalars(stmt_msgs)).all()

        for _ in range(REPORTS_COUNT):
            reporter = random.choice(all_users)
            target_user = random.choice(all_users)
            target_msg = random.choice(all_msgs) if (all_msgs and random.random() > 0.4) else None
            
            session.add(Report(
                reporter_id=reporter.id,
                reported_user_id=target_user.id if not target_msg else None,
                reported_message_id=target_msg.id if target_msg else None,
                category=random.choice(REPORT_CATEGORIES),
                aciklama=random.choice(REPORT_REASONS),
                status=random.choice(list(ReportStatus)),
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 25))
            ))
        logger.info("Şikayetler eklendi.")

        # 7. SOSYAL AĞ
        for _ in range(FOLLOWS_COUNT):
            f1, f2 = random.sample(all_users, 2)
            stmt = insert(follower_table).values(
                follower_id=f1.id, following_id=f2.id,
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 60))
            )
            try: await session.execute(stmt)
            except: pass
        logger.info("Takip ilişkileri eklendi.")

        # 8. DENETİM KAYITLARI
        for _ in range(40):
            session.add(AuditLog(
                admin_id=admin.id,
                process_performed=random.choice(["KULLANICI_ENGELLE", "GRUP_SIL", "HARCAMA_KALDIR", "RAPOR_INCELE"]),
                content="Otomatik sistem denetim kaydı",
                timestamp=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 10))
            ))

        await session.commit()
        logger.info("=== MEGA SEEDING TAMAMLANDI ===")
        logger.info(f"Admin: admin@octoqus.com / 123")
        logger.info(f"Veriler: {NUM_USERS} Kullanıcı, {NUM_GROUPS} Grup, Binlerce İşlem.")

async def main():
    try:
        await reset_database()
        await seed_data()
    except Exception as e:
        logger.error(f"Hata: {str(e)}")
        import traceback; traceback.print_exc()
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())