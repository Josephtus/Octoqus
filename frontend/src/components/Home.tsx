import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { LayoutGrid, CreditCard, ArrowUpRight, ArrowDownLeft, Users, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { getCategoryIcon } from '../utils/categories';

interface HomeProps {
  onSelectGroup: (id: number, name: string, role: string, isApproved: boolean, nickname?: string | null) => void;
}

export const Home: React.FC<HomeProps> = ({ onSelectGroup }) => {
  const { user } = useAuthStore();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [debts, setDebts] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const [summaryData, setSummaryData] = useState<any>({ total_spending: 0, summary: [] });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [starredPage, setStarredPage] = useState(1);
  const starredPerPage = 3;

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [groupsRes, summaryRes] = await Promise.all([
        apiFetch('/groups'),
        apiFetch('/expenses/summary/me')
      ]);
      
      const groupsData = await groupsRes.json();
      const sumData = await summaryRes.json();
      
      const allGroups = groupsData.groups || [];
      
      // Sort by last_accessed_at (desc) for consistency
      const sortedGroups = allGroups.sort((a: any, b: any) => {
        const timeA = a.last_accessed_at ? new Date(a.last_accessed_at).getTime() : 0;
        const timeB = b.last_accessed_at ? new Date(b.last_accessed_at).getTime() : 0;
        return timeB - timeA;
      });

      setMyGroups(sortedGroups);
      setSummaryData({
        total_spending: sumData?.total_spending || 0,
        summary: sumData?.summary || []
      });

      const debtData: any = {};
      for (const group of allGroups) {
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
      setMyGroups([]);
      setSummaryData({ total_spending: 0, summary: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStar = async (groupId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/groups/${groupId}/star`, { method: 'POST' });
      if (res.ok) {
        setMyGroups(prev => prev.map(g => g.id === groupId ? { ...g, is_starred: !g.is_starred } : g));
      }
    } catch (err) {
      console.error("Yıldızlama hatası:", err);
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
  const CATEGORY_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#ec4899', '#10b981', '#f43f5e'];

  // Sorting and Filtering
  const starredGroups = myGroups.filter(g => g.is_starred);

  const totalStarredPages = Math.ceil(starredGroups.length / starredPerPage);
  const currentStarredGroups = starredGroups.slice((starredPage - 1) * starredPerPage, starredPage * starredPerPage);

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 md:p-12 relative overflow-hidden shadow-2xl flex flex-col justify-center min-h-[340px]">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <LayoutGrid size={160} className="text-[#00f0ff]" />
          </div>
          <div className="relative z-10">
            <h2 className="text-5xl font-black text-white mb-4 tracking-tighter leading-tight">Merhaba, <br/>{user.name}! 👋</h2>
            <p className="text-slate-400 text-lg max-w-sm font-medium leading-relaxed">Octoqus finansal asistanına hoş geldin. Bugün harcamalarını kontrol etmek için harika bir gün.</p>
            
            <div className="flex flex-wrap gap-6 mt-10">
              <div className="px-8 py-5 rounded-[24px] bg-white/5 border border-white/10 flex items-center gap-5 shadow-inner">
                <div className="w-12 h-12 rounded-2xl bg-[#00f0ff]/20 flex items-center justify-center text-[#00f0ff]">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Aktif Gruplar</p>
                  <p className="text-2xl font-black text-white">{myGroups.length}</p>
                </div>
              </div>
              <div className="px-8 py-5 rounded-[24px] bg-white/5 border border-white/10 flex items-center gap-5 shadow-inner">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${totalBalance >= 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                  {totalBalance >= 0 ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Genel Durum</p>
                  <p className={`text-2xl font-black ${totalBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalBalance >= 0 ? '+' : ''}{totalBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* HARCAMA ÖZETİ PIECHART KARTI */}
        <div className="lg:col-span-5 bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden group min-h-[340px] flex flex-col">
          <div className="relative z-10 flex flex-col h-full">
             <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">HIZLI ÖZET</p>
                  <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Genel Harcamaların</h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                   <CreditCard size={24} className="text-[#00f0ff]" />
                </div>
             </div>

             <div className="flex flex-col sm:flex-row items-center gap-10 flex-1">
               <div className="relative w-40 h-40 flex-shrink-0">
                  {summaryData?.total_spending > 0 ? (
                    <svg className="w-full h-full rotate-[-90deg] overflow-visible" viewBox="-18 -18 36 36">
                       {summaryData.summary.map((c: any, i: number) => {
                          const percentage = (c.total / summaryData.total_spending);
                          let startAngleSum = 0;
                          for(let j=0; j<i; j++) startAngleSum += (summaryData.summary[j].total / summaryData.total_spending) * 2 * Math.PI;
                          
                          const startAngle = startAngleSum;
                          const endAngle = startAngleSum + (percentage * 2 * Math.PI);
                          const midAngle = startAngleSum + (percentage * Math.PI);
                          
                          const x1 = Math.cos(startAngle) * 16;
                          const y1 = Math.sin(startAngle) * 16;
                          const x2 = Math.cos(endAngle) * 16;
                          const y2 = Math.sin(endAngle) * 16;
                          
                          const largeArcFlag = percentage > 0.5 ? 1 : 0;
                          const d = `M 0 0 L ${x1} ${y1} A 16 16 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                          const explodeX = activeIndex === i ? Math.cos(midAngle) * 1 : 0;
                          const explodeY = activeIndex === i ? Math.sin(midAngle) * 1 : 0;
                          const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];

                          return (
                            <motion.path 
                              key={i} 
                              d={d}
                              fill={color}
                              stroke="#0f172a"
                              strokeWidth={0.8}
                              strokeLinejoin="round"
                              style={{ paintOrder: 'stroke fill' }}
                              animate={{ 
                                opacity: activeIndex === null || activeIndex === i ? 1 : 0.25,
                                scale: activeIndex === i ? 1.05 : 1,
                                x: explodeX,
                                y: explodeY,
                                filter: activeIndex === i ? `drop-shadow(0 0 12px ${color}88)` : 'none'
                              }}
                              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                              onMouseEnter={() => setActiveIndex(i)}
                              onMouseLeave={() => setActiveIndex(null)}
                            />
                          );
                       })}
                    </svg>
                  ) : (
                    <div className="w-full h-full rounded-full border-2 border-dashed border-white/10 flex items-center justify-center text-[10px] text-slate-600 font-black text-center p-4 uppercase tracking-widest leading-relaxed">Harcama Bulunmuyor</div>
                  )}
               </div>
               
               <div className="flex-1 w-full flex flex-col">
                  <div className="mb-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">TOPLAM TUTAR</p>
                    <p className="text-3xl font-black text-white tracking-tighter">₺{summaryData?.total_spending.toLocaleString('tr-TR')}</p>
                  </div>
                  
                  <div className="flex-1 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {summaryData?.summary.map((c: any, i: number) => (
                       <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onMouseEnter={() => setActiveIndex(i)}
                        onMouseLeave={() => setActiveIndex(null)}
                        className={`flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer ${activeIndex === i ? 'bg-white/10 scale-[1.02]' : 'hover:bg-white/5'}`}
                       >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                            <span className="text-lg shrink-0">{getCategoryIcon(c.category)}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[80px]">{c.category}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-black text-white leading-none">₺{c.total.toLocaleString('tr-TR')}</p>
                            <p className="text-[8px] font-black text-slate-600 uppercase mt-0.5">%{((c.total / summaryData.total_spending) * 100).toFixed(0)}</p>
                          </div>
                       </motion.div>
                    ))}
                  </div>
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* YILDIZLANAN GRUPLAR */}
      <div className="space-y-8">
        <div className="flex justify-between items-end px-2">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-3xl font-black text-white tracking-tight">Yıldızlanan Gruplar</h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Hızlı Erişim</p>
            </div>
            {totalStarredPages > 1 && (
              <span className="text-[10px] font-black bg-white/5 text-slate-400 px-3 py-1 rounded-full border border-white/10 uppercase tracking-tighter">
                SAYFA {starredPage}/{totalStarredPages}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {currentStarredGroups.length > 0 ? (
              currentStarredGroups.map((group) => {
                const balance = debts[group.id] || 0;
                return (
                  <motion.div 
                    key={group.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -8, scale: 1.01 }}
                    onClick={() => onSelectGroup(group.id, group.name, group.role, group.is_approved, group.nickname)}
                    className="group bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-[40px] p-8 hover:border-[#b026ff]/30 transition-all cursor-pointer shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-3xl -mr-12 -mt-12 pointer-events-none" />
                    
                    <div className="flex justify-between items-start mb-8">
                      <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl shadow-inner border border-white/5 group-hover:scale-110 transition-transform">
                        🏢
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => handleToggleStar(group.id, e)}
                          className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-500 flex items-center justify-center transition-all"
                        >
                          <span className="text-lg">★</span>
                        </button>
                        <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] ${group.role?.toUpperCase() === 'GROUP_LEADER' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20'}`}>
                          {group.role?.toUpperCase() === 'GROUP_LEADER' ? 'Lider' : 'Üye'}
                        </div>
                      </div>
                    </div>

                    <div className="mb-2">
                      <h4 className="text-xl font-black text-white group-hover:text-[#b026ff] transition-colors truncate tracking-tight">
                        {group.name}
                      </h4>
                      {group.nickname && (
                        <span className="inline-block px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">
                          🏷️ {group.nickname}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm font-medium line-clamp-1 mb-8 leading-relaxed">{group.content || 'Açıklama belirtilmemiş.'}</p>

                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cari Durum</p>
                        <p className={`text-lg font-black tracking-tighter ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {balance >= 0 ? 'Alacak: ' : 'Borç: '}
                          {Math.abs(balance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-[#b026ff] group-hover:text-white transition-all shadow-lg">
                        <ChevronRight size={20} />
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="col-span-full py-20 bg-slate-900/20 border border-dashed border-white/10 rounded-[40px] text-center">
                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 opacity-20">
                  <span className="text-2xl text-slate-400">★</span>
                </div>
                <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.3em]">Henüz yıldızlanmış bir grubunuz yok.</p>
                <p className="text-slate-600 text-[9px] mt-2 font-bold italic">Hızlı erişim için gruplarınızı yıldızlayabilirsiniz.</p>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalStarredPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-4">
              <button
                onClick={() => setStarredPage(prev => Math.max(prev - 1, 1))}
                disabled={starredPage === 1}
                className="w-12 h-12 rounded-2xl bg-slate-900/50 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-[#b026ff]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={20} className="rotate-180" />
              </button>
              
              <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-md border border-white/5 p-2 rounded-3xl">
                {Array.from({ length: totalStarredPages }).map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setStarredPage(i + 1)}
                    className={`w-10 h-10 rounded-2xl font-black text-xs transition-all ${
                      starredPage === i + 1 
                        ? 'bg-[#b026ff] text-white shadow-[0_0_20px_rgba(176,38,255,0.3)] scale-110' 
                        : 'text-slate-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStarredPage(prev => Math.min(prev + 1, totalStarredPages))}
                disabled={starredPage === totalStarredPages}
                className="w-12 h-12 rounded-2xl bg-slate-900/50 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-[#b026ff]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
