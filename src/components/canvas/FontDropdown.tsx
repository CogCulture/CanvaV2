import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, Plus } from 'lucide-react';
import { CustomFontUploaderModal } from './CustomFontUploaderModal';

const POPULAR_FONTS = [
  'Open Sans',
  'Roboto',
  'Lato',
  'Montserrat',
  'Oswald',
  'Source Sans Pro',
  'Slabo 27px',
  'Raleway',
  'PT Sans',
  'Merriweather',
  'Noto Sans',
  'Nunito',
  'Playfair Display',
  'Ubuntu',
  'Rubik',
  'Lora',
  'Work Sans',
  'Fira Sans',
  'Quicksand',
  'Inter',
  'Dancing Script',
  'Caveat',
  'Pacifico',
  'Orbitron',
  'Cinzel',
  'Anton',
  'Josefin Sans',
  'Bebas Neue',
  'Cabin',
  'Abel',
  'Lobster',
  'Amatic SC',
  'Comfortaa',
  'Teko',
  'Righteous',
  'Courgette',
  'Bree Serif',
  'Alfa Slab One',
  'Permanent Marker',
  'Fredoka One'
].sort();

interface FontDropdownProps {
  value: string;
  onChange: (font: string) => void;
}

export function FontDropdown({ value, onChange }: FontDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load standard fonts to make preview accurate
  useEffect(() => {
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${POPULAR_FONTS.map(f => f.replace(/ /g, '+')).join('&family=')}&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const displayValue = typeof value === 'string' ? value : 'Open Sans';
  
  const allFonts = [...customFonts, ...POPULAR_FONTS];
  const filteredFonts = allFonts.filter(font => 
    font.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddCustomFont = (fontName: string) => {
    if (!customFonts.includes(fontName) && !POPULAR_FONTS.includes(fontName)) {
      setCustomFonts(prev => [fontName, ...prev]);
    }
    onChange(fontName);
  };

  return (
    <div className="relative flex-1 min-w-0" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-full bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white py-1 px-2 rounded-md text-left text-[10px] border border-[rgba(255,255,255,0.1)] transition-colors flex justify-between items-center"
      >
        <span className="truncate" style={{ fontFamily: displayValue }}>{displayValue}</span>
        <ChevronDown size={10} className="opacity-50 ml-1 shrink-0" />
      </button>

      {isOpen && (
        <div 
          className="absolute z-[9999] top-full mt-1 left-0 w-48 bg-[#1c1c1e] border border-[rgba(255,255,255,0.1)] rounded-md shadow-xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b border-[rgba(255,255,255,0.05)] bg-[#1c1c1e] shrink-0">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40" />
              <input 
                ref={inputRef}
                type="text" 
                placeholder="Search fonts..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#2c2c2e] text-white text-[10px] rounded px-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-white/30"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1 custom-scrollbar">
            {filteredFonts.length === 0 ? (
              <div className="px-3 py-4 text-center text-[10px] text-white/40">
                No fonts found
              </div>
            ) : (
              filteredFonts.map((font) => (
                <button
                  key={font}
                  onClick={() => {
                    onChange(font);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] hover:bg-blue-600/20 hover:text-blue-400 transition-colors ${
                    displayValue === font ? 'text-blue-400 bg-blue-600/10' : 'text-white'
                  }`}
                >
                  <span className="truncate" style={{ fontFamily: font }}>{font}</span>
                  {displayValue === font && <Check size={12} className="shrink-0" />}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-[rgba(255,255,255,0.05)] p-1 bg-[#1c1c1e] shrink-0">
            <button
              onClick={() => {
                setIsOpen(false);
                setIsUploaderOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-medium text-blue-400 hover:bg-blue-600/10 rounded transition-colors"
            >
              <Plus size={12} />
              Upload Custom Font
            </button>
          </div>
        </div>
      )}
      
      <CustomFontUploaderModal 
        isOpen={isUploaderOpen} 
        onClose={() => setIsUploaderOpen(false)} 
        onAddCustomFont={handleAddCustomFont} 
      />
    </div>
  );
}
