import React, { useState } from 'react';
import { apiFetch } from '../utils/api';

interface RegisterProps {
  onRegisterSuccess: () => void;
  onSwitchToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [age, setAge] = useState('');
  const [birthday, setBirthday] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    // Telefon format kontrolü (Backend +XXXXXXXXXXX formatı bekliyor)
    if (!phoneNumber.startsWith('+') || phoneNumber.length < 10) {
      setError('Telefon numarası uluslararası formatta olmalıdır. Örn: +905551234567');
      setLoading(false);
      return;
    }
    
    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ 
          name, 
          surname, 
          age: parseInt(age),
          birthday,
          phone_number: phoneNumber,
          mail: email, 
          password 
        })
      });
      
      const data = await response.json();
      onRegisterSuccess();
      
    } catch (err: any) {
      console.error("Kayıt hatası:", err);
      setError("Kayıt sırasında bir hata oluştu. Lütfen bilgilerinizi (özellikle telefon numarasını +90... formatında) kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in-up">
      <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl drop-shadow-glow-blue relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00f0ff] to-[#b026ff]"></div>
        
        <h2 className="text-3xl font-black mb-2 text-center text-slate-100 tracking-wide">Kayıt Ol</h2>
        <p className="text-slate-400 text-center text-sm mb-6">Aramıza katılmak için formu doldur</p>
        
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-200 text-sm text-center shadow-lg">
            {error}
          </div>
        )}
        
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Ad</label>
              <input 
                type="text" 
                required
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-[#00f0ff] transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Can"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Soyad</label>
              <input 
                type="text" 
                required
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-[#00f0ff] transition-all"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                placeholder="Yılmaz"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Yaş</label>
              <input 
                type="number" 
                required
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-[#00f0ff] transition-all"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="25"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Doğum Tarihi</label>
              <input 
                type="date" 
                required
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-[#00f0ff] transition-all"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Telefon Numarası</label>
            <input 
              type="tel" 
              required
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-[#00f0ff] transition-all"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+905551234567"
            />
            <p className="text-[10px] text-slate-600 mt-1">Uluslararası format: + ile başlamalı</p>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Email</label>
            <input 
              type="email" 
              required
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-[#00f0ff] transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@mail.com"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Şifre</label>
            <input 
              type="password" 
              required
              minLength={8}
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-[#00f0ff] transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 8 karakter"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 w-full p-3 rounded-xl font-bold bg-[#b026ff] text-white hover:bg-[#c455ff] transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? "Kaydediliyor..." : "Hesap Oluştur"}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-slate-400">
          Zaten hesabın var mı?{' '}
          <button 
            onClick={onSwitchToLogin}
            className="text-[#00f0ff] font-bold hover:underline hover:text-[#4dffff] transition-colors"
          >
            Giriş Yap
          </button>
        </div>
      </div>
    </div>
  );
};
