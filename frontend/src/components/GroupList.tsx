import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { Pagination } from './common/Pagination';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 12;
  
  const [joinStatus, setJoinStatus] = useState<JoinStatus | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchGroups = async (pageNum: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/groups?q=${encodeURIComponent(debouncedSearch)}&page=${pageNum}&limit=${limit}`);
      const data = await response.json();
      setGroups(data.groups || []);
      setTotalCount(data.total_count || 0);
    } catch (err: any) {
      console.error('Gruplar yüklenirken hata:', err);
      setError('Gruplar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups(page);
  }, [debouncedSearch, page, refreshTrigger]);

  const handleJoin = async (groupId: number) => {
    setJoinStatus({ groupId, loading: true, message: '', isError: false });
    try {
      await apiFetch(`/groups/${groupId}/join`, { method: 'POST' });
      setJoinStatus({ 
        groupId, 
        loading: false, 
        message: 'Katılma isteği gönderildi!', 
        isError: false 
      });
      // Üyelik durumu değiştiği için listeyi yenile
      fetchGroups(page);
    } catch (err: any) {
      setJoinStatus({ 
        groupId, 
        loading: false, 
        message: err.message || 'Hata oluştu.', 
        isError: true 
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="relative group max-w-2xl mx-auto w-full">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <span className="text-xl">🔍</span>
        </div>
        <input
          type="text"
          placeholder="Grup ismine göre ara..."
          className="block w-full pl-12 pr-4 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00f0ff]/30 focus:border-[#00f0ff] transition-all shadow-2xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="min-h-[500px] flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin"></div>
            <div className="text-[#00f0ff] font-bold tracking-widest animate-pulse uppercase text-xs">Ağ taranıyor...</div>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-red-900/20 border border-red-500/30 text-red-400 text-center font-bold">
            {error}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={page + debouncedSearch}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map((group) => {
                  const isSelected = activeGroupId === group.id;
                  const isMember = group.role !== undefined;
                  const isLeader = group.role === 'GROUP_LEADER';
                  
                  return (
                    <motion.div 
                      key={group.id}
                      whileHover={{ scale: 1.02, translateY: -5 }}
                      className={`relative p-6 rounded-3xl border transition-all cursor-pointer flex flex-col h-full overflow-hidden ${
                        isSelected 
                          ? 'bg-slate-900 border-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.15)]' 
                          : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                      onClick={() => onSelectGroup?.(group.id, group.name, group.role || 'GUEST', group.is_approved || false)}
                    >
                      {isMember && (
                        <div className={`absolute top-0 right-0 px-3 py-1 text-[9px] font-black uppercase tracking-tighter rounded-bl-xl ${
                          isLeader ? 'bg-amber-500 text-slate-950' : 'bg-[#00f0ff] text-slate-950'
                        }`}>
                          {isLeader ? 'LİDER' : 'ÜYE'}
                        </div>
                      )}
                      
                      <div className="mb-4">
                        <h3 className="text-xl font-black text-slate-100 mb-2 truncate group-hover:text-[#00f0ff] transition-colors leading-tight">
                          {group.name}
                        </h3>
                        <div className="flex gap-2">
                          <span className="text-[10px] text-slate-600 font-mono">ID: #{group.id}</span>
                          {!group.is_approved && isMember && (
                            <span className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">● Onay Bekliyor</span>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-slate-400 mb-8 flex-1 line-clamp-3 italic leading-relaxed">
                        {group.content || "Bu operasyonel birim için görev tanımı belirtilmemiş."}
                      </p>
                      
                      <div className="mt-auto">
                        {!isMember ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleJoin(group.id); }}
                            disabled={joinStatus?.groupId === group.id && joinStatus.loading}
                            className="w-full py-3 bg-slate-800 hover:bg-[#00f0ff] text-slate-300 hover:text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-slate-700 hover:border-[#00f0ff]"
                          >
                            {joinStatus?.groupId === group.id && joinStatus.loading ? 'İŞLENİYOR...' : 'KATILMA TALEBİ'}
                          </button>
                        ) : (
                          <div className={`w-full text-center py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            isSelected 
                            ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30 text-[#00f0ff]' 
                            : 'bg-slate-950/50 border-slate-800 text-slate-500'
                          }`}>
                            {isSelected ? 'AKTİF BİRİM' : 'GÖRÜNTÜLE →'}
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#00f0ff] shadow-[0_0_10px_#00f0ff]"></div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              
              {groups.length === 0 && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-600">
                  <span className="text-4xl mb-4 opacity-20">🚫</span>
                  <p className="text-lg italic font-medium">Birim bulunamadı veya erişim yetkiniz yok.</p>
                </div>
              )}

              <Pagination 
                currentPage={page}
                totalCount={totalCount}
                limit={limit}
                onPageChange={setPage}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
