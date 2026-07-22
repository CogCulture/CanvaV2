import { useState, useEffect, useCallback, useRef } from 'react';
import * as fabric from 'fabric';
import { useCanvasStore, Artboard } from '../store/useCanvasStore';
import { ARTBOARD_RECT_MARKER } from '../components/canvas/ArtboardCanvas';

const MAX_HISTORY = 50;

/** Each history entry captures both the canvas JSON and the artboard positions */
interface HistorySnapshot {
  canvasJSON: string;
  artboards: Artboard[];
}

export const useCanvasHistory = (canvas: fabric.Canvas | null) => {
  const [state, setState] = useState<{ history: HistorySnapshot[]; index: number }>({
    history: [],
    index: -1,
  });
  const isProcessingRef = useRef(false);

  // ── Save a snapshot of the current canvas + artboard state ────────────
  const saveHistory = useCallback(() => {
    if (!canvas || isProcessingRef.current) return;

    const canvasJSON = JSON.stringify(
      canvas.toObject([
        '_canvasLayerId',
        '_layerName',
        '_sourceFilePath',
        '_sourceDataUrl',
        '_adjustments',
        '_originalDataUrl',
        '__artboardRect__',
        '__artboardId',
      ]),
    );

    // Capture artboard positions from the store (source of truth)
    const artboards: Artboard[] = useCanvasStore
      .getState()
      .artboards.map((b) => ({ ...b }));

    setState((prev) => {
      const newHistory = prev.history.slice(0, prev.index + 1);
      const last = newHistory[newHistory.length - 1];

      // Deduplicate — don't push if nothing changed
      if (
        last &&
        last.canvasJSON === canvasJSON &&
        JSON.stringify(last.artboards) === JSON.stringify(artboards)
      ) {
        return prev;
      }

      newHistory.push({ canvasJSON, artboards });
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return { history: newHistory, index: newHistory.length - 1 };
    });
  }, [canvas]);

  // ── Initial snapshot when canvas becomes available ────────────────────
  useEffect(() => {
    if (canvas && state.history.length === 0) {
      saveHistory();
    }
  }, [canvas, state.history.length, saveHistory]);

  // ── Attach canvas event listeners ─────────────────────────────────────
  useEffect(() => {
    if (!canvas) return;

    /** Save after any object modification (position, size, style, …).
     *  For artboard rects: by the time this fires, drawArtboardRects has
     *  already finished redrawing (ArtboardCanvas registers its listener
     *  first), so the canvas is already in a consistent state.            */
    const onModified = (_e: any) => {
      if (!isProcessingRef.current) saveHistory();
    };

    /** Skip artboard rects — they are removed transiently by drawArtboardRects
     *  before being re-added; saving at this moment would create a broken
     *  intermediate state with no artboard visible.                         */
    const onAdded = (e: any) => {
      if (!isProcessingRef.current && !e.target?.[ARTBOARD_RECT_MARKER]) {
        saveHistory();
      }
    };

    const onRemoved = (e: any) => {
      if (!isProcessingRef.current && !e.target?.[ARTBOARD_RECT_MARKER]) {
        saveHistory();
      }
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

  // ── Common restore logic used by both undo and redo ───────────────────
  const restoreSnapshot = useCallback(
    (snapshot: HistorySnapshot, newIndex: number) => {
      if (!canvas) return;
      isProcessingRef.current = true;

      canvas
        .loadFromJSON(JSON.parse(snapshot.canvasJSON))
        .then(() => {
          // Remove any artboard rects that came from the JSON — they will be
          // redrawn correctly by drawArtboardRects once we update the store.
          const staleRects = canvas
            .getObjects()
            .filter((o: any) => o[ARTBOARD_RECT_MARKER] || o.__artboardRect__);
          staleRects.forEach((o) => canvas.remove(o));

          canvas.renderAll();

          // Rebuild layer list (real layers only, no artboard rects)
          const objects = canvas
            .getObjects()
            .filter((o: any) => o._canvasLayerId && !o[ARTBOARD_RECT_MARKER]);
          const restoredLayers = objects.map((obj: any) => ({
            id: obj._canvasLayerId as string,
            name: obj._layerName || 'Layer',
            fabricObjectId: obj._canvasLayerId as string,
            visible: obj.visible ?? true,
            locked: !obj.selectable,
            opacity: Math.round((obj.opacity ?? 1) * 100),
            type: (
              obj.type === 'image'
                ? 'image'
                : obj.type === 'i-text' ||
                    obj.type === 'textbox' ||
                    obj.type === 'text'
                  ? 'text'
                  : 'shape'
            ) as any,
            thumbnail:
              obj.type === 'image' && typeof obj.getSrc === 'function'
                ? obj.getSrc()
                : obj._sourceDataUrl,
            artboardId: null,
          }));
          useCanvasStore.getState().setLayers(restoredLayers as any);

          // Restore artboard positions from the snapshot.
          // Setting the store triggers the useEffect in ArtboardCanvas that
          // calls drawArtboardRects, which redraws artboard rects at the
          // correct (restored) positions.
          if (snapshot.artboards && snapshot.artboards.length > 0) {
            useCanvasStore.setState({ artboards: snapshot.artboards });
          }

          setState((prev) => ({ ...prev, index: newIndex }));
        })
        .finally(() => {
          isProcessingRef.current = false;
        });
    },
    [canvas],
  );

  // ── Public undo / redo handlers ───────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (!canvas || state.index <= 0 || isProcessingRef.current) return;
    restoreSnapshot(state.history[state.index - 1], state.index - 1);
  }, [canvas, state.history, state.index, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    if (
      !canvas ||
      state.index >= state.history.length - 1 ||
      isProcessingRef.current
    )
      return;
    restoreSnapshot(state.history[state.index + 1], state.index + 1);
  }, [canvas, state.history, state.index, restoreSnapshot]);

  return {
    handleUndo,
    handleRedo,
    canUndo: state.index > 0,
    canRedo: state.index < state.history.length - 1,
  };
};
