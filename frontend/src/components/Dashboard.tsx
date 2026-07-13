import React, { useState, useEffect, useRef } from 'react';
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
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      { id: 'Sosyal', path: '/dashboard/social', icon: Share2, label: 'Sosyal' },
      { id: 'Gruplar', path: '/dashboard/groups', icon: Users, label: 'Gruplar' },
      { id: 'Ana Sayfa', path: '/dashboard', icon: LayoutDashboard, label: 'Panel' },
      { id: 'Profil', path: '/dashboard/profile', icon: UserCircle, label: 'Profil' },
      { id: 'Şikayet', path: '/dashboard/support', icon: Flag, label: 'Destek' },
    ];
  }

  const handleTabClick = (tab: typeof navTabs[0]) => {
    navigate(tab.path);
    if (tab.id !== 'Gruplar') setActiveGroup(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-[#00f0ff] selection:text-slate-900">
      {/* Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#00f0ff]/5 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#b026ff]/5 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/50 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center mr-2">
                <img src="/sitelogo.svg" alt="Octoqus Logo" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(169,34,223,0.5)]" />
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

          <div className="flex items-center gap-3 sm:gap-6">
            {activeTab === 'Gruplar' && !activeGroup && (
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 bg-white text-black px-4 sm:px-5 py-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-[#00f0ff] transition-all active:scale-95 shadow-xl"
              >
                <Plus size={16} /> Yeni Grup
              </button>
            )}

            <div className="flex items-center gap-2 sm:gap-4 pl-3 sm:pl-6 border-l border-white/10">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-black text-white leading-none mb-1">{user?.name}</p>
                <p className="text-[9px] text-[#00f0ff] font-black uppercase tracking-widest">Hoş geldin!</p>
              </div>
              <div className="relative group">
                <div 
                  onClick={() => navigate('/dashboard/profile')}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-[#00f0ff] transition-all cursor-pointer"
                >
                  {user?.profile_photo ? (
                    <img src={getImageUrl(user.profile_photo) || ''} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs">👤</span>
                  )}
                </div>
              </div>
              <button onClick={logout} className="p-2 sm:p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                <LogOut size={16} className="sm:hidden" />
                <LogOut size={18} className="hidden sm:block" />
              </button>
              
              {/* Mobile Menu Button - Removed in favor of Bottom Navbar */}
            </div>
          </div>
        </div>
      </header>

      {/* Animated Notch Bottom Navigation Bar for Mobile */}
      <nav data-testid="bottom-navbar" className="md:hidden fixed bottom-6 left-5 right-5 z-50 h-20 pointer-events-none">
        <div className="relative w-full h-full pointer-events-auto">
          {/* SVG Background with Deep Notch and Rounded Corners */}
          <div className="absolute inset-0 z-0">
            <svg width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none" className="filter drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
              <path 
                fill="#0f172a" 
                fillOpacity="0.98"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
                d={`M 0,45 
                   Q 0,30 15,30
                   L ${(navTabs.findIndex(t => t.id === activeTab) * (400 / navTabs.length)) + (400 / navTabs.length / 2) - 35},30 
                   C ${(navTabs.findIndex(t => t.id === activeTab) * (400 / navTabs.length)) + (400 / navTabs.length / 2) - 25},30 
                     ${(navTabs.findIndex(t => t.id === activeTab) * (400 / navTabs.length)) + (400 / navTabs.length / 2) - 20},60 
                     ${(navTabs.findIndex(t => t.id === activeTab) * (400 / navTabs.length)) + (400 / navTabs.length / 2)},60 
                   C ${(navTabs.findIndex(t => t.id === activeTab) * (400 / navTabs.length)) + (400 / navTabs.length / 2) + 20},60 
                     ${(navTabs.findIndex(t => t.id === activeTab) * (400 / navTabs.length)) + (400 / navTabs.length / 2) + 25},30 
                     ${(navTabs.findIndex(t => t.id === activeTab) * (400 / navTabs.length)) + (400 / navTabs.length / 2) + 35},30 
                   L 385,30 
                   Q 400,30 400,45
                   V 85
                   Q 400,100 385,100
                   H 15
                   Q 0,100 0,85
                   Z`}
                className="transition-all duration-500 cubic-bezier(0.68, -0.55, 0.265, 1.55)"
              />
            </svg>
          </div>

          {/* Floating Active Icon (Transparent Circle) */}
          <motion.div
            layoutId="active-notch-circle"
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="absolute top-[-5px] w-14 h-14 flex items-center justify-center z-20 pointer-events-none"
            style={{ 
              left: `calc(${(navTabs.findIndex(t => t.id === activeTab) * (100 / navTabs.length)) + (100 / navTabs.length / 2)}% - 28px)` 
            }}
          >
            {(() => {
              const ActiveIcon = navTabs.find(t => t.id === activeTab)?.icon;
              return ActiveIcon ? (
                <ActiveIcon 
                  size={28} 
                  className="text-[#00f0ff] drop-shadow-[0_0_12px_rgba(0,240,255,0.8)]" 
                />
              ) : null;
            })()}
          </motion.div>

          <div 
            className="grid h-full relative z-30 px-0 pt-2"
            style={{ gridTemplateColumns: `repeat(${navTabs.length}, 1fr)` }}
          >
            {navTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className="flex flex-col items-center justify-center w-full h-full pt-4 pointer-events-auto"
                >
                  <div className={`transition-all duration-300 ${isActive ? 'opacity-0 scale-0 -translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}>
                    <tab.icon size={22} className="text-slate-500" />
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-tighter transition-all duration-300 ${isActive ? 'text-[#00f0ff] translate-y-[-2px] mt-2' : 'text-slate-500 mt-1'}`}>
                    {tab.label === 'Ana Sayfa' ? 'Panel' : tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-24 sm:pt-32 pb-32 md:pb-20 px-3 sm:px-4 md:px-8 max-w-[1600px] mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab === 'Gruplar' ? `group-${activeGroup?.id}` : location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'Gruplar' && activeGroup ? (
              <div className="space-y-8">
                <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-4 sm:p-6 md:p-10 rounded-[24px] sm:rounded-[40px] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#00f0ff]/10 to-[#b026ff]/10 blur-3xl -mr-20 -mt-20 pointer-events-none" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-8 relative z-10">
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
                          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tighter">
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
                    <div className="flex items-center gap-2 mt-6 sm:mt-12 bg-white/5 p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl w-full overflow-x-auto no-scrollbar">
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
                          className={`px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
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
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2 sm:px-4">
                          <div>
                            <h3 className="text-2xl font-black text-white">Harcama Kayıtları</h3>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Grup içi tüm finansal hareketler</p>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                            <div className="relative" ref={exportDropdownRef}>
                              <button 
                                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                                className={`px-3 sm:px-6 py-3 sm:py-4 border rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${isExportDropdownOpen ? 'bg-white text-slate-950 border-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                              >
                                <FileDown size={14} /> Dışa Aktar
                              </button>
                              <div className={`absolute top-full right-0 mt-2 w-44 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl transition-all z-[60] overflow-hidden p-1.5 ${isExportDropdownOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                                <button 
                                  onClick={() => { handleExport('excel'); setIsExportDropdownOpen(false); }}
                                  className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-[#00f0ff]/10 hover:text-[#00f0ff] rounded-xl transition-all flex items-center gap-3"
                                >
                                  <span className="text-sm">📊</span> EXCEL (.XLSX)
                                </button>
                                <button 
                                  onClick={() => { handleExport('pdf'); setIsExportDropdownOpen(false); }}
                                  className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all flex items-center gap-3"
                                >
                                  <span className="text-sm">📄</span> PDF BELGESİ
                                </button>
                              </div>
                            </div>

                            <button 
                              onClick={() => setIsModalOpen(true)}
                              className="px-4 sm:px-8 py-3 sm:py-4 bg-[#b026ff] text-white rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-[#c455ff] hover:shadow-[0_0_30px_rgba(176,38,255,0.4)] transition-all flex items-center gap-2 flex-1 sm:flex-none justify-center"
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
              className="relative w-full max-w-[600px] bg-slate-900 border border-white/10 rounded-[40px] p-8 md:p-10 shadow-2xl"
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
