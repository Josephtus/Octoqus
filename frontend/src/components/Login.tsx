import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '../utils/api';
import { loginSchema, type LoginFormData } from '../utils/validations';
import { Mail, Lock, ArrowLeft, ChevronRight, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setLoading(true);
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Giriş başarısız.");
      
      localStorage.setItem("token", result.access_token);
      onLoginSuccess();
      
    } catch (err: any) {
      console.error("Login hatası:", err);
      setServerError(err.message || "Giriş sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-slate-950 overflow-hidden">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#b026ff]/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#00f0ff]/5 blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[440px] relative z-10"
      >
        {/* Back Button */}
        <motion.button
          whileHover={{ x: -5 }}
          onClick={() => navigate('/')}
          className="group mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[#00f0ff]/50 transition-all">
            <ArrowLeft size={18} />
          </div>
          <span className="text-sm font-bold tracking-tight uppercase">Ana Sayfaya Dön</span>
        </motion.button>

        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
          {/* Header */}
          <div className="mb-10">
            <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">Hoş Geldiniz</h2>
            <p className="text-slate-400 text-sm">Octoqus hesabınızla oturum açın.</p>
          </div>

          <AnimatePresence mode="wait">
            {serverError && (
              <motion.div 
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
              >
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <AlertCircle size={16} className="text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="font-black uppercase tracking-widest text-[9px] mb-0.5">Giriş Hatası</p>
                  <p className="text-slate-300 font-medium leading-relaxed">{serverError}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Adresi</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00f0ff] transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  {...register('mail')}
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950/50 border transition-all ${
                    errors.mail || serverError ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#00f0ff]/50'
                  } text-white placeholder:text-slate-600 focus:outline-none focus:bg-slate-950`}
                  placeholder="isim@sirket.com"
                />
              </div>
              {errors.mail && (
                <p className="text-[10px] text-red-400 ml-1 font-bold">{errors.mail.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Şifre</label>
                <button 
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-[10px] font-black text-[#00f0ff] uppercase tracking-widest hover:underline"
                >
                  Şifremi Unuttum
                </button>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00f0ff] transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  {...register('password')}
                  className={`w-full pl-12 pr-12 py-4 rounded-2xl bg-slate-950/50 border transition-all ${
                    errors.password || serverError ? 'border-red-500/50 focus:border-red-500' : 'border-white/5 focus:border-[#00f0ff]/50'
                  } text-white placeholder:text-slate-600 focus:outline-none focus:bg-slate-950`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#00f0ff] transition-colors p-1"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={showPassword ? 'eye' : 'eye-off'}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </motion.div>
                  </AnimatePresence>
                </button>
              </div>
              {errors.password && (
                <p className="text-[10px] text-red-400 ml-1 font-bold">{errors.password.message}</p>
              )}
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="group w-full py-4 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-[#00f0ff] transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  Oturum Aç <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <p className="text-slate-400 text-sm mb-4">Henüz bir hesabınız yok mu?</p>
            <button 
              onClick={() => navigate('/register')}
              className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all"
            >
              Ücretsiz Kayıt Ol
            </button>
          </div>
        </div>
        
        <p className="text-center mt-8 text-slate-600 text-[10px] font-bold tracking-widest uppercase">&copy; 2026 OCTOQUS LABS</p>
      </motion.div>
    </div>
  );
};

