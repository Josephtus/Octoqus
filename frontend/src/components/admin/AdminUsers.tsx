import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../utils/api';
import { Pagination } from '../common/Pagination';
import { Users } from 'lucide-react';

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

interface GroupInfo {
  id: number;
  name: string;
  is_approved: boolean;
}

interface AdminUser {
  id: number;
  name: string;
  surname: string;
  mail: string;
  phone_number: string;
  role: string;
  is_active: boolean;
  age?: number;
  birthday?: string;
  joined_groups?: GroupInfo[];
  led_groups?: GroupInfo[];
  created_at: string;
}

interface ActivityMessage {
  id: number;
  group_name: string;
  message_text: string;
  timestamp: string;
}

interface ActivityMembership {
  group_id: number;
  group_name: string;
  role: string;
  joined_at: string;
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const [viewingDetails, setViewingDetails] = useState<number | null>(null);
  const [details, setDetails] = useState<{
    user: AdminUser;
    messages: ActivityMessage[];
    memberships: ActivityMembership[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const [sortField, setSortField] = useState('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchUsers = async (query: string = '', pageNum: number = 1, sort: string = sortField, order: string = sortOrder) => {
    try {
      setLoading(true);
      const res = await apiFetch(`/admin/users?q=${encodeURIComponent(query)}&page=${pageNum}&limit=${limit}&sort=${sort}&order=${order}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotalCount(data.total_count || 0);
    } catch (err) {
      console.error("Kullanıcılar yüklenemedi");
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
      fetchUsers(searchTerm, page, sortField, sortOrder);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, page, sortField, sortOrder]);



  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await apiFetch(`/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !currentStatus })
      });
      fetchUsers(searchTerm, page, sortField, sortOrder);
    } catch (err) {
      alert("Durum güncellenemedi");
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await apiFetch(`/admin/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingUser.name,
          surname: editingUser.surname,
          phone_number: editingUser.phone_number,
          age: editingUser.age || 0,
          birthday: editingUser.birthday
        })
      });
      setEditingUser(null);
      fetchUsers(searchTerm, page, sortField, sortOrder);
    } catch (err) {
      alert("Güncelleme başarısız");
    }
  };

  const fetchUserDetails = async (userId: number) => {
    try {
      setLoadingDetails(true);
      const res = await apiFetch(`/admin/users/${userId}/details`);
      const data = await res.json();
      setDetails(data);
    } catch (err) {
      alert("Detaylar yüklenemedi");
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (viewingDetails) {
      fetchUserDetails(viewingDetails);
    } else {
      setDetails(null);
      setGroupSearch('');
      setFoundGroups([]);
    }
  }, [viewingDetails]);

  const [groupSearch, setGroupSearch] = useState('');
  const [foundGroups, setFoundGroups] = useState<any[]>([]);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'groups' | 'security'>('overview');

  const searchGroups = async (q: string) => {
    if (q.length < 2) return;
    try {
      const res = await apiFetch(`/admin/groups?q=${encodeURIComponent(q)}&limit=5`);
      const data = await res.json();
      setFoundGroups(data.groups || []);
    } catch (err) {}
  };

  const handleAddUserToGroup = async (groupId: number) => {
    if (!viewingDetails) return;
    try {
      await apiFetch(`/admin/users/${viewingDetails}/groups/${groupId}`, { method: 'POST' });
      fetchUserDetails(viewingDetails);
      setGroupSearch('');
      setFoundGroups([]);
    } catch (err) {
      alert("Hata oluştu");
    }
  };

  const handleRemoveFromGroup = async (groupId: number) => {
    if (!viewingDetails || !window.confirm("Kullanıcıyı bu gruptan çıkarmak istediğinize emin misiniz?")) return;
    try {
      await apiFetch(`/admin/users/${viewingDetails}/groups/${groupId}`, { method: 'DELETE' });
      fetchUserDetails(viewingDetails);
    } catch (err) {
      alert("İşlem başarısız");
    }
  };

  const handleChangeGroupRole = async (groupId: number, newRole: string) => {
    if (!viewingDetails) return;
    try {
      await apiFetch(`/admin/users/${viewingDetails}/groups/${groupId}/role`, { 
        method: 'PUT',
        body: JSON.stringify({ role: newRole })
      });
      fetchUserDetails(viewingDetails);
    } catch (err) {
      alert("Rol güncellenemedi");
    }
  };

  const handleTransferLeader = async (groupId: number) => {
    if (!viewingDetails) return;
    try {
      await apiFetch(`/admin/groups/${groupId}/transfer_leadership`, {
        method: 'POST',
        body: JSON.stringify({ target_user_id: viewingDetails })
      });
      fetchUserDetails(viewingDetails);
    } catch (err) {
      alert("Liderlik devri başarısız");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-2xl font-bold text-slate-100">Kullanıcı Yönetimi</h3>
          <p className="text-slate-500 text-xs mt-1">Sistemdeki tüm üyeleri görüntüleyebilir ve yönetebilirsiniz.</p>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="İsim, Soyisim, Email veya Telefon..."
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
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest animate-pulse">Kullanıcı Veritabanı Erişiliyor...</span>
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
                      <SortHeader label="ID" field="id" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="İsim" field="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Soyisim" field="surname" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Email" field="mail" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Telefon" field="phone_number" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Doğum Tarihi" field="birthday" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <th className="py-4 px-3">Üyelikler</th>
                      <th className="py-4 px-3">Liderlik</th>
                      <SortHeader label="Rol" field="role" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Durum" field="is_active" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <th className="py-4 px-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-slate-800/20 transition-colors group">
                        <td className="py-3 px-3 text-slate-500 font-mono text-[10px]">#{user.id}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-[10px]">👤</div>
                            <span className="text-slate-200 font-bold text-xs">{user.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-200 font-bold text-xs">{user.surname}</td>
                        <td className="py-3 px-3 text-slate-400 text-[10px] font-medium">{user.mail}</td>
                        <td className="py-3 px-3 text-slate-500 text-[10px]">{user.phone_number}</td>
                        <td className="py-3 px-3 text-slate-400 text-[10px] whitespace-nowrap">
                          {user.birthday ? new Date(user.birthday).toLocaleDateString('tr-TR') : '-'}
                          {user.age ? <span className="ml-1 text-slate-600 font-black">({user.age})</span> : null}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {user.joined_groups?.map(g => (
                              <span key={g.id} className="px-1.5 py-0.5 bg-slate-800/50 text-slate-500 rounded border border-slate-700/50 text-[8px] font-black">
                                {g.name}
                              </span>
                            )) || <span className="text-slate-700 text-[8px] font-black">—</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {user.led_groups?.map(g => (
                              <span key={g.id} className="px-1.5 py-0.5 bg-purple-500/5 text-purple-400/70 rounded border border-purple-500/10 text-[8px] font-black">
                                {g.name}
                              </span>
                            )) || <span className="text-slate-700 text-[8px] font-black">—</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded border ${
                            user.role?.toUpperCase() === 'ADMIN' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                            user.role?.toUpperCase() === 'GROUP_LEADER' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                            <span className={`text-[9px] font-black ${
                              user.is_active ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {user.is_active ? 'AKTİF' : 'ENGELİ'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button 
                              onClick={() => setViewingDetails(user.id)}
                              className="w-8 h-8 flex items-center justify-center bg-slate-800/50 text-slate-400 rounded-lg hover:bg-cyan-500 hover:text-white transition-all"
                              title="Detaylar"
                            >
                              <Users size={12} />
                            </button>
                            <button 
                              onClick={() => setEditingUser(user)}
                              className="w-8 h-8 flex items-center justify-center bg-slate-800/50 text-slate-400 rounded-lg hover:bg-amber-500 hover:text-white transition-all"
                              title="Düzenle"
                            >
                              ✏️
                            </button>
                            {user.role !== 'ADMIN' && (
                              <button 
                                onClick={() => toggleUserStatus(user.id, user.is_active)}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                                  user.is_active 
                                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white' 
                                  : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                                }`}
                                title={user.is_active ? "Engelle" : "Engeli Kaldır"}
                              >
                                {user.is_active ? '🚫' : '✅'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-slate-500 italic">Kullanıcı bulunamadı.</p>
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

      {/* Detaylar Modalı */}
      {viewingDetails && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex gap-4 overflow-x-auto">
              <button 
                onClick={() => setActiveDetailTab('overview')} 
                className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${activeDetailTab === 'overview' ? 'bg-[#00f0ff] text-slate-950' : 'text-slate-500 hover:text-white'}`}
              >
                GENEL BAKIŞ
              </button>
              <button 
                onClick={() => setActiveDetailTab('groups')} 
                className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${activeDetailTab === 'groups' ? 'bg-[#00f0ff] text-slate-950' : 'text-slate-500 hover:text-white'}`}
              >
                GRUP YÖNETİMİ
              </button>
              <button 
                onClick={() => setActiveDetailTab('security')} 
                className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${activeDetailTab === 'security' ? 'bg-[#00f0ff] text-slate-950' : 'text-slate-500 hover:text-white'}`}
              >
                GÜVENLİK & BAN
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00f0ff]"></div>
                  <p className="text-slate-500 animate-pulse text-sm">Veriler toplanıyor...</p>
                </div>
              ) : details && (
                <div className="space-y-8">
                  {activeDetailTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="space-y-6">
                        <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5">
                          <h5 className="text-[10px] font-black text-[#00f0ff] uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Users size={12} /> Profil Künyesi
                          </h5>
                          <div className="space-y-5">
                            <div>
                              <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter block mb-1">Hesap Oluşturma</label>
                              <div className="text-slate-200 text-xs font-bold">{new Date(details.user.created_at).toLocaleString('tr-TR')}</div>
                            </div>
                            <div>
                              <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter block mb-1">Global Rol</label>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${details.user.role === 'ADMIN' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                                  {details.user.role}
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter block mb-1">Durum</label>
                              <div className={`text-xs font-black flex items-center gap-2 ${details.user.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${details.user.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                {details.user.is_active ? 'AKTİF KULLANICI' : 'ERİŞİM ENGELLİ'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="lg:col-span-2 space-y-6">
                        <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5">
                          <h5 className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-6">Son Chat Mesajları</h5>
                          <div className="space-y-3">
                            {details.messages.slice(0, 5).map((msg) => (
                              <div key={msg.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/10 transition-all">
                                <div className="flex justify-between mb-2">
                                  <span className="text-[#00f0ff] font-black text-[10px] uppercase tracking-tighter">{msg.group_name}</span>
                                  <span className="text-[9px] text-slate-600 font-bold">{new Date(msg.timestamp).toLocaleString('tr-TR')}</span>
                                </div>
                                <p className="text-slate-300 text-xs font-medium leading-relaxed">"{msg.message_text}"</p>
                              </div>
                            ))}
                            {details.messages.length === 0 && <p className="text-slate-600 text-xs italic py-4">Henüz hiç mesaj gönderilmemiş.</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeDetailTab === 'groups' && (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5">
                          <h5 className="text-[10px] font-black text-[#00f0ff] uppercase tracking-widest mb-6">Mevcut Üyelikler</h5>
                          <div className="space-y-4">
                            {details.memberships.map((m) => (
                              <div key={m.group_id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between group">
                                <div className="flex-1">
                                  <span className="text-slate-100 font-black text-sm block">{m.group_name}</span>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[9px] text-slate-500 font-bold">KATILIM: {new Date(m.joined_at).toLocaleDateString('tr-TR')}</span>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${m.role === 'GROUP_LEADER' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                      {m.role}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  {m.role !== 'GROUP_LEADER' ? (
                                    <>
                                      <button 
                                        onClick={() => handleTransferLeader(m.group_id)}
                                        className="p-2 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-tighter"
                                        title="Lider Yap"
                                      >
                                        LİDER YAP
                                      </button>
                                      <button 
                                        onClick={() => handleRemoveFromGroup(m.group_id)}
                                        className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                        title="Gruptan Çıkar"
                                      >
                                        🗑️
                                      </button>
                                    </>
                                  ) : (
                                    <button 
                                      onClick={() => handleChangeGroupRole(m.group_id, 'USER')}
                                      className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-amber-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-tighter"
                                      title="Üyeye Dönüştür"
                                    >
                                      ÜYE YAP
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {details.memberships.length === 0 && <p className="text-slate-600 text-sm italic">Henüz bir gruba üye değil.</p>}
                          </div>
                        </div>

                        <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5">
                          <h5 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-6">Gruba Manuel Ekle</h5>
                          <div className="space-y-4">
                            <div className="relative">
                              <input 
                                type="text"
                                placeholder="Grup ismi ile ara..."
                                className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-[#00f0ff] transition-all"
                                value={groupSearch}
                                onChange={(e) => {
                                  setGroupSearch(e.target.value);
                                  searchGroups(e.target.value);
                                }}
                              />
                            </div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                              {foundGroups.map(g => (
                                <div key={g.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all">
                                  <div>
                                    <span className="text-slate-200 font-bold text-xs">{g.name}</span>
                                    <p className="text-[9px] text-slate-500 truncate max-w-[150px]">{g.content}</p>
                                  </div>
                                  <button 
                                    onClick={() => handleAddUserToGroup(g.id)}
                                    className="px-4 py-1.5 bg-[#00f0ff] text-slate-950 rounded-lg font-black text-[9px] uppercase tracking-widest hover:scale-105 transition-all"
                                  >
                                    EKLE
                                  </button>
                                </div>
                              ))}
                              {groupSearch.length >= 2 && foundGroups.length === 0 && <p className="text-slate-600 text-center text-[10px] py-4">Sonuç bulunamadı.</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeDetailTab === 'security' && (
                    <div className="max-w-2xl mx-auto space-y-6">
                      <div className="bg-red-500/5 border border-red-500/20 rounded-[32px] p-8">
                        <h5 className="text-lg font-black text-red-500 mb-4">Tehlikeli İşlemler</h5>
                        <p className="text-slate-400 text-sm mb-8 font-medium leading-relaxed">
                          Bu panel üzerinden kullanıcının platforma erişimini tamamen engelleyebilir veya kısıtlamalarını kaldırabilirsiniz. 
                          Yapılan her işlem denetim izine (audit log) kaydedilir.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button 
                            onClick={() => toggleUserStatus(details.user.id, details.user.is_active)}
                            className={`flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                              details.user.is_active 
                              ? 'bg-red-500 text-white hover:bg-red-600' 
                              : 'bg-emerald-500 text-white hover:bg-emerald-600'
                            }`}
                          >
                            {details.user.is_active ? '🚫 ERİŞİMİ ENGELLE (BAN)' : '✅ ENGELİ KALDIR'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-800 bg-slate-800/30 flex justify-end">
              <button onClick={() => setViewingDetails(null)} className="px-6 py-2 bg-[#00f0ff] text-slate-950 rounded-xl font-bold hover:bg-[#00c0cc] transition-all">Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* Düzenleme Modalı */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#b026ff]"></div>
            <h4 className="text-2xl font-bold text-slate-100 mb-6 flex items-center gap-2">
              <span className="text-xl">✏️</span> Kullanıcı Düzenle
            </h4>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">Ad</label>
                  <input className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 outline-none focus:border-[#b026ff]" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">Soyad</label>
                  <input className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 outline-none focus:border-[#b026ff]" value={editingUser.surname} onChange={e => setEditingUser({...editingUser, surname: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">Telefon</label>
                <input className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 outline-none focus:border-[#b026ff]" value={editingUser.phone_number} onChange={e => setEditingUser({...editingUser, phone_number: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">Yaş</label>
                  <input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 outline-none focus:border-[#b026ff]" value={editingUser.age || ''} onChange={e => setEditingUser({...editingUser, age: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">Doğum Tarihi</label>
                  <input type="date" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 outline-none focus:border-[#b026ff]" value={editingUser.birthday || ''} onChange={e => setEditingUser({...editingUser, birthday: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-2xl font-bold">İptal</button>
                <button type="submit" className="flex-1 py-3 bg-[#b026ff] text-white rounded-2xl font-bold shadow-[0_0_20px_#b026ff44]">Güncelle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
