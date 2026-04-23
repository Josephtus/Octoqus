import React, { useState } from 'react';
import { AdminUsers } from './AdminUsers';
import { AdminGroups } from './AdminGroups';
import { AdminReports } from './AdminReports';
import { AdminLogs } from './AdminLogs';

type AdminTab = 'users' | 'groups' | 'reports' | 'logs';

export const AdminPanel: React.FC = () => {
  const [adminTab, setAdminTab] = useState<AdminTab>('users');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[800px]">
      <div className="w-full md:w-64 bg-slate-950 border-r border-slate-800 p-6 flex flex-col gap-2">
        <h2 className="text-[#00f0ff] font-black text-xl mb-6 flex items-center gap-2">
          <span className="w-3 h-3 bg-[#00f0ff] rounded-full shadow-[0_0_10px_#00f0ff]"></span>
          ADMİN PANEL
        </h2>
        {[
          { id: 'users', label: 'Kullanıcılar', icon: '👤' },
          { id: 'groups', label: 'Grup Onayları', icon: '📁' },
          { id: 'reports', label: 'Şikayetler', icon: '⚠️' },
          { id: 'logs', label: 'Sistem Logları', icon: '📜' },
        ].map((item) => (
          <button key={item.id} onClick={() => setAdminTab(item.id as AdminTab)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
              adminTab === item.id 
              ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30' 
              : 'text-slate-400 hover:bg-slate-900'
            }`}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-8 bg-slate-900/50">
        {adminTab === 'users' && <AdminUsers />}
        {adminTab === 'groups' && <AdminGroups />}
        {adminTab === 'reports' && <AdminReports />}
        {adminTab === 'logs' && <AdminLogs />}
      </div>
    </div>
  );
};
