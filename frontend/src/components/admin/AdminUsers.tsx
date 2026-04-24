import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../utils/api';
import { Pagination } from '../common/Pagination';

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

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const [viewingDetails, setViewingDetails] = useState<number | null>(null);
  const [details, setDetails] = useState<{
    user: AdminUser;
    messages: any[];
    memberships: any[];
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
    }
  }, [viewingDetails]);

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
                      <SortHeader label="ID" field="id" />
                      <SortHeader label="İsim" field="name" />
                      <SortHeader label="Soyisim" field="surname" />
                      <SortHeader label="Email" field="mail" />
                      <SortHeader label="Telefon" field="phone_number" />
                      <SortHeader label="Doğum Tarihi" field="birthday" />
                      <th className="py-4 px-3">Üyelikler</th>
                      <th className="py-4 px-3">Liderlik</th>
                      <SortHeader label="Rol" field="role" />
                      <SortHeader label="Durum" field="is_active" />
                      <th className="py-4 px-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="py-4 px-3 text-slate-500 font-mono text-xs">#{user.id}</td>
                        <td className="py-4 px-3 text-slate-100 font-bold text-xs">{user.name}</td>
                        <td className="py-4 px-3 text-slate-100 font-bold text-xs">{user.surname}</td>
                        <td className="py-4 px-3 text-slate-400 text-[11px] font-medium">{user.mail}</td>
                        <td className="py-4 px-3 text-slate-500 text-[11px]">{user.phone_number}</td>
                        <td className="py-4 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                          {user.birthday ? new Date(user.birthday).toLocaleDateString() : '-'}
                          {user.age ? <span className="ml-1 text-slate-600">({user.age} yaş)</span> : null}
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[120px]">
                            {user.joined_groups?.map(g => (
                              <span key={g.id} className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[9px] border border-slate-700">
                                {g.name}
                              </span>
                            )) || <span className="text-slate-600 text-[10px] italic">Yok</span>}
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[120px]">
                            {user.led_groups?.map(g => (
                              <span key={g.id} className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[9px] border border-purple-500/20">
                                {g.name}
                              </span>
                            )) || <span className="text-slate-600 text-[10px] italic">Yok</span>}
                          </div>
                        </td>
                        <td className="py-4 px-3">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded w-fit ${
                            user.role === 'ADMIN' ? 'bg-[#00f0ff]/10 text-[#00f0ff]' :
                            user.role === 'GROUP_LEADER' ? 'bg-purple-500/10 text-purple-400' :
                            'bg-slate-700 text-slate-400'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-4 px-3">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded w-fit ${
                            user.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {user.is_active ? 'AKTİF' : 'ENGELİ'}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button 
                              onClick={() => setViewingDetails(user.id)}
                              className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-[#00f0ff] hover:text-slate-950 transition-all"
                              title="Detaylar"
                            >
                              🔍
                            </button>
                            <button 
                              onClick={() => setEditingUser(user)}
                              className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-[#b026ff] hover:text-white transition-all"
                              title="Düzenle"
                            >
                              ✏️
                            </button>
                            {user.role !== 'ADMIN' && (
                              <button 
                                onClick={() => toggleUserStatus(user.id, user.is_active)}
                                className={`p-2 rounded-lg transition-all ${
                                  user.is_active 
                                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white' 
                                  : 'bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white'
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
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <div>
                <h4 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse"></span>
                  Kullanıcı Aktivite Detayları
                </h4>
                {details && <p className="text-slate-500 text-xs mt-1">{details.user.name} {details.user.surname} - #{details.user.id}</p>}
              </div>
              <button onClick={() => setViewingDetails(null)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00f0ff]"></div>
                  <p className="text-slate-500 animate-pulse text-sm">Veriler toplanıyor...</p>
                </div>
              ) : details && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="space-y-6">
                    <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                      <h5 className="text-xs font-black text-[#00f0ff] uppercase tracking-widest mb-4">Profil Bilgileri</h5>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold uppercase block">Kayıt Tarihi</label>
                          <div className="text-slate-200 text-sm font-bold">{new Date(details.user.created_at).toLocaleString()}</div>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold uppercase block">Son Durum</label>
                          <div className={`text-sm font-bold ${details.user.is_active ? 'text-green-400' : 'text-red-400'}`}>
                            {details.user.is_active ? 'Hesap Aktif' : 'Hesap Engelli'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                      <h5 className="text-xs font-black text-[#00f0ff] uppercase tracking-widest mb-4">Grup Üyelikleri</h5>
                      <div className="space-y-3">
                        {details.memberships.map((m: any) => (
                          <div key={m.group_id} className="flex justify-between items-center p-3 bg-slate-900 rounded-xl border border-slate-800">
                            <div>
                              <span className="text-slate-200 font-bold text-sm block">{m.group_name}</span>
                              <span className="text-[10px] text-slate-500">Katılım: {new Date(m.joined_at).toLocaleDateString()}</span>
                            </div>
                            <span className={`text-[9px] font-black px-2 py-1 rounded ${m.role === 'GROUP_LEADER' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400'}`}>
                              {m.role}
                            </span>
                          </div>
                        ))}
                        {details.memberships.length === 0 && <p className="text-slate-600 text-sm italic">Herhangi bir gruba üye değil.</p>}
                      </div>
                    </div>

                    <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                      <h5 className="text-xs font-black text-[#00f0ff] uppercase tracking-widest mb-4">Son Chat Mesajları</h5>
                      <div className="space-y-3">
                        {details.messages.map((msg: any) => (
                          <div key={msg.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                            <div className="flex justify-between mb-1">
                              <span className="text-[#00f0ff] font-bold text-[10px]">{msg.group_name}</span>
                              <span className="text-[9px] text-slate-600">{new Date(msg.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-300 text-xs italic">"{msg.message_text}"</p>
                          </div>
                        ))}
                        {details.messages.length === 0 && <p className="text-slate-600 text-sm italic">Henüz hiç mesaj göndermemiş.</p>}
                      </div>
                    </div>
                  </div>
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
