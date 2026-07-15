import { useEffect, useRef, useCallback } from 'react';
import * as fabric from 'fabric';
import { useCanvasStore, CanvasLayer } from '../../store/useCanvasStore';
import { useProcessStore } from '../../store/useProcessStore';
import { convertShapeToTextPath, createTextOnPath } from '../../utils/textOnPathUtils';
import { v4 as uuidv4 } from 'uuid';

interface ArtboardCanvasProps {
  width: number;
  height: number;
  onCanvasReady?: (canvas: fabric.Canvas) => void;
}

export let globalFabricCanvas: fabric.Canvas | null = null;

export default function ArtboardCanvas({ width, height, onCanvasReady }: ArtboardCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spaceHeld = useRef(false);
  const isPanning = useRef(false);
  const lastPan = useRef<{ x: number; y: number } | null>(null);
  
  // Drawing state refs
  const isDrawingShape = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentShape = useRef<any>(null);

  // Lasso state
  const isLassoing = useRef(false);
  const lassoPoints = useRef<{x: number, y: number}[]>([]);
  const lastMousePos = useRef<{x: number, y: number} | null>(null);

  const { addLayer, removeLayer, setActiveLayer, updateLayer, setLayers, layers, initialImageDataUrl, activeTool, setActiveTool, penColor, penSize, setPenColor, lassoMode, markCanvasDirty } =
    useCanvasStore();

  const syncLayers = useCallback(
    (canvas: fabric.Canvas) => {
      const objects = canvas.getObjects().filter((o: any) => o._canvasLayerId);
      const newLayers: CanvasLayer[] = objects
        .map((obj: any) => ({
          id: obj._canvasLayerId as string,
          name: obj._layerName as string,
          fabricObjectId: obj._canvasLayerId as string,
          visible: obj.visible !== false,
          locked: !obj.selectable,
          opacity: Math.round((obj.opacity ?? 1) * 100),
          type: (obj.type === 'image' ? 'image' : (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') ? 'text' : 'shape') as any,
          thumbnail: obj.type === 'image' && typeof obj.getSrc === 'function' ? obj.getSrc() : undefined,
        }))
        .reverse(); // topmost first
      setLayers(newLayers);
    },
    [setLayers],
  );

  // Initialize canvas once
  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current || !containerRef.current) return;

    const scrollContainer = containerRef.current.closest('.overflow-auto') as HTMLElement;
    const cw = scrollContainer ? scrollContainer.clientWidth : 800;
    const ch = scrollContainer ? scrollContainer.clientHeight : 600;

    const scaleX = (cw - 96) / width;
    const scaleY = (ch - 96) / height;
    const initialZoom = Math.min(scaleX, scaleY);

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: width * initialZoom,
      height: height * initialZoom,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      enableRetinaScaling: true,
    });
    canvas.setZoom(initialZoom);

    fabricRef.current = canvas;
    globalFabricCanvas = canvas;
    (window as any).__fabricCanvas = canvas;
    if (onCanvasReady) onCanvasReady(canvas);

    // Sync white div wrapper size with canvas container to reflect zoom
    const wrapper = canvas.getElement().closest('.canvas-container') as HTMLElement;
    let wrapperRo: ResizeObserver | null = null;
    if (wrapper && containerRef.current) {
      wrapperRo = new ResizeObserver(() => {
        if (containerRef.current) {
          containerRef.current.style.width = wrapper.style.width;
          containerRef.current.style.height = wrapper.style.height;
        }
      });
      wrapperRo.observe(wrapper);
    }

    // ── Drag Drop & Wheel Zoom ─────────────────────────────────────────
    const handleDragOverNative = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const handleDropNative = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const path = e.dataTransfer?.getData('text/plain');
      if (path) {
        const processStore = useProcessStore.getState();
        const url = processStore.previews[path]?.dataUrl || processStore.thumbnails[path]?.dataUrl || path;
        const filename = path.split(/[\\/]/).pop() || 'Image';
        addImageToCanvas(url, filename.replace(/\.[^.]+$/, ''));
      } else if (e.dataTransfer?.files?.length) {
        const file = e.dataTransfer.files[0];
        const url = URL.createObjectURL(file);
        addImageToCanvas(url, file.name.replace(/\.[^.]+$/, ''));
      }
    };
    const container = containerRef.current;
    container.addEventListener('dragenter', handleDragOverNative, { capture: true });
    container.addEventListener('dragover', handleDragOverNative, { capture: true });
    container.addEventListener('drop', handleDropNative, { capture: true });
    
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      let newZoom = Math.max(0.05, Math.min(20, canvas.getZoom() * factor));
      canvas.setZoom(newZoom);
      canvas.setDimensions({ width: width * newZoom, height: height * newZoom });
      canvas.requestRenderAll();
    };
    const upperCanvas = canvas.getElement().parentElement as HTMLElement;
    upperCanvas?.addEventListener('wheel', handleWheel, { passive: false });

    // ── Space + drag to pan ───────────────────────────────────────────
    const kd = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (e.code === 'Space' && !spaceHeld.current && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
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
      
      const scrollContainer = containerRef.current?.closest('.overflow-auto') as HTMLElement;
      if (scrollContainer) {
        scrollContainer.scrollLeft -= dx;
        scrollContainer.scrollTop -= dy;
      }
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

    // ── Delete selected with Backspace / Delete ───────────────────────
    const handleDelete = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      const obj = canvas.getActiveObject() as any;
      if (!obj) return;
      const layerId = obj._canvasLayerId;
      canvas.remove(obj);
      canvas.discardActiveObject();
      canvas.renderAll();
      if (layerId) removeLayer(layerId);
      syncLayers(canvas);
    };
    window.addEventListener('keydown', handleDelete);

    // ── Lasso Extract with Enter ───────────────────────────────────────
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && useCanvasStore.getState().activeTool === 'lasso') {
        if (lassoPoints.current.length < 3) {
          return;
        }
        
        try {
          // Determine bounding box of lasso points
          const xs = lassoPoints.current.map(p => p.x);
          const ys = lassoPoints.current.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const width = maxX - minX;
          const height = maxY - minY;

          const oldPoints = [...lassoPoints.current];
          lassoPoints.current = [];
          canvas.requestRenderAll();

          // Wait a frame so the blue line is removed from the canvas
          setTimeout(() => {
            try {
              const lowerCanvasEl = (canvas as any).getElement ? (canvas as any).getElement() : (canvas as any).lowerCanvasEl;
              const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
              const zoom = vpt[0];
              
              // Retina scaling ratio (Physical pixels / Logical pixels)
              const scaleX = lowerCanvasEl.width / (canvas.getWidth() || 1);
              const scaleY = lowerCanvasEl.height / (canvas.getHeight() || 1);
              
              // Bounding box in Physical Viewport coordinates
              const vMinX = (minX * zoom + vpt[4]) * scaleX;
              const vMinY = (minY * vpt[3] + vpt[5]) * scaleY;
              const physWidth = width * zoom * scaleX;
              const physHeight = height * vpt[3] * scaleY;

              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = physWidth;
              tempCanvas.height = physHeight;
              const ctx = tempCanvas.getContext('2d');
              if (!ctx) return;
              
              // Clip path offset by vMinX/vMinY in physical pixels
              ctx.beginPath();
              for (let i = 0; i < oldPoints.length; i++) {
                const px = (oldPoints[i].x * zoom + vpt[4]) * scaleX;
                const py = (oldPoints[i].y * vpt[3] + vpt[5]) * scaleY;
                if (i === 0) ctx.moveTo(px - vMinX, py - vMinY);
                else ctx.lineTo(px - vMinX, py - vMinY);
              }
              ctx.closePath();
              ctx.clip();
              
              // Draw the raw HTML canvas, offset perfectly to the bounding box
              ctx.drawImage(lowerCanvasEl, -vMinX, -vMinY);
              
              const extractedDataUrl = tempCanvas.toDataURL('image/png');
              fabric.FabricImage.fromURL(extractedDataUrl).then(fabImg => {
                const layerId = uuidv4();
                (fabImg as any)._canvasLayerId = layerId;
                (fabImg as any)._layerName = 'Lasso Extract';
                fabImg.set({
                  left: minX,
                  top: minY,
                  scaleX: 1 / (zoom * scaleX),
                  scaleY: 1 / (vpt[3] * scaleY),
                });
                canvas.add(fabImg);
                
                // cleanup
                lassoPoints.current = [];
                isLassoing.current = false;
                lastMousePos.current = null;
                
                canvas.discardActiveObject();
                canvas.setActiveObject(fabImg);
                canvas.requestRenderAll();
                syncLayers(canvas);
                setActiveTool('move');
              });
            } catch (e) {
              console.error("DOM Extraction failed", e);
            }
          }, 50);
          
          
        } catch (err: any) {
          console.error("Failed to extract lasso:", err);
        }
      }
    };
    window.addEventListener('keydown', handleEnter);

    // ── Selection sync ────────────────────────────────────────────────
    canvas.on('selection:created', (e: any) => {
      const obj = e.selected?.[0] as any;
      if (obj?._canvasLayerId) setActiveLayer(obj._canvasLayerId);
    });
    canvas.on('selection:updated', (e: any) => {
      const obj = e.selected?.[0] as any;
      if (obj?._canvasLayerId) setActiveLayer(obj._canvasLayerId);
    });
    canvas.on('selection:cleared', () => setActiveLayer(null));

    canvas.on('path:created', (e: any) => {
      const path = e.path;
      if (path) {
        path._canvasLayerId = uuidv4();
        path._layerName = 'Pen Stroke';
      }
    });

    canvas.on('object:modified', () => { syncLayers(canvas); markCanvasDirty(); });
    canvas.on('object:added', () => { syncLayers(canvas); markCanvasDirty(); });
    canvas.on('object:removed', () => { syncLayers(canvas); markCanvasDirty(); });

    return () => {
      if (wrapperRo) wrapperRo.disconnect();
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore from a previously saved canvas JSON
  useEffect(() => {
    const { pendingRestoredCanvas } = useCanvasStore.getState();
    if (!pendingRestoredCanvas || !fabricRef.current) return;
    const canvas = fabricRef.current;
    try {
      const json = JSON.parse(pendingRestoredCanvas.fabricJSON);
      canvas.loadFromJSON(json).then(() => {
        // Re-tag all objects so custom properties survive serialization
        canvas.getObjects().forEach((obj: any, index: number) => {
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
        canvas.requestRenderAll();
        syncLayers(canvas);
        useCanvasStore.getState().markCanvasClean();
      });
    } catch (e) {
      console.error('[ArtboardCanvas] Failed to restore canvas from JSON:', e);
    }
  // Run once after canvas is ready, keyed on pendingRestoredCanvas id
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabricRef.current]);

  useEffect(() => {
    if (!initialImageDataUrl || !fabricRef.current) return;
    const canvas = fabricRef.current;
    // We get initialImagePath from store to ensure we remember the original source file path!
    const { initialImagePath } = useCanvasStore.getState();

    fabric.FabricImage.fromURL(initialImageDataUrl, { crossOrigin: 'anonymous' }).then((img) => {
      const scale = Math.min((width * 0.85) / (img.width || 1), (height * 0.85) / (img.height || 1));
      const layerId = uuidv4();
      (img as any)._canvasLayerId = layerId;
      (img as any)._layerName = 'Image Layer';
      if (initialImagePath) {
        (img as any)._sourceFilePath = initialImagePath;
      }

      img.set({
        scaleX: scale,
        scaleY: scale,
        left: (width - (img.width || 0) * scale) / 2,
        top: (height - (img.height || 0) * scale) / 2,
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      syncLayers(canvas);
    });
  }, [initialImageDataUrl, width, height, syncLayers]);

  // ── Active Tool Handlers ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Reset everything first
    if (activeTool !== 'pen') {
      canvas.isDrawingMode = false;
    }
    
    // Only allow selection and object interaction if we are in 'move' tool
    const isMove = activeTool === 'move';
    canvas.selection = isMove;
    canvas.defaultCursor = 'default';
    
    if (!isMove) {
      canvas.discardActiveObject();
    }

    canvas.getObjects().forEach((o) => {
      // For eraser, we need them to be evented to catch the click
      o.selectable = isMove;
      o.evented = isMove || activeTool === 'eraser' || activeTool === 'type_path';
    });

    const onMouseDown = (o: any) => {
      if (activeTool === 'rect' || activeTool === 'ellipse') {
        isDrawingShape.current = true;
        const pointer = o.scenePoint || o.pointer || (canvas.getPointer ? canvas.getPointer(o.e) : {x:0,y:0});
        startPos.current = { x: pointer.x, y: pointer.y };

        if (activeTool === 'rect') {
          currentShape.current = new fabric.Rect({
            left: startPos.current.x,
            top: startPos.current.y,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: '#000000',
            strokeWidth: 2,
            selectable: false,
          });
        } else if (activeTool === 'ellipse') {
          currentShape.current = new fabric.Ellipse({
            left: startPos.current.x,
            top: startPos.current.y,
            originX: 'center',
            originY: 'center',
            rx: 0,
            ry: 0,
            fill: 'transparent',
            stroke: '#000000',
            strokeWidth: 2,
            selectable: false,
          });
        }
        (currentShape.current as any)._canvasLayerId = uuidv4();
        (currentShape.current as any)._layerName = activeTool === 'rect' ? 'Rectangle' : 'Ellipse';
        canvas.add(currentShape.current);
      } else if (activeTool === 'hand') {
        isPanning.current = true;
        lastPan.current = { x: o.e.clientX, y: o.e.clientY };
      } else if (activeTool === 'type_path') {
        if (o.target && (o.target.type === 'path' || o.target.type === 'rect' || o.target.type === 'ellipse')) {
          convertShapeToTextPath(o.target, canvas);
          syncLayers(canvas);
          setActiveTool('move'); // Back to move tool after converting
        } else {
          // Start freehand path drawing
          isDrawingShape.current = true;
          const pointer = o.scenePoint || o.pointer || (canvas.getPointer ? canvas.getPointer(o.e) : {x:0,y:0});
          lassoPoints.current = [{x: pointer.x, y: pointer.y}];
          lastMousePos.current = {x: pointer.x, y: pointer.y};
          canvas.requestRenderAll();
        }
      } else if (activeTool === 'eraser') {
        if (o.target) {
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
            if (activeObj) {
              activeObj.set('fill', color);
              canvas.requestRenderAll();
              syncLayers(canvas);
            }
            setPenColor(color);
            setActiveTool('pen');
          } catch (err) {
            console.error("Canvas is tainted, cannot sample color:", err);
          }
        }
      } else if (activeTool === 'type_path' && isDrawingShape.current) {
        const pointer = o.scenePoint || o.pointer || (canvas.getPointer ? canvas.getPointer(o.e) : {x:0,y:0});
        lassoPoints.current.push({x: pointer.x, y: pointer.y});
        lastMousePos.current = {x: pointer.x, y: pointer.y};
        canvas.requestRenderAll();
      } else if (activeTool === 'lasso') {
        const pointer = o.scenePoint || o.pointer || (canvas.getPointer ? canvas.getPointer(o.e) : {x:0,y:0});
        
        if (lassoMode === 'polygon') {
          // Polygon mode: click to add points
          if (lassoPoints.current.length === 0) {
            lassoPoints.current = [{x: pointer.x, y: pointer.y}];
          } else {
            lassoPoints.current.push({x: pointer.x, y: pointer.y});
          }
          lastMousePos.current = {x: pointer.x, y: pointer.y};
          canvas.requestRenderAll();
        } else {
          // Freehand & Magnetic mode: start drag
          isLassoing.current = true;
          lassoPoints.current = [{x: pointer.x, y: pointer.y}];
          lastMousePos.current = {x: pointer.x, y: pointer.y};
          canvas.requestRenderAll();
        }
      }
    };

    const onMouseMove = (o: any) => {
      if (isDrawingShape.current && currentShape.current) {
        const pointer = o.scenePoint || o.pointer || (canvas.getPointer ? canvas.getPointer(o.e) : {x:0,y:0});
        const { x: startX, y: startY } = startPos.current;
        if (activeTool === 'rect') {
          currentShape.current.set({
            width: Math.abs(pointer.x - startX),
            height: Math.abs(pointer.y - startY),
            left: Math.min(pointer.x, startX),
            top: Math.min(pointer.y, startY),
          });
        } else if (activeTool === 'ellipse') {
          currentShape.current.set({
            rx: Math.abs(pointer.x - startX) / 2,
            ry: Math.abs(pointer.y - startY) / 2,
            left: Math.min(pointer.x, startX) + Math.abs(pointer.x - startX) / 2,
            top: Math.min(pointer.y, startY) + Math.abs(pointer.y - startY) / 2,
          });
        }
        canvas.requestRenderAll();
      } else if (activeTool === 'lasso') {
        const pointer = o.scenePoint || o.pointer || (canvas.getPointer ? canvas.getPointer(o.e) : {x:0,y:0});
        
        if (lassoMode === 'polygon' && lassoPoints.current.length > 0) {
          // Show preview of next segment
          lastMousePos.current = {x: pointer.x, y: pointer.y};
          canvas.requestRenderAll();
        } else if (isLassoing.current && (lassoMode === 'freehand' || lassoMode === 'magnetic')) {
          let pt = {x: pointer.x, y: pointer.y};
          
          // Very basic magnetic snapping logic
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
                  const rx = (screenX) * (el.width / rect.width);
                  const ry = (screenY) * (el.height / rect.height);
                  
                  const s = 10;
                  const imgData = ctx.getImageData(rx - s, ry - s, s*2, s*2).data;
                  let maxGrad = 0;
                  let bestDX = 0;
                  let bestDY = 0;
                  
                  for(let y=1; y<s*2-1; y+=2) {
                    for(let x=1; x<s*2-1; x+=2) {
                      const idx = (y * (s*2) + x) * 4;
                      const val = imgData[idx] + imgData[idx+1] + imgData[idx+2];
                      const idxR = (y * (s*2) + x + 1) * 4;
                      const valR = imgData[idxR] + imgData[idxR+1] + imgData[idxR+2];
                      const idxD = ((y+1) * (s*2) + x) * 4;
                      const valD = imgData[idxD] + imgData[idxD+1] + imgData[idxD+2];
                      
                      const grad = Math.abs(val - valR) + Math.abs(val - valD);
                      if (grad > maxGrad) {
                        maxGrad = grad;
                        bestDX = x - s;
                        bestDY = y - s;
                      }
                    }
                  }
                  
                  if (maxGrad > 50) {
                    pt.x += bestDX / vpt[0];
                    pt.y += bestDY / vpt[3];
                  }
                }
              }
            } catch(e) {}
          }
          
          lassoPoints.current.push(pt);
          lastMousePos.current = {x: pt.x, y: pt.y};
          canvas.requestRenderAll();
        }
      }
    };

    const onMouseUp = () => {
      if (isDrawingShape.current && currentShape.current) {
        isDrawingShape.current = false;
        currentShape.current.set({ selectable: true });
        currentShape.current.setCoords();
        canvas.setActiveObject(currentShape.current);
        canvas.fire('object:modified', { target: currentShape.current });
        currentShape.current = null;
        syncLayers(canvas);
        setActiveTool('move'); // Switch back to move tool
      }
      if (activeTool === 'type_path' && isDrawingShape.current) {
        isDrawingShape.current = false;
        if (lassoPoints.current.length > 2) {
           const p = lassoPoints.current;
           let pathStr = "M " + p[0].x + " " + p[0].y;
           for (let i = 1; i < p.length; i++) {
              pathStr += " L " + p[i].x + " " + p[i].y;
           }
           const pathObj = new fabric.Path(pathStr, { 
             fill: 'transparent', stroke: 'transparent', objectCaching: false 
           });
           createTextOnPath(pathObj, canvas);
           syncLayers(canvas);
           setActiveTool('move');
        }
        lassoPoints.current = [];
        lastMousePos.current = null;
        canvas.requestRenderAll();
      }
      if (activeTool === 'hand') {
        isPanning.current = false;
        lastPan.current = null;
      }
      if (activeTool === 'lasso' && isLassoing.current && (lassoMode === 'freehand' || lassoMode === 'magnetic')) {
        isLassoing.current = false;
        // Wait for Enter to crop
      }
    };

    if (activeTool === 'pen') {
      canvas.isDrawingMode = true;
      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      }
      canvas.freeDrawingBrush.color = penColor;
      canvas.freeDrawingBrush.width = penSize;
    } else if (activeTool === 'eraser') {
      canvas.defaultCursor = 'crosshair';
      canvas.selection = false;
    } else if (activeTool === 'type_path') {
      canvas.defaultCursor = 'crosshair';
      canvas.selection = false;
      canvas.getObjects().forEach((o) => { o.evented = true; });
    } else if (activeTool === 'rect' || activeTool === 'ellipse') {
      canvas.defaultCursor = 'crosshair';
      canvas.selection = false;
      canvas.getObjects().forEach((o) => { o.evented = false; });
    } else if (activeTool === 'eyedropper') {
      canvas.defaultCursor = 'crosshair';
    } else if (activeTool === 'move') {
      canvas.defaultCursor = 'default';
    } else if (activeTool === 'direct-select') {
      canvas.defaultCursor = 'cell';
    } else if (activeTool === 'lasso') {
      canvas.defaultCursor = 'crosshair';
      canvas.selection = false;
      canvas.getObjects().forEach((o) => { o.evented = false; });
      
      // Cleanup lasso if switching out and back, unless we want to keep it
      // Let's keep it if they just changed modes within lasso, but if they switch to lasso from move, 
      // we don't necessarily clear it unless they start drawing.
    }

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      
      // Cleanup tool overlays
      if (activeTool !== 'lasso' && activeTool !== 'type_path') {
        lassoPoints.current = [];
        lastMousePos.current = null;
        canvas.requestRenderAll();
      }
    };
  }, [activeTool, setActiveTool, penColor, penSize, syncLayers, removeLayer, lassoMode]);

  useEffect(() => {
    if (!globalFabricCanvas) return;
    const canvas = globalFabricCanvas;
    
    // Draw Lasso overlay directly to canvas context
    const renderLasso = (opt: any) => {
      const { activeTool, lassoMode } = useCanvasStore.getState();
      if ((activeTool !== 'lasso' && activeTool !== 'type_path') || lassoPoints.current.length === 0) return;
      
      const ctx = opt.ctx;
      if (!ctx) return;
      
      ctx.save();
      
      // Transform context to canvas viewport to match pointer coordinates correctly
      const vpt = canvas.viewportTransform;
      if (vpt) {
        ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
      }

      ctx.beginPath();
      ctx.moveTo(lassoPoints.current[0].x, lassoPoints.current[0].y);
      for (let i = 1; i < lassoPoints.current.length; i++) {
        ctx.lineTo(lassoPoints.current[i].x, lassoPoints.current[i].y);
      }
      
      // If polygon, draw line to current mouse position
      if (lassoMode === 'polygon' && lastMousePos.current) {
         ctx.lineTo(lastMousePos.current.x, lastMousePos.current.y);
      }
      
      if (lassoMode === 'polygon' || lassoMode === 'freehand' || lassoMode === 'magnetic') {
        ctx.closePath();
      }

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
    return () => {
      canvas.off('after:render', renderLasso);
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="relative outline-none shadow-[0_20px_40px_rgba(0,0,0,0.5)] bg-white" 
      tabIndex={0}
      style={{ width: fabricRef.current?.getWidth() ?? width, height: fabricRef.current?.getHeight() ?? height }}
    >
      <canvas ref={canvasElRef} />
    </div>
  );
}

/** Utility: add a remote image URL to the canvas */
export async function addImageToCanvas(url: string, name: string = 'Image', sourcePath?: string) {
  const canvas = globalFabricCanvas;
  if (!canvas) return;
  const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
  
  const scale = Math.min((canvas.getWidth() * 0.7) / (img.width || 1), (canvas.getHeight() * 0.7) / (img.height || 1));
  const layerId = uuidv4();
  (img as any)._canvasLayerId = layerId;
  (img as any)._layerName = name;
  // Store original file path for re-opening in the main editor
  if (sourcePath) (img as any)._sourceFilePath = sourcePath;
  img.set({
    scaleX: scale,
    scaleY: scale,
    left: (1080 - (img.width || 0) * scale) / 2,
    top: (1080 - (img.height || 0) * scale) / 2,
  });
  canvas.add(img);
  canvas.setActiveObject(img);
  canvas.renderAll();
}

/** Utility: add a text box to the canvas */
export function addTextToCanvas() {
  const canvas = globalFabricCanvas;
  if (!canvas) return;
  
  const text = new fabric.Textbox('Type something...', {
    left: 1080 / 2 - 100,
    top: 1080 / 2 - 20,
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
