/* RENDERit local static server. Run with: node tools/local-server.js */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 8888);
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream',
  '.exr': 'application/octet-stream', '.obj': 'text/plain; charset=utf-8', '.stl': 'model/stl'
};

const server = http.createServer((req, res) => {
  const rawUrl = decodeURIComponent(req.url.split('?')[0]);
  const safePath = path.normalize(rawUrl === '/' ? '/index.html' : rawUrl).replace(/^([/\\])+/, '');
  const filePath = path.join(root, safePath);
  if (!filePath.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`RENDERit local server: http://localhost:${port}`);
  console.log(`Root: ${root}`);
});
