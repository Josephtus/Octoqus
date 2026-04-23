import React, { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../utils/api';

interface Message {
  id: number;
  group_id: number;
  sender_id: number;
  sender_name?: string;
  sender_surname?: string;
  message_text: string;
  timestamp: string;
}

interface GroupChatProps {
  groupId: number;
  currentUserId?: number;
}

export const GroupChat: React.FC<GroupChatProps> = ({ groupId, currentUserId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [wsError, setWsError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let isMounted = true;
    let ws: WebSocket | null = null;

    const fetchHistoryAndConnect = async () => {
      try {
        setLoading(true);
        // Geçmişi çek
        const response = await apiFetch(`/messages/${groupId}/history?limit=100`);
        const data = await response.json();
        
        if (!isMounted) return;

        // Backend en yeniden eskiye gönderiyor (DESC), ekranda yukarıdan aşağıya eski->yeni göstermeliyiz
        setMessages(data.messages.reverse());
        
        // WebSocket bağlantısı kur
        const token = localStorage.getItem('token');
        if (!token) throw new Error("Token bulunamadı");
        
        const wsUrl = `ws://localhost:8000/api/messages/ws/${groupId}?token=${token}`;
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) {
            ws?.close();
            return;
          }
          console.log("WebSocket bağlantısı başarılı");
          setWsError(null);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          const data = JSON.parse(event.data);
          
          if (data.type === "message") {
            setMessages((prev) => {
              // ID bazlı tekilleştirme (Duplicate önleme)
              if (prev.some(m => m.id === data.id)) return prev;
              return [...prev, data];
            });
          } else if (data.type === "error") {
            setWsError(data.message);
          }
        };

        ws.onclose = () => {
          console.log("WebSocket bağlantısı kapandı");
        };

      } catch (err: any) {
        if (!isMounted) return;
        console.error("Chat yükleme hatası:", err);
        setWsError("Sohbet geçmişi yüklenemedi veya bağlantı kurulamadı.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistoryAndConnect();

    // Cleanup: Bileşen unmount olduğunda veya groupId değiştiğinde
    return () => {
      isMounted = false;
      if (ws) {
        ws.close();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [groupId]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // JSON formatında gönder
    wsRef.current.send(JSON.stringify({ text: inputText }));
    setInputText('');
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 bg-slate-900 rounded-2xl border border-slate-800 animate-pulse">
        <p className="text-[#00f0ff] font-bold">Sohbet yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden relative">
      {/* Header */}
      <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shadow-md z-10">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] animate-pulse shadow-[0_0_8px_#00f0ff]"></span>
          Grup Sohbeti
        </h3>
        {wsError && <span className="text-xs text-red-400 font-medium">{wsError}</span>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar bg-slate-950/50">
        {messages.map((msg) => {
          const isMe = currentUserId != null && msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg`}>
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-xs text-slate-500 font-bold tracking-tight">
                  {isMe ? 'Sen' : (msg.sender_name ? `${msg.sender_name} ${msg.sender_surname}` : `Kullanıcı ${msg.sender_id}`)}
                </span>
                {!isMe && (
                  <button 
                    onClick={() => handleReport(msg.id)}
                    className="opacity-0 group-hover/msg:opacity-100 p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-500/20"
                    title="Mesajı Şikayet Et"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </button>
                )}
              </div>
              <div className={`px-4 py-2 rounded-2xl text-slate-200 border max-w-[80%] shadow-md ${
                isMe ? 'bg-[#b026ff]/20 border-[#b026ff]/30 rounded-tr-sm' : 'bg-slate-800 border-slate-700 rounded-tl-sm'
              }`}>
                {msg.message_text}
              </div>
              <span className="text-[10px] text-slate-600 ml-1 mt-1">
                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
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
