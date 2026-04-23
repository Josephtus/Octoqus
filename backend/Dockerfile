# =============================================================================
# Backend Dockerfile
# Base: Python 3.11 slim - Minimal ve güvenli imaj
# =============================================================================

# --- Build Stage ---
FROM python:3.11-slim AS builder

# Sistem bağımlılıkları (mysqlclient için gcc ve dev headers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bağımlılıkları önce kopyala → Docker cache katmanı optimizasyonu
COPY requirements.txt .

# Wheel olarak derle (runner stage'e kopyalanacak)
RUN pip install --upgrade pip && \
    pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


# --- Runner Stage ---
FROM python:3.11-slim AS runner

LABEL maintainer="Expense Tracking Platform"
LABEL description="Sanic async backend for Expense Tracking & Social Finance"

# Runtime için sadece libmysqlclient (gcc yok → küçük imaj)
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-libmysqlclient-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Builder'dan derlenmiş wheel'leri al
COPY --from=builder /wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt && \
    rm -rf /wheels

# Uygulama kaynak kodunu kopyala
COPY . .

# Güvenlik: root olmayan kullanıcı
RUN addgroup --gid 1001 appgroup && \
    adduser --uid 1001 --gid 1001 --no-create-home --disabled-password appuser && \
    chown -R appuser:appgroup /app

USER appuser

# Sanic portu
EXPOSE 8000

# Sağlık kontrol endpoint'i için curl mevcut
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Uygulama başlatma komutu
# src/main.py → Sanic app instance'ı "app" adıyla export edilecek
CMD ["python", "-m", "src.main"]
