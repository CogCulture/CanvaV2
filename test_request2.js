fetch('https://rapidraw-backend-166491364662.us-central1.run.app/api/invoke', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://canva-cyan.vercel.app' },
  body: JSON.stringify({ command: 'load_image', args: { path: '/tmp/nonexistent.raw' } })
}).then(async r => {
  console.log(r.status);
  console.log(await r.text());
}).catch(console.error);
