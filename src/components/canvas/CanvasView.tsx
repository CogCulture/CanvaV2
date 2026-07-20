import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import * as fabric from 'fabric';
import { X, ZoomIn, ZoomOut, Image as ImageIcon, LayoutTemplate } from 'lucide-react';
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
import AddArtboardModal from './AddArtboardModal';

/** HTML overlay label positioned above each artboard rect */
function ArtboardLabels({ fabricCanvas }: { fabricCanvas: fabric.Canvas | null }) {
  const { artboards, activeArtboardId } = useCanvasStore();
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!fabricCanvas) return;
    const update = () => forceRender(n => n + 1);
    fabricCanvas.on('after:render', update);
    return () => { fabricCanvas.off('after:render', update); };
  }, [fabricCanvas]);

  if (!fabricCanvas) return null;

  const vpt = fabricCanvas.viewportTransform;
  if (!vpt) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[8005]">
      {artboards.map(board => {
        // Bottom right corner of the artboard in screen coordinates
        const screenX = (board.x + board.width) * vpt[0] + vpt[4];
        const screenY = (board.y + board.height) * vpt[3] + vpt[5];
        const isActive = board.id === activeArtboardId;
        return (
          <div
            key={board.id}
            className="absolute"
            style={{ left: screenX, top: screenY + 4, transform: 'translateX(-100%)' }}
          >
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded select-none ${
                isActive ? 'text-cyan-400' : 'text-cyan-700/50'
              }`}
              style={{ fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}
            >
              {board.name} — {board.width} × {board.height}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const SCROLLBAR_SIZE = 12; // px

/** Custom scrollbar overlay that reflects / controls the fabric viewport transform */
function CanvasScrollbars({ fabricCanvas }: { fabricCanvas: fabric.Canvas | null }) {
  const { artboards } = useCanvasStore();
  const [vpt, setVpt] = useState<number[]>([1, 0, 0, 1, 0, 0]);
  const [canvasSize, setCanvasSize] = useState({ w: 1, h: 1 });
  const isDraggingH = useRef(false);
  const isDraggingV = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, vptX: 0, vptY: 0 });

  useEffect(() => {
    if (!fabricCanvas) return;
    const update = () => {
      const v = fabricCanvas.viewportTransform;
      if (v) setVpt([...v]);
      setCanvasSize({ w: fabricCanvas.getWidth(), h: fabricCanvas.getHeight() });
    };
    update();
    fabricCanvas.on('after:render', update);
    return () => { fabricCanvas.off('after:render', update); };
  }, [fabricCanvas]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!fabricCanvas) return;
      const v = [...(fabricCanvas.viewportTransform ?? [1, 0, 0, 1, 0, 0])];

      if (isDraggingH.current) {
        const { worldMin, worldMax, thumbRatio } = computeH();
        const worldRange = worldMax - worldMin;
        const trackW = canvasSize.w - SCROLLBAR_SIZE;
        const dx = e.clientX - dragStart.current.mouseX;
        // how much world-space to scroll per pixel of thumb travel
        const dWorld = (dx / (trackW * (1 - thumbRatio))) * worldRange;
        // dragStart.vptX is the viewport offset at drag start; shift it by -dWorld * zoom
        v[4] = dragStart.current.vptX - dWorld * v[0];
        (fabricCanvas as any).viewportTransform = v;
        fabricCanvas.requestRenderAll();
      }
      if (isDraggingV.current) {
        const { worldMin, worldMax, thumbRatio } = computeV();
        const worldRange = worldMax - worldMin;
        const trackH = canvasSize.h - SCROLLBAR_SIZE;
        const dy = e.clientY - dragStart.current.mouseY;
        const dWorld = (dy / (trackH * (1 - thumbRatio))) * worldRange;
        const newVptY = dragStart.current.vptY - dWorld * v[3];
        v[5] = newVptY;
        (fabricCanvas as any).viewportTransform = v;
        fabricCanvas.requestRenderAll();
      }
    };
    const onUp = () => { isDraggingH.current = false; isDraggingV.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [fabricCanvas, canvasSize]);

  // Compute scroll world bounds from artboards (with 200px padding each side)
  const PAD = 200;
  const allX = artboards.flatMap(b => [b.x, b.x + b.width]);
  const allY = artboards.flatMap(b => [b.y, b.y + b.height]);
  const sceneMinX = allX.length ? Math.min(...allX) - PAD : -PAD;
  const sceneMaxX = allX.length ? Math.max(...allX) + PAD : PAD;
  const sceneMinY = allY.length ? Math.min(...allY) - PAD : -PAD;
  const sceneMaxY = allY.length ? Math.max(...allY) + PAD : PAD;

  const zoom = vpt[0] || 1;
  // viewport left edge in scene coords
  const viewLeft = -vpt[4] / zoom;
  const viewRight = viewLeft + canvasSize.w / zoom;
  const viewTop = -vpt[5] / zoom;
  const viewBottom = viewTop + canvasSize.h / zoom;

  const worldMinX = Math.min(sceneMinX, viewLeft);
  const worldMaxX = Math.max(sceneMaxX, viewRight);
  const worldMinY = Math.min(sceneMinY, viewTop);
  const worldMaxY = Math.max(sceneMaxY, viewBottom);

  function computeH() {
    const worldRange = worldMaxX - worldMinX;
    const thumbRatio = Math.min(1, (viewRight - viewLeft) / worldRange);
    const thumbLeft = ((viewLeft - worldMinX) / worldRange) * (canvasSize.w - SCROLLBAR_SIZE);
    const thumbWidth = thumbRatio * (canvasSize.w - SCROLLBAR_SIZE);
    return { worldMin: worldMinX, worldMax: worldMaxX, thumbRatio, thumbLeft, thumbWidth };
  }
  function computeV() {
    const worldRange = worldMaxY - worldMinY;
    const thumbRatio = Math.min(1, (viewBottom - viewTop) / worldRange);
    const thumbTop = ((viewTop - worldMinY) / worldRange) * (canvasSize.h - SCROLLBAR_SIZE);
    const thumbHeight = thumbRatio * (canvasSize.h - SCROLLBAR_SIZE);
    return { worldMin: worldMinY, worldMax: worldMaxY, thumbRatio, thumbTop, thumbHeight };
  }

  const h = computeH();
  const v = computeV();
  const showH = h.thumbRatio < 0.999;
  const showV = v.thumbRatio < 0.999;
  if (!showH && !showV) return null;

  const trackStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
  };
  const thumbStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.22)',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.1s',
  };

  return (
    <>
      {/* Horizontal scrollbar */}
      {showH && (
        <div
          className="absolute bottom-0 left-0 z-[8090] pointer-events-auto"
          style={{ ...trackStyle, height: SCROLLBAR_SIZE, right: showV ? SCROLLBAR_SIZE : 0 }}
        >
          <div
            className="absolute top-1 bottom-1 hover:bg-white/40"
            style={{
              ...thumbStyle,
              left: Math.max(0, h.thumbLeft),
              width: Math.max(24, h.thumbWidth),
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              isDraggingH.current = true;
              dragStart.current = {
                mouseX: e.clientX,
                mouseY: e.clientY,
                vptX: fabricCanvas?.viewportTransform?.[4] ?? 0,
                vptY: fabricCanvas?.viewportTransform?.[5] ?? 0,
              };
            }}
          />
        </div>
      )}
      {/* Vertical scrollbar */}
      {showV && (
        <div
          className="absolute right-0 top-0 z-[8090] pointer-events-auto"
          style={{ ...trackStyle, width: SCROLLBAR_SIZE, bottom: showH ? SCROLLBAR_SIZE : 0 }}
        >
          <div
            className="absolute left-1 right-1 hover:bg-white/40"
            style={{
              ...thumbStyle,
              top: Math.max(0, v.thumbTop),
              height: Math.max(24, v.thumbHeight),
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              isDraggingV.current = true;
              dragStart.current = {
                mouseX: e.clientX,
                mouseY: e.clientY,
                vptX: fabricCanvas?.viewportTransform?.[4] ?? 0,
                vptY: fabricCanvas?.viewportTransform?.[5] ?? 0,
              };
            }}
          />
        </div>
      )}
    </>
  );
}


export default function CanvasView() {
  const {
    artboardWidth, artboardHeight, closeCanvasView, isCanvasDirty, layers, activeLayerId,
    setActiveLayer, activeGuideId, setActiveGuideId, rulerUnit, artboards, activeArtboardId,
    addArtboard, setActiveArtboard,
  } = useCanvasStore();
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
  const [showAddArtboard, setShowAddArtboard] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(240);
  const isDraggingRightPanel = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRightPanel.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setRightPanelWidth(Math.max(200, Math.min(600, newWidth)));
    };
    const handleMouseUp = () => {
      if (isDraggingRightPanel.current) {
        isDraggingRightPanel.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleCanvasReady = useCallback((c: fabric.Canvas) => {
    setCanvas(c);
  }, []);

  const handleCloseRequest = useCallback(() => {
    if (isCanvasDirty) setShowSaveDialog(true);
    else closeCanvasView();
  }, [isCanvasDirty, closeCanvasView]);

  const handleExport = useCallback((format: 'png' | 'jpeg') => {
    if (!canvas) return;
    const dataUrl = canvas.toDataURL({ format, quality: 0.95, multiplier: 1 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `canvas-export.${format}`;
    a.click();
  }, [canvas]);

  const handleZoom = useCallback((action: 'in' | 'out' | 'fit' | '100') => {
    if (!canvas) return;
    let newZoom = canvas.getZoom();
    if (action === 'in') newZoom = Math.min(20, canvas.getZoom() * 1.25);
    if (action === 'out') newZoom = Math.max(0.02, canvas.getZoom() * 0.8);
    if (action === '100') newZoom = 1;
    if (action === 'fit') {
      const cw = canvas.getWidth();
      const ch = canvas.getHeight();
      // Fit all artboards in view
      const { artboards: boards } = useCanvasStore.getState();
      if (boards.length > 0) {
        const minX = Math.min(...boards.map(b => b.x));
        const minY = Math.min(...boards.map(b => b.y));
        const maxX = Math.max(...boards.map(b => b.x + b.width));
        const maxY = Math.max(...boards.map(b => b.y + b.height));
        const totalW = maxX - minX;
        const totalH = maxY - minY;
        newZoom = Math.min((cw - 120) / totalW, (ch - 120) / totalH);
        canvas.setZoom(newZoom);
        canvas.viewportTransform![4] = (cw - totalW * newZoom) / 2 - minX * newZoom;
        canvas.viewportTransform![5] = (ch - totalH * newZoom) / 2 - minY * newZoom;
        canvas.requestRenderAll();
        return;
      }
    }
    canvas.setZoom(newZoom);
    canvas.requestRenderAll();
  }, [canvas]);

  const { handleUndo, handleRedo, canUndo, canRedo } = useCanvasHistory(canvas);

  const handleAddImage = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) await addImageToCanvas(dataUrl, file.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleFilmstripSelect = useCallback((path: string) => {
    setActiveLayer(path);
    if (canvas) {
      const obj = canvas.getObjects().find((o: any) => o._canvasLayerId === path);
      if (obj) { canvas.discardActiveObject(); canvas.setActiveObject(obj); canvas.renderAll(); }
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

  const handleAddArtboard = useCallback((preset: any) => {
    const { artboards: boards } = useCanvasStore.getState();
    // Place the new artboard to the right of the last one with a gap
    let newX = 0;
    if (boards.length > 0) {
      const lastBoard = boards[boards.length - 1];
      newX = lastBoard.x + lastBoard.width + 80;
    }
    addArtboard(preset, newX, 0);
  }, [addArtboard]);

  useEffect(() => {
    if (!canvas) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault(); handleUndo();
      } else if ((cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z') || (cmdOrCtrl && e.key.toLowerCase() === 'y')) {
        e.preventDefault(); handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = canvas?.getActiveObjects() || [];
        if (active.length) { active.forEach(o => canvas?.remove(o)); canvas?.discardActiveObject(); canvas?.requestRenderAll(); }
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'c') {
        const obj = canvas.getActiveObject();
        if (obj) obj.clone().then((cloned: fabric.Object) => { (cloned as any)._layerName = (obj as any)._layerName; clipboardRef.current = cloned; });
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'v') {
        if (clipboardRef.current) {
          clipboardRef.current.clone().then((cloned: fabric.Object) => {
            (cloned as any)._canvasLayerId = crypto.randomUUID();
            (cloned as any)._layerName = ((clipboardRef.current as any)._layerName ?? 'Layer') + ' copy';
            cloned.set({ left: (cloned.left ?? 0) + 20, top: (cloned.top ?? 0) + 20, evented: true });
            canvas.add(cloned); canvas.setActiveObject(cloned); canvas.requestRenderAll();
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

  const activeBoard = artboards.find(b => b.id === activeArtboardId);

  return (
    <div
      id="canvas-view-container"
      className="fixed inset-0 z-[8000] flex flex-col"
      style={{ background: '#141414' }}
    >
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

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
          <button onClick={() => handleZoom('out')} className="w-7 h-7 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all">
            <ZoomOut size={14} />
          </button>
          <button onClick={() => handleZoom('fit')} className="px-2 h-7 rounded text-[11px] text-white/40 hover:text-white hover:bg-white/8 transition-all font-mono">Fit</button>
          <button onClick={() => handleZoom('in')} className="w-7 h-7 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all">
            <ZoomIn size={14} />
          </button>
        </div>

        <div className="w-px h-4 bg-white/10" />

        <div className="text-[11px] text-white/30 font-mono">
          {activeBoard ? `${activeBoard.name} · ${activeBoard.width} × ${activeBoard.height}px` : `${artboardWidth} × ${artboardHeight}px`}
        </div>

        <div className="flex-1" />

        {/* Add Artboard button */}
        <button
          onClick={() => setShowAddArtboard(true)}
          className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-white/8 hover:bg-white/15 text-white/60 hover:text-white text-[11px] font-medium transition-all"
        >
          <LayoutTemplate size={12} />
          Add Artboard
        </button>

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
          {/* Infinite canvas area - fills the entire space */}
          <div
            ref={containerRef}
            className="flex-1 min-h-0 relative"
            style={{ background: '#1c1c1e' }}
          >
            <ArtboardCanvas onCanvasReady={handleCanvasReady} />

            {/* Artboard name labels overlay */}
            <ArtboardLabels fabricCanvas={canvas} />

            {/* Scrollbars */}
            <CanvasScrollbars fabricCanvas={canvas} />

            <CanvasRulers canvasContainerRef={containerRef} fabricCanvas={canvas} unit={rulerUnit} />
          </div>

          {/* Filmstrip at the bottom */}
          <div
            className="h-[120px] shrink-0 border-t flex flex-col"
            style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#1c1c1e', position: 'relative', zIndex: 8020 }}
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
        </div>

        {/* Right panel */}
        <div
          className="flex flex-col shrink-0 relative"
          style={{ width: rightPanelWidth, background: '#1c1c1e', borderLeft: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Resize handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 hover:bg-blue-500/50 transition-colors"
            style={{ transform: 'translateX(-50%)' }}
            onMouseDown={(e) => {
              e.preventDefault();
              isDraggingRightPanel.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
          />

          {/* Properties — scrollable top section */}
          <div className="flex flex-col border-b" style={{ borderColor: 'rgba(255,255,255,0.07)', height: '55%', minHeight: '180px' }}>
            <div className="px-3 py-2.5 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <span className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">Properties</span>
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

      {showAddArtboard && (
        <AddArtboardModal
          onAdd={handleAddArtboard}
          onClose={() => setShowAddArtboard(false)}
        />
      )}
    </div>
  );
}
