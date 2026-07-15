import * as fabric from 'fabric';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates an interactive text object on a given fabric path.
 */
export function createTextOnPath(
  pathObj: fabric.Path, 
  canvas: fabric.Canvas, 
  initialText = 'Type here'
) {
  // Ensure the path object has no stroke/fill so it's invisible
  pathObj.set({
    fill: 'transparent',
    stroke: 'transparent',
    objectCaching: false
  });
  
  // We don't add the path to the canvas, it's just a property for the text
  const text = new fabric.IText(initialText, {
    left: pathObj.left,
    top: pathObj.top,
    fontSize: 24,
    fill: '#000000',
    fontFamily: 'Inter',
    path: pathObj,
    pathSide: 'left',
    pathAlign: 'center',
    objectCaching: false
  });

  // Custom properties to keep track of repeating text state
  (text as any)._isTypeOnPath = true;
  (text as any)._originalText = initialText;
  (text as any)._repeatTextToFit = false;
  (text as any)._canvasLayerId = uuidv4();
  (text as any)._layerName = 'Text on Path';

  canvas.add(text);
  canvas.setActiveObject(text);
  
  // Enter editing mode automatically
  text.enterEditing();
  text.selectAll();

  // Attach event listener for text changing
  text.on('changed', () => {
    (text as any)._originalText = text.text; // Update the base text if user types
    if ((text as any)._repeatTextToFit) {
      applyTextRepeat(text);
    }
  });

  return text;
}

/**
 * Repeats the `_originalText` to cover the length of the path.
 */
export function applyTextRepeat(textObj: fabric.IText) {
  const original = (textObj as any)._originalText;
  const pathObj = textObj.path as fabric.Path;
  if (!original || !pathObj) return;

  // Approximate calculation: text width vs path length
  const canvasEl = document.createElement('canvas');
  const ctx = canvasEl.getContext('2d');
  let textWidth = 50;
  if (ctx) {
    ctx.font = `${textObj.fontWeight || 'normal'} ${textObj.fontSize}px "${textObj.fontFamily}"`;
    textWidth = ctx.measureText(original).width;
  }
  
  // Get more accurate path length
  let pathLength = 0;
  try {
    const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const pathData = Array.isArray(pathObj.path) ? pathObj.path.map((p: any) => p.join(' ')).join(' ') : pathObj.path;
    svgPath.setAttribute('d', pathData);
    pathLength = svgPath.getTotalLength();
  } catch (e) {
    pathLength = Math.max(pathObj.width || 0, pathObj.height || 0) * 2;
  }
  
  // Scale path length
  pathLength *= Math.max(pathObj.scaleX || 1, pathObj.scaleY || 1);
  
  // Add space at end of original string to space out repeats
  const textToRepeat = original + '   '; 
  const padWidth = ctx ? ctx.measureText('   ').width : 20;
  
  // Use Math.floor to avoid overflowing the path
  const repeatCount = Math.max(1, Math.floor(pathLength / (textWidth + padWidth)));
  
  // Only update if it's currently repeating
  if ((textObj as any)._repeatTextToFit) {
    // Avoid firing 'changed' event to prevent infinite loop
    textObj.set('text', textToRepeat.repeat(repeatCount));
    textObj.canvas?.requestRenderAll();
  }
}

/**
 * Converts an existing Fabric shape to a path and applies Type on Path.
 */
export function convertShapeToTextPath(shape: any, canvas: fabric.Canvas) {
  let pathStr = '';
  const left = shape.left;
  const top = shape.top;

  if (shape.type === 'rect') {
    const w = shape.width * shape.scaleX;
    const h = shape.height * shape.scaleY;
    // Use a rounded rectangle path to prevent text characters from overlapping at sharp 90-degree corners
    const r = Math.min(w, h) * 0.15;
    pathStr = `M ${left+r} ${top} L ${left+w-r} ${top} Q ${left+w} ${top} ${left+w} ${top+r} L ${left+w} ${top+h-r} Q ${left+w} ${top+h} ${left+w-r} ${top+h} L ${left+r} ${top+h} Q ${left} ${top+h} ${left} ${top+h-r} L ${left} ${top+r} Q ${left} ${top} ${left+r} ${top} Z`;
  } else if (shape.type === 'ellipse') {
    const rx = shape.rx * shape.scaleX;
    const ry = shape.ry * shape.scaleY;
    const cx = left + rx;
    const cy = top + ry;
    // Basic ellipse path approximation (or standard SVG arcs)
    pathStr = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
  } else if (shape.type === 'path') {
    // Already a path, we can just duplicate it
    pathStr = shape.path.map((p: any) => p.join(' ')).join(' ');
  } else {
    return; // Unsupported
  }

  const pathObj = new fabric.Path(pathStr, {
    left: shape.left,
    top: shape.top,
    objectCaching: false
  });

  // Remove the old shape
  canvas.remove(shape);

  const text = createTextOnPath(pathObj, canvas);
  if (shape.type === 'rect') {
    (text as any)._rectProps = { 
      left: shape.left, 
      top: shape.top, 
      w: shape.width * shape.scaleX, 
      h: shape.height * shape.scaleY 
    };
    (text as any)._pathRadius = Math.min(shape.width * shape.scaleX, shape.height * shape.scaleY) * 0.15;
  }
  return text;
}

export function updateTextPathRadius(textObj: any, radius: number) {
  if (!textObj || !textObj._rectProps) return;
  const { left, top, w, h } = textObj._rectProps;
  
  // Clamp radius to half the shortest side
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  textObj._pathRadius = r;
  
  const pathStr = `M ${left+r} ${top} L ${left+w-r} ${top} Q ${left+w} ${top} ${left+w} ${top+r} L ${left+w} ${top+h-r} Q ${left+w} ${top+h} ${left+w-r} ${top+h} L ${left+r} ${top+h} Q ${left} ${top+h} ${left} ${top+h-r} L ${left} ${top+r} Q ${left} ${top} ${left+r} ${top} Z`;
  
  const newPath = new fabric.Path(pathStr, {
    left,
    top,
    objectCaching: false,
    fill: 'transparent',
    stroke: 'transparent'
  });
  
  textObj.set('path', newPath);
  
  if (textObj._repeatTextToFit) {
    applyTextRepeat(textObj as fabric.IText);
  } else {
    // If not repeating, just ask canvas to render
    textObj.canvas?.requestRenderAll();
  }
}
