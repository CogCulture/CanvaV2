import { useEffect, useState, useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { Move, RotateCcw, Maximize2, Blend, Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Underline } from 'lucide-react';
import { ColorInput } from './ColorInput';
import { FontDropdown } from './FontDropdown';
import { applyTextRepeat } from '../../utils/textOnPathUtils';
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
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: string;
  textAlign?: string;
  underline?: boolean;
  isTypeOnPath?: boolean;
  repeatTextToFit?: boolean;
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
      className="flex-1 min-w-0 w-full bg-white/6 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white outline-none focus:border-blue-500/70 transition-colors text-center"
    />
  </div>
);

export default function CanvasPropertiesPanel({ canvas }: CanvasPropertiesPanelProps) {
  const { activeLayerId, updateLayer, clearGuides, guides, activeGuideId, setGuides, setActiveGuideId, rulerUnit, setRulerUnit } = useCanvasStore();
  const [props, setProps] = useState<ObjProps | null>(null);

  const readProps = useCallback(() => {
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) { setProps(null); return; }
    
    let fill = typeof obj.fill === 'string' ? obj.fill : '#000000';
    let stroke = typeof obj.stroke === 'string' ? obj.stroke : '#000000';
    
    setProps({
      x: Math.round(obj.left ?? 0),
      y: Math.round(obj.top ?? 0),
      w: Math.round((obj.width ?? 0) * (obj.scaleX ?? 1)),
      h: Math.round((obj.height ?? 0) * (obj.scaleY ?? 1)),
      angle: Math.round(obj.angle ?? 0),
      opacity: Math.round((obj.opacity ?? 1) * 100),
      blend: (obj.globalCompositeOperation as string) || 'source-over',
      type: obj.type ?? 'object',
      fill,
      stroke,
      strokeWidth: obj.strokeWidth || 0,
      fontFamily: (obj as any).fontFamily || 'Open Sans',
      fontSize: (obj as any).fontSize || 40,
      fontWeight: (obj as any).fontWeight || 'normal',
      fontStyle: (obj as any).fontStyle || 'normal',
      textAlign: (obj as any).textAlign || 'left',
      underline: (obj as any).underline || false,
      isTypeOnPath: !!(obj as any)._isTypeOnPath,
      repeatTextToFit: !!(obj as any)._repeatTextToFit,
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

  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

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
    } else if (key === 'fontFamily') {
      obj.set('fontFamily', value);
      if ((obj as any).styles) {
        for (const lineIndex in (obj as any).styles) {
          for (const charIndex in (obj as any).styles[lineIndex]) {
            if ((obj as any).styles[lineIndex][charIndex].fontFamily) {
              delete (obj as any).styles[lineIndex][charIndex].fontFamily;
            }
          }
        }
      }
      if ((obj as any).isEditing) {
        (obj as any).setSelectionStyles({ fontFamily: value });
        if ((obj as any).hiddenTextarea) {
          (obj as any).hiddenTextarea.style.fontFamily = `"${value}"`;
        }
        (obj as any).initDimensions();
      }
      if ('fonts' in document) {
        document.fonts.load(`10pt "${value}"`).then(() => {
          canvas.requestRenderAll();
        }).catch(() => {});
      }
    } else if (key === 'repeatTextToFit') {
      obj.set('_repeatTextToFit', value);
      if (value) {
        applyTextRepeat(obj as any);
      } else if (!value && (obj as any)._originalText) {
        obj.set('text', (obj as any)._originalText);
      }
    } else {
      obj.set({ [key]: value } as any);
    }
    obj.setCoords();
    canvas.renderAll();
    readProps();

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      canvas.fire('object:modified', { target: obj });
    }, 500);
  };

  const activeGuide = activeGuideId ? guides?.find(g => g.id === activeGuideId) : null;
    
  console.log('--- DEBUG PROPS ---', props);

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
            
            <div className="mt-8 w-full px-4 text-left">
              <div className="text-[10px] text-white/50 font-semibold uppercase tracking-widest mb-2">
                Canvas Settings
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[9px] text-white/35 w-20 shrink-0 font-mono">Ruler Unit</span>
                <select
                  value={rulerUnit}
                  onChange={(e) => setRulerUnit(e.target.value as 'px' | 'in' | 'cm')}
                  className="flex-1 bg-white/6 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white outline-none focus:border-blue-500/70 transition-colors"
                >
                  <option value="px">Pixels (px)</option>
                  <option value="in">Inches (in)</option>
                  <option value="cm">Centimeters (cm)</option>
                </select>
              </div>
            </div>
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

  return (
    <div className="p-3 space-y-4 overflow-y-auto flex-1 select-none">
      {/* Transform */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[9px] text-white/30 uppercase tracking-widest font-semibold">
          <Move size={9} /> Transform (Type: {props.type})
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

      {/* Text Properties */}
      {(props.type === 'text' || props.type === 'i-text' || props.type === 'textbox') && (
        <div className="space-y-2 pt-3 border-t border-white/6">
          <div className="flex items-center gap-1.5 text-[9px] text-white/30 uppercase tracking-widest font-semibold">
            <Type size={9} /> Text
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/35 w-12 shrink-0">Font</span>
              <FontDropdown 
                value={props.fontFamily || 'Open Sans'} 
                onChange={(v) => applyProp('fontFamily', v)} 
              />
              <input
                type="number"
                min={1}
                max={500}
                value={props.fontSize}
                onChange={(e) => applyProp('fontSize', Number(e.target.value))}
                className="w-12 bg-white/6 border border-white/10 rounded-md px-1 py-1 text-[11px] text-white outline-none focus:border-blue-500/70 transition-colors text-center shrink-0"
              />
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] text-white/35 w-12 shrink-0">Style</span>
              <div className="flex bg-white/6 rounded-md overflow-hidden border border-white/10">
                <button
                  onClick={() => applyProp('fontWeight', props.fontWeight === 'bold' ? 'normal' : 'bold')}
                  className={`p-1.5 transition-colors ${props.fontWeight === 'bold' ? 'bg-blue-600/30 text-blue-400' : 'text-white/60 hover:bg-white/10'}`}
                >
                  <Bold size={12} />
                </button>
                <button
                  onClick={() => applyProp('fontStyle', props.fontStyle === 'italic' ? 'normal' : 'italic')}
                  className={`p-1.5 transition-colors border-l border-white/5 ${props.fontStyle === 'italic' ? 'bg-blue-600/30 text-blue-400' : 'text-white/60 hover:bg-white/10'}`}
                >
                  <Italic size={12} />
                </button>
                <button
                  onClick={() => applyProp('underline', !props.underline)}
                  className={`p-1.5 transition-colors border-l border-white/5 ${props.underline ? 'bg-blue-600/30 text-blue-400' : 'text-white/60 hover:bg-white/10'}`}
                >
                  <Underline size={12} />
                </button>
              </div>

              <div className="flex ml-auto bg-white/6 rounded-md overflow-hidden border border-white/10">
                <button
                  onClick={() => applyProp('textAlign', 'left')}
                  className={`p-1.5 transition-colors ${props.textAlign === 'left' ? 'bg-blue-600/30 text-blue-400' : 'text-white/60 hover:bg-white/10'}`}
                >
                  <AlignLeft size={12} />
                </button>
                <button
                  onClick={() => applyProp('textAlign', 'center')}
                  className={`p-1.5 transition-colors border-l border-white/5 ${props.textAlign === 'center' ? 'bg-blue-600/30 text-blue-400' : 'text-white/60 hover:bg-white/10'}`}
                >
                  <AlignCenter size={12} />
                </button>
                <button
                  onClick={() => applyProp('textAlign', 'right')}
                  className={`p-1.5 transition-colors border-l border-white/5 ${props.textAlign === 'right' ? 'bg-blue-600/30 text-blue-400' : 'text-white/60 hover:bg-white/10'}`}
                >
                  <AlignRight size={12} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] text-white/35 w-12 shrink-0">Color</span>
              <ColorInput 
                value={props.fill || '#000000'} 
                onChange={(val) => applyProp('fill', val)} 
                className="w-full"
              />
            </div>
            
            {props.isTypeOnPath && (
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input 
                  type="checkbox" 
                  checked={props.repeatTextToFit} 
                  onChange={(e) => applyProp('repeatTextToFit', e.target.checked)}
                  className="rounded bg-white/10 border-white/20 text-blue-500 focus:ring-blue-500/30"
                />
                <span className="text-[10px] text-white/60">Repeat to fit path</span>
              </label>
            )}
          </div>
        </div>
      )}

      {/* Shape Properties */}
      {props.type && ['rect', 'ellipse', 'circle', 'path', 'polygon', 'line', 'triangle'].includes(props.type.toLowerCase()) && (
        <div className="space-y-2 pt-3 border-t border-white/6">
          <div className="flex items-center gap-1.5 text-[9px] text-white/30 uppercase tracking-widest font-semibold">
            <Maximize2 size={9} /> Shape Properties
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/35 w-12 shrink-0">Fill</span>
              <ColorInput 
                value={props.fill || '#000000'} 
                onChange={(val) => {
                  setProps((p) => p ? { ...p, fill: val } : p);
                  applyProp('fill', val);
                }} 
              />
            </div>
            
            <div className="flex items-start gap-2">
              <div className="flex flex-col w-12 shrink-0 gap-1.5 pt-1">
                <span className="text-[9px] text-white/35">Stroke</span>
                <button
                  title="Toggle transparent stroke"
                  onClick={() => {
                    const isTransparent = props.stroke === 'transparent';
                    const newVal = isTransparent ? '#000000' : 'transparent';
                    setProps((p) => p ? { ...p, stroke: newVal } : p);
                    applyProp('stroke', newVal);
                  }}
                  className={`text-[8px] font-mono px-1 py-0.5 rounded border transition-colors ${
                    props.stroke === 'transparent' 
                      ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' 
                      : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
                  }`}
                >
                  {props.stroke === 'transparent' ? 'NONE' : 'CLEAR'}
                </button>
              </div>
              <div className={`flex-1 transition-opacity ${props.stroke === 'transparent' ? 'opacity-40 pointer-events-none' : ''}`}>
                <ColorInput 
                  value={props.stroke === 'transparent' ? '#000000' : (props.stroke || '#000000')} 
                  onChange={(val) => {
                    setProps((p) => p ? { ...p, stroke: val } : p);
                    applyProp('stroke', val);
                  }} 
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/35 w-12 shrink-0">S. Width</span>
              <input
                type="number"
                min={0}
                value={props.strokeWidth || 0}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setProps((p) => p ? { ...p, strokeWidth: v } : p);
                  applyProp('strokeWidth', v);
                }}
                className="flex-1 bg-white/6 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white outline-none focus:border-blue-500/70 transition-colors"
              />
            </div>
          </div>
        </div>
      )}

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
