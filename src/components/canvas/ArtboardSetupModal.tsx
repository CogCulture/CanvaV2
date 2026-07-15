import { useState } from 'react';
import { X, Monitor, Smartphone, Square, Layout } from 'lucide-react';
import { ARTBOARD_PRESETS, ArtboardPreset } from '../../store/useCanvasStore';
import { useCanvasStore } from '../../store/useCanvasStore';

const PRESET_ICONS: Record<string, any> = {
  '16:9': Monitor,
  '9:16': Smartphone,
  '1:1': Square,
  '4:3': Layout,
  '3:4': Layout,
  'custom': Layout,
};

export default function ArtboardSetupModal() {
  const { isSetupModalOpen, closeSetupModal, openCanvasView, pendingImagePath, pendingImageDataUrl } =
    useCanvasStore();

  const [selected, setSelected] = useState<ArtboardPreset>(ARTBOARD_PRESETS[0]);
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);

  if (!isSetupModalOpen) return null;

  const handleConfirm = () => {
    const preset =
      selected.ratio === 'custom'
        ? { ...selected, width: customW, height: customH }
        : selected;
    openCanvasView(preset, pendingImagePath, pendingImageDataUrl ?? undefined);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={closeSetupModal}
      />

      {/* Modal */}
      <div
        className="relative bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl w-[560px] max-h-[85vh] overflow-hidden flex flex-col"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div>
            <h2 className="text-white text-[17px] font-semibold tracking-tight">New Canvas</h2>
            <p className="text-white/40 text-[12px] mt-0.5">Choose artboard dimensions</p>
          </div>
          <button
            onClick={closeSetupModal}
            className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-3 gap-3">
            {ARTBOARD_PRESETS.map((preset) => {
              const Icon = PRESET_ICONS[preset.ratio] || Layout;
              const isActive = selected.name === preset.name;
              const aspectW = preset.width / Math.max(preset.width, preset.height);
              const aspectH = preset.height / Math.max(preset.width, preset.height);

              return (
                <button
                  key={preset.name}
                  onClick={() => setSelected(preset)}
                  className={`flex flex-col items-center gap-3 p-4 rounded-xl border transition-all group ${
                    isActive
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-white/8 bg-white/4 hover:bg-white/8 hover:border-white/20'
                  }`}
                >
                  {/* Preview box */}
                  <div className="flex items-center justify-center w-16 h-14">
                    <div
                      className={`rounded-sm border-2 transition-colors ${
                        isActive ? 'border-blue-400 bg-blue-500/20' : 'border-white/25 bg-white/8'
                      }`}
                      style={{
                        width: `${Math.round(aspectW * 48)}px`,
                        height: `${Math.round(aspectH * 48)}px`,
                        minWidth: '20px',
                        minHeight: '20px',
                      }}
                    />
                  </div>

                  <div className="text-center">
                    <div className={`text-[12px] font-medium leading-tight ${isActive ? 'text-blue-300' : 'text-white/80'}`}>
                      {preset.name}
                    </div>
                    {preset.ratio !== 'custom' && (
                      <div className="text-[10px] text-white/35 mt-0.5 font-mono">
                        {preset.width}×{preset.height}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom size inputs */}
          {selected.ratio === 'custom' && (
            <div className="mt-5 p-4 bg-white/4 rounded-xl border border-white/8">
              <p className="text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-3">
                Custom Size
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-white/40 text-[10px] block mb-1.5">Width (px)</label>
                  <input
                    type="number"
                    value={customW}
                    min={100}
                    max={8000}
                    onChange={(e) => setCustomW(Number(e.target.value))}
                    className="w-full bg-[#0a0a0a] border border-white/15 rounded-lg px-3 py-2 text-white text-[13px] outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="text-white/30 text-lg font-light mt-4">×</div>
                <div className="flex-1">
                  <label className="text-white/40 text-[10px] block mb-1.5">Height (px)</label>
                  <input
                    type="number"
                    value={customH}
                    min={100}
                    max={8000}
                    onChange={(e) => setCustomH(Number(e.target.value))}
                    className="w-full bg-[#0a0a0a] border border-white/15 rounded-lg px-3 py-2 text-white text-[13px] outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between">
          <div className="text-white/35 text-[12px]">
            {selected.ratio !== 'custom'
              ? `${selected.width} × ${selected.height}px · ${selected.ratio}`
              : `${customW} × ${customH}px · Custom`}
          </div>
          <div className="flex gap-3">
            <button
              onClick={closeSetupModal}
              className="px-4 py-2 rounded-lg bg-white/8 hover:bg-white/15 text-white/70 hover:text-white text-[13px] font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold transition-all shadow-lg shadow-blue-500/25"
            >
              Create Canvas →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
