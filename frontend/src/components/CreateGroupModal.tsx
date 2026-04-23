import React, { useState } from 'react';
import { apiFetch } from '../utils/api';

interface CreateGroupModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiFetch('/groups', {
        method: 'POST',
        body: JSON.stringify({ name, content })
      });
      onSuccess();
    } catch (err: any) {
      setError("Grup oluşturulurken bir hata meydana geldi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in-up">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#b026ff] to-[#00f0ff]"></div>
        
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-100">Yeni Grup Oluştur</h2>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-200 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Grup Adı</label>
              <input 
                type="text" 
                required
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Ev Arkadaşları"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Açıklama (Opsiyonel)</label>
              <textarea 
                rows={3}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all resize-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Grubun amacı..."
              />
            </div>
            
            <div className="flex gap-3 mt-4">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 py-3 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                İptal
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="flex-1 py-3 rounded-xl font-bold bg-[#b026ff] text-white hover:bg-[#c455ff] transition-all shadow-lg hover:shadow-[#b026ff]/50 disabled:opacity-50"
              >
                {loading ? "Oluşturuluyor..." : "Oluştur"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
