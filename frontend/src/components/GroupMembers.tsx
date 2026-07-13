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
  joined_at: string | null;
}

export const GroupMembers: React.FC = () => {
  const { activeGroup } = useGroupStore();
  const groupId = activeGroup?.id;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/groups/${groupId}/members`);
      const data = await res.json();
      setMembers(data.members?.filter((m: Member) => m.is_approved) || []);
    } catch (err) {
      console.error("Üyeler yüklenemedi", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [groupId]);

  if (!groupId) return null;

  if (loading) return <div className="text-[#00f0ff] animate-pulse p-10 text-center">Üyeler yükleniyor...</div>;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl">
        <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
          <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
          Grup Üyeleri ({members.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(member => (
            <div key={member.user_id} className="flex items-center gap-4 p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 hover:border-blue-500/30 transition-all group">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-lg border border-slate-700 group-hover:border-blue-500/50 transition-all">
                {member.name.charAt(0)}{member.surname.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-200 truncate">{member.name} {member.surname}</div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${member.role === 'GROUP_LEADER' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>
                    {member.role === 'GROUP_LEADER' ? 'Lider' : 'Üye'}
                  </span>
                  {member.joined_at && (
                    <span className="text-[9px] text-slate-600 font-medium">Katılım: {new Date(member.joined_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {members.length === 0 && <p className="text-slate-600 italic text-sm text-center py-4">Üye bulunmuyor.</p>}
      </div>
    </div>
  );
};
