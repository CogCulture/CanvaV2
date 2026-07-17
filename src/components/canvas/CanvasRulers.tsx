import React, { useEffect, useState } from 'react';
import * as fabric from 'fabric';
import { useCanvasStore, GuideLine } from '../../store/useCanvasStore';

interface RulerProps {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  fabricCanvas: fabric.Canvas | null;
  unit: 'px' | 'in' | 'cm';
}

export default function CanvasRulers({ canvasContainerRef, fabricCanvas, unit }: RulerProps) {
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const { guides, setGuides, showRulers, activeGuideId, setActiveGuideId } = useCanvasStore();
  
  const rulerSize = 24;

  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const el = canvasContainerRef.current;
    
    const handleScroll = () => {
      setScroll({ x: el.scrollLeft, y: el.scrollTop });
    };
    el.addEventListener('scroll', handleScroll);
    
    return () => el.removeEventListener('scroll', handleScroll);
  }, [canvasContainerRef]);

  const [artboardOffset, setArtboardOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!fabricCanvas || !canvasContainerRef.current) return;
    
    const container = canvasContainerRef.current;
    const canvasEl = fabricCanvas.getElement().closest('.canvas-container') as HTMLElement;

    const updateCanvasState = () => {
      setZoom(fabricCanvas.getZoom());
      
      if (container && canvasEl) {
        const containerRect = container.getBoundingClientRect();
        const canvasRect = canvasEl.getBoundingClientRect();
        
        const scrollContentOriginX = containerRect.left - container.scrollLeft;
        const scrollContentOriginY = containerRect.top - container.scrollTop;
        
        setArtboardOffset({
          x: canvasRect.left - scrollContentOriginX - rulerSize,
          y: canvasRect.top - scrollContentOriginY - rulerSize
        });
      }
    };

    updateCanvasState();
    
    const delayedUpdate = () => setTimeout(updateCanvasState, 0);
    
    const ro = new ResizeObserver(updateCanvasState);
    if (canvasEl) ro.observe(canvasEl);
    if (container) ro.observe(container);
    
    fabricCanvas.on('mouse:wheel', delayedUpdate);
    fabricCanvas.on('mouse:move', updateCanvasState);
    fabricCanvas.on('after:render', updateCanvasState);
    window.addEventListener('resize', updateCanvasState);
    container.addEventListener('scroll', updateCanvasState);
    
    return () => {
      ro.disconnect();
      fabricCanvas.off('mouse:wheel', delayedUpdate);
      fabricCanvas.off('mouse:move', updateCanvasState);
      fabricCanvas.off('after:render', updateCanvasState);
      window.removeEventListener('resize', updateCanvasState);
      container.removeEventListener('scroll', updateCanvasState);
    };
  }, [fabricCanvas, canvasContainerRef]);

  const addGuide = (axis: 'horizontal' | 'vertical', pos: number) => {
    setGuides(prev => [...prev, { id: crypto.randomUUID(), axis, pos, locked: false }]);
  };

  const toggleLock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGuides(prev => prev.map(g => g.id === id ? { ...g, locked: !g.locked } : g));
  };

  const removeGuide = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGuides(prev => prev.filter(g => g.id !== id));
  };

  const updateGuidePos = (id: string, pos: number) => {
    setGuides(prev => prev.map(g => g.id === id ? { ...g, pos } : g));
  };

  const getLogicalStep = (zoomLevel: number) => {
    const targetPhysicalGap = 100;
    const idealLogicalGap = targetPhysicalGap / zoomLevel;
    const power = Math.floor(Math.log10(idealLogicalGap));
    const fraction = idealLogicalGap / Math.pow(10, power);
    
    let niceFraction;
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3.5) niceFraction = 2;
    else if (fraction < 7.5) niceFraction = 5;
    else niceFraction = 10;
    
    return niceFraction * Math.pow(10, power);
  };
  
  const drawRulerMarks = (isVertical: boolean, scrollOffset: number) => {
    const pxPerUnit = unit === 'in' ? 96 : unit === 'cm' ? 37.79527559 : 1;
    const stepSize = getLogicalStep(zoom * pxPerUnit);
    
    const minD = -10000 / pxPerUnit;
    const maxD = 15000 / pxPerUnit;
    const startI = Math.floor(minD / stepSize) * stepSize;
    
    const marks = [];
    const offset = isVertical ? artboardOffset.y : artboardOffset.x;
    
    for (let i = startI; i < maxD; i += stepSize) {
      const displayVal = Math.round(i * 100) / 100;
      const logicalPos = i * pxPerUnit * zoom;
      const screenPos = logicalPos + offset - scrollOffset;
      
      // Simple culling to prevent rendering thousands of off-screen DOM nodes
      if (screenPos < -500 || screenPos > 5000) continue;
      
      marks.push(
        <div 
          key={i} 
          style={{
            position: 'absolute',
            [isVertical ? 'top' : 'left']: screenPos,
            [isVertical ? 'width' : 'height']: '100%',
            [isVertical ? 'right' : 'bottom']: 0,
            borderLeft: !isVertical ? '1px solid #555' : 'none',
            borderTop: isVertical ? '1px solid #555' : 'none',
          }}
        >
          <span 
            className="text-[9px] text-gray-400 absolute"
            style={{ 
              [isVertical ? 'top' : 'left']: 3,
              [isVertical ? 'left' : 'top']: 3,
              transform: isVertical ? 'rotate(-90deg) translateX(-100%)' : 'none',
              transformOrigin: 'top left'
            }}
          >
            {displayVal}
          </span>
        </div>
      );
    }
    return marks;
  };


  if (!showRulers) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[8010] overflow-hidden" style={{ top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Horizontal Ruler */}
      <div 
        className="absolute top-0 left-0 bg-[#1a1a1c] border-b border-gray-700/50 cursor-crosshair pointer-events-auto"
        style={{ height: rulerSize, width: '100%', paddingLeft: rulerSize }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickPos = e.clientX - rect.left + scroll.x - rulerSize - artboardOffset.x;
          addGuide('vertical', clickPos / zoom);
        }}
      >
        <div className="relative w-full h-full overflow-hidden">
          {drawRulerMarks(false, scroll.x)}
        </div>
      </div>

      {/* Vertical Ruler */}
      <div 
        className="absolute top-0 left-0 bg-[#1a1a1c] border-r border-gray-700/50 cursor-crosshair pointer-events-auto"
        style={{ width: rulerSize, height: '100%', paddingTop: rulerSize }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickPos = e.clientY - rect.top + scroll.y - rulerSize - artboardOffset.y;
          addGuide('horizontal', clickPos / zoom);
        }}
      >
        <div className="relative w-full h-full overflow-hidden">
          {drawRulerMarks(true, scroll.y)}
        </div>
      </div>
      
      {/* Corner Square */}
      <div 
        className="absolute top-0 left-0 bg-[#1a1a1c] border-r border-b border-gray-700/50 flex items-center justify-center text-[10px] text-gray-500 font-mono pointer-events-auto z-[8011]"
        style={{ width: rulerSize, height: rulerSize }}
      >
        {unit}
      </div>

      {/* Guidelines Container Overlay */}
      <div className="absolute inset-0 pointer-events-none z-[8009]" style={{ left: rulerSize, top: rulerSize }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          {guides.map(g => {
            const logicalPos = g.pos * zoom;
            const screenPos = g.axis === 'vertical' 
              ? logicalPos + artboardOffset.x - scroll.x
              : logicalPos + artboardOffset.y - scroll.y;
              
            return (
              <div
                key={g.id}
                onClick={(e) => { e.stopPropagation(); setActiveGuideId(g.id); }}
                className={`absolute flex items-center justify-center pointer-events-auto ${g.locked ? 'cursor-default' : 'cursor-move'} group`}
                style={{
                  [g.axis === 'vertical' ? 'left' : 'top']: screenPos,
                  [g.axis === 'vertical' ? 'top' : 'left']: 0,
                  [g.axis === 'vertical' ? 'height' : 'width']: '100%',
                  [g.axis === 'vertical' ? 'width' : 'height']: 8,
                  [g.axis === 'vertical' ? 'marginLeft' : 'marginTop']: -4,
                  backgroundColor: 'transparent'
                }}
                onDragEnd={(e) => {
                  if (g.locked) return;
                  const rect = canvasContainerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  // e.clientX is relative to screen. We need relative to the guideline wrapper.
                  // Guideline wrapper origin is rect.left + rulerSize - scroll.x
                  const newPos = g.axis === 'vertical' 
                    ? e.clientX - rect.left - rulerSize + scroll.x - artboardOffset.x
                    : e.clientY - rect.top - rulerSize + scroll.y - artboardOffset.y;
                  updateGuidePos(g.id, newPos / zoom);
                  setActiveGuideId(g.id);
                }}
                draggable={!g.locked}
              >
                <div 
                  className="group-hover:opacity-100 transition-opacity"
                  style={{
                    [g.axis === 'vertical' ? 'width' : 'height']: 1,
                    [g.axis === 'vertical' ? 'height' : 'width']: '100%',
                    backgroundColor: activeGuideId === g.id ? '#60a5fa' : '#22d3ee',
                    opacity: activeGuideId === g.id ? 1 : 0.7,
                    boxShadow: '0 0 2px rgba(0,0,0,0.5)'
                  }}
                />
                
                {/* Controls */}
                <div className="hidden group-hover:flex absolute bg-gray-800 text-white rounded p-1 shadow gap-2 border border-gray-600 pointer-events-auto z-50"
                  style={g.axis === 'vertical' ? { top: 30, left: 2 } : { left: 30, top: 2 }}
                >
                  <button onClick={(e) => toggleLock(g.id, e)} className="text-[10px] hover:text-cyan-400 whitespace-nowrap">
                    {g.locked ? 'Unlock' : 'Lock'}
                  </button>
                  <button onClick={(e) => removeGuide(g.id, e)} className="text-[10px] hover:text-red-400 whitespace-nowrap">
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
