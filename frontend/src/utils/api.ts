const BASE_URL = 'http://localhost:8000/api';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);

  const token = localStorage.getItem('token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.reload();
    }
    
    let errorMsg = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.message) errorMsg = errorData.message;
      else if (errorData.error) errorMsg = errorData.error;
    } catch (e) {
      // JSON değilse veya parse edilemiyorsa varsayılan mesaj kalır
    }
    
    throw new Error(errorMsg);
  }

  return response;
};
