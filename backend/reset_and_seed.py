import asyncio
import random
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

# MEGA SEEDER AYARLARI
NUM_USERS = 350
NUM_GROUPS = 70
EXPENSES_PER_GROUP = 50
MESSAGES_PER_GROUP = 60
REPORTS_COUNT = 80
FOLLOWS_COUNT = 1500

# GERÇEKÇİ VERİ LİSTELERİ
NAMES = ["Can", "Mert", "Deniz", "Ece", "Burak", "Zeynep", "Ali", "Ayşe", "Fatma", "Mehmet", "Ahmet", "Selin", "Derya", "Oğuz", "Aslı", "Kerem", "Gökhan", "İrem", "Büşra", "Emre", "Sibel", "Tuna", "Lara", "Cem", "Gizem", "Onur", "Melis", "Bora", "İdil", "Efe", "Ada", "Kaan", "Nil", "Eren", "Derin", "Arda", "Pelin", "Tolga", "Sude", "Mete", "Umut", "Beren"]
SURNAMES = ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Öztürk", "Arslan", "Doğan", "Kılıç", "Aydın", "Özkan", "Aslan", "Bulut", "Yıldız", "Güneş", "Korkmaz", "Erdoğan", "Yavuz", "Tekin", "Aksoy", "Kocaman", "Sarı", "Kurt", "Özcan", "Ünal", "Güler", "Yalçın", "Gül", "Polat", "Keskin", "Turan", "Avcı"]

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
    {"name": "Yol Arkadaşları", "content": "Akaryakıt ve otoban geçiş ücretleri."},
    {"name": "Oyun Gecesi", "content": "Pizza ve atıştırmalık giderleri."},
    {"name": "Kedi Maması Fonu", "content": "Sokak hayvanları için ortak mama alımı."},
    {"name": "Kayak Tatili", "content": "Skipass ve ekipman kiralama."},
    {"name": "Yatırım Kulübü", "content": "Ortak alınan kitaplar ve abonelikler."},
    {"name": "Müzik Grubu", "content": "Stüdyo kirası ve tel masrafları."},
    {"name": "Yoga Sınıfı", "content": "Hoca ücreti ve salon gideri."}
]

EXPENSE_DATA = [
    {"content": "Market Alışverişi", "category": "Market Alışverişi", "min": 200, "max": 1500},
    {"content": "Elektrik Faturası", "category": "Fatura", "min": 300, "max": 1200},
    {"content": "Su Faturası", "category": "Fatura", "min": 100, "max": 400},
    {"content": "İnternet", "category": "Fatura", "min": 150, "max": 450},
    {"content": "Doğalgaz", "category": "Fatura", "min": 500, "max": 3000},
    {"content": "Pizza Siparişi", "category": "Restoranlar ve Barlar", "min": 400, "max": 1200},
    {"content": "Uber / Taksi", "category": "Transport", "min": 80, "max": 600},
    {"content": "Saha Kirası", "category": "Eğlence", "min": 500, "max": 1000},
    {"content": "Kahve / Starbucks", "category": "Restoranlar ve Barlar", "min": 150, "max": 400},
    {"content": "Kırtasiye", "category": "Shopping", "min": 50, "max": 300},
    {"content": "Akşam Yemeği", "category": "Restoranlar ve Barlar", "min": 800, "max": 4000},
    {"content": "Sinema Bileti", "category": "Eğlence", "min": 200, "max": 600},
    {"content": "Kira Ödemesi", "category": "Kira ve Masraflar", "min": 5000, "max": 25000},
    {"content": "Damacana Su", "category": "İçme suyu", "min": 60, "max": 180},
    {"content": "Halı Yıkama", "category": "Halı Yıkama", "min": 400, "max": 1500},
    {"content": "Kasap / Et Alımı", "category": "Kasap", "min": 600, "max": 3500},
    {"content": "Yufka / Kahvaltılık", "category": "Yufkacı", "min": 100, "max": 350}
]

MESSAGES = [
    "Selam beyler, dünkü market alışverişini kim ödedi?", "Faturayı ödedim, masrafı ekliyorum.", 
    "Gruptan çıkmak isteyen var mı?", "Bu ayki kira biraz fazla geldi sanki.", "Market fişini buraya atıyorum.",
    "Bana borcu olanlar bi el kaldırsın :D", "Arkadaşlar ödemeleri aksatmayalım lütfen.",
    "Harika bir gündü, herkese teşekkürler!", "Gelecek hafta için plan yapan var mı?",
    "Harcamayı sisteme girdim, onay bekliyorum.", "Oğuz senin borcun hala duruyor haberin olsun.",
    "Selam, yeni üye kabul ediyor muyuz?", "Arkadaşlar bu akşam buluşuyor muyuz?",
    "Ben ödememi yaptım, kontrol eder misiniz?", "Fiyatlar çok artmış gerçekten.",
    "Bu hafta kimse bir şey eklemedi mi?", "Bir sonraki toplantı ne zaman?",
    "Selam, ben yeni katıldım.", "Grup kuralları neler?", "Hayırlı olsun beyler.",
    "Faturanın fotoğrafını çektim yüklüyorum.", "Borçları kapatalım artık beyler.", "Ekmek almayı unutmayın."
]

REPORT_REASONS = [
    "Sürekli küfürlü konuşuyor.", "Grupta alakasız şeyler paylaşıyor.", "Borcunu asla ödemiyor.",
    "Taciz edici mesajlar gönderiyor.", "Sahte makbuz yüklüyor.", "Sistem açığını kullanıyor.",
    "Dolandırıcılık şüphesi var.", "İnsanlara hakaret ediyor.", "Spam yapıyor."
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
        admin = User(name="Admin", surname="Octoqus", mail="admin@admin.com", password=default_pwd, age=30, birthday=date(1994, 5, 15), phone_number="+905000000000", role=GlobalRole.ADMIN, is_active=True)
        session.add(admin)
        
        # 2. KULLANICILAR
        all_users = []
        for i in range(1, NUM_USERS + 1):
            name = random.choice(NAMES)
            surname = random.choice(SURNAMES)
            user = User(
                name=name, surname=surname, mail=f"user{i}@example.com", password=default_pwd,
                age=random.randint(18, 55), birthday=date(random.randint(1970, 2005), random.randint(1, 12), random.randint(1, 28)),
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
            # %15 onay bekleyen grup isteği, %5 reddedilmiş, %80 onaylı
            rand_val = random.random()
            is_approved = True if rand_val > 0.20 else False
            
            group = Group(name=f"{tpl['name']} #{i}", content=tpl['content'], is_approved=is_approved)
            session.add(group)
            await session.flush()
            all_groups.append(group)
            
            # Lider ve Üyeler
            leader = random.choice(all_users)
            session.add(GroupMember(user_id=leader.id, group_id=group.id, role=GroupMemberRole.GROUP_LEADER, is_approved=True))
            
            # Gruba katılma istekleri ve onaylı üyeler
            members_count = random.randint(5, 15)
            potential_members = random.sample(all_users, members_count)
            for u in potential_members:
                if u.id == leader.id: continue
                # %25'i katılma isteği (is_approved=False)
                approved = True if random.random() > 0.25 else False
                session.add(GroupMember(user_id=u.id, group_id=group.id, role=GroupMemberRole.USER, is_approved=approved))
        
        await session.flush()
        logger.info(f"{NUM_GROUPS} grup ve ilişkili üyelikler/istekler oluşturuldu.")

        # 4. HARCAMALAR (EXPENSES)
        for group in all_groups:
            if not group.is_approved: continue
            
            # Grubun onaylı üyelerini bul
            stmt = select(User).join(GroupMember).where(GroupMember.group_id == group.id, GroupMember.is_approved == True)
            members = (await session.scalars(stmt)).all()
            if not members: continue

            for _ in range(random.randint(20, EXPENSES_PER_GROUP)):
                payer = random.choice(members)
                item = random.choice(EXPENSE_DATA)
                days_ago = random.randint(0, 180) # Son 6 ay
                expense = Expense(
                    group_id=group.id, added_by=payer.id,
                    amount=round(random.uniform(item["min"], item["max"]), 2),
                    content=item["content"], category=item["category"],
                    date=date.today() - timedelta(days=days_ago),
                    created_at=datetime.now(timezone.utc) - timedelta(days=days_ago, hours=random.randint(0, 23)),
                    is_deleted=False, is_settlement=False
                )
                session.add(expense)
            
            # ── Hesaplaşmalar (Settlements) ──
            # Her gruba birkaç tane örnek ödeme bildirimi ekle
            for _ in range(random.randint(2, 5)):
                p1, p2 = random.sample(members, 2)
                days_ago = random.randint(0, 10)
                status = random.choice(list(SettlementStatus))
                
                settlement = Expense(
                    group_id=group.id, 
                    added_by=p1.id, 
                    recipient_id=p2.id,
                    amount=round(random.uniform(50, 500), 2),
                    content=f"Borç Ödemesi ({status.value})",
                    date=date.today() - timedelta(days=days_ago),
                    is_settlement=True,
                    settlement_status=status,
                    is_deleted=False
                )
                session.add(settlement)
        
        await session.flush()
        logger.info("Harcamalar ve hesaplaşma örnekleri eklendi.")

        # 5. MESAJLAR (CHAT)
        for group in all_groups:
            if not group.is_approved: continue
            stmt = select(User).join(GroupMember).where(GroupMember.group_id == group.id, GroupMember.is_approved == True)
            members = (await session.scalars(stmt)).all()
            if not members: continue

            for _ in range(random.randint(15, MESSAGES_PER_GROUP)):
                sender = random.choice(members)
                msg = Message(
                    group_id=group.id, sender_id=sender.id,
                    message_text=random.choice(MESSAGES),
                    timestamp=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30), minutes=random.randint(0, 1440))
                )
                session.add(msg)
        
        await session.flush()
        logger.info("Grup içi mesajlaşmalar oluşturuldu.")

        # 6. ŞİKAYETLER (REPORTS)
        stmt_msgs = select(Message).limit(200)
        all_msgs = (await session.scalars(stmt_msgs)).all()

        for _ in range(REPORTS_COUNT):
            reporter = random.choice(all_users)
            target_user = random.choice(all_users)
            target_msg = random.choice(all_msgs) if (all_msgs and random.random() > 0.5) else None
            
            report = Report(
                reporter_id=reporter.id,
                reported_user_id=target_user.id if not target_msg else None,
                reported_message_id=target_msg.id if target_msg else None,
                category=random.choice(REPORT_CATEGORIES),
                aciklama=random.choice(REPORT_REASONS),
                status=random.choice(list(ReportStatus)),
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 20))
            )
            session.add(report)
        
        logger.info("Şikayetler ve raporlar eklendi.")

        # 7. SOSYAL AĞ
        for _ in range(FOLLOWS_COUNT):
            f1, f2 = random.sample(all_users, 2)
            stmt = insert(follower_table).values(
                follower_id=f1.id, following_id=f2.id,
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 90))
            )
            try: await session.execute(stmt)
            except: pass
        
        logger.info("Sosyal ağ (takipçiler) oluşturuldu.")

        # 8. AUDIT LOGS & BANS (Örnek)
        for _ in range(20):
            admin_user = admin
            log = AuditLog(
                admin_id=admin_user.id,
                process_performed=random.choice(["USER_BAN", "GROUP_DELETE", "EXPENSE_CLEAN"]),
                content="Örnek denetim kaydı",
                timestamp=datetime.now(timezone.utc)
            )
            session.add(log)
            
            if random.random() > 0.7:
                target_g = random.choice(all_groups)
                target_u = random.choice(all_users)
                ban = GroupBan(group_id=target_g.id, user_id=target_u.id)
                session.add(ban)

        await session.commit()
        logger.info("=== SEEDING TAMAMLANDI ===")
        logger.info("Admin: admin@admin.com / 123")
        logger.info(f"Toplam Veri: {NUM_USERS} Kullanıcı, {NUM_GROUPS} Grup, Binlerce Harcama/Mesaj.")

async def main():
    try:
        await reset_database()
        await seed_data()
    except Exception as e:
        logger.error(f"Seeding hatası: {str(e)}")
        import traceback; traceback.print_exc()
    finally:
        await dispose_engine()

if __name__ == "__main__":
    asyncio.run(main())