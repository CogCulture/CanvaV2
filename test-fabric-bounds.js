const fabric = require('fabric');
const canvas = new fabric.StaticCanvas(null, { width: 500, height: 500 });
const rect = new fabric.Rect({ left: 100, top: 100, width: 50, height: 50, originX: 'center', originY: 'center' });
canvas.add(rect);
canvas.setZoom(2);
canvas.viewportTransform[4] = 50;
canvas.viewportTransform[5] = 50;
const bounds = rect.getBoundingRect();
console.log('Bounds:', bounds);
