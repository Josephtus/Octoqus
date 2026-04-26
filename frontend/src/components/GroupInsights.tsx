import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useGroupStore } from '../store/groupStore';

interface Expense {
  id: number;
  amount: number;
  content: string;
  category?: string;
  date: string;
  added_by: number;
  added_by_name: string;
}

interface Category {
  name: string;
  icon: string;
}

type FilterType = 'Ay' | 'Yıl' | 'Tümü';
type ViewScope = 'Grup İçin' | 'Benim İçin';

const DEFAULT_ICONS: Record<string, string> = {
  'Konaklama': '🛌', 'Eğlence': '🎤', 'Market Alışverişi': '🛒', 'Sağlık': '🦷',
  'Sigorta': '🧯', 'Kira ve Masraflar': '🏠', 'Restoranlar ve Barlar': '🍔',
  'Shopping': '🛍️', 'Transport': '🚕', 'Fatura': '🧾', 'Balık': '🐟',
  'Yufkacı': '🥟', 'Kasap': '🥩', 'İçme suyu': '💧', 'Halı Yıkama': '🧼', 'Diğer': '🖐️'
};

const CATEGORY_COLORS: string[] = ['#6366f1', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#ec4899', '#10b981', '#f43f5e'];

export const GroupInsights: React.FC = () => {
  const { user } = useAuthStore();
  const { activeGroup } = useGroupStore();
  const groupId = activeGroup?.id;
  const currentUserId = user?.id;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('Ay');
  const [viewScope, setViewScope] = useState<ViewScope>('Grup İçin');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [customCats, setCustomCats] = useState<Category[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const fetchAll = async () => {
    if (!groupId) return;
    try {
      const [expRes, groupRes] = await Promise.all([
        apiFetch(`/expenses/${groupId}`),
        apiFetch(`/groups/${groupId}`)
      ]);
      const expData = await expRes.json();
      const groupData = await groupRes.json();
      
      setExpenses(expData.expenses || []);
      if (groupData.group.custom_categories) {
        setCustomCats(JSON.parse(groupData.group.custom_categories));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [groupId]);

  const getIcon = (catName: string) => {
    if (DEFAULT_ICONS[catName]) return DEFAULT_ICONS[catName];
    const custom = customCats.find(c => c.name === catName);
    return custom ? custom.icon : '📦';
  };

  const filteredExpenses = useMemo(() => {
    let list = expenses;
    if (viewScope === 'Benim İçin' && currentUserId) {
      list = list.filter(e => e.added_by === currentUserId);
    }
    if (filterType === 'Ay') {
      list = list.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
      });
    } else if (filterType === 'Yıl') {
      list = list.filter(e => new Date(e.date).getFullYear() === currentDate.getFullYear());
    }
    return list;
  }, [expenses, filterType, viewScope, currentDate, currentUserId]);

  const stats = useMemo(() => {
    const categories: Record<string, { total: number; label: string; color: string; icon: string }> = {};
    let total = 0;
    
    filteredExpenses.forEach(e => {
      const catName = e.category || 'Diğer';
      if (!categories[catName]) {
        const colorIdx = Object.keys(categories).length % CATEGORY_COLORS.length;
        categories[catName] = { 
          total: 0, 
          label: catName, 
          color: CATEGORY_COLORS[colorIdx], 
          icon: getIcon(catName) 
        };
      }
      categories[catName].total += Number(e.amount);
      total += Number(e.amount);
    });
    
    return { 
      categories: Object.values(categories).sort((a, b) => b.total - a.total), 
      total 
    };
  }, [filteredExpenses, customCats]);

  const monthName = filterType === 'Ay' 
    ? currentDate.toLocaleString('tr-TR', { month: 'long', year: 'numeric' })
    : currentDate.getFullYear().toString();

  const dataBoundaries = useMemo(() => {
    if (expenses.length === 0) return { min: new Date(), max: new Date() };
    const dates = expenses.map(e => new Date(e.date).getTime());
    return {
      min: new Date(Math.min(...dates)),
      max: new Date(Math.max(...dates))
    };
  }, [expenses]);

  const handleNav = (dir: number) => {
    if (filterType === 'Tümü') return;
    let d = new Date(currentDate);
    let found = false;
    for (let i = 0; i < 24; i++) {
      if (filterType === 'Ay') d.setMonth(d.getMonth() + dir);
      else d.setFullYear(d.getFullYear() + dir);
      const hasData = expenses.some(e => {
        const ed = new Date(e.date);
        if (filterType === 'Ay') return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
        return ed.getFullYear() === d.getFullYear();
      });
      if (hasData) {
        found = true;
        break;
      }
      if (dir < 0 && d < dataBoundaries.min) break;
      if (dir > 0 && d > dataBoundaries.max) break;
    }
    if (found) setCurrentDate(new Date(d));
  };

  const canNavPrev = useMemo(() => {
    if (filterType === 'Tümü' || expenses.length === 0) return false;
    return expenses.some(e => {
      const ed = new Date(e.date);
      if (filterType === 'Ay') {
        return ed.getFullYear() < currentDate.getFullYear() || 
               (ed.getFullYear() === currentDate.getFullYear() && ed.getMonth() < currentDate.getMonth());
      }
      return ed.getFullYear() < currentDate.getFullYear();
    });
  }, [currentDate, filterType, expenses]);

  const canNavNext = useMemo(() => {
    if (filterType === 'Tümü' || expenses.length === 0) return false;
    return expenses.some(e => {
      const ed = new Date(e.date);
      if (filterType === 'Ay') {
        return ed.getFullYear() > currentDate.getFullYear() || 
               (ed.getFullYear() === currentDate.getFullYear() && ed.getMonth() > currentDate.getMonth());
      }
      return ed.getFullYear() > currentDate.getFullYear();
    });
  }, [currentDate, filterType, expenses]);

  if (!groupId) return null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-slate-900/20 rounded-[40px] border border-white/5">
        <div className="w-16 h-16 border-4 border-[#00f0ff]/10 border-t-[#00f0ff] rounded-full animate-spin mb-6"></div>
        <p className="text-[#00f0ff] font-black text-xs uppercase tracking-[0.4em] animate-pulse">Analiz Hazırlanıyor</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#00f0ff]/5 to-[#b026ff]/5 blur-3xl -mr-32 -mt-32 pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row gap-12 relative z-10">
          <div className="lg:w-1/2 space-y-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-black text-white tracking-tighter uppercase">İstatistikler</h3>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Gerçek Kategorilere Göre</p>
              </div>
              <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
                {(['Ay', 'Yıl', 'Tümü'] as FilterType[]).map(t => (
                  <button key={t} onClick={() => setFilterType(t)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === t ? 'bg-white text-black shadow-xl' : 'text-slate-400 hover:text-white'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {filterType !== 'Tümü' && (
              <div className="flex items-center justify-between py-6 border-y border-white/5">
                <button 
                  onClick={() => canNavPrev && handleNav(-1)} 
                  disabled={!canNavPrev}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${canNavPrev ? 'bg-white/5 hover:bg-[#00f0ff] hover:text-black cursor-pointer' : 'bg-white/2 opacity-20 cursor-not-allowed'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-lg font-black text-white uppercase tracking-widest">{monthName}</span>
                <button 
                  onClick={() => canNavNext && handleNav(1)} 
                  disabled={!canNavNext}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${canNavNext ? 'bg-white/5 hover:bg-[#00f0ff] hover:text-black cursor-pointer' : 'bg-white/2 opacity-20 cursor-not-allowed'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-12 bg-white/5 p-10 rounded-[40px] border border-white/5">
              <div className="relative w-56 h-56 flex-shrink-0">
                {stats.total > 0 ? (
                  <svg className="w-full h-full rotate-[-90deg] overflow-visible" viewBox="-18 -18 36 36">
                    {stats.categories.map((c, i) => {
                      const percentage = (c.total / stats.total);
                      let startAngle = 0;
                      for(let j=0; j<i; j++) startAngle += (stats.categories[j].total / stats.total) * 2 * Math.PI;
                      const endAngle = startAngle + percentage * 2 * Math.PI;
                      const midAngle = startAngle + (percentage * Math.PI);
                      
                      const x1 = Math.cos(startAngle) * 16;
                      const y1 = Math.sin(startAngle) * 16;
                      const x2 = Math.cos(endAngle) * 16;
                      const y2 = Math.sin(endAngle) * 16;
                      
                      const largeArcFlag = percentage > 0.5 ? 1 : 0;
                      const d = `M 0 0 L ${x1} ${y1} A 16 16 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                      const explodeX = activeIndex === i ? Math.cos(midAngle) * 1.5 : 0;
                      const explodeY = activeIndex === i ? Math.sin(midAngle) * 1.5 : 0;

                      return (
                        <motion.path 
                          key={i} 
                          d={d}
                          fill={c.color}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ 
                            opacity: 1, 
                            scale: activeIndex === i ? 1.05 : 1,
                            x: explodeX,
                            y: explodeY,
                            filter: activeIndex === i ? 'brightness(1.2) drop-shadow(0 0 12px '+c.color+'66)' : 'brightness(1)'
                          }}
                          transition={{ 
                            duration: 0.2,
                            type: 'spring',
                            stiffness: 400,
                            damping: 25
                          }}
                          onMouseEnter={() => setActiveIndex(i)}
                          onMouseLeave={() => setActiveIndex(null)}
                          className="cursor-pointer transition-all duration-150"
                        />
                      );
                    })}
                  </svg>
                ) : (
                  <div className="w-full h-full rounded-full border-4 border-white/5 flex items-center justify-center text-[10px] text-slate-500 font-bold uppercase">Veri Yok</div>
                )}
                
                {activeIndex !== null && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-800/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-2xl z-50 pointer-events-none"
                   >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{stats.categories[activeIndex].icon}</span>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{stats.categories[activeIndex].label}</span>
                        <span className="text-[10px] font-black text-[#00f0ff]">%{( (stats.categories[activeIndex].total / stats.total) * 100).toFixed(1)}</span>
                      </div>
                   </motion.div>
                )}
              </div>

              <div className="flex-1 w-full">
                <div className="mb-6">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">TOPLAM HARCAMA</p>
                  <p className="text-3xl font-black text-white tracking-tighter">₺{stats.total.toLocaleString('tr-TR')}</p>
                </div>
                <div className="max-h-[180px] overflow-y-auto pr-4 custom-scrollbar space-y-2">
                  {stats.categories.map((c, i) => (
                    <motion.div 
                      key={i} 
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(null)}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${activeIndex === i ? 'bg-white/10 scale-[1.02]' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-xl flex-shrink-0">{c.icon}</span>
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider truncate max-w-[120px]">{c.label}</span>
                      </div>
                      <span className="text-xs font-black text-white flex-shrink-0">₺{c.total.toLocaleString('tr-TR')}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 bg-white/5 p-1 rounded-2xl w-fit">
              {(['Grup İçin', 'Benim İçin'] as ViewScope[]).map(v => (
                <button key={v} onClick={() => setViewScope(v)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewScope === v ? 'bg-[#00f0ff] text-black shadow-lg shadow-[#00f0ff]/20' : 'text-slate-500 hover:text-white'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:w-1/2 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Kategori Detayları</h4>
              <span className="text-[10px] font-black text-[#00f0ff] bg-[#00f0ff]/10 px-3 py-1 rounded-full uppercase">{stats.categories.length} Kategori</span>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {stats.categories.map((c, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  className="group bg-white/5 p-5 rounded-[24px] border border-transparent hover:border-[#00f0ff]/30 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-xl group-hover:scale-110 transition-transform relative">
                      <div className="absolute -top-1 -left-1 w-3 h-3 rounded-full border-2 border-slate-900" style={{ backgroundColor: c.color }} />
                      {c.icon}
                    </div>
                    <div>
                      <p className="text-white font-black tracking-tight">{c.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                         <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{((c.total / stats.total) * 100).toFixed(1)}%</p>
                         <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(c.total / stats.total) * 100}%` }}
                              transition={{ duration: 0.3, delay: i * 0.02 }}
                              className="h-full" 
                              style={{ backgroundColor: c.color }}
                            />
                         </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-lg font-black text-white tracking-tighter">₺{c.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                </motion.div>
              ))}
              {stats.categories.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-slate-600 font-black uppercase text-xs tracking-widest">Bu dönemde harcama bulunamadı.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
