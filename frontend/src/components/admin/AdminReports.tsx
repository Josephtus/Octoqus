import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../utils/api';
import { Pagination } from '../common/Pagination';
import { Flag, MessageSquare, AlertTriangle, ShieldAlert, Filter } from 'lucide-react';

interface Report {
  id: number;
  reporter_id: number;
  reporter_name?: string;
  reported_user_id?: number;
  reported_name?: string;
  reported_message_id?: number;
  message_content?: string;
  aciklama: string;
  category: string;
  status: string;
  created_at: string;
}

export const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const limit = 10;

  const categories = [
    { id: '', label: 'Tüm Kategoriler', icon: Filter },
    { id: 'GENEL', label: 'Genel', icon: MessageSquare },
    { id: 'HATA', label: 'Hata', icon: AlertTriangle },
    { id: 'KOTU_KULLANIM', label: 'Abuse', icon: ShieldAlert },
    { id: 'MESAJ', label: 'Mesaj', icon: MessageSquare },
    { id: 'KULLANICI', label: 'Kullanıcı', icon: Flag }
  ];

  const fetchReports = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      const categoryParam = selectedCategory ? `&category=${selectedCategory}` : '';
      const res = await apiFetch(`/admin/reports?page=${pageNum}&limit=${limit}${categoryParam}`);
      const data = await res.json();
      setReports(data.reports || []);
      setTotalCount(data.total_count || 0);
    } catch (err) {
      console.error("Şikayetler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(page);
  }, [page, selectedCategory]);

  const handleAction = async (reportId: number, status: 'resolved' | 'dismissed') => {
    try {
      await apiFetch(`/admin/reports/${reportId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      fetchReports(page);
    } catch (err) {
      alert("İşlem başarısız");
    }
  };

  const getCategoryBadge = (category: string) => {
    const cat = categories.find(c => c.id === category);
    const Icon = cat?.icon || Flag;
    
    return (
      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded-md">
        <Icon size={10} className="text-[#00f0ff]" />
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{cat?.label || category}</span>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
            Şikayet Yönetimi
            <span className="bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] px-3 py-1 rounded-full uppercase tracking-widest">
              {totalCount} Kayıt
            </span>
          </h3>
          <p className="text-slate-500 text-xs font-medium mt-1">Sistem genelindeki geri bildirimler ve şikayetler</p>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-2xl border border-white/5">
          {categories.slice(0, 4).map(cat => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedCategory === cat.id 
                  ? 'bg-[#00f0ff] text-slate-950 shadow-lg' 
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {cat.label}
            </button>
          ))}
          {selectedCategory && !categories.slice(0, 4).some(c => c.id === selectedCategory) && (
            <button className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#00f0ff] text-slate-950">
              {selectedCategory}
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[32px] overflow-hidden min-h-[600px] flex flex-col shadow-2xl">
        {loading ? (
          <div className="flex-1 flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin"></div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={page + selectedCategory}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col p-6 md:p-8"
            >
              <div className="space-y-4 flex-1">
                {reports.map(report => (
                  <div key={report.id} className="bg-slate-950/40 border border-white/5 rounded-3xl p-6 hover:border-white/10 transition-all group">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                      <div className="flex flex-wrap items-center gap-3">
                        {getCategoryBadge(report.category)}
                        <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest ${
                          report.status?.toLowerCase() === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                          report.status?.toLowerCase() === 'resolved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-white/5 text-slate-500'
                        }`}>
                          {report.status}
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                          {new Date(report.created_at).toLocaleDateString('tr-TR')} {new Date(report.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      {report.status?.toLowerCase() === 'pending' && (
                        <div className="flex gap-2 w-full md:w-auto">
                          <button 
                            onClick={() => handleAction(report.id, 'resolved')} 
                            className="flex-1 md:flex-none text-[10px] bg-emerald-500 text-white px-4 py-2 rounded-xl hover:bg-emerald-600 transition-all font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                          >
                            Çözüldü
                          </button>
                          <button 
                            onClick={() => handleAction(report.id, 'dismissed')} 
                            className="flex-1 md:flex-none text-[10px] bg-white/5 text-slate-400 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-all font-black uppercase tracking-widest border border-white/5"
                          >
                            Reddet
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm">👤</div>
                          <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Şikayet Eden</p>
                            <p className="text-sm font-black text-white">{report.reporter_name || 'Bilinmeyen'}</p>
                          </div>
                        </div>
                        <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/5 relative">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Mesaj Detayı</p>
                          <p className="text-sm text-slate-300 leading-relaxed font-medium">
                            {report.aciklama}
                          </p>
                        </div>
                      </div>

                      <div className="lg:border-l border-white/5 lg:pl-8 space-y-6">
                        {report.reported_message_id ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                                <MessageSquare size={16} />
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Şikayet Edilen Mesaj</p>
                                <p className="text-sm font-black text-white">{report.reported_name}</p>
                              </div>
                            </div>
                            <div className="bg-orange-500/5 p-5 rounded-2xl border border-orange-500/10">
                              <p className="text-xs text-slate-400 italic font-medium leading-relaxed">
                                "{report.message_content}"
                              </p>
                            </div>
                          </div>
                        ) : report.reported_user_id ? (
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                              <Flag size={16} />
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest">Şikayet Edilen Kullanıcı</p>
                              <p className="text-sm font-black text-white">{report.reported_name}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 text-slate-600">
                            <AlertTriangle size={20} />
                            <p className="text-xs font-bold uppercase tracking-widest">Genel Sistem Bildirimi</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {reports.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-600">
                    <ShieldAlert size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-black uppercase tracking-[0.2em]">Kayıt Bulunmuyor</p>
                  </div>
                )}
              </div>
              
              <div className="mt-8 pt-8 border-t border-white/5">
                <Pagination 
                  currentPage={page}
                  totalCount={totalCount}
                  limit={limit}
                  onPageChange={setPage}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
