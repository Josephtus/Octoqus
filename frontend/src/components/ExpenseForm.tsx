import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useGroupStore } from '../store/groupStore';
import { expenseSchema, type ExpenseFormData } from '../utils/validations';

interface ExpenseFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

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

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSuccess, onCancel }) => {
  const { activeGroup } = useGroupStore();
  const groupId = activeGroup?.id;

  const [billPhoto, setBillPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<Category>(DEFAULT_CATEGORIES[2]);
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [isCategoryListOpen, setIsCategoryListOpen] = useState(false);
  
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      category: DEFAULT_CATEGORIES[2].name,
    }
  });

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
  }, [groupId]);

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  const handleAddCustomCategory = async () => {
    if (!groupId || !newCatName.trim()) return;
    const updated = [...customCategories, { name: newCatName.trim(), icon: newCatIcon }];
    
    try {
      setLoading(true);
      await apiFetch(`/groups/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify({ custom_categories: JSON.stringify(updated) })
      });
      setCustomCategories(updated);
      setSelectedCategory({ name: newCatName.trim(), icon: newCatIcon });
      setValue('category', newCatName.trim());
      setIsAddingCustom(false);
      setNewCatName('');
    } catch (err) {
      alert("Kategori eklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ExpenseFormData) => {
    if (!groupId) return;
    setServerError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('amount', data.amount.toString());
      formData.append('date', data.date);
      formData.append('category', data.category || 'Diğer');
      
      if (data.content && data.content.trim() !== '') {
        formData.append('content', data.content);
      }
      
      if (billPhoto) {
        formData.append('bill_photo', billPhoto);
      }

      const response = await apiFetch(`/expenses/${groupId}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Harcama eklenirken bir hata oluştu.');
      }

      onSuccess();
    } catch (err: any) {
      console.error('Harcama ekleme hatası:', err);
      setServerError(err.message || 'Harcama eklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (!groupId) return null;

  if (isAddingCustom) {
    return (
      <div className="space-y-8 p-2">
        <div className="flex items-center justify-between">
           <button onClick={() => setIsAddingCustom(false)} className="text-slate-500 hover:text-white transition-colors text-sm font-bold">Vazgeç</button>
           <h3 className="text-white font-black text-lg">Özel Kategori Ekle</h3>
           <div className="w-10" />
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Kategori adı</label>
            <input 
              type="text" 
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Örn: Halı Yıkama"
              className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white font-bold focus:border-[#00f0ff] outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Simge (Emoji)</label>
            <input 
              type="text" 
              value={newCatIcon}
              onChange={(e) => setNewCatIcon(e.target.value)}
              placeholder="📦"
              className="w-full bg-slate-950 border border-white/5 rounded-2xl p-4 text-white text-2xl text-center focus:border-[#00f0ff] outline-none transition-all"
            />
          </div>

          <button 
            onClick={handleAddCustomCategory}
            disabled={loading || !newCatName.trim()}
            className="w-full bg-[#00f0ff] text-slate-950 font-black py-4 rounded-2xl uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            Özel Kategori Ekle
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-1">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white tracking-tighter uppercase mb-1">Harcama Ekle</h2>
        <div className="h-1 w-12 bg-[#00f0ff] mx-auto rounded-full" />
      </div>
      
      {serverError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold text-center animate-shake">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="relative">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Kategori</label>
          <button
            type="button"
            onClick={() => setIsCategoryListOpen(!isCategoryListOpen)}
            className="w-full flex items-center justify-between bg-slate-950 border border-white/5 rounded-2xl p-4 hover:border-white/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedCategory.icon}</span>
              <span className="text-white font-bold">{selectedCategory.name}</span>
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
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
                  {allCategories.map((cat, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => { 
                        setSelectedCategory(cat); 
                        setValue('category', cat.name);
                        setIsCategoryListOpen(false); 
                      }}
                      className="w-full flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-all"
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span className="text-slate-300 font-bold text-sm">{cat.name}</span>
                    </button>
                  ))}
                  <div className="h-px bg-white/5 my-2" />
                  <button
                    type="button"
                    onClick={() => setIsAddingCustom(true)}
                    className="w-full flex items-center gap-4 p-3 hover:bg-[#00f0ff]/10 text-[#00f0ff] rounded-xl transition-all font-black text-xs uppercase"
                  >
                    <span>➕</span> Özel Kategori Ekle
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Miktar (₺)</label>
            <input
              type="number"
              step="0.01"
              {...register('amount', { valueAsNumber: true })}
              className={`w-full bg-slate-950 border transition-all rounded-2xl p-4 text-white font-black text-lg focus:outline-none ${
                errors.amount ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#00f0ff]'
              }`}
              placeholder="0.00"
            />
            {errors.amount && <p className="text-[10px] text-red-400 ml-1 font-bold">{errors.amount.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Tarih</label>
            <input
              type="date"
              {...register('date')}
              className={`w-full bg-slate-950 border transition-all rounded-2xl p-4 text-white font-bold focus:outline-none ${
                errors.date ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#00f0ff]'
              }`}
            />
            {errors.date && <p className="text-[10px] text-red-400 ml-1 font-bold">{errors.date.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Açıklama</label>
          <textarea
            {...register('content')}
            className={`w-full bg-slate-950 border transition-all rounded-2xl p-4 text-white font-bold focus:outline-none resize-none ${
              errors.content ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#00f0ff]'
            }`}
            placeholder="Neye harcandı?"
            rows={2}
          />
          {errors.content && <p className="text-[10px] text-red-400 ml-1 font-bold">{errors.content.message}</p>}
        </div>

        <div className="relative">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Fatura / Makbuz</label>
          <div className="flex items-center gap-4">
             <label className="flex-1 flex items-center justify-center gap-3 bg-slate-950/50 border-2 border-dashed border-white/10 rounded-2xl p-4 hover:border-[#00f0ff]/40 hover:bg-slate-900 transition-all cursor-pointer group">
               <input 
                 type="file" 
                 accept="image/*" 
                 onChange={(e) => setBillPhoto(e.target.files?.[0] || null)}
                 className="hidden" 
               />
               <svg className="w-5 h-5 text-slate-500 group-hover:text-[#00f0ff] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
               <span className="text-xs font-black text-slate-500 group-hover:text-white transition-colors uppercase tracking-widest text-center">
                 {billPhoto ? billPhoto.name : 'Dosya Seç'}
               </span>
             </label>
             {billPhoto && (
               <button 
                 type="button" 
                 onClick={() => setBillPhoto(null)}
                 className="w-12 h-12 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
             )}
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 bg-white/5 text-slate-500 font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-2 bg-[#00f0ff] text-slate-950 font-black py-4 px-8 rounded-2xl uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(0,240,255,0.2)] disabled:opacity-50"
          >
            {loading ? '...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
};

