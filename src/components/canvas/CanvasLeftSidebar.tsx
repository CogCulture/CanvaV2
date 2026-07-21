import { 
  MousePointer2, 
  MousePointer, 
  Pencil, 
  Square, 
  Circle, 
  Type, 
  Spline,
  Pipette,
  Hand,
  Search, 
  Eraser,
  Lasso
} from 'lucide-react';
import { useState } from 'react';
import { addTextToCanvas } from './ArtboardCanvas';
import { useCanvasStore } from '../../store/useCanvasStore';
import { ColorInput } from './ColorInput';

const TOOLS = [
  { id: 'move', icon: MousePointer2, label: 'Selection / Move Tool (V)' },
  { id: 'pen', icon: Pencil, label: 'Pencil Tool (P)' },
  { id: 'rect', icon: Square, label: 'Rectangle Tool (M)' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse Tool (L)' },
  { id: 'type', icon: Type, label: 'Type Tool (T)' },
  { id: 'type_path', icon: Spline, label: 'Type on Path Tool (Y)' },
  { id: 'lasso', icon: Lasso, label: 'Lasso Selection Tool (S)' },
  { id: 'eraser', icon: Eraser, label: 'Eraser Tool (E)' },
  { id: 'zoom', icon: Search, label: 'Zoom Tool (Z)' },
];

export default function CanvasLeftSidebar() {
  const { 
    activeTool, setActiveTool, 
    penColor, penSize, setPenColor, setPenSize,
    lassoMode, setLassoMode,
    eraserMode, setEraserMode, eraserSize, setEraserSize,
    showRulers, setShowRulers
  } = useCanvasStore();

  return (
    <div 
      className="w-12 shrink-0 flex flex-col items-center py-2 gap-2 relative z-50"
      style={{
        background: '#1c1c1e',
        borderRight: '1px solid rgba(255,255,255,0.07)'
      }}
    >
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => {
              if (tool.id === 'eyedropper' && 'EyeDropper' in window) {
                const eyeDropper = new (window as any).EyeDropper();
                eyeDropper.open().then((result: any) => {
                  setPenColor(result.sRGBHex);
                  setActiveTool('pen');
                }).catch((e: any) => console.error(e));
                return;
              }

              setActiveTool(tool.id);
              if (tool.id === 'type') {
                addTextToCanvas();
                setActiveTool('move'); // switch back to move tool after insertion
              }
            }}
            title={tool.label}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isActive 
                ? 'bg-blue-600 text-white' 
                : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
          </button>
        );
      })}

      <div className="w-8 h-px bg-white/10 my-1 shrink-0" />
      
      <button
        onClick={() => setShowRulers(!showRulers)}
        title="Toggle Rulers & Guidelines"
        className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
          showRulers 
            ? 'bg-blue-600 text-white' 
            : 'text-white/40 hover:text-white hover:bg-white/10'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={showRulers ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>
      </button>

      {activeTool === 'pen' && (
        <div 
          className="absolute bg-[#2a2a2d] border border-white/10 rounded-lg shadow-xl p-3 flex flex-col gap-3 w-48 z-50"
          style={{ left: '60px', top: '4rem' }}
        >
          <div className="text-xs font-semibold text-white/80 uppercase tracking-wider">Pen Settings</div>
          
          <div className="flex flex-col gap-1 w-full">
            <label className="text-xs text-white/60">Color</label>
            <ColorInput value={penColor} onChange={setPenColor} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/60 flex justify-between">
              <span>Size</span>
              <span>{penSize}px</span>
            </label>
            <input 
              type="range" 
              min="1" 
              max="50" 
              value={penSize}
              onChange={(e) => setPenSize(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
        </div>
      )}

      {activeTool === 'lasso' && (
        <div 
          className="absolute bg-[#2a2a2d] border border-white/10 rounded-lg shadow-xl p-3 flex flex-col gap-3 w-48 z-50"
          style={{ left: '60px', top: '10rem' }}
        >
          <div className="text-xs font-semibold text-white/80 uppercase tracking-wider">Lasso Mode</div>
          
          <div className="flex flex-col gap-2 mt-1">
            <button
              onClick={() => setLassoMode('magnetic')}
              className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${lassoMode === 'magnetic' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            >
              Magnetic
            </button>
            <button
              onClick={() => setLassoMode('polygon')}
              className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${lassoMode === 'polygon' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            >
              Polygon
            </button>
            <button
              onClick={() => setLassoMode('freehand')}
              className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${lassoMode === 'freehand' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            >
              Freehand
            </button>
          </div>
        </div>
      )}

      {activeTool === 'eraser' && (
        <div 
          className="absolute bg-[#2a2a2d] border border-white/10 rounded-lg shadow-xl p-3 flex flex-col gap-3 w-48 z-50"
          style={{ left: '60px', top: '13rem' }}
        >
          <div className="text-xs font-semibold text-white/80 uppercase tracking-wider">Eraser</div>
          
          <div className="flex flex-col gap-2 mt-1">
            <button
              onClick={() => setEraserMode('freehand')}
              className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${eraserMode === 'freehand' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            >
              Freehand Eraser
            </button>
            <button
              onClick={() => setEraserMode('object')}
              className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${eraserMode === 'object' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            >
              Select to Erase
            </button>
          </div>

          {eraserMode === 'freehand' && (
            <div className="flex flex-col gap-1 mt-2">
              <label className="flex justify-between text-xs text-white/60">
                <span>Size</span>
                <span>{eraserSize}px</span>
              </label>
              <input 
                type="range" 
                min="1" 
                max="100" 
                value={eraserSize}
                onChange={(e) => setEraserSize(parseInt(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
