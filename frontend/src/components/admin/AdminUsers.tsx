import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../utils/api';
import { Pagination } from '../common/Pagination';
import { Users, Trash2, Shield, User as UserIcon, Calendar, Phone, Mail, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Hash, Copy, Check } from 'lucide-react';

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
  invite_code: string;
  created_at: string;
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal States
  const [groupModal, setGroupModal] = useState<{ show: boolean, title: string, groups: GroupInfo[] }>({ show: false, title: '', groups: [] });
  const [inviteModal, setInviteModal] = useState<{ show: boolean, code: string, name: string }>({ show: false, code: '', name: '' });
  const [deleteModal, setDeleteModal] = useState<{ show: boolean, user: AdminUser | null }>({ show: false, user: null });
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleDeleteUser = async () => {
    if (!deleteModal.user) return;
    try {
      const res = await apiFetch(`/admin/users/${deleteModal.user.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteModal({ show: false, user: null });
        fetchUsers(searchTerm, page, sortField, sortOrder);
      } else {
        const error = await res.json();
        alert(error.message || "Silme işlemi başarısız");
      }
    } catch (err) {
      alert("Bir hata oluştu");
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
          <h3 className="text-3xl font-black text-white tracking-tighter">Kullanıcı Yönetimi</h3>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Sistemdeki tüm üyeleri görüntüleyebilir ve yönetebilirsiniz.</p>
        </div>
        <div className="relative w-full md:w-96 z-10">
          <input 
            type="text" 
            placeholder="İsim, Soyisim, Email veya Telefon..."
            className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder:text-slate-600 focus:border-[#00f0ff]/50 outline-none transition-all font-bold"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin" />
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest animate-pulse">Veritabanı Erişiliyor...</span>
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
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                      <SortHeader label="ID" field="id" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="İsim" field="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Soyisim" field="surname" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Email" field="mail" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Telefon" field="phone_number" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Doğum Tarihi" field="birthday" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Üyelikler" field="membership_count" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Liderlik" field="leadership_count" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Rol" field="role" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <SortHeader label="Durum" field="is_active" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                      <th className="py-4 px-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-mono text-[10px] font-bold">#{user.id}</span>
                            <button 
                              onClick={() => setInviteModal({ show: true, code: user.invite_code, name: `${user.name} ${user.surname}` })}
                              className="p-1.5 bg-white/5 hover:bg-[#00f0ff]/20 rounded-lg text-slate-500 hover:text-[#00f0ff] transition-all"
                              title="Davet Kodunu Gör"
                            >
                              <Hash size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center text-slate-400">
                              <UserIcon size={14} />
                            </div>
                            <span className="text-white font-bold text-xs">{user.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-3 text-white font-bold text-xs">{user.surname}</td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold lowercase">
                            <Mail size={12} className="text-slate-600" />
                            {user.mail}
                          </div>
                        </td>
                        <td className="py-4 px-3 text-slate-500 text-[10px] font-bold">
                           <div className="flex items-center gap-2">
                            <Phone size={12} className="text-slate-600" />
                            {user.phone_number}
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold">
                            <Calendar size={12} className="text-slate-600" />
                            {user.birthday ? new Date(user.birthday).toLocaleDateString('tr-TR') : '-'}
                            {user.age ? <span className="ml-1 text-slate-600">({user.age})</span> : null}
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white">{user.joined_groups?.length || 0}</span>
                            {(user.joined_groups?.length || 0) > 0 && (
                              <button 
                                onClick={() => setGroupModal({ show: true, title: 'Üye Olduğu Gruplar', groups: user.joined_groups || [] })}
                                className="p-1.5 bg-white/5 hover:bg-[#00f0ff]/20 rounded-lg text-slate-500 hover:text-[#00f0ff] transition-all"
                              >
                                <ChevronRight size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white">{user.led_groups?.length || 0}</span>
                            {(user.led_groups?.length || 0) > 0 && (
                              <button 
                                onClick={() => setGroupModal({ show: true, title: 'Lider Olduğu Gruplar', groups: user.led_groups || [] })}
                                className="p-1.5 bg-white/5 hover:bg-[#b026ff]/20 rounded-lg text-slate-500 hover:text-[#b026ff] transition-all"
                              >
                                <ChevronRight size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded border tracking-widest ${
                            user.role?.toUpperCase() === 'ADMIN' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                            user.role?.toUpperCase() === 'GROUP_LEADER' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-4 px-3">
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full w-fit ${user.is_active ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                            <div className={`w-1 h-1 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className={`text-[9px] font-black tracking-widest ${user.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
                              {user.is_active ? 'AKTİF' : 'BANLANMIŞ'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setEditingUser(user)}
                              className="w-8 h-8 flex items-center justify-center bg-white/5 text-slate-400 rounded-xl hover:bg-amber-500 hover:text-white transition-all"
                              title="Düzenle"
                            >
                              ✏️
                            </button>
                            {user.role !== 'ADMIN' && (
                              <>
                                <button 
                                  onClick={() => toggleUserStatus(user.id, user.is_active)}
                                  className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
                                    user.is_active 
                                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white' 
                                    : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                                  }`}
                                  title={user.is_active ? "Engelle" : "Engeli Kaldır"}
                                >
                                  {user.is_active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                                </button>
                                <button 
                                  onClick={() => setDeleteModal({ show: true, user: user })}
                                  className="w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5"
                                  title="Üyeliği Sil"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-auto p-8 border-t border-white/5">
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
              <div className="w-16 h-16 bg-cyan-500/10 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Hash size={32} />
              </div>
              <h3 className="text-xl font-black text-white mb-1">{inviteModal.name}</h3>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-6">Arkadaşlık & Davet Kodu</p>
              
              <div className="relative group cursor-pointer" onClick={() => copyToClipboard(inviteModal.code)}>
                <div className="bg-slate-950 border border-white/5 rounded-2xl p-6 mb-2 group-hover:border-cyan-500/50 transition-all">
                  <span className="text-3xl font-black text-[#00f0ff] tracking-widest select-all">{inviteModal.code}</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest group-hover:text-cyan-400 transition-colors">
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

      {/* Group Detail Modal */}
      <AnimatePresence>
        {groupModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setGroupModal({ ...groupModal, show: false })}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#00f0ff]">
                  <Users size={20} />
                </div>
                <h3 className="text-xl font-black text-white">{groupModal.title}</h3>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {groupModal.groups.map(g => (
                  <div key={g.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-200">{g.name}</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${g.is_approved ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {g.is_approved ? 'ONAYLI' : 'BEKLEMEDE'}
                    </span>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setGroupModal({ ...groupModal, show: false })}
                className="w-full mt-6 py-4 bg-white/5 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                KAPAT
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.show && deleteModal.user && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteModal({ show: false, user: null })}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 border border-red-500/20 p-8 rounded-[40px] shadow-2xl text-center overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Kalıcı Olarak Sil?</h3>
              <p className="text-slate-400 text-sm mb-8">
                <span className="text-white font-bold">{deleteModal.user.name} {deleteModal.user.surname}</span> isimli kullanıcıyı ve tüm verilerini sistemden kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setDeleteModal({ show: false, user: null })}
                  className="py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  VAZGEÇ
                </button>
                <button 
                  onClick={handleDeleteUser}
                  className="py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-red-500/20 flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> EVET, SİL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editing Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[40px] shadow-2xl p-10 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-[#b026ff]"></div>
              <h4 className="text-3xl font-black text-white mb-8 flex items-center gap-3 tracking-tighter">
                <EditIcon /> Düzenle
              </h4>
              <form onSubmit={handleUpdateUser} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Ad</label>
                    <input className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-[#b026ff]/50 font-bold transition-all" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Soyad</label>
                    <input className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-[#b026ff]/50 font-bold transition-all" value={editingUser.surname} onChange={e => setEditingUser({...editingUser, surname: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Telefon</label>
                  <input className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-[#b026ff]/50 font-bold transition-all" value={editingUser.phone_number} onChange={e => setEditingUser({...editingUser, phone_number: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Yaş</label>
                    <input type="number" className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-[#b026ff]/50 font-bold transition-all" value={editingUser.age || ''} onChange={e => setEditingUser({...editingUser, age: parseInt(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Doğum Tarihi</label>
                    <input type="date" className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-[#b026ff]/50 font-bold transition-all" value={editingUser.birthday || ''} onChange={e => setEditingUser({...editingUser, birthday: e.target.value})} />
                  </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-5 bg-white/5 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all">İPTAL</button>
                  <button type="submit" className="flex-1 py-5 bg-[#b026ff] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_0_40px_rgba(176,38,255,0.3)] hover:scale-105 transition-all">GÜNCELLE</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const EditIcon = () => (
  <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
