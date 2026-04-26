import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch, getImageUrl } from '../utils/api';
import { Search, UserPlus, UserMinus, X, Calendar, Mail, User as UserIcon } from 'lucide-react';
import { Pagination } from './common/Pagination';
import { useAuthStore } from '../store/authStore';

export const SocialList: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const currentUserId = currentUser?.id;
  
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [followingIds, setFollowingIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const limit = 6;

  const fetchSocialData = async () => {
    if (!search.trim()) {
      setUsers([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [usersRes, meRes] = await Promise.all([
        apiFetch(`/users/search?q=${encodeURIComponent(search)}&page=${page}&limit=${limit}`),
        apiFetch('/auth/me')
      ]);
      const usersData = await usersRes.json();
      const meData = await meRes.json();
      
      setUsers(usersData.data || []);
      setTotalCount(usersData.total_count || 0);
      
      if (meData.user?.following) {
        setFollowingIds(meData.user.following.map((f: any) => f.id));
      }
    } catch (err) {
      console.error("Sosyal veri çekme hatası:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchSocialData();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, page]);

  const toggleFollow = async (targetId: number, isFollowing: boolean) => {
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const endpoint = isFollowing ? `/social/unfollow/${targetId}` : `/social/follow/${targetId}`;
      await apiFetch(endpoint, { method });
      setFollowingIds(prev => 
        isFollowing ? prev.filter(id => id !== targetId) : [...prev, targetId]
      );
    } catch (err) {
      console.error("Takip hatası:", err);
    }
  };

  if (!currentUserId) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-8 rounded-[40px] shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter">Sosyal Ağ</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Octoqus kullanıcıları ile bağlantı kur</p>
          </div>
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00f0ff] transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="İsim veya e-posta ile ara..."
              className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-950/50 border border-white/5 text-white focus:outline-none focus:border-[#00f0ff]/50 transition-all"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-6 md:p-10 shadow-2xl min-h-[600px] flex flex-col">
        {loading && users.length === 0 ? (
          <div className="flex-1 flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {search.trim() ? (
                <>
                  {users.filter(u => u.id !== currentUserId).map((user, index) => {
                    const isFollowing = followingIds.includes(user.id);
                    return (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.03 }}
                        className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-[#00f0ff]/30 transition-all group"
                      >
                        <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => setSelectedUser(user)}>
                          <div className="w-12 h-12 rounded-xl bg-slate-800 overflow-hidden border border-white/10 shadow-lg">
                            {user.profile_photo ? (
                              <img src={getImageUrl(user.profile_photo) || ''} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">👤</div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-white tracking-tight">{user.name} {user.surname}</h4>
                            <div className="flex items-center gap-2">
                              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{user.mail}</p>
                              {user.age && <span className="text-[9px] text-[#00f0ff] font-black">{user.age} Yaş</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => toggleFollow(user.id, isFollowing)}
                            className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                              isFollowing 
                                ? 'bg-white/5 text-white border border-white/10 hover:bg-red-500/10 hover:text-red-500' 
                                : 'bg-[#00f0ff] text-slate-950 shadow-lg shadow-[#00f0ff]/20 hover:scale-105'
                            }`}
                          >
                            {isFollowing ? <><UserMinus size={14} /> Takipten Çık</> : <><UserPlus size={14} /> Takip Et</>}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                  {users.length === 0 && !loading && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-600">
                      <UserIcon size={48} className="mb-4 opacity-10" />
                      <p className="text-sm font-black uppercase tracking-widest opacity-30">Kullanıcı Bulunamadı</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-600">
                  <Search size={48} className="mb-4 opacity-10" />
                  <p className="text-sm font-black uppercase tracking-widest opacity-30">Arama yapmak için bir şeyler yazın</p>
                </div>
              )}
            </AnimatePresence>
            
            {search.trim() && totalCount > limit && (
              <div className="mt-auto pt-8">
                <Pagination 
                  currentPage={page}
                  totalCount={totalCount}
                  limit={limit}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#00f0ff]/5 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none" />
              
              <button 
                onClick={() => setSelectedUser(null)}
                className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white z-10"
              >
                <X size={20} />
              </button>

              <div className="p-10 pt-16 flex flex-col items-center text-center relative z-0">
                <div className="w-32 h-32 rounded-[40px] bg-slate-800 border-4 border-white/10 overflow-hidden shadow-2xl mb-8">
                  {selectedUser.profile_photo ? (
                    <img src={getImageUrl(selectedUser.profile_photo) || ''} alt={selectedUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>
                  )}
                </div>
                
                <h3 className="text-3xl font-black text-white tracking-tighter mb-2">
                  {selectedUser.name} {selectedUser.surname}
                </h3>
                
                <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">
                    <Mail size={12} className="text-[#00f0ff]" />
                    {selectedUser.mail}
                  </div>
                  {selectedUser.age && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">
                      <Calendar size={12} className="text-[#00f0ff]" />
                      {selectedUser.age} Yaşında
                    </div>
                  )}
                </div>

                <div className="w-full">
                  <button 
                    onClick={() => toggleFollow(selectedUser.id, followingIds.includes(selectedUser.id))}
                    className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
                      followingIds.includes(selectedUser.id)
                        ? 'bg-white/5 text-white border border-white/10 hover:bg-red-500/10 hover:text-red-500'
                        : 'bg-[#00f0ff] text-slate-950 shadow-xl shadow-[#00f0ff]/20 hover:scale-[1.02] active:scale-95'
                    }`}
                  >
                    {followingIds.includes(selectedUser.id) ? <><UserMinus size={18} /> Takipten Çık</> : <><UserPlus size={18} /> Takip Et</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
