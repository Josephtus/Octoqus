import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { apiFetch, getImageUrl } from '../utils/api';
import { 
  LayoutDashboard, 
  Users, 
  Share2, 
  UserCircle, 
  Flag, 
  ShieldAlert, 
  LogOut, 
  Plus, 
  Menu, 
  X,
  ChevronRight,
  Edit2,
  FileDown
} from 'lucide-react';

import { ExpenseForm } from './ExpenseForm';
import { ExpenseList } from './ExpenseList';
import { DebtList } from './DebtList';
import { GroupChat } from './GroupChat';
import { GroupManagement } from './GroupManagement';
import { GroupMembers } from './GroupMembers';
import { GroupInsights } from './GroupInsights';
import { CreateGroupModal } from './CreateGroupModal';

import { useAuthStore } from '../store/authStore';
import { useGroupStore } from '../store/groupStore';

type TabType = 'Ana Sayfa' | 'Gruplar' | 'Sosyal' | 'Profil' | 'Şikayet' | 'Admin';
type GroupSubTabType = 'Harcamalar' | 'Borç Durumu' | 'Detay' | 'Sohbet' | 'Üyeler' | 'Yönetim';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { activeGroup, setActiveGroup, triggerRefresh } = useGroupStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Derive active tab from pathname
  const getActiveTabFromPath = (path: string): TabType => {
    if (path.includes('/dashboard/groups')) return 'Gruplar';
    if (path.includes('/dashboard/social')) return 'Sosyal';
    if (path.includes('/dashboard/profile')) return 'Profil';
    if (path.includes('/dashboard/support')) return 'Şikayet';
    if (path.includes('/dashboard/admin')) return 'Admin';
    return 'Ana Sayfa';
  };

  const activeTab = getActiveTabFromPath(location.pathname);
  const [activeSubTab, setActiveSubTab] = useState<GroupSubTabType>('Harcamalar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [newNickname, setNewNickname] = useState('');

  // Admin Redirection
  useEffect(() => {
    if (user?.role?.toLowerCase() === 'admin' && location.pathname === '/dashboard') {
      navigate('/dashboard/admin');
    }
  }, [user, location.pathname, navigate]);

  useEffect(() => {
    if (activeGroup) {
      apiFetch(`/groups/${activeGroup.id}/access`, { method: 'POST' }).catch(err => console.error(err));
    }
  }, [activeGroup?.id]);

  const handleLeaveGroup = async () => {
    if (!activeGroup) return;
    const confirmLeave = window.confirm("Bu gruptan ayrılmak istediğinize emin misiniz?");
    if (!confirmLeave) return;

    try {
      await apiFetch(`/groups/${activeGroup.id}/leave`, { method: 'POST' });
      setActiveGroup(null);
      navigate('/dashboard/groups');
      triggerRefresh();
    } catch (error) {
      alert("Gruptan ayrılırken bir hata oluştu.");
    }
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!activeGroup) return;
    try {
      const response = await apiFetch(`/expenses/${activeGroup.id}/export?format=${format}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Dosya oluşturulamadı.");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `harcamalar_${activeGroup.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || "Dışa aktarma sırasında bir hata oluştu.");
    }
  };

  let navTabs: { id: TabType; path: string; icon: any; label: string }[] = [];

  if (user?.role?.toLowerCase() === 'admin') {
    navTabs = [
      { id: 'Admin', path: '/dashboard/admin', icon: ShieldAlert, label: 'Yönetim' }
    ];
  } else {
    navTabs = [
      { id: 'Ana Sayfa', path: '/dashboard', icon: LayoutDashboard, label: 'Panel' },
      { id: 'Gruplar', path: '/dashboard/groups', icon: Users, label: 'Gruplar' },
      { id: 'Sosyal', path: '/dashboard/social', icon: Share2, label: 'Sosyal' },
      { id: 'Profil', path: '/dashboard/profile', icon: UserCircle, label: 'Profil' },
      { id: 'Şikayet', path: '/dashboard/support', icon: Flag, label: 'Destek' },
    ];
  }

  const handleTabClick = (tab: typeof navTabs[0]) => {
    navigate(tab.path);
    if (tab.id !== 'Gruplar') setActiveGroup(null);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-[#00f0ff] selection:text-slate-900">
      {/* Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#00f0ff]/5 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#b026ff]/5 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/50 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
              <div className="w-10 h-10 bg-gradient-to-br from-[#00f0ff] to-[#b026ff] rounded-xl flex items-center justify-center font-black text-slate-900 text-xl shadow-[0_0_20px_rgba(0,240,255,0.3)]">
                O
              </div>
              <div className="hidden lg:block">
                <h1 className="text-lg font-black text-white tracking-tighter leading-none">OCTOQUS</h1>
                <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">LABS ENGINE</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {navTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    activeTab === tab.id 
                      ? 'bg-white/10 text-[#00f0ff] shadow-inner' 
                      : 'text-slate-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-6">
            {activeTab === 'Gruplar' && !activeGroup && (
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="hidden sm:flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#00f0ff] transition-all active:scale-95 shadow-xl"
              >
                <Plus size={16} /> Yeni Grup
              </button>
            )}

            <div className="flex items-center gap-4 pl-6 border-l border-white/10">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-black text-white leading-none mb-1">{user?.name}</p>
                <p className="text-[9px] text-[#00f0ff] font-black uppercase tracking-widest">Hoş geldin!</p>
              </div>
              <div className="relative group">
                <div 
                  onClick={() => navigate('/dashboard/profile')}
                  className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-[#00f0ff] transition-all cursor-pointer"
                >
                  {user?.profile_photo ? (
                    <img src={getImageUrl(user.profile_photo) || ''} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs">👤</span>
                  )}
                </div>
              </div>
              <button onClick={logout} className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                <LogOut size={18} />
              </button>
              
              {navTabs.length > 1 && (
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2.5 rounded-xl bg-white/5 text-white">
                  {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-slate-950 pt-24 px-6 md:hidden"
          >
            <div className="flex flex-col gap-4">
              {navTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={`p-6 rounded-[24px] text-lg font-black flex items-center justify-between transition-all ${
                    activeTab === tab.id 
                      ? 'bg-gradient-to-r from-[#00f0ff]/20 to-transparent border border-[#00f0ff]/20 text-white' 
                      : 'bg-white/5 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <tab.icon size={24} />
                    {tab.label}
                  </div>
                  <ChevronRight size={20} />
                </button>
              ))}
              <button 
                onClick={() => { setIsCreateModalOpen(true); setIsSidebarOpen(false); }}
                className="w-full p-6 rounded-[24px] bg-white text-black font-black text-lg mt-4"
              >
                + Yeni Grup Oluştur
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 pt-32 pb-20 px-4 md:px-8 max-w-[1600px] mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname + (activeGroup?.id || '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'Gruplar' && activeGroup ? (
              <div className="space-y-8">
                <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-8 md:p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#00f0ff]/10 to-[#b026ff]/10 blur-3xl -mr-20 -mt-20 pointer-events-none" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center gap-6">
                      <button 
                        onClick={() => { 
                          setActiveGroup(null); 
                        }}
                        className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all group"
                      >
                        <ChevronRight size={20} className="rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                      </button>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${activeGroup.role?.toUpperCase() === 'GROUP_LEADER' ? 'bg-amber-500 text-black' : 'bg-[#00f0ff] text-black'}`}>
                            {activeGroup.role?.toUpperCase() === 'GROUP_LEADER' ? 'Lider' : 'Üye'}
                          </span>
                          <button 
                            onClick={async () => {
                              try {
                                const res = await apiFetch(`/groups/${activeGroup.id}/star`, { method: 'POST' });
                                if (res.ok) {
                                  const data = await res.json();
                                  setActiveGroup({ ...activeGroup, is_starred: data.is_starred });
                                  triggerRefresh();
                                }
                              } catch (err) { console.error(err); }
                            }}
                            className={`p-1 rounded-lg transition-all ${activeGroup.is_starred ? 'text-amber-500' : 'text-slate-500 hover:text-amber-500'}`}
                            title="Yıldızla"
                          >
                            <span className="text-sm">{activeGroup.is_starred ? '★' : '☆'}</span>
                          </button>
                          {!activeGroup.isApproved && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-orange-500/20 text-orange-500 border border-orange-500/30 animate-pulse">
                              Onay Bekliyor
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-4xl font-black text-white tracking-tighter">
                            {activeGroup.name}
                          </h2>
                          <div className="flex items-center gap-2">
                            {activeGroup.nickname && (
                              <span className="px-3 py-1 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[10px] font-black text-[#00f0ff] uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                                🏷️ {activeGroup.nickname}
                              </span>
                            )}
                            <button 
                              onClick={() => {
                                setNewNickname(activeGroup.nickname || '');
                                setIsNicknameModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-500 hover:text-[#00f0ff] hover:border-[#00f0ff]/30 transition-all"
                              title="Takma Adı Düzenle"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {activeGroup.role !== 'GUEST' && (
                        <button 
                          onClick={handleLeaveGroup}
                          className="px-6 py-3 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg"
                        >
                          Gruptan Ayrıl
                        </button>
                      )}
                    </div>
                  </div>

                  {activeGroup.role?.toUpperCase() !== 'GUEST' && activeGroup.isApproved && (
                    <div className="flex flex-wrap items-center gap-2 mt-12 bg-white/5 p-2 rounded-3xl w-full sm:w-fit">
                      {[
                        { id: 'Harcamalar', label: 'Harcamalar', icon: '💸' },
                        { id: 'Borç Durumu', label: 'Hesaplaşma', icon: '📊' },
                        { id: 'Detay', label: 'Detay', icon: '📈' },
                        { id: 'Sohbet', label: 'Sohbet', icon: '💬' },
                        { id: 'Üyeler', label: 'Üyeler', icon: '👥' },
                        ...(activeGroup.role?.toUpperCase() === 'GROUP_LEADER' ? [{ id: 'Yönetim', label: 'Yönetim', icon: '⚙️' }] : [])
                      ].map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => setActiveSubTab(sub.id as GroupSubTabType)}
                          className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                            activeSubTab === sub.id 
                              ? 'bg-white text-black shadow-xl scale-105' 
                              : 'text-slate-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span>{sub.icon}</span> {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {(activeGroup.role === 'GUEST' || !activeGroup.isApproved) ? (
                  <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-20 text-center shadow-2xl">
                    <div className="w-24 h-24 bg-[#00f0ff]/10 rounded-[32px] flex items-center justify-center mx-auto mb-10 border border-[#00f0ff]/20">
                      <Users size={48} className="text-[#00f0ff]" />
                    </div>
                    <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">
                      {activeGroup.role === 'GUEST' ? 'Birliğe Katılın' : 'Onay Bekleniyor'}
                    </h2>
                    <p className="text-slate-400 max-w-lg mx-auto mb-12 text-lg">
                      {activeGroup.role === 'GUEST' 
                        ? 'Bu grubun tüm detaylarını görmek ve yönetmek için liderden katılım onayı almanız gerekmektedir.'
                        : 'Katılım isteğiniz gönderildi. Grup lideri onayladığında tüm detayları görebileceksiniz.'}
                    </p>
                    {activeGroup.role === 'GUEST' && (
                      <button 
                        onClick={async () => {
                          try {
                            await apiFetch(`/groups/${activeGroup.id}/join`, { method: 'POST' });
                            alert("Katılma isteği başarıyla gönderildi!");
                            setActiveGroup(null);
                            triggerRefresh();
                          } catch (err: any) { alert(err.message || "Hata."); }
                        }}
                        className="px-12 py-5 bg-[#00f0ff] text-slate-950 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:scale-105 hover:shadow-[0_0_40px_rgba(0,240,255,0.4)] transition-all"
                      >
                        KATILIM İSTEĞİ GÖNDER
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="animate-fade-in">
                    {activeSubTab === 'Harcamalar' && (
                      <div className="space-y-8">
                        <div className="flex justify-between items-center px-4">
                          <div>
                            <h3 className="text-2xl font-black text-white">Harcama Kayıtları</h3>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Grup içi tüm finansal hareketler</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="relative group/export">
                              <button 
                                className="px-6 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
                              >
                                <FileDown size={14} /> Dışa Aktar
                              </button>
                              <div className="absolute top-full right-0 mt-2 w-44 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl opacity-0 scale-95 invisible group-hover/export:opacity-100 group-hover/export:scale-100 group-hover/export:visible transition-all z-[60] overflow-hidden p-1.5">
                                <button 
                                  onClick={() => handleExport('excel')}
                                  className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-[#00f0ff]/10 hover:text-[#00f0ff] rounded-xl transition-all flex items-center gap-3"
                                >
                                  <span className="text-sm">📊</span> EXCEL (.XLSX)
                                </button>
                                <button 
                                  onClick={() => handleExport('pdf')}
                                  className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all flex items-center gap-3"
                                >
                                  <span className="text-sm">📄</span> PDF BELGESİ
                                </button>
                              </div>
                            </div>

                            <button 
                              onClick={() => setIsModalOpen(true)}
                              className="px-8 py-4 bg-[#b026ff] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#c455ff] hover:shadow-[0_0_30px_rgba(176,38,255,0.4)] transition-all flex items-center gap-2"
                            >
                              <Plus size={14} /> Harcama Ekle
                            </button>
                          </div>
                        </div>
                        <ExpenseList />
                      </div>
                    )}
                    {activeSubTab === 'Borç Durumu' && <DebtList />}
                    {activeSubTab === 'Detay' && <GroupInsights />}
                    {activeSubTab === 'Sohbet' && <GroupChat />}
                    {activeSubTab === 'Üyeler' && <GroupMembers />}
                    {activeSubTab === 'Yönetim' && activeGroup.role?.toUpperCase() === 'GROUP_LEADER' && (
                      <GroupManagement />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Outlet />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
              onClick={() => setIsModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[40px] p-8 shadow-2xl"
            >
              <ExpenseForm onSuccess={() => { setIsModalOpen(false); triggerRefresh(); }} onCancel={() => setIsModalOpen(false)} />
            </motion.div>
          </div>
        )}

        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
              onClick={() => setIsCreateModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[40px] p-8 shadow-2xl overflow-hidden"
            >
              <CreateGroupModal onClose={() => setIsCreateModalOpen(false)} onSuccess={() => { setIsCreateModalOpen(false); triggerRefresh(); }} />
            </motion.div>
          </div>
        )}

        {isNicknameModalOpen && activeGroup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
              onClick={() => setIsNicknameModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-[40px] p-8 shadow-2xl"
            >
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-white mb-2">Takma Adı Düzenle</h3>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Orijinal İsim: {activeGroup.name}</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Takma İsim</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-[#00f0ff]/50"
                      placeholder="Örn: Evim, İş Grubu..."
                      value={newNickname}
                      onChange={(e) => setNewNickname(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={async () => {
                      try {
                        const res = await apiFetch(`/groups/${activeGroup.id}/nickname`, {
                          method: 'PUT',
                          body: JSON.stringify({ nickname: newNickname.trim() || null })
                        });
                        if (res.ok) {
                          setActiveGroup({ ...activeGroup, nickname: newNickname.trim() || null });
                          setIsNicknameModalOpen(false);
                          triggerRefresh();
                        }
                      } catch (err) { alert("Hata oluştu."); }
                    }}
                    className="flex-1 bg-[#00f0ff] text-slate-950 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all"
                  >
                    KAYDET
                  </button>
                  <button 
                    onClick={() => setIsNicknameModalOpen(false)}
                    className="flex-1 bg-white/5 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    İPTAL
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
