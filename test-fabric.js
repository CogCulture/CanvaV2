import * as fabric from 'fabric';

const canvas = new fabric.Canvas(null, {width: 500, height: 500});
const rect = new fabric.Rect({left: 100, top: 100, width: 100, height: 100, fill: 'red'});
const path1 = new fabric.Path('M 100 150 L 200 150', { stroke: 'black', strokeWidth: 10, globalCompositeOperation: 'destination-out' });

const group = new fabric.Group([rect, path1], { objectCaching: true });
canvas.add(group);

const path2 = new fabric.Path('M 150 100 L 150 200', { stroke: 'black', strokeWidth: 10, globalCompositeOperation: 'destination-out' });
group.add(path2);

console.log('Group objects:', group.getObjects().length);
console.log('Group center:', group.getCenterPoint());
console.log('Path2 center:', path2.getCenterPoint());
