import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../utils/api';
import { Pagination } from '../common/Pagination';
import { Users, Trash2, Search, CheckCircle2, Hash, Copy, Check, Calendar, MessageSquare, Receipt, Clock } from 'lucide-react';

interface SortHeaderProps {
  label: string;
  field: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

const SortHeader: React.FC<SortHeaderProps> = ({ label, field, sortField, sortOrder, onSort }) => (
  <th 
    className="py-4 px-3 cursor-pointer hover:text-[#00f0ff] transition-colors group/header whitespace-nowrap"
    onClick={() => onSort(field)}
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

interface AdminGroup {
  id: number;
  name: string;
  content: string;
  is_approved: boolean;
  created_at: string;
  member_count?: number;
  invite_code: string;
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

  const [inviteModal, setInviteModal] = useState<{ show: boolean, code: string, name: string }>({ show: false, code: '', name: '' });
  const [copied, setCopied] = useState(false);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/40 backdrop-blur-3xl p-8 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00f0ff]/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-3xl font-black text-white tracking-tighter flex items-center gap-4">
            Grup Yönetimi
            <span className="bg-[#00f0ff]/10 text-[#00f0ff] text-[10px] font-black px-3 py-1 rounded-full border border-[#00f0ff]/20 uppercase tracking-widest">{totalCount} TOPLAM</span>
          </h3>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Sistemdeki aktif ve onay bekleyen tüm birimleri denetleyebilirsiniz.</p>
        </div>
        <div className="relative w-full md:w-96 z-10">
          <input 
            type="text" 
            placeholder="Grup ismi veya açıklama ile ara..."
            className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder:text-slate-600 focus:border-[#00f0ff]/50 outline-none transition-all font-bold"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      {/* Groups Table */}
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin" />
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest animate-pulse">Grup Veritabanı Erişiliyor...</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={page + searchTerm + sortField + sortOrder}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                      <SortHeader label="ID" field="id" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Grup Adı" field="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <th className="py-4 px-3">Açıklama</th>
                      <SortHeader label="Üye Sayısı" field="member_count" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Oluşturulma" field="created_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Durum" field="is_approved" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <th className="py-4 px-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {groups.map(group => (
                      <tr key={group.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-mono text-[10px] font-bold">#{group.id}</span>
                            <button 
                              onClick={() => setInviteModal({ show: true, code: group.invite_code, name: group.name })}
                              className="p-1.5 bg-white/5 hover:bg-[#00f0ff]/20 rounded-lg text-slate-500 hover:text-[#00f0ff] transition-all"
                              title="Grup Kodunu Gör"
                            >
                              <Hash size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <span className="text-white font-bold text-xs group-hover:text-[#00f0ff] transition-colors">{group.name}</span>
                        </td>
                        <td className="py-4 px-3">
                          <p className="text-slate-500 text-[11px] italic line-clamp-1 max-w-[250px]">"{group.content || 'Açıklama yok'}"</p>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-black text-xs">{group.member_count || 0}</span>
                            <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest">KİŞİ</span>
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold">
                              <Calendar size={12} className="text-slate-600" />
                              {new Date(group.created_at).toLocaleDateString('tr-TR')}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold">
                              <Clock size={12} className="text-slate-600" />
                              {new Date(group.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full w-fit ${group.is_approved ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                            <div className={`w-1 h-1 rounded-full ${group.is_approved ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span className={`text-[9px] font-black tracking-widest ${group.is_approved ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {group.is_approved ? 'ONAYLI' : 'BEKLEYEN'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setSelectedGroupId(group.id)}
                              className="w-8 h-8 flex items-center justify-center bg-white/5 text-slate-400 rounded-xl hover:bg-[#00f0ff] hover:text-slate-950 transition-all"
                              title="Detaylar"
                            >
                              <Search size={14} />
                            </button>
                            {!group.is_approved && (
                              <button 
                                onClick={() => handleApprove(group.id)}
                                className="w-8 h-8 flex items-center justify-center bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all"
                                title="Onayla"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleReject(group.id)}
                              className="w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5"
                              title="Reddet/Sil"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-8 border-t border-white/5">
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

      {/* Invite Code Modal */}
      <AnimatePresence>
        {inviteModal.show && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setInviteModal({ ...inviteModal, show: false })}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-[40px] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-[#00f0ff]/10 text-[#00f0ff] rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Hash size={32} />
              </div>
              <h3 className="text-xl font-black text-white mb-1">{inviteModal.name}</h3>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-6">Grup Katılım Kodu</p>
              
              <div className="relative group cursor-pointer" onClick={() => copyToClipboard(inviteModal.code)}>
                <div className="bg-slate-950 border border-white/5 rounded-2xl p-6 mb-2 group-hover:border-[#00f0ff]/50 transition-all">
                  <span className="text-3xl font-black text-[#00f0ff] tracking-widest select-all">{inviteModal.code}</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest group-hover:text-[#00f0ff] transition-colors">
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copied ? 'KOPYALANDI!' : 'KOPYALAMAK İÇİN TIKLAYIN'}
                </div>
              </div>

              <button 
                onClick={() => setInviteModal({ ...inviteModal, show: false })}
                className="w-full mt-8 py-4 bg-white/5 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                KAPAT
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grup Detayları Modalı */}
      <AnimatePresence>
        {selectedGroupId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedGroupId(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative w-full max-w-5xl h-[85vh] bg-slate-900 border border-white/10 rounded-[48px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <div>
                  <h4 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
                    <div className="w-2 h-2 bg-[#00f0ff] rounded-full shadow-[0_0_15px_#00f0ff]"></div>
                    Grup Detaylı Analiz
                  </h4>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Harcamalar, üyeler ve iletişim geçmişi</p>
                </div>
                <button onClick={() => setSelectedGroupId(null)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-white transition-all font-bold text-lg">✕</button>
              </div>

              <div className="px-8 py-4 bg-white/[0.01] border-b border-white/5 flex gap-4 overflow-x-auto custom-scrollbar">
                <button onClick={() => setActiveTab('expenses')} className={`px-8 py-3 rounded-2xl text-[10px] font-black tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'expenses' ? 'bg-[#00f0ff] text-slate-950 shadow-lg shadow-[#00f0ff]/20' : 'text-slate-500 hover:text-white'}`}>
                  <Receipt size={14} /> HARCAMALAR
                </button>
                <button onClick={() => setActiveTab('members')} className={`px-8 py-3 rounded-2xl text-[10px] font-black tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'members' ? 'bg-[#00f0ff] text-slate-950 shadow-lg shadow-[#00f0ff]/20' : 'text-slate-500 hover:text-white'}`}>
                  <Users size={14} /> ÜYE LİSTESİ
                </button>
                <button onClick={() => setActiveTab('chat')} className={`px-8 py-3 rounded-2xl text-[10px] font-black tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'chat' ? 'bg-[#00f0ff] text-slate-950 shadow-lg shadow-[#00f0ff]/20' : 'text-slate-500 hover:text-white'}`}>
                  <MessageSquare size={14} /> SOHBET GEÇMİŞİ
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                {loadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-16 h-16 border-4 border-[#00f0ff]/10 border-t-[#00f0ff] rounded-full animate-spin"></div>
                    <p className="text-slate-500 text-xs font-black uppercase tracking-widest animate-pulse">Sektörel Veriler Analiz Ediliyor...</p>
                  </div>
                ) : details && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {activeTab === 'expenses' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {details.expenses.map(exp => (
                            <div key={exp.id} className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 hover:border-white/10 transition-all group">
                              <div className="flex justify-between items-start mb-4">
                                <span className="text-2xl font-black text-[#00f0ff] group-hover:scale-110 transition-transform origin-left">{exp.amount}₺</span>
                                <span className="text-[10px] font-black text-slate-600 bg-white/5 px-2 py-1 rounded-lg">{new Date(exp.date).toLocaleDateString('tr-TR')}</span>
                              </div>
                              <p className="text-sm text-slate-300 font-medium leading-relaxed">"{exp.content}"</p>
                            </div>
                          ))}
                          {details.expenses.length === 0 && (
                            <div className="col-span-full py-20 text-center">
                              <Receipt size={40} className="text-slate-800 mx-auto mb-4" />
                              <p className="text-slate-600 text-sm font-bold uppercase tracking-widest">Harcama kaydı bulunamadı.</p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'members' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {details.members.map(member => (
                            <div key={member.user_id} className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 flex flex-col gap-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="text-white font-black text-sm">{member.name} {member.surname}</div>
                                  <div className="text-[10px] text-slate-500 font-bold mt-0.5">{member.mail}</div>
                                </div>
                                <span className={`text-[8px] font-black px-2 py-1 rounded border tracking-widest ${member.role?.toUpperCase() === 'GROUP_LEADER' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                  {member.role}
                                </span>
                              </div>
                              <div className={`w-full h-1 rounded-full ${member.is_approved ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                                <div className={`h-full rounded-full ${member.is_approved ? 'bg-emerald-500 w-full' : 'bg-amber-500 w-1/2'}`} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {activeTab === 'chat' && (
                        <div className="space-y-6 max-w-4xl mx-auto">
                          {details.messages.map(msg => (
                            <div key={msg.id} className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 hover:bg-white/[0.03] transition-all">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-[#00f0ff] font-black text-[10px] uppercase tracking-[0.2em]">{msg.sender_name}</span>
                                <span className="text-[9px] text-slate-600 font-bold flex items-center gap-2">
                                  <Clock size={10} /> {new Date(msg.timestamp).toLocaleString('tr-TR')}
                                </span>
                              </div>
                              <p className="text-slate-300 text-sm font-medium leading-relaxed">"{msg.message_text}"</p>
                            </div>
                          ))}
                          {details.messages.length === 0 && (
                            <div className="py-20 text-center">
                              <MessageSquare size={40} className="text-slate-800 mx-auto mb-4" />
                              <p className="text-slate-600 text-sm font-bold uppercase tracking-widest">Sohbet geçmişi boş.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
              <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-end">
                <button onClick={() => setSelectedGroupId(null)} className="px-10 py-4 bg-[#00f0ff] text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-[#00f0ff]/20">ANALİZİ KAPAT</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
