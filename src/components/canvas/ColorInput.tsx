import React, { useState, useEffect } from 'react';
import { Pipette } from 'lucide-react';
import { hexToCmyk, cmykToHex } from '../../utils/colorUtils';
import { useCanvasStore } from '../../store/useCanvasStore';

interface ColorInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorInput({ value, onChange }: ColorInputProps) {
  const { savedColors, addSavedColor } = useCanvasStore();
  const [hex, setHex] = useState(value);
  const [cmyk, setCmyk] = useState(hexToCmyk(value));

  useEffect(() => {
    if (value !== hex) {
      setHex(value);
      setCmyk(hexToCmyk(value));
    }
  }, [value]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newHex = e.target.value;
    if (!newHex.startsWith('#')) newHex = '#' + newHex;
    setHex(newHex);
    
    // If it's a valid hex, update CMYK and fire onChange
    if (/^#[0-9A-Fa-f]{6}$/.test(newHex)) {
      setCmyk(hexToCmyk(newHex));
      onChange(newHex);
    }
  };

  const handleHexBlur = () => {
    // Revert if invalid
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setHex(value);
    } else {
      // Ensure it's uppercase
      const upper = hex.toUpperCase();
      setHex(upper);
      onChange(upper);
      addSavedColor(upper);
    }
  };

  const handleCmykChange = (channel: 'c' | 'm' | 'y' | 'k', val: string) => {
    let num = parseInt(val, 10);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 100) num = 100;

    const newCmyk = { ...cmyk, [channel]: num };
    setCmyk(newCmyk);
    
    const newHex = cmykToHex(newCmyk.c, newCmyk.m, newCmyk.y, newCmyk.k);
    setHex(newHex);
    onChange(newHex);
    addSavedColor(newHex);
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      {/* Native Color Picker + Hex Input */}
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={hex.length === 7 ? hex : '#000000'}
          onChange={(e) => {
            const newHex = e.target.value.toUpperCase();
            setHex(newHex);
            setCmyk(hexToCmyk(newHex));
            onChange(newHex);
            addSavedColor(newHex);
          }}
          className="w-7 h-7 shrink-0 rounded cursor-pointer bg-transparent border border-white/10 p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded"
        />
        
        {'EyeDropper' in window && (
          <button
            onClick={() => {
              const eyeDropper = new (window as any).EyeDropper();
              eyeDropper.open().then((result: any) => {
                const newHex = result.sRGBHex.toUpperCase();
                setHex(newHex);
                setCmyk(hexToCmyk(newHex));
                onChange(newHex);
                addSavedColor(newHex);
              }).catch((e: any) => console.error(e));
            }}
            title="Pick color from screen"
            className="w-7 h-7 shrink-0 rounded flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors text-white/70 hover:text-white"
          >
            <Pipette size={14} />
          </button>
        )}

        <div className="flex-1 flex items-center bg-white/6 border border-white/10 rounded h-7 transition-colors focus-within:border-blue-500/70 overflow-hidden">
          <input
            type="text"
            value={hex}
            onChange={handleHexChange}
            onBlur={handleHexBlur}
            spellCheck={false}
            maxLength={7}
            className="w-full bg-transparent text-[11px] text-white font-mono uppercase outline-none px-2 text-center"
          />
        </div>
      </div>

      {/* CMYK Inputs */}
      <div className="flex items-center gap-1">
        {[
          { id: 'c', label: 'C' },
          { id: 'm', label: 'M' },
          { id: 'y', label: 'Y' },
          { id: 'k', label: 'K' }
        ].map(({ id, label }) => (
          <div key={id} className="flex-1 flex flex-col items-center bg-white/6 border border-white/10 rounded overflow-hidden focus-within:border-blue-500/70">
            <span className="text-[8px] font-semibold text-white/40 pt-1 leading-none select-none">{label}</span>
            <input
              type="text"
              value={cmyk[id as keyof typeof cmyk]}
              onChange={(e) => handleCmykChange(id as any, e.target.value)}
              className="w-full bg-transparent text-center text-[10px] text-white py-1 outline-none font-mono"
            />
          </div>
        ))}
      </div>

      {/* Saved Colors Palette */}
      <div className="flex flex-wrap gap-1.5 mt-1">
        {savedColors.map((color, i) => (
          <button
            key={`${color}-${i}`}
            onClick={() => {
              setHex(color);
              setCmyk(hexToCmyk(color));
              onChange(color);
            }}
            className="w-[18px] h-[18px] rounded cursor-pointer border border-white/10 hover:border-white/50 transition-colors"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}
