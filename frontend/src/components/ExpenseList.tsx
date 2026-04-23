import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

interface ExpenseListProps {
  groupId: number;
  refreshTrigger: number;
}

interface Expense {
  id: number;
  amount: number;
  date: string;
  content?: string;
  bill_photo?: string;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({ groupId, refreshTrigger }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(`/expenses/${groupId}`);
        const data = await response.json();
        
        // Backend'in dönüş formatına göre esnek yapı (dizi ya da obje içinde expenses dizisi)
        const expenseData = Array.isArray(data) ? data : data.expenses || [];
        setExpenses(expenseData);
      } catch (err: any) {
        console.error('Harcamalar yüklenirken hata:', err);
        setError('Harcamalar yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [groupId, refreshTrigger]);

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
    <div className="w-full space-y-4">
      {expenses.map((expense) => (
        <div 
          key={expense.id} 
          className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-800 border border-slate-700 rounded-xl hover:border-slate-600 hover:shadow-lg transition-all"
        >
          <div className="flex-1 mb-3 sm:mb-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl font-bold text-[#00f0ff] tracking-tight">
                ₺{Number(expense.amount).toFixed(2)}
              </span>
              <span className="text-xs font-medium text-slate-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-700 shadow-sm">
                {new Date(expense.date).toLocaleDateString('tr-TR')}
              </span>
            </div>
            
            {expense.content && (
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">{expense.content}</p>
            )}
          </div>
          
          {expense.bill_photo && (
            <div className="flex items-center sm:ml-4 border-t border-slate-700 sm:border-t-0 sm:border-l sm:pl-5 pt-3 sm:pt-0 mt-2 sm:mt-0">
              <a 
                href={expense.bill_photo} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-bold text-[#b026ff] hover:text-[#d382ff] transition-colors group drop-shadow-glow-purple"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Fatura Gör
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
