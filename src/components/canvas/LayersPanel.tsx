import { useCallback, useEffect, useState, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, Lock, Unlock, Trash2, GripVertical, Plus, Image as ImageIcon, Pencil, Type, Square } from 'lucide-react';
import { FontDropdown } from './FontDropdown';
import { applyTextRepeat } from '../../utils/textOnPathUtils';
import { useCanvasStore, CanvasLayer } from '../../store/useCanvasStore';
import { useEditorStore } from '../../store/useEditorStore';
import { INITIAL_ADJUSTMENTS } from '../../utils/adjustments';
import { globalFabricCanvas, addImageToCanvas } from './ArtboardCanvas';
import { toast } from 'react-toastify';
import { uploadDataUrlToCloud } from '../../utils/tauri-mocks';


function LayerRow({ layer }: { layer: CanvasLayer }) {
  const { activeLayerId, setActiveLayer, updateLayer, removeLayer, layers, setLayers, openImageEdit } = useCanvasStore();
  const isActive = activeLayerId === layer.id;

  const [fontFamily, setFontFamily] = useState('Open Sans');
  const [fontSize, setFontSize] = useState(40);
  const [isTypeOnPath, setIsTypeOnPath] = useState(false);
  const [repeatText, setRepeatText] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: layer.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getFabricObj = () => {
    const canvas = globalFabricCanvas;
    if (!canvas) return null;
    return canvas.getObjects().find((o: any) => o._canvasLayerId === layer.id) ?? null;
  };

  const handleSelect = () => {
    const canvas = globalFabricCanvas;
    const obj = getFabricObj();
    if (canvas && obj) {
      canvas.discardActiveObject();
      canvas.setActiveObject(obj);
      canvas.renderAll();
    }
    setActiveLayer(layer.id);
  };

  useEffect(() => {
    if (isActive) {
      const obj = getFabricObj() as any;
      if (obj && (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text')) {
        setIsTypeOnPath(!!obj._isTypeOnPath);
        setRepeatText(!!obj._repeatTextToFit);
        let fName = obj.fontFamily;
        if (typeof fName !== 'string') {
          fName = fName?.family || fName?.name || 'Open Sans';
        }
        setFontFamily(typeof fName === 'string' ? fName : 'Open Sans');
        setFontSize(obj.fontSize || 40);
      }
    }
  }, [isActive, layer.id]);

  const handleRepeatToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const val = e.target.checked;
    setRepeatText(val);
    const obj = getFabricObj() as any;
    if (obj && obj._isTypeOnPath) {
      obj._repeatTextToFit = val;
      if (val) {
        applyTextRepeat(obj);
      } else {
        obj.set('text', obj._originalText || '');
      }
      globalFabricCanvas?.requestRenderAll();
    }
  };

  const handleFontChange = (fontName: string) => {
    setFontFamily(fontName);
    const obj = getFabricObj() as any;
    if (obj) {
      obj.set('fontFamily', fontName);
      
      // Clear any inline styles that might override the font family
      if (obj.styles) {
        for (const lineIndex in obj.styles) {
          for (const charIndex in obj.styles[lineIndex]) {
            if (obj.styles[lineIndex][charIndex].fontFamily) {
              delete obj.styles[lineIndex][charIndex].fontFamily;
            }
          }
        }
      }
      
      if (obj.isEditing) {
        obj.setSelectionStyles({ fontFamily: fontName });
        if (obj.hiddenTextarea) {
          obj.hiddenTextarea.style.fontFamily = `"${fontName}"`;
        }
        obj.initDimensions();
      }

      globalFabricCanvas?.requestRenderAll();
      
      // Re-render once the font is actually loaded by the browser
      if ('fonts' in document) {
        document.fonts.load(`10pt "${fontName}"`).then(() => {
          globalFabricCanvas?.requestRenderAll();
        }).catch(() => {});
      } else {
        setTimeout(() => globalFabricCanvas?.requestRenderAll(), 500);
        setTimeout(() => globalFabricCanvas?.requestRenderAll(), 1500);
      }
    }
  };

  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    const obj = getFabricObj() as any;
    if (obj) {
      obj.visible = !layer.visible;
      globalFabricCanvas?.renderAll();
    }
    updateLayer(layer.id, { visible: !layer.visible });
  };

  const toggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    const obj = getFabricObj() as any;
    if (obj) {
      obj.selectable = layer.locked;
      obj.evented = layer.locked;
      globalFabricCanvas?.renderAll();
    }
    updateLayer(layer.id, { locked: !layer.locked });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const canvas = globalFabricCanvas;
    const obj = getFabricObj();
    if (canvas && obj) {
      canvas.remove(obj);
      canvas.discardActiveObject();
      canvas.renderAll();
    }
    removeLayer(layer.id);
  };

  const handleFontSize = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const val = Number(e.target.value);
    setFontSize(val);
    const obj = getFabricObj() as any;
    if (obj) {
      obj.set('fontSize', val);
      
      // Clear any inline styles that might override the font size
      if (obj.styles) {
        for (const lineIndex in obj.styles) {
          for (const charIndex in obj.styles[lineIndex]) {
            if (obj.styles[lineIndex][charIndex].fontSize) {
              delete obj.styles[lineIndex][charIndex].fontSize;
            }
          }
        }
      }
      
      if (obj.isEditing) {
        obj.setSelectionStyles({ fontSize: val });
        if (obj.hiddenTextarea) {
          obj.hiddenTextarea.style.fontSize = `${val}px`;
        }
        obj.initDimensions();
      }

      globalFabricCanvas?.requestRenderAll();
    }
  };

  const TypeIcon = layer.type === 'text' ? Type : layer.type === 'shape' ? Square : ImageIcon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleSelect}
      className={`group flex flex-col rounded-lg cursor-pointer transition-all mb-1 ${
        isActive
          ? 'bg-blue-600/20 ring-1 ring-blue-500/40'
          : 'bg-white/4 hover:bg-white/8'
      }`}
    >
      {/* Main row */}
      <div className="flex items-center gap-1.5 px-2 py-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </button>

        {/* Type icon */}
        <TypeIcon size={11} className={`shrink-0 ${isActive ? 'text-blue-400' : 'text-white/30'}`} />

        {/* Name */}
        <span className={`flex-1 text-[11px] truncate ${isActive ? 'text-white font-medium' : 'text-white/60'}`}>
          {layer.name}
        </span>

        {/* Visibility */}
        <button
          onClick={toggleVisibility}
          className={`shrink-0 transition-colors ${
            layer.visible ? 'text-white/40 hover:text-white' : 'text-white/15 hover:text-white/50'
          }`}
        >
          {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>

        {/* Lock */}
        <button
          onClick={toggleLock}
          className={`shrink-0 transition-colors ${
            layer.locked ? 'text-amber-400/70 hover:text-amber-400' : 'text-white/20 hover:text-white/50'
          }`}
        >
          {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="shrink-0 text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Layer Properties ?" shown when active */}
      {isActive && (
        <div className="flex flex-col gap-2 px-3 pb-2.5">
          {/* Image Properties - Edit Image button */}
          {layer.type === 'image' && (
            <div className="flex items-center gap-2">
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const canvas = globalFabricCanvas;
                  if (!canvas) return;
                  const obj = canvas.getObjects().find((o: any) => o._canvasLayerId === layer.id) as any;
                  if (!obj) return;

                  const filePath: string | undefined = obj._sourceFilePath;
                  const prevAdjustments = obj._adjustments ? JSON.parse(JSON.stringify(obj._adjustments)) : { ...INITIAL_ADJUSTMENTS };

                  if (filePath) {
                    // Image came from library — open main editor with its real file path
                    const editorStore = useEditorStore.getState();
                    editorStore.resetHistory(prevAdjustments);
                    editorStore.setEditor({
                      adjustments: prevAdjustments,
                      selectedImage: {
                        path: filePath,
                        name: obj._layerName ?? 'Image',
                        thumbnailUrl: (obj._element || obj._originalElement)?.src ?? filePath,
                        isReady: false,
                        exif: {},
                        fileSize: 0,
                        hasAdjustments: !!obj._adjustments,
                        rating: 0,
                        colorLabel: null,
                      } as any,
                      finalPreviewUrl: obj._sourceDataUrl ?? null,
                      uncroppedAdjustedPreviewUrl: obj._sourceDataUrl ?? null,
                      hasRenderedFirstFrame: false,
                    });
                    // Mark which layer we are editing so EditorView shows the Done button
                    openImageEdit(layer.id, filePath);
                  } else {
                    // Image was uploaded — use client-side editor with data URL
                    const dataUrl = obj._originalDataUrl ?? obj._sourceDataUrl ?? obj._element?.src ?? obj._originalElement?.src ?? (() => {
                      const tempCanvas = document.createElement('canvas');
                      const el = obj._element || obj._originalElement;
                      if (!el) return null;
                      tempCanvas.width = el.naturalWidth || el.width;
                      tempCanvas.height = el.naturalHeight || el.height;
                      const ctx = tempCanvas.getContext('2d');
                      if (!ctx) return null;
                      ctx.drawImage(el, 0, 0);
                      return tempCanvas.toDataURL('image/png');
                    })();
                    if (dataUrl) {
                      if (!obj._originalDataUrl) obj._originalDataUrl = dataUrl;

                      let finalPath = dataUrl;
                      let loadingToastId = null;

                      // Reuse previously-uploaded cloud path to avoid uploading the same image twice
                      if (obj._cloudPath) {
                        finalPath = obj._cloudPath;
                      } else if (dataUrl.startsWith('data:') || dataUrl.startsWith('blob:') || dataUrl.startsWith('http')) {
                        loadingToastId = toast.loading('Preparing image for editing...', { autoClose: false });
                        try {
                          finalPath = await uploadDataUrlToCloud(dataUrl);
                          // Cache so the next "Edit Image" click skips the upload
                          obj._cloudPath = finalPath;
                          toast.update(loadingToastId, { render: 'Ready!', type: 'success', isLoading: false, autoClose: 1000 });
                        } catch (err) {
                          toast.update(loadingToastId, { render: `Failed to prepare image: ${err}`, type: 'error', isLoading: false, autoClose: 3000 });
                          return;
                        }
                      }
                      
                      const editorStore = useEditorStore.getState();
                      editorStore.resetHistory(prevAdjustments);
                      editorStore.setEditor({
                        adjustments: prevAdjustments,
                        selectedImage: {
                          path: finalPath,
                          name: obj._layerName ?? 'Image',
                          thumbnailUrl: dataUrl,
                          isReady: false,
                          exif: {},
                          fileSize: 0,
                          hasAdjustments: !!obj._adjustments,
                          rating: 0,
                          colorLabel: null,
                        } as any,
                        finalPreviewUrl: dataUrl,
                        uncroppedAdjustedPreviewUrl: dataUrl,
                        hasRenderedFirstFrame: false,
                      });
                      openImageEdit(layer.id, finalPath);
                    }
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 rounded-md text-[10px] font-medium transition-all"
              >
                <Pencil size={11} />
                Edit Image
              </button>
            </div>
          )}

          {/* Text Properties */}
          {layer.type === 'text' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white/30 w-10 shrink-0">Font</span>
                <FontDropdown value={typeof fontFamily === 'string' ? fontFamily : 'Open Sans'} onChange={handleFontChange} />
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={fontSize}
                  onClick={(e) => e.stopPropagation()}
                  onChange={handleFontSize}
                  className="w-10 bg-white/6 border border-white/10 rounded-md px-1 py-1 text-[10px] text-white outline-none focus:border-blue-500/70 transition-colors text-center shrink-0"
                />
              </div>
              {isTypeOnPath && (
                <label className="flex items-center gap-2 cursor-pointer mt-1 pl-1">
                  <input 
                    type="checkbox" 
                    checked={repeatText} 
                    onChange={handleRepeatToggle}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded bg-white/10 border-white/20 text-blue-500 focus:ring-blue-500/30"
                  />
                  <span className="text-[10px] text-white/60">Repeat to fit path</span>
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LayersPanel() {
  const { layers, setLayers, reorderLayers } = useCanvasStore();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const fromIdx = layers.findIndex((l) => l.id === active.id);
      const toIdx = layers.findIndex((l) => l.id === over.id);
      if (fromIdx === -1 || toIdx === -1) return;

      // Reorder in store
      reorderLayers(fromIdx, toIdx);

      // Reorder in fabric canvas (layers[0] = topmost on screen)
      const canvas = globalFabricCanvas;
      if (!canvas) return;
      const newLayers = arrayMove(layers, fromIdx, toIdx);
      // Rebuild fabric stack order (reversed — last in array = topmost)
      const reversed = [...newLayers].reverse();
      reversed.forEach((layer, i) => {
        const obj = canvas.getObjects().find((o: any) => o._canvasLayerId === layer.id);
        if (obj) {
          canvas.remove(obj);
          canvas.insertAt(i, obj);
        }
      });
      canvas.renderAll();
    },
    [layers, reorderLayers],
  );

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      await addImageToCanvas(url, file.name.replace(/\.[^.]+$/, ''));
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <span className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">Layers</span>
        <button
          onClick={handleAddImage}
          className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
          title="Add image layer"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto p-2">
        {layers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-white/15 text-center">
            <ImageIcon size={20} className="mb-2" />
            <p className="text-[10px]">No layers yet</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={layers.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {layers.map((layer) => (
                <LayerRow key={layer.id} layer={layer} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
