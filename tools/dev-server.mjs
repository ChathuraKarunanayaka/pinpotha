// Local development: serves app/ and runs the real backend code against an in-memory sheet.
//   node tools/dev-server.mjs   → prints an invite link. Data disappears when it stops.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackend } from './gas-mock.mjs';

const root = fileURLToPath(new URL('../app/', import.meta.url));
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

const be = createBackend();
be.setup('Admin', '1234'); // throw-away local test login

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(be.call(JSON.parse(body)))); });
    return;
  }
  const file = path.join(root, url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
  res.setHeader('cache-control', 'no-store');
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}/\nhttp://localhost:${port}/#setup=local.${be.key()}`));
