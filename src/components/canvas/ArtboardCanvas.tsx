import { useEffect, useRef, useCallback } from 'react';
import * as fabric from 'fabric';
import { classRegistry, FabricImage } from 'fabric';

classRegistry.setClass(FabricImage, 'Image');
classRegistry.setClass(FabricImage, 'image');
classRegistry.setClass(FabricImage, 'FabricImage');
classRegistry.setClass(FabricImage, 'fabricImage');
import { useCanvasStore, CanvasLayer, Artboard } from '../../store/useCanvasStore';
import { useProcessStore } from '../../store/useProcessStore';
import { convertShapeToTextPath, createTextOnPath } from '../../utils/textOnPathUtils';
import { v4 as uuidv4 } from 'uuid';

interface ArtboardCanvasProps {
  onCanvasReady?: (canvas: fabric.Canvas) => void;
}

export let globalFabricCanvas: fabric.Canvas | null = null;

// Marker used to distinguish artboard background rects from real layers
const ARTBOARD_RECT_MARKER = '__artboardRect__';

/**
 * Returns the artboard (if any) whose bounds contain the object's centre.
 * If the object straddles or sits outside all artboards, returns null.
 */
function getOwningArtboard(obj: fabric.Object, artboards: Artboard[]): Artboard | null {
  const bounds = obj.getBoundingRect();
  const cx = bounds.left + bounds.width / 2;
  const cy = bounds.top + bounds.height / 2;
  for (const board of artboards) {
    if (cx >= board.x && cx <= board.x + board.width && cy >= board.y && cy <= board.y + board.height) {
      return board;
    }
  }
  return null;
}

/**
 * Bakes an eraser stroke (given as scene-coordinate points) into each
 * canvas object it intersects by updating that object's clipPath mask.
 */
function applyEraserStroke(
  canvas: fabric.Canvas,
  points: {x: number; y: number}[],
  brushSize: number,
) {
  if (points.length < 1) return;

  const zoom = canvas.getZoom();
  const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const brushRadius = brushSize / 2;
  const strokeSceneLeft   = Math.min(...xs) - brushRadius;
  const strokeSceneTop    = Math.min(...ys) - brushRadius;
  const strokeSceneRight  = Math.max(...xs) + brushRadius;
  const strokeSceneBottom = Math.max(...ys) + brushRadius;

  const strokeScreenLeft   = strokeSceneLeft   * zoom + vpt[4];
  const strokeScreenTop    = strokeSceneTop    * zoom + vpt[5];
  const strokeScreenRight  = strokeSceneRight  * zoom + vpt[4];
  const strokeScreenBottom = strokeSceneBottom * zoom + vpt[5];

  const targets = canvas.getObjects().filter((obj: any) => {
    if (!obj._canvasLayerId || obj[ARTBOARD_RECT_MARKER]) return false;
    const ob = obj.getBoundingRect();
    return (
      strokeScreenLeft   < ob.left + ob.width  &&
      strokeScreenRight  > ob.left              &&
      strokeScreenTop    < ob.top  + ob.height  &&
      strokeScreenBottom > ob.top
    );
  });

  targets.forEach((obj: any) => {
    const inv = fabric.util.invertTransform(obj.calcTransformMatrix());
    const localPoints = points.map(p => fabric.util.transformPoint(new fabric.Point(p.x, p.y), inv));
    
    let localPathData = `M ${localPoints[0].x} ${localPoints[0].y}`;
    for (let i = 1; i < localPoints.length; i++) {
      localPathData += ` L ${localPoints[i].x} ${localPoints[i].y}`;
    }
    
    const avgScale = ((obj.scaleX || 1) + (obj.scaleY || 1)) / 2;
    const localStrokeWidth = brushSize / avgScale;

    const localErasePath = new fabric.Path(localPathData, {
      fill: '',
      stroke: 'black',
      strokeWidth: localStrokeWidth,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      globalCompositeOperation: 'destination-out',
    });

    if (obj.clipPath && (obj.clipPath as any)._isEraserClipGroup) {
      const clipGroup = obj.clipPath as fabric.Group;
      clipGroup._objects.push(localErasePath);
      localErasePath.group = clipGroup;
      clipGroup.dirty = true;
      obj.dirty = true;
    } else {
      const HUGE = 10000;
      const bgRect = new fabric.Rect({
        left: -HUGE / 2,
        top: -HUGE / 2,
        width: HUGE,
        height: HUGE,
        fill: 'white',
        originX: 'left',
        originY: 'top'
      });

      const clipGroup = new fabric.Group([bgRect], {
        _isEraserClipGroup: true,
        originX: 'center',
        originY: 'center',
        objectCaching: true
      } as any);

      clipGroup._objects.push(localErasePath);
      localErasePath.group = clipGroup;

      obj.clipPath = clipGroup;
      obj.dirty = true;
    }
  });
  
  canvas.requestRenderAll();
}

export default function ArtboardCanvas({ onCanvasReady }: ArtboardCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tracks objects captured at artboard drag-start so they move with the artboard
  const artboardMoveRef = useRef<{
    boardId: string;
    lastX: number;
    lastY: number;
    ownedObjects: fabric.Object[];
  } | null>(null);
  const spaceHeld = useRef(false);
  const isPanning = useRef(false);
  const lastPan = useRef<{ x: number; y: number } | null>(null);

  // Drawing state refs
  const isDrawingShape = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentShape = useRef<any>(null);
  const dimensionLabel = useRef<fabric.Text | null>(null);

  // Eraser freehand state
  const isEraserDrawing = useRef(false);
  const eraserPoints = useRef<{x: number; y: number}[]>([]);
  const eraserCursorPos = useRef<{x: number; y: number} | null>(null);

  // Lasso state
  const isLassoing = useRef(false);
  const lassoPoints = useRef<{x: number, y: number}[]>([]);
  const lastMousePos = useRef<{x: number, y: number} | null>(null);

  const {
    activeLayerIds, addLayer, removeLayer, setActiveLayer, setActiveLayers,
    updateLayer, setLayers, layers, initialImageDataUrl, activeTool, setActiveTool,
    penColor, penSize, setPenColor, lassoMode, eraserMode, eraserSize, markCanvasDirty,
    artboards, activeArtboardId, setActiveArtboard, addArtboard,
  } = useCanvasStore();

  // ── syncLayers: rebuild layer list from fabric objects ────────────────
  const syncLayers = useCallback(
    (canvas: fabric.Canvas) => {
      const storeArtboards = useCanvasStore.getState().artboards;
      const objects = canvas.getObjects().filter((o: any) => o._canvasLayerId && !o[ARTBOARD_RECT_MARKER]);
      const newLayers: CanvasLayer[] = objects
        .map((obj: any) => {
          const owningBoard = getOwningArtboard(obj, storeArtboards);
          return {
            id: obj._canvasLayerId as string,
            name: obj._layerName as string,
            fabricObjectId: obj._canvasLayerId as string,
            visible: obj.visible !== false,
            locked: !obj.selectable,
            opacity: Math.round((obj.opacity ?? 1) * 100),
            type: (obj.type === 'image' ? 'image' : (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') ? 'text' : 'shape') as any,
            thumbnail: obj.type === 'image' && typeof obj.getSrc === 'function' ? obj.getSrc() : undefined,
            artboardId: owningBoard?.id ?? null,
          };
        })
        .reverse(); // topmost first
      setLayers(newLayers);
    },
    [setLayers],
  );

  // ── drawArtboardRects: render/update artboard background rects ─────────
  const drawArtboardRects = useCallback((canvas: fabric.Canvas, boards: Artboard[], activeId: string | null) => {
    // Remove existing artboard rects
    const existing = canvas.getObjects().filter((o: any) => o[ARTBOARD_RECT_MARKER]);
    existing.forEach(o => canvas.remove(o));

    // Draw each artboard
    boards.forEach((board) => {
      const isActive = board.id === activeId;

      const boardRect = new fabric.Rect({
        left: board.x,
        top: board.y,
        originX: 'left',
        originY: 'top',
        width: board.width,
        height: board.height,
        fill: '#ffffff',
        stroke: isActive ? '#6366f1' : 'rgba(255,255,255,0.15)',
        strokeWidth: isActive ? 2 : 1,
        // Movable but no resize / rotate handles
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        hoverCursor: 'move',
        moveCursor: 'move',
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.4)', blur: 24, offsetX: 0, offsetY: 8 }),
      } as any);
      (boardRect as any)[ARTBOARD_RECT_MARKER] = true;
      (boardRect as any).__artboardId = board.id;

      canvas.add(boardRect as any);
      canvas.sendObjectToBack(boardRect as any);
    });

    canvas.requestRenderAll();
  }, []);

  // ── Initialize canvas once ────────────────────────────────────────────
  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const { clientWidth: cw, clientHeight: ch } = container;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: cw,
      height: ch,
      backgroundColor: '#1c1c1e',
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      selection: true,
    });

    // Start the viewport centred on the first artboard
    const { artboards: initialBoards } = useCanvasStore.getState();
    if (initialBoards.length > 0) {
      const b = initialBoards[0];
      const zoom = Math.min((cw - 120) / b.width, (ch - 120) / b.height);
      canvas.setZoom(zoom);
      canvas.viewportTransform![4] = (cw - b.width * zoom) / 2;
      canvas.viewportTransform![5] = (ch - b.height * zoom) / 2;
    }

    fabricRef.current = canvas;
    globalFabricCanvas = canvas;
    useCanvasStore.getState().setFabricCanvas(canvas);
    (window as any).__fabricCanvas = canvas;
    if (onCanvasReady) onCanvasReady(canvas);

    // Draw initial artboard rects
    const { artboards: boards, activeArtboardId } = useCanvasStore.getState();
    drawArtboardRects(canvas, boards, activeArtboardId);

    // ── ResizeObserver keeps canvas sized to its container ─────────────
    const ro = new ResizeObserver(() => {
      if (!container) return;
      const { clientWidth: w, clientHeight: h } = container;
      canvas.setDimensions({ width: w, height: h });
      canvas.requestRenderAll();
    });
    ro.observe(container);

    // ── Drag Drop ──────────────────────────────────────────────────────
    const handleDragOverNative = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const handleDropNative = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const path = e.dataTransfer?.getData('text/plain');
      if (path) {
        const processStore = useProcessStore.getState();
        const url = (processStore.thumbnails[path] as any)?.dataUrl || processStore.thumbnails[path] || path;
        const filename = path.split(/[\\\/]/).pop() || 'Image';
        addImageToCanvas(url, filename.replace(/\.[^.]+$/, ''));
      } else if (e.dataTransfer?.files?.length) {
        const file = e.dataTransfer.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (dataUrl) addImageToCanvas(dataUrl, file.name.replace(/\.[^.]+$/, ''));
        };
        reader.readAsDataURL(file);
      }
    };
    container.addEventListener('dragenter', handleDragOverNative, { capture: true });
    container.addEventListener('dragover', handleDragOverNative, { capture: true });
    container.addEventListener('drop', handleDropNative, { capture: true });

    // ── Wheel zoom (pinch-to-zoom) ─────────────────────────────────────
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.02, Math.min(20, canvas.getZoom() * factor));
      const upperCanvas = canvas.getElement().parentElement as HTMLElement;
      const rect = upperCanvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      canvas.zoomToPoint(new fabric.Point(px, py), newZoom);
      canvas.requestRenderAll();
    };
    const upperCanvas = canvas.getElement().parentElement as HTMLElement;
    upperCanvas?.addEventListener('wheel', handleWheel, { passive: false });

    // ── Space + drag to pan (viewport transform) ───────────────────────
    const kd = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (e.code === 'Space' && !spaceHeld.current && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        spaceHeld.current = true;
        if (upperCanvas) upperCanvas.style.cursor = 'grab';
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
        isPanning.current = false;
        lastPan.current = null;
        if (upperCanvas) upperCanvas.style.cursor = '';
      }
    };
    const md = (e: MouseEvent) => {
      if (!spaceHeld.current) return;
      isPanning.current = true;
      lastPan.current = { x: e.clientX, y: e.clientY };
      if (upperCanvas) upperCanvas.style.cursor = 'grabbing';
    };
    const mm = (e: MouseEvent) => {
      if (!isPanning.current || !lastPan.current) return;
      const dx = e.clientX - lastPan.current.x;
      const dy = e.clientY - lastPan.current.y;
      lastPan.current = { x: e.clientX, y: e.clientY };
      const vpt = canvas.viewportTransform!;
      vpt[4] += dx;
      vpt[5] += dy;
      canvas.requestRenderAll();
    };
    const mu = () => {
      if (!spaceHeld.current) return;
      isPanning.current = false;
      lastPan.current = null;
      if (upperCanvas) upperCanvas.style.cursor = 'grab';
    };

    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    upperCanvas?.addEventListener('mousedown', md);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);

    // ── Delete selected ────────────────────────────────────────────────
    const handleDelete = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      const obj = canvas.getActiveObject() as any;
      if (!obj || obj[ARTBOARD_RECT_MARKER]) return;
      const layerId = obj._canvasLayerId;
      canvas.remove(obj);
      canvas.discardActiveObject();
      canvas.renderAll();
      if (layerId) removeLayer(layerId);
      syncLayers(canvas);
    };
    window.addEventListener('keydown', handleDelete);

    // ── Lasso Enter ────────────────────────────────────────────────────
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && useCanvasStore.getState().activeTool === 'lasso') {
        if (lassoPoints.current.length < 3) return;
        try {
          const xs = lassoPoints.current.map(p => p.x);
          const ys = lassoPoints.current.map(p => p.y);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minY = Math.min(...ys), maxY = Math.max(...ys);
          const w = maxX - minX, h = maxY - minY;
          const oldPoints = [...lassoPoints.current];
          lassoPoints.current = [];
          canvas.requestRenderAll();

          setTimeout(() => {
            try {
              const lowerCanvasEl = (canvas as any).getElement ? (canvas as any).getElement() : (canvas as any).lowerCanvasEl;
              const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
              const zoom = vpt[0];
              const scaleX = lowerCanvasEl.width / (canvas.getWidth() || 1);
              const scaleY = lowerCanvasEl.height / (canvas.getHeight() || 1);
              const vMinX = (minX * zoom + vpt[4]) * scaleX;
              const vMinY = (minY * vpt[3] + vpt[5]) * scaleY;
              const physWidth = w * zoom * scaleX;
              const physHeight = h * vpt[3] * scaleY;

              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = physWidth;
              tempCanvas.height = physHeight;
              const ctx = tempCanvas.getContext('2d');
              if (!ctx) return;
              ctx.beginPath();
              for (let i = 0; i < oldPoints.length; i++) {
                const px = (oldPoints[i].x * zoom + vpt[4]) * scaleX;
                const py = (oldPoints[i].y * vpt[3] + vpt[5]) * scaleY;
                if (i === 0) ctx.moveTo(px - vMinX, py - vMinY);
                else ctx.lineTo(px - vMinX, py - vMinY);
              }
              ctx.closePath();
              ctx.clip();
              ctx.drawImage(lowerCanvasEl, -vMinX, -vMinY);
              const extractedDataUrl = tempCanvas.toDataURL('image/png');
              fabric.FabricImage.fromURL(extractedDataUrl).then(fabImg => {
                const layerId = uuidv4();
                (fabImg as any)._canvasLayerId = layerId;
                (fabImg as any)._layerName = 'Lasso Extract';
                fabImg.set({ left: minX, top: minY, scaleX: 1 / (zoom * scaleX), scaleY: 1 / (vpt[3] * scaleY) });
                canvas.add(fabImg);
                lassoPoints.current = [];
                isLassoing.current = false;
                lastMousePos.current = null;
                canvas.discardActiveObject();
                canvas.setActiveObject(fabImg);
                canvas.requestRenderAll();
                syncLayers(canvas);
                setActiveTool('move');
              });
            } catch (e) { console.error('DOM Extraction failed', e); }
          }, 50);
        } catch (err) { console.error('Failed to extract lasso:', err); }
      }
    };
    window.addEventListener('keydown', handleEnter);

    // ── Artboard click & drag ──────────────────────────────────────────
    canvas.on('mouse:down', (opt: any) => {
      if (opt.target && (opt.target as any)[ARTBOARD_RECT_MARKER]) {
        const boardId = (opt.target as any).__artboardId;
        if (boardId) {
          useCanvasStore.getState().setActiveArtboard(boardId);

          // Capture which objects currently sit inside this artboard
          const board = useCanvasStore.getState().artboards.find(b => b.id === boardId);
          if (board) {
            const owned = canvas.getObjects().filter((o: any) => {
              if (o[ARTBOARD_RECT_MARKER] || !o._canvasLayerId) return false;
              const owningBoard = getOwningArtboard(o, useCanvasStore.getState().artboards);
              return owningBoard?.id === board.id;
            });
            artboardMoveRef.current = {
              boardId,
              lastX: opt.target.left as number,
              lastY: opt.target.top as number,
              ownedObjects: owned,
            };
          }
        }
      } else {
        // Clicked elsewhere — cancel any pending artboard move state
        artboardMoveRef.current = null;
      }
    });

    // ── Artboard drag: move owned objects with the artboard ───────────
    canvas.on('object:moving', (opt: any) => {
      const obj = opt.target as any;
      if (!obj || !obj[ARTBOARD_RECT_MARKER]) return;
      const state = artboardMoveRef.current;
      if (!state || state.boardId !== obj.__artboardId) return;

      const dx = obj.left - state.lastX;
      const dy = obj.top - state.lastY;
      state.lastX = obj.left;
      state.lastY = obj.top;

      state.ownedObjects.forEach(o => {
        o.set({ left: (o.left ?? 0) + dx, top: (o.top ?? 0) + dy });
        o.setCoords();
      });
      canvas.requestRenderAll();
    });

    // ── Artboard dropped: persist new position in store ───────────────
    canvas.on('object:modified', (opt: any) => {
      const obj = opt.target as any;
      if (obj && obj[ARTBOARD_RECT_MARKER]) {
        const boardId = obj.__artboardId;
        useCanvasStore.getState().updateArtboard(boardId, { x: obj.left, y: obj.top });
        artboardMoveRef.current = null;
        // Re-draw rects to restore correct stroke/shadow (modifying clears them)
        const { artboards: boards, activeArtboardId } = useCanvasStore.getState();
        drawArtboardRects(canvas, boards, activeArtboardId);
      }
      syncLayers(canvas);
      markCanvasDirty();
    });

    // ── Selection sync ────────────────────────────────────────────────
    const updateSelection = () => {
      const activeObjects = canvas.getActiveObjects();
      const extractedIds = new Set<string>();
      const traverse = (objs: any[]) => {
        objs.forEach((o: any) => {
          if (o._canvasLayerId && !o[ARTBOARD_RECT_MARKER]) extractedIds.add(o._canvasLayerId);
          if (o.type === 'activeSelection' || o.type === 'group') {
            if (typeof o.getObjects === 'function') traverse(o.getObjects());
          }
        });
      };
      traverse(activeObjects);
      const activeObj = canvas.getActiveObject();
      if (activeObj && !activeObjects.includes(activeObj)) traverse([activeObj]);
      const ids = Array.from(extractedIds);
      if (ids.length > 0) setActiveLayers(ids);
      else setActiveLayers([]);
    };

    canvas.on('selection:created', updateSelection);
    canvas.on('selection:updated', updateSelection);
    canvas.on('selection:cleared', () => setActiveLayers([]));

    canvas.on('path:created', (e: any) => {
      const path = e.path;
      if (!path) return;
      path._canvasLayerId = uuidv4();
      path._layerName = 'Pen Stroke';
      syncLayers(canvas);
      markCanvasDirty();
    });

    canvas.on('object:added', () => { syncLayers(canvas); markCanvasDirty(); });
    canvas.on('object:removed', () => { syncLayers(canvas); markCanvasDirty(); });

    return () => {
      ro.disconnect();
      upperCanvas?.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleDelete);
      window.removeEventListener('keydown', handleEnter);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      upperCanvas?.removeEventListener('mousedown', md);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      container?.removeEventListener('dragenter', handleDragOverNative, { capture: true });
      container?.removeEventListener('dragover', handleDragOverNative, { capture: true });
      container?.removeEventListener('drop', handleDropNative, { capture: true });
      canvas.dispose();
      fabricRef.current = null;
      globalFabricCanvas = null;
      useCanvasStore.getState().setFabricCanvas(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-draw artboard rects whenever artboards or activeArtboardId change ─
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    drawArtboardRects(canvas, artboards, activeArtboardId);
  }, [artboards, activeArtboardId, drawArtboardRects]);

  // ── Restore from a previously saved canvas JSON ───────────────────────
  useEffect(() => {
    const { pendingRestoredCanvas } = useCanvasStore.getState();
    if (!pendingRestoredCanvas || !fabricRef.current) return;
    const canvas = fabricRef.current;
    try {
      const json = JSON.parse(pendingRestoredCanvas.fabricJSON);
      if (json && json.objects) {
        json.objects.forEach((obj: any) => {
          if ((obj.type === 'image' || obj.type === 'Image' || obj.type === 'FabricImage' || obj.type === 'fabricImage') && obj.src && obj.src.startsWith('data:')) {
            delete obj.crossOrigin;
          }
        });
      }
      canvas.loadFromJSON(json).then(() => {
        const loadedObjects = canvas.getObjects().filter((o: any) => !(o as any)[ARTBOARD_RECT_MARKER]);
        if (loadedObjects.length === json.objects.length) {
          loadedObjects.forEach((obj: any, index: number) => {
            const jsonObj = json.objects[index];
            if (jsonObj) {
              obj._canvasLayerId = jsonObj._canvasLayerId;
              obj._layerName = jsonObj._layerName;
              obj._sourceFilePath = jsonObj._sourceFilePath;
              obj._sourceDataUrl = jsonObj._sourceDataUrl;
              obj._originalDataUrl = jsonObj._originalDataUrl;
              obj._adjustments = jsonObj._adjustments;
            }
          });
        }
        canvas.requestRenderAll();
        syncLayers(canvas);
        useCanvasStore.getState().markCanvasClean();
      });
    } catch (e) {
      console.error('[ArtboardCanvas] Failed to restore canvas from JSON:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabricRef.current]);

  // ── Load initial image ────────────────────────────────────────────────
  useEffect(() => {
    if (!initialImageDataUrl || !fabricRef.current) return;
    const canvas = fabricRef.current;
    const { initialImagePath, artboards: boards, activeArtboardId } = useCanvasStore.getState();
    const activeBoard = boards.find(b => b.id === activeArtboardId) ?? boards[0];
    if (!activeBoard) return;

    const imgOpts = initialImageDataUrl.startsWith('data:') ? {} : { crossOrigin: 'anonymous' };
    fabric.FabricImage.fromURL(initialImageDataUrl, imgOpts as any).then((img) => {
      const scale = Math.min((activeBoard.width * 0.85) / (img.width || 1), (activeBoard.height * 0.85) / (img.height || 1));
      const layerId = uuidv4();
      (img as any)._canvasLayerId = layerId;
      (img as any)._layerName = 'Image Layer';
      if (initialImagePath) (img as any)._sourceFilePath = initialImagePath;
      img.set({
        scaleX: scale,
        scaleY: scale,
        left: activeBoard.x + (activeBoard.width - (img.width || 0) * scale) / 2,
        top: activeBoard.y + (activeBoard.height - (img.height || 0) * scale) / 2,
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      syncLayers(canvas);
    });
  }, [initialImageDataUrl, syncLayers]);

  // ── Active Tool Handlers ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (activeTool !== 'pen' && !(activeTool === 'eraser' && eraserMode === 'freehand')) {
      canvas.isDrawingMode = false;
    }
    const isMove = activeTool === 'move';
    canvas.selection = isMove;
    canvas.defaultCursor = 'default';
    if (!isMove) {
      // Only discard if the active object is not an artboard rect (artboards can always be dragged)
      const current = canvas.getActiveObject() as any;
      if (current && !current[ARTBOARD_RECT_MARKER]) canvas.discardActiveObject();
    }

    canvas.getObjects().forEach((o) => {
      if ((o as any)[ARTBOARD_RECT_MARKER]) {
        // Artboard rects are only draggable when in the 'move' tool
        (o as any).selectable = isMove;
        (o as any).evented = true; // Always evented for tool click detection
        return;
      }
      o.selectable = isMove;
      o.evented = isMove || activeTool === 'eraser' || activeTool === 'type_path';
    });

    const onMouseDown = (o: any) => {
      const isArtboardTarget = o.target && (o.target as any)[ARTBOARD_RECT_MARKER];

      // Object-mode eraser: never erase the artboard background rect
      if (isArtboardTarget && activeTool === 'eraser' && eraserMode === 'object') return;
      // Move tool: artboard drag is handled by the global mouse:down handler above, skip here
      if (isArtboardTarget && activeTool === 'move') return;

      if (activeTool === 'eraser' && eraserMode === 'freehand') {
        isEraserDrawing.current = true;
        const pointer = o.scenePoint || o.pointer;
        if (pointer) {
          eraserPoints.current = [{ x: pointer.x, y: pointer.y }];
          eraserCursorPos.current = { x: pointer.x, y: pointer.y };
        }
        return;
      }
      if (activeTool === 'rect' || activeTool === 'ellipse') {
        isDrawingShape.current = true;
        const pointer = o.scenePoint || o.pointer || { x: 0, y: 0 };
        startPos.current = { x: pointer.x, y: pointer.y };
        if (activeTool === 'rect') {
          currentShape.current = new fabric.Rect({
            originX: 'left', originY: 'top',
            left: startPos.current.x, top: startPos.current.y,
            width: 0, height: 0, fill: 'transparent', stroke: '#000000', strokeWidth: 2, selectable: false,
          });
        } else {
          currentShape.current = new fabric.Ellipse({
            left: startPos.current.x, top: startPos.current.y,
            originX: 'center', originY: 'center', rx: 0, ry: 0,
            fill: 'transparent', stroke: '#000000', strokeWidth: 2, selectable: false,
          });
        }
        (currentShape.current as any)._canvasLayerId = uuidv4();
        (currentShape.current as any)._layerName = activeTool === 'rect' ? 'Rectangle' : 'Ellipse';
        canvas.add(currentShape.current);
        dimensionLabel.current = new fabric.Text('', {
          left: startPos.current.x, top: startPos.current.y - 20,
          fontSize: 12, fontFamily: 'Inter, sans-serif', fill: '#ffffff',
          backgroundColor: '#000000', evented: false, selectable: false,
        });
        canvas.add(dimensionLabel.current);
      } else if (activeTool === 'hand') {
        isPanning.current = true;
        lastPan.current = { x: o.e.clientX, y: o.e.clientY };
      } else if (activeTool === 'type_path') {
        if (o.target && (o.target.type === 'path' || o.target.type === 'rect' || o.target.type === 'ellipse')) {
          convertShapeToTextPath(o.target, canvas);
          syncLayers(canvas);
          setActiveTool('move');
        } else {
          isDrawingShape.current = true;
          const pointer = o.scenePoint || o.pointer || { x: 0, y: 0 };
          lassoPoints.current = [{x: pointer.x, y: pointer.y}];
          lastMousePos.current = {x: pointer.x, y: pointer.y};
          canvas.requestRenderAll();
        }
      } else if (activeTool === 'eraser') {
        if (eraserMode === 'object' && o.target && !(o.target as any)[ARTBOARD_RECT_MARKER]) {
          const layerId = o.target._canvasLayerId;
          canvas.remove(o.target);
          if (layerId) removeLayer(layerId);
          syncLayers(canvas);
        }
      } else if (activeTool === 'eyedropper') {
        const e = o.e as MouseEvent;
        const el = canvas.getElement() as HTMLCanvasElement;
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (el.width / rect.width);
        const y = (e.clientY - rect.top) * (el.height / rect.height);
        const ctx = el.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          try {
            const data = ctx.getImageData(x, y, 1, 1).data;
            const color = `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
            const activeObj = canvas.getActiveObject();
            if (activeObj) { activeObj.set('fill', color); canvas.requestRenderAll(); syncLayers(canvas); }
            setPenColor(color);
            setActiveTool('pen');
          } catch (err) { console.error('Canvas is tainted, cannot sample color:', err); }
        }
      } else if (activeTool === 'lasso') {
        const pointer = o.scenePoint || o.pointer || { x: 0, y: 0 };
        if (lassoMode === 'polygon') {
          if (lassoPoints.current.length === 0) lassoPoints.current = [{x: pointer.x, y: pointer.y}];
          else lassoPoints.current.push({x: pointer.x, y: pointer.y});
          lastMousePos.current = {x: pointer.x, y: pointer.y};
          canvas.requestRenderAll();
        } else {
          isLassoing.current = true;
          lassoPoints.current = [{x: pointer.x, y: pointer.y}];
          lastMousePos.current = {x: pointer.x, y: pointer.y};
          canvas.requestRenderAll();
        }
      }
    };

    const onMouseMove = (o: any) => {
      if (activeTool === 'eraser' && eraserMode === 'freehand') {
        const pointer = o.scenePoint || o.pointer;
        if (pointer) {
          eraserCursorPos.current = { x: pointer.x, y: pointer.y };
          if (isEraserDrawing.current) eraserPoints.current.push({ x: pointer.x, y: pointer.y });
          canvas.requestRenderAll();
        }
        return;
      }
      if (isDrawingShape.current && currentShape.current) {
        const pointer = o.scenePoint || o.pointer || { x: 0, y: 0 };
        const { x: startX, y: startY } = startPos.current;
        let w = Math.abs(pointer.x - startX);
        let h = Math.abs(pointer.y - startY);
        if (o.e.shiftKey) { const size = Math.max(w, h); w = size; h = size; }
        if (activeTool === 'rect') {
          currentShape.current.set({ width: w, height: h, left: pointer.x < startX ? startX - w : startX, top: pointer.y < startY ? startY - h : startY });
          if (dimensionLabel.current) dimensionLabel.current.set({ text: ` W: ${Math.round(w)} H: ${Math.round(h)} `, left: pointer.x + 10, top: pointer.y + 10 });
        } else if (activeTool === 'ellipse') {
          currentShape.current.set({ rx: w / 2, ry: h / 2, left: (pointer.x < startX ? startX - w : startX) + w / 2, top: (pointer.y < startY ? startY - h : startY) + h / 2 });
          if (dimensionLabel.current) dimensionLabel.current.set({ text: o.e.shiftKey ? ` R: ${Math.round(w/2)} ` : ` W: ${Math.round(w)} H: ${Math.round(h)} `, left: pointer.x + 10, top: pointer.y + 10 });
        }
        canvas.requestRenderAll();
      } else if (activeTool === 'hand' && isPanning.current && lastPan.current) {
        const dx = o.e.clientX - lastPan.current.x;
        const dy = o.e.clientY - lastPan.current.y;
        lastPan.current = { x: o.e.clientX, y: o.e.clientY };
        const vpt = canvas.viewportTransform!;
        vpt[4] += dx;
        vpt[5] += dy;
        canvas.requestRenderAll();
      } else if (activeTool === 'lasso') {
        const pointer = o.scenePoint || o.pointer || { x: 0, y: 0 };
        if (lassoMode === 'polygon' && lassoPoints.current.length > 0) {
          lastMousePos.current = {x: pointer.x, y: pointer.y};
          canvas.requestRenderAll();
        } else if (isLassoing.current && (lassoMode === 'freehand' || lassoMode === 'magnetic')) {
          let pt = {x: pointer.x, y: pointer.y};
          if (lassoMode === 'magnetic') {
            try {
              const el = canvas.getElement() as HTMLCanvasElement;
              const ctx = el.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                const rect = el.getBoundingClientRect();
                const vpt = canvas.viewportTransform;
                if (vpt) {
                  const screenX = pt.x * vpt[0] + vpt[4];
                  const screenY = pt.y * vpt[3] + vpt[5];
                  const rx = screenX * (el.width / rect.width);
                  const ry = screenY * (el.height / rect.height);
                  const s = 10;
                  const imgData = ctx.getImageData(rx - s, ry - s, s*2, s*2).data;
                  let maxGrad = 0, bestDX = 0, bestDY = 0;
                  for (let y = 1; y < s*2-1; y += 2) {
                    for (let x = 1; x < s*2-1; x += 2) {
                      const idx = (y * (s*2) + x) * 4;
                      const val = imgData[idx] + imgData[idx+1] + imgData[idx+2];
                      const idxR = (y * (s*2) + x + 1) * 4;
                      const valR = imgData[idxR] + imgData[idxR+1] + imgData[idxR+2];
                      const idxD = ((y+1) * (s*2) + x) * 4;
                      const valD = imgData[idxD] + imgData[idxD+1] + imgData[idxD+2];
                      const grad = Math.abs(val - valR) + Math.abs(val - valD);
                      if (grad > maxGrad) { maxGrad = grad; bestDX = x - s; bestDY = y - s; }
                    }
                  }
                  if (maxGrad > 50) { pt.x += bestDX / vpt[0]; pt.y += bestDY / vpt[3]; }
                }
              }
            } catch (e) {}
          }
          lassoPoints.current.push(pt);
          lastMousePos.current = {x: pt.x, y: pt.y};
          canvas.requestRenderAll();
        }
      }
    };

    const onMouseUp = () => {
      if (activeTool === 'eraser' && eraserMode === 'freehand' && isEraserDrawing.current) {
        isEraserDrawing.current = false;
        const pts = eraserPoints.current;
        eraserPoints.current = [];
        if (pts.length > 0) {
          applyEraserStroke(canvas, pts, useCanvasStore.getState().eraserSize);
          setTimeout(() => syncLayers(canvas), 60);
        }
        canvas.requestRenderAll();
        return;
      }
      if (isDrawingShape.current && currentShape.current) {
        isDrawingShape.current = false;
        currentShape.current.set({ selectable: true });
        currentShape.current.setCoords();
        canvas.setActiveObject(currentShape.current);
        canvas.fire('object:modified', { target: currentShape.current });
        currentShape.current = null;
        if (dimensionLabel.current) { canvas.remove(dimensionLabel.current); dimensionLabel.current = null; }
        syncLayers(canvas);
        setActiveTool('move');
      }
      if (activeTool === 'type_path' && isDrawingShape.current) {
        isDrawingShape.current = false;
        if (lassoPoints.current.length > 2) {
          const p = lassoPoints.current;
          let pathStr = 'M ' + p[0].x + ' ' + p[0].y;
          for (let i = 1; i < p.length; i++) pathStr += ' L ' + p[i].x + ' ' + p[i].y;
          const pathObj = new fabric.Path(pathStr, { fill: 'transparent', stroke: 'transparent', objectCaching: false });
          createTextOnPath(pathObj, canvas);
          syncLayers(canvas);
          setActiveTool('move');
        }
        lassoPoints.current = [];
        lastMousePos.current = null;
        canvas.requestRenderAll();
      }
      if (activeTool === 'hand') { isPanning.current = false; lastPan.current = null; }
      if (activeTool === 'lasso' && isLassoing.current && (lassoMode === 'freehand' || lassoMode === 'magnetic')) {
        isLassoing.current = false;
      }
    };

    if (activeTool === 'pen') {
      canvas.isDrawingMode = true;
      if (!canvas.freeDrawingBrush) canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = penColor;
      canvas.freeDrawingBrush.width = penSize;
    } else if (activeTool === 'eraser') {
      canvas.defaultCursor = 'none';
      canvas.selection = false;
      canvas.isDrawingMode = false;
    } else if (activeTool === 'type_path') {
      canvas.defaultCursor = 'crosshair';
      canvas.selection = false;
      canvas.getObjects().forEach((o) => { if (!(o as any)[ARTBOARD_RECT_MARKER]) o.evented = true; });
    } else if (activeTool === 'rect' || activeTool === 'ellipse') {
      canvas.defaultCursor = 'crosshair';
      canvas.selection = false;
      canvas.getObjects().forEach((o) => { if (!(o as any)[ARTBOARD_RECT_MARKER]) o.evented = false; });
    } else if (activeTool === 'eyedropper') {
      canvas.defaultCursor = 'crosshair';
    } else if (activeTool === 'move') {
      canvas.defaultCursor = 'default';
    } else if (activeTool === 'direct-select') {
      canvas.defaultCursor = 'cell';
    } else if (activeTool === 'lasso') {
      canvas.defaultCursor = 'crosshair';
      canvas.selection = false;
      canvas.getObjects().forEach((o) => { if (!(o as any)[ARTBOARD_RECT_MARKER]) o.evented = false; });
    }

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      if (activeTool !== 'lasso' && activeTool !== 'type_path') {
        lassoPoints.current = [];
        lastMousePos.current = null;
        canvas.requestRenderAll();
      }
    };
  }, [activeTool, setActiveTool, penColor, penSize, syncLayers, removeLayer, lassoMode, eraserMode, eraserSize]);

  // ── Overlay: lasso outline + eraser cursor ────────────────────────────
  useEffect(() => {
    if (!globalFabricCanvas) return;
    const canvas = globalFabricCanvas;

    const renderLasso = (opt: any) => {
      const { activeTool, lassoMode, eraserSize } = useCanvasStore.getState();
      const ctx = opt.ctx;
      if (!ctx) return;

      if (activeTool === 'eraser') {
        const cursorPos = eraserCursorPos.current;
        if (!cursorPos) return;
        const zoom = canvas.getZoom() || 1;
        const vpt = canvas.viewportTransform;
        ctx.save();
        if (vpt) ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
        if (isEraserDrawing.current && eraserPoints.current.length > 1) {
          ctx.beginPath();
          ctx.moveTo(eraserPoints.current[0].x, eraserPoints.current[0].y);
          for (let i = 1; i < eraserPoints.current.length; i++) ctx.lineTo(eraserPoints.current[i].x, eraserPoints.current[i].y);
          ctx.strokeStyle = 'rgba(100,100,100,0.5)';
          ctx.lineWidth = eraserSize;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cursorPos.x, cursorPos.y, eraserSize / 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if ((activeTool !== 'lasso' && activeTool !== 'type_path') || lassoPoints.current.length === 0) return;
      ctx.save();
      const vpt = canvas.viewportTransform;
      if (vpt) ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
      ctx.beginPath();
      ctx.moveTo(lassoPoints.current[0].x, lassoPoints.current[0].y);
      for (let i = 1; i < lassoPoints.current.length; i++) ctx.lineTo(lassoPoints.current[i].x, lassoPoints.current[i].y);
      if (lassoMode === 'polygon' && lastMousePos.current) ctx.lineTo(lastMousePos.current.x, lastMousePos.current.y);
      if (lassoMode === 'polygon' || lassoMode === 'freehand' || lassoMode === 'magnetic') ctx.closePath();
      ctx.strokeStyle = '#0099ff';
      const zoom = canvas.getZoom() || 1;
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 153, 255, 0.2)';
      ctx.fill();
      ctx.restore();
    };

    canvas.on('after:render', renderLasso);
    return () => { canvas.off('after:render', renderLasso); };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden" style={{ background: '#1c1c1e' }}>
      <canvas ref={canvasElRef} />
    </div>
  );
}

/** Utility: add a remote image URL to the canvas, centred in the active artboard */
export async function addImageToCanvas(url: string, name: string = 'Image', sourcePath?: string) {
  const canvas = useCanvasStore.getState().fabricCanvas || globalFabricCanvas;
  if (!canvas) return;
  const { artboards, activeArtboardId } = useCanvasStore.getState();
  const activeBoard = artboards.find(b => b.id === activeArtboardId) ?? artboards[0];
  const bw = activeBoard?.width ?? canvas.getWidth();
  const bh = activeBoard?.height ?? canvas.getHeight();
  const bx = activeBoard?.x ?? 0;
  const by = activeBoard?.y ?? 0;

  const imgOpts = url.startsWith('data:') ? {} : { crossOrigin: 'anonymous' };
  const img = await fabric.FabricImage.fromURL(url, imgOpts as any);
  const scale = Math.min((bw * 0.7) / (img.width || 1), (bh * 0.7) / (img.height || 1));
  const layerId = uuidv4();
  (img as any)._canvasLayerId = layerId;
  (img as any)._layerName = name;
  if (sourcePath) (img as any)._sourceFilePath = sourcePath;
  img.set({
    scaleX: scale,
    scaleY: scale,
    left: bx + (bw - (img.width || 0) * scale) / 2,
    top: by + (bh - (img.height || 0) * scale) / 2,
  });
  canvas.add(img);
  canvas.setActiveObject(img);
  canvas.renderAll();
}

/** Utility: add a text box to the canvas, centred in the active artboard */
export function addTextToCanvas() {
  const canvas = useCanvasStore.getState().fabricCanvas || globalFabricCanvas;
  if (!canvas) return;
  const { artboards, activeArtboardId } = useCanvasStore.getState();
  const activeBoard = artboards.find(b => b.id === activeArtboardId) ?? artboards[0];
  const cx = (activeBoard?.x ?? 0) + (activeBoard?.width ?? 1080) / 2;
  const cy = (activeBoard?.y ?? 0) + (activeBoard?.height ?? 1080) / 2;

  const text = new fabric.Textbox('Type something...', {
    left: cx - 100,
    top: cy - 20,
    width: 200,
    fontSize: 40,
    fontFamily: 'Open Sans',
    fill: '#000000',
  });
  const layerId = uuidv4();
  (text as any)._canvasLayerId = layerId;
  (text as any)._layerName = 'Text Layer';
  canvas.add(text);
  canvas.setActiveObject(text);
  canvas.renderAll();
}
