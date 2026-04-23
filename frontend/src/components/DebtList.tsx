import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

interface DebtListProps {
  groupId: number;
}

interface Transaction {
  from_user_id: number;
  to_user_id: number;
  amount: number;
}

interface DebtData {
  settled: boolean;
  transactions?: Transaction[];
}

export const DebtList: React.FC<DebtListProps> = ({ groupId }) => {
  const [debtData, setDebtData] = useState<DebtData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDebts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(`/expenses/${groupId}/debts`);
        const data = await response.json();
        setDebtData(data);
      } catch (err: any) {
        console.error('Borç durumu alınırken hata:', err);
        setError('Hesaplaşma bilgileri yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };

    fetchDebts();
  }, [groupId]);

  if (loading) {
    return (
      <div className="w-full py-8 flex justify-center">
        <div className="text-[#00f0ff] animate-pulse font-medium drop-shadow-glow-blue text-lg">
          Hesaplaşma durumu yükleniyor...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-4 rounded-lg bg-red-900/40 border border-red-500/50 text-red-200 text-center font-medium">
        {error}
      </div>
    );
  }

  if (!debtData) return null;

  // Hesaplar denkse veya ödenecek işlem yoksa
  if (debtData.settled || !debtData.transactions || debtData.transactions.length === 0) {
    return (
      <div className="w-full p-8 bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-2xl shadow-[0_4px_30px_rgba(16,185,129,0.1)] flex flex-col items-center text-center transition-all hover:border-emerald-400/50">
        <div className="bg-emerald-900/50 p-4 rounded-full mb-4 shadow-lg border border-emerald-700/50">
          <svg className="w-12 h-12 text-emerald-400 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h4 className="text-2xl font-bold text-emerald-300 mb-2">Hesaplar Denk!</h4>
        <p className="text-emerald-100/80 text-lg">Harika! Bu grupta kimsenin kimseye borcu yok, hesaplar denk.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-3">
        <div className="bg-slate-800 p-2 rounded-lg border border-slate-700">
          <svg className="w-6 h-6 text-[#00f0ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        Grup İçi Ödeme Planı
      </h3>
      
      <div className="space-y-4">
        {debtData.transactions.map((tx, idx) => (
          <div 
            key={idx} 
            className="flex flex-col sm:flex-row items-center justify-between p-5 bg-slate-800/60 border border-slate-700/50 rounded-xl hover:bg-slate-800 hover:border-slate-600 transition-all shadow-sm"
          >
            {/* Kullanıcılar arası akış */}
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left text-lg flex-1">
              {/* Ödeyecek Kişi (Kırmızı Ton) */}
              <span className="font-bold text-red-400 bg-red-950/40 px-4 py-2 rounded-xl border border-red-900/50 shadow-inner">
                Kullanıcı {tx.from_user_id}
              </span>
              
              {/* Yön Oku */}
              <div className="bg-slate-900 p-1.5 rounded-full border border-slate-700">
                <svg className="w-5 h-5 text-slate-400 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>

              {/* Alacaklı Kişi (Yeşil Ton) */}
              <span className="font-bold text-emerald-400 bg-emerald-950/40 px-4 py-2 rounded-xl border border-emerald-900/50 shadow-inner">
                Kullanıcı {tx.to_user_id}
              </span>
              
              <span className="text-slate-400 text-sm mt-1 sm:mt-0 sm:ml-2 font-medium">kişisine</span>
            </div>
            
            {/* Miktar */}
            <div className="mt-5 sm:mt-0 bg-slate-900/80 border border-slate-700 px-5 py-3 rounded-xl flex items-center shadow-inner">
              <span className="text-2xl font-black text-[#00f0ff] drop-shadow-glow-blue tracking-tight">
                ₺{Number(tx.amount).toFixed(2)}
              </span>
              <span className="ml-2.5 text-sm text-slate-400 font-bold uppercase tracking-wider">Ödemeli</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
