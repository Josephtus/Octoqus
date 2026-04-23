import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';
import { Pagination } from '../common/Pagination';

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
      <h3 className="text-2xl font-bold text-slate-100">Sistem İşlem Logları</h3>
      
      {loading ? <div className="text-[#00f0ff] animate-pulse">Yükleniyor...</div> : (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-widest">
                <th className="py-4 px-4">Tarih</th>
                <th className="py-4 px-4">Admin</th>
                <th className="py-4 px-4">İşlem</th>
                <th className="py-4 px-4">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-900/30">
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono">
                    ID: #{log.admin_id}
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold">
                      {log.process_performed}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 italic text-xs">
                    {log.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <div className="p-8 text-center text-slate-600 italic">Kayıtlı log bulunmuyor.</div>}
          
          <Pagination 
            currentPage={page}
            totalCount={totalCount}
            limit={limit}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
};

