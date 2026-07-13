#!/bin/bash
# ==============================================================================
# Octoqus - Full System Backup (Database + All Uploads)
# ==============================================================================

# 1. Ortam Hazırlığı
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# .env dosyasını yükle (Veritabanı şifreleri için)
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
else
    echo "HATA: .env dosyası bulunamadı!"
    exit 1
fi

# 2. Yolları Belirle
# Docker volume yolunu bul (Faturalar + Avatarlar buradadır)
VOLUME_PATH=$(docker volume inspect octoqus_uploads_data -f '{{ .Mountpoint }}' 2>/dev/null)
if [ -z "$VOLUME_PATH" ]; then
    echo "HATA: 'octoqus_uploads_data' volume'u bulunamadı!"
    exit 1
fi

# 3. Veritabanı Yedeği Al (MySQL Dump)
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
DB_BACKUP_FILE="/tmp/octoqus_full_db_$BACKUP_DATE.sql"

echo ">>> Veritabanı yedeği alınıyor..."
docker exec octoqus_db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" > "$DB_BACKUP_FILE"

# 4. Google Drive'a Yükleme
echo ">>> Dosyalar (Faturalar + Avatarlar) senkronize ediliyor..."
# Tüm uploads klasörünü (receipts, avatars vs.) 'files' klasörüne sync eder
rclone sync "$VOLUME_PATH" gdrive:Octoqus_Backup/files -v

echo ">>> Veritabanı yedeği gönderiliyor..."
rclone copy "$DB_BACKUP_FILE" gdrive:Octoqus_Backup/database -v

# 5. Temizlik (Son 24 Saat Kuralı)
echo ">>> Eski yedekler temizleniyor (24 saatten eskiler)..."
# Drive üzerindeki 'database' klasöründe 24 saatten eski dosyaları siler
rclone delete --min-age 24h gdrive:Octoqus_Backup/database

# Lokal geçici dosyayı sil
rm "$DB_BACKUP_FILE"

echo "======================================================"
echo "İŞLEM TAMAMLANDI: $(date)"
echo "Tüm sistem (DB + Uploads) başarıyla yedeklendi."
echo "Google Drive: Octoqus_Backup/"
echo "======================================================"
