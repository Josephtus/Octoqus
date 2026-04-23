import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';

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
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/admin/users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Kullanıcılar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await apiFetch(`/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !currentStatus })
      });
      fetchUsers();
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
      fetchUsers();
    } catch (err) {
      alert("Güncelleme başarısız");
    }
  };

  const filteredUsers = (users || []).filter(u => 
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.mail || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-slate-100">Kullanıcı Yönetimi</h3>
        <input 
          type="text" 
          placeholder="Kullanıcı ara (Ad veya Email)..."
          className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm w-64 focus:border-[#00f0ff] outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="animate-pulse text-[#00f0ff]">Yükleniyor...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-4 px-2">ID</th>
                <th className="py-4 px-2">Kullanıcı</th>
                <th className="py-4 px-2">İletişim</th>
                <th className="py-4 px-2">Rol</th>
                <th className="py-4 px-2">Durum</th>
                <th className="py-4 px-2 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-2 text-slate-500 font-mono text-xs">#{user.id}</td>
                  <td className="py-4 px-2">
                    <div className="font-bold text-slate-200">{user.name} {user.surname}</div>
                    <div className="text-xs text-slate-500">{user.mail}</div>
                  </td>
                  <td className="py-4 px-2 text-sm text-slate-400">{user.phone_number}</td>
                  <td className="py-4 px-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                      user.role?.toLowerCase() === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-4 px-2">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${user.is_active ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`}></span>
                  </td>
                  <td className="py-4 px-2 text-right space-x-2">
                    <button 
                      onClick={() => toggleUserStatus(user.id, user.is_active)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                        user.is_active ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white' : 'bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white'
                      }`}
                    >
                      {user.is_active ? 'Engelle' : 'Engeli Kaldır'}
                    </button>
                    <button 
                      onClick={() => setEditingUser(user)}
                      className="text-xs font-bold bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-700"
                    >
                      Düzenle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
