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

type TabType = 'Gruplar' | 'Harcamalar' | 'Borç Durumu' | 'Sohbet' | 'Sosyal' | 'Profil' | 'Şikayet' | 'Admin' | 'Grup Yönetimi';

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

  useEffect(() => {
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

  // Dinamik sekmeler
  const navTabs: TabType[] = ['Gruplar'];
  
  // Eğer bir grup seçiliyse gruba özel sekmeleri ekle
  if (activeGroupId) {
    navTabs.push('Harcamalar', 'Borç Durumu', 'Sohbet');
    if (activeGroupRole === 'GROUP_LEADER') {
      navTabs.push('Grup Yönetimi');
    }
  }
  
  navTabs.push('Sosyal', 'Profil', 'Şikayet');

  if (user?.role?.toLowerCase() === 'admin') {
    navTabs.unshift('Admin');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              
              {activeGroupId && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleLeaveGroup}
                    className="text-xs font-bold text-red-500 hover:text-red-400 transition-colors border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/5"
                  >
                    🚪 Gruptan Ayrıl
                  </button>
                  <button 
                    onClick={() => { 
                      setActiveGroupId(null); 
                      setActiveGroupName(null); 
                      setActiveGroupRole(null);
                      setIsActiveGroupApproved(false);
                      setActiveTab('Gruplar'); 
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1 ml-2"
                  >
                    ✖ Kapat
                  </button>
                </div>
              )}

              <div className="text-sm text-slate-400 border-l border-slate-800 pl-4 hidden sm:block">
                <span className="text-slate-100 font-bold">{user?.name}</span>
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
                {tab === 'Admin' ? '🛡️ ADMİN' : tab === 'Grup Yönetimi' ? '⚙️ YÖNETİM' : tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {activeTab === 'Gruplar' && (
          <GroupList 
            onSelectGroup={(id, name, role, isApproved) => { 
              setActiveGroupId(id); 
              setActiveGroupName(name);
              setActiveGroupRole(role);
              setIsActiveGroupApproved(isApproved);
              setActiveTab('Harcamalar'); 
            }} 
            activeGroupId={activeGroupId} 
            refreshTrigger={refreshTrigger}
          />
        )}

        {/* Grup Onaylanmadıysa İçerikleri Gizle */}
        {activeGroupId && !isActiveGroupApproved && (activeTab === 'Harcamalar' || activeTab === 'Borç Durumu' || activeTab === 'Sohbet') && (
          <div className="flex flex-col items-center justify-center p-16 bg-slate-900/50 border border-slate-800 rounded-3xl text-center animate-fade-in">
             <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mb-6 border border-orange-500/30">
                <span className="text-4xl">⏳</span>
             </div>
             <h2 className="text-2xl font-bold text-slate-100 mb-2">Onay Bekleniyor</h2>
             <p className="text-slate-400 max-w-md mx-auto">
                Grup liderinin katılım isteğinizi onaylaması bekleniyor. Onaylandıktan sonra harcamaları ve sohbeti görebilirsiniz.
             </p>
          </div>
        )}

        {/* Onaylı Kullanıcılar İçin Grup Sekmeleri */}
        {activeGroupId && isActiveGroupApproved && (
          <>
            {activeTab === 'Harcamalar' && (
              <div className="flex flex-col w-full max-w-5xl mx-auto space-y-6">
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

            {activeTab === 'Borç Durumu' && (
              <div className="space-y-6">
                 <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl mb-6">
                    <h2 className="text-2xl font-bold text-slate-100">Borç Durumu</h2>
                    <p className="text-xs text-slate-500 mt-1 font-bold">{activeGroupName} grubu için hesaplaşma detayları</p>
                 </div>
                 <DebtList groupId={activeGroupId} />
              </div>
            )}
            
            {activeTab === 'Sohbet' && (
              <div className="space-y-6">
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl mb-6">
                    <h2 className="text-2xl font-bold text-slate-100">Grup Sohbeti</h2>
                    <p className="text-xs text-slate-500 mt-1 font-bold">{activeGroupName} grubu mesajlaşma alanı</p>
                </div>
                <GroupChat groupId={activeGroupId} currentUserId={user?.id} />
              </div>
            )}
          </>
        )}

        {/* Grup Yönetimi (Sadece Lider İçin) */}
        {activeTab === 'Grup Yönetimi' && activeGroupId && activeGroupRole === 'GROUP_LEADER' && (
          <GroupManagement 
            groupId={activeGroupId} 
            onUpdate={() => setRefreshTrigger(prev => prev + 1)} 
          />
        )}

        {(activeTab === 'Harcamalar' || activeTab === 'Borç Durumu' || activeTab === 'Sohbet') && !activeGroupId && (
          <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 border-dashed">
            <p className="text-slate-400 mb-4 italic">Bu özelliği kullanmak için önce "Gruplar" sekmesinden bir grup seçmelisiniz.</p>
            <button onClick={() => setActiveTab('Gruplar')} className="text-[#00f0ff] font-bold underline hover:text-[#4dffff]">Gruplara Git →</button>
          </div>
        )}

        {activeTab === 'Sosyal' && <SocialList currentUserId={user?.id} activeGroupId={activeGroupId} />}
        {activeTab === 'Profil' && <ProfileSettings />}
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
