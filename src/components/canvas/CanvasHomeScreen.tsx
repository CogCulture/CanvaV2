import { useState } from 'react';
import { Plus, Trash2, FolderOpen, Clock, Layout } from 'lucide-react';
import { useCanvasStore, SavedCanvas, ARTBOARD_PRESETS } from '../../store/useCanvasStore';
import ArtboardSetupModal from './ArtboardSetupModal';

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function CanvasCard({ canvas, onOpen, onDelete }: { canvas: SavedCanvas; onOpen: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className="group relative rounded-2xl overflow-hidden cursor-pointer flex flex-col"
      style={{
        background: '#1c1c1e',
        border: hovered ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)',
        transition: 'all 0.2s ease',
        boxShadow: hovered ? '0 8px 32px rgba(99,102,241,0.15)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}
      onClick={onOpen}
    >
      {/* Thumbnail */}
      <div className="relative flex-1 min-h-0" style={{ background: '#111113', minHeight: '160px' }}>
        {canvas.thumbnail ? (
          <img src={canvas.thumbnail} alt={canvas.name} className="w-full h-full object-contain" style={{ display: 'block' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layout size={32} className="text-white/15" />
          </div>
        )}
        <div
          className="absolute inset-0 flex items-center justify-center transition-all duration-200"
          style={{ background: hovered ? 'rgba(0,0,0,0.55)' : 'transparent' }}
        >
          {hovered && (
            <button
              className="px-4 py-2 rounded-xl text-white text-[13px] font-semibold transition-all"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
            >Open</button>
          )}
        </div>
        {hovered && (
          <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
            {confirmDelete ? (
              <div className="flex gap-1">
                <button className="px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-red-600 hover:bg-red-500 transition-all" onClick={() => onDelete()}>Delete</button>
                <button className="px-2 py-1 rounded-lg text-[11px] text-white/60 bg-white/10 hover:bg-white/20 transition-all" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            ) : (
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-red-400 transition-all"
                style={{ background: 'rgba(0,0,0,0.5)' }}
                onClick={() => setConfirmDelete(true)}
                title="Delete canvas"
              ><Trash2 size={14} /></button>
            )}
          </div>
        )}
      </div>
      {/* Footer */}
      <div className="px-3 py-2.5 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-white/90 text-[13px] font-medium truncate">{canvas.name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-white/35 font-mono">{canvas.width}×{canvas.height}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
          <span className="flex items-center gap-1 text-[10px] text-white/30">
            <Clock size={9} />{formatDate(canvas.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CanvasHomeScreen() {
  const { isCanvasHomeOpen, savedCanvases, deleteSavedCanvas, openCanvasView, openSetupModal } = useCanvasStore();

  if (!isCanvasHomeOpen) return null;

  const handleOpenSaved = (canvas: SavedCanvas) => {
    const preset = ARTBOARD_PRESETS.find((p) => p.width === canvas.width && p.height === canvas.height) ??
      { name: 'Custom', width: canvas.width, height: canvas.height, ratio: 'custom' };
    openCanvasView(preset, null, undefined, canvas);
  };

  const handleNewCanvas = () => openSetupModal('', undefined);

  return (
    <>
      <div className="fixed inset-0 z-[8000] flex flex-col overflow-hidden" style={{ background: '#0f0f11' }}>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <h1 className="text-white text-[22px] font-bold tracking-tight">Canvas Projects</h1>
            <p className="text-white/40 text-[13px] mt-0.5">
              {savedCanvases.length === 0 ? 'No projects yet — create your first canvas' : `${savedCanvases.length} project${savedCanvases.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={handleNewCanvas}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-[14px] font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}
          >
            <Plus size={16} />New Canvas
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {savedCanvases.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6" style={{ minHeight: '400px' }}>
              <div className="w-24 h-24 rounded-3xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Layout size={40} style={{ color: '#6366f1' }} />
              </div>
              <div className="text-center">
                <h2 className="text-white text-[18px] font-semibold">No canvases yet</h2>
                <p className="text-white/40 text-[13px] mt-1">Create your first canvas to get started</p>
              </div>
              <button
                onClick={handleNewCanvas}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white text-[14px] font-semibold transition-all"
                style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}
              >
                <Plus size={16} />Create Canvas
              </button>
            </div>
          ) : (
            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {/* New canvas card */}
              <button
                onClick={handleNewCanvas}
                className="rounded-2xl flex flex-col items-center justify-center gap-3 transition-all"
                style={{ background: 'rgba(99,102,241,0.06)', border: '2px dashed rgba(99,102,241,0.3)', minHeight: '220px' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.5)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.3)'; }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                  <Plus size={22} style={{ color: '#6366f1' }} />
                </div>
                <div className="text-center">
                  <div className="text-white/70 text-[13px] font-medium">New Canvas</div>
                  <div className="text-white/30 text-[11px] mt-0.5">Choose a size to start</div>
                </div>
              </button>
              {savedCanvases.map((canvas) => (
                <CanvasCard key={canvas.id} canvas={canvas} onOpen={() => handleOpenSaved(canvas)} onDelete={() => deleteSavedCanvas(canvas.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="shrink-0 flex items-center px-8 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
          <span className="text-white/20 text-[11px] font-mono">RapidRAW Canvas</span>
        </div>
      </div>
      <ArtboardSetupModal />
    </>
  );
}
