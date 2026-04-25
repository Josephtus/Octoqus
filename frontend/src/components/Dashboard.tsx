import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  ChevronRight
} from 'lucide-react';

import { ExpenseForm } from './ExpenseForm';
import { ExpenseList } from './ExpenseList';
import { GroupList } from './GroupList';
import { DebtList } from './DebtList';
import { ProfileSettings } from './ProfileSettings';
import { GroupChat } from './GroupChat';
import { SocialList } from './SocialList';
import { ReportForm } from './ReportForm';
import { AdminPanel } from './admin/AdminPanel';
import { CreateGroupModal } from './CreateGroupModal';
import { GroupManagement } from './GroupManagement';
import { GroupMembers } from './GroupMembers';
import { Home } from './Home';
import { GroupInsights } from './GroupInsights';

type TabType = 'Ana Sayfa' | 'Gruplar' | 'Sosyal' | 'Profil' | 'Şikayet' | 'Admin';
type GroupSubTabType = 'Harcamalar' | 'Borç Durumu' | 'Detay' | 'Sohbet' | 'Üyeler' | 'Yönetim';

export const Dashboard: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null);
  const [activeGroupRole, setActiveGroupRole] = useState<string | null>(null);
  const [isActiveGroupApproved, setIsActiveGroupApproved] = useState<boolean>(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [activeTab, setActiveTab] = useState<TabType>('Ana Sayfa');
  const [activeSubTab, setActiveSubTab] = useState<GroupSubTabType>('Harcamalar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fetchUser = async () => {
    try {
      const response = await apiFetch('/auth/me');
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Kullanıcı bilgileri alınırken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  const handleLeaveGroup = async () => {
    if (!activeGroupId) return;
    const confirmLeave = window.confirm("Bu gruptan ayrılmak istediğinize emin misiniz?");
    if (!confirmLeave) return;

    try {
      await apiFetch(`/groups/${activeGroupId}/leave`, { method: 'POST' });
      setActiveGroupId(null);
      setActiveGroupName(null);
      setActiveGroupRole(null);
      setIsActiveGroupApproved(false);
      setActiveTab('Gruplar');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      alert("Gruptan ayrılırken bir hata oluştu.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-[#00f0ff]/10 border-t-[#00f0ff] rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-black text-xl">O</span>
          </div>
        </div>
        <p className="mt-8 text-slate-500 font-black text-xs uppercase tracking-[0.3em] animate-pulse">Sistem Hazırlanıyor</p>
      </div>
    );
  }

  const navTabs: { id: TabType; icon: any; label: string }[] = [
    { id: 'Ana Sayfa', icon: LayoutDashboard, label: 'Panel' },
    { id: 'Gruplar', icon: Users, label: 'Gruplar' },
    { id: 'Sosyal', icon: Share2, label: 'Sosyal' },
    { id: 'Profil', icon: UserCircle, label: 'Profil' },
    { id: 'Şikayet', icon: Flag, label: 'Destek' },
  ];
  
  if (user?.role?.toLowerCase() === 'admin') {
    navTabs.unshift({ id: 'Admin', icon: ShieldAlert, label: 'Yönetim' });
  }

  const renderTabIcon = (tabId: TabType) => {
    const tab = navTabs.find(t => t.id === tabId);
    if (!tab) return null;
    const Icon = tab.icon;
    return <Icon size={18} />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-[#00f0ff] selection:text-slate-900">
      {/* Dynamic Backgrounds */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#00f0ff]/5 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#b026ff]/5 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header / Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/50 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00f0ff] to-[#b026ff] rounded-xl flex items-center justify-center font-black text-slate-900 text-xl shadow-[0_0_20px_rgba(0,240,255,0.3)]">
                O
              </div>
              <div className="hidden lg:block">
                <h1 className="text-lg font-black text-white tracking-tighter leading-none">OCTOQUS</h1>
                <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">LABS ENGINE</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id !== 'Gruplar') setActiveGroupId(null);
                  }}
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
            {activeTab === 'Gruplar' && !activeGroupId && (
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
                  onClick={() => setActiveTab('Profil')}
                  className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-[#00f0ff] transition-all cursor-pointer"
                >
                  {user?.profile_photo ? (
                    <img src={getImageUrl(user.profile_photo)} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs">👤</span>
                  )}
                </div>
              </div>
              <button onClick={logout} className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                <LogOut size={18} />
              </button>
              
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2.5 rounded-xl bg-white/5 text-white">
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
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
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsSidebarOpen(false);
                    if (tab.id !== 'Gruplar') setActiveGroupId(null);
                  }}
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
            key={activeTab + (activeGroupId || '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'Ana Sayfa' && <Home user={user} onSelectGroup={(id, name, role, isApproved) => {
              setActiveGroupId(id);
              setActiveGroupName(name);
              setActiveGroupRole(role);
              setIsActiveGroupApproved(isApproved);
              setActiveTab('Gruplar');
              setActiveSubTab('Harcamalar');
            }} />}

            {activeTab === 'Gruplar' && (
              <div className="space-y-10">
                {!activeGroupId ? (
                  <GroupList 
                    onSelectGroup={(id, name, role, isApproved) => { 
                      setActiveGroupId(id); 
                      setActiveGroupName(name);
                      setActiveGroupRole(role);
                      setIsActiveGroupApproved(isApproved);
                      setActiveSubTab('Harcamalar');
                    }} 
                    activeGroupId={activeGroupId} 
                    refreshTrigger={refreshTrigger}
                  />
                ) : (
                  <div className="space-y-8">
                    {/* Premium Group Header */}
                    <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-8 md:p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#00f0ff]/10 to-[#b026ff]/10 blur-3xl -mr-20 -mt-20 pointer-events-none" />
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                        <div className="flex items-center gap-6">
                          <button 
                            onClick={() => { setActiveGroupId(null); setActiveGroupName(null); }}
                            className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all group"
                          >
                            <ChevronRight size={20} className="rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                          </button>
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${activeGroupRole === 'GROUP_LEADER' ? 'bg-amber-500 text-black' : 'bg-[#00f0ff] text-black'}`}>
                                {activeGroupRole === 'GROUP_LEADER' ? 'Lider' : 'Üye'}
                              </span>
                              {!isActiveGroupApproved && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-orange-500/20 text-orange-500 border border-orange-500/30 animate-pulse">
                                  Onay Bekliyor
                                </span>
                              )}
                            </div>
                            <h2 className="text-4xl font-black text-white tracking-tighter">{activeGroupName}</h2>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {activeGroupRole !== 'GUEST' && (
                            <button 
                              onClick={handleLeaveGroup}
                              className="px-6 py-3 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg"
                            >
                              Gruptan Ayrıl
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Sub-navigation */}
                      {activeGroupRole !== 'GUEST' && (
                        <div className="flex flex-wrap items-center gap-2 mt-12 bg-white/5 p-2 rounded-3xl w-full sm:w-fit">
                          {[
                            { id: 'Harcamalar', label: 'Harcamalar', icon: '💸' },
                            { id: 'Borç Durumu', label: 'Hesaplaşma', icon: '📊' },
                            { id: 'Detay', label: 'Detay', icon: '📈' },
                            { id: 'Sohbet', label: 'Sohbet', icon: '💬' },
                            { id: 'Üyeler', label: 'Üyeler', icon: '👥' },
                            ...(activeGroupRole === 'GROUP_LEADER' ? [{ id: 'Yönetim', label: 'Yönetim', icon: '⚙️' }] : [])
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

                    {(activeGroupRole === 'GUEST' || !isActiveGroupApproved) ? (

                      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-20 text-center shadow-2xl">
                        <div className="w-24 h-24 bg-[#00f0ff]/10 rounded-[32px] flex items-center justify-center mx-auto mb-10 border border-[#00f0ff]/20">
                          <Users size={48} className="text-[#00f0ff]" />
                        </div>
                        <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">
                          {activeGroupRole === 'GUEST' ? 'Birliğe Katılın' : 'Onay Bekleniyor'}
                        </h2>
                        <p className="text-slate-400 max-w-lg mx-auto mb-12 text-lg">
                          {activeGroupRole === 'GUEST' 
                            ? 'Bu grubun tüm detaylarını görmek ve yönetmek için liderden katılım onayı almanız gerekmektedir.'
                            : 'Katılım isteğiniz gönderildi. Grup lideri onayladığında tüm detayları görebileceksiniz.'}
                        </p>
                        {activeGroupRole === 'GUEST' && (
                          <button 
                            onClick={async () => {
                              try {
                                await apiFetch(`/groups/${activeGroupId}/join`, { method: 'POST' });
                                alert("Katılma isteği başarıyla gönderildi!");
                                setActiveGroupId(null);
                                setRefreshTrigger(prev => prev + 1);
                              } catch (err: any) { alert(err.message || "Hata."); }
                            }}
                            className="px-12 py-5 bg-[#00f0ff] text-slate-950 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:scale-105 hover:shadow-[0_0_40px_rgba(0,240,255,0.4)] transition-all"
                          >
                            KATILIM İSTEĞİ GÖNDER
                          </button>
                        )}
                        {!isActiveGroupApproved && activeGroupRole !== 'GUEST' && (
                           <div className="inline-flex items-center gap-3 px-8 py-4 bg-orange-500/10 text-orange-500 rounded-2xl border border-orange-500/20 font-black text-xs uppercase tracking-widest animate-pulse">
                              <ShieldAlert size={18} /> Lider Onayı Bekleniyor
                           </div>
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
                              <button 
                                onClick={() => setIsModalOpen(true)}
                                className="px-8 py-4 bg-[#b026ff] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#c455ff] hover:shadow-[0_0_30px_rgba(176,38,255,0.4)] transition-all"
                              >
                                + Harcama Ekle
                              </button>
                            </div>
                            <ExpenseList groupId={activeGroupId} refreshTrigger={refreshTrigger} currentUserId={user?.id} />
                          </div>
                        )}

                        {activeSubTab === 'Borç Durumu' && <DebtList groupId={activeGroupId} currentUserId={user?.id} />}
                        {activeSubTab === 'Detay' && <GroupInsights groupId={activeGroupId!} currentUserId={user?.id} />}
                        {activeSubTab === 'Sohbet' && <GroupChat groupId={activeGroupId} currentUserId={user?.id} />}
                        {activeSubTab === 'Üyeler' && <GroupMembers groupId={activeGroupId} />}
                        {activeSubTab === 'Yönetim' && activeGroupRole === 'GROUP_LEADER' && (
                          <GroupManagement groupId={activeGroupId} onUpdate={() => setRefreshTrigger(prev => prev + 1)} />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Sosyal' && <SocialList currentUserId={user?.id} activeGroupId={activeGroupId} />}
            {activeTab === 'Profil' && <ProfileSettings onUpdate={fetchUser} />}
            {activeTab === 'Şikayet' && <ReportForm />}
            {activeTab === 'Admin' && user?.role?.toLowerCase() === 'admin' && <AdminPanel />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
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
              <ExpenseForm groupId={activeGroupId!} onSuccess={() => { setIsModalOpen(false); setRefreshTrigger(prev => prev + 1); }} onCancel={() => setIsModalOpen(false)} />
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
              <CreateGroupModal onClose={() => setIsCreateModalOpen(false)} onSuccess={() => { setIsCreateModalOpen(false); setRefreshTrigger(prev => prev + 1); }} />
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </div>
  );
};
