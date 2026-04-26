import React, { useState } from 'react';
import { apiFetch } from '../utils/api';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

interface ResetPasswordProps {
  token: string;
  onSuccess: () => void;
  onBackToLogin: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ token, onSuccess, onBackToLogin }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ text: "Şifreler eşleşmiyor.", type: 'error' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ text: "Şifre en az 8 karakter olmalıdır.", type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Sıfırlama işlemi başarısız.');
      }

      setMessage({ text: "Şifreniz başarıyla sıfırlandı! Yönlendiriliyorsunuz...", type: 'success' });
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setMessage({ text: err.message || "Bir hata oluştu. Bağlantı geçersiz veya süresi dolmuş olabilir.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in">
      <div className="w-full max-w-md p-8 bg-slate-900 border border-white/5 rounded-[2.5rem] shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#00f0ff] to-blue-600"></div>
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#00f0ff]/10 rounded-2xl flex items-center justify-center border border-[#00f0ff]/20">
            <Lock className="text-[#00f0ff] w-8 h-8" />
          </div>
        </div>

        <h2 className="text-3xl font-black mb-2 text-center text-white tracking-tight">Yeni Şifre Belirle</h2>
        <p className="text-slate-400 text-center text-sm mb-8 font-medium">Lütfen hesabınız için yeni ve güvenli bir şifre girin.</p>
        
        {message && (
          <div className={`mb-8 p-4 rounded-2xl text-sm border flex items-center gap-3 ${
            message.type === 'error' 
              ? 'bg-red-500/10 border-red-500/20 text-red-400' 
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            {message.type === 'success' && <CheckCircle2 size={18} />}
            <span className="font-bold uppercase tracking-wide text-[11px]">{message.text}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Yeni Şifre</label>
            <div className="relative group">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                className="w-full pl-5 pr-12 py-4 rounded-2xl bg-slate-950 border border-white/5 text-white focus:outline-none focus:border-[#00f0ff] focus:ring-4 focus:ring-[#00f0ff]/10 transition-all font-medium"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#00f0ff] transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Şifre Tekrar</label>
            <input 
              type={showPassword ? "text" : "password"} 
              required
              className="w-full px-5 py-4 rounded-2xl bg-slate-950 border border-white/5 text-white focus:outline-none focus:border-[#00f0ff] focus:ring-4 focus:ring-[#00f0ff]/10 transition-all font-medium"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading || (message?.type === 'success')}
            className="w-full py-4 rounded-[1.25rem] font-black bg-[#00f0ff] text-slate-950 uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-[#00f0ff]/20 disabled:opacity-50 disabled:scale-100"
          >
            {loading ? "GÜNCELLENİYOR..." : "ŞİFREYİ SIFIRLA"}
          </button>
        </form>
        
        <button 
          onClick={onBackToLogin}
          className="mt-8 w-full text-center text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-all"
        >
          ← GİRİŞ EKRANINA DÖN
        </button>
      </div>
    </div>
  );
};
