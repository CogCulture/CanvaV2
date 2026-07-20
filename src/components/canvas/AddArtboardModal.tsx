import { useState } from 'react';
import { X } from 'lucide-react';
import { ARTBOARD_PRESETS, ArtboardPreset } from '../../store/useCanvasStore';

interface AddArtboardModalProps {
  onAdd: (preset: ArtboardPreset) => void;
  onClose: () => void;
}

export default function AddArtboardModal({ onAdd, onClose }: AddArtboardModalProps) {
  const [selected, setSelected] = useState<ArtboardPreset>(ARTBOARD_PRESETS[0]);
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);

  const handleAdd = () => {
    if (selected.ratio === 'custom') {
      onAdd({ name: 'Custom', width: customW, height: customH, ratio: 'custom' });
    } else {
      onAdd(selected);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[420px] rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#1e1e20', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="text-white font-semibold text-sm">Add Artboard</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Preset grid */}
        <div className="p-4">
          <div className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-3">
            Preset Sizes
          </div>
          <div className="grid grid-cols-3 gap-2">
            {ARTBOARD_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => setSelected(preset)}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all text-left"
                style={{
                  background: selected.name === preset.name ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selected.name === preset.name ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {/* Aspect-ratio thumbnail */}
                <div className="w-full flex items-center justify-center" style={{ height: 36 }}>
                  <div
                    style={{
                      background: selected.name === preset.name ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.15)',
                      borderRadius: 3,
                      ...(preset.width >= preset.height
                        ? { width: 32, height: Math.round(32 * (preset.height / preset.width)) }
                        : { height: 32, width: Math.round(32 * (preset.width / preset.height)) }),
                    }}
                  />
                </div>
                <span className="text-[10px] text-white/70 font-medium text-center leading-tight">
                  {preset.name}
                </span>
                {preset.ratio !== 'custom' && (
                  <span className="text-[9px] text-white/30 font-mono">
                    {preset.width}×{preset.height}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Custom dimensions */}
          {selected.ratio === 'custom' && (
            <div className="mt-4 flex gap-3">
              <div className="flex-1">
                <div className="text-[10px] text-white/40 mb-1.5 font-medium">Width (px)</div>
                <input
                  type="number"
                  value={customW}
                  onChange={(e) => setCustomW(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/70 transition-colors"
                />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-white/40 mb-1.5 font-medium">Height (px)</div>
                <input
                  type="number"
                  value={customH}
                  onChange={(e) => setCustomH(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/70 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Add button */}
          <button
            onClick={handleAdd}
            className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            Add Artboard
          </button>
        </div>
      </div>
    </div>
  );
}
