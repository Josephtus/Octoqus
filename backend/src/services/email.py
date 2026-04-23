import os
from email.message import EmailMessage

import aiosmtplib
import structlog

logger = structlog.get_logger(__name__)

async def send_password_reset_email(to_email: str, reset_token: str) -> None:
    """
    Kullanıcıya şifre sıfırlama token'ını içeren asenkron e-posta gönderir.
    SMTP ayarları .env dosyasından okunur.
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "noreply@expensetracking.com")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "True").lower() == "true"

    if not smtp_password:
        logger.warning(
            "email.missing_credentials",
            message="SMTP_PASSWORD ortam değişkeni bulunamadı. E-posta gönderimi simüle ediliyor.",
            to_email=to_email,
            reset_token=reset_token
        )
        return

    message = EmailMessage()
    message["From"] = smtp_user
    message["To"] = to_email
    message["Subject"] = "Şifre Sıfırlama İsteği - Harcama Takip ve Sosyal Finans Platformu"

    # Geliştirme/test ortamında token'ı direkt gösteriyoruz. 
    # Prodüksiyonda bu bir link (örn: frontend_url/reset-password?token=...) olmalıdır.
    body = f"""Merhaba,

Hesabınızın şifresini sıfırlamak için bir istek aldık.
Aşağıdaki token'ı kullanarak şifrenizi sıfırlayabilirsiniz:

Token: {reset_token}

Bu token 15 dakika boyunca geçerlidir.
Eğer bu isteği siz yapmadıysanız lütfen bu e-postayı dikkate almayın.

İyi günler dileriz,
Harcama Takip Yönetimi
"""
    message.set_content(body)

    try:
        await aiosmtplib.send(
            message,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_password,
            start_tls=smtp_use_tls,
        )
        logger.info("email.password_reset_sent", to_email=to_email)
    except Exception as e:
        logger.error("email.password_reset_failed", to_email=to_email, error=str(e))
        # Hata fırlatmıyoruz, ana akış kesilmesin.
