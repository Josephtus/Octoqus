import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { UserProfileModal } from './UserProfileModal';

interface UserProfile {
  id: number;
  name: string;
  surname: string;
  profile_photo: string | null;
}

export const SocialList: React.FC<{ currentUserId: number | null, activeGroupId: number | null }> = ({ currentUserId, activeGroupId }) => {
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const handleInvite = async (targetUserId: number) => {
    if (!activeGroupId) return;
    setMessage(null);
    try {
      const res = await apiFetch(`/groups/${activeGroupId}/invite/${targetUserId}`, { method: 'POST' });
      const data = await res.json();
      setMessage({ text: data.message, type: 'success' });
    } catch (err: any) {
      setMessage({ text: "Davet gönderilemedi. Kullanıcı zaten üye olabilir.", type: 'error' });
    }
  };

  const fetchSocialData = async () => {
    if (!currentUserId) return;
    try {
      setLoading(true);
      const [followersRes, followingRes] = await Promise.all([
        apiFetch(`/social/${currentUserId}/followers`),
        apiFetch(`/social/${currentUserId}/following`)
      ]);
      
      const followersData = await followersRes.json();
      const followingData = await followingRes.json();
      
      setFollowers(followersData.data);
      setFollowing(followingData.data);
    } catch (err) {
      console.error("Sosyal veriler çekilemedi", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSocialData();
  }, [currentUserId]);

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    try {
      setSearchLoading(true);
      const res = await apiFetch(`/users/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.data);
    } catch (err) {
      console.error("Arama yapılamadı", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFollow = async (id: number) => {
    setMessage(null);
    try {
      const response = await apiFetch(`/social/follow/${id}`, { method: 'POST' });
      const data = await response.json();
      setMessage({ text: data.message, type: 'success' });
      setSearchResults([]);
      setSearchQuery('');
      fetchSocialData();
    } catch (err: any) {
      setMessage({ text: "Takip işlemi başarısız.", type: 'error' });
    }
  };

  const handleUnfollow = async (id: number) => {
    try {
      await apiFetch(`/social/unfollow/${id}`, { method: 'DELETE' });
      fetchSocialData();
    } catch (err) {
      console.error("Takipten çıkılamadı", err);
    }
  };

  if (!currentUserId) return <p className="text-slate-400">Yükleniyor...</p>;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 animate-fade-in-up">
      {/* Search and Follow */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl drop-shadow-glow-blue relative overflow-hidden">
        <h3 className="text-xl font-bold text-slate-100 mb-4">Kişi Bul & Takip Et</h3>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="İsim veya e-posta ile ara..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all"
            />
            <button 
              onClick={handleSearch}
              disabled={searchLoading}
              className="bg-slate-800 text-[#00f0ff] border border-[#00f0ff]/50 px-6 py-2 rounded-xl font-bold hover:bg-[#00f0ff]/10 hover:border-[#00f0ff] transition-all shadow-lg hover:shadow-[#00f0ff]/20"
            >
              {searchLoading ? 'Aranıyor...' : 'Ara'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 border-t border-slate-800 pt-4">
              <h4 className="text-sm font-semibold text-slate-400 mb-3">Arama Sonuçları</h4>
              <div className="flex flex-col gap-2">
                {searchResults.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setSelectedUserId(user.id)}>
                      <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center group-hover:ring-2 group-hover:ring-[#00f0ff]/50 transition-all">
                        {user.profile_photo ? (
                          <img src={`http://localhost:8000${user.profile_photo}`} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-slate-400 text-xs font-bold">{user.name.charAt(0)}</span>
                        )}
                      </div>
                      <span className="text-slate-200 text-sm font-medium group-hover:text-[#00f0ff] transition-colors">{user.name} {user.surname}</span>
                    </div>
                    <div className="flex gap-3">
                      {activeGroupId && (
                        <button 
                          onClick={() => handleInvite(user.id)}
                          className="text-xs font-bold text-amber-500 hover:underline"
                        >
                          Gruba Davet Et
                        </button>
                      )}
                      <button 
                        onClick={() => handleFollow(user.id)}
                        className="text-xs font-bold text-[#00f0ff] hover:underline"
                      >
                        Takip Et
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm border ${message.type === 'error' ? 'bg-red-900/40 border-red-500/50 text-red-200' : 'bg-green-900/40 border-green-500/50 text-green-200'}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Following List */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <h3 className="text-lg font-bold text-slate-100 mb-4 border-b border-slate-800 pb-2">Takip Ettiklerim ({following.length})</h3>
          {loading ? (
            <p className="text-slate-500">Yükleniyor...</p>
          ) : following.length === 0 ? (
            <p className="text-slate-500 italic text-sm">Henüz kimseyi takip etmiyorsunuz.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {following.map(user => (
                <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors">
                  <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setSelectedUserId(user.id)}>
                    <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center group-hover:ring-2 group-hover:ring-[#00f0ff]/50 transition-all">
                      {user.profile_photo ? (
                        <img src={`http://localhost:8000${user.profile_photo}`} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-400 font-bold">{user.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-200 font-medium group-hover:text-[#00f0ff] transition-colors">{user.name} {user.surname}</p>
                      <p className="text-xs text-slate-500">ID: {user.id}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    {activeGroupId && (
                      <button 
                        onClick={() => handleInvite(user.id)}
                        className="text-xs font-bold text-amber-500 hover:underline"
                      >
                        Davet Et
                      </button>
                    )}
                    <button 
                      onClick={() => handleUnfollow(user.id)}
                      className="text-xs font-bold text-red-400 hover:text-red-300 hover:underline"
                    >
                      Takipten Çık
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Followers List */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <h3 className="text-lg font-bold text-slate-100 mb-4 border-b border-slate-800 pb-2">Takipçilerim ({followers.length})</h3>
          {loading ? (
            <p className="text-slate-500">Yükleniyor...</p>
          ) : followers.length === 0 ? (
            <p className="text-slate-500 italic text-sm">Henüz takipçiniz yok.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {followers.map(user => (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700 cursor-pointer group" onClick={() => setSelectedUserId(user.id)}>
                  <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center border border-[#b026ff]/30 group-hover:ring-2 group-hover:ring-[#00f0ff]/50 transition-all">
                    {user.profile_photo ? (
                      <img src={`http://localhost:8000${user.profile_photo}`} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-400 font-bold">{user.name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-200 font-medium group-hover:text-[#00f0ff] transition-colors">{user.name} {user.surname}</p>
                    <p className="text-xs text-[#b026ff]">ID: {user.id}</p>
                  </div>
                  <div className="flex-1 flex justify-end">
                    {activeGroupId && (
                      <button 
                        onClick={() => handleInvite(user.id)}
                        className="text-xs font-bold text-amber-500 hover:underline"
                      >
                        Davet Et
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {selectedUserId && (
        <UserProfileModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
};
