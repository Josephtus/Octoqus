import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../utils/api';
import { Pagination } from '../common/Pagination';
import { Flag, MessageSquare, AlertTriangle, ShieldAlert, Filter, CheckCircle2, Clock, Inbox, CheckCircle } from 'lucide-react';

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
  const [selectedStatus, setSelectedStatus] = useState<string>('PENDING');
  const limit = 10;

  const categories = [
    { id: '', label: 'Tüm Kategoriler', icon: Filter },
    { id: 'GENEL', label: 'Genel', icon: MessageSquare },
    { id: 'HATA', label: 'Hata', icon: AlertTriangle },
    { id: 'KOTU_KULLANIM', label: 'Abuse', icon: ShieldAlert },
    { id: 'MESAJ', label: 'Mesaj', icon: MessageSquare },
    { id: 'KULLANICI', label: 'Kullanıcı', icon: Flag }
  ];

  const statuses = [
    { id: 'PENDING', label: 'Bekleyenler', icon: Inbox, color: 'text-amber-500' },
    { id: 'RESOLVED', label: 'Çözülenler', icon: CheckCircle, color: 'text-emerald-500' },
    { id: '', label: 'Hepsi', icon: ActivityIcon, color: 'text-blue-500' }
  ];

  const fetchReports = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      const categoryParam = selectedCategory ? `&category=${selectedCategory}` : '';
      const statusParam = selectedStatus ? `&status=${selectedStatus}` : '';
      const res = await apiFetch(`/admin/reports?page=${pageNum}&limit=${limit}${categoryParam}${statusParam}`);
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
  }, [page, selectedCategory, selectedStatus]);

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
          <h3 className="text-3xl font-black text-white tracking-tighter flex items-center gap-4">
            Şikayet Yönetimi
            <span className="bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] px-4 py-1.5 rounded-full uppercase tracking-widest font-black shadow-[0_0_20px_rgba(239,68,68,0.1)]">
              {totalCount} {selectedStatus === 'PENDING' ? 'AKTİF' : selectedStatus === 'RESOLVED' ? 'ÇÖZÜLMÜŞ' : 'TOPLAM'} KAYIT
            </span>
          </h3>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Sistem genelindeki geri bildirimler ve şikayetler</p>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl">
            {statuses.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedStatus(s.id); setPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedStatus === s.id 
                    ? 'bg-white/10 text-white shadow-inner' 
                    : 'text-slate-500 hover:text-white'
                }`}
              >
                <s.icon size={12} className={selectedStatus === s.id ? s.color : 'text-slate-600'} />
                {s.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl">
            {categories.slice(0, 4).map(cat => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedCategory === cat.id 
                    ? 'bg-[#00f0ff] text-slate-950 shadow-lg shadow-[#00f0ff]/20' 
                    : 'text-slate-500 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] overflow-hidden min-h-[600px] flex flex-col shadow-2xl">
        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin" />
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest animate-pulse">Veritabanı Analiz Ediliyor...</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={page + selectedCategory + selectedStatus}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col p-8 md:p-10"
            >
              <div className="space-y-6 flex-1">
                {reports.map(report => (
                  <div key={report.id} className="bg-slate-950/40 border border-white/5 rounded-[32px] p-8 hover:border-[#00f0ff]/30 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f0ff]/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
                    
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 relative z-10">
                      <div className="flex flex-wrap items-center gap-4">
                        {getCategoryBadge(report.category)}
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${
                          report.status?.toLowerCase() === 'pending' ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                        }`}>
                          <div className={`w-1 h-1 rounded-full ${report.status?.toLowerCase() === 'pending' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          <span className={`text-[9px] font-black tracking-widest uppercase ${
                            report.status?.toLowerCase() === 'pending' ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {report.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                          <Clock size={12} className="text-slate-600" />
                          {new Date(report.created_at).toLocaleDateString('tr-TR')} {new Date(report.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      
                      {report.status?.toLowerCase() === 'pending' && (
                        <button 
                          onClick={() => handleAction(report.id, 'resolved')} 
                          className="w-full md:w-auto px-10 py-3 bg-[#00f0ff] text-slate-950 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-[#00f0ff]/20 flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={14} /> ÇÖZÜLDÜ
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg shadow-inner">👤</div>
                          <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Şikayet Eden</p>
                            <p className="text-base font-black text-white">{report.reporter_name || 'Bilinmeyen'}</p>
                          </div>
                        </div>
                        <div className="bg-white/[0.02] p-6 rounded-3xl border border-white/5 relative">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Şikayet Detayı</p>
                          <p className="text-sm text-slate-300 leading-relaxed font-medium">
                            {report.aciklama}
                          </p>
                        </div>
                      </div>

                      <div className="lg:border-l border-white/5 lg:pl-10 space-y-6">
                        {report.reported_message_id ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                                <MessageSquare size={20} />
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Şikayet Edilen Mesaj</p>
                                <p className="text-base font-black text-white">{report.reported_name}</p>
                              </div>
                            </div>
                            <div className="bg-amber-500/5 p-6 rounded-3xl border border-amber-500/10 shadow-inner">
                              <p className="text-sm text-slate-400 italic font-medium leading-relaxed">
                                "{report.message_content}"
                              </p>
                            </div>
                          </div>
                        ) : report.reported_user_id ? (
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-[#b026ff]/10 border border-[#b026ff]/20 flex items-center justify-center text-[#b026ff]">
                              <Flag size={20} />
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-[#b026ff] uppercase tracking-widest">Şikayet Edilen Kullanıcı</p>
                              <p className="text-base font-black text-white">{report.reported_name}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 text-slate-600">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                              <AlertTriangle size={24} />
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tür</p>
                              <p className="text-sm font-black uppercase tracking-widest">Genel Sistem Bildirimi</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {reports.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-600">
                    <ShieldAlert size={64} className="mb-6 opacity-20" />
                    <p className="text-lg font-black uppercase tracking-[0.3em]">Şikayet Kaydı Bulunmuyor</p>
                  </div>
                )}
              </div>
              
              <div className="mt-12 pt-8 border-t border-white/5">
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

const ActivityIcon = ({ size, className }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);
