import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { ExpenseCard } from './ExpenseCard';
import { Pagination } from './common/Pagination';

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

  // Düzenleme state'leri
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
      fetchExpenses();
    } catch (err) {
      alert("Harcama silinemedi");
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
      fetchExpenses();
    } catch (err) {
      alert("Güncelleme başarısız");
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full py-12 flex justify-center">
        <div className="text-[#00f0ff] animate-pulse font-medium text-lg drop-shadow-glow-blue">Harcamalar yükleniyor...</div>
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

  if (expenses.length === 0) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center bg-slate-800/30 border border-slate-700 border-dashed rounded-xl shadow-inner">
        <svg className="w-16 h-16 text-slate-600 mb-4 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-slate-300 text-lg font-medium">Henüz harcama eklenmemiş</p>
        <p className="text-slate-500 text-sm mt-1">Bu gruba yapılan ilk harcamayı siz ekleyin.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 relative">
      {/* Borç Optimizasyonu Bilgi Kartı */}
      <div className="bg-slate-900/40 border border-slate-800/60 p-4 rounded-2xl flex items-center justify-between group hover:border-[#00f0ff]/30 transition-all">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#00f0ff]/10 rounded-lg text-[#00f0ff]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-200">Akıllı Borç Hesaplama Aktif</p>
            <p className="text-[10px] text-slate-500 font-medium italic">Kimin kime ne kadar ödeyeceğini "Borç Durumu" sekmesinden anlık olarak takip edebilirsiniz.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {expenses.map((expense) => (
          <ExpenseCard 
            key={expense.id} 
            expense={expense} 
            currentUserId={currentUserId}
            onDelete={handleDelete}
            onEdit={setEditingExpense}
          />
        ))}
      </div>

      <Pagination 
        currentPage={page}
        totalCount={totalCount}
        limit={limit}
        onPageChange={setPage}
      />

      {/* Düzenleme Modalı */}
      {editingExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Harcamayı Düzenle</h3>
              <button onClick={() => setEditingExpense(null)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tutar (₺)</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-[#00f0ff] font-bold focus:border-[#00f0ff] outline-none"
                  value={editingExpense.amount}
                  onChange={(e) => setEditingExpense({...editingExpense, amount: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Açıklama</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-[#00f0ff] outline-none"
                  value={editingExpense.content || ''}
                  onChange={(e) => setEditingExpense({...editingExpense, content: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tarih</label>
                <input 
                  type="date" 
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-[#00f0ff] outline-none"
                  value={editingExpense.date.split('T')[0]}
                  onChange={(e) => setEditingExpense({...editingExpense, date: e.target.value})}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="submit" 
                  disabled={editLoading}
                  className="flex-1 bg-[#00f0ff] text-slate-900 font-bold py-3 rounded-xl hover:bg-[#4dffff] transition-all disabled:opacity-50"
                >
                  {editLoading ? 'Güncelleniyor...' : 'Güncelle'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingExpense(null)}
                  className="flex-1 bg-slate-800 text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-700 transition-all"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
