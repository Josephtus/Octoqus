import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ mail: email })
      });
      setMessage({ text: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi (Simüle edildi).", type: 'success' });
    } catch (err: any) {
      setMessage({ text: "E-posta adresi bulunamadı veya bir hata oluştu.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in-up">
      <div className="w-full max-w-sm p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#00f0ff]"></div>
        
        <h2 className="text-2xl font-black mb-2 text-center text-slate-100">Şifremi Unuttum</h2>
        <p className="text-slate-400 text-center text-sm mb-6">Şifrenizi sıfırlamak için kayıtlı e-posta adresinizi girin.</p>
        
        {message && (
          <div className={`mb-6 p-3 rounded-lg text-sm border text-center ${message.type === 'error' ? 'bg-red-900/40 border-red-500/50 text-red-200' : 'bg-green-900/40 border-green-500/50 text-green-200'}`}>
            {message.text}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Email Adresi</label>
            <input 
              type="email" 
              required
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-[#00f0ff] transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@mail.com"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="mt-2 w-full p-3 rounded-xl font-bold bg-slate-800 text-[#00f0ff] border border-[#00f0ff]/30 hover:bg-[#00f0ff]/10 transition-all disabled:opacity-50"
          >
            {loading ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
          </button>
        </form>
        
        <button 
          onClick={() => navigate('/login')}
          className="mt-6 w-full text-center text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← Giriş Ekranına Dön
        </button>
      </div>
    </div>
  );
};
