import { create } from 'zustand';

export interface ArtboardPreset {
  name: string;
  width: number;
  height: number;
  ratio: string;
}

export const ARTBOARD_PRESETS: ArtboardPreset[] = [
  { name: 'Landscape 16:9', width: 1920, height: 1080, ratio: '16:9' },
  { name: 'Portrait 9:16', width: 1080, height: 1920, ratio: '9:16' },
  { name: 'Standard 4:3', width: 1600, height: 1200, ratio: '4:3' },
  { name: 'Portrait 3:4', width: 1200, height: 1600, ratio: '3:4' },
  { name: 'Square 1:1', width: 1080, height: 1080, ratio: '1:1' },
  { name: 'Presentation', width: 1280, height: 720, ratio: '16:9' },
  { name: 'Instagram Story', width: 1080, height: 1920, ratio: '9:16' },
  { name: 'Twitter Post', width: 1200, height: 675, ratio: '16:9' },
  { name: 'Custom', width: 1920, height: 1080, ratio: 'custom' },
];

export interface CanvasLayer {
  id: string;
  name: string;
  fabricObjectId: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  type: 'image' | 'text' | 'shape' | 'background';
  thumbnail?: string;
}

export interface GuideLine {
  id: string;
  axis: 'horizontal' | 'vertical';
  pos: number;
  locked: boolean;
}

export interface SavedCanvas {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail: string;
  fabricJSON: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'rapidraw_saved_canvases';

const DB_NAME = 'RapidRawDB';
const STORE_NAME = 'canvases';

async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadFromStorageAsync(): Promise<SavedCanvas[]> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(STORAGE_KEY);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? (JSON.parse(result) as SavedCanvas[]) : []);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('[CanvasStore] IndexedDB load failed:', e);
    return [];
  }
}

async function persistToStorageAsync(canvases: SavedCanvas[]) {
  try {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(JSON.stringify(canvases), STORAGE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('[CanvasStore] IndexedDB save failed:', e);
  }
}

export interface CanvasState {
  artboardWidth: number;
  artboardHeight: number;
  artboardPreset: ArtboardPreset | null;
  projectTitle: string;
  layers: CanvasLayer[];
  activeLayerId: string | null;
  activeLayerIds: string[];
  isCanvasHomeOpen: boolean;
  openCanvasHome: () => void;
  closeCanvasHome: () => void;
  savedCanvases: SavedCanvas[];
  loadSavedCanvases: () => void;
  saveCanvas: (name: string, fabricJSON: string, thumbnail: string) => void;
  deleteSavedCanvas: (id: string) => void;
  currentSavedCanvasId: string | null;
  isCanvasDirty: boolean;
  markCanvasDirty: () => void;
  markCanvasClean: () => void;
  isCanvasViewOpen: boolean;
  initialImagePath: string | null;
  initialImageDataUrl: string | null;
  imageEditLayerId: string | null;
  imageEditDataUrl: string | null;
  isSetupModalOpen: boolean;
  pendingImagePath: string | null;
  pendingImageDataUrl: string | null;
  pendingRestoredCanvas: SavedCanvas | null;
  activeTool: string;
  setActiveTool: (tool: string) => void;
  penColor: string;
  penSize: number;
  setPenColor: (color: string) => void;
  setPenSize: (size: number) => void;
  eraserMode: 'freehand' | 'object';
  setEraserMode: (mode: 'freehand' | 'object') => void;
  eraserSize: number;
  setEraserSize: (size: number) => void;
  lassoMode: 'magnetic' | 'polygon' | 'freehand';
  setLassoMode: (mode: 'magnetic' | 'polygon' | 'freehand') => void;
  openSetupModal: (imagePath: string, imageDataUrl?: string) => void;
  closeSetupModal: () => void;
  openCanvasView: (preset: ArtboardPreset, imagePath: string | null, imageDataUrl?: string, restoredCanvas?: SavedCanvas) => void;
  closeCanvasView: () => void;
  setProjectTitle: (title: string) => void;
  setArtboard: (width: number, height: number) => void;
  openImageEdit: (layerId: string, dataUrl: string) => void;
  closeImageEdit: () => void;
  setLayers: (layers: CanvasLayer[]) => void;
  addLayer: (layer: CanvasLayer) => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string | null) => void;
  setActiveLayers: (ids: string[]) => void;
  updateLayer: (id: string, patch: Partial<CanvasLayer>) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  showRulers: boolean;
  setShowRulers: (show: boolean) => void;
  guides: GuideLine[];
  setGuides: (guides: GuideLine[] | ((prev: GuideLine[]) => GuideLine[])) => void;
  clearGuides: () => void;
  activeGuideId: string | null;
  setActiveGuideId: (id: string | null) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  artboardWidth: 1920,
  artboardHeight: 1080,
  artboardPreset: ARTBOARD_PRESETS[0],
  projectTitle: 'Untitled Canvas',
  layers: [],
  activeLayerId: null,
  activeLayerIds: [],
  isCanvasHomeOpen: true,
  openCanvasHome: () => set({ isCanvasHomeOpen: true }),
  closeCanvasHome: () => set({ isCanvasHomeOpen: false }),
  savedCanvases: [],
  loadSavedCanvases: async () => {
    const canvases = await loadFromStorageAsync();
    set({ savedCanvases: canvases });
  },
  saveCanvas: (name, fabricJSON, thumbnail) => {
    const now = Date.now();
    const currentId = get().currentSavedCanvasId;
    let updated: SavedCanvas[];
    let newId = currentId;
    if (currentId) {
      updated = get().savedCanvases.map((c) =>
        c.id === currentId ? { ...c, name, fabricJSON, thumbnail, updatedAt: now } : c,
      );
    } else {
      newId = crypto.randomUUID();
      const newCanvas: SavedCanvas = {
        id: newId as string,
        name,
        width: get().artboardWidth,
        height: get().artboardHeight,
        thumbnail,
        fabricJSON,
        createdAt: now,
        updatedAt: now,
      };
      updated = [newCanvas, ...get().savedCanvases];
    }
    persistToStorageAsync(updated);
    set({ savedCanvases: updated, isCanvasDirty: false, currentSavedCanvasId: newId });
  },
  deleteSavedCanvas: (id) => {
    const updated = get().savedCanvases.filter((c) => c.id !== id);
    persistToStorageAsync(updated);
    set({ savedCanvases: updated });
  },
  currentSavedCanvasId: null,
  isCanvasDirty: false,
  markCanvasDirty: () => { if (!get().isCanvasDirty) set({ isCanvasDirty: true }); },
  markCanvasClean: () => set({ isCanvasDirty: false }),
  isCanvasViewOpen: false,
  initialImagePath: null,
  initialImageDataUrl: null,
  isSetupModalOpen: false,
  pendingImagePath: null,
  pendingImageDataUrl: null,
  pendingRestoredCanvas: null,
  activeTool: 'move',
  penColor: '#3B82F6',
  penSize: 10,
  imageEditLayerId: null,
  imageEditDataUrl: null,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setPenColor: (color) => set({ penColor: color }),
  setPenSize: (size) => set({ penSize: size }),
  eraserMode: 'freehand',
  setEraserMode: (mode) => set({ eraserMode: mode }),
  eraserSize: 20,
  setEraserSize: (size) => set({ eraserSize: size }),
  lassoMode: 'freehand',
  setLassoMode: (mode) => set({ lassoMode: mode }),
  openSetupModal: (imagePath, imageDataUrl) =>
    set({ isSetupModalOpen: true, pendingImagePath: imagePath, pendingImageDataUrl: imageDataUrl ?? null }),
  closeSetupModal: () =>
    set({ isSetupModalOpen: false, pendingImagePath: null, pendingImageDataUrl: null, pendingRestoredCanvas: null }),
  openCanvasView: (preset, imagePath, imageDataUrl, restoredCanvas) =>
    set({
      isCanvasViewOpen: true,
      isCanvasHomeOpen: false,
      isSetupModalOpen: false,
      artboardWidth: preset.width,
      artboardHeight: preset.height,
      artboardPreset: preset,
      initialImagePath: imagePath,
      initialImageDataUrl: imageDataUrl ?? null,
      layers: [],
      activeLayerId: null,
      activeLayerIds: [],
      currentSavedCanvasId: restoredCanvas?.id ?? null,
      projectTitle: restoredCanvas?.name ?? 'Untitled Canvas',
      isCanvasDirty: false,
      pendingRestoredCanvas: restoredCanvas ?? null,
    }),
  closeCanvasView: () =>
    set({
      isCanvasViewOpen: false,
      isCanvasHomeOpen: true,
      initialImagePath: null,
      initialImageDataUrl: null,
      layers: [],
      isCanvasDirty: false,
      currentSavedCanvasId: null,
      pendingRestoredCanvas: null,
    }),
  openImageEdit: (layerId, dataUrl) => set({ imageEditLayerId: layerId, imageEditDataUrl: dataUrl }),
  closeImageEdit: () => set({ imageEditLayerId: null, imageEditDataUrl: null }),
  setProjectTitle: (title) => set({ projectTitle: title }),
  setArtboard: (width, height) => set({ artboardWidth: width, artboardHeight: height }),
  setLayers: (layers) => set({ layers }),
  addLayer: (layer) => set((s) => ({ layers: [layer, ...s.layers] })),
  removeLayer: (id) =>
    set((s) => ({
      layers: s.layers.filter((l) => l.id !== id),
      activeLayerId: s.activeLayerId === id ? null : s.activeLayerId,
      activeLayerIds: s.activeLayerIds.filter((layerId) => layerId !== id),
    })),
  setActiveLayer: (id) => set({ activeLayerId: id, activeLayerIds: id ? [id] : [] }),
  setActiveLayers: (ids) => set({ activeLayerIds: ids, activeLayerId: ids.length > 0 ? ids[0] : null }),
  updateLayer: (id, patch) =>
    set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
  reorderLayers: (fromIndex, toIndex) =>
    set((s) => {
      const arr = [...s.layers];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return { layers: arr };
    }),
  showRulers: true,
  setShowRulers: (show) => set({ showRulers: show }),
  guides: [],
  setGuides: (guides) => set((s) => ({ guides: typeof guides === 'function' ? guides(s.guides) : guides })),
  clearGuides: () => set({ guides: [], activeGuideId: null }),
  activeGuideId: null,
  setActiveGuideId: (id) => set({ activeGuideId: id }),
}));
