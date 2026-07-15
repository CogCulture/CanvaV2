import { useState, useEffect, useCallback, useRef } from 'react';
import { fabric } from 'fabric';
import { useCanvasStore } from '../store/useCanvasStore';

const MAX_HISTORY = 50;

export const useCanvasHistory = (canvas: fabric.Canvas | null) => {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isProcessingRef = useRef(false);

  const saveHistory = useCallback(() => {
    if (!canvas || isProcessingRef.current) return;
    
    // Save state with custom properties
    const json = JSON.stringify(canvas.toObject(['_canvasLayerId', '_layerName', '_sourceFilePath', '_sourceDataUrl', '_adjustments', '_originalDataUrl']));
    
    setHistory(prev => {
      // Discard any redos if we make a new change
      const newHistory = prev.slice(0, historyIndex + 1);
      
      // Don't save if state hasn't changed (e.g. just selecting an object)
      if (newHistory.length > 0 && newHistory[newHistory.length - 1] === json) {
        return prev;
      }
      
      newHistory.push(json);
      // Cap at MAX_HISTORY
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      } else {
        setHistoryIndex(newHistory.length - 1);
      }
      return newHistory;
    });
  }, [canvas, historyIndex]);

  // Initial save when canvas is ready
  useEffect(() => {
    if (canvas && history.length === 0) {
      saveHistory();
    }
  }, [canvas, history.length, saveHistory]);

  // Attach listeners to canvas events
  useEffect(() => {
    if (!canvas) return;

    const onModified = () => saveHistory();
    const onAdded = (e: fabric.IEvent) => {
      // Avoid saving on initial load or internal canvas operations
      if (!isProcessingRef.current) saveHistory();
    };
    const onRemoved = () => {
      if (!isProcessingRef.current) saveHistory();
    };

    canvas.on('object:modified', onModified);
    canvas.on('object:added', onAdded);
    canvas.on('object:removed', onRemoved);

    return () => {
      canvas.off('object:modified', onModified);
      canvas.off('object:added', onAdded);
      canvas.off('object:removed', onRemoved);
    };
  }, [canvas, saveHistory]);

  const handleUndo = useCallback(() => {
    if (!canvas || historyIndex <= 0 || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    const newIndex = historyIndex - 1;
    
    canvas.loadFromJSON(history[newIndex], () => {
      canvas.renderAll();
      
      // Update layers in the store based on the restored objects
      // Note: ArtboardCanvas's `syncLayers` will be called on next render or by polling if needed,
      // but we can manually trigger a small update to force re-render.
      const objects = canvas.getObjects().filter((o: any) => o._canvasLayerId);
      const restoredLayers = objects.map((obj: any) => ({
        id: obj._canvasLayerId as string,
        name: obj._layerName || 'Layer',
        fabricObjectId: obj._canvasLayerId as string,
        visible: obj.visible ?? true,
        locked: !obj.selectable,
        opacity: obj.opacity ?? 1,
        type: obj.type === 'i-text' ? 'text' : obj.type === 'rect' || obj.type === 'circle' ? 'shape' : 'image',
      }));
      useCanvasStore.getState().setLayers(restoredLayers as any);
      
      setHistoryIndex(newIndex);
      isProcessingRef.current = false;
    });
  }, [canvas, history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (!canvas || historyIndex >= history.length - 1 || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    const newIndex = historyIndex + 1;
    
    canvas.loadFromJSON(history[newIndex], () => {
      canvas.renderAll();
      
      const objects = canvas.getObjects().filter((o: any) => o._canvasLayerId);
      const restoredLayers = objects.map((obj: any) => ({
        id: obj._canvasLayerId as string,
        name: obj._layerName || 'Layer',
        fabricObjectId: obj._canvasLayerId as string,
        visible: obj.visible ?? true,
        locked: !obj.selectable,
        opacity: obj.opacity ?? 1,
        type: obj.type === 'i-text' ? 'text' : obj.type === 'rect' || obj.type === 'circle' ? 'shape' : 'image',
      }));
      useCanvasStore.getState().setLayers(restoredLayers as any);
      
      setHistoryIndex(newIndex);
      isProcessingRef.current = false;
    });
  }, [canvas, history, historyIndex]);

  return {
    handleUndo,
    handleRedo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
};
