import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { ExpenseCard } from './ExpenseCard';
import { ExpenseDetailModal } from './ExpenseDetailModal';
import { UserProfileModal } from './UserProfileModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useGroupStore } from '../store/groupStore';

interface Category {
  name: string;
  icon: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Konaklama', icon: '🛌' },
  { name: 'Eğlence', icon: '🎤' },
  { name: 'Market Alışverişi', icon: '🛒' },
  { name: 'Sağlık', icon: '🦷' },
  { name: 'Sigorta', icon: '🧯' },
  { name: 'Kira ve Masraflar', icon: '🏠' },
  { name: 'Restoranlar ve Barlar', icon: '🍔' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Transport', icon: '🚕' },
  { name: 'Fatura', icon: '🧾' },
  { name: 'Balık', icon: '🐟' },
  { name: 'Yufkacı', icon: '🥟' },
  { name: 'Kasap', icon: '🥩' },
  { name: 'İçme suyu', icon: '💧' },
  { name: 'Halı Yıkama', icon: '🧼' },
  { name: 'Diğer', icon: '🖐️' },
];

interface Expense {
  id: number;
  amount: number;
  date: string;
  category?: string;
  content?: string;
  bill_photo?: string;
  added_by?: number;
  added_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

const ScrollTrigger: React.FC<{ onTrigger: () => void; enabled: boolean }> = ({ onTrigger, enabled }) => {
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const onTriggerRef = React.useRef(onTrigger);

  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    if (!enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onTriggerRef.current();
        }
      },
      { threshold: 0.1 }
    );

    const currentTrigger = triggerRef.current;
    if (currentTrigger) {
      observer.observe(currentTrigger);
    }

    return () => {
      if (currentTrigger) observer.unobserve(currentTrigger);
      observer.disconnect();
    };
  }, [enabled]);

  return <div ref={triggerRef} className="h-4 w-full" />;
};


export const ExpenseList: React.FC = () => {
  const { user } = useAuthStore();
  const { activeGroup, refreshTrigger } = useGroupStore();
  const groupId = activeGroup?.id;
  const currentUserId = user?.id;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [newBillPhoto, setNewBillPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [isCategoryListOpen, setIsCategoryListOpen] = useState(false);

  const isFetchingRef = React.useRef<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState<boolean>(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const fetchExpenses = React.useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (!groupId) return;
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    if (pageNum === 1) setLoading(true);
    setError(null);
    
    try {
      const url = `/expenses/${groupId}?page=${pageNum}&limit=${limit}`;
      const response = await apiFetch(url);
      const data = await response.json();
      const newExpenses = data.expenses || [];
      
      const reversed = [...newExpenses].reverse();
      const container = containerRef.current;
      const previousScrollHeight = container?.scrollHeight || 0;

      setExpenses(prev => {
        if (!append) return reversed;
        return [...reversed, ...prev];
      });

      setTotalCount(data.total_count || 0);
      setHasMore(newExpenses.length === limit);

      if (pageNum === 1) {
        setShouldScrollToBottom(true);
      } else if (container) {
        setTimeout(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - previousScrollHeight;
          }
        }, 0);
      }
    } catch (err: any) {
      console.error('[ExpenseList] Error:', err);
      setError(err.message || 'Harcamalar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [groupId, limit]);

  useEffect(() => {
    if (!groupId) return;
    const fetchGroupData = async () => {
      try {
        const res = await apiFetch(`/groups/${groupId}`);
        const data = await res.json();
        if (data.group.custom_categories) {
          setCustomCategories(JSON.parse(data.group.custom_categories));
        }
      } catch (err) {
        console.error("Grup verisi çekilemedi:", err);
      }
    };
    fetchGroupData();
    setPage(1);
    fetchExpenses(1, false);
  }, [groupId, refreshTrigger, fetchExpenses]);

  useEffect(() => {
    if (shouldScrollToBottom && containerRef.current && !loading) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setShouldScrollToBottom(false);
    }
  }, [shouldScrollToBottom, loading]);

  const loadMore = React.useCallback(() => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchExpenses(nextPage, true);
    }
  }, [hasMore, page, fetchExpenses, loading]);

  const handleDelete = async (expenseId: number) => {
    if (!groupId) return;
    if (!window.confirm("Bu harcamayı silmek istediğinize emin misiniz?")) return;
    try {
      await apiFetch(`/expenses/${groupId}/${expenseId}`, { method: 'DELETE' });
      setPage(1);
      fetchExpenses(1, false);
    } catch (err: any) {
      alert(err.message || "Silme işlemi başarısız.");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !groupId) return;
    setEditLoading(true);
    try {
      const formData = new FormData();
      formData.append('amount', editingExpense.amount.toString());
      formData.append('content', editingExpense.content || '');
      formData.append('date', editingExpense.date);
      formData.append('category', editingExpense.category || 'Diğer');
      
      if (removePhoto) {
        formData.append('remove_bill_photo', 'true');
      }
      if (newBillPhoto) {
        formData.append('bill_photo', newBillPhoto);
      }

      await apiFetch(`/expenses/${groupId}/${editingExpense.id}`, {
        method: 'PUT',
        body: formData
      });
      setEditingExpense(null);
      setNewBillPhoto(null);
      setRemovePhoto(false);
      setPage(1);
      fetchExpenses(1, false);
    } catch (err: any) {
      alert(err.message || "Güncelleme başarısız.");
    } finally {
      setEditLoading(false);
    }
  };

  if (!groupId) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-100 flex items-center gap-3">
          <span className="w-2 h-6 bg-[#00f0ff] rounded-full"></span>
          Harcama Dökümü
          <span className="text-xs bg-slate-800 text-slate-500 px-2 py-1 rounded-lg font-mono">
            {totalCount} Kayıt
          </span>
        </h3>
      </div>

      <div className="bg-slate-900/50 border border-slate-800/60 rounded-[2rem] p-4 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#00f0ff]/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-[#00f0ff]/10 transition-all duration-1000"></div>
        
        <div 
          ref={containerRef}
          id="expense-scroll-container"
          className="h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent custom-scroll"
        >

          {loading && page === 1 ? (
            <div className="h-full flex flex-col justify-center items-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-[#00f0ff]/10 border-t-[#00f0ff] rounded-full animate-spin"></div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Sistem Verileri Alınıyor</p>
            </div>
          ) : error ? (
            <div className="p-10 rounded-3xl bg-red-500/5 border border-red-500/20 text-red-400 text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {hasMore && (
                <div className="py-6 flex justify-center">
                  <ScrollTrigger onTrigger={loadMore} enabled={hasMore && !loading} />
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-[#00f0ff]/10 border-t-[#00f0ff] rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-slate-600 text-[9px] font-black uppercase tracking-widest opacity-50">Geçmişi görmek için yukarı kaydırın</span>
                  )}
                </div>
              )}

              <AnimatePresence initial={false}>
                {expenses.map((expense) => (
                  <ExpenseCard 
                    key={expense.id} 
                    expense={expense} 
                    onDelete={() => handleDelete(expense.id)}
                    onEdit={() => setEditingExpense(expense)}
                    onClick={(exp) => setSelectedExpense(exp)}
                    isOwner={currentUserId === expense.added_by}
                  />
                ))}
              </AnimatePresence>

              {expenses.length === 0 && !loading && (
                <div className="h-full flex flex-col items-center justify-center py-40 text-slate-600 gap-4">
                  <div className="w-16 h-16 bg-slate-800/30 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <p className="text-sm font-bold italic opacity-40">Henüz harcama kaydı bulunmuyor.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editingExpense && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#00f0ff]"></div>
              <h4 className="text-2xl font-black text-[#00f0ff] mb-6">Harcamayı Düzenle</h4>
              <form onSubmit={handleUpdate} className="space-y-5">
                <div className="relative">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Kategori</label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryListOpen(!isCategoryListOpen)}
                    className="w-full flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-[#00f0ff]/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {[...DEFAULT_CATEGORIES, ...customCategories].find(c => c.name === editingExpense.category)?.icon || '📦'}
                      </span>
                      <span className="text-white font-bold">{editingExpense.category || 'Kategori Seç'}</span>
                    </div>
                    <svg className={`w-5 h-5 text-slate-500 transition-transform ${isCategoryListOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  <AnimatePresence>
                    {isCategoryListOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute z-50 top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                      >
                        <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-2">
                          {[...DEFAULT_CATEGORIES, ...customCategories].map((cat, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => { 
                                setEditingExpense({...editingExpense, category: cat.name});
                                setIsCategoryListOpen(false); 
                              }}
                              className="w-full flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-all"
                            >
                              <span className="text-xl">{cat.icon}</span>
                              <span className="text-slate-300 font-bold text-sm">{cat.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Miktar</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:border-[#00f0ff] outline-none transition-all"
                    value={editingExpense.amount}
                    onChange={(e) => setEditingExpense({...editingExpense, amount: parseFloat(e.target.value)})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Tarih</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:border-[#00f0ff] outline-none transition-all"
                    value={editingExpense.date}
                    onChange={(e) => setEditingExpense({...editingExpense, date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Açıklama</label>
                  <textarea 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 focus:border-[#00f0ff] outline-none transition-all"
                    value={editingExpense.content}
                    onChange={(e) => setEditingExpense({...editingExpense, content: e.target.value})}
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Fatura / Makbuz</label>
                  
                  {editingExpense.bill_photo && !removePhoto ? (
                    <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                          <img src={editingExpense.bill_photo.startsWith('http') ? editingExpense.bill_photo : `http://localhost:8000${editingExpense.bill_photo}`} alt="Mevcut Fatura" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Kayıtlı Fatura</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setRemovePhoto(true)}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Faturayı Kaldır"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative group">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setNewBillPhoto(e.target.files[0]);
                              setRemovePhoto(false);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="bg-slate-950 border-2 border-dashed border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 group-hover:border-[#00f0ff]/30 transition-all">
                          {newBillPhoto ? (
                            <div className="flex items-center gap-2 text-[#00f0ff]">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                              <span className="text-[10px] font-black uppercase truncate max-w-[200px]">{newBillPhoto.name}</span>
                            </div>
                          ) : (
                            <>
                              <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              <span className="text-[10px] font-black text-slate-600 uppercase">Yeni Fatura Yükle</span>
                            </>
                          )}
                        </div>
                      </div>
                      {removePhoto && (
                         <div className="flex items-center justify-between bg-red-500/5 border border-red-500/20 p-2 rounded-xl">
                           <span className="text-[9px] font-black text-red-400 uppercase ml-2">Fatura Silinecek</span>
                           <button type="button" onClick={() => setRemovePhoto(false)} className="text-[9px] font-black text-slate-500 hover:text-white px-2">VAZGEÇ</button>
                         </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => {
                      setEditingExpense(null);
                      setNewBillPhoto(null);
                      setRemovePhoto(false);
                    }}
                    className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-2xl font-bold hover:bg-slate-700 transition-all"
                  >
                    İptal
                  </button>
                  <button 
                    type="submit" 
                    disabled={editLoading}
                    className="flex-1 py-3 bg-[#00f0ff] text-slate-950 rounded-2xl font-black shadow-[0_0_20px_#00f0ff44] hover:bg-[#00c0cc] transition-all disabled:opacity-50"
                  >
                    {editLoading ? 'Güncelleniyor...' : 'KAYDET'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedExpense && (
          <ExpenseDetailModal 
            expense={selectedExpense} 
            onClose={() => setSelectedExpense(null)} 
            onViewUserProfile={(uid) => {
              setViewingUserId(uid);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingUserId && (
          <UserProfileModal 
            userId={viewingUserId} 
            onClose={() => setViewingUserId(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};
