import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { ExpenseCard } from './ExpenseCard';
import { Pagination } from './common/Pagination';
import { motion, AnimatePresence } from 'framer-motion';

interface ExpenseListProps {
  groupId: number;
  refreshTrigger: number;
  currentUserId?: number;
}

interface Expense {
  id: number;
  amount: number;
  date: string;
  content?: string;
  bill_photo?: string;
  added_by?: number;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({ groupId, refreshTrigger, currentUserId }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const fetchExpenses = async (pageNum: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/expenses/${groupId}?page=${pageNum}&limit=${limit}`);
      const data = await response.json();
      setExpenses(data.expenses || []);
      setTotalCount(data.total_count || 0);
    } catch (err: any) {
      console.error('Harcamalar yüklenirken hata:', err);
      setError('Harcamalar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchExpenses(1);
  }, [groupId, refreshTrigger]);

  useEffect(() => {
    fetchExpenses(page);
  }, [page]);

  const handleDelete = async (expenseId: number) => {
    if (!window.confirm("Bu harcamayı silmek istediğinize emin misiniz?")) return;
    try {
      await apiFetch(`/expenses/${groupId}/${expenseId}`, { method: 'DELETE' });
      fetchExpenses(page);
    } catch (err: any) {
      alert(err.message || "Silme işlemi başarısız.");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    setEditLoading(true);
    try {
      await apiFetch(`/expenses/${groupId}/${editingExpense.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          amount: editingExpense.amount,
          content: editingExpense.content,
          date: editingExpense.date
        })
      });
      setEditingExpense(null);
      fetchExpenses(page);
    } catch (err: any) {
      alert(err.message || "Güncelleme başarısız.");
    } finally {
      setEditLoading(false);
    }
  };

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

      <div className="min-h-[500px] flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin"></div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest animate-pulse">Veri Akışı Sağlanıyor...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-red-900/20 border border-red-500/30 text-red-400 text-center font-bold">
            {error}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 h-fit">
                {expenses.map((expense) => (
                  <ExpenseCard 
                    key={expense.id} 
                    expense={expense} 
                    onDelete={() => handleDelete(expense.id)}
                    onEdit={() => setEditingExpense(expense)}
                    isOwner={currentUserId === expense.added_by}
                  />
                ))}
              </div>

              {expenses.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-600">
                  <p className="italic">Henüz harcama kaydı bulunmuyor.</p>
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

      {/* Düzenleme Modalı */}
      {editingExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#00f0ff]"></div>
            <h4 className="text-2xl font-black text-[#00f0ff] mb-6">Harcamayı Düzenle</h4>
            <form onSubmit={handleUpdate} className="space-y-5">
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
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setEditingExpense(null)}
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
    </div>
  );
};
