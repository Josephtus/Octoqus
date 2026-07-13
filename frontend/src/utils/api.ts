// Production'da Nginx reverse proxy /api altında sunacağı için relative path yeterli.
// Development'da VITE_API_URL ile override edilebilir.
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Backend base URL (resim yolları vb. için)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // HttpOnly çerezlerin gönderilmesi için kritik
  });


  if (!response.ok) {
    // 401 hatasında sonsuz döngü oluşmaması için otomatik reload kaldırıldı.
    // authStore zaten bu hatayı yakalayıp kullanıcıyı logout durumuna çekiyor.


    
    let errorMsg = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.message) errorMsg = errorData.message;
      else if (errorData.error) errorMsg = errorData.error;
    } catch {
      // JSON değilse veya parse edilemiyorsa varsayılan mesaj kalır
    }
    
    throw new Error(errorMsg);
  }

  return response;
};

export const getImageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  // Eğer zaten tam URL ise dokunma
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BACKEND_URL}${path.startsWith('/') ? path : '/' + path}`;
};

/**
 * WebSocket URL'i oluşturur. Production'da wss://, development'da ws:// kullanır.
 * Nginx üzerinden proxy edilir.
 */
export const getWsUrl = (path: string) => {
  const wsBase = import.meta.env.VITE_WS_URL;
  if (wsBase) return `${wsBase}${path}`;
  
  // Otomatik tespit: mevcut sayfa protokolüne göre ws/wss seç
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
};
