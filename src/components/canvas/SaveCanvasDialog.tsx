import { useState } from 'react';
import { Save, X, LogOut } from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { globalFabricCanvas } from './ArtboardCanvas';

interface SaveCanvasDialogProps {
  onSaved: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export default function SaveCanvasDialog({ onSaved, onDiscard, onCancel }: SaveCanvasDialogProps) {
  const { projectTitle, saveCanvas } = useCanvasStore();
  const [name, setName] = useState(projectTitle || 'Untitled Canvas');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const canvas = globalFabricCanvas;
      let fabricJSON = '{}';
      let thumbnail = '';
      if (canvas) {
        fabricJSON = JSON.stringify(canvas.toObject(['_canvasLayerId', '_layerName', '_sourceFilePath', '_sourceDataUrl', '_adjustments', '_originalDataUrl']));
        thumbnail = canvas.toDataURL({ format: 'jpeg', quality: 0.5, multiplier: 0.15 });
      }
      saveCanvas(name.trim(), fabricJSON, thumbnail);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div
        className="relative flex flex-col w-[440px] rounded-2xl overflow-hidden"
        style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="text-white text-[16px] font-semibold">Save Canvas</h2>
            <p className="text-white/40 text-[12px] mt-0.5">Save your work before exiting</p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <label className="block text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-2">
            Canvas Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            className="w-full rounded-xl px-4 py-3 text-white text-[14px] outline-none transition-all"
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
            placeholder="Enter canvas name…"
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between gap-3">
          <button
            onClick={onDiscard}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white/50 hover:text-red-400 hover:bg-red-500/10 text-[13px] font-medium transition-all"
          >
            <LogOut size={14} />Exit without saving
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-white/50 hover:text-white bg-white/8 hover:bg-white/15 text-[13px] font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-[13px] font-semibold transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
            >
              <Save size={14} />{saving ? 'Saving…' : 'Save & Exit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
