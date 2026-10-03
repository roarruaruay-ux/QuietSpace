// จุดเข้าของ Cloudflare Worker: ส่งต่อ /ws ไปยัง Durable Object ตัวเดียวที่ถือห้องทั้งหมด
import { Hub } from './hub.js';

const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});

export class HubDO {
  constructor(state, env) {
    this.hub = new Hub({
      get: (k) => state.storage.get(k),
      put: (k, v) => state.storage.put(k, v),
      delete: (k) => state.storage.delete(k)
    });
    state.blockConcurrencyWhile(() => this.hub.load());
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('ต้องเชื่อมต่อแบบ WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.hub.connect(server);
    return new Response(null, { status: 101, webSocket: client });
  }
}

// รายชื่อเซิร์ฟเวอร์ช่วยเชื่อมต่อ ถ้าตั้งค่า TURN ไว้จะใช้ด้วย (ช่วยคนที่อยู่หลังเครือข่ายที่ต่อตรงไม่ได้)
async function iceServers(env) {
  if (!env.TURN_KEY_ID || !env.TURN_API_TOKEN) return STUN;
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.TURN_API_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 })
    });
    if (!r.ok) return STUN;
    const j = await r.json();
    const list = Array.isArray(j.iceServers) ? j.iceServers : j.iceServers ? [j.iceServers] : [];
    return list.length ? STUN.concat(list) : STUN;
  } catch (e) {
    return STUN;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      // รับเฉพาะการเชื่อมต่อที่มาจากหน้าเว็บของเราเอง
      const origin = request.headers.get('Origin');
      if (origin) {
        let host = '';
        try { host = new URL(origin).host; } catch (e) { /* ปล่อยให้ตกไปปฏิเสธ */ }
        if (host !== url.host) return new Response('ไม่อนุญาต', { status: 403 });
      }
      return env.HUB.get(env.HUB.idFromName('main')).fetch(request);
    }

    if (url.pathname === '/api/turn') return json({ iceServers: await iceServers(env) });

    return env.ASSETS.fetch(request);
  }
};
