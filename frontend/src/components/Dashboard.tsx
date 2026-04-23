import React from 'react';

export const Dashboard: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-lg p-10 bg-slate-900 border border-slate-800 rounded-lg shadow-xl text-center">
        <h2 className="text-3xl font-bold mb-8 text-[#00f0ff] drop-shadow-glow-blue">Hoş Geldin</h2>
        
        <button 
          className="px-6 py-3 rounded-lg font-bold bg-[#b026ff] text-white hover:opacity-90 transition-opacity drop-shadow-glow-purple"
          onClick={() => console.log("Harcama Ekle tıklandı")}
        >
          Harcama Ekle
        </button>
      </div>
    </div>
  );
};
