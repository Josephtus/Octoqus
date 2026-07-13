import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { useGroupStore } from '../store/groupStore';

interface Member {
  user_id: number;
  name: string;
  surname: string;
  mail: string;
  role: 'GROUP_LEADER' | 'USER';
  is_approved: boolean;
}

interface BannedUser {
  user_id: number;
  name: string;
  surname: string;
  mail: string;
  banned_at: string;
}

interface GroupInfo {
  name: string;
  content: string;
  invite_code: string;
}

export const GroupManagement: React.FC = () => {
  const { activeGroup, triggerRefresh } = useGroupStore();
  const groupId = activeGroup?.id;

  const [members, setMembers] = useState<Member[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupInfo, setGroupInfo] = useState<GroupInfo>({ name: '', content: '', invite_code: '' });
  const [updateLoading, setUpdateLoading] = useState(false);

  const fetchMembers = async () => {
    if (!groupId) return;
    try {
      const res = await apiFetch(`/groups/${groupId}/members`);
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error("Üyeler yüklenemedi", err);
    }
  };

  const fetchGroupInfo = async () => {
    if (!groupId) return;
    try {
      const res = await apiFetch(`/groups/${groupId}`);
      const data = await res.json();
      setGroupInfo({ 
        name: data.group.name, 
        content: data.group.content || '', 
        invite_code: data.group.invite_code 
      });
    } catch (err) {
      console.error("Grup bilgileri yüklenemedi", err);
    }
  };

  const fetchBans = async () => {
    if (!groupId) return;
    try {
      const res = await apiFetch(`/groups/${groupId}/bans`);
      const data = await res.json();
      setBannedUsers(data.bans || []);
    } catch (err) {
      console.error("Banlı kullanıcılar yüklenemedi", err);
    }
  };

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    Promise.all([fetchMembers(), fetchGroupInfo(), fetchBans()]).finally(() => setLoading(false));
  }, [groupId]);

  const handleApprove = async (userId: number) => {
    if (!groupId) return;
    try {
      await apiFetch(`/groups/${groupId}/approve/${userId}`, { method: 'POST' });
      fetchMembers();
      triggerRefresh();
    } catch (err) {
      alert("Onaylama başarısız");
    }
  };

  const handleReject = async (userId: number) => {
    if (!groupId) return;
    if (!window.confirm("Bu isteği reddetmek istediğinize emin misiniz?")) return;
    try {
      await apiFetch(`/groups/${groupId}/requests/${userId}`, { method: 'DELETE' });
      fetchMembers();
    } catch (err) {
      alert("Reddetme başarısız");
    }
  };

  const handleKick = async (userId: number) => {
    if (!groupId) return;
    if (!window.confirm("Bu üyeyi gruptan atmak istediğinize emin misiniz?")) return;
    try {
      await apiFetch(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
      fetchMembers();
      triggerRefresh();
    } catch (err) {
      alert("İşlem başarısız");
    }
  };

  const handleBan = async (userId: number) => {
    if (!groupId) return;
    if (!window.confirm("Bu üyeyi banlamak istediğinize emin misiniz? Bir daha katılamayacaktır.")) return;
    try {
      await apiFetch(`/groups/${groupId}/ban/${userId}`, { method: 'POST' });
      fetchMembers();
      triggerRefresh();
    } catch (err) {
      alert("Banlama başarısız");
    }
  };

  const handleTransfer = async (userId: number) => {
    if (!groupId) return;
    if (!window.confirm("Liderliği bu üyeye devretmek istediğinize emin misiniz? Bu işlemden sonra yönetici yetkinizi kaybedeceksiniz.")) return;
    try {
      await apiFetch(`/groups/${groupId}/transfer_leadership/${userId}`, { method: 'POST' });
      triggerRefresh();
      window.location.reload(); 
    } catch (err) {
      alert("Devir başarısız");
    }
  };

  const handleUnban = async (userId: number) => {
    if (!groupId) return;
    try {
      await apiFetch(`/groups/${groupId}/ban/${userId}`, { method: 'DELETE' });
      fetchBans();
    } catch (err) {
      alert("Ban kaldırılamadı");
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(groupInfo.invite_code);
    alert("Davet kodu kopyalandı!");
  };

  const handleRegenerateCode = async () => {
    if (!groupId) return;
    if (!window.confirm("Davet kodunu yenilemek istediğinize emin misiniz? Eski kod artık çalışmayacaktır.")) return;
    
    try {
      const res = await apiFetch(`/groups/${groupId}/regenerate-code`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setGroupInfo({ ...groupInfo, invite_code: data.invite_code });
        alert("Davet kodu yenilendi!");
      } else {
        alert(data.message || "İşlem başarısız.");
      }
    } catch (err) {
      alert("Bir hata oluştu.");
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    if (!groupId) return;
    e.preventDefault();
    setUpdateLoading(true);
    try {
      await apiFetch(`/groups/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify(groupInfo)
      });
      alert("Grup bilgileri güncellendi");
      triggerRefresh();
    } catch (err) {
      alert("Güncelleme başarısız");
    } finally {
      setUpdateLoading(false);
    }
  };

  if (!groupId) return null;

  if (loading) return <div className="text-[#00f0ff] animate-pulse p-10 text-center">Yükleniyor...</div>;

  const pendingRequests = members.filter(m => !m.is_approved);
  const activeMembers = members.filter(m => m.is_approved);

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20 animate-fade-in">
      <section className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f0ff]/5 blur-2xl rounded-full pointer-events-none" />
        <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
          <span className="w-2 h-8 bg-[#00f0ff] rounded-full"></span>
          Grup Davet Kodu
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800">
          <div className="flex-1">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Aktif Davet Kodu</p>
            <p className="text-2xl font-mono font-black text-[#00f0ff] tracking-widest">{groupInfo.invite_code}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={handleCopyCode}
              className="flex-1 sm:flex-none px-6 py-3 bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[#00f0ff] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#00f0ff]/20 transition-all active:scale-95"
            >
              KODU KOPYALA
            </button>
            <button 
              onClick={handleRegenerateCode}
              className="flex-1 sm:flex-none px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
            >
              YENİ KOD ÜRET
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-4 italic">
          * Bu kodu gruptan birileriyle paylaşarak katılmalarını sağlayabilirsiniz. Yeni kod ürettiğinizde eski kod geçersiz kalır.
        </p>
      </section>

      <section className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl">
        <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
          <span className="w-2 h-8 bg-[#b026ff] rounded-full"></span>
          Grup Bilgilerini Güncelle
        </h3>
        <form onSubmit={handleUpdateGroup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Grup Adı</label>
            <input 
              type="text" 
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-[#b026ff] outline-none transition-all"
              value={groupInfo.name}
              onChange={(e) => setGroupInfo({...groupInfo, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Açıklama</label>
            <textarea 
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-[#b026ff] outline-none transition-all resize-none"
              value={groupInfo.content}
              onChange={(e) => setGroupInfo({...groupInfo, content: e.target.value})}
            />
          </div>
          <button 
            type="submit" 
            disabled={updateLoading}
            className="bg-[#b026ff] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#c455ff] transition-all shadow-lg disabled:opacity-50"
          >
            {updateLoading ? 'Güncelleniyor...' : 'Kaydet'}
          </button>
        </form>
      </section>

      <section className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl">
        <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
          <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
          Katılım İstekleri ({pendingRequests.length})
        </h3>
        <div className="space-y-3">
          {pendingRequests.map(req => (
            <div key={req.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
              <div>
                <div className="font-bold text-slate-200">{req.name} {req.surname}</div>
                <div className="text-xs text-slate-500">{req.mail}</div>
              </div>
              <div className="flex gap-2 mt-3 sm:mt-0">
                <button onClick={() => handleApprove(req.user_id)} className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-500 hover:text-white transition-all">Onayla</button>
                <button onClick={() => handleReject(req.user_id)} className="bg-red-500/10 text-red-500 border border-red-500/30 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all">Reddet</button>
              </div>
            </div>
          ))}
          {pendingRequests.length === 0 && <p className="text-slate-600 italic text-sm text-center py-4">Bekleyen istek bulunmuyor.</p>}
        </div>
      </section>

      <section className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl">
        <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
          <span className="w-2 h-8 bg-[#00f0ff] rounded-full"></span>
          Üye Yönetimi ({activeMembers.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-800">
                <th className="pb-4 px-2">Üye</th>
                <th className="pb-4 px-2">Rol</th>
                <th className="pb-4 px-2 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {activeMembers.map(member => (
                <tr key={member.user_id} className="group">
                  <td className="py-4 px-2">
                    <div className="font-bold text-slate-200">{member.name} {member.surname}</div>
                    <div className="text-[10px] text-slate-500">{member.mail}</div>
                  </td>
                  <td className="py-4 px-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${member.role === 'GROUP_LEADER' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>
                      {member.role === 'GROUP_LEADER' ? 'Lider' : 'Üye'}
                    </span>
                  </td>
                  <td className="py-4 px-2 text-right">
                    {member.role !== 'GROUP_LEADER' && (
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleTransfer(member.user_id)} title="Liderliği Devret" className="p-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-white transition-all text-xs">👑</button>
                        <button onClick={() => handleKick(member.user_id)} title="Gruptan At" className="p-2 bg-orange-500/10 text-orange-500 rounded-lg hover:bg-orange-500 hover:text-white transition-all text-xs">🚪</button>
                        <button onClick={() => handleBan(member.user_id)} title="Banla" className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all text-xs">🚫</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl">
        <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
          <span className="w-2 h-8 bg-red-600 rounded-full"></span>
          Banlı Kullanıcılar ({bannedUsers.length})
        </h3>
        <div className="space-y-3">
          {bannedUsers.map(user => (
            <div key={user.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
              <div>
                <div className="font-bold text-slate-200">{user.name} {user.surname}</div>
                <div className="text-[10px] text-slate-500">{user.mail}</div>
                <div className="text-[10px] text-slate-400 mt-1">Ban Tarihi: {new Date(user.banned_at).toLocaleDateString()}</div>
              </div>
              <button 
                onClick={() => handleUnban(user.user_id)} 
                className="mt-3 sm:mt-0 bg-red-500/10 text-red-500 border border-red-500/30 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
              >
                Banı Kaldır
              </button>
            </div>
          ))}
          {bannedUsers.length === 0 && <p className="text-slate-600 italic text-sm text-center py-4">Banlı kullanıcı bulunmuyor.</p>}
        </div>
      </section>
    </div>
  );
};
