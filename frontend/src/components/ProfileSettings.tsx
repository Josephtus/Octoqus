import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

interface UserProfile {
  id: number;
  mail?: string;
  name?: string;
  surname?: string;
  phone_number?: string;
  age?: number;
  birthday?: string;
  profile_photo?: string;
  role?: string;
}

export const ProfileSettings: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profil Bilgileri State'i
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [birthday, setBirthday] = useState('');
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Şifre Değiştirme State'i
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Avatar (Fotoğraf) State'i
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchProfile = async () => {
    try {
      const response = await apiFetch('/auth/me');
      const data = await response.json();
      const u = data.user;
      setUser(u);
      setName(u?.name || '');
      setSurname(u?.surname || '');
      setPhone(u?.phone_number || '');
      setAge(u?.age ? String(u.age) : '');
      setBirthday(u?.birthday || '');
    } catch (error) {
      console.error('Kullanıcı bilgileri alınırken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoLoading(true);
    setInfoMessage(null);
    try {
      const payload: Record<string, any> = {};
      if (name) payload.name = name;
      if (surname) payload.surname = surname;
      if (phone) payload.phone_number = phone;
      if (age) payload.age = parseInt(age, 10);
      if (birthday) payload.birthday = birthday;

      await apiFetch('/users/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setInfoMessage({ text: 'Profil başarıyla güncellendi.', isError: false });
      await fetchProfile();
    } catch (err: any) {
      setInfoMessage({ text: err.message || 'Profil güncellenirken bir hata oluştu.', isError: true });
    } finally {
      setInfoLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwLoading(true);
    setPwMessage(null);

    if (newPassword !== confirmPassword) {
      setPwMessage({ text: 'Yeni şifre ile tekrarı eşleşmiyor.', isError: true });
      setPwLoading(false);
      return;
    }

    try {
      await apiFetch('/users/me/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirm: confirmPassword,
        }),
      });
      setPwMessage({ text: 'Şifreniz başarıyla güncellendi.', isError: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwMessage({ text: err.message || 'Şifre değiştirilirken bir hata oluştu.', isError: true });
    } finally {
      setPwLoading(false);
    }
  };

  const handleAvatarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!avatarFile) return;

    setAvatarLoading(true);
    setAvatarMessage(null);

    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);

      await apiFetch('/users/me/avatar', {
        method: 'POST',
        body: formData,
      });

      setAvatarMessage({ text: 'Profil fotoğrafı başarıyla yüklendi.', isError: false });
      setAvatarFile(null);
      await fetchProfile();
    } catch (err: any) {
      setAvatarMessage({ text: err.message || 'Fotoğraf yüklenirken bir hata oluştu.', isError: true });
    } finally {
      setAvatarLoading(false);
    }
  };

  const getAvatarUrl = (path?: string) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `http://localhost:8000${cleanPath}`;
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center p-4">
        <div className="text-[#00f0ff] animate-pulse font-bold text-xl">
          Profil Yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in-up">
      <h2 className="text-3xl font-extrabold text-slate-100 tracking-tight border-b border-slate-800 pb-4">
        Profil Ayarları
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SOL KOLON: Profil Fotoğrafı (Avatar) */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center h-fit">
          <div className="relative mb-6 group">
            {user?.profile_photo ? (
              <img 
                src={getAvatarUrl(user.profile_photo)!} 
                alt="Profil" 
                className="w-40 h-40 rounded-full object-cover border-4 border-[#b026ff] shadow-[0_0_20px_rgba(176,38,255,0.4)] group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-40 h-40 rounded-full bg-slate-800 flex items-center justify-center border-4 border-slate-700 shadow-lg group-hover:scale-105 transition-transform duration-300">
                <svg className="w-16 h-16 text-slate-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>

          <h3 className="text-xl font-bold text-slate-200 mb-6">Fotoğrafını Değiştir</h3>
          
          <form onSubmit={handleAvatarSubmit} className="w-full flex flex-col gap-4">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files ? e.target.files[0] : null)}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-[#00f0ff] hover:file:bg-slate-700 hover:file:text-white transition-all cursor-pointer"
            />
            
            {avatarMessage && (
              <div className={`p-3 rounded-lg text-sm font-medium ${avatarMessage.isError ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'}`}>
                {avatarMessage.text}
              </div>
            )}

            <button
              type="submit"
              disabled={!avatarFile || avatarLoading}
              className="w-full py-3 rounded-xl font-bold bg-[#b026ff] text-white hover:bg-[#c455ff] hover:shadow-[0_0_15px_rgba(176,38,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {avatarLoading ? 'Yükleniyor...' : 'Fotoğrafı Yükle'}
            </button>
          </form>
        </div>

        {/* SAĞ KOLON: Profil Bilgileri Formu */}
        <div className="lg:col-span-2 space-y-8">
          {/* Kişisel Bilgiler */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <h3 className="text-2xl font-bold text-[#00f0ff] mb-8">Kişisel Bilgiler</h3>
            
            {infoMessage && (
              <div className={`mb-6 p-4 rounded-xl text-sm font-bold ${infoMessage.isError ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'}`}>
                {infoMessage.text}
              </div>
            )}

            <form onSubmit={handleInfoSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-400">Adınız</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all shadow-inner"
                    placeholder="Ahmet"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-400">Soyadınız</label>
                  <input
                    type="text"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all shadow-inner"
                    placeholder="Yılmaz"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-400">Yaş</label>
                  <input
                    type="number"
                    min="13"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all shadow-inner"
                    placeholder="25"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-400">Doğum Tarihi</label>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-400">Telefon Numarası</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all shadow-inner"
                  placeholder="+905551234567"
                />
                <p className="text-xs text-slate-600">Uluslararası format: +90XXXXXXXXXX</p>
              </div>

              {/* Email (Sadece Okunabilir) */}
              {user?.mail && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-500">Email Adresi (Değiştirilemez)</label>
                  <input
                    type="email"
                    value={user.mail}
                    disabled
                    className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed opacity-70"
                  />
                </div>
              )}

              <div className="pt-6 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={infoLoading}
                  className="px-8 py-3.5 rounded-xl font-bold bg-[#00f0ff] text-slate-900 hover:bg-[#00c0cc] hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {infoLoading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </form>
          </div>

          {/* Şifre Değiştirme */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <h3 className="text-2xl font-bold text-[#b026ff] mb-8">Şifre Değiştir</h3>

            {pwMessage && (
              <div className={`mb-6 p-4 rounded-xl text-sm font-bold ${pwMessage.isError ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'}`}>
                {pwMessage.text}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-400">Mevcut Şifre</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#b026ff] focus:ring-1 focus:ring-[#b026ff] transition-all shadow-inner"
                  placeholder="••••••••"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-400">Yeni Şifre</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#b026ff] focus:ring-1 focus:ring-[#b026ff] transition-all shadow-inner"
                    placeholder="En az 8 karakter"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-400">Yeni Şifre (Tekrar)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#b026ff] focus:ring-1 focus:ring-[#b026ff] transition-all shadow-inner"
                    placeholder="Tekrar girin"
                  />
                </div>
              </div>
              <div className="pt-6 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
                  className="px-8 py-3.5 rounded-xl font-bold bg-[#b026ff] text-white hover:bg-[#c455ff] hover:shadow-[0_0_20px_rgba(176,38,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pwLoading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
