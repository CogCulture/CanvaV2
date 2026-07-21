function testScroll() {
  const PAD = 200;
  const sceneMinX = -200;
  const sceneMaxX = 1200;
  
  let vptX = 0;
  const zoom = 1;
  const canvasW = 800;
  const trackW = canvasW - 12;

  let dragStartX = 0;
  let dragStartVptX = 0;

  function getThumb(vX) {
    const viewLeft = -vX / zoom;
    const viewRight = viewLeft + canvasW / zoom;
    const worldMinX = Math.min(sceneMinX, viewLeft);
    const worldMaxX = Math.max(sceneMaxX, viewRight);
    const worldRange = worldMaxX - worldMinX;
    const thumbRatio = Math.min(1, (viewRight - viewLeft) / worldRange);
    const thumbLeft = ((viewLeft - worldMinX) / worldRange) * trackW;
    return { thumbLeft, thumbRatio, worldRange, worldMinX };
  }

  // Start state
  console.log("Initial:", getThumb(vptX));
  
  // Start drag
  dragStartX = 100;
  dragStartVptX = vptX;
  
  // Drag by 50px
  const dx = 50;
  
  // computeH uses current vptX
  let { thumbRatio, worldRange } = getThumb(vptX);
  
  let dWorld = (dx / (trackW * (1 - thumbRatio))) * worldRange;
  let newVptX = dragStartVptX - dWorld * zoom;
  console.log(`Drag by ${dx}px -> newVptX: ${newVptX}`);
  
  // render (updates vptX)
  vptX = newVptX;
  console.log("After render 1:", getThumb(vptX));

  // Drag by another 50px (total 100px from start)
  const dx2 = 100;
  let thumb2 = getThumb(vptX); // computeH uses NEW vptX!
  let dWorld2 = (dx2 / (trackW * (1 - thumb2.thumbRatio))) * thumb2.worldRange;
  let newVptX2 = dragStartVptX - dWorld2 * zoom;
  console.log(`Drag by ${dx2}px -> newVptX2: ${newVptX2}`);
  
  vptX = newVptX2;
  console.log("After render 2:", getThumb(vptX));
}
testScroll();
