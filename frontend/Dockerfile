# =============================================================================
# Frontend Dockerfile - Multi-stage Production Build
# Stage 1: Build → Stage 2: Serve via Nginx
# =============================================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Paket dosyalarını önce kopyala (cache optimizasyonu)
COPY package.json package-lock.json* ./

RUN npm ci --production=false

# Kaynak kodunu kopyala
COPY . .

# Production build (Vite)
RUN npm run build

# --- Stage 2: Serve ---
FROM nginx:alpine

# Nginx yapılandırması
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build çıktısını Nginx'e kopyala
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
