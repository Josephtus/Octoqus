import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { Flag, AlertTriangle, Send, ShieldAlert, MessageSquare } from 'lucide-react';

export const ReportForm: React.FC = () => {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('GENEL');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      await apiFetch('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, category })
      });
      alert("Şikayetiniz/Geri bildiriminiz başarıyla iletildi. Teşekkürler!");
      setContent('');
    } catch (err: any) {
      alert(err.message || "Gönderim sırasında hata oluştu.");
    } finally {
      setSending(false);
    }
  };

  const categories = [
    { id: 'GENEL', label: 'Genel Geri Bildirim', icon: MessageSquare },
    { id: 'HATA', label: 'Hata Bildirimi', icon: AlertTriangle },
    { id: 'KOTU_KULLANIM', label: 'Kötüye Kullanım', icon: ShieldAlert },
    { id: 'DIGER', label: 'Diğer', icon: Flag }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-fade-in">
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/5 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none" />
        
        <div className="relative z-10 text-center md:text-left">
          <h2 className="text-4xl font-black text-white tracking-tighter mb-4">Destek & Geri Bildirim</h2>
          <p className="text-slate-400 max-w-lg text-lg leading-relaxed">
            Octoqus deneyimini iyileştirmemize yardımcı olun. Karşılaştığınız sorunları veya önerilerinizi buradan iletebilirsiniz.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="space-y-6">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Kategori Seçin</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-4 rounded-[24px] border transition-all flex flex-col items-center text-center gap-3 ${
                    category === cat.id 
                      ? 'bg-white text-black border-white shadow-xl scale-105' 
                      : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <cat.icon size={18} />
                  <span className="text-[9px] font-black uppercase tracking-widest leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Mesajınız</label>
            <textarea 
              className="w-full bg-slate-950/50 border border-white/5 rounded-[32px] p-8 text-white focus:outline-none focus:border-red-500/50 transition-all min-h-[250px] font-medium resize-none shadow-inner"
              placeholder="Sorunu veya önerinizi detaylıca açıklayın..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col md:flex-row gap-8 md:items-center justify-between pt-6 border-t border-white/5">
            <div className="flex items-center gap-4 text-slate-500">
              <ShieldAlert size={20} className="text-red-500/50" />
              <p className="text-xs font-medium max-w-xs">
                Bildiriminiz admin ekibimiz tarafından incelenecek ve en kısa sürede aksiyon alınacaktır.
              </p>
            </div>
            <button 
              type="submit"
              disabled={sending}
              className="px-12 py-5 bg-white text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-500 hover:text-white hover:shadow-[0_0_40px_rgba(239,68,68,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
            >
              {sending ? 'Gönderiliyor...' : <><Send size={20} /> Bildirimi Gönder</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
