import React from 'react';
import { getImageUrl } from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';

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

interface ExpenseDetailModalProps {
  expense: Expense;
  onClose: () => void;
  onViewUserProfile?: (userId: number) => void;
}

export const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({ expense, onClose, onViewUserProfile }) => {
  const formattedDate = new Date(expense.date).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const formattedTime = expense.created_at
    ? new Date(expense.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="relative h-32 bg-gradient-to-br from-[#00f0ff]/10 via-slate-900 to-[#b026ff]/10 flex items-center px-8 border-b border-slate-800/50">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-[#00f0ff] uppercase tracking-[0.4em] mb-2">Harcama Detayı</span>
            <h2 className="text-4xl font-black text-white">₺{Number(expense.amount).toFixed(2)}</h2>
          </div>
          
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 w-10 h-10 rounded-2xl bg-slate-950/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-slate-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Info Side */}
          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Açıklama</label>
              <p className="text-slate-200 font-medium leading-relaxed">
                {expense.content || 'Açıklama girilmemiş.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/50 border border-slate-800/50 p-4 rounded-2xl">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Tarih</label>
                <div className="text-sm text-slate-200 font-bold">{formattedDate}</div>
              </div>
              <div className="bg-slate-950/50 border border-slate-800/50 p-4 rounded-2xl">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Saat</label>
                <div className="text-sm text-slate-200 font-bold">{formattedTime || '--:--'}</div>
              </div>
              <div className="bg-slate-950/50 border border-slate-800/50 p-4 rounded-2xl col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Kategori</label>
                <div className="text-sm text-white font-bold flex items-center gap-2">
                   {expense.category || 'Belirtilmemiş'}
                </div>
              </div>
            </div>

            <div 
              className="group bg-slate-950/50 border border-slate-800/50 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-[#00f0ff]/30 transition-all"
              onClick={() => expense.added_by && onViewUserProfile?.(expense.added_by)}
            >
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Ekleyen</label>
                <div className="text-sm text-white font-bold group-hover:text-[#00f0ff] transition-colors">{expense.added_by_name}</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-[#00f0ff]/10 group-hover:text-[#00f0ff] transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/50">
              <div className="flex items-center gap-2 text-[9px] font-bold text-slate-600 uppercase tracking-tighter">
                <span>ID: #{expense.id}</span>
                <span>•</span>
                <span>KAYIT: {new Date(expense.created_at || '').toLocaleString('tr-TR')}</span>
              </div>
            </div>
          </div>

          {/* Receipt Side */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fatura / Makbuz</label>
            {expense.bill_photo ? (
              <div className="relative group aspect-[3/4] rounded-3xl overflow-hidden bg-slate-950 border border-slate-800">
                <img 
                  src={getImageUrl(expense.bill_photo)} 
                  alt="Fatura" 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <a 
                    href={getImageUrl(expense.bill_photo)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-white text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#00f0ff] transition-all transform translate-y-4 group-hover:translate-y-0 duration-500"
                  >
                    Tam Boyut Gör
                  </a>
                </div>
              </div>
            ) : (
              <div className="aspect-[3/4] rounded-3xl bg-slate-950/50 border-2 border-dashed border-slate-800 flex flex-col items-center justify-center gap-4 text-slate-600">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Fatura Yüklenmemiş</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-950/30 border-t border-slate-800/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-slate-800 text-slate-200 rounded-2xl font-bold hover:bg-slate-700 transition-all border border-slate-700"
          >
            Kapat
          </button>
        </div>
      </motion.div>
    </div>
  );
};
