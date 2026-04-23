import React from 'react';

interface Expense {
  id: number;
  amount: number;
  date: string;
  content?: string;
  bill_photo?: string;
  added_by?: number;
}

interface ExpenseCardProps {
  expense: Expense;
  currentUserId?: number;
  onEdit: (expense: Expense) => void;
  onDelete: (expenseId: number) => void;
}

export const ExpenseCard: React.FC<ExpenseCardProps> = ({ expense, currentUserId, onEdit, onDelete }) => {
  const isOwner = expense.added_by === currentUserId;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-800 border border-slate-700 rounded-xl hover:border-slate-600 hover:shadow-lg transition-all group">
      <div className="flex-1 mb-3 sm:mb-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl font-bold text-[#00f0ff] tracking-tight">
            ₺{Number(expense.amount).toFixed(2)}
          </span>
          <span className="text-xs font-medium text-slate-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-700 shadow-sm">
            {new Date(expense.date).toLocaleDateString('tr-TR')}
          </span>
          {isOwner && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-black uppercase border border-emerald-500/20">Sizin</span>
          )}
        </div>
        
        {expense.content && (
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">{expense.content}</p>
        )}
      </div>
      
      <div className="flex items-center gap-4 sm:ml-4 border-t border-slate-700 sm:border-t-0 sm:border-l sm:pl-5 pt-3 sm:pt-0 mt-2 sm:mt-0">
        {expense.bill_photo && (
          <a 
            href={expense.bill_photo} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-bold text-[#b026ff] hover:text-[#d382ff] transition-colors drop-shadow-glow-purple"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="hidden lg:inline">Fatura</span>
          </a>
        )}

        {isOwner && (
          <div className="flex items-center gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => onEdit(expense)}
              className="p-2 text-slate-400 hover:text-[#00f0ff] hover:bg-slate-700 rounded-lg transition-all"
              title="Düzenle"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button 
              onClick={() => onDelete(expense.id)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-700 rounded-lg transition-all"
              title="Sil"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
