import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';

type MenuItem = {
  label?: string;
  shortcut?: string;
  action?: string;
  submenu?: boolean;
  divider?: boolean;
  disabled?: boolean;
};

const MENUS: { label: string; items: MenuItem[] }[] = [
  {
    label: 'File',
    items: [
      { label: 'New Canvas', shortcut: 'Ctrl+N' },
      { divider: true },
      { label: 'Export as PNG', action: 'export-png' },
      { label: 'Export as JPEG', action: 'export-jpeg' },
      { divider: true },
      { label: 'Close Canvas', action: 'close' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: 'undo' },
      { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: 'redo' },
      { divider: true },
      { label: 'Select All', shortcut: 'Ctrl+A', action: 'select-all' },
      { label: 'Delete Selected', shortcut: 'Delete', action: 'delete' },
    ],
  },
  {
    label: 'Layer',
    items: [
      { label: 'Add Image Layer', action: 'add-image' },
      { divider: true },
      { label: 'Bring to Front', shortcut: 'Ctrl+]' },
      { label: 'Send to Back', shortcut: 'Ctrl+[' },
      { divider: true },
      { label: 'Duplicate Layer', shortcut: 'Ctrl+D', action: 'duplicate' },
      { label: 'Delete Layer', action: 'delete' },
      { divider: true },
      { label: 'Flatten Image', action: 'flatten' },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Zoom In', shortcut: 'Ctrl++', action: 'zoom-in' },
      { label: 'Zoom Out', shortcut: 'Ctrl+-', action: 'zoom-out' },
      { label: 'Fit to Screen', shortcut: 'Ctrl+0', action: 'zoom-fit' },
      { divider: true },
      { label: 'Actual Size', shortcut: 'Ctrl+1', action: 'zoom-100' },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'Keyboard Shortcuts' },
      { label: 'About Canvas Editor' },
    ],
  },
];

interface CanvasMenuBarProps {
  onExport: (format: 'png' | 'jpeg') => void;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (action: 'in' | 'out' | 'fit' | '100') => void;
  onAddImage: () => void;
  onDuplicate: () => void;
}

export default function CanvasMenuBar({
  onExport, onClose, onUndo, onRedo, onZoom, onAddImage, onDuplicate,
}: CanvasMenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const { projectTitle, setProjectTitle } = useCanvasStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAction = (action?: string) => {
    setOpenMenu(null);
    if (!action) return;
    if (action === 'export-png') onExport('png');
    if (action === 'export-jpeg') onExport('jpeg');
    if (action === 'close') onClose();
    if (action === 'undo') onUndo();
    if (action === 'redo') onRedo();
    if (action === 'zoom-in') onZoom('in');
    if (action === 'zoom-out') onZoom('out');
    if (action === 'zoom-fit') onZoom('fit');
    if (action === 'zoom-100') onZoom('100');
    if (action === 'add-image') onAddImage();
    if (action === 'duplicate') onDuplicate();
    if (action === 'delete') {
      const canvas = (window as any).__fabricCanvas;
      if (canvas) {
        const obj = canvas.getActiveObject();
        if (obj) { canvas.remove(obj); canvas.renderAll(); }
      }
    }
    if (action === 'select-all') {
      const canvas = (window as any).__fabricCanvas;
      if (canvas) canvas.discardActiveObject();
    }
    if (action === 'flatten') {
      const canvas = (window as any).__fabricCanvas;
      if (canvas) {
        canvas.discardActiveObject();
        const dataUrl = canvas.toDataURL();
        onExport('png');
      }
    }
  };

  return (
    <div
      ref={ref}
      className="h-9 flex items-center shrink-0 select-none px-2 gap-0"
      style={{ background: '#1c1c1e', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* App badge */}
      <div className="flex items-center gap-2 mr-4 pl-1">
        <div
          className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          C
        </div>
        <input
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
          className="text-[11px] text-white/50 hover:text-white/80 outline-none bg-transparent hover:bg-white/8 rounded px-1.5 py-0.5 w-36 truncate transition-all"
        />
      </div>

      {/* Menu items */}
      {MENUS.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            onMouseDown={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
            className={`px-3 py-1.5 text-[12px] rounded transition-colors ${
              openMenu === menu.label
                ? 'bg-white/12 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/8'
            }`}
          >
            {menu.label}
          </button>

          {openMenu === menu.label && (
            <div
              className="absolute top-full left-0 z-[9999] min-w-[200px] py-1 rounded-lg shadow-2xl overflow-hidden"
              style={{
                background: '#2a2a2c',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
              }}
            >
              {menu.items.map((item, i) =>
                item.divider ? (
                  <div key={i} className="h-px bg-white/8 my-1 mx-2" />
                ) : (
                  <button
                    key={i}
                    onMouseDown={() => !item.submenu && handleAction(item.action)}
                    disabled={item.disabled}
                    className={`w-full text-left px-3 py-1.5 flex justify-between items-center gap-8 text-[12px] transition-colors ${
                      item.disabled
                        ? 'text-white/25 cursor-default'
                        : 'text-white/75 hover:bg-blue-600 hover:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] text-white/35 font-mono shrink-0">
                      {item.shortcut || (item.submenu ? '▶' : '')}
                    </span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}

      <div className="flex-1" />
      <div className="text-[10px] text-white/25 pr-2 font-mono">Canvas Editor</div>
    </div>
  );
}
