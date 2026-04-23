import React, { useState } from 'react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form Verileri:", { email, password });
    
    setLoading(true);
    try {
      // TODO: Gerçek API bağlantısı burada yapılacak
      /*
      const response = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mail: email, password })
      });
      
      if (!response.ok) {
        throw new Error("Giriş başarısız");
      }
      
      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      */
      
      // Backend testini simüle etmek için 1 saniye bekle
      await new Promise(resolve => setTimeout(resolve, 1000));
      onLoginSuccess();
      
    } catch (error) {
      console.error("Login hatası:", error);
      alert("Giriş sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm p-8 bg-slate-900 border border-slate-800 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-center text-slate-100">Giriş Yap</h2>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@mail.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Şifre</label>
            <input 
              type="password" 
              required
              className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-[#00f0ff]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 w-full p-2 rounded font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  );
};
