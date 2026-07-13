import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { Flag, AlertTriangle, Send, ShieldAlert, MessageSquare, Check, HelpCircle } from 'lucide-react';

export const ReportForm: React.FC = () => {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('GENEL');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      setSubmitted(true);
      setContent('');
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err: any) {
      alert(err.message || "Gönderim sırasında hata oluştu.");
    } finally {
      setSending(false);
    }
  };

  const categories = [
    { id: 'GENEL', label: 'Genel Geri Bildirim', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: 'HATA', label: 'Hata Bildirimi', icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { id: 'KOTU_KULLANIM', label: 'Kötüye Kullanım', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10' },
    { id: 'DIGER', label: 'Diğer', icon: Flag, color: 'text-[#00f0ff]', bg: 'bg-[#00f0ff]/10' }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-12"
      >
        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden overflow-hidden">
          {/* Animated Background Element */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#00f0ff]/10 to-[#b026ff]/10 blur-[100px] -mr-32 -mt-32 animate-pulse" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <HelpCircle className="text-[#00f0ff]" size={24} />
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            </div>
            
            <h2 className="text-5xl font-black text-white tracking-tighter mb-4">
              Destek & <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#b026ff]">Geri Bildirim</span>
            </h2>
            <p className="text-slate-400 max-w-2xl text-lg font-medium leading-relaxed">
              Octoqus deneyimini iyileştirmemize yardımcı olun. Karşılaştığınız sorunları veya önerilerinizi buradan iletebilirsiniz.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Category Selection */}
          <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-[10px] font-black text-[#00f0ff] uppercase tracking-[0.3em] bg-[#00f0ff]/10 px-3 py-1 rounded-md border border-[#00f0ff]/20">
                Kategori Seçin
              </span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`relative p-6 rounded-[32px] border transition-all duration-300 group flex flex-col items-center text-center gap-4 ${
                    category === cat.id 
                      ? 'bg-white text-slate-950 border-white shadow-[0_0_40px_rgba(255,255,255,0.1)] scale-[1.02]' 
                      : 'bg-slate-950/50 text-slate-400 border-white/5 hover:border-white/10 hover:bg-slate-900/80 hover:text-white'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                    category === cat.id ? 'bg-slate-950/10' : cat.bg
                  }`}>
                    <cat.icon size={22} className={category === cat.id ? 'text-slate-950' : cat.color} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-black uppercase tracking-widest block leading-tight">
                      {cat.label}
                    </span>
                  </div>
                  
                  {category === cat.id && (
                    <motion.div 
                      layoutId="activeCategory"
                      className="absolute top-4 right-4"
                    >
                      <Check size={16} className="text-slate-950" />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Message Area */}
          <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] bg-white/5 px-3 py-1 rounded-md border border-white/10">
                Mesajınız
              </span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            <textarea 
              className="w-full bg-slate-950/50 border border-white/5 rounded-[32px] p-8 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f0ff]/30 focus:bg-slate-950 transition-all min-h-[300px] font-medium resize-none shadow-inner text-lg leading-relaxed"
              placeholder="Sorunu veya önerinizi detaylıca açıklayın..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          {/* Footer / Submit */}
          <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-10 shadow-2xl flex flex-col md:flex-row gap-8 md:items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center justify-center shrink-0">
                <ShieldAlert size={28} className="text-red-500/40" />
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-1">Moderasyon Süreci</p>
                <p className="text-xs text-slate-500 font-medium max-w-sm">
                  Bildiriminiz admin ekibimiz tarafından incelenecek ve en kısa sürede aksiyon alınacaktır.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <AnimatePresence>
                {submitted && (
                  <motion.span 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs font-black text-[#00f0ff] uppercase tracking-widest"
                  >
                    Bildirildi! ✓
                  </motion.span>
                )}
              </AnimatePresence>
              
              <button 
                type="submit"
                disabled={sending}
                className="group px-12 py-5 bg-white text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 hover:shadow-[0_0_50px_rgba(255,255,255,0.2)] transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
              >
                {sending ? (
                  <span className="animate-pulse">GÖNDERİLİYOR...</span>
                ) : (
                  <>
                    BİLDİRİMİ GÖNDER
                    <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
