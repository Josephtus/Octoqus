import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Wallet, Users, BarChart3, ArrowRight, CheckCircle2, TrendingUp, PieChart, Bell } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.9]);
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -50]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0, filter: "blur(10px)" },
    visible: {
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: { duration: 1, ease: [0.16, 1, 0.3, 1] as any },
    },
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-white selection:bg-[#b026ff]/30 overflow-x-hidden">
      {/* Header */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] as any }}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-6"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40">
            OCTOQUS
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Özellikler</a>
            <a href="#" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Fiyatlandırma</a>
            <a href="#" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Topluluk</a>
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 text-sm font-bold text-white/80 hover:text-white transition-colors"
            >
              Giriş Yap
            </button>
            <button 
              onClick={() => navigate('/register')}
              className="px-6 py-2.5 text-sm font-bold bg-white text-black rounded-xl hover:bg-[#00f0ff] hover:text-black transition-all"
            >
              Kayıt Ol
            </button>
          </div>
        </div>
      </motion.header>

      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-[#b026ff]/15 to-transparent blur-[120px]"
          animate={{
            x: [0, 50, 0],
            y: [0, 80, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tl from-[#00f0ff]/10 to-transparent blur-[120px]"
          animate={{
            x: [0, -60, 0],
            y: [0, -40, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Subtle Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-20">
        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-6xl w-full text-center relative z-10"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-10 backdrop-blur-xl">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f0ff] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00f0ff]"></span>
            </span>
            <span className="text-[10px] font-bold tracking-[0.2em] text-slate-300 uppercase">Geleceğin Finans Yönetimi</span>
          </motion.div>

          <motion.h1 
            variants={itemVariants}
            className="text-6xl md:text-9xl font-black mb-8 tracking-tighter leading-[0.9]"
          >
            Harcamalarını <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b026ff] via-[#704dff] to-[#00f0ff] filter drop-shadow-[0_0_20px_rgba(176,38,255,0.4)]">
              Octoqus
            </span> <br />
            ile Sanata Dönüştür
          </motion.h1>

          <motion.p 
            variants={itemVariants}
            className="text-slate-400 text-lg md:text-2xl max-w-3xl mx-auto mb-14 leading-relaxed font-light"
          >
            Karmaşayı düzene sokun. Octoqus ile bütçenizi yönetmek sadece bir takip değil, 
            bir yaşam tarzı haline gelir. Profesyoneller için tasarlandı.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <button
              onClick={() => navigate('/register')}
              className="group relative px-10 py-5 bg-white text-black font-black rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#b026ff] to-[#00f0ff] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="relative flex items-center gap-3 group-hover:text-white transition-colors duration-300">
                Şimdi Keşfet <ArrowRight size={22} className="group-hover:translate-x-2 transition-transform duration-300" />
              </span>
            </button>
            
            <button className="group px-8 py-5 text-white/70 font-bold hover:text-white transition-colors flex items-center gap-2">
              Nasıl Çalışır?
              <span className="w-10 h-[1px] bg-white/20 group-hover:w-16 group-hover:bg-[#00f0ff] transition-all duration-500" />
            </button>
          </motion.div>
        </motion.div>

        {/* Floating App Mockups */}
        <div className="absolute inset-0 pointer-events-none z-0 hidden lg:block">
          <FloatingElement 
            delay={0.5} 
            initialPos={{ top: '20%', left: '10%' }}
            className="w-64 p-6 rounded-3xl bg-slate-900/40 border border-white/10 backdrop-blur-2xl"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-2 bg-[#b026ff]/20 rounded-lg"><TrendingUp size={20} className="text-[#b026ff]" /></div>
              <div className="text-sm font-bold">Aylık Tasarruf</div>
            </div>
            <div className="text-2xl font-black text-[#00f0ff]">+₺4,250.00</div>
          </FloatingElement>

          <FloatingElement 
            delay={1} 
            initialPos={{ top: '60%', right: '8%' }}
            className="w-72 p-6 rounded-3xl bg-slate-900/40 border border-white/10 backdrop-blur-2xl"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm font-bold">Grup Harcaması</div>
              <Bell size={16} className="text-slate-500" />
            </div>
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-700" />
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: i === 1 ? '70%' : '40%' }}
                      transition={{ duration: 2, delay: 2 }}
                      className="h-full bg-gradient-to-r from-[#b026ff] to-[#00f0ff]" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </FloatingElement>

          <FloatingElement 
            delay={1.5} 
            initialPos={{ bottom: '15%', left: '15%' }}
            className="w-56 p-6 rounded-3xl bg-slate-900/40 border border-white/10 backdrop-blur-2xl"
          >
            <div className="flex items-center gap-3 mb-2">
              <PieChart size={20} className="text-[#00f0ff]" />
              <div className="text-xs font-bold text-slate-400">Kategoriler</div>
            </div>
            <div className="text-xl font-bold italic">Market & Gıda</div>
          </FloatingElement>
        </div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
        >
          <div className="w-[1px] h-20 bg-gradient-to-b from-transparent via-white/30 to-transparent relative overflow-hidden">
            <motion.div 
              animate={{ y: [0, 80] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-transparent to-[#00f0ff]"
            />
          </div>
          <span className="text-[10px] text-slate-500 uppercase tracking-[0.5em] font-black">Keşfet</span>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative py-48 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-24"
          >
            <h2 className="text-4xl md:text-6xl font-black mb-6">Neden Octoqus?</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-[#b026ff] to-[#00f0ff] mx-auto rounded-full" />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <FeatureCard 
              icon={<Wallet className="text-[#b026ff]" size={40} />}
              title="Akıllı Cüzdan"
              description="Tüm hesaplarınızı tek bir noktadan yönetin. Harcamalarınızı yapay zeka ile otomatik kategorize edin."
              delay={0.1}
            />
            <FeatureCard 
              icon={<Users className="text-[#704dff]" size={40} />}
              title="Kusursuz Bölüşüm"
              description="Arkadaş gruplarınızla 'kim kime ne kadar borçlu?' derdine son verin. Saniyeler içinde settle edin."
              delay={0.2}
            />
            <FeatureCard 
              icon={<BarChart3 className="text-[#00f0ff]" size={40} />}
              title="Derin Analizler"
              description="Sadece rakamları değil, hikayeyi görün. Harcama alışkanlıklarınızı profesyonel grafiklerle inceleyin."
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* Premium CTA */}
      <section className="relative py-40 px-4 overflow-hidden">
        <div className="max-w-5xl mx-auto relative">
          <motion.div 
            whileInView={{ scale: [0.95, 1], opacity: [0, 1] }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="relative p-1 bg-gradient-to-br from-[#b026ff]/30 via-white/5 to-[#00f0ff]/30 rounded-[40px] overflow-hidden"
          >
            <div className="relative p-12 md:p-20 bg-slate-900/90 rounded-[39px] backdrop-blur-3xl text-center overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(176,38,255,0.15),transparent)]" />
              
              <h2 className="text-4xl md:text-7xl font-black mb-8 leading-tight">
                Finansal özgürlüğe <br />bir adım kaldı.
              </h2>
              
              <button 
                onClick={() => navigate('/register')}
                className="px-12 py-6 bg-[#b026ff] hover:bg-[#9d1fee] text-white font-black rounded-2xl transition-all hover:shadow-[0_0_50px_rgba(176,38,255,0.6)] hover:scale-105 active:scale-95"
              >
                ÜCRETSİZ BAŞLA
              </button>
              
              <div className="mt-16 flex flex-wrap justify-center gap-10 opacity-60">
                <FeatureItem text="Kredi Kartı Yok" />
                <FeatureItem text="Sınırsız Veri" />
                <FeatureItem text="Bulut Yedekleme" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 bg-black/50 text-center">
        <div className="text-2xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40">OCTOQUS</div>
        <div className="flex justify-center gap-8 text-slate-500 text-sm mb-12">
          <a href="#" className="hover:text-white transition-colors">Gizlilik</a>
          <a href="#" className="hover:text-white transition-colors">Şartlar</a>
          <a href="#" className="hover:text-white transition-colors">İletişim</a>
        </div>
        <p className="text-slate-600 text-[10px] font-bold tracking-widest uppercase">&copy; 2026 OCTOQUS LABS. BY GMD TEAM.</p>
      </footer>
    </div>
  );
};

const FloatingElement = ({ children, delay, initialPos, className }: { children: React.ReactNode, delay: number, initialPos: React.CSSProperties, className: string }) => (
  <motion.div
    initial={{ opacity: 0, ...initialPos as any }}
    animate={{ 
      opacity: 1,
      y: [0, -20, 0],
      rotate: [0, 2, 0],
    }}
    transition={{ 
      opacity: { duration: 1, delay },
      y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay },
      rotate: { duration: 8, repeat: Infinity, ease: "easeInOut", delay }
    }}
    className={`absolute ${className}`}
  >
    {children}
  </motion.div>
);

const FeatureCard = ({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    className="group p-10 rounded-[32px] bg-white/[0.02] border border-white/5 hover:border-[#b026ff]/30 hover:bg-white/[0.04] transition-all duration-500"
  >
    <div className="mb-8 p-5 w-20 h-20 rounded-3xl bg-slate-900 border border-white/5 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-xl">
      {icon}
    </div>
    <h3 className="text-2xl font-black mb-4 group-hover:text-[#00f0ff] transition-colors">{title}</h3>
    <p className="text-slate-400 leading-relaxed text-lg font-light">{description}</p>
  </motion.div>
);

const FeatureItem = ({ text }: { text: string }) => (
  <div className="flex items-center gap-3 text-white text-sm font-black tracking-wide">
    <div className="w-5 h-5 rounded-full bg-[#00f0ff]/20 flex items-center justify-center">
      <CheckCircle2 size={12} className="text-[#00f0ff]" />
    </div>
    {text}
  </div>
);
