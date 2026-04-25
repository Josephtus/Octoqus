import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

interface DebtListProps {
  groupId: number;
  currentUserId?: number;
}

interface Transaction {
  from_user_id: number;
  from_user_name: string;
  to_user_id: number;
  to_user_name: string;
  amount: number;
}

interface DebtData {
  settled: boolean;
  transactions?: Transaction[];
}

export const DebtList: React.FC<DebtListProps> = ({ groupId, currentUserId }) => {
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
      <div className="w-full py-20 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#00f0ff]/10 border-t-[#00f0ff] rounded-full animate-spin"></div>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Hesaplar Analiz Ediliyor</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-10 rounded-[2.5rem] bg-red-500/5 border border-red-500/20 text-red-400 text-center flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <p className="text-sm font-bold">{error}</p>
      </div>
    );
  }

  if (!debtData) return null;

  // Kişiye özel filtreleme
  const myTransactions = (debtData.transactions || []).filter(
    tx => tx.from_user_id === currentUserId || tx.to_user_id === currentUserId
  );

  const totalToPay = myTransactions
    .filter(tx => tx.from_user_id === currentUserId)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalToReceive = myTransactions
    .filter(tx => tx.to_user_id === currentUserId)
    .reduce((sum, tx) => sum + tx.amount, 0);

  if (myTransactions.length === 0) {
    return (
      <div className="w-full p-12 bg-slate-900/40 border border-white/5 rounded-[3rem] flex flex-col items-center text-center backdrop-blur-3xl shadow-2xl">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-6 border border-emerald-500/20">
          <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h4 className="text-3xl font-black text-white mb-2 tracking-tighter">Borçsuz ve Alacaklı Değilsiniz!</h4>
        <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Bu grupta şu an için bekleyen bir ödemeniz bulunmuyor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Özet Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/40 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-3xl shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl -mr-10 -mt-10 group-hover:bg-red-500/10 transition-all duration-700" />
          <div className="relative z-10">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 block">Toplam Borcunuz</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white tracking-tighter">₺{totalToPay.toFixed(2)}</span>
              <span className="text-xs font-black text-red-500 uppercase">Ödemeli</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-3xl shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-10 -mt-10 group-hover:bg-emerald-500/10 transition-all duration-700" />
          <div className="relative z-10">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 block">Toplam Alacağınız</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white tracking-tighter">₺{totalToReceive.toFixed(2)}</span>
              <span className="text-xs font-black text-emerald-500 uppercase">Alacak</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-white/5 rounded-[3rem] p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-[#00f0ff]/10 rounded-xl flex items-center justify-center border border-[#00f0ff]/20">
             <svg className="w-5 h-5 text-[#00f0ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          </div>
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">Kişisel Ödeme Planı</h3>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">Sadece sizi ilgilendiren işlemler</p>
          </div>
        </div>
        
        <div className="space-y-4">
          {myTransactions.map((tx, idx) => {
            const isIDebt = tx.from_user_id === currentUserId;
            return (
              <div 
                key={idx} 
                className="group relative flex flex-col sm:flex-row items-center justify-between p-6 bg-slate-950/40 border border-white/5 rounded-[2rem] hover:bg-slate-800/40 hover:border-white/10 transition-all duration-500 shadow-sm"
              >
                {/* Kullanıcılar arası akış */}
                <div className="flex items-center gap-4 text-lg flex-1">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{isIDebt ? 'KİME ÖDEYECEKSİNİZ' : 'KİMDEN ALACAKSINIZ'}</span>
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${isIDebt ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                         {(isIDebt ? tx.to_user_name : tx.from_user_name).charAt(0)}
                       </div>
                       <span className="font-black text-white">{isIDebt ? tx.to_user_name : tx.from_user_name}</span>
                    </div>
                  </div>
                </div>
                
                {/* Miktar */}
                <div className="mt-6 sm:mt-0 flex flex-col items-end">
                   <div className="flex items-center gap-3 px-6 py-4 bg-slate-950/50 rounded-2xl border border-white/5 group-hover:border-white/10 transition-all">
                      <div className="flex flex-col items-end">
                        <span className={`text-2xl font-black tracking-tight ${isIDebt ? 'text-red-400' : 'text-emerald-400'}`}>
                          ₺{Number(tx.amount).toFixed(2)}
                        </span>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{isIDebt ? 'BORÇ' : 'ALACAK'}</span>
                      </div>
                      <div className={`w-1.5 h-10 rounded-full ${isIDebt ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
