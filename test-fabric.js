
const fabric = require('fabric').fabric;
const canvas = new fabric.Canvas(null, { preserveObjectStacking: true });
const a = new fabric.Rect({ id: 'A' });
const b = new fabric.Rect({ id: 'B' });
const c = new fabric.Rect({ id: 'C' });
canvas.add(a, b, c);
console.log('Initial order:', canvas.getObjects().map(o => o.id));

const reversed = [c, a, b];
reversed.forEach(obj => obj.bringToFront());
console.log('After bringToFront:', canvas.getObjects().map(o => o.id));
