import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { Users, ArrowRight, Plus } from 'lucide-react';
import { useGroupStore } from '../store/groupStore';

interface GroupListProps {
  onSelectGroup: (id: number, name: string, role: string, isApproved: boolean, nickname?: string | null) => void;
}

export const GroupList: React.FC<GroupListProps> = ({ onSelectGroup }) => {
  const { refreshTrigger, triggerRefresh } = useGroupStore();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/groups');
      const data = await response.json();
      setGroups(data.groups || []);
    } catch (error) {
      console.error('Gruplar alınırken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [refreshTrigger]);

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

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Join Section */}
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-8 rounded-[32px] shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00f0ff]/5 blur-3xl rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-white tracking-tight">Gruplarım</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            {groups.length} Aktif Bağlantı
          </p>
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
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-56 bg-slate-900/40 rounded-[32px] border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {groups.map((group, index) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ y: -8, borderColor: 'rgba(0, 240, 255, 0.3)' }}
                onClick={() => onSelectGroup(group.id, group.name, group.role || 'GUEST', group.is_approved, group.nickname)}
                className="group bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[32px] transition-all cursor-pointer shadow-xl flex flex-col justify-between min-h-[220px] relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl -mr-16 -mt-16 group-hover:bg-[#00f0ff]/10 transition-colors" />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-inner">
                      🏢
                    </div>
                    <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      group.role?.toUpperCase() === 'GROUP_LEADER' 
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                        : 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20'
                    }`}>
                      {group.role?.toUpperCase() === 'GROUP_LEADER' ? 'Lider' : 'Üye'}
                    </div>
                  </div>
                  <div className="mb-2">
                    <h3 className="text-xl font-black text-white group-hover:text-[#00f0ff] transition-colors tracking-tight line-clamp-1">
                      {group.name}
                    </h3>
                    {group.nickname && (
                      <span className="inline-block px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-black text-[#00f0ff]/70 uppercase tracking-widest mt-1">
                        🏷️ {group.nickname}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">{group.content || 'Açıklama belirtilmemiş.'}</p>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">Grup Durumu</span>
                    <span className={`text-[10px] font-black uppercase ${group.is_approved ? 'text-emerald-500' : 'text-orange-500 animate-pulse'}`}>
                      {group.is_approved ? 'AKTİF' : 'ONAY BEKLİYOR'}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#00f0ff] group-hover:text-slate-950 group-hover:scale-110 transition-all shadow-lg">
                    <ArrowRight size={18} />
                  </div>
                </div>
              </motion.div>
            ))}
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
      )}
    </div>
  );
};
