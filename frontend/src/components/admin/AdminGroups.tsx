import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../utils/api';
import { Pagination } from '../common/Pagination';

interface AdminGroup {
  id: number;
  name: string;
  content: string;
  is_approved: boolean;
  created_at: string;
  member_count?: number;
}

interface Expense {
  id: number;
  amount: number;
  content: string;
  date: string;
}

interface Member {
  id: number;
  role: string;
  is_approved: boolean;
  user_id: number;
  name: string;
  surname: string;
  mail: string;
}

interface Message {
  id: number;
  sender_name: string;
  message_text: string;
  timestamp: string;
}

export const AdminGroups: React.FC = () => {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'members' | 'chat'>('expenses');
  const [details, setDetails] = useState<{
    expenses: Expense[];
    members: Member[];
    messages: Message[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchGroups = async (query: string = searchTerm, pageNum: number = page, sort: string = sortField, order: string = sortOrder) => {
    try {
      setLoading(true);
      const res = await apiFetch(`/admin/groups?q=${encodeURIComponent(query)}&page=${pageNum}&limit=${limit}&sort=${sort}&order=${order}`);
      const data = await res.json();
      setGroups(data.groups || []);
      setTotalCount(data.total_count || 0);
    } catch (err) {
      console.error("Gruplar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    const newOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortOrder(newOrder);
    setPage(1);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGroups(searchTerm, page, sortField, sortOrder);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, page, sortField, sortOrder]);

  const SortHeader: React.FC<{ label: string; field: string }> = ({ label, field }) => (
    <th 
      className="py-4 px-3 cursor-pointer hover:text-[#00f0ff] transition-colors group/header whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <div className="flex flex-col text-[8px] opacity-30 group-hover/header:opacity-100">
          <span className={sortField === field && sortOrder === 'asc' ? 'text-[#00f0ff]' : ''}>▲</span>
          <span className={sortField === field && sortOrder === 'desc' ? 'text-[#00f0ff]' : ''}>▼</span>
        </div>
      </div>
    </th>
  );

  const handleApprove = async (groupId: number) => {
    try {
      await apiFetch(`/admin/groups/${groupId}/approve`, { method: 'POST' });
      fetchGroups(searchTerm, page, sortField, sortOrder);
    } catch (err) {
      alert("Onaylama başarısız");
    }
  };

  const handleReject = async (groupId: number) => {
    if (!window.confirm("Bu grubu reddetmek ve silmek istediğinize emin misiniz?")) return;
    try {
      await apiFetch(`/admin/groups/${groupId}`, { method: 'DELETE' });
      fetchGroups(searchTerm, page, sortField, sortOrder);
    } catch (err) {
      alert("Reddetme başarısız");
    }
  };

  const fetchDetails = async (groupId: number) => {
    try {
      setLoadingDetails(true);
      const res = await apiFetch(`/admin/groups/${groupId}/details`);
      const data = await res.json();
      setDetails(data);
    } catch (err) {
      alert("Detaylar yüklenemedi");
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (selectedGroupId) {
      fetchDetails(selectedGroupId);
    } else {
      setDetails(null);
    }
  }, [selectedGroupId]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            Grup Yönetimi
            <span className="bg-[#00f0ff]/10 text-[#00f0ff] text-[10px] font-black px-2 py-0.5 rounded-full border border-[#00f0ff]/20 uppercase tracking-widest">{totalCount} Toplam</span>
          </h3>
          <p className="text-slate-500 text-xs mt-1 font-medium">Sistemdeki aktif ve onay bekleyen tüm birimleri denetleyebilirsiniz.</p>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Grup ismi veya açıklama ile ara..."
            className="bg-slate-950 border border-slate-800 rounded-xl px-10 py-2.5 text-sm w-80 focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] outline-none transition-all"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          <svg className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden min-h-[600px] flex flex-col shadow-inner">
        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center py-20 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00f0ff]"></div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest animate-pulse">Grup Veritabanı Erişiliyor...</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={page + searchTerm + sortField + sortOrder}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-widest font-black">
                      <SortHeader label="ID" field="id" />
                      <SortHeader label="Grup Adı" field="name" />
                      <th className="py-4 px-3">Açıklama</th>
                      <SortHeader label="Üye Sayısı" field="member_count" />
                      <SortHeader label="Oluşturulma" field="created_at" />
                      <SortHeader label="Durum" field="is_approved" />
                      <th className="py-4 px-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {groups.map(group => (
                      <tr key={group.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="py-4 px-3 text-slate-500 font-mono text-xs">#{group.id}</td>
                        <td className="py-4 px-3">
                          <span className="text-slate-100 font-bold text-xs group-hover:text-[#00f0ff] transition-colors">{group.name}</span>
                        </td>
                        <td className="py-4 px-3">
                          <p className="text-slate-500 text-[11px] italic line-clamp-1 max-w-[200px]">"{group.content || 'Açıklama yok'}"</p>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-200 font-black text-xs">{group.member_count || 0}</span>
                            <span className="text-[9px] text-slate-600 uppercase font-bold">Personel</span>
                          </div>
                        </td>
                        <td className="py-4 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(group.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-3">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded w-fit ${
                            group.is_approved ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {group.is_approved ? 'ONAYLI' : 'BEKLEYEN'}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button 
                              onClick={() => setSelectedGroupId(group.id)}
                              className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-[#00f0ff] hover:text-slate-950 transition-all"
                              title="Detaylar"
                            >
                              🔍
                            </button>
                            {!group.is_approved && (
                              <button 
                                onClick={() => handleApprove(group.id)}
                                className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500 hover:text-white transition-all"
                                title="Onayla"
                              >
                                ✅
                              </button>
                            )}
                            <button 
                              onClick={() => handleReject(group.id)}
                              className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                              title="Reddet/Sil"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {groups.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-slate-500 italic">Grup bulunamadı.</p>
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

      {/* Grup Detayları Modalı */}
      {selectedGroupId && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h4 className="text-xl font-bold text-slate-100 flex items-center gap-3">
                <span className="w-3 h-3 bg-[#00f0ff] rounded-full shadow-[0_0_10px_#00f0ff]"></span>
                Grup Derinlemesine İnceleme
              </h4>
              <button onClick={() => setSelectedGroupId(null)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors">✕</button>
            </div>

            <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex gap-2">
              <button onClick={() => setActiveTab('expenses')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'expenses' ? 'bg-[#00f0ff] text-slate-950' : 'text-slate-500 hover:bg-slate-900'}`}>HARCAMALAR</button>
              <button onClick={() => setActiveTab('members')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'members' ? 'bg-[#00f0ff] text-slate-950' : 'text-slate-500 hover:bg-slate-900'}`}>PERSONEL</button>
              <button onClick={() => setActiveTab('chat')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'chat' ? 'bg-[#00f0ff] text-slate-950' : 'text-slate-500 hover:bg-slate-900'}`}>İLETİŞİM KAYITLARI</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-12 h-12 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin"></div>
                  <p className="text-slate-500 text-sm font-bold animate-pulse">Sektörel Veriler Analiz Ediliyor...</p>
                </div>
              ) : details && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    {activeTab === 'expenses' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {details.expenses.map(exp => (
                          <div key={exp.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xl font-black text-[#00f0ff]">{exp.amount}₺</span>
                              <span className="text-[10px] text-slate-600">{new Date(exp.date).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-slate-400 italic">"{exp.content}"</p>
                          </div>
                        ))}
                        {details.expenses.length === 0 && <p className="col-span-full text-center text-slate-600 py-20">Bu birime ait harcama kaydı bulunamadı.</p>}
                      </div>
                    )}

                    {activeTab === 'members' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {details.members.map(member => (
                          <div key={member.user_id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between items-center">
                            <div>
                              <div className="text-slate-100 font-bold">{member.name} {member.surname}</div>
                              <div className="text-[10px] text-slate-500">{member.mail}</div>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-1 rounded ${member.role === 'GROUP_LEADER' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                              {member.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === 'chat' && (
                      <div className="space-y-4 max-w-3xl mx-auto">
                        {details.messages.map(msg => (
                          <div key={msg.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 relative">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[#00f0ff] font-black text-xs">{msg.sender_name}</span>
                              <span className="text-[9px] text-slate-600">{new Date(msg.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-slate-300 leading-relaxed">"{msg.message_text}"</p>
                          </div>
                        ))}
                        {details.messages.length === 0 && <p className="text-center text-slate-600 py-20">İletişim kayıtları bulunamadı.</p>}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
            <div className="p-6 border-t border-slate-800 bg-slate-800/30 flex justify-end">
              <button onClick={() => setSelectedGroupId(null)} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl font-bold transition-all">Pencereyi Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
