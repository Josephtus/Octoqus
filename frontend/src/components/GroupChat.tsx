import React, { useEffect, useState, useRef } from 'react';
import { apiFetch, getWsUrl } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useGroupStore } from '../store/groupStore';

interface Message {
  id: number;
  group_id: number;
  sender_id: number;
  sender_name?: string;
  sender_surname?: string;
  message_text: string;
  timestamp: string;
}

const ExpandableText: React.FC<{ text: string }> = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const limit = 300;
  const isLong = text.length > limit;

  return (
    <div className="relative">
      <span className="leading-relaxed">
        {isExpanded ? text : (isLong ? text.slice(0, limit) + '...' : text)}
      </span>
      {isLong && (
        <button 
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className="text-[#00f0ff] hover:text-[#00d0ff] ml-1 font-bold text-[11px] transition-colors"
        >
          {isExpanded ? 'Daha az göster' : 'Devamını oku'}
        </button>
      )}
    </div>
  );
};

export const GroupChat: React.FC = () => {
  const { user } = useAuthStore();
  const { activeGroup } = useGroupStore();
  const groupId = activeGroup?.id;
  const currentUserId = user?.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [wsError, setWsError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const connect = () => {
    if (!groupId) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    // Production'da wss://, development'da ws:// kullanır
    const wsUrl = getWsUrl(`/api/messages/ws/${groupId}?token=${token}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setWsError(null);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
          setMessages((prev) => {
            // Check if message already exists (to handle optimistic updates or duplicate broadcast)
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
        } else if (data.type === "delete") {
          setMessages((prev) => prev.filter(m => m.id !== data.id));
        } else if (data.type === "error") {
          setWsError(data.message);
        }
      } catch (err) {
        console.error("WS message parse error:", err);
      }
    };

    ws.onclose = (e) => {
      console.log("WebSocket closed", e.code, e.reason);
      wsRef.current = null;
      // Attempt reconnect after 3 seconds if not unmounted
      if (groupId) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    ws.onerror = (e) => {
      console.error("WebSocket error:", e);
      setWsError("Bağlantı hatası oluştu.");
    };
  };

  const fetchHistory = async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      const response = await apiFetch(`/messages/${groupId}/history?limit=100`);
      const data = await response.json();
      setMessages(data.messages.reverse());
    } catch (err: any) {
      setWsError("Sohbet geçmişi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      fetchHistory();
      connect();
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [groupId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !groupId) return;

    try {
      const response = await apiFetch(`/messages/${groupId}`, {
        method: 'POST',
        body: JSON.stringify({ text: inputText })
      });
      
      const newMessage = await response.json();
      
      // Update local state optimistically if not already received via WS
      setMessages((prev) => {
        if (prev.some(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
      
      setInputText('');
    } catch (err: any) {
      alert("Mesaj gönderilemedi: " + (err.message || "Bilinmeyen hata"));
    }
  };

  const handleReport = async (messageId: number) => {
    const aciklama = prompt("Lütfen şikayet nedeninizi açıklayın (min 10 karakter):");
    if (!aciklama || aciklama.length < 10) {
      alert("Şikayet açıklaması en az 10 karakter olmalıdır.");
      return;
    }

    try {
      const response = await apiFetch(`/reports/message/${messageId}`, {
        method: 'POST',
        body: JSON.stringify({ aciklama })
      });
      const data = await response.json();
      alert(data.message || "Şikayetiniz başarıyla iletildi.");
    } catch (err) {
      alert("Şikayet gönderilemedi.");
    }
  };

  const handleDelete = async (messageId: number) => {
    if (!window.confirm("Bu mesajı silmek istediğinize emin misiniz?")) return;

    try {
      await apiFetch(`/messages/${messageId}`, {
        method: 'DELETE'
      });
      // Optimistic update
      setMessages((prev) => prev.filter(m => m.id !== messageId));
    } catch (err: any) {
      alert("Mesaj silinemedi: " + (err.message || "Bilinmeyen hata"));
    }
  };

  if (!groupId) return null;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 bg-slate-900 rounded-2xl border border-slate-800 animate-pulse">
        <p className="text-[#00f0ff] font-bold">Sohbet yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden relative">
      <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shadow-md z-10">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] animate-pulse shadow-[0_0_8px_#00f0ff]"></span>
          Grup Sohbeti
        </h3>
        {wsError && <span className="text-xs text-red-400 font-medium">{wsError}</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar bg-slate-950/50">
        {messages.map((msg) => {
          const isMe = currentUserId != null && msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg`}>
              <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                <span className="text-xs text-slate-500 font-bold tracking-tight">
                  {isMe ? 'Sen' : (msg.sender_name ? `${msg.sender_name} ${msg.sender_surname}` : `Kullanıcı ${msg.sender_id}`)}
                </span>
              </div>
              <div className={`flex items-center gap-2 max-w-full ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`px-4 py-2 rounded-2xl text-slate-200 border shadow-md break-all sm:break-words whitespace-pre-wrap max-w-[85%] ${
                  isMe ? 'bg-[#b026ff]/20 border-[#b026ff]/30 rounded-tr-sm' : 'bg-slate-800 border-slate-700 rounded-tl-sm'
                }`}>
                  <ExpandableText text={msg.message_text} />
                </div>
                {isMe ? (
                  <button 
                    onClick={() => handleDelete(msg.id)}
                    className="opacity-0 group-hover/msg:opacity-100 p-1 bg-red-500/10 text-red-500 rounded-md hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-500/20 shrink-0"
                    title="Mesajı Sil"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                ) : (
                  <button 
                    onClick={() => handleReport(msg.id)}
                    className="opacity-0 group-hover/msg:opacity-100 p-1 bg-orange-500/10 text-orange-500 rounded-md hover:bg-orange-500 hover:text-white transition-all shadow-sm border border-orange-500/20 shrink-0"
                    title="Mesajı Şikayet Et"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </button>
                )}
              </div>
              <span className={`text-[10px] text-slate-600 mt-1 ${isMe ? 'mr-1 text-right' : 'ml-1 text-left'}`}>
                {msg.timestamp ? new Date(msg.timestamp + (msg.timestamp.includes('Z') || msg.timestamp.includes('+') ? '' : 'Z')).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
        <input 
          type="text" 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Bir mesaj yazın..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff] transition-all"
        />
        <button 
          type="submit"
          disabled={!inputText.trim()}
          className="bg-[#b026ff] hover:bg-[#c455ff] text-white px-5 rounded-xl font-bold transition-all shadow-lg hover:shadow-[#b026ff]/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Gönder
        </button>
      </form>
    </div>
  );
};
