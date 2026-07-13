import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';
import { Pagination } from '../common/Pagination';
import { motion, AnimatePresence } from 'framer-motion';

interface AuditLog {
  id: number;
  admin_id: number;
  process_performed: string;
  content: string;
  timestamp: string;
}

export const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 50;

  const fetchLogs = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      const res = await apiFetch(`/admin/audit-logs?page=${pageNum}&limit=${limit}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalCount(data.total_count || 0);
    } catch (err) {
      console.error("Loglar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
        Sistem Audit Logları
        <span className="bg-[#00f0ff]/20 text-[#00f0ff] text-xs px-2 py-1 rounded-full">{totalCount} Kayıt</span>
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col"
            >
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-widest font-black">
                      <th className="py-4 px-6">Zaman Damgası</th>
                      <th className="py-4 px-6">Olay</th>
                      <th className="py-4 px-6">Kullanıcı</th>
                      <th className="py-4 px-6">Detaylar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-6 text-slate-500 font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="py-4 px-6">
                          <span className="text-[#00f0ff] font-bold text-xs">{log.process_performed}</span>
                        </td>
                        <td className="py-4 px-6 text-slate-300 text-xs">ID: #{log.admin_id}</td>
                        <td className="py-4 px-6 text-slate-400 text-[10px] font-mono italic">{log.content}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {logs.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-slate-500 italic">Log kaydı bulunamadı.</p>
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
