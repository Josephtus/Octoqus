import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '../../utils/api';
import { Users, FolderOpen, AlertTriangle, Activity, CheckCircle2 } from 'lucide-react';

interface AdminDashboardProps {
  onTabChange: (tab: 'dashboard' | 'users' | 'groups' | 'reports' | 'logs') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onTabChange }) => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalGroups: 0,
    pendingGroups: 0,
    totalReports: 0
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Get counts from existing APIs (using limit=1 just to get total_count)
      const [usersRes, groupsRes, pendingRes, reportsRes, logsRes] = await Promise.all([
        apiFetch('/admin/users?limit=1'),
        apiFetch('/admin/groups?limit=1'),
        apiFetch('/admin/groups?q=&page=1&limit=100'),
        apiFetch('/admin/reports?status=PENDING&limit=1'),
        apiFetch('/admin/audit-logs?limit=5')
      ]);

      const usersData = await usersRes.json();
      const groupsData = await groupsRes.json();
      const pendingData = await pendingRes.json();
      const reportsData = await reportsRes.json();
      const logsData = await logsRes.json();

      setStats({
        totalUsers: usersData.total_count || 0,
        totalGroups: groupsData.total_count || 0,
        pendingGroups: (pendingData.groups || []).filter((g: any) => !g.is_approved).length,
        totalReports: reportsData.total_count || 0
      });

      setRecentLogs(logsData.logs || []);
    } catch (err) {
      console.error("Dashboard verileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
        <div className="w-12 h-12 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin" />
        <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">Sistem Özeti Hazırlanıyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between px-2">
        <div>
          <h3 className="text-3xl font-black text-white tracking-tight">Genel Durum</h3>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Platform Genel Özeti</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-[#00f0ff]/10 hover:text-[#00f0ff] transition-all"
        >
          Verileri Tazele
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'TOPLAM KULLANICI', value: stats.totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: 'AKTİF GRUPLAR', value: stats.totalGroups, icon: FolderOpen, color: 'text-purple-400', bg: 'bg-purple-400/10' },
          { label: 'ONAY BEKLEYEN', value: stats.pendingGroups, icon: CheckCircle2, color: stats.pendingGroups > 0 ? 'text-amber-400' : 'text-emerald-400', bg: stats.pendingGroups > 0 ? 'bg-amber-400/10' : 'bg-emerald-400/10' },
          { label: 'AKTİF ŞİKAYETLER', value: stats.totalReports, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-slate-950/50 border border-white/5 rounded-[32px] p-6 shadow-2xl relative overflow-hidden group"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} blur-3xl -mr-12 -mt-12 opacity-50 group-hover:opacity-100 transition-opacity`} />
            <div className="relative z-10">
              <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-6`}>
                <stat.icon size={24} />
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
              <h4 className="text-3xl font-black text-white tracking-tighter">{stat.value}</h4>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Onay Bekleyenler / Kritik Aksiyonlar */}
          {stats.pendingGroups > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl -mr-16 -mt-16" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xl font-black text-amber-400 tracking-tight flex items-center gap-3">
                    <CheckCircle2 size={20} />
                    Onay Bekleyen Gruplar
                  </h4>
                  <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                    {stats.pendingGroups} KRİTİK
                  </span>
                </div>
                <p className="text-slate-400 text-sm font-medium mb-6">
                  Sistemde yeni oluşturulmuş ve henüz onaylanmamış gruplar bulunuyor. Bu gruplar onaylanana kadar üyeler işlem yapamaz.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => onTabChange('groups')}
                    className="px-6 py-3 bg-amber-500 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
                  >
                    GRUPLARI İNCELE
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-950/50 border border-white/5 rounded-[40px] p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                <Activity size={20} className="text-[#00f0ff]" />
                Son Sistem Aktiviteleri
              </h4>
            </div>
            <div className="space-y-4">
              {recentLogs.map((log, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-sm group-hover:border-[#00f0ff]/30 transition-all">
                    {log.process_performed.includes('USER') ? '👤' : log.process_performed.includes('GROUP') ? '📁' : '⚙️'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-white uppercase tracking-wider">{log.process_performed.replace(/_/g, ' ')}</p>
                      <span className="w-1 h-1 rounded-full bg-slate-700" />
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{new Date(log.timestamp).toLocaleString('tr-TR')}</p>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium truncate max-w-md mt-1">{log.content}</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-black text-[#00f0ff] uppercase tracking-widest">DETAY</span>
                  </div>
                </div>
              ))}
              {recentLogs.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-slate-600 text-xs italic">Henüz bir aktivite kaydı bulunmuyor.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-gradient-to-br from-[#00f0ff]/20 to-[#b026ff]/20 border border-white/10 rounded-[40px] p-8 shadow-2xl relative overflow-hidden h-full">
            <div className="relative z-10 h-full flex flex-col">
              <h4 className="text-xl font-black text-white tracking-tight mb-4">Admin Bilgi</h4>
              <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
                Octoqus yönetim paneline hoş geldiniz. Buradan sistemdeki tüm kullanıcıları, grupları ve şikayetleri denetleyebilirsiniz.
              </p>
              
              <div className="mt-auto space-y-4">
                <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">SUNUCU DURUMU</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">ÇEVRİMİÇİ / AKTİF</span>
                  </div>
                </div>
                <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">VERİTABANI</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">BAĞLI / SAĞLIKLI</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
