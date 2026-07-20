import * as fabric from 'fabric';

const rect = new fabric.Rect({ left: 100, top: 100, width: 100, height: 100, fill: 'red' });
const path1 = new fabric.Path('M 150 150 L 200 150', { stroke: 'black', strokeWidth: 10 });

const group = new fabric.Group([rect, path1], { originX: 'center', originY: 'center', left: 150, top: 150 });

const scenePoint = new fabric.Point(175, 175);
const inv = fabric.util.invertTransform(group.calcTransformMatrix());
const localPoint = fabric.util.transformPoint(scenePoint, inv);

console.log('Scene Point:', scenePoint);
console.log('Local Point:', localPoint);

const path2 = new fabric.Path(`M ${localPoint.x} ${localPoint.y} L ${localPoint.x+10} ${localPoint.y}`, { stroke: 'black', strokeWidth: 10 });
group.add(path2);

console.log('Path2 left/top:', path2.left, path2.top);
