import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

interface Group {
  id: number;
  name: string;
  content?: string;
  role?: 'GROUP_LEADER' | 'USER';
  is_approved?: boolean;
}

interface JoinStatus {
  groupId: number;
  loading: boolean;
  message: string;
  isError: boolean;
}

interface GroupListProps {
  onSelectGroup?: (groupId: number, groupName: string, role: string, isApproved: boolean) => void;
  activeGroupId?: number | null;
  refreshTrigger?: number;
}

export const GroupList: React.FC<GroupListProps> = ({ onSelectGroup, activeGroupId, refreshTrigger }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [joinStatus, setJoinStatus] = useState<JoinStatus | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch('/groups');
        const data = await response.json();
        
        // Backend dönüş formatına göre (dizi ya da obje içinde groups)
        const groupsData = Array.isArray(data) ? data : data.groups || [];
        setGroups(groupsData);
      } catch (err: any) {
        console.error('Gruplar yüklenirken hata:', err);
        setError('Gruplar yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [refreshTrigger]);

  const handleJoin = async (groupId: number) => {
    // Aynı anda sadece tek bir gruba işlem durumunu tutuyoruz
    setJoinStatus({ groupId, loading: true, message: '', isError: false });
    
    try {
      await apiFetch(`/groups/${groupId}/join`, { method: 'POST' });
      setJoinStatus({ 
        groupId, 
        loading: false, 
        message: 'Katılma isteği gönderildi!', 
        isError: false 
      });
    } catch (err: any) {
      setJoinStatus({ 
        groupId, 
        loading: false, 
        message: err.message || 'Katılma isteği başarısız oldu.', 
        isError: true 
      });
    }
  };

  if (loading) {
    return (
      <div className="w-full py-16 flex justify-center items-center">
        <div className="text-[#00f0ff] animate-pulse font-bold text-xl drop-shadow-glow-blue">
          Gruplar Yükleniyor...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-4 rounded-lg bg-red-900/40 border border-red-500/50 text-red-200 text-center">
        {error}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center bg-slate-900 border border-slate-800 border-dashed rounded-xl shadow-inner">
        <svg className="w-16 h-16 text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="text-slate-400 text-lg font-medium">Sistemde henüz hiçbir grup bulunmuyor.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in-up">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-3xl font-extrabold text-slate-100 tracking-tight">
          Gruplar
        </h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => {
          const status = joinStatus?.groupId === group.id ? joinStatus : null;
          
          return (
            <div 
              key={group.id} 
              className={`flex flex-col p-6 bg-slate-900 border ${activeGroupId === group.id ? 'border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'border-slate-800 hover:border-slate-700 hover:shadow-[0_4px_25px_rgba(0,240,255,0.08)]'} rounded-2xl transition-all h-full relative group`}
            >
              <div className="flex-1 cursor-pointer" onClick={() => onSelectGroup && onSelectGroup(group.id, group.name, group.role || 'USER', group.is_approved || false)}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-2xl font-bold text-[#00f0ff] drop-shadow-glow-blue">
                    {group.name}
                  </h4>
                  {group.role && (
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-tighter ${group.role === 'GROUP_LEADER' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>
                      {group.role === 'GROUP_LEADER' ? 'LİDER' : 'ÜYE'}
                    </span>
                  )}
                </div>
                
                <div className="flex gap-2 mb-3">
                  {activeGroupId === group.id && (
                    <span className="text-[10px] bg-[#00f0ff]/20 text-[#00f0ff] px-2 py-0.5 rounded-full font-bold">Aktif</span>
                  )}
                  {group.role && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${group.is_approved ? 'bg-emerald-500/20 text-emerald-500' : 'bg-orange-500/20 text-orange-500'}`}>
                      {group.is_approved ? 'Onaylı' : 'Onay Bekliyor'}
                    </span>
                  )}
                </div>

                {group.content ? (
                  <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-3">
                    {group.content}
                  </p>
                ) : (
                  <p className="text-slate-600 text-sm italic mb-4">Açıklama bulunmuyor.</p>
                )}
              </div>
              
              <div className="mt-4 pt-5 border-t border-slate-800">
                {status && status.message && (
                  <div 
                    className={`text-sm mb-4 text-center p-2.5 rounded-lg font-medium animate-fade-in-up ${
                      status.isError 
                        ? 'bg-red-900/30 text-red-400 border border-red-800' 
                        : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {status.message}
                  </div>
                )}
                
                {!group.role ? (
                  <button
                    onClick={() => handleJoin(group.id)}
                    disabled={status?.loading}
                    className="w-full py-3 rounded-xl font-bold bg-slate-800 text-[#00f0ff] hover:bg-[#00f0ff] hover:text-slate-900 transition-all border border-[#00f0ff]/30 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status?.loading ? 'İstek Gönderiliyor...' : 'Gruba Katıl'}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onSelectGroup && onSelectGroup(group.id, group.name, group.role || 'USER', group.is_approved || false)}
                      className="flex-1 py-3 rounded-xl font-bold bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 hover:bg-[#00f0ff] hover:text-slate-900 transition-all"
                    >
                      Gruba Git
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm(`${group.name} grubundan ayrılmak istediğinize emin misiniz?`)) {
                          try {
                            await apiFetch(`/groups/${group.id}/leave`, { method: 'POST' });
                            window.location.reload();
                          } catch (err) {
                            alert("Ayrılma işlemi başarısız.");
                          }
                        }
                      }}
                      className="p-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all"
                      title="Gruptan Ayrıl"
                    >
                      🚪
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
