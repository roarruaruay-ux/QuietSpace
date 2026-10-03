// เซิร์ฟเวอร์ทดสอบบนเครื่อง ใช้ตรรกะ hub.js ตัวเดียวกับที่รันบน Cloudflare
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Hub } from '../src/hub.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png' };
const mem = new Map();
const hub = new Hub({
  get: async (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : undefined),
  put: async (k, v) => { mem.set(k, JSON.stringify(v)); },
  delete: async (k) => { mem.delete(k); }
});
await hub.load();

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/turn') {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ iceServers: [] }));
  }
  const f = path.join(root, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
});
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, sock, head) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws') return sock.destroy();
  wss.handleUpgrade(req, sock, head, (ws) => hub.connect(ws));
});
const port = +process.env.PORT || 8788;
server.listen(port, () => console.log('test server on http://localhost:' + port));
