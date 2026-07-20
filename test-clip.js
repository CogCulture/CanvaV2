import * as fabric from 'fabric';

const canvas = new fabric.StaticCanvas(null, {width: 500, height: 500});
const rect = new fabric.Rect({left: 100, top: 100, width: 100, height: 100, fill: 'red'});
canvas.add(rect);

// Points in scene space (150, 150) to (200, 150)
const p1 = new fabric.Point(150, 150);
const p2 = new fabric.Point(200, 150);

// Invert transform of rect
const inv = fabric.util.invertTransform(rect.calcTransformMatrix());

// Local points
const lp1 = fabric.util.transformPoint(p1, inv);
const lp2 = fabric.util.transformPoint(p2, inv);

console.log('Local points:', lp1, lp2);

// Create path from local points
const erasePath = new fabric.Path(`M ${lp1.x} ${lp1.y} L ${lp2.x} ${lp2.y}`, {
    stroke: 'black', strokeWidth: 10, globalCompositeOperation: 'destination-out'
});

// Let's create a clipPath group
const bgRect = new fabric.Rect({
    left: -5000, top: -5000, width: 10000, height: 10000, fill: 'white'
});
const clipGroup = new fabric.Group([bgRect, erasePath], { originX: 'center', originY: 'center' });

rect.clipPath = clipGroup;
canvas.renderAll();

console.log('Clip group center:', clipGroup.getCenterPoint());
console.log('Erase path coords:', erasePath.left, erasePath.top);
