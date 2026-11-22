#!/usr/bin/env node
/**
 * Planee — Zero-dependency Local Server
 * Needed for Firebase Auth Google popup (which requires http://localhost:8080)
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const DIR  = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext  = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`🚀 Planee is running on http://localhost:${PORT}`);
  console.log(`👉 Open http://localhost:${PORT} in your browser for Google Sign-In`);
  console.log('='.repeat(60));
});
