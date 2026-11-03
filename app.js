// BRB Studios - simple static web server (built-in Node modules only)
// Run:  node app.js   then open http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Files that must never be served to the browser
const BLOCKED = new Set(['app.js', 'package.json', 'package-lock.json']);

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed');
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return send(res, 400, 'Bad Request');
  }

  if (pathname === '/') pathname = '/index.html';

  // Resolve and make sure the file stays inside the project folder
  const filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'Forbidden');
  }
  if (BLOCKED.has(path.basename(filePath)) || path.basename(filePath).startsWith('.')) {
    return send(res, 404, 'Not Found');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return fs.readFile(path.join(ROOT, 'index.html'), (e, data) => {
        // Unknown page: show a simple 404
        send(res, 404, '<h1>404 - Page not found</h1><a href="/">Back to home</a>', 'text/html; charset=utf-8');
      });
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`BRB Studios is running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
