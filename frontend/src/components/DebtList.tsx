import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';

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

interface Settlement {
  id: number;
  from_user_id: number;
  from_user_name: string;
  to_user_id: number;
  to_user_name: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface DebtData {
  settled: boolean;
  transactions?: Transaction[];
}

export const DebtList: React.FC<DebtListProps> = ({ groupId, currentUserId }) => {
  const [debtData, setDebtData] = useState<DebtData | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [debtRes, settRes] = await Promise.all([
        apiFetch(`/expenses/${groupId}/debts`),
        apiFetch(`/expenses/${groupId}/settlements`)
      ]);
      
      if (!debtRes.ok || !settRes.ok) {
        const errorData = await debtRes.json().catch(() => ({}));
        throw new Error(errorData.message || 'Sunucu hatası oluştu.');
      }

      const debtJson = await debtRes.json();
      const settJson = await settRes.json();
      
      setDebtData(debtJson);
      setSettlements(settJson.settlements || []);
    } catch (err: any) {
      console.error('Veri alınırken hata:', err);
      setError(err.message || 'Hesaplaşma bilgileri yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const handlePayRequest = async (toUserId: number, amount: number) => {
    if (!window.confirm(`${amount.toFixed(2)} TL tutarında ödeme bildirimini göndermek istediğinize emin misiniz?`)) return;
    setActionLoading(toUserId);
    try {
      const res = await apiFetch(`/expenses/${groupId}/settle`, {
        method: 'POST',
        body: JSON.stringify({ recipient_id: toUserId, amount })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'İşlem başarısız.');
      }
      alert("Ödeme bildirimi gönderildi. Alacaklı onayladığında borcunuz düşecektir.");
      fetchData();
    } catch (err: any) {
      alert(err.message || "İşlem başarısız.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (settlementId: number, action: 'approve' | 'reject') => {
    setActionLoading(settlementId);
    try {
      const res = await apiFetch(`/expenses/${groupId}/settlements/${settlementId}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'İşlem başarısız.');
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || "İşlem başarısız.");
    } finally {
      setActionLoading(null);
    }
  };

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
        <button onClick={fetchData} className="px-6 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all">Tekrar Dene</button>
      </div>
    );
  }

  const myTransactions = (debtData?.transactions || []).filter(
    tx => tx.from_user_id === currentUserId || tx.to_user_id === currentUserId
  );

  const pendingSettlements = settlements.filter(s => s.status?.toLowerCase() === 'pending');
  const myActionNeeded = pendingSettlements.filter(s => s.to_user_id === currentUserId);
  const mySentPending = pendingSettlements.filter(s => s.from_user_id === currentUserId);

  const totalToPay = myTransactions
    .filter(tx => tx.from_user_id === currentUserId)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalToReceive = myTransactions
    .filter(tx => tx.to_user_id === currentUserId)
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Onay Bekleyenler (Bana Gelenler) */}
      <AnimatePresence>
        {myActionNeeded.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/20 rounded-[2.5rem] p-8 backdrop-blur-xl"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30">
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h4 className="text-lg font-black text-amber-500 tracking-tight">Onay Bekleyen Ödemeler</h4>
                <p className="text-amber-500/60 text-[10px] font-bold uppercase tracking-widest">Kullanıcılar borçlarını ödediklerini beyan ettiler</p>
              </div>
            </div>
            <div className="space-y-3">
              {myActionNeeded.map(s => (
                <div key={s.id} className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center font-black text-white">{s.from_user_name.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-black text-white">{s.from_user_name}</p>
                      <p className="text-[#00f0ff] font-black text-xs">₺{s.amount.toFixed(2)} ödediğini bildirdi</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAction(s.id, 'reject')}
                      disabled={actionLoading === s.id}
                      className="px-4 py-2 bg-red-500/10 text-red-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                    >
                      REDDET
                    </button>
                    <button 
                      onClick={() => handleAction(s.id, 'approve')}
                      disabled={actionLoading === s.id}
                      className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all disabled:opacity-50"
                    >
                      ONAYLA
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          {myTransactions.length === 0 && (
            <div className="py-12 text-center text-slate-500 italic font-medium">Bekleyen işleminiz bulunmuyor.</div>
          )}
          {myTransactions.map((tx, idx) => {
            const isIDebt = tx.from_user_id === currentUserId;
            const targetId = isIDebt ? tx.to_user_id : tx.from_user_id;
            const pendingReq = mySentPending.find(s => s.to_user_id === targetId);
            const hasPendingRequest = !!pendingReq;
            
            return (
              <div 
                key={idx} 
                className="group relative flex flex-col sm:flex-row items-center justify-between p-6 bg-slate-950/40 border border-white/5 rounded-[2.5rem] hover:bg-slate-800/40 hover:border-white/10 transition-all duration-500 shadow-sm"
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
                
                {/* Miktar ve Aksiyon */}
                <div className="mt-6 sm:mt-0 flex items-center gap-4">
                   <div className="flex items-center gap-3 px-6 py-4 bg-slate-950/50 rounded-2xl border border-white/5 group-hover:border-white/10 transition-all">
                      <div className="flex flex-col items-end">
                        <span className={`text-2xl font-black tracking-tight ${isIDebt ? 'text-red-400' : 'text-emerald-400'}`}>
                          ₺{Number(tx.amount).toFixed(2)}
                        </span>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{isIDebt ? 'BORÇ' : 'ALACAK'}</span>
                      </div>
                      <div className={`w-1.5 h-10 rounded-full ${isIDebt ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                   </div>

                   {isIDebt && (
                     <div className="flex items-center gap-2">
                       {hasPendingRequest ? (
                         <div className="flex items-center gap-2 px-6 py-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                           <div className="flex flex-col">
                             <span className="text-amber-500 font-black text-[11px] uppercase tracking-wider">Ödeme Onay Bekliyor</span>
                             <span className="text-amber-500/60 text-[8px] font-bold uppercase tracking-widest">Alacaklı Onayı Gerekiyor</span>
                           </div>
                           <button 
                             onClick={async () => {
                               if(window.confirm("Ödeme bildirimini iptal etmek (geri çekmek) istiyor musunuz?")) {
                                 try {
                                   await apiFetch(`/expenses/${groupId}/${pendingReq.id}`, { method: 'DELETE' });
                                   fetchData();
                                 } catch (err: any) {
                                   alert("İptal işlemi başarısız.");
                                 }
                               }
                             }}
                             className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-500 hover:text-slate-950 transition-all"
                             title="Ödemeyi İptal Et"
                           >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                             </svg>
                           </button>
                         </div>
                       ) : (
                         <button 
                           onClick={() => handlePayRequest(tx.to_user_id, tx.amount)}
                           disabled={actionLoading !== null}
                           className="px-10 py-4 bg-[#00f0ff] text-slate-950 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-xl hover:scale-105 hover:shadow-[0_0_20px_#00f0ff44]"
                         >
                           ÖDE
                         </button>
                       )}
                     </div>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
