import React, { useState } from 'react';
import { apiFetch } from '../utils/api';

export const ReportForm: React.FC = () => {
  const [targetUserId, setTargetUserId] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{text: string, type: 'success'|'error'} | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const response = await apiFetch(`/reports/user/${targetUserId}`, {
        method: 'POST',
        body: JSON.stringify({ aciklama })
      });
      const data = await response.json();
      setMessage({ text: data.message, type: 'success' });
      setTargetUserId('');
      setAciklama('');
    } catch (err: any) {
      setMessage({ text: "Şikayet gönderilemedi. Lütfen bilgileri kontrol edin.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl max-w-lg mx-auto animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
        <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/30 text-red-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h3 className="text-xl font-bold text-slate-100">Kullanıcı Şikayet Et</h3>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Şikayet Edilecek Kullanıcı ID</label>
          <input 
            type="number" 
            required
            className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            placeholder="Örn: 42"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Açıklama</label>
          <textarea 
            required
            rows={4}
            minLength={10}
            className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all resize-none"
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder="Lütfen şikayet nedeninizi detaylıca açıklayın (En az 10 karakter)..."
          />
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm border ${message.type === 'error' ? 'bg-red-900/30 text-red-400 border-red-500/30' : 'bg-green-900/30 text-green-400 border-green-500/30'}`}>
            {message.text}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading || !targetUserId || aciklama.length < 10}
          className="mt-2 w-full py-3 rounded-xl font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Gönderiliyor..." : "Şikayeti İlet"}
        </button>
      </form>
    </div>
  );
};
