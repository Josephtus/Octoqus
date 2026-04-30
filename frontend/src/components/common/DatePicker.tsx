import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Calendar } from 'lucide-react';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  error?: string;
  className?: string;
}

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, error, className }) => {
  const [day, setDay] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<string>('');
  
  const [activeDropdown, setActiveDropdown] = useState<'day' | 'month' | 'year' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Başlangıç değerini parçala
  useEffect(() => {
    if (value) {
      const [vYear, vMonth, vDay] = value.split('-');
      setYear(vYear);
      setMonth(String(parseInt(vMonth)));
      setDay(String(parseInt(vDay)));
    }
  }, [value]);

  // Değer değiştiğinde ana forma bildir
  useEffect(() => {
    if (day && month && year) {
      const formattedMonth = month.padStart(2, '0');
      const formattedDay = day.padStart(2, '0');
      onChange(`${year}-${formattedMonth}-${formattedDay}`);
    }
  }, [day, month, year]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (m: number, y: number) => {
    return new Date(y || 2000, m, 0).getDate();
  };

  const days = Array.from({ length: getDaysInMonth(parseInt(month) || 1, parseInt(year) || 2000) }, (_, i) => i + 1);
  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);

  const Dropdown = ({ 
    type, 
    label, 
    currentValue, 
    options, 
    onSelect, 
    displayFunc = (v: any) => v 
  }: any) => (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={() => setActiveDropdown(activeDropdown === type ? null : type)}
        className={`w-full flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border transition-all ${
          activeDropdown === type ? 'border-[#b026ff] shadow-[0_0_15px_rgba(176,38,255,0.2)]' : 'border-white/5 hover:border-white/10'
        }`}
      >
        <span className={currentValue ? 'text-white font-bold' : 'text-slate-600'}>
          {currentValue ? displayFunc(currentValue) : label}
        </span>
        <ChevronDown size={14} className={`text-slate-500 transition-transform ${activeDropdown === type ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {activeDropdown === type && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute left-0 top-full mt-2 w-full max-h-60 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-[110] overflow-y-auto custom-scrollbar"
          >
            {options.map((opt: any) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onSelect(String(opt));
                  setActiveDropdown(null);
                }}
                className="w-full p-3 text-left text-sm font-medium text-slate-300 hover:bg-[#b026ff]/10 hover:text-white transition-all border-b border-white/5 last:border-0"
              >
                {displayFunc(opt)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className={`space-y-2 ${className}`} ref={containerRef}>
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
        <Calendar size={12} /> Doğum Tarihi
      </label>
      
      <div className="flex gap-2">
        <Dropdown 
          type="day" 
          label="Gün" 
          currentValue={day} 
          options={days} 
          onSelect={setDay} 
        />
        <Dropdown 
          type="month" 
          label="Ay" 
          currentValue={month} 
          options={Array.from({ length: 12 }, (_, i) => i + 1)} 
          onSelect={setMonth}
          displayFunc={(m: number) => MONTHS[m - 1]}
        />
        <Dropdown 
          type="year" 
          label="Yıl" 
          currentValue={year} 
          options={years} 
          onSelect={setYear} 
        />
      </div>

      {error && <p className="text-[10px] text-red-400 ml-1 font-bold">{error}</p>}
    </div>
  );
};
