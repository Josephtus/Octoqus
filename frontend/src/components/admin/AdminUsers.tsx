import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';

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
  const [viewingDetails, setViewingDetails] = useState<number | null>(null);
  const [details, setDetails] = useState<{
    user: AdminUser;
    messages: any[];
    memberships: any[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const fetchUsers = async (query: string = '') => {
    try {
      setLoading(true);
      const res = await apiFetch(`/admin/users?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Kullanıcılar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      fetchUsers(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await apiFetch(`/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !currentStatus })
      });
      fetchUsers(searchTerm);
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
      fetchUsers(searchTerm);
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
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00f0ff]"></div>
        </div>
      ) : (
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-widest font-black">
                  <th className="py-4 px-4">ID</th>
                  <th className="py-4 px-4">Kullanıcı & İletişim</th>
                  <th className="py-4 px-4">Doğum Tarihi</th>
                  <th className="py-4 px-4">Üyelikler</th>
                  <th className="py-4 px-4">Liderlik</th>
                  <th className="py-4 px-4">Rol / Durum</th>
                  <th className="py-4 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="py-4 px-4 text-slate-500 font-mono text-xs">#{user.id}</td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-200">{user.name} {user.surname}</div>
                      <div className="text-[11px] text-[#00f0ff] font-medium mt-0.5">{user.mail}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{user.phone_number}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-xs text-slate-300 font-bold">{user.birthday ? new Date(user.birthday).toLocaleDateString() : '-'}</div>
                      <div className="text-[10px] text-slate-500">{user.age} Yaşında</div>
                    </td>
                    <td className="py-4 px-4">
                      {user.joined_groups && user.joined_groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {user.joined_groups.map(g => (
                            <span key={g.id} className="bg-blue-500/10 text-blue-400 text-[9px] px-1.5 py-0.5 rounded border border-blue-500/20" title={g.name}>
                              {g.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[10px] italic">Yok</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {user.led_groups && user.led_groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {user.led_groups.map(g => (
                            <span key={g.id} className="bg-amber-500/10 text-amber-400 text-[9px] px-1.5 py-0.5 rounded border border-amber-500/20" title={g.name}>
                              {g.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[10px] italic">Yok</span>
                      )}
                    </td>
                    <td className="py-4 px-4 space-y-2">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          user.role?.toLowerCase() === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`}></span>
                        <span className="text-[10px] text-slate-400">{user.is_active ? 'Aktif' : 'Engelli'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setViewingDetails(user.id)}
                          className="text-[10px] font-bold bg-slate-800 text-[#00f0ff] px-3 py-1.5 rounded-lg hover:bg-[#00f0ff]/20"
                        >
                          Detaylar
                        </button>
                        <button 
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                            user.is_active ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white' : 'bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white'
                          }`}
                        >
                          {user.is_active ? 'Engelle' : 'Kaldır'}
                        </button>
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="text-[10px] font-bold bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-700"
                        >
                          Düzenle
                        </button>
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
        </div>
      )}

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
                  {/* Sol Kolon: Temel Bilgiler */}
                  <div className="space-y-6">
                    <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                      <h5 className="text-xs font-black text-[#00f0ff] uppercase tracking-widest mb-4">Profil Bilgileri</h5>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold uppercase block">Kayıt Tarihi</label>
                          <div className="text-slate-200 text-sm font-bold">{new Date(details.user.created_at).toLocaleString()}</div>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold uppercase block">İletişim</label>
                          <div className="text-slate-200 text-sm">{details.user.mail}</div>
                          <div className="text-slate-400 text-xs mt-1">{details.user.phone_number}</div>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold uppercase block">Doğum Tarihi / Yaş</label>
                          <div className="text-slate-200 text-sm">{new Date(details.user.birthday!).toLocaleDateString()} ({details.user.age} yaşında)</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                      <h5 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">Grup Üyelikleri</h5>
                      <div className="space-y-3">
                        {details.memberships.map((m: any) => (
                          <div key={m.group_id} className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-sm font-bold text-slate-200">{m.group_name}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${m.role === 'GROUP_LEADER' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>{m.role}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">Katılım: {new Date(m.joined_at).toLocaleDateString()}</div>
                          </div>
                        ))}
                        {details.memberships.length === 0 && <p className="text-slate-600 text-xs italic">Herhangi bir gruba üye değil.</p>}
                      </div>
                    </div>
                  </div>

                  {/* Sağ Kolon: Chat Geçmişi */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 flex flex-col h-[500px]">
                      <h5 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-4">Sohbet Geçmişi ({details.messages.length})</h5>
                      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        {details.messages.map((msg: any) => (
                          <div key={msg.id} className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 relative group">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] text-[#00f0ff] font-bold">{msg.group_name}</span>
                              <span className="text-[9px] text-slate-600">{new Date(msg.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-slate-300 leading-relaxed italic">"{msg.message_text}"</p>
                            {msg.is_deleted && <span className="absolute top-2 right-2 bg-red-500/20 text-red-500 text-[8px] px-1 rounded">SİLİNDİ</span>}
                          </div>
                        ))}
                        {details.messages.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-full text-slate-600">
                            <svg className="w-12 h-12 opacity-20 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            <p className="text-sm italic">Henüz hiç mesaj gönderilmemiş.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-slate-800/30 border-t border-slate-800 flex justify-end">
              <button onClick={() => setViewingDetails(null)} className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all">Kapat</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h4 className="text-xl font-bold text-slate-100">Kullanıcıyı Düzenle</h4>
              <button onClick={() => setEditingUser(null)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ad</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-[#00f0ff] outline-none"
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Soyad</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-[#00f0ff] outline-none"
                  value={editingUser.surname || ''}
                  onChange={(e) => setEditingUser({...editingUser, surname: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefon</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-[#00f0ff] outline-none"
                  value={editingUser.phone_number || ''}
                  onChange={(e) => setEditingUser({...editingUser, phone_number: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Yaş</label>
                <input 
                  type="number" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-[#00f0ff] outline-none"
                  value={editingUser.age || ''}
                  onChange={(e) => setEditingUser({...editingUser, age: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Doğum Tarihi</label>
                <input 
                  type="date" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-[#00f0ff] outline-none"
                  value={editingUser.birthday || ''}
                  onChange={(e) => setEditingUser({...editingUser, birthday: e.target.value})}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="submit"
                  className="flex-1 bg-[#00f0ff] text-slate-950 font-bold py-2 rounded-xl hover:shadow-[0_0_15px_#00f0ff] transition-all"
                >
                  Kaydet
                </button>
                <button 
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 bg-slate-800 text-slate-300 font-bold py-2 rounded-xl hover:bg-slate-700"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
