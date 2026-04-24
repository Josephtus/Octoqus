import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../utils/api';
import { Pagination } from '../common/Pagination';

interface Report {
  id: number;
  reporter_id: number;
  reporter_name?: string;
  reported_user_id?: number;
  reported_name?: string;
  reported_message_id?: number;
  message_content?: string;
  aciklama: string;
  status: string;
  created_at: string;
}

export const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const fetchReports = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      const res = await apiFetch(`/admin/reports?page=${pageNum}&limit=${limit}`);
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
  }, [page]);

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

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
        Şikayet Yönetimi
        <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full">{reports.filter(r => r.status === 'pending').length} Bekleyen</span>
      </h3>

      <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden min-h-[600px] flex flex-col">
        {loading ? (
          <div className="flex-1 flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00f0ff]"></div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col p-6"
            >
              <div className="grid grid-cols-1 gap-4 flex-1">
                {reports.map(report => (
                  <div key={report.id} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                          report.reported_message_id ? 'bg-orange-500/20 text-orange-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {report.reported_message_id ? 'MESAJ ŞİKAYETİ' : 'KULLANICI ŞİKAYETİ'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                          report.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 
                          report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {report.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500">{new Date(report.created_at).toLocaleString()}</span>
                      </div>
                      {report.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleAction(report.id, 'resolved')} className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-500 hover:text-white transition-all font-bold">Çözüldü</button>
                          <button onClick={() => handleAction(report.id, 'dismissed')} className="text-xs bg-slate-800 text-slate-400 px-3 py-1.5 rounded-lg hover:bg-slate-700 hover:text-white transition-all font-bold">Reddet</button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Şikayet Eden</label>
                          <div className="text-slate-200 font-bold">{report.reporter_name || 'Bilinmeyen'} (ID: #{report.reporter_id})</div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Açıklama</label>
                          <div className="text-sm text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800 italic">
                            "{report.aciklama}"
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 border-l border-slate-800 pl-6">
                        {report.reported_message_id ? (
                          <div>
                            <label className="text-[10px] font-bold text-orange-500 uppercase tracking-widest block mb-1">Şikayet Edilen Mesaj İçeriği</label>
                            <div className="text-slate-400 text-[10px] mb-2 flex items-center gap-2">
                              <span>👤 {report.reported_name}</span>
                              <span>🆔 #{report.reported_user_id}</span>
                            </div>
                            {report.message_content && (
                              <div className="bg-orange-500/5 p-3 rounded-xl border border-orange-500/20 text-xs text-slate-300">
                                {report.message_content}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <label className="text-[10px] font-bold text-purple-500 uppercase tracking-widest block mb-1">Şikayet Edilen Kullanıcı</label>
                            <div className="text-slate-200 font-bold">{report.reported_name || 'Bilinmeyen'} (ID: #{report.reported_user_id})</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {reports.length === 0 && (
                  <div className="text-slate-500 italic text-center py-20 flex-1 flex items-center justify-center">
                    Henüz bir şikayet bulunmuyor.
                  </div>
                )}
              </div>
              <Pagination 
                currentPage={page}
                totalCount={totalCount}
                limit={limit}
                onPageChange={setPage}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
