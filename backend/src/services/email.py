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
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}?token={reset_token}"

    message = EmailMessage()
    message["From"] = smtp_user
    message["To"] = to_email
    message["Subject"] = "Şifre Sıfırlama İsteği - Octoqus"

    # Plain text version
    body = f"""Şifrenizi sıfırlamak için butona tıklayabilir veya bağlantıya gidebilirsiniz.
(Bu bağlantı 15 dakika boyunca geçerlidir)

Bağlantı: {reset_link}

Bu bağlantı 15 dakika boyunca geçerlidir.
Eğer bu isteği siz yapmadıysanız lütfen bu e-postayı dikkate almayın.

İyi günler dileriz,
Octoqus Yönetimi
"""
    message.set_content(body)

    # HTML version
    html_body = f"""
    <html>
      <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #0f172a; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #f8fafc;">
          <div style="background-color: #020617; padding: 40px; border-radius: 40px; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
            <h1 style="color: #00f0ff; font-size: 28px; font-weight: 900; text-align: center; margin-bottom: 8px; letter-spacing: -0.025em;">OCTOQUS</h1>
            <p style="color: #64748b; font-size: 14px; text-align: center; margin-bottom: 40px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">Harcama Takip ve Sosyal Finans</p>
            
            <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin-bottom: 16px;">Şifre Sıfırlama</h2>
            <p style="color: #94a3b8; font-size: 16px; margin-bottom: 32px;">Merhaba, hesabınızın şifresini sıfırlamak için bir istek aldık. Yeni şifrenizi belirlemek için aşağıdaki butona tıklayabilirsiniz.</p>
            
            <div style="text-align: center; margin-bottom: 40px;">
              <a href="{reset_link}" style="display: inline-block; background-color: #00f0ff; color: #020617; padding: 16px 40px; border-radius: 20px; font-weight: 900; text-decoration: none; font-size: 14px; text-transform: uppercase; letter-spacing: 0.15em; box-shadow: 0 10px 20px rgba(0, 240, 255, 0.2);">Şifreyi Sıfırla</a>
            </div>
            
            <p style="color: #64748b; font-size: 12px; line-height: 1.8;">
              Bu bağlantı <strong>15 dakika</strong> boyunca geçerlidir. Eğer bu isteği siz yapmadıysanız, bu e-postayı güvenle görmezden gelebilirsiniz; hesabınız hala güvende.
            </p>
            
            <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
              <p style="color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Octoqus Yönetimi</p>
            </div>
          </div>
          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px;">© 2026 Octoqus Platform. Tüm hakları saklıdır.</p>
        </div>
      </body>
    </html>
    """
    message.add_alternative(html_body, subtype='html')

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
