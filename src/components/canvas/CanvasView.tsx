import { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import * as fabric from 'fabric';
import { X, ZoomIn, ZoomOut, Image as ImageIcon } from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useProcessStore } from '../../store/useProcessStore';
import { useThumbnails } from '../../hooks/useThumbnails';
import { useSortedLibrary } from '../../hooks/useSortedLibrary';
import { ImageFile } from '../ui/AppProperties';
import CanvasMenuBar from './CanvasMenuBar';
import { useCanvasHistory } from '../../hooks/useCanvasHistory';
import ArtboardCanvas from './ArtboardCanvas';
import CanvasPropertiesPanel from './CanvasPropertiesPanel';
import LayersPanel from './LayersPanel';
import Filmstrip from '../panel/Filmstrip';
import CanvasLeftSidebar from './CanvasLeftSidebar';
import SaveCanvasDialog from './SaveCanvasDialog';
import { addImageToCanvas } from './ArtboardCanvas';
import CanvasRulers from './CanvasRulers';

export default function CanvasView() {
  const { artboardWidth, artboardHeight, closeCanvasView, isCanvasDirty, layers, activeLayerId, setActiveLayer } = useCanvasStore();
  const { imageRatings } = useLibraryStore();
  const { requestThumbnails } = useThumbnails();
  
  const timelineImages = useMemo(() => {
    return layers
      .filter(l => l.type === 'image')
      .map(l => ({
        path: l.id,
        filename: l.name,
        thumbnailUrl: l.thumbnail || '',
        isDirectory: false,
        size: 0,
        mtime: 0,
        extension: 'png',
      } as ImageFile));
  }, [layers]);

  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clipboardRef = useRef<fabric.Object | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [rulerUnit, setRulerUnit] = useState<'px' | 'in' | 'cm'>('px');

  const handleCanvasReady = useCallback((c: fabric.Canvas) => {
    setCanvas(c);
  }, []);

  // Close button: only show save dialog if canvas has unsaved changes
  const handleCloseRequest = useCallback(() => {
    if (isCanvasDirty) {
      setShowSaveDialog(true);
    } else {
      closeCanvasView();
    }
  }, [isCanvasDirty, closeCanvasView]);

  const handleExport = useCallback((format: 'png' | 'jpeg') => {
    if (!canvas) return;
    const dataUrl = canvas.toDataURL({
      format,
      quality: 0.95,
      multiplier: 1,
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `canvas-export.${format}`;
    a.click();
  }, [canvas]);

  const handleZoom = useCallback((action: 'in' | 'out' | 'fit' | '100') => {
    if (!canvas) return;
    let newZoom = canvas.getZoom();
    if (action === 'in') newZoom = Math.min(20, canvas.getZoom() * 1.25);
    if (action === 'out') newZoom = Math.max(0.05, canvas.getZoom() * 0.8);
    if (action === '100') newZoom = 1;
    if (action === 'fit') {
      const container = canvas.getElement().closest('.overflow-auto');
      const cw = container ? container.clientWidth : 800;
      const ch = container ? container.clientHeight : 600;
      const scaleX = (cw - 96) / artboardWidth;
      const scaleY = (ch - 96) / artboardHeight;
      newZoom = Math.min(scaleX, scaleY);
    }
    
    canvas.setZoom(newZoom);
    canvas.setDimensions({ width: artboardWidth * newZoom, height: artboardHeight * newZoom });
    canvas.requestRenderAll();
  }, [canvas, artboardWidth, artboardHeight]);

  const { handleUndo, handleRedo, canUndo, canRedo } = useCanvasHistory(canvas);

  const handleAddImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    await addImageToCanvas(url, file.name.replace(/\.[^.]+$/, ''));
    e.target.value = '';
  }, []);

  const handleFilmstripSelect = useCallback((path: string) => {
    setActiveLayer(path);
    if (canvas) {
      const obj = canvas.getObjects().find((o: any) => o._canvasLayerId === path);
      if (obj) {
        canvas.discardActiveObject();
        canvas.setActiveObject(obj);
        canvas.renderAll();
      }
    }
  }, [setActiveLayer, canvas]);

  const handleDuplicate = useCallback(() => {
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    obj.clone().then((cloned: fabric.Object) => {
      (cloned as any)._canvasLayerId = crypto.randomUUID();
      (cloned as any)._layerName = ((obj as any)._layerName ?? 'Layer') + ' copy';
      cloned.set({ left: (obj.left ?? 0) + 20, top: (obj.top ?? 0) + 20 });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
    });
  }, [canvas]);

  useEffect(() => {
    if (!canvas) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input or contenteditable
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      
      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z') ||
        (cmdOrCtrl && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = canvas?.getActiveObjects() || [];
        if (active.length) {
          active.forEach(o => canvas?.remove(o));
          canvas?.discardActiveObject();
          canvas?.requestRenderAll();
        }
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'c') {
         const obj = canvas.getActiveObject();
         if (obj) {
            obj.clone().then((cloned: fabric.Object) => {
               (cloned as any)._layerName = (obj as any)._layerName;
               clipboardRef.current = cloned;
            });
         }
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'v') {
         if (clipboardRef.current) {
            clipboardRef.current.clone().then((cloned: fabric.Object) => {
              (cloned as any)._canvasLayerId = crypto.randomUUID();
              (cloned as any)._layerName = ((clipboardRef.current as any)._layerName ?? 'Layer') + ' copy';
              cloned.set({
                 left: (cloned.left ?? 0) + 20,
                 top: (cloned.top ?? 0) + 20,
                 evented: true,
              });
              canvas.add(cloned);
              canvas.setActiveObject(cloned);
              canvas.requestRenderAll();
              clipboardRef.current = cloned;
            });
         }
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'a') {
         e.preventDefault();
         canvas.discardActiveObject();
         const sel = new fabric.ActiveSelection(canvas.getObjects().filter(o => o.selectable !== false), { canvas });
         canvas.setActiveObject(sel);
         canvas.requestRenderAll();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvas, handleUndo, handleRedo]);

  return (
    <div
      id="canvas-view-container"
      className="fixed inset-0 z-[8000] flex flex-col"
      style={{ background: '#141414' }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Menu Bar */}
      <CanvasMenuBar
        onExport={handleExport}
        onClose={handleCloseRequest}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onZoom={handleZoom}
        onAddImage={handleAddImage}
        onDuplicate={handleDuplicate}
      />

      {/* Toolbar strip */}
      <div
        className="h-9 flex items-center px-4 gap-4 shrink-0"
        style={{ background: '#1f1f21', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleZoom('out')}
            className="w-7 h-7 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => handleZoom('fit')}
            className="px-2 h-7 rounded text-[11px] text-white/40 hover:text-white hover:bg-white/8 transition-all font-mono"
          >
            Fit
          </button>
          <button
            onClick={() => handleZoom('in')}
            className="w-7 h-7 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        <div className="w-px h-4 bg-white/10" />

        <div className="text-[11px] text-white/30 font-mono">
          {artboardWidth} × {artboardHeight}px
        </div>

        <div className="flex-1" />

        <button
          onClick={handleAddImage}
          className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-all"
        >
          <ImageIcon size={12} /> Add Image
        </button>

        <button
          onClick={handleCloseRequest}
          className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-all"
          title="Exit Canvas"
        >
          <X size={14} />
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        <CanvasLeftSidebar />
        
        {/* Canvas center + bottom filmstrip */}
        <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
          <div 
            ref={containerRef}
            className="flex-1 min-h-0 overflow-auto relative"
            style={{ background: '#1c1c1e' }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const path = e.dataTransfer.getData('text/plain');
              if (path) {
                handleFilmstripSelect(path);
              } else if (e.dataTransfer.files?.length > 0) {
                 const file = e.dataTransfer.files[0];
                 const url = URL.createObjectURL(file);
                 addImageToCanvas(url, file.name.replace(/\.[^.]+$/, ''));
              }
            }}
          >
            <div className="grid place-items-center min-w-full min-h-full p-12 relative z-[1]">
              <ArtboardCanvas
                width={artboardWidth}
                height={artboardHeight}
                onCanvasReady={handleCanvasReady}
              />
            </div>
          </div>
          {/* Filmstrip at the bottom */}
          <div 
            className="h-[120px] shrink-0 border-t flex flex-col"
            style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#1c1c1e' }}
          >
            {timelineImages.length > 0 ? (
              <Filmstrip
                imageList={timelineImages}
                imageRatings={imageRatings}
                selectedPath={activeLayerId || undefined}
                multiSelectedPaths={[]}
                thumbnailAspectRatio="3:2"
                onRequestThumbnails={() => {}}
                onImageSelect={handleFilmstripSelect}
                itemHeight={120}
                setRatio={() => {}}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-white/30 text-xs gap-1">
                <ImageIcon size={16} className="opacity-50" />
                <span>Add an image to the canvas to see it in the timeline here</span>
              </div>
            )}
          </div>
          <CanvasRulers canvasContainerRef={containerRef} fabricCanvas={canvas} unit={rulerUnit} />
        </div>

        {/* Right panel */}
        <div
          className="w-60 flex flex-col shrink-0"
          style={{
            background: '#1c1c1e',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Properties — scrollable top section */}
          <div
            className="flex flex-col border-b"
            style={{
              borderColor: 'rgba(255,255,255,0.07)',
              height: '55%',
              minHeight: '180px',
            }}
          >
            <div
              className="px-3 py-2.5 border-b shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <span className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">
                Properties
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CanvasPropertiesPanel canvas={canvas} />
            </div>
          </div>

          {/* Layers — bottom section */}
          <div className="flex-1 min-h-0">
            <LayersPanel />
          </div>
        </div>
      </div>
      {showSaveDialog && (
        <SaveCanvasDialog
          onSaved={() => { setShowSaveDialog(false); closeCanvasView(); }}
          onDiscard={() => { setShowSaveDialog(false); closeCanvasView(); }}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
}
