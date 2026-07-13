import io
import structlog
from PIL import Image

logger = structlog.get_logger(__name__)

def optimize_image(image_bytes: bytes, quality: int = 80) -> bytes:
    """
    Görseli optimize eder:
    1. WebP formatına dönüştürür (daha iyi sıkıştırma için).
    2. Kalite ayarı ile dosya boyutunu düşürür.
    3. Orijinal boyutları (width/height) korur.
    
    Args:
        image_bytes: Orijinal görsel verisi
        quality: Sıkıştırma kalitesi (1-100)
        
    Returns:
        Optimize edilmiş görsel verisi (bytes)
    """
    try:
        # Görseli aç
        img = Image.open(io.BytesIO(image_bytes))
        
        # Orijinal formatı al (loglama için)
        orig_format = img.format
        
        # Eğer GIF ise veya animasyonlu ise şimdilik dokunmayalım (veya sadece kaydet)
        if hasattr(img, "is_animated") and img.is_animated:
            return image_bytes
            
        # Mod dönüşümü
        if img.mode in ("RGBA", "P"):
            # Şeffaflığı korumak için RGBA kalmalı, WebP destekler.
            pass
        else:
            img = img.convert("RGB")
            
        output = io.BytesIO()
        
        # WebP olarak kaydet. 
        # method=6: En yavaş ama en iyi sıkıştırma metodu.
        img.save(output, format="WEBP", quality=quality, method=6)
        
        optimized_bytes = output.getvalue()
        
        # Eğer optimize edilmiş hali orijinalden daha büyükse (nadir ama mümkün) orijinali dön
        if len(optimized_bytes) >= len(image_bytes):
            return image_bytes

        logger.info(
            "image.optimized", 
            original_size=len(image_bytes), 
            optimized_size=len(optimized_bytes),
            ratio=f"{(1 - len(optimized_bytes)/len(image_bytes))*100:.1f}%",
            format_change=f"{orig_format} -> WEBP"
        )
        
        return optimized_bytes
    except Exception as e:
        logger.error("image.optimization_failed", error=str(e))
        # Hata durumunda orijinali dön (bozmamak için)
        return image_bytes
