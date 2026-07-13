import React, { useEffect, useState } from 'react';
import { apiFetch, getImageUrl } from '../utils/api';

interface UserProfile {
  id: number;
  name: string;
  surname: string;
  profile_photo: string | null;
  age: number | null;
  role: string;
  created_at: string;
}

interface UserProfileModalProps {
  userId: number;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ userId, onClose }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiFetch(`/users/${userId}`);
        const data = await res.json();
        setProfile(data.user);
      } catch (err) {
        console.error("Profil yüklenemedi", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="text-[#00f0ff] animate-pulse font-bold text-xl">Profil Yükleniyor...</div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header / Cover */}
        <div className="h-24 bg-gradient-to-r from-[#00f0ff]/20 to-[#b026ff]/20 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-950/50 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-8 -mt-12 flex flex-col items-center">
          <div className="w-24 h-24 rounded-3xl bg-slate-800 border-4 border-slate-900 overflow-hidden shadow-xl mb-4">
            {profile.profile_photo ? (
              <img src={getImageUrl(profile.profile_photo) || ''} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-black text-slate-600">
                {profile.name.charAt(0)}
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">
            {profile.name} {profile.surname}
          </h2>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[10px] bg-[#00f0ff]/10 text-[#00f0ff] px-2 py-0.5 rounded font-black uppercase tracking-widest border border-[#00f0ff]/20">
              {profile.role}
            </span>
            {profile.age && (
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold uppercase tracking-widest border border-slate-700">
                {profile.age} Yaşında
              </span>
            )}
          </div>

          {/* Stats / Details */}
          <div className="w-full grid grid-cols-1 gap-3">
             <div className="bg-slate-950/50 border border-slate-800/50 p-4 rounded-2xl">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Katılım Tarihi</div>
                <div className="text-sm text-slate-200 font-medium">
                  {new Date(profile.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
             </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full mt-8 py-3 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
