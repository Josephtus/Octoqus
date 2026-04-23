import React, { useState } from 'react';
import { apiFetch } from '../utils/api';

interface LoginProps {
  onLoginSuccess: () => void;
  onSwitchToRegister: () => void;
  onSwitchToForgotPassword: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToRegister, onSwitchToForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ mail: email, password })
      });
      
      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      onLoginSuccess();
      
    } catch (err: any) {
      console.error("Login hatası:", err);
      setError(err.message || "Giriş sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm p-8 bg-slate-900 border border-slate-800 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-center text-slate-100">Giriş Yap</h2>
        {error && (
          <div className="mb-4 p-3 rounded bg-red-900/50 border border-red-500 text-red-200 text-sm text-center">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@mail.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Şifre</label>
            <input 
              type="password" 
              required
              className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <div className="flex justify-end mt-1">
              <button 
                type="button"
                onClick={onSwitchToForgotPassword}
                className="text-xs text-slate-500 hover:text-[#00f0ff] transition-colors"
              >
                Şifremi Unuttum
              </button>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 w-full p-2 rounded font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
        <div className="mt-6 text-center text-sm text-slate-400">
          Hesabın yok mu?{' '}
          <button 
            type="button"
            onClick={onSwitchToRegister}
            className="text-[#00f0ff] font-bold hover:underline hover:text-[#4dffff] transition-colors"
          >
            Kayıt Ol
          </button>
        </div>
      </div>
    </div>
  );
};
