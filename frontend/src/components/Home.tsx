import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { LayoutGrid, CreditCard, ArrowUpRight, ArrowDownLeft, Users, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface HomeProps {
  onSelectGroup: (id: number, name: string, role: string, isApproved: boolean, nickname?: string | null) => void;
}

export const Home: React.FC<HomeProps> = ({ onSelectGroup }) => {
  const { user } = useAuthStore();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [debts, setDebts] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const groupsRes = await apiFetch('/groups?joined=true&limit=5');
      const groupsData = await groupsRes.json();
      const joinedGroups = groupsData.groups || [];
      setMyGroups(joinedGroups);

      const debtData: any = {};
      for (const group of joinedGroups) {
        try {
          const res = await apiFetch(`/expenses/${group.id}/debts`);
          if (res.status === 403) {
            debtData[group.id] = 0;
            continue;
          }
          const d = await res.json();
          let netBalance = 0;
          if (d.transactions) {
            d.transactions.forEach((tx: any) => {
              if (tx.from_user_id === user.id) netBalance -= tx.amount;
              if (tx.to_user_id === user.id) netBalance += tx.amount;
            });
          }
          debtData[group.id] = netBalance;
        } catch (e) {
          console.error(`Grup ${group.id} borç hatası:`, e);
          debtData[group.id] = 0;
        }
      }

      setDebts(debtData);
    } catch (err) {
      console.error("Home veri çekme hatası:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin" />
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Veriler Hazırlanıyor...</p>
      </div>
    );
  }

  const totalBalance = Object.values(debts).reduce((acc: number, val: any) => acc + val, 0) as number;

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 md:p-10 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <LayoutGrid size={120} className="text-[#00f0ff]" />
          </div>
          <div className="relative z-10">
            <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">Merhaba, {user.name}! 👋</h2>
            <p className="text-slate-400 text-sm max-w-md">Octoqus finansal asistanına hoş geldin. Bugün harcamalarını kontrol etmek için harika bir gün.</p>
            
            <div className="flex flex-wrap gap-4 mt-8">
              <div className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#00f0ff]/20 flex items-center justify-center text-[#00f0ff]">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Aktif Gruplar</p>
                  <p className="text-xl font-black text-white">{myGroups.length}</p>
                </div>
              </div>
              <div className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalBalance >= 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                  {totalBalance >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Genel Durum</p>
                  <p className={`text-xl font-black ${totalBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {totalBalance >= 0 ? '+' : ''}{totalBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#00f0ff] to-[#b026ff] rounded-[32px] p-8 text-slate-950 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div>
              <CreditCard size={32} className="mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest opacity-70">Hızlı Özet</p>
              <h3 className="text-2xl font-black leading-tight">Finansal Sağlığın Güvende.</h3>
            </div>
            <button className="mt-8 py-3 bg-slate-950 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-colors">
              Raporları İncele
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-end px-2">
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight">Üyesi Olduğun Gruplar</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Son Etkinliklere Göre</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myGroups.length > 0 ? (
            myGroups.map((group) => {
              const balance = debts[group.id] || 0;
              return (
                <motion.div 
                  key={group.id}
                  whileHover={{ y: -5 }}
                  onClick={() => onSelectGroup(group.id, group.name, group.role, group.is_approved, group.nickname)}
                  className="group bg-slate-900/60 border border-white/5 rounded-3xl p-6 hover:border-[#00f0ff]/30 transition-all cursor-pointer shadow-xl relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-xl shadow-inner">
                      🏢
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${group.role?.toUpperCase() === 'GROUP_LEADER' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20'}`}>
                      {group.role?.toUpperCase() === 'GROUP_LEADER' ? 'Lider' : 'Üye'}
                    </div>
                  </div>

                  <div className="mb-1">
                    <h4 className="text-lg font-black text-white group-hover:text-[#00f0ff] transition-colors truncate">
                      {group.name}
                    </h4>
                    {group.nickname && (
                      <span className="inline-block px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                        🏷️ {group.nickname}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs line-clamp-1 mb-6">{group.content || 'Açıklama belirtilmemiş.'}</p>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Durum</p>
                      <p className={`text-sm font-black ${balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {balance >= 0 ? 'Alacak: ' : 'Borç: '}
                        {Math.abs(balance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-[#00f0ff] group-hover:text-slate-950 transition-all">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-full py-16 bg-slate-900/20 border border-dashed border-slate-800 rounded-[32px] text-center">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <LayoutGrid size={24} className="text-slate-600" />
              </div>
              <p className="text-slate-400 font-bold text-sm">Henüz bir gruba üye değilsiniz.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
