-- =============================================================================
-- init_db/00_charset.sql
-- MySQL charset & collation defaults - Alembic migration öncesi temel ayarlar
-- =============================================================================

SET NAMES utf8mb4;
SET character_set_client = utf8mb4;

-- Veritabanı varsayılan charset'i güncelle
ALTER DATABASE expense_tracking
    CHARACTER SET = utf8mb4
    COLLATE = utf8mb4_unicode_ci;
