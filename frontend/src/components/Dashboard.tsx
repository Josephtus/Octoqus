import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { ExpenseForm } from './ExpenseForm';
import { ExpenseList } from './ExpenseList';
import { GroupList } from './GroupList';
import { DebtList } from './DebtList';
import { ProfileSettings } from './ProfileSettings';

type TabType = 'Gruplar' | 'Harcamalar' | 'Borç Durumu' | 'Profil';

export const Dashboard: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Test için sabit Group ID (İleride dinamik yapılacak)
  const [activeGroupId] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Tab State'i
  const [activeTab, setActiveTab] = useState<TabType>('Gruplar');
  const tabs: TabType[] = ['Gruplar', 'Harcamalar', 'Borç Durumu', 'Profil'];

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await apiFetch('/auth/me');
        const data = await response.json();
        setUser(data);
      } catch (error) {
        console.error('Kullanıcı bilgileri alınırken hata:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-950">
        <div className="w-full max-w-md p-10 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl text-center">
          <h2 className="text-3xl font-bold text-[#00f0ff] animate-pulse drop-shadow-glow-blue">Yükleniyor...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Üst Kısım ve Navigasyon Menüsü (Tabs) */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center py-5">
            <h1 className="text-2xl font-black text-[#00f0ff] drop-shadow-glow-blue mb-4 sm:mb-0 tracking-wide">
              SplitApp
            </h1>
            <div className="text-slate-300 font-medium bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-700">
              Hoş Geldin{user?.name ? `, ${user.name}` : ''}
            </div>
          </div>
          
          <nav className="flex space-x-2 overflow-x-auto pb-0 hide-scrollbar mt-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap py-3.5 px-6 rounded-t-xl font-bold text-sm sm:text-base transition-all ${
                  activeTab === tab
                    ? 'bg-slate-800 text-[#00f0ff] border-t-2 border-l border-r border-[#00f0ff]/30 shadow-[inset_0_2px_10px_rgba(0,240,255,0.1)]'
                    : 'text-slate-400 border-t-2 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Ana İçerik Alanı */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in-up">
        
        {/* Gruplar Sekmesi */}
        {activeTab === 'Gruplar' && (
          <GroupList />
        )}

        {/* Harcamalar Sekmesi */}
        {activeTab === 'Harcamalar' && (
          <div className="flex flex-col items-center w-full max-w-5xl mx-auto space-y-6">
            <div className="w-full flex flex-col sm:flex-row justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <h2 className="text-2xl font-bold text-slate-100 mb-4 sm:mb-0">Grup Harcamaları</h2>
              <button 
                className="px-6 py-3 rounded-xl font-bold bg-[#b026ff] text-white hover:bg-[#c455ff] transition-all drop-shadow-glow-purple shadow-lg hover:shadow-[#b026ff]/50 hover:-translate-y-0.5 flex items-center gap-2 w-full sm:w-auto justify-center"
                onClick={() => setIsModalOpen(true)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Harcama Ekle
              </button>
            </div>
            
            <div className="w-full">
              <ExpenseList groupId={activeGroupId} refreshTrigger={refreshTrigger} />
            </div>
            
            {/* Harcama Ekleme Modalı */}
            {isModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                <div className="relative w-full max-w-md animate-fade-in-up">
                  <ExpenseForm 
                    groupId={activeGroupId}
                    onSuccess={() => {
                      setIsModalOpen(false);
                      setRefreshTrigger(prev => prev + 1);
                    }}
                    onCancel={() => setIsModalOpen(false)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Borç Durumu Sekmesi */}
        {activeTab === 'Borç Durumu' && (
          <div className="w-full max-w-4xl mx-auto">
            <DebtList groupId={activeGroupId} />
          </div>
        )}

        {/* Profil Sekmesi */}
        {activeTab === 'Profil' && (
          <ProfileSettings />
        )}
        
      </main>
    </div>
  );
};
