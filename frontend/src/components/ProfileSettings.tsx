import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { DatePicker } from './common/DatePicker';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch, getImageUrl } from '../utils/api';
import { profileSchema, type ProfileFormData, resetPasswordSchema, type ResetPasswordFormData } from '../utils/validations';
import { User, Camera, Save, BadgeCheck, Trash2, Key, CheckCircle2, AlertCircle, Users, ChevronRight, Settings, X, Mail } from 'lucide-react';
import { Pagination } from './common/Pagination';

interface ProfileSettingsProps {
  onUpdate: () => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onUpdate }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'friends' | 'requests'>('settings');
  const [socialData, setSocialData] = useState<any[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialPage, setSocialPage] = useState(1);
  const [socialTotalCount, setSocialTotalCount] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{show: boolean, userId: number | null, name: string}>({ show: false, userId: null, name: '' });
  const socialLimit = 6;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    setValue: setProfileValue,
    control: profileControl,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await apiFetch('/auth/me');
      const data = await res.json();
      setUser(data.user);
      
      const birthday = data.user.birthday ? (data.user.birthday.includes('T') ? data.user.birthday.split('T')[0] : data.user.birthday) : '';
      
      setProfileValue('name', data.user.name || '');
      setProfileValue('surname', data.user.surname || '');
      setProfileValue('phone_number', data.user.phone_number || '');
      setProfileValue('birthday', birthday);
    } catch (err) {
      console.error("Profil yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSocialList = async (tab: 'friends' | 'requests', pageNum: number = 1) => {
    if (!user) return;
    setSocialLoading(true);
    try {
      const endpoint = tab === 'friends' 
        ? `/social/friends?page=${pageNum}&limit=${socialLimit}` 
        : `/social/friend-requests?page=${pageNum}&limit=${socialLimit}`;
      const res = await apiFetch(endpoint);
      const data = await res.json();
      setSocialData(data.data || []);
      setSocialTotalCount(data.pagination?.total || data.data?.length || 0);
    } catch (err) {
      console.error(`${tab} listesi yüklenemedi:`, err);
    } finally {
      setSocialLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (activeTab !== 'settings') {
      setSocialPage(1);
      fetchSocialList(activeTab, 1);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'settings') {
      fetchSocialList(activeTab, socialPage);
    }
  }, [socialPage]);

  const onProfileSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    try {
      const res = await apiFetch('/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Güncelleme hatası");
      }
      alert("Profil başarıyla güncellendi.");
      onUpdate();
      fetchProfile();
    } catch (err: any) {
      alert(err.message || "Güncelleme sırasında hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const onPasswordSubmit = async (data: ResetPasswordFormData) => {
    if (!currentPassword) {
      alert("Lütfen mevcut şifrenizi girin.");
      return;
    }
    setPwSaving(true);
    try {
      const res = await apiFetch('/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: data.new_password,
          new_password_confirm: data.confirm_password
        })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Şifre değiştirme hatası");
      }
      alert("Şifreniz başarıyla değiştirildi.");
      resetPasswordForm();
      setCurrentPassword('');
    } catch (err: any) {
      alert(err.message || "Hata oluştu.");
    } finally {
      setPwSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await apiFetch('/users/me/avatar', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error("Yükleme hatası");
      alert("Profil fotoğrafı güncellendi.");
      fetchProfile();
      onUpdate();
    } catch (err) {
      alert("Fotoğraf yüklenirken bir hata oluştu.");
    }
  };

  const handleDeleteAvatar = async () => {
    if (!window.confirm("Profil fotoğrafınızı silmek istediğinize emin misiniz?")) return;
    try {
      const res = await apiFetch('/users/me/avatar', { method: 'DELETE' });
      if (!res.ok) throw new Error("Silme hatası");
      alert("Profil fotoğrafı silindi.");
      fetchProfile();
      onUpdate();
    } catch (err) {
      alert("Silme işlemi başarısız.");
    }
  };

  const handleFriendAction = async (targetId: number, action: 'request' | 'accept' | 'decline' | 'remove') => {
    if (action === 'remove' && !confirmModal.show) {
      const friend = socialData.find(f => f.id === targetId);
      setConfirmModal({ show: true, userId: targetId, name: friend ? `${friend.name} ${friend.surname}` : 'Bu kişi' });
      return;
    }

    try {
      let endpoint = '';
      if (action === 'request') endpoint = `/social/friend-request/${targetId}`;
      else if (action === 'accept') endpoint = `/social/accept-request/${targetId}`;
      else if (action === 'decline') endpoint = `/social/decline-request/${targetId}`;
      else if (action === 'remove') endpoint = `/social/remove-friend/${targetId}`;

      const method = action === 'remove' ? 'DELETE' : 'POST';
      const res = await apiFetch(endpoint, { method });
      if (!res.ok) throw new Error("İşlem başarısız.");
      
      setConfirmModal({ show: false, userId: null, name: '' });
      fetchSocialList(activeTab, socialPage);
      if (selectedProfile) setSelectedProfile(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-12 h-12 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-fade-in pb-20">
      {/* Profil Header Card */}
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00f0ff]/5 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
          {/* Avatar Section */}
          <div className="relative group">
            <div className="w-40 h-40 rounded-[48px] bg-slate-800 border-4 border-white/10 overflow-hidden shadow-2xl transition-transform group-hover:scale-105 duration-500 relative">
              {user?.profile_photo ? (
                <>
                  <img src={getImageUrl(user.profile_photo) || ''} alt="Profile" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-[#00f0ff] hover:text-slate-950 transition-all">
                      <Camera size={20} />
                    </button>
                    <button onClick={handleDeleteAvatar} className="p-3 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-red-500 transition-all">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                  <User size={48} />
                  <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black uppercase tracking-widest text-[#00f0ff] hover:underline">Fotoğraf Ekle</button>
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
              <h2 className="text-4xl font-black text-white tracking-tighter">{user?.name} {user?.surname}</h2>
              <div className="bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20 px-3 py-1 rounded-full flex items-center gap-2">
                <BadgeCheck size={12} />
                <span className="text-[10px] font-black uppercase tracking-widest">Doğrulanmış</span>
              </div>
            </div>
            {user?.role !== 'ADMIN' && (
              <p className="text-slate-400 font-medium italic mb-1">{user?.invite_code}</p>
            )}
            <p className="text-slate-400 font-medium mb-1">{user?.mail}</p>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-6">Kayıt Tarihi: {new Date(user?.created_at).toLocaleDateString('tr-TR')}</p>
            
            {/* Social Tabs Integration */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              <button 
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'settings' ? 'bg-white text-slate-950 shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <Settings size={14} /> Ayarlar
              </button>
              <button 
                onClick={() => setActiveTab('friends')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'friends' ? 'bg-[#00f0ff] text-slate-950 shadow-lg shadow-[#00f0ff]/20' : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <Users size={14} /> Arkadaşlar
              </button>
              <button 
                onClick={() => setActiveTab('requests')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'requests' ? 'bg-[#b026ff] text-white shadow-lg shadow-[#b026ff]/20' : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <User size={14} /> Arkadaşlık İstekleri
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'settings' ? (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="space-y-12"
          >
            {/* Profil Form Card */}
            <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl">
              <form onSubmit={handleSubmitProfile(onProfileSubmit)} className="space-y-10">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#00f0ff]">
                    <User size={16} />
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight">Kişisel Bilgiler</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Adınız</label>
                    <input 
                      type="text" 
                      {...registerProfile('name')}
                      className={`w-full bg-slate-950/50 border transition-all rounded-2xl py-4 px-6 text-white focus:outline-none font-bold ${
                        profileErrors.name ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#00f0ff]/50'
                      }`}
                    />
                    {profileErrors.name && <p className="text-[10px] text-red-400 ml-2 font-bold">{profileErrors.name.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Soyadınız</label>
                    <input 
                      type="text" 
                      {...registerProfile('surname')}
                      className={`w-full bg-slate-950/50 border transition-all rounded-2xl py-4 px-6 text-white focus:outline-none font-bold ${
                        profileErrors.surname ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#00f0ff]/50'
                      }`}
                    />
                    {profileErrors.surname && <p className="text-[10px] text-red-400 ml-2 font-bold">{profileErrors.surname.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Telefon</label>
                    <input 
                      type="tel" 
                      {...registerProfile('phone_number')}
                      className={`w-full bg-slate-950/50 border transition-all rounded-2xl py-4 px-6 text-white focus:outline-none font-bold ${
                        profileErrors.phone_number ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#00f0ff]/50'
                      }`}
                    />
                    {profileErrors.phone_number && <p className="text-[10px] text-red-400 ml-2 font-bold">{profileErrors.phone_number.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <Controller
                      control={profileControl}
                      name="birthday"
                      render={({ field: { onChange, value } }) => (
                        <DatePicker
                          label="Doğum Tarihi"
                          value={value}
                          onChange={onChange}
                          error={profileErrors.birthday?.message}
                          showToday={false}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row gap-6 md:items-center justify-between">
                  <div className="flex items-center gap-3 text-emerald-500/80">
                    <CheckCircle2 size={16} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Bilgileriniz uçtan uca şifrelenir.</p>
                  </div>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="px-12 py-5 bg-white text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#00f0ff] hover:shadow-[0_0_40px_rgba(0,240,255,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {saving ? 'Güncelleniyor...' : <><Save size={20} /> Güncelle</>}
                  </button>
                </div>
              </form>
            </div>

            {/* Şifre Değiştirme Card */}
            <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl">
              <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className="space-y-10">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#b026ff]">
                    <Key size={16} />
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight">Güvenlik ve Şifre</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Mevcut Şifre</label>
                    <input 
                      type="password" 
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#b026ff]/50 transition-all font-bold"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Yeni Şifre</label>
                    <input 
                      type="password" 
                      {...registerPassword('new_password')}
                      className={`w-full bg-slate-950/50 border transition-all rounded-2xl py-4 px-6 text-white focus:outline-none font-bold ${
                        passwordErrors.new_password ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#b026ff]/50'
                      }`}
                    />
                    {passwordErrors.new_password && <p className="text-[10px] text-red-400 ml-2 font-bold">{passwordErrors.new_password.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Yeni Şifre Tekrar</label>
                    <input 
                      type="password" 
                      {...registerPassword('confirm_password')}
                      className={`w-full bg-slate-950/50 border transition-all rounded-2xl py-4 px-6 text-white focus:outline-none font-bold ${
                        passwordErrors.confirm_password ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#b026ff]/50'
                      }`}
                    />
                    {passwordErrors.confirm_password && <p className="text-[10px] text-red-400 ml-2 font-bold">{passwordErrors.confirm_password.message}</p>}
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row gap-6 md:items-center justify-between">
                  <div className="flex items-center gap-3 text-red-500/80">
                    <AlertCircle size={16} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Güçlü bir şifre seçtiğinizden emin olun.</p>
                  </div>
                  <button 
                    type="submit"
                    disabled={pwSaving}
                    className="px-12 py-5 bg-white/5 text-white border border-white/10 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#b026ff] hover:border-[#b026ff] hover:shadow-[0_0_40px_rgba(176,38,255,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {pwSaving ? 'Güncelleniyor...' : 'Şifreyi Değiştir'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="social"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl min-h-[500px]"
          >
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTab === 'following' ? 'bg-[#00f0ff]/10 text-[#00f0ff]' : 'bg-[#b026ff]/10 text-[#b026ff]'}`}>
                  {activeTab === 'following' ? <Users size={20} /> : <User size={20} />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">
                    {activeTab === 'friends' ? 'Arkadaşlar' : 'Arkadaşlık İstekleri'}
                  </h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Toplam {socialData.length} kullanıcı</p>
                </div>
              </div>
            </div>

            {socialLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-white/5 border-t-white/40 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {socialData.map((item, idx) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-4 cursor-pointer min-w-0" onClick={() => setSelectedProfile(item)}>
                      <div className="w-12 h-12 rounded-xl bg-slate-800 overflow-hidden border border-white/10 shrink-0">
                        {item.profile_photo ? (
                          <img src={getImageUrl(item.profile_photo) || ''} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg">👤</div>
                        )}
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <h4 className="text-sm font-black text-white tracking-tight truncate">{item.name} {item.surname}</h4>
                        <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest truncate">{item.mail}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeTab === 'friends' ? (
                        <button 
                          onClick={() => handleFriendAction(item.id, 'remove')}
                          className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                        >
                          Arkadaştan Çıkar
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleFriendAction(item.id, 'accept')}
                            className="px-4 py-2 bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-[#00f0ff] hover:text-slate-950 transition-all"
                          >
                            Onayla
                          </button>
                          <button 
                            onClick={() => handleFriendAction(item.id, 'decline')}
                            className="px-4 py-2 bg-white/5 text-white border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                          >
                            Reddet
                          </button>
                        </div>
                      )}
                      <button 
                        onClick={() => setSelectedProfile(item)}
                        className="p-2 bg-white/5 text-slate-400 hover:text-white rounded-xl transition-all"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))}
                {socialData.length === 0 && (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-600">
                    <Users size={48} className="mb-4 opacity-10" />
                    <p className="text-sm font-black uppercase tracking-widest opacity-30">Henüz kimse yok</p>
                  </div>
                )}
              </div>
            )}

            {socialTotalCount > socialLimit && (
              <div className="mt-8 pt-8 border-t border-white/5">
                <Pagination 
                  currentPage={socialPage}
                  totalCount={socialTotalCount}
                  limit={socialLimit}
                  onPageChange={setSocialPage}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedProfile(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[40px] shadow-2xl overflow-hidden p-10 pt-16"
            >
              <button 
                onClick={() => setSelectedProfile(null)}
                className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white z-10"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-[40px] bg-slate-800 border-4 border-white/10 overflow-hidden shadow-2xl mb-8">
                  {selectedProfile.profile_photo ? (
                    <img src={getImageUrl(selectedProfile.profile_photo) || ''} alt={selectedProfile.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>
                  )}
                </div>
                <h3 className="text-3xl font-black text-white tracking-tighter mb-6">
                  {selectedProfile.name} {selectedProfile.surname}
                </h3>
                
                <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-full flex items-center gap-3">
                  <Mail size={16} className="text-[#00f0ff]" />
                  <span className="text-slate-300 font-black text-[10px] uppercase tracking-[0.1em]">{selectedProfile.mail}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmModal({ show: false, userId: null, name: '' })}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 border border-white/10 p-8 rounded-[32px] shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Emin misiniz?</h3>
              <p className="text-slate-400 text-sm mb-8">
                <span className="text-white font-bold">{confirmModal.name}</span> isimli kullanıcıyı arkadaş listenizden çıkarmak istediğinize emin misiniz?
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setConfirmModal({ show: false, userId: null, name: '' })}
                  className="py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  VAZGEÇ
                </button>
                <button 
                  onClick={() => handleFriendAction(confirmModal.userId!, 'remove')}
                  className="py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-red-500/20"
                >
                  EVET, ÇIKAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

