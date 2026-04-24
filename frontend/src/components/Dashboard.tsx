import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
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

type TabType = 'Gruplar' | 'Sosyal' | 'Profil' | 'Şikayet' | 'Admin';
type GroupSubTabType = 'Harcamalar' | 'Borç Durumu' | 'Sohbet' | 'Üyeler' | 'Yönetim';

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

  const [activeTab, setActiveTab] = useState<TabType>('Gruplar');
  const [activeSubTab, setActiveSubTab] = useState<GroupSubTabType>('Harcamalar');

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
    const confirmLeave = window.confirm("Bu gruptan ayrılmak istediğinize emin misiniz? Liderseniz liderlik başka üyeye geçebilir.");
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
        <h2 className="text-3xl font-bold text-[#00f0ff] animate-pulse">Yükleniyor...</h2>
      </div>
    );
  }

  // Dinamik sekmeler (Sadece ana kategoriler)
  const navTabs: TabType[] = ['Gruplar', 'Sosyal', 'Profil', 'Şikayet'];
  
  if (user?.role?.toLowerCase() === 'admin') {
    navTabs.unshift('Admin');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-5 border-b border-slate-800/50 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00f0ff] to-[#b026ff] rounded-xl flex items-center justify-center font-black text-slate-900 text-xl shadow-[0_0_15px_rgba(0,240,255,0.4)]">
                ET
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-100 hidden md:block">EXPENSE <span className="text-[#00f0ff]">TRACKER</span></h1>
                {activeGroupName && (
                  <span className="text-[10px] text-[#00f0ff] font-bold uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#00f0ff] rounded-full animate-pulse"></span>
                    AKTİF GRUP: {activeGroupName}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {activeTab === 'Gruplar' && (
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="hidden sm:flex items-center gap-2 bg-[#b026ff] text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-[#c455ff] transition-all shadow-lg"
                >
                  + Yeni Grup Oluştur
                </button>
              )}
              
              <div className="flex items-center gap-3 border-l border-slate-800 pl-4 hidden sm:flex">
                <div className="text-sm text-right">
                  <span className="text-slate-100 font-bold block leading-tight">{user?.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">{user?.role}</span>
                </div>
                {user?.profile_photo ? (
                  <img 
                    src={`http://localhost:8000${user.profile_photo.startsWith('/') ? user.profile_photo : '/' + user.profile_photo}`} 
                    alt="Avatar" 
                    className="w-8 h-8 rounded-full object-cover border border-[#b026ff] shadow-[0_0_5px_rgba(176,38,255,0.3)]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <span className="text-[10px]">👤</span>
                  </div>
                )}
              </div>
              <button onClick={logout} className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors text-xs font-bold">Çıkış</button>
            </div>
          </div>
          
          <nav className="flex space-x-2 overflow-x-auto pb-0 no-scrollbar scroll-smooth">
            {navTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap py-3 px-5 rounded-t-xl font-bold text-xs sm:text-sm transition-all ${
                  activeTab === tab
                    ? 'bg-slate-800 text-[#00f0ff] border-t-2 border-[#00f0ff] shadow-[0_-4px_10px_rgba(0,240,255,0.1)]'
                    : 'text-slate-500 border-t-2 border-transparent hover:text-slate-300'
                }`}
              >
                {tab === 'Admin' ? '🛡️ ADMİN' : tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {activeTab === 'Gruplar' && (
          <div className="space-y-8">
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
              <div className="animate-fade-in space-y-6">
                {/* Geri Dön ve Bilgi Paneli */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#00f0ff] to-[#b026ff]"></div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => {
                        setActiveGroupId(null);
                        setActiveGroupName(null);
                        setActiveGroupRole(null);
                        setIsActiveGroupApproved(false);
                      }}
                      className="group flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-2xl transition-all border border-slate-700/50"
                    >
                      <span className="group-hover:-translate-x-1 transition-transform">⬅</span>
                      <span className="text-xs font-bold uppercase tracking-wider">Gruplara Dön</span>
                    </button>
                    <div>
                      <h2 className="text-2xl font-black text-white tracking-tight">{activeGroupName}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${activeGroupRole === 'GROUP_LEADER' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>
                          {activeGroupRole === 'GROUP_LEADER' ? 'Lider' : 'Üye'}
                        </span>
                        {isActiveGroupApproved ? (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-emerald-500/20">Onaylı</span>
                        ) : (
                          <span className="text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-orange-500/20">Onay Bekliyor</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {activeGroupRole !== 'GUEST' && (
                    <button 
                      onClick={handleLeaveGroup}
                      className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all border border-red-500/30 flex items-center gap-2 self-start sm:self-center"
                    >
                      🚪 Gruptan Ayrıl
                    </button>
                  )}
                </div>

                {activeGroupRole === 'GUEST' ? (
                  <div className="flex flex-col items-center justify-center p-20 bg-slate-900/50 border border-slate-800 rounded-3xl text-center shadow-2xl">
                    <div className="w-24 h-24 bg-[#00f0ff]/10 rounded-full flex items-center justify-center mb-8 border border-[#00f0ff]/30 shadow-[0_0_20px_rgba(0,240,255,0.1)]">
                      <span className="text-5xl">🤝</span>
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Bu Birime Katılın</h2>
                    <p className="text-slate-400 max-w-lg mx-auto mb-10 text-lg leading-relaxed">
                      Bu grubun harcamalarını görmek, borç durumunu takip etmek ve diğer üyelerle iletişime geçmek için katılım isteği göndermelisiniz.
                    </p>
                    <button 
                      onClick={async () => {
                        try {
                          await apiFetch(`/groups/${activeGroupId}/join`, { method: 'POST' });
                          alert("Katılma isteği başarıyla gönderildi!");
                          // Listeyi yenilemek ve seçimi sıfırlamak için
                          setActiveGroupId(null);
                          setRefreshTrigger(prev => prev + 1);
                        } catch (err: any) {
                          alert(err.message || "Hata oluştu.");
                        }
                      }}
                      className="px-12 py-5 bg-gradient-to-r from-[#00f0ff] to-[#00c0cc] text-slate-950 rounded-2xl font-black text-lg uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_30px_rgba(0,240,255,0.4)]"
                    >
                      GRUBA KATILMA DAVETİ GÖNDER
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Alt Sekmeler (Sub-panel) */}
                    <div className="bg-slate-900/40 p-2 rounded-2xl border border-slate-800/50 flex flex-wrap gap-2">
                      {[
                        { id: 'Harcamalar', label: '💸 Harcamalar' },
                        { id: 'Borç Durumu', label: '📊 Borç Durumu' },
                        { id: 'Sohbet', label: '💬 Sohbet' },
                        { id: 'Üyeler', label: '👥 Üyeler' },
                        ...(activeGroupRole === 'GROUP_LEADER' ? [{ id: 'Yönetim', label: '⚙️ Yönetim' }] : [])
                      ].map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => setActiveSubTab(sub.id as GroupSubTabType)}
                          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            activeSubTab === sub.id 
                              ? 'bg-[#00f0ff] text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                              : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>

                    {/* Onay Bekleniyor Mesajı */}
                    {!isActiveGroupApproved && (activeSubTab === 'Harcamalar' || activeSubTab === 'Borç Durumu' || activeSubTab === 'Sohbet') ? (
                      <div className="flex flex-col items-center justify-center p-16 bg-slate-900/50 border border-slate-800 rounded-3xl text-center">
                        <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mb-6 border border-orange-500/30">
                          <span className="text-4xl">⏳</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-100 mb-2">Onay Bekleniyor</h2>
                        <p className="text-slate-400 max-w-md mx-auto">
                          Grup liderinin katılım isteğinizi onaylaması bekleniyor.
                        </p>
                      </div>
                    ) : (
                      <div className="animate-fade-in-up">
                        {activeSubTab === 'Harcamalar' && (
                          <div className="flex flex-col w-full max-w-7xl mx-auto space-y-6">
                            <div className="w-full flex justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                              <div>
                                <h2 className="text-2xl font-bold text-slate-100">Grup Harcamaları</h2>
                                <p className="text-xs text-slate-500 mt-1 font-bold">{activeGroupName} grubuna ait harcamalar</p>
                              </div>
                              <button className="px-6 py-3 rounded-xl font-bold bg-[#b026ff] text-white hover:bg-[#c455ff] transition-all shadow-lg" onClick={() => setIsModalOpen(true)}>+ Harcama Ekle</button>
                            </div>
                            <ExpenseList groupId={activeGroupId} refreshTrigger={refreshTrigger} currentUserId={user?.id} />
                            {isModalOpen && (
                              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                                <div className="relative w-full max-w-md">
                                  <ExpenseForm groupId={activeGroupId} onSuccess={() => { setIsModalOpen(false); setRefreshTrigger(prev => prev + 1); }} onCancel={() => setIsModalOpen(false)} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {activeSubTab === 'Borç Durumu' && (
                          <div className="space-y-6">
                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl mb-6">
                                <h2 className="text-2xl font-bold text-slate-100">Borç Durumu</h2>
                                <p className="text-xs text-slate-500 mt-1 font-bold">{activeGroupName} için hesaplaşma detayları</p>
                            </div>
                            <DebtList groupId={activeGroupId} />
                          </div>
                        )}
                        
                        {activeSubTab === 'Sohbet' && (
                          <div className="space-y-6">
                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl mb-6">
                                <h2 className="text-2xl font-bold text-slate-100">Grup Sohbeti</h2>
                                <p className="text-xs text-slate-500 mt-1 font-bold">{activeGroupName} grubu mesajlaşma alanı</p>
                            </div>
                            <GroupChat groupId={activeGroupId} currentUserId={user?.id} />
                          </div>
                        )}

                        {activeSubTab === 'Üyeler' && (
                          <GroupMembers groupId={activeGroupId} />
                        )}

                        {activeSubTab === 'Yönetim' && activeGroupRole === 'GROUP_LEADER' && (
                          <GroupManagement 
                            groupId={activeGroupId} 
                            onUpdate={() => setRefreshTrigger(prev => prev + 1)} 
                          />
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Sosyal' && <SocialList currentUserId={user?.id} activeGroupId={activeGroupId} />}
        {activeTab === 'Profil' && <ProfileSettings onUpdate={fetchUser} />}
        {activeTab === 'Şikayet' && <ReportForm />}
        {activeTab === 'Admin' && user?.role?.toLowerCase() === 'admin' && <AdminPanel />}
        
        {isCreateModalOpen && (
          <CreateGroupModal 
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={() => {
              setIsCreateModalOpen(false);
              setRefreshTrigger(prev => prev + 1);
              alert("Grup oluşturma isteği alındı. Onay bekleniyor.");
            }}
          />
        )}
      </main>
    </div>
  );
};
