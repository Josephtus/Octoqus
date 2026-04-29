import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  error?: string;
  showToday?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, label, error, showToday = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  const days = ['Pt', 'Sa', 'Çar', 'Per', 'Cu', 'Cmt', 'Paz'];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      // Calculate if there's enough space below, otherwise show above
      const spaceBelow = window.innerHeight - rect.bottom;
      const showAbove = spaceBelow < 350; // Popover height approx 350px

      setCoords({
        top: showAbove ? rect.top + scrollY - 360 : rect.bottom + scrollY + 8,
        left: rect.left + scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const popover = document.getElementById('datepicker-popover');
        if (popover && popover.contains(event.target as Node)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleDateClick = (day: number) => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth() + 1;
    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(formattedDate);
    setIsOpen(false);
  };

  const changeMonth = (offset: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const selectMonth = (monthIndex: number) => {
    setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1));
    setView('days');
  };

  const selectYear = (year: number) => {
    setViewDate(new Date(year, viewDate.getMonth(), 1));
    setView('months');
  };

  const renderDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const startDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const calendarDays = [];
    for (let i = startDay - 1; i >= 0; i--) {
      calendarDays.push({ day: daysInPrevMonth - i, current: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      calendarDays.push({ day: i, current: true });
    }
    const remaining = 42 - calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      calendarDays.push({ day: i, current: false });
    }

    const selectedDate = value ? new Date(value) : null;
    const isSelected = (d: number, cur: boolean) => cur && selectedDate && selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
    const isToday = (d: number, cur: boolean) => {
      const today = new Date();
      return cur && today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
    };

    return (
      <div className="grid grid-cols-7 gap-1 animate-fade-in">
        {days.map(d => (
          <div key={d} className="text-[9px] font-black text-slate-500 text-center py-2 uppercase tracking-widest">{d}</div>
        ))}
        {calendarDays.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => item.current && handleDateClick(item.day)}
            className={`aspect-square rounded-xl text-xs font-bold transition-all flex items-center justify-center ${!item.current ? 'text-slate-800' : 'text-slate-300 hover:bg-white/5 hover:text-[#00f0ff]'} ${isSelected(item.day, item.current) ? 'bg-[#00f0ff] !text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.4)] scale-90' : ''} ${isToday(item.day, item.current) && !isSelected(item.day, item.current) ? 'border border-[#00f0ff]/30 text-[#00f0ff]' : ''}`}
          >
            {item.day}
          </button>
        ))}
      </div>
    );
  };

  const renderMonths = () => (
    <div className="grid grid-cols-3 gap-2 py-2 animate-fade-in">
      {months.map((m, i) => (
        <button key={m} type="button" onClick={() => selectMonth(i)} className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewDate.getMonth() === i ? 'bg-[#b026ff] text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}>{m}</button>
      ))}
    </div>
  );

  const renderYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear + 10; i >= currentYear - 100; i--) years.push(i);
    return (
      <div className="grid grid-cols-3 gap-2 py-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar animate-fade-in">
        {years.map(y => (
          <button key={y} type="button" onClick={() => selectYear(y)} className={`py-4 rounded-2xl text-xs font-black tracking-tight transition-all ${viewDate.getFullYear() === y ? 'bg-[#00f0ff] text-slate-950 shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}>{y}</button>
        ))}
      </div>
    );
  };

  const popoverContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="datepicker-popover"
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            width: 300,
            zIndex: 9999
          }}
          className="bg-slate-900 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden p-6 backdrop-blur-3xl ring-1 ring-white/5"
        >
          <div className="flex items-center justify-between mb-6">
            <button type="button" onClick={() => setView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'days')} className="text-xs font-black text-white hover:text-[#00f0ff] transition-colors uppercase tracking-widest flex items-center gap-2 group">
              <span>{view === 'years' ? 'Yıl Seçin' : view === 'months' ? viewDate.getFullYear() : `${months[viewDate.getMonth()]} ${viewDate.getFullYear()}`}</span>
              <ChevronRight size={14} className={`text-slate-600 group-hover:text-[#00f0ff] transition-transform ${view !== 'days' ? 'rotate-90' : ''}`} />
            </button>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => view === 'days' ? changeMonth(-1) : setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1))} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => view === 'days' ? changeMonth(1) : setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1))} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="min-h-[240px]">
            {view === 'days' && renderDays()}
            {view === 'months' && renderMonths()}
            {view === 'years' && renderYears()}
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
            {showToday && (
              <button type="button" onClick={() => { 
                const now = new Date();
                const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                onChange(formatted); 
                setIsOpen(false); 
              }} className="text-[10px] font-black text-[#00f0ff] uppercase tracking-widest hover:brightness-125 transition-all">Bugün</button>
            )}
            <button type="button" onClick={() => { onChange(''); setIsOpen(false); }} className={`text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-red-400 transition-all ${!showToday ? 'w-full text-center' : ''}`}>Temizle</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 block mb-3">{label}</label>}
      <div 
        ref={inputRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-950/80 border transition-all rounded-2xl py-4 px-6 text-white cursor-pointer flex items-center justify-between group ${error ? 'border-red-500/50 hover:border-red-500' : 'border-white/5 hover:border-white/20 hover:bg-slate-900'} ${isOpen ? 'ring-2 ring-[#00f0ff]/20 border-[#00f0ff]/40 bg-slate-900' : ''}`}
      >
        <span className={value ? 'font-black' : 'text-slate-600 font-bold'}>{value ? new Date(value).toLocaleDateString('tr-TR') : 'Tarih Seçin'}</span>
        <CalendarIcon size={18} className={isOpen ? 'text-[#00f0ff]' : 'text-slate-500 group-hover:text-slate-300'} />
      </div>
      {error && <p className="text-[10px] text-red-400 ml-2 font-bold mt-2">{error}</p>}
      {createPortal(popoverContent, document.body)}
    </div>
  );
};
