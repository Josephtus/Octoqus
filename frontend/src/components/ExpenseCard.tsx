import React from 'react';
import { motion } from 'framer-motion';
import { getCategoryIcon, type Category } from '../utils/categories';

interface Expense {
  id: number;
  amount: number;
  date: string;
  content?: string;
  category?: string;
  bill_photo?: string;
  added_by?: number;
  added_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface ExpenseCardProps {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (expenseId: number) => void;
  onClick: (expense: Expense) => void;
  isOwner: boolean;
  customCategories?: Category[];
}

export const ExpenseCard: React.FC<ExpenseCardProps> = ({ 
  expense, 
  onEdit, 
  onDelete, 
  onClick, 
  isOwner, 
  customCategories = [] 
}) => {
  // Tarih ve saat formatlama yardımcıları
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    // YYYY-MM-DD formatını korumak için manuel parçalama (Timezone sapmalarını önler)
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  };

  const formatTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return '';
    // Backend'den gelen ISO string'i (UTC varsayarak) yerel saate çevir
    const date = new Date(dateTimeStr + (dateTimeStr.includes('Z') || dateTimeStr.includes('+') ? '' : 'Z'));
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const formattedTime = formatTime(expense.created_at || '');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onClick(expense)}
      className="group relative flex items-center gap-4 p-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl hover:bg-slate-800/60 hover:border-[#00f0ff]/30 transition-all cursor-pointer"
    >
      {/* Sol Kısım: İkon ve Miktar */}
      <div className="flex-shrink-0 w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800 group-hover:border-[#00f0ff]/20 transition-colors text-xl">
        <span>{getCategoryIcon(expense.category, customCategories)}</span>
      </div>

      {/* Orta Kısım: Detaylar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-black text-slate-100 truncate">
            ₺{Number(expense.amount).toFixed(2)}
          </span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
            • {expense.added_by_name || 'Bilinmiyor'}
          </span>
          {isOwner && (
            <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-black uppercase border border-emerald-500/20">
              SİZİN
            </span>
          )}
          {expense.updated_at && (
            <span className="text-[9px] bg-[#00f0ff]/10 text-[#00f0ff] px-1.5 py-0.5 rounded font-black uppercase border border-[#00f0ff]/20">
              DÜZENLENDİ
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
          <span>{formatDate(expense.date)}</span>
          <span>{formattedTime}</span>
          {expense.content && (
            <span className="truncate text-slate-400 font-medium">— {expense.content}</span>
          )}
        </div>
      </div>
      
      {/* Sağ Kısım: Aksiyonlar */}
      <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity pr-1">
        {isOwner && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(expense); }}
              className="p-1.5 text-slate-500 hover:text-[#00f0ff] hover:bg-slate-800 rounded-lg transition-all"
              title="Düzenle"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(expense.id); }}
              className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-slate-800 rounded-lg transition-all"
              title="Sil"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
};
