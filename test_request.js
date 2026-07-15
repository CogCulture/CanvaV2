fetch('https://rapidraw-backend-166491364662.us-central1.run.app/api/invoke', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Origin': 'https://canva-cyan.vercel.app' },
  body: JSON.stringify({ command: 'load_image', args: { path: '/tmp/rapidraw_upload_521a5575-5656-4efe-858d-00e4ed6d471a.production' } })
}).then(async r => {
  console.log(r.status);
  console.log(r.headers);
  console.log(await r.text());
}).catch(console.error);
