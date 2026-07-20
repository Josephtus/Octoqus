# 🎯 Octoqus - Harcama Takip & Sosyal Finans Platformu

<div align="center">
  <img src="./assets/mainpage.png" alt="Octoqus Hero Desktop" width="100%">
</div>

> **Production-ready full-stack web application** için harcama yönetimi ve sosyal finansal işbirliği sunan modern bir platform.

---

## 📋 Özet

**OctoqusLive**, kullanıcıların kişisel harcamalarını takip edebileceği, grup içerisinde harcamaları yönetebileceği ve sosyal ağ benzeri bir ortamda finans konularını paylaşabildiği full-stack bir web uygulamasıdır. Platform, modern web teknolojileri ile geliştirilmiş, **production-grade** mimarisi ve güvenlik standartları ile hayata geçirilmiştir.

**Production URL:** https://octoqus.com

<div align="center">
  <img src="./assets/mobil_design.png" alt="Octoqus Mobile Presentation" width="100%">
</div>

---

## 🏗️ Teknik Mimari

### Tech Stack

| Bileşen | Teknoloji |
|---------|-----------|
| **Frontend** | React 19 + TypeScript + Vite |
| **Styling** | Tailwind CSS 4 + Framer Motion (Animasyonlar) |
| **State Management** | Zustand (Lightweight + Reactive) |
| **Validation** | Zod + React Hook Form |
| **Testing** | Vitest + Playwright (E2E) |
| **Backend** | Python 3.11 + Sanic (Async Framework) |
| **ORM** | SQLAlchemy 2.0 (Async) |
| **Database** | MySQL 8.0 |
| **Cache & Pub/Sub** | Redis 7 |
| **API Documentation** | OpenAPI 3.0 (Swagger) |
| **Infrastructure** | Docker + Docker Compose |
| **Web Server** | Nginx (Reverse Proxy + SSL) |
| **SSL Certificates** | Let's Encrypt (Certbot) |

### Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────────┐
│                       Frontend (React + TypeScript)              │
│  - SPA: Responsive Dashboard + Real-time Chat Interface         │
│  - State: Zustand stores (Auth, Groups, User preferences)      │
└─────────────────────┬───────────────────────────────────────────┘
                      │ (HTTPS / REST API)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Nginx Reverse Proxy + SSL                      │
│  - Static file serving (React dist)                             │
│  - Backend request routing                                      │
│  - SSL/TLS termination (Let's Encrypt)                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
      ┌───────────────┼───────────────┐
      ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│    Backend   │ │   MySQL DB   │ │   Redis      │
│  Sanic API   │ │  (Relational)│ │(Cache/Pub-  │
│  (Async)     │ │              │ │ Sub/Queue)   │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## 🚀 Temel Özellikler

### 1. **Kimlik Doğrulama & Güvenlik**
- ✅ JWT-based authentication (HttpOnly Cookies + Bearer Token hybrid)
- ✅ Bcrypt password hashing (12 rounds)
- ✅ Email verification & password reset workflow
- ✅ Rate limiting (IP-based sliding window, Redis)
- ✅ CORS whitelist (production domain locked)
- ✅ Structured logging (JSON format for aggregation)

### 2. **Harcama Yönetimi**
- 📊 Kişisel harcama takibi
- 👥 Grup bazlı harcama yönetimi (shared expenses)
- 💰 Otomatik borç/alacak hesaplaması
- 📈 Export features (Excel, PDF)
- 🏷️ Kategorilendirme & filtering

### 3. **Grup Sistemi**
- 👨‍👩‍👧‍👦 Grup oluşturma ve üye yönetimi
- 📝 Gruplara katılım approval sistemi
- 🎯 Role-based permissions (User, Leader, Admin)
- 💬 Grup-specific messaging (WebSocket)

### 4. **Sosyal Ağ Özellikleri**
- 🤝 User profiles ve public sharing
- 💭 Social posts & feed
- 🗣️ Real-time messaging (WebSocket)
- 📢 Report system (Spam/abuse reporting)

### 5. **Admin Kontrol Paneli**
- 📊 User & platform statistics
- 🔍 Audit logging
- 🚫 User management & moderation
- ⚙️ System configuration

---

## 📸 Uygulama Arayüzü

<div align="center">
  <img src="./assets/panel.png" alt="Octoqus Mobile Presentation" width="100%">
  <img src="./assets/groups.png" alt="Octoqus Mobile Presentation" width="100%">
  <img src="./assets/groups2.png" alt="Octoqus Mobile Presentation" width="100%">
</div>

---

## 🔧 Kurulum & Çalıştırma

### Gereksinimler
- Docker 20.10+
- Docker Compose 1.29+
- (Development için: Node 20+, Python 3.11+)

### Production Deployment

```bash
# 1. Repository'yi klonla
git clone https://github.com/Josephtus/Octoqus.git
cd Octoqus

# 2. Environment dosyasını oluştur
cp .env.example .env

# 3. Critical .env variables (must be set):
# - MYSQL_ROOT_PASSWORD
# - MYSQL_PASSWORD
# - REDIS_PASSWORD
# - CORS_ORIGINS
# - JWT_SECRET
# - SMTP_PASSWORD (email reset için)

# 4. Docker Compose ile tüm servisleri başlat
docker-compose up -d

# 5. Database migration (production'da önceden yapılmış olmalı)
docker-compose exec backend alembic upgrade head

# 6. SSL sertifikası için Certbot'u çalıştır (ilk kez)
docker-compose run certbot certonly --webroot -w /var/www/certbot -d octoqus.com
```

### Development Kurulum

```bash
# Frontend
cd frontend
npm install
npm run dev          # Vite dev server (http://localhost:5173)
npm run test:ui      # Vitest UI
npm run test:e2e:ui  # Playwright UI

# Backend (ayrı terminal)
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
pip install -r requirements.txt

# Database setup (ilk kez)
python seed.py

# Sanic server
python -m src.main
# Server: http://localhost:8000
# API Docs: http://localhost:8000/api/docs
```

---

## 🔐 Güvenlik Özellikleri

### Backend Güvenlik

1. **Authentication Hierarchy:**
   - HttpOnly JWT cookies (XSS resistant)
   - Bearer token fallback (API clients)
   - JWT validation with `PyJWT`

2. **Authorization:**
   - RBAC (Role-Based Access Control)
   - Roles: `user`, `group_leader`, `admin`
   - Decorator-based route protection

3. **Data Protection:**
   - Bcrypt hashing (12 rounds + salt)
   - SQL injection prevention (SQLAlchemy parameterized queries)
   - MIME type validation (magic bytes detection)
   - Input validation (Pydantic schemas)

4. **API Protection:**
   - Rate limiting (configurable, default: 300-600 requests/minute)
   - CORS whitelist
   - HTTPS/SSL enforcement (production)
   - Structured logging for audit trail

### Frontend Güvenlik

1. **Token Management:**
   - HttpOnly cookies (automatic, XSS safe)
   - Token refresh logic (Zustand store)
   - Automatic logout on token expiry

2. **Input Validation:**
   - Zod schemas (type-safe validation)
   - React Hook Form integration

---

## 📊 Database Schema (High-Level)

```
Tables:
├── users (id, name, email, password_hash, role, created_at, deleted_at)
├── groups (id, name, owner_id, invite_code, created_at)
├── group_members (id, group_id, user_id, role, approved)
├── expenses (id, group_id, payer_id, amount, description, date, category)
├── expense_splits (id, expense_id, debtor_id, amount)
├── messages (id, group_id, sender_id, content, created_at)
├── posts (id, user_id, content, created_at)
├── reports (id, reporter_id, reported_entity_id, type, reason, status)
└── audit_logs (id, user_id, action, table_name, old_value, new_value, created_at)
```

---

## 📈 Performance & Scalability

| Metrik | Değer | Not |
|--------|-------|-----|
| **Frontend Build** | < 2s | Vite optimization |
| **API Response Time** | < 100ms | Redis cache + async |
| **Concurrent Users** | 1000+ | Sanic async workers |
| **Database Connections** | 20 (pool) | SQLAlchemy connection pooling |
| **Cache Layer** | Redis 7 | Rate limit + session storage |
| **Max Upload** | 10 MB | Configurable in settings |
| **Docker Image Size** | Backend: ~500MB, Frontend: ~50MB | Multi-stage builds |

---

## 🌟 Geliştirici Notları

### Dosya Yükleme Pipeline
- Avatar: `./uploads/avatars/` (5 MB max, resim tipi validasyonu)
- Receipts: `./uploads/receipts/` (10 MB max, belge desteği)
- MIME spoofing prevention: Magic bytes detection

### WebSocket (Chat)
- Redis pub/sub backend
- Sanic WebSocket handler
- Room-based messaging (per-group)

### Admin Audit Trail
- Tüm kritik işlemler JSON loglanır
- Timestamp + user_id + action tracked
- Production ELK/Loki integrasyonuna hazır

### Database Migrations
```bash
cd backend

# New migration oluştur
alembic revision --autogenerate -m "describe_change"

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

## 📝 API Endpoint Örnekleri

### Authentication
```bash
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password?token=<reset_token>
```

### Users
```bash
GET  /api/users/me
PUT  /api/users/me
PUT  /api/users/me/password
POST /api/users/me/avatar
GET  /api/users/<user_id>
```

### Groups
```bash
POST   /api/groups
GET    /api/groups
GET    /api/groups/<group_id>
PUT    /api/groups/<group_id>
POST   /api/groups/<group_id>/members
GET    /api/groups/<group_id>/expenses
```

### Expenses
```bash
POST  /api/expenses
GET   /api/expenses (with filters: group_id, date_range, category)
PUT   /api/expenses/<expense_id>
DELETE /api/expenses/<expense_id>
POST  /api/expenses/<expense_id>/export (PDF/Excel)
```

**Full OpenAPI Documentation:** `http://localhost:8000/api/docs` (Swagger UI)

---

## 🚀 Deployment Checklist

- [ ] `.env` variables configured (all required)
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] Database backups configured
- [ ] Redis persistence enabled (`appendonly yes`)
- [ ] Docker Compose healthchecks verified
- [ ] CORS origins whitelisted
- [ ] SMTP credentials for password reset
- [ ] Static files CDN configured (optional)
- [ ] Monitoring setup (logs aggregation)
- [ ] Rate limits tuned for expected traffic

---

## 📚 Dokumentasyon

- **Technical Deep-Dive:** `DOCS_PART1_BACKEND_SECURITY.md`
- **API Reference:** `http://octoqus.com/api/docs`
- **Frontend Component Library:** Storybook (in development)

---

## 🎓 Öğrenme Kaynakları

Bu projede kullanılan teknolojiler hakkında:

- **React 19 + TypeScript:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com
- **Zustand:** https://zustand-demo.vercel.app/
- **Sanic Framework:** https://sanic.dev/
- **SQLAlchemy Async:** https://docs.sqlalchemy.org/20/orm/extensions/asyncio.html
- **Docker Best Practices:** https://docs.docker.com/

---

## 🤝 Katkı Kuralları

Bu proje **personal portfolio** amaçlı olsa da, fork & improvement hoş karşılanır:

1. Repository'yi fork et
2. Feature branch oluştur (`git checkout -b feature/amazing-feature`)
3. Changes commit et (`git commit -m 'Add amazing feature'`)
4. Push et (`git push origin feature/amazing-feature`)
5. Pull Request aç

---

## 📧 İletişim

**Developer:** Yusuf Uyanoğlu (Josephtus)  
**Project URL:** https://github.com/Josephtus/Octoqus  
**Live Site:** https://octoqus.com  

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| **Repository Created** | May 1, 2026 |
| **Primary Language** | TypeScript (56.2%) |
| **Secondary Language** | Python (42.1%) |
| **Total Lines of Code** | ~15,000+ |
| **API Endpoints** | 40+ |
| **Database Tables** | 10+ |
| **Test Coverage** | In progress |

---


