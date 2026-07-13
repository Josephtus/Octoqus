import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

interface Country {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
  mask: string;
}

const COUNTRIES: Country[] = [
  { code: 'TR', name: 'Türkiye', flag: '🇹🇷', dialCode: '+90', mask: '(###) ### ## ##' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1', mask: '(###) ###-####' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dialCode: '+49', mask: '#### #######' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44', mask: '#### ######' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33', mask: '# ## ## ## ##' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿', dialCode: '+994', mask: '(##) ### ## ##' },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({ onChange, error, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [displayValue, setDisplayValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Maskeleme fonksiyonu
  const applyMask = (val: string, mask: string) => {
    let result = '';
    let valIdx = 0;
    const cleanVal = val.replace(/\D/g, '');

    for (let i = 0; i < mask.length && valIdx < cleanVal.length; i++) {
      if (mask[i] === '#') {
        result += cleanVal[valIdx];
        valIdx++;
      } else {
        result += mask[i];
      }
    }
    return result;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    const masked = applyMask(rawVal, selectedCountry.mask);
    setDisplayValue(masked);
    onChange(`${selectedCountry.dialCode}${rawVal}`);
  };

  return (
    <div className={`relative space-y-2 ${className}`} ref={containerRef}>
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Telefon Numarası</label>
      
      <div className={`flex gap-2 p-1 rounded-2xl bg-slate-950/50 border transition-all ${
        error ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-white/5 focus-within:border-[#b026ff]/50'
      }`}>
        
        {/* Ülke Seçici */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 h-full px-4 rounded-xl hover:bg-white/5 transition-colors text-white border-r border-white/5"
          >
            <span className="text-xl">{selectedCountry.flag}</span>
            <span className="text-sm font-bold">{selectedCountry.dialCode}</span>
            <ChevronDown size={14} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute left-0 top-full mt-2 w-64 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden"
              >
                <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {COUNTRIES.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => {
                        setSelectedCountry(country);
                        setIsOpen(false);
                        setDisplayValue('');
                        onChange('');
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{country.flag}</span>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-[#b026ff] transition-colors">{country.name}</p>
                          <p className="text-[10px] text-slate-500">{country.dialCode}</p>
                        </div>
                      </div>
                      {selectedCountry.code === country.code && <Check size={16} className="text-[#b026ff]" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Numara Girişi */}
        <input
          type="tel"
          value={displayValue}
          onChange={handleInputChange}
          placeholder={selectedCountry.mask.replace(/#/g, '0')}
          className="flex-1 bg-transparent py-4 px-2 text-white placeholder:text-slate-700 focus:outline-none font-medium"
        />
      </div>

      {error && <p className="text-[10px] text-red-400 ml-1 font-bold">{error}</p>}
    </div>
  );
};
