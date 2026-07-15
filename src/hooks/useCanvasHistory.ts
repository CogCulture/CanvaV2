import { useState, useEffect, useCallback, useRef } from 'react';
import { fabric } from 'fabric';
import { useCanvasStore } from '../store/useCanvasStore';

const MAX_HISTORY = 50;

export const useCanvasHistory = (canvas: fabric.Canvas | null) => {
  const [state, setState] = useState<{ history: string[], index: number }>({ history: [], index: -1 });
  const isProcessingRef = useRef(false);

  const saveHistory = useCallback(() => {
    if (!canvas || isProcessingRef.current) return;
    
    // Save state with custom properties
    const json = JSON.stringify(canvas.toObject(['_canvasLayerId', '_layerName', '_sourceFilePath', '_sourceDataUrl', '_adjustments', '_originalDataUrl']));
    
    setState(prev => {
      // Discard any redos if we make a new change
      const newHistory = prev.history.slice(0, prev.index + 1);
      
      // Don't save if state hasn't changed (e.g. just selecting an object)
      if (newHistory.length > 0 && newHistory[newHistory.length - 1] === json) {
        return prev;
      }
      
      newHistory.push(json);
      // Cap at MAX_HISTORY
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }
      return { history: newHistory, index: newHistory.length - 1 };
    });
  }, [canvas]);

  // Initial save when canvas is ready
  useEffect(() => {
    if (canvas && state.history.length === 0) {
      saveHistory();
    }
  }, [canvas, state.history.length, saveHistory]);

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
    if (!canvas || state.index <= 0 || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    const newIndex = state.index - 1;
    
    canvas.loadFromJSON(state.history[newIndex]).then(() => {
      canvas.renderAll();
      
      const objects = canvas.getObjects().filter((o: any) => o._canvasLayerId);
      const restoredLayers = objects.map((obj: any) => ({
        id: obj._canvasLayerId as string,
        name: obj._layerName || 'Layer',
        fabricObjectId: obj._canvasLayerId as string,
        visible: obj.visible ?? true,
        locked: !obj.selectable,
        opacity: obj.opacity ?? 1,
        type: (obj.type === 'image' ? 'image' : (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') ? 'text' : 'shape') as any,
        thumbnail: obj.type === 'image' && typeof obj.getSrc === 'function' ? obj.getSrc() : obj._sourceDataUrl,
      }));
      useCanvasStore.getState().setLayers(restoredLayers as any);
      
      setState(prev => ({ ...prev, index: newIndex }));
    }).finally(() => {
      isProcessingRef.current = false;
    });
  }, [canvas, state.history, state.index]);

  const handleRedo = useCallback(() => {
    if (!canvas || state.index >= state.history.length - 1 || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    const newIndex = state.index + 1;
    
    canvas.loadFromJSON(state.history[newIndex]).then(() => {
      canvas.renderAll();
      
      const objects = canvas.getObjects().filter((o: any) => o._canvasLayerId);
      const restoredLayers = objects.map((obj: any) => ({
        id: obj._canvasLayerId as string,
        name: obj._layerName || 'Layer',
        fabricObjectId: obj._canvasLayerId as string,
        visible: obj.visible ?? true,
        locked: !obj.selectable,
        opacity: obj.opacity ?? 1,
        type: (obj.type === 'image' ? 'image' : (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') ? 'text' : 'shape') as any,
        thumbnail: obj.type === 'image' && typeof obj.getSrc === 'function' ? obj.getSrc() : obj._sourceDataUrl,
      }));
      useCanvasStore.getState().setLayers(restoredLayers as any);
      
      setState(prev => ({ ...prev, index: newIndex }));
    }).finally(() => {
      isProcessingRef.current = false;
    });
  }, [canvas, state.history, state.index]);

  return {
    handleUndo,
    handleRedo,
    canUndo: state.index > 0,
    canRedo: state.index < state.history.length - 1
  };
};
