import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../utils/api';
import { registerSchema, type RegisterFormData } from '../utils/validations';
import { User, Mail, Lock, Phone, Calendar, ArrowLeft, ChevronRight, AlertCircle, Sparkles } from 'lucide-react';

interface RegisterProps {
  onRegisterSuccess: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onRegisterSuccess }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    setLoading(true);
    
    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Kayıt başarısız.");
      }
      
      onRegisterSuccess();
      
    } catch (err: any) {
      console.error("Kayıt hatası:", err);
      setServerError(err.message || "Kayıt sırasında bir hata oluştu. Lütfen bilgilerinizi kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-slate-950 overflow-hidden py-20">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#00f0ff]/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#b026ff]/5 blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[560px] relative z-10"
      >
        {/* Back Button */}
        <motion.button
          whileHover={{ x: -5 }}
          onClick={() => navigate('/')}
          className="group mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[#b026ff]/50 transition-all">
            <ArrowLeft size={18} />
          </div>
          <span className="text-sm font-bold tracking-tight uppercase">Ana Sayfaya Dön</span>
        </motion.button>

        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          {/* Header */}
          <div className="mb-10 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#b026ff]/10 border border-[#b026ff]/20 text-[#b026ff] text-[10px] font-black uppercase tracking-widest mb-4">
              <Sparkles size={12} /> Aramıza Katılın
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tighter leading-none">Hesap Oluştur</h2>
            <p className="text-slate-400 text-sm">Finansal yolculuğunuza bugün başlayın.</p>
          </div>

          <AnimatePresence mode="wait">
            {serverError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3"
              >
                <AlertCircle size={16} />
                {serverError}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ad</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#b026ff] transition-colors">
                    <User size={18} />
                  </div>
                  <input 
                    type="text" 
                    {...register('name')}
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950/50 border transition-all ${
                      errors.name ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#b026ff]/50'
                    } text-white placeholder:text-slate-600 focus:outline-none focus:bg-slate-950`}
                    placeholder="Can"
                  />
                </div>
                {errors.name && <p className="text-[10px] text-red-400 ml-1 font-bold">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Soyad</label>
                <input 
                  type="text" 
                  {...register('surname')}
                  className={`w-full px-6 py-4 rounded-2xl bg-slate-950/50 border transition-all ${
                    errors.surname ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#b026ff]/50'
                  } text-white placeholder:text-slate-600 focus:outline-none focus:bg-slate-950`}
                  placeholder="Yılmaz"
                />
                {errors.surname && <p className="text-[10px] text-red-400 ml-1 font-bold">{errors.surname.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Doğum Tarihi</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <Calendar size={18} />
                </div>
                <input 
                  type="date" 
                  {...register('birthday')}
                  className={`w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-950/50 border transition-all ${
                    errors.birthday ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#b026ff]/50'
                  } text-white focus:outline-none focus:bg-slate-950 [color-scheme:dark]`}
                />
              </div>
              {errors.birthday ? (
                <p className="text-[10px] text-red-400 ml-1 font-bold">{errors.birthday.message}</p>
              ) : (
                <p className="text-[10px] text-slate-500 ml-1">Yaşınız bu tarihe göre otomatik hesaplanacaktır.</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Telefon Numarası</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#b026ff] transition-colors">
                  <Phone size={18} />
                </div>
                <input 
                  type="tel" 
                  {...register('phone_number')}
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950/50 border transition-all ${
                    errors.phone_number ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#b026ff]/50'
                  } text-white placeholder:text-slate-600 focus:outline-none focus:bg-slate-950`}
                  placeholder="+905551234567"
                />
              </div>
              {errors.phone_number && <p className="text-[10px] text-red-400 ml-1 font-bold">{errors.phone_number.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Adresi</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#b026ff] transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  {...register('mail')}
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950/50 border transition-all ${
                    errors.mail ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#b026ff]/50'
                  } text-white placeholder:text-slate-600 focus:outline-none focus:bg-slate-950`}
                  placeholder="isim@sirket.com"
                />
              </div>
              {errors.mail && <p className="text-[10px] text-red-400 ml-1 font-bold">{errors.mail.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Güçlü Bir Şifre</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#b026ff] transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  {...register('password')}
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950/50 border transition-all ${
                    errors.password ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#b026ff]/50'
                  } text-white placeholder:text-slate-600 focus:outline-none focus:bg-slate-950`}
                  placeholder="Min. 8 karakter"
                />
              </div>
              {errors.password && <p className="text-[10px] text-red-400 ml-1 font-bold">{errors.password.message}</p>}
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="group w-full py-5 bg-[#b026ff] text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-[#9d1fee] hover:shadow-[0_0_30px_rgba(176,38,255,0.3)] transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Hesabı Oluştur <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <p className="text-slate-400 text-sm mb-4">Zaten bir hesabınız var mı?</p>
            <button 
              onClick={() => navigate('/login')}
              className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all"
            >
              Giriş Yap
            </button>
          </div>
        </div>
        
        <p className="text-center mt-8 text-slate-600 text-[10px] font-bold tracking-widest uppercase">&copy; 2026 OCTOQUS LABS</p>
      </motion.div>
    </div>
  );
};
