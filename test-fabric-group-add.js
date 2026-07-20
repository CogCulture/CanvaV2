const fabric = require('fabric');
const bgRect = new fabric.Rect({
  left: -5000,
  top: -5000,
  width: 10000,
  height: 10000,
  fill: 'white',
  originX: 'left',
  originY: 'top'
});
const localErasePath = new fabric.Path('M 0 0 L 10 10', {
  fill: '',
  stroke: 'black',
  strokeWidth: 5,
  globalCompositeOperation: 'destination-out',
});
try {
  const clipGroup = new fabric.Group([bgRect], {
    originX: 'center',
    originY: 'center',
    objectCaching: true
  });
  clipGroup.add(localErasePath);
  console.log('Path added successfully');
} catch (e) {
  console.error('Path addition failed:', e.message);
}
