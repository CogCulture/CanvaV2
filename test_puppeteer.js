const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(5000);
    
    await page.evaluate(() => {
      const canvas = window.__fabricCanvas;
      if (!canvas) {
        console.log('No global canvas found');
        return;
      }
      
      const r1 = new window.fabric.Rect({width: 10, height: 10});
      r1._canvasLayerId = 'id1';
      const r2 = new window.fabric.Rect({width: 10, height: 10});
      r2._canvasLayerId = 'id2';
      canvas.add(r1, r2);
      
      const sel = new window.fabric.ActiveSelection([r1, r2], {canvas});
      canvas.setActiveObject(sel);
      
      const activeObjects = canvas.getActiveObjects();
      console.log('Active objects count:', activeObjects.length);
      activeObjects.forEach((o, i) => {
        console.log(`Obj ${i}: type=${o.type}, id=${o._canvasLayerId}, hasGetObjects=${typeof o.getObjects === 'function'}`);
      });
      
      const activeObj = canvas.getActiveObject();
      console.log('Active Object:', activeObj ? activeObj.type : 'null');
      if (activeObj && activeObj.getObjects) {
         const nested = activeObj.getObjects();
         console.log('Nested count:', nested.length);
         nested.forEach((o, i) => {
           console.log(`Nested ${i}: type=${o.type}, id=${o._canvasLayerId}`);
         });
      }
    });
    
    await browser.close();
  } catch (e) {
    console.error(e);
  }
})();
