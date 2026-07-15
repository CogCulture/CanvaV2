import { useEffect, useState, useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { Move, RotateCcw, Maximize2, Blend, Type } from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';

interface CanvasPropertiesPanelProps {
  canvas: fabric.Canvas | null;
}

interface ObjProps {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  opacity: number;
  blend: string;
  type: string;
}

const BLEND_MODES = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
];

export default function CanvasPropertiesPanel({ canvas }: CanvasPropertiesPanelProps) {
  const { activeLayerId, updateLayer, clearGuides, guides, activeGuideId, setGuides, setActiveGuideId } = useCanvasStore();
  const [props, setProps] = useState<ObjProps | null>(null);

  const readProps = useCallback(() => {
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) { setProps(null); return; }
    setProps({
      x: Math.round(obj.left ?? 0),
      y: Math.round(obj.top ?? 0),
      w: Math.round((obj.width ?? 0) * (obj.scaleX ?? 1)),
      h: Math.round((obj.height ?? 0) * (obj.scaleY ?? 1)),
      angle: Math.round(obj.angle ?? 0),
      opacity: Math.round((obj.opacity ?? 1) * 100),
      blend: (obj.globalCompositeOperation as string) || 'source-over',
      type: obj.type ?? 'object',
    });
  }, [canvas]);

  useEffect(() => {
    if (!canvas) return;
    canvas.on('selection:created', readProps);
    canvas.on('selection:updated', readProps);
    canvas.on('selection:cleared', () => setProps(null));
    canvas.on('object:modified', readProps);
    canvas.on('object:scaling', readProps);
    canvas.on('object:moving', readProps);
    canvas.on('object:rotating', readProps);
    return () => {
      canvas.off('selection:created', readProps);
      canvas.off('selection:updated', readProps);
      canvas.off('selection:cleared');
      canvas.off('object:modified', readProps);
      canvas.off('object:scaling', readProps);
      canvas.off('object:moving', readProps);
      canvas.off('object:rotating', readProps);
    };
  }, [canvas, readProps]);

  const applyProp = (key: string, value: any) => {
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;

    if (key === 'w') {
      obj.set({ scaleX: value / (obj.width || 1) });
    } else if (key === 'h') {
      obj.set({ scaleY: value / (obj.height || 1) });
    } else if (key === 'opacity') {
      const v = value / 100;
      obj.set({ opacity: v });
      // sync to layer store
      const layerId = (obj as any)._canvasLayerId;
      if (layerId) updateLayer(layerId, { opacity: value });
    } else {
      obj.set({ [key]: value } as any);
    }
    obj.setCoords();
    canvas.fire('object:modified', { target: obj });
    canvas.renderAll();
    readProps();
  };

  const activeGuide = activeGuideId ? guides?.find(g => g.id === activeGuideId) : null;

  if (!props || !activeLayerId) {
    return (
      <div className="flex flex-col h-full py-4 text-white/20 select-none overflow-y-auto">
        {activeGuide ? (
          <div className="flex flex-col w-full px-4 mb-4">
            <div className="flex items-center gap-1.5 text-[9px] text-white/30 uppercase tracking-widest font-semibold mb-3">
              <Move size={9} /> Guideline Properties
            </div>
            
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] text-white/35 w-12 shrink-0 font-mono">Axis</span>
              <span className="text-[11px] text-white/80 capitalize">{activeGuide.axis}</span>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] text-white/35 w-12 shrink-0 font-mono">Pos (px)</span>
              <input
                type="number"
                value={Math.round(activeGuide.pos)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setGuides(guides.map(g => g.id === activeGuideId ? { ...g, pos: val } : g));
                }}
                className="flex-1 bg-white/6 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white outline-none focus:border-blue-500/70 transition-colors"
              />
            </div>
            
            <button 
              onClick={() => setActiveGuideId(null)}
              className="px-3 py-1.5 mt-2 text-[10px] uppercase tracking-wider font-semibold bg-white/10 text-white/60 hover:bg-white/20 hover:text-white rounded transition-colors w-full"
            >
              Deselect Guideline
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 w-full my-8">
            <Move size={22} className="mb-2 opacity-40" />
            <p className="text-[11px] text-center leading-relaxed">
              Select a layer or guideline<br />to view properties
            </p>
          </div>
        )}

        {guides?.length > 0 && (
          <div className="mt-auto pt-4 border-t border-white/10 w-full px-4 flex justify-center shrink-0">
            <button 
              onClick={clearGuides}
              className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors w-full"
            >
              Clear Guidelines
            </button>
          </div>
        )}
      </div>
    );
  }

  const Field = ({
    label, value, onChange, min, max, step = 1,
  }: {
    label: string; value: number; onChange: (v: number) => void;
    min?: number; max?: number; step?: number;
  }) => (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-white/35 w-5 shrink-0 font-mono">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 bg-white/6 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white outline-none focus:border-blue-500/70 transition-colors text-center"
      />
    </div>
  );

  return (
    <div className="p-3 space-y-4 overflow-y-auto flex-1 select-none">
      {/* Transform */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[9px] text-white/30 uppercase tracking-widest font-semibold">
          <Move size={9} /> Transform
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="X" value={props.x} onChange={(v) => applyProp('left', v)} />
          <Field label="Y" value={props.y} onChange={(v) => applyProp('top', v)} />
          <Field label="W" value={props.w} min={1} onChange={(v) => applyProp('w', v)} />
          <Field label="H" value={props.h} min={1} onChange={(v) => applyProp('h', v)} />
        </div>
        <Field label="°" value={props.angle} min={-360} max={360} onChange={(v) => applyProp('angle', v)} />
      </div>

      {/* Opacity */}
      <div className="space-y-2 pt-3 border-t border-white/6">
        <div className="flex items-center gap-1.5 text-[9px] text-white/30 uppercase tracking-widest font-semibold">
          <Maximize2 size={9} /> Appearance
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/35 w-12 shrink-0">Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={props.opacity}
              onChange={(e) => {
                const v = Number(e.target.value);
                setProps((p) => p ? { ...p, opacity: v } : p);
                applyProp('opacity', v);
              }}
              className="flex-1 h-1.5 rounded-full accent-blue-500"
            />
            <span className="text-[11px] text-white/60 w-8 text-right font-mono">{props.opacity}%</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/35 w-12 shrink-0">Blend</span>
            <select
              value={props.blend}
              onChange={(e) => {
                setProps((p) => p ? { ...p, blend: e.target.value } : p);
                applyProp('globalCompositeOperation', e.target.value);
              }}
              className="flex-1 bg-white/6 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white outline-none focus:border-blue-500/70 transition-colors"
            >
              {BLEND_MODES.map((m) => (
                <option key={m.value} value={m.value} style={{ background: '#1c1c1e' }}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Guidelines */}
      {guides?.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-white/6">
          <div className="flex items-center gap-1.5 text-[9px] text-white/30 uppercase tracking-widest font-semibold">
            Guidelines
          </div>
          <button 
            onClick={clearGuides}
            className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded transition-colors w-full"
          >
            Clear All Guidelines ({guides.length})
          </button>
        </div>
      )}
    </div>
  );
}
