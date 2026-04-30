import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { Users, ArrowRight, Plus } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useGroupStore } from '../store/groupStore';

interface GroupListProps {
  onSelectGroup: (id: number, name: string, role: string, isApproved: boolean, nickname?: string | null) => void;
}

export const GroupList: React.FC<GroupListProps> = ({ onSelectGroup }) => {
  const { user } = useAuthStore();
  const { refreshTrigger, triggerRefresh } = useGroupStore();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const groupsPerPage = 6;

  const [debts, setDebts] = useState<Record<number, number>>({});

  const fetchGroups = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await apiFetch('/groups');
      const data = await response.json();
      const allGroups = data.groups || [];
      
      // Sort by last_accessed_at (desc)
      const sortedGroups = allGroups.sort((a: any, b: any) => {
        const timeA = a.last_accessed_at ? new Date(a.last_accessed_at).getTime() : 0;
        const timeB = b.last_accessed_at ? new Date(b.last_accessed_at).getTime() : 0;
        return timeB - timeA;
      });

      setGroups(sortedGroups);
      
      const debtData: Record<number, number> = {};
      await Promise.all(allGroups.map(async (group: any) => {
        try {
          const res = await apiFetch(`/expenses/${group.id}/debts`);
          if (res.ok) {
            const d = await res.json();
            let netBalance = 0;
            if (d.transactions) {
              d.transactions.forEach((tx: any) => {
                if (tx.from_user_id === user.id) netBalance -= tx.amount;
                if (tx.to_user_id === user.id) netBalance += tx.amount;
              });
            }
            debtData[group.id] = netBalance;
          } else {
            debtData[group.id] = 0;
          }
        } catch (e) {
          debtData[group.id] = 0;
        }
      }));
      setDebts(debtData);
    } catch (error) {
      console.error('Gruplar alınırken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStar = async (groupId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/groups/${groupId}/star`, { method: 'POST' });
      if (res.ok) {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, is_starred: !g.is_starred } : g));
      }
    } catch (err) {
      console.error("Yıldızlama hatası:", err);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [refreshTrigger, user?.id]);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setJoinLoading(true);
    try {
      const response = await apiFetch('/groups/join', {
        method: 'POST',
        body: JSON.stringify({ invite_code: inviteCode.trim() })
      });
      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        setInviteCode('');
        triggerRefresh();
      } else {
        alert(data.message || "Katılma isteği gönderilemedi.");
      }
    } catch (error) {
      alert("Bir hata oluştu.");
    } finally {
      setJoinLoading(false);
    }
  };

  const totalPages = Math.ceil(groups.length / groupsPerPage);
  const indexOfLastGroup = currentPage * groupsPerPage;
  const indexOfFirstGroup = indexOfLastGroup - groupsPerPage;
  const currentGroups = groups.slice(indexOfFirstGroup, indexOfLastGroup);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      {/* Header & Join Section */}
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-8 rounded-[32px] shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00f0ff]/5 blur-3xl rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-white tracking-tight">Gruplarım</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
              {groups.length} Aktif Bağlantı
            </p>
            {totalPages > 1 && (
              <span className="text-[10px] font-black bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-white/5 uppercase tracking-tighter">
                SAYFA {currentPage}/{totalPages}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleJoinByCode} className="relative w-full max-w-lg flex gap-3 z-10">
          <div className="relative flex-1 group">
            <input 
              type="text" 
              placeholder="#DAVET-KODU"
              className="w-full pl-6 pr-4 py-4 rounded-2xl bg-slate-950/50 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f0ff]/50 focus:ring-1 focus:ring-[#00f0ff]/20 transition-all font-mono tracking-widest text-sm"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </div>
          <button 
            type="submit"
            disabled={joinLoading || !inviteCode.trim()}
            className="px-8 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#00f0ff] transition-all active:scale-95 disabled:opacity-50 disabled:grayscale shadow-xl flex items-center gap-2 whitespace-nowrap"
          >
            {joinLoading ? 'GÖNDERİLİYOR...' : (
              <>
                <Plus size={16} /> GRUBA KATIL
              </>
            )}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-56 bg-slate-900/40 rounded-[32px] border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="wait">
              {currentGroups.map((group, index) => {
                const balance = debts[group.id] || 0;
                return (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    whileHover={{ y: -8, scale: 1.01 }}
                    onClick={() => onSelectGroup(group.id, group.name, group.role || 'GUEST', group.is_approved, group.nickname)}
                    className="group bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-[40px] p-8 hover:border-[#00f0ff]/30 transition-all cursor-pointer shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[320px]"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl -mr-16 -mt-16 group-hover:bg-[#00f0ff]/10 transition-colors" />
                    
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl shadow-inner border border-white/5 group-hover:scale-110 transition-transform">
                          🏢
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => handleToggleStar(group.id, e)}
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${group.is_starred ? 'bg-amber-500/20 border-amber-500/50 text-amber-500' : 'bg-white/5 border-white/10 text-slate-500 hover:text-amber-500 hover:border-amber-500/30'}`}
                          >
                            <span className="text-lg">★</span>
                          </button>
                          <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] ${
                            group.role?.toUpperCase() === 'GROUP_LEADER' 
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                              : 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20'
                          }`}>
                            {group.role?.toUpperCase() === 'GROUP_LEADER' ? 'Lider' : 'Üye'}
                          </div>
                        </div>
                      </div>
                      <div className="mb-2">
                        <h3 className="text-xl font-black text-white group-hover:text-[#00f0ff] transition-colors tracking-tight line-clamp-1">
                          {group.name}
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {group.nickname && (
                            <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                              🏷️ {group.nickname}
                            </span>
                          )}
                          {!group.is_approved && (
                            <span className="px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20 text-[9px] font-black text-orange-500 uppercase tracking-widest animate-pulse">
                              Onay Bekliyor
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-500 text-sm font-medium line-clamp-2 leading-relaxed mt-4">{group.content || 'Açıklama belirtilmemiş.'}</p>
                    </div>
    
                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cari Durum</p>
                        <p className={`text-lg font-black tracking-tighter ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {balance >= 0 ? 'Alacak: ' : 'Borç: '}
                          {Math.abs(balance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-[#00f0ff] group-hover:text-slate-950 group-hover:scale-110 transition-all shadow-lg">
                        <ArrowRight size={20} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {groups.length === 0 && (
              <div className="col-span-full py-24 text-center bg-slate-900/20 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center">
                <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                  <Users size={32} className="text-slate-600" />
                </div>
                <h3 className="text-xl font-black text-white mb-2">Henüz Bir Grubun Yok</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                  Yeni bir grup oluşturabilir veya sana iletilen davet kodunu kullanarak bir gruba katılabilirsin.
                </p>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="w-12 h-12 rounded-2xl bg-slate-900/50 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-[#00f0ff]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ArrowRight size={20} className="rotate-180" />
              </button>
              
              <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-md border border-white/5 p-2 rounded-3xl">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-2xl font-black text-xs transition-all ${
                      currentPage === i + 1 
                        ? 'bg-[#00f0ff] text-slate-950 shadow-[0_0_20px_rgba(0,240,255,0.3)] scale-110' 
                        : 'text-slate-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="w-12 h-12 rounded-2xl bg-slate-900/50 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-[#00f0ff]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
