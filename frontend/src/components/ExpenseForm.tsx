import React, { useState } from 'react';
import { apiFetch } from '../utils/api';

interface ExpenseFormProps {
  groupId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ groupId, onSuccess, onCancel }) => {
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState<string>('');
  const [billPhoto, setBillPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('date', date);
      
      if (content.trim() !== '') {
        formData.append('content', content);
      }
      
      if (billPhoto) {
        formData.append('bill_photo', billPhoto);
      }

      const response = await apiFetch(`/expenses/${groupId}`, {
        method: 'POST',
        body: formData,
      });

      // Eğer response başarılıysa form başarıyla gönderilmiştir.
      onSuccess();
    } catch (err: any) {
      console.error('Harcama ekleme hatası:', err);
      setError(err.message || 'Harcama eklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl">
      <h2 className="text-2xl font-bold mb-6 text-[#00f0ff] drop-shadow-glow-blue text-center">
        Harcama Ekle
      </h2>
      
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-200 text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Miktar *</label>
          <input
            type="number"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Tarih *</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Açıklama</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all resize-none"
            placeholder="Harcama detayı..."
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Fiş/Fatura Fotoğrafı</label>
          <input
            type="file"
            accept="image/jpeg, image/png, image/webp"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setBillPhoto(e.target.files[0]);
              } else {
                setBillPhoto(null);
              }
            }}
            className="w-full text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 transition-colors cursor-pointer"
          />
        </div>

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 p-3 rounded-lg font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 p-3 rounded-lg font-bold bg-[#00f0ff] text-slate-900 hover:bg-[#00c0cc] hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all disabled:opacity-50"
          >
            {loading ? 'Yükleniyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
};
