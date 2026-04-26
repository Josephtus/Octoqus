import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { Search, Users, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGroupStore } from '../store/groupStore';

interface GroupListProps {
  onSelectGroup: (id: number, name: string, role: string, isApproved: boolean) => void;
}

export const GroupList: React.FC<GroupListProps> = ({ onSelectGroup }) => {
  const { refreshTrigger } = useGroupStore();
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 6;

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/groups?q=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
      const data = await response.json();
      setGroups(data.groups || []);
      setTotalCount(data.total_count || 0);
    } catch (error) {
      console.error('Gruplar alınırken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [search, refreshTrigger, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-6 rounded-[32px] shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f0ff]/5 blur-2xl rounded-full pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-xl font-black text-white tracking-tight">Topluluk Keşfet</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">{totalCount} Aktif Grup Bulundu</p>
        </div>
        <div className="relative w-full max-w-md group z-10">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00f0ff] transition-colors">
            <Search size={16} />
          </div>
          <input 
            type="text" 
            placeholder="Grup ara..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-950/50 border border-white/5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f0ff]/50 transition-all text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-48 bg-slate-900/40 rounded-3xl border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {groups.map((group, index) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                whileHover={{ y: -5, borderColor: 'rgba(0, 240, 255, 0.3)' }}
                onClick={() => onSelectGroup(group.id, group.name, group.role || 'GUEST', group.is_approved)}
                className="group bg-slate-900/40 backdrop-blur-md border border-white/5 p-6 rounded-[28px] transition-all cursor-pointer shadow-lg flex flex-col justify-between min-h-[180px]"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg">
                      🏢
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                        group.role?.toUpperCase() === 'GROUP_LEADER' 
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                          : group.role?.toUpperCase() === 'USER'
                          ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20'
                          : 'bg-white/5 text-slate-500'
                      }`}>
                        {group.role?.toUpperCase() === 'GROUP_LEADER' ? 'Lider' : group.role?.toUpperCase() === 'USER' ? 'Üye' : 'Misafir'}
                      </div>
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-white group-hover:text-[#00f0ff] transition-colors tracking-tight line-clamp-1">{group.name}</h3>
                  <p className="text-slate-500 text-xs line-clamp-1 mt-1">{group.content || 'Açıklama yok.'}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 group-hover:text-white transition-colors">
                    <Users size={12} /> İncele
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#00f0ff] group-hover:text-slate-950 transition-all">
                    <ArrowRight size={14} />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {groups.length === 0 && (
            <div className="col-span-full py-16 text-center bg-slate-900/20 border border-dashed border-white/5 rounded-[32px]">
              <Search size={24} className="text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 font-bold text-sm">Grup bulunamadı.</p>
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/10 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex items-center gap-2">
            {[...Array(totalPages)].map((_, i) => {
              const pNum = i + 1;
              if (totalPages > 5 && Math.abs(pNum - page) > 2) return null;
              
              return (
                <button
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${
                    page === pNum 
                      ? 'bg-[#00f0ff] text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.4)]' 
                      : 'bg-white/5 text-slate-500 hover:text-white'
                  }`}
                >
                  {pNum}
                </button>
              );
            })}
          </div>

          <button 
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/10 transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
};
