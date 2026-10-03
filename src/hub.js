// ตรรกะของ QuietSpace: ห้อง แชต รายชื่อคนในห้อง และส่งต่อสัญญาณ WebRTC
// ไฟล์นี้ไม่ผูกกับแพลตฟอร์ม ใช้ได้ทั้งบน Cloudflare Durable Object และ Node (ไว้ทดสอบ)

const HATS = ['none', 'beanie', 'sprout', 'phones'];
const COLOR = /^#[0-9a-fA-F]{6}$/;
const MOODS = ['เงียบมาก', 'คุยเบาๆ ได้', 'เสียงฝนและเพลงเบาๆ'];
const LIMITS = { rooms: 60, chatKeep: 60, chatLen: 200, chatGapMs: 400, msgBytes: 24000 };
const SEED_ROOM = { id: 'welcome', name: 'ห้องต้อนรับ', desc: 'ทักทายกันเบาๆ ได้ที่นี่', mood: 'คุยเบาๆ ได้', cap: 8, owner: null };

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const cleanCfg = (c) => {
  c = c || {};
  const col = (v, d) => (COLOR.test(v) ? v : d);
  return {
    skin: col(c.skin, '#f6d6b8'),
    shirt: col(c.shirt, '#2f8f4e'),
    hair: col(c.hair, '#2b1d16'),
    hat: HATS.includes(c.hat) ? c.hat : 'none',
    glasses: !!c.glasses
  };
};

export class Hub {
  // storage: { get(key), put(key, value), delete(key) } เป็น async ทั้งหมด
  constructor(storage) {
    this.st = storage;
    this.clients = new Map();
    this.rooms = new Map();
    this.chats = new Map();
    this.seq = 0;
    this.timer = null;
  }

  async load() {
    const saved = await this.st.get('rooms');
    (saved && saved.length ? saved : [SEED_ROOM]).forEach((r) => this.rooms.set(r.id, r));
    await Promise.all([...this.rooms.keys()].map(async (id) => {
      const log = await this.st.get('chat:' + id);
      if (log) this.chats.set(id, log);
    }));
  }

  // ผูก WebSocket หนึ่งตัวเข้ากับระบบ
  connect(ws) {
    const c = {
      id: 'p' + (++this.seq).toString(36) + Math.random().toString(36).slice(2, 6),
      ws, cid: '', name: 'ผู้มาใหม่', cfg: cleanCfg(), room: null,
      cam: false, mic: false, lastChat: 0, ready: false
    };
    this.clients.set(c.id, c);
    ws.addEventListener('message', (e) => {
      const raw = typeof e.data === 'string' ? e.data : String(e.data);
      this.onMessage(c, raw).catch(() => {});
    });
    ws.addEventListener('close', () => this.drop(c));
    ws.addEventListener('error', () => this.drop(c));
    return c;
  }

  send(c, o) { try { c.ws.send(JSON.stringify(o)); } catch (e) { /* ปลายทางหลุดไปแล้ว */ } }
  members(id) { return [...this.clients.values()].filter((x) => x.room === id); }
  pub(x) { return { id: x.id, name: x.name, cfg: x.cfg, cam: x.cam, mic: x.mic }; }
  saveRooms() { return this.st.put('rooms', [...this.rooms.values()]); }

  listFor(c) {
    return [...this.rooms.values()].map((r) => {
      const ms = this.members(r.id);
      return {
        id: r.id, name: r.name, desc: r.desc, mood: r.mood, cap: r.cap,
        count: ms.length, dots: ms.slice(0, 6).map((x) => x.cfg.shirt),
        canDelete: !!r.owner && r.owner === c.cid
      };
    });
  }

  // รวมการแจ้งอัปเดตรายชื่อห้องให้ส่งทีเดียว ไม่ถี่เกินไป
  pushRooms() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      for (const c of this.clients.values()) if (c.ready) this.send(c, { t: 'rooms', rooms: this.listFor(c) });
    }, 120);
  }

  leave(c) {
    if (!c.room) return;
    const id = c.room;
    c.room = null; c.cam = false; c.mic = false;
    this.members(id).forEach((x) => this.send(x, { t: 'peer-left', id: c.id }));
    this.pushRooms();
  }

  drop(c) {
    if (!this.clients.has(c.id)) return;
    this.leave(c);
    this.clients.delete(c.id);
  }

  async onMessage(c, raw) {
    if (raw.length > LIMITS.msgBytes) return;
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'hello') {
      c.cid = clean(m.cid, 64) || c.id;
      c.name = clean(m.name, 20) || c.name;
      c.cfg = cleanCfg(m.cfg);
      c.ready = true;
      this.send(c, { t: 'welcome', id: c.id, rooms: this.listFor(c) });
      return;
    }
    if (!c.ready) return;

    switch (m.t) {
      case 'ping':
        this.send(c, { t: 'pong' });
        break;

      case 'profile': {
        c.name = clean(m.name, 20) || c.name;
        c.cfg = cleanCfg(m.cfg);
        if (c.room) this.members(c.room).forEach((x) => { if (x !== c) this.send(x, { t: 'peer-update', peer: this.pub(c) }); });
        this.pushRooms();
        break;
      }

      case 'create': {
        if (this.rooms.size >= LIMITS.rooms) return this.send(c, { t: 'error', code: 'many', msg: 'มีห้องเยอะเกินไปแล้ว ลองลบห้องที่ไม่ใช้ก่อน' });
        const name = clean(m.name, 40);
        if (!name) return;
        const r = {
          id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          name, desc: clean(m.desc, 80),
          mood: MOODS.includes(m.mood) ? m.mood : MOODS[0],
          cap: [4, 6, 8].includes(+m.cap) ? +m.cap : 8,
          owner: c.cid
        };
        this.rooms.set(r.id, r);
        await this.saveRooms();
        this.send(c, { t: 'created', room: r.id });
        this.pushRooms();
        break;
      }

      case 'delete': {
        const r = this.rooms.get(m.room);
        if (!r || !r.owner || r.owner !== c.cid) return this.send(c, { t: 'error', code: 'perm', msg: 'ลบได้เฉพาะคนสร้างห้อง' });
        this.members(r.id).forEach((x) => { x.room = null; x.cam = false; x.mic = false; this.send(x, { t: 'room-deleted', room: r.id }); });
        this.rooms.delete(r.id);
        this.chats.delete(r.id);
        await this.saveRooms();
        await this.st.delete('chat:' + r.id);
        this.pushRooms();
        break;
      }

      case 'join': {
        const r = this.rooms.get(m.room);
        if (!r) return this.send(c, { t: 'error', code: 'nf', msg: 'ไม่พบห้องนี้ อาจถูกลบไปแล้ว' });
        if (c.room === r.id) return;
        const ms = this.members(r.id);
        if (ms.length >= r.cap) return this.send(c, { t: 'error', code: 'full', msg: 'ห้องนี้เต็มแล้ว' });
        this.leave(c);
        c.room = r.id;
        this.send(c, { t: 'joined', room: r.id, members: ms.map((x) => this.pub(x)), chat: this.chats.get(r.id) || [] });
        ms.forEach((x) => this.send(x, { t: 'peer-joined', peer: this.pub(c) }));
        this.pushRooms();
        break;
      }

      case 'leave':
        this.leave(c);
        break;

      case 'chat': {
        if (!c.room) return;
        const now = Date.now();
        if (now - c.lastChat < LIMITS.chatGapMs) return;
        c.lastChat = now;
        const text = clean(m.text, LIMITS.chatLen);
        if (!text) return;
        const msg = { id: c.id + '-' + now, name: c.name, text, ts: now };
        const log = this.chats.get(c.room) || [];
        log.push(msg);
        while (log.length > LIMITS.chatKeep) log.shift();
        this.chats.set(c.room, log);
        this.st.put('chat:' + c.room, log);
        this.members(c.room).forEach((x) => this.send(x, { t: 'chat', room: c.room, msg }));
        break;
      }

      case 'state': {
        if (!c.room) return;
        c.cam = !!m.cam; c.mic = !!m.mic;
        this.members(c.room).forEach((x) => { if (x !== c) this.send(x, { t: 'peer-state', id: c.id, cam: c.cam, mic: c.mic }); });
        break;
      }

      case 'signal': {
        const to = this.clients.get(m.to);
        if (!c.room || !to || to.room !== c.room) return;
        this.send(to, { t: 'signal', from: c.id, data: m.data });
        break;
      }
    }
  }
}
