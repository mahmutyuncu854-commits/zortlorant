import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { EYE, ROUND, ARMOR, WEAPONS, AGENTS, MAP, MAP_DEFS, MAP_LIST, MAP_SPIKE_LIST, MAP_NAMES, slotOf } from './public/shared.js';
import { loadCustomMap } from './mapload.js';

const PORT = process.env.PORT || 3000;
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const SPIKE = { plantMs: 4000, defuseMs: 5000, timerMs: 45000, siteRadius: 5.2, pickupRadius: 1.8, defuseRadius: 2.1 };

const CUSTOM_MAPS = new Map();
let legacyCustomMap = null;
// Eski tek harita yolu uyumluluğunu koru.
try {
  legacyCustomMap = loadCustomMap(path.join(PUB, 'models', 'maps'), 'maps');
  if (legacyCustomMap) { MAP.apply(legacyCustomMap); console.log(`  Özel harita yüklendi: ${legacyCustomMap.name}`); }
} catch (e) { console.log('  Özel harita okunamadı, varsayılan harita kullanılıyor:', e.message); }
for (const id of MAP_LIST) {
  try {
    const custom = loadCustomMap(path.join(PUB, 'models', 'maps', id), id);
    if (custom) {
      CUSTOM_MAPS.set(id, custom);
      console.log(`  Harita hazır: ${custom.name} (${custom.boxes.length} çarpışma alanı, ${custom.halfX * 2}x${custom.halfZ * 2} m)`);
    }
  } catch (e) { console.log(`  ${id} haritası okunamadı:`, e.message); }
}
const mapPayload = () => ({ id: MAP.id, name: MAP.name, halfX: MAP.halfX, halfZ: MAP.halfZ, spawnX: MAP.spawnX, spawnAxis: MAP.spawnAxis, spawns: MAP.spawns, spawnY: MAP.spawnY ?? 0.18, playerScale: MAP.playerScale || 1, goals: MAP.goals, sites: MAP.sites || [], custom: MAP.custom, boxes: MAP.boxes });
function cleanMapEditorConfig(id, raw) {
  const base = MAP_DEFS[id]; if (!base || !raw || typeof raw !== 'object') return null;
  const hx = Math.max(10, Math.min(300, Number(raw.halfX) || base.halfX));
  const hz = Math.max(10, Math.min(300, Number(raw.halfZ) || base.halfZ));
  const point = (v, yaw = false) => {
    const x = Number(v?.[0]), z = Number(v?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    return [Math.max(-hx + 1, Math.min(hx - 1, x)), Math.max(-hz + 1, Math.min(hz - 1, z)), yaw ? Math.max(-Math.PI * 2, Math.min(Math.PI * 2, Number(v?.[2]) || 0)) : 0];
  };
  const spawns = Array.isArray(raw.spawns) ? raw.spawns.slice(0, 2).map((v) => point(v, true)) : null;
  const sites = Array.isArray(raw.sites) ? raw.sites.slice(0, 2).map((v) => point(v)) : null;
  const rawSpawnY = Number(raw.spawnY), rawSizeScale = Number(raw.sizeScale);
  return {
    halfX: hx, halfZ: hz,
    spawnX: Math.max(5, Math.min(Math.min(hx, hz) - 1, Number(raw.spawnX) || base.spawnX)),
    spawnAxis: raw.spawnAxis === 'z' ? 'z' : 'x',
    spawnY: Math.max(0, Math.min(8, Number.isFinite(rawSpawnY) ? rawSpawnY : 0.18)),
    sizeScale: Math.max(.25, Math.min(3, Number.isFinite(rawSizeScale) ? rawSizeScale : 1)),
    spawns: spawns?.length === 2 && spawns.every(Boolean) ? spawns : null,
    sites: sites?.length === 2 && sites.every(Boolean) ? sites.map((v) => v.slice(0, 2)) : (base.sites || []).map((v) => [...v]),
    playerScale: Math.max(.55, Math.min(1.5, Number(raw.playerScale) || 1)),
  };
}
function rebuildBoxes() {
  BOXES.length = 0;
  for (const b of MAP.boxes) BOXES.push({ min: [b.x - b.w / 2, 0, b.z - b.d / 2], max: [b.x + b.w / 2, b.h, b.z + b.d / 2] });
}
// Her oda kendi haritasını tutar; o odayla ilgili işlemden önce global MAP/BOXES o haritaya ayarlanır
let activeMap = legacyCustomMap ? 'legacy' : null;
const MATCH_MAPS = MAP_LIST.filter((id) => id !== 'range');
const SPIKE_MAPS = MAP_SPIKE_LIST.filter((id) => id !== 'range');
const chooseMap = (id, mode = 'elimination') => {
  const valid = mode === 'spike' ? SPIKE_MAPS : MATCH_MAPS;
  return valid.includes(id) ? id : valid[Math.floor(Math.random() * valid.length)];
};
let WALLS = []; // yetenekle kurulan geçici duvarlar (odaya özel)
function useMap(r) {
  WALLS = r?.walls || [];
  const key = r?.map ? `${r.map}:${JSON.stringify(r.mapConfig || {})}` : '';
  if (legacyCustomMap || !r || !r.map || activeMap === key) return;
  MAP.setMap(r.map);
  const custom = CUSTOM_MAPS.get(r.map);
  if (custom) MAP.apply(custom);
  if (r.mapConfig) {
    const s = Math.max(.25, Math.min(3, Number(r.mapConfig.sizeScale) || 1));
    if (s !== 1) {
      MAP.halfX *= s; MAP.halfZ *= s; MAP.spawnX *= s;
      MAP.boxes = MAP.boxes.map((b) => ({ ...b, x: b.x * s, z: b.z * s, w: b.w * s, d: b.d * s, h: b.h * s }));
      MAP.goals = MAP.goals.map(([x, z]) => [x * s, z * s]);
      MAP.sites = MAP.sites.map(([x, z]) => [x * s, z * s]);
      if (MAP.custom) { MAP.custom = { ...MAP.custom, scale: MAP.custom.scale * s, offset: MAP.custom.offset.map((v) => v * s) }; }
    }
    MAP.apply(r.mapConfig);
  }
  rebuildBoxes(); activeMap = key;
}
const listDir = (d) => { try { return fs.readdirSync(path.join(PUB, d)).filter(f => f.endsWith('.glb')); } catch { return []; } };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

// ---------- statik dosya sunucusu ----------
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/assets.json') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }); return res.end(JSON.stringify({ weapons: listDir('models/weapons') })); }
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Bulunamadı'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});
const wss = new WebSocketServer({ server });

function newPlayer(ws, id, name) {
  return { id, ws, name, room: null, agent: 'soldier', team: 0, alive: false, hp: 100, armor: 0, weapon: 'classic', ammo: 12, primary: null, secondary: 'classic', mags: {},
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 0, lastPos: 0, lastChatAt: 0, cd: { e: 0, q: 0 }, credits: 0, kills: 0, deaths: 0, reloadUntil: 0, nextShot: 0, crouch: false, st: newStats() };
}

const newStats = () => ({ shots: 0, hits: 0, heads: 0, dmg: 0 });
// ---------- yardımcılar ----------
const clients = new Map();
const rooms = new Map();
let nextId = 1;
const send = (c, o) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(o)); };
const bcast = (room, o) => { const s = JSON.stringify(o); for (const p of room.players.values()) if (p.ws.readyState === 1) p.ws.send(s); };
const now = () => Date.now();
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
const cleanName = (s) => String(s || 'Oyuncu').replace(/[<>]/g, '').trim().slice(0, 14) || 'Oyuncu';

const BOXES = []; rebuildBoxes();

function rayBoxes(o, d, maxT) {
  let best = maxT;
  for (const list of [BOXES, WALLS]) for (const b of list) {
    let t0 = 0, t1 = best, ok = true;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < b.min[i] || o[i] > b.max[i]) { ok = false; break; } continue; }
      let a = (b.min[i] - o[i]) / d[i], c = (b.max[i] - o[i]) / d[i];
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 < best) best = t0;
  }
  return best;
}
function rayPlayer(o, d, p) {
  const ox = o[0] - p.x, oz = o[2] - p.z;
  const a = d[0] * d[0] + d[2] * d[2];
  if (a < 1e-8) return null;
  const b = 2 * (ox * d[0] + oz * d[2]);
  const c = ox * ox + oz * oz - 0.45 * 0.45;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return null;
  const y = o[1] + d[1] * t;
  if (y < p.y || y > p.y + (p.crouch ? 1.3 : 1.85)) return null;
  return { t, head: y > p.y + (p.crouch ? 0.95 : 1.48) };
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
function spreadDir(base, s) {
  const up = Math.abs(base[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const u = norm([base[1] * up[2] - base[2] * up[1], base[2] * up[0] - base[0] * up[2], base[0] * up[1] - base[1] * up[0]]);
  const v = [base[1] * u[2] - base[2] * u[1], base[2] * u[0] - base[0] * u[2], base[0] * u[1] - base[1] * u[0]];
  const r = s * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
  const cu = r * Math.cos(th), cv = r * Math.sin(th);
  return norm([base[0] + u[0] * cu + v[0] * cv, base[1] + u[1] * cu + v[1] * cv, base[2] + u[2] * cu + v[2] * cv]);
}
const lookDir = (p) => [-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)];

// ---------- oda yönetimi ----------
function makeCode() {
  let c; do { c = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (rooms.has(c) || /[01OI]/.test(c));
  return c;
}
function roomInfo(r) {
  return { t: 'room', code: r.code, mode: r.mode, host: r.host, phase: r.phase, score: r.score,
    level: r.level, solo: !!r.solo, training: !!r.training, targetMode: r.targetMode, gameMode: r.gameMode || 'elimination', map: r.mapPick || 'random', mapName: legacyCustomMap ? MAP.name : (r.mapPick === 'random' ? 'Rastgele' : MAP_NAMES[r.map]), players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, team: p.team, agent: p.agent, pick: p.pick || 'classic', bot: !!p.isBot })) };
}
const pushRoom = (r) => bcast(r, roomInfo(r));
function listRooms() {
  return [...rooms.values()].filter(r => r.phase === 'lobby' && !r.solo).map(r => ({
    code: r.code, mode: r.mode, gameMode: r.gameMode || 'elimination', count: humans(r), max: r.mode * 2, bots: r.players.size - humans(r), host: r.players.get(r.host)?.name || '?' }));
}
function pushRoomList() { for (const c of clients.values()) if (!c.room) send(c, { t: 'rooms', rooms: listRooms() }); }
const teamCount = (r, t) => [...r.players.values()].filter(p => p.team === t).length;

const humans = (r) => [...r.players.values()].filter(p => !p.isBot).length;
function freeSlot(r, t) {
  if (teamCount(r, t) < r.mode) return true;
  const bot = [...r.players.values()].find(p => p.isBot && p.team === t);
  if (bot) { r.players.delete(bot.id); return true; }
  return false;
}
function joinRoom(c, r) {
  if (r.phase !== 'lobby') return send(c, { t: 'err', msg: 'Maç başlamış, odaya girilemez.' });
  const order = teamCount(r, 0) <= teamCount(r, 1) ? [0, 1] : [1, 0];
  const t = order.find(k => freeSlot(r, k));
  if (t === undefined) return send(c, { t: 'err', msg: 'Oda dolu.' });
  c.room = r; c.team = t; c.agent = c.agent || 'soldier';
  r.players.set(c.id, c);
  pushRoom(r); pushRoomList();
}
function leaveRoom(c) {
  const r = c.room; if (!r) return;
  if (r.spike?.carrier === c.id && !r.spike.planted) { r.spike.carrier = null; r.spike.dropped = { x: c.x, z: c.z }; }
  if (r.spikeAction?.playerId === c.id) r.spikeAction = null;
  r.players.delete(c.id); c.room = null;
  if (humans(r) === 0) { rooms.delete(r.code); }
  else {
    if (r.host === c.id) r.host = [...r.players.values()].find(p => !p.isBot).id;
    if (r.phase !== 'lobby' && (teamCount(r, 0) === 0 || teamCount(r, 1) === 0)) {
      r.phase = 'lobby'; bcast(r, { t: 'err', msg: 'Bir takım boşaldı, maç iptal edildi.' });
    }
    pushRoom(r);
  }
  pushRoomList();
}

// ---------- maç akışı ----------
function startMatch(r) {
  r.score = [0, 0]; r.round = 0;
  for (const p of r.players.values()) { p.st = newStats(); p.credits = ROUND.startCredits; p.kills = 0; p.deaths = 0; p.primary = null; p.secondary = 'classic'; p.mags = {}; giveWeapon(p, p.pick || 'classic'); p.weapon = null; p.armor = 0; p.alive = false; }
  if (r.mapPick === 'random') r.map = chooseMap('random', r.gameMode);
  useMap(r);
  console.log(`  Oda ${r.code}: harita ${MAP.name}`);
  bcast(r, { t: 'map', map: mapPayload() });
  startRound(r);
  pushRoom(r);
}
const RANGE_TARGETS = [
  { x: -20, z: -6, distance: 13 },
  { x: -8, z: 5, distance: 25 },
  { x: 4, z: -4, distance: 37 },
  { x: 16, z: 7, distance: 49 },
  { x: 28, z: -5, distance: 61 },
];
function startTraining(r) {
  r.score = [0, 0]; r.round = 1; r.phase = 'live'; r.phaseEnd = now() + 86400000;
  r.drops = []; r.walls = []; r.fires = []; r.deployables = []; WALLS = r.walls;
  useMap(r);
  console.log(`  Poligon ${r.code}: hedef modu ${r.targetMode}`);
  bcast(r, { t: 'map', map: mapPayload() });
  const playerSpawn = MAP.spawn(0, 0, 1);
  let ti = 0;
  for (const p of r.players.values()) {
    p.st = newStats(); p.kills = 0; p.deaths = 0; p.credits = 0; p.armor = 0;
    p.hp = 100; p.alive = true; p.nextShot = 0; p.cd = { e: 0, q: 0 }; p.speed = 0;
    p.primary = null; p.secondary = 'classic'; p.mags = {};
    if (p.isBot) {
      const target = RANGE_TARGETS[ti++];
      p.name = `HEDEF ${String(ti).padStart(2, '0')} · ${target.distance} M`;
      p.pick = 'classic'; p.primary = 'classic'; p.weapon = 'classic'; p.ammo = WEAPONS.classic.mag;
      p.spawn = { x: target.x, y: 0, z: target.z, yaw: Math.PI / 2 };
      p.rangeHome = { ...p.spawn, phase: ti * 1.17 };
      p.respawnAt = 0;
    } else {
      const selected = 'vandal';
      giveWeapon(p, selected); p.weapon = null; equip(p, bestWeapon(p), false);
      p.spawn = playerSpawn;
      Object.assign(p, { x: playerSpawn.x, y: playerSpawn.y ?? MAP.spawnY ?? 0.18, z: playerSpawn.z, yaw: playerSpawn.yaw, pitch: 0 });
      p.lastPos = now();
    }
    if (p.isBot) Object.assign(p, { x: p.spawn.x, y: p.spawn.y ?? 0.18, z: p.spawn.z, yaw: p.spawn.yaw, pitch: 0, rangeHome: p.rangeHome });
  }
  r.targets = [...r.players.values()].filter((p) => p.isBot);
  for (const p of r.players.values()) if (!p.isBot) send(p, phaseMsg(r, { spawn: p.spawn, clear: true }));
  pushRoom(r);
}
function startRound(r) {
  r.round++;
  const idx = [0, 0];
  for (const p of r.players.values()) {
    if (r.round === 1) p.armor = 0;
    else if (!p.alive) { p.primary = null; p.secondary = 'classic'; p.armor = 0; }
    p.mags = {}; p.weapon = null; p.alive = true; p.hp = 100; p.nextShot = 0; equip(p, bestWeapon(p), false); p.cd = { e: 0, q: 0 };
    const sp = MAP.spawn(p.team, idx[p.team]++, teamCount(r, p.team));
    Object.assign(p, { x: sp.x, y: sp.y ?? MAP.spawnY ?? 0.18, z: sp.z, yaw: sp.yaw, pitch: 0, speed: 0 });
    p.spawn = sp;
  }
  r.spikeAction = null;
  if (r.gameMode === 'spike') {
    const attackers = [...r.players.values()].filter(p => p.team === 0 && p.alive);
    const carrier = attackers.find(p => !p.isBot) || attackers[Math.floor(Math.random() * attackers.length)];
    r.spike = { carrier: carrier?.id ?? null, dropped: null, planted: false, site: null, siteGoal: Math.floor(Math.random() * 2), x: 0, z: 0, detonateAt: 0 };
  } else r.spike = null;
  r.drops = []; r.walls = []; r.fires = []; r.deployables = []; WALLS = r.walls; pushDrops(r);
  r.phase = 'buy'; r.phaseEnd = now() + (r.round === 1 ? ROUND.firstBuy : ROUND.buy) * 1000;
  for (const p of r.players.values()) if (p.isBot) { resetBot(p); botBuy(r, p); }
  for (const p of r.players.values()) send(p, phaseMsg(r, { spawn: p.spawn, clear: true }));
}
function phaseMsg(r, extra = {}) {
  return { t: 'phase', phase: r.phase, round: r.round, score: r.score, remain: Math.max(0, r.phaseEnd - now()), objective: spikePayload(r, now()), ...extra };
}
function spikePayload(r, t = now()) {
  const s = r?.spike;
  if (!s) return null;
  const a = r.spikeAction;
  return {
    planted: !!s.planted, carrier: s.carrier, dropped: s.dropped ? { ...s.dropped } : null,
    site: s.site, x: s.x, z: s.z, remain: s.planted ? Math.max(0, s.detonateAt - t) : 0,
    action: a ? { type: a.type, player: a.playerId, site: a.site, progress: Math.max(0, Math.min(1, (t - a.startedAt) / a.duration)) } : null,
  };
}
function spikeEvent(r, event, extra = {}) { bcast(r, { t: 'objective', event, ...extra }); }
function startSpikeAction(r, p, type, site = null, t = now()) {
  r.spikeAction = { playerId: p.id, type, site, startedAt: t, duration: type === 'plant' ? SPIKE.plantMs : SPIKE.defuseMs };
}
function doObjective(r, p, action) {
  if (!r?.spike || r.phase !== 'live' || !p.alive) return;
  if (action === 'stop') {
    if (r.spikeAction?.playerId === p.id) r.spikeAction = null;
    return;
  }
  if (action !== 'start') return;
  if (r.spikeAction) return;
  const s = r.spike;
  if (s.planted) {
    if (p.team !== 1) return;
    if (Math.hypot(p.x - s.x, p.z - s.z) > SPIKE.defuseRadius) return send(p, { t: 'err', msg: 'Etkisizleştirmek için bombanın yanına git.' });
    startSpikeAction(r, p, 'defuse', s.site);
    return;
  }
  if (s.dropped && p.team === 0 && Math.hypot(p.x - s.dropped.x, p.z - s.dropped.z) <= SPIKE.pickupRadius) {
    s.carrier = p.id; s.dropped = null; spikeEvent(r, 'picked'); return;
  }
  if (p.team !== 0 || s.carrier !== p.id) return;
  const i = (MAP.sites || []).findIndex(([x, z]) => Math.hypot(p.x - x, p.z - z) <= SPIKE.siteRadius);
  if (i < 0) return send(p, { t: 'err', msg: 'Bomba kurmak için A veya B alanına git.' });
  startSpikeAction(r, p, 'plant', i);
}
function endRound(r, winner, reason) {
  r.score[winner]++;
  r.spike = null; r.spikeAction = null;
  for (const p of r.players.values()) {
    p.credits = Math.min(ROUND.maxCredits, p.credits + (p.team === winner ? ROUND.win : ROUND.lose));
  }
  const over = r.score[winner] >= ROUND.wins;
  r.phase = over ? 'matchEnd' : 'roundEnd';
  r.phaseEnd = now() + (over ? ROUND.matchEnd : ROUND.end) * 1000;
  const extra = { winner, reason };
  if (over) extra.stats = [...r.players.values()].map(p => ({ id: p.id, k: p.kills, d: p.deaths, dmg: Math.round(p.st.dmg), acc: p.st.shots ? Math.round(p.st.hits / p.st.shots * 100) : 0, hs: p.st.hits ? Math.round(p.st.heads / p.st.hits * 100) : 0 }));
  bcast(r, phaseMsg(r, extra));
}

// ---------- duraklatma (odada tek insan varsa: botlara karşı maç veya LAN odasında yalnız sen + botlar) ----------
const canPause = (r, c) => r && !r.training && humans(r) === 1 && r.players.get(c.id) === c && (r.phase === 'live' || r.phase === 'buy');
function pauseRoom(r, c) {
  if (!canPause(r, c) || r.paused) return;
  r.paused = true; r.pausedAt = now();
  send(c, { t: 'paused', on: true });
}
function resumeRoom(r, c) {
  if (!r || !r.paused) return;
  const d = now() - r.pausedAt; r.paused = false; r.pausedAt = 0;
  r.phaseEnd += d;
  for (const p of r.players.values()) {
    for (const k of ['reloadUntil', 'respawnAt', 'lastPos']) if (p[k]) p[k] += d;
    if (p.bot) for (const k of ['goalAt', 'strafeAt', 'nextTrig']) if (p.bot[k]) p.bot[k] += d;
  }
  for (const w of r.walls || []) w.until += d;
  for (const f of r.fires || []) { f.until += d; f.next += d; }
  for (const x of r.drops || []) if (x.lockUntil) x.lockUntil += d;
  if (r.spike?.planted) r.spike.detonateAt += d;
  if (r.spikeAction) r.spikeAction.startedAt += d;
  send(c, { t: 'paused', on: false });
  bcast(r, phaseMsg(r, { resumed: true }));
}
function tickRoom(r) {
  if (r.paused) return; // bot maçı duraklatıldı: sayaç, botlar ve dünya bekler
  useMap(r);
  const t = now();
  for (const p of r.players.values()) if (p.reloadUntil && t >= p.reloadUntil) { p.reloadUntil = 0; p.ammo = WEAPONS[p.weapon].mag; }
  if (r.training) for (const p of r.targets || []) {
    if (!p.alive && p.respawnAt && t >= p.respawnAt) {
      p.alive = true; p.hp = 100; p.armor = 0; p.respawnAt = 0;
      p.x = p.rangeHome.x; p.y = 0; p.z = p.rangeHome.z; p.yaw = p.rangeHome.yaw; p.pitch = 0; p.speed = 0;
      p.weapon = 'classic'; p.ammo = WEAPONS.classic.mag; p.reloadUntil = 0;
    }
    if (p.alive) {
      p.z = p.rangeHome.z + (r.targetMode === 'moving' ? Math.sin(t / 850 + p.rangeHome.phase) * 2.2 : 0);
    }
  }
  if (r.phase === 'live' && !r.training) for (const p of r.players.values()) if (p.isBot && p.alive) botThink(r, p, t, 0.05);
  if (r.phase === 'live' && !r.training && r.gameMode === 'spike') tickSpike(r, t);
  if (r.phase === 'buy' && t >= r.phaseEnd) { r.phase = 'live'; r.phaseEnd = t + ROUND.live * 1000; bcast(r, phaseMsg(r)); }
  else if (r.phase === 'live' && !r.training) {
    const alive = [0, 1].map(k => [...r.players.values()].filter(p => p.team === k && p.alive));
    if (r.gameMode === 'spike' && r.spike?.planted) {
      if (alive[1].length === 0) endRound(r, 0, 'Savunma takımı elendi');
    } else {
      if (alive[0].length === 0) endRound(r, 1, 'Saldırı takımı elendi');
      else if (alive[1].length === 0) endRound(r, 0, 'Savunma takımı elendi');
      else if (t >= r.phaseEnd) {
        if (r.gameMode === 'spike') endRound(r, 1, 'Süre doldu, bomba kurulamadı');
        else {
          const hp = alive.map(a => a.reduce((s, p) => s + p.hp, 0));
          const w = alive[0].length !== alive[1].length ? (alive[0].length > alive[1].length ? 0 : 1) : (hp[0] !== hp[1] ? (hp[0] > hp[1] ? 0 : 1) : 1);
          endRound(r, w, 'Süre doldu');
        }
      }
    }
  }
  if (r.phase === 'live' || r.phase === 'buy') tickWorld(r, t);
  else if (r.phase === 'roundEnd' && t >= r.phaseEnd) startRound(r);
  else if (r.phase === 'matchEnd' && t >= r.phaseEnd) { r.phase = 'lobby'; pushRoom(r); pushRoomList(); return; }

  if (r.phase !== 'lobby') {
    bcast(r, { t: 'snap', obj: spikePayload(r, t), ps: [...r.players.values()].map(p => ({
      id: p.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3),
      a: p.alive ? 1 : 0, hp: p.hp, ar: p.armor, w: p.weapon, p1: p.primary, p2: p.secondary, am: p.ammo, rl: p.reloadUntil ? 1 : 0,
      cr: p.credits, k: p.kills, d: p.deaths, c: p.crouch ? 1 : 0,
      cde: Math.max(0, +((p.cd.e - t) / 1000).toFixed(1)), cdq: Math.max(0, +((p.cd.q - t) / 1000).toFixed(1)),
    })) });
  }
}

function tickSpike(r, t) {
  const s = r.spike; if (!s || r.phase !== 'live') return;
  const sites = MAP.sites?.length ? MAP.sites : [[-12, 0], [12, 0]];
  if (s.planted && t >= s.detonateAt) { endRound(r, 0, 'Bomba patladı'); return; }
  if (!s.planted && s.dropped && !s.carrier) {
    const bot = [...r.players.values()].find(p => p.isBot && p.team === 0 && p.alive && Math.hypot(p.x - s.dropped.x, p.z - s.dropped.z) <= SPIKE.pickupRadius);
    if (bot) { s.carrier = bot.id; s.dropped = null; spikeEvent(r, 'picked'); }
  }
  if (!s.planted && !r.spikeAction && s.carrier) {
    const p = r.players.get(s.carrier), site = sites[s.siteGoal] || sites[0];
    if (p?.isBot && p.alive && Math.hypot(p.x - site[0], p.z - site[1]) <= SPIKE.siteRadius) startSpikeAction(r, p, 'plant', s.siteGoal, t);
  }
  if (s.planted && !r.spikeAction) {
    const bot = [...r.players.values()].find(p => p.isBot && p.team === 1 && p.alive && Math.hypot(p.x - s.x, p.z - s.z) <= SPIKE.defuseRadius);
    if (bot) startSpikeAction(r, bot, 'defuse', s.site, t);
  }
  const a = r.spikeAction; if (!a) return;
  const p = r.players.get(a.playerId);
  if (!p?.alive) { r.spikeAction = null; return; }
  if (a.type === 'plant') {
    const site = sites[a.site];
    if (s.planted || p.team !== 0 || s.carrier !== p.id || !site || Math.hypot(p.x - site[0], p.z - site[1]) > SPIKE.siteRadius) { r.spikeAction = null; return; }
    if (t - a.startedAt >= a.duration) {
      s.planted = true; s.carrier = null; s.dropped = null; s.site = a.site; s.x = site[0]; s.z = site[1]; s.detonateAt = t + SPIKE.timerMs;
      r.spikeAction = null; spikeEvent(r, 'planted', { site: a.site, remain: SPIKE.timerMs });
    }
  } else if (a.type === 'defuse') {
    if (!s.planted || p.team !== 1 || Math.hypot(p.x - s.x, p.z - s.z) > SPIKE.defuseRadius) { r.spikeAction = null; return; }
    if (t - a.startedAt >= a.duration) endRound(r, 1, 'Bomba etkisizleştirildi');
  }
}

// ---------- savaş ----------
function applyDamage(r, att, vic, dmg, head, weapon) {
  if (!vic.alive) return;
  let absorbed = 0;
  if (vic.armor > 0) { absorbed = Math.min(vic.armor, dmg * 0.5); vic.armor -= absorbed; }
  vic.hp -= Math.round(dmg - absorbed); if (att !== vic) att.st.dmg += Math.min(dmg, vic.hp + Math.round(dmg - absorbed));
  bcast(r, { t: 'hit', v: vic.id, a: att.id, dmg: Math.round(dmg), head, hp: Math.max(0, vic.hp) });
  if (vic.hp <= 0) {
    vic.hp = 0; vic.alive = false; vic.deaths++; att.kills++;
    if (r.spike?.carrier === vic.id && !r.spike.planted) {
      r.spike.carrier = null; r.spike.dropped = { x: vic.x, z: vic.z }; r.spikeAction = null; spikeEvent(r, 'dropped');
    }
    att.credits = Math.min(ROUND.maxCredits, att.credits + ROUND.kill);
    bcast(r, { t: 'kill', k: att.id, v: vic.id, w: weapon, head, khp: Math.max(0, att.hp), kar: att.armor });
    if (r.training && vic.isBot) {
      vic.respawnAt = now() + 850;
      return;
    }
    const dw = vic.primary || (vic.secondary !== 'classic' ? vic.secondary : null);
    if (dw) { addDrop(r, dw, vic, dw === vic.weapon ? vic.ammo : (vic.mags[dw] ?? WEAPONS[dw].mag)); if (dw === vic.primary) vic.primary = null; else vic.secondary = null; pushDrops(r); }
  }
}
function doShoot(r, p, m) {
  if (r.phase !== 'live' || !p.alive) return;
  const t = now(), w = WEAPONS[p.weapon];
  if (p.reloadUntil || t < p.nextShot) return;
  if (w.melee) return doMelee(r, p, m, t, w);
  if (p.ammo <= 0) return startReload(p);
  p.ammo--; p.nextShot = t + 60000 / w.rpm - 8;
  const base = norm([num(m.dx), num(m.dy), num(m.dz, -1)]);
  const o = [p.x, p.y + EYE - (p.crouch ? 0.55 : 0), p.z];
  const hits = new Map(), tracers = [];
  p.st.shots += w.pellets;
  // nişan (sağ tık) isabeti artırır; keskin nişancı tüfeği dürbünsüz isabetsizdir. Botlar ads göndermez (çarpan 1)
  const adsMul = m.ads === 1 ? (w.pellets > 1 ? 0.85 : 0.55) : m.ads === 0 && (w.name === 'Operator' || w.name === 'Marshal') ? 6 : 1;
  const spr = w.spread * (1 + Math.min(p.speed, 7) * 0.35) * adsMul * (p.crouch ? 0.75 : 1);
  for (let i = 0; i < w.pellets; i++) {
    const d = i === 0 && w.pellets === 1 && p.speed < 0.5 && adsMul <= 1 ? base : spreadDir(base, spr);
    let tMax = Math.min(w.range, rayBoxes(o, d, w.range)), target = null;
    for (const v of r.players.values()) {
      if (v.team === p.team || !v.alive) continue;
      const h = rayPlayer(o, d, v);
      if (h && h.t < tMax) { tMax = h.t; target = { v, head: h.head && !(p.isBot && LEVELS[r.level]?.noHead) }; }
    }
    tracers.push([+(o[0] + d[0] * tMax).toFixed(2), +(o[1] + d[1] * tMax).toFixed(2), +(o[2] + d[2] * tMax).toFixed(2), target ? 1 : 0]);
    if (target) {
      const e = hits.get(target.v) || { dmg: 0, head: false };
      e.dmg += w.dmg * (target.head ? 2 : 1); e.head = e.head || target.head; p.st.hits++; if (target.head) p.st.heads++;
      hits.set(target.v, e);
    }
  }
  bcast(r, { t: 'shot', id: p.id, w: p.weapon, o: o.map(n => +n.toFixed(2)), tr: tracers });
  for (const [v, e] of hits) applyDamage(r, p, v, e.dmg, e.head, p.weapon);
  if (p.ammo === 0) startReload(p);
}
function doMelee(r, p, m, t, w) {
  const heavy = !!m.alt;
  p.nextShot = t + 60000 / (heavy ? w.heavyRpm : w.rpm) - 8;
  const d = norm([num(m.dx), num(m.dy), num(m.dz, -1)]), o = [p.x, p.y + EYE, p.z];
  const wallT = rayBoxes(o, d, w.range);
  let tMax = Math.min(w.range, wallT), target = null;
  for (const v of r.players.values()) {
    if (v.team === p.team || !v.alive) continue;
    const h = rayPlayer(o, d, v);
    if (h && h.t < tMax) { tMax = h.t; target = { v, head: h.head }; }
  }
  if (!target) for (const v of r.players.values()) { // bıçak için hafif tolerans konisi
    if (v.team === p.team || !v.alive) continue;
    const to = [v.x - o[0], v.y + 1.2 - o[1], v.z - o[2]], dist = Math.hypot(...to);
    if (dist < w.range + 0.4 && dist < wallT + 0.3 && (to[0] * d[0] + to[1] * d[1] + to[2] * d[2]) / dist > 0.9) { target = { v, head: false }; break; }
  }
  bcast(r, { t: 'shot', id: p.id, w: 'knife', heavy, o: o.map(n => +n.toFixed(2)), tr: [] });
  if (target) applyDamage(r, p, target.v, heavy ? w.heavy : w.dmg * (target.head ? 1.5 : 1), target.head, 'knife');
}
// slotlar: 1 ana silah, 2 tabanca, 3 bıçak
function equip(p, id, draw = true) {
  if (!id || !WEAPONS[id]) return;
  if (p.weapon && WEAPONS[p.weapon] && !WEAPONS[p.weapon].melee) p.mags[p.weapon] = p.ammo;
  p.weapon = id; p.ammo = WEAPONS[id].melee ? 0 : (p.mags[id] ?? WEAPONS[id].mag); p.reloadUntil = 0;
  if (draw) p.nextShot = Math.max(p.nextShot || 0, now() + 400);
}
function giveWeapon(p, id) { if (slotOf(id) === 2) p.secondary = id; else p.primary = id; p.mags[id] = WEAPONS[id].mag; }
const bestWeapon = (p) => p.primary || p.secondary || 'knife';
function doSlot(r, p, s) {
  if (!p.alive || (r.phase !== 'live' && r.phase !== 'buy')) return;
  const id = s === 1 ? p.primary : s === 2 ? p.secondary : 'knife';
  if (id && id !== p.weapon) equip(p, id);
}
function startReload(p) {
  const w = WEAPONS[p.weapon];
  if (w.melee) return;
  if (p.reloadUntil || p.ammo >= w.mag || !p.alive) return;
  p.reloadUntil = now() + w.reload * 1000;
}
function doBuy(r, p, item) {
  if (r.phase !== 'buy' || !p.alive) return;
  if (item === 'armor') {
    if (p.credits < ARMOR.price || p.armor >= ARMOR.amount) return;
    p.credits -= ARMOR.price; p.armor = ARMOR.amount;
  } else if (WEAPONS[item]) {
    const w = WEAPONS[item];
    if (w.melee || p.primary === item || p.secondary === item || p.credits < w.price) return;
    p.credits -= w.price; giveWeapon(p, item); equip(p, item, false);
  }
}
function doAbility(r, p, slot) {
  if (r.phase !== 'live' || !p.alive) return;
  const ab = AGENTS[p.agent]?.abilities[slot]; if (!ab) return;
  const t = now(); if (t < p.cd[slot]) return;
  const o = [p.x, p.y + EYE, p.z], d = lookDir(p);
  switch (ab.id) {
    case 'heal':
      if (p.hp >= 100) return;
      p.hp = Math.min(100, p.hp + 50); break;
    case 'smoke': {
      const hd = norm([d[0], 0, d[2]]);
      const dist = Math.min(10, rayBoxes([o[0], 1, o[2]], hd, 10) - 1.5);
      bcast(r, { t: 'fx', type: 'smoke', x: o[0] + hd[0] * Math.max(1, dist), z: o[2] + hd[2] * Math.max(1, dist), dur: 10000 });
      break;
    }
    case 'flash': {
      const dist = Math.max(1, Math.min(14, rayBoxes(o, d, 14) - 0.6));
      const pt = [o[0] + d[0] * dist, o[1] + d[1] * dist, o[2] + d[2] * dist];
      bcast(r, { t: 'fx', type: 'flash', x: pt[0], y: pt[1], z: pt[2] });
      for (const e of r.players.values()) {
        if (e.team === p.team || !e.alive) continue;
        const eo = [e.x, e.y + EYE, e.z], v = [pt[0] - eo[0], pt[1] - eo[1], pt[2] - eo[2]];
        const len = Math.hypot(...v); if (len > 40) continue;
        const vn = [v[0] / len, v[1] / len, v[2] / len], ed = lookDir(e);
        const dot = vn[0] * ed[0] + vn[1] * ed[1] + vn[2] * ed[2];
        if (dot < 0.15 || rayBoxes(eo, vn, len) < len - 0.2) continue;
        send(e, { t: 'flashed', dur: 1.2 + dot * 1.4 });
      }
      break;
    }
    case 'blast':
      bcast(r, { t: 'fx', type: 'blast', x: p.x, y: p.y, z: p.z });
      for (const e of r.players.values()) {
        if (e.team === p.team || !e.alive) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) <= 7) applyDamage(r, p, e, 40, false, 'blast');
      }
      break;
    case 'wall': { // önüne 8 sn'lik bariyer
      const hd = norm([d[0], 0, d[2]]), dist = Math.max(1.2, Math.min(3, rayBoxes([o[0], 1, o[2]], hd, 3) - 0.6));
      const cx = p.x + hd[0] * dist, cz = p.z + hd[2] * dist, alongX = Math.abs(hd[2]) > Math.abs(hd[0]);
      const w = alongX ? 4.4 : 0.45, dd = alongX ? 0.45 : 4.4, h = 3.2, dur = 8000;
      r.walls.push({ min: [cx - w / 2, 0, cz - dd / 2], max: [cx + w / 2, h, cz + dd / 2], until: t + dur });
      bcast(r, { t: 'fx', type: 'wall', x: cx, z: cz, w, d: dd, h, dur, team: p.team });
      break;
    }
    case 'molly': { // baktığın yere düşen ateş alanı
      const dist = Math.max(1.5, Math.min(16, rayBoxes(o, d, 16) - 0.3)), x = o[0] + d[0] * dist, z = o[2] + d[2] * dist;
      r.fires.push({ x, z, rad: 3, until: t + 5000, next: t, owner: p.id, team: p.team });
      bcast(r, { t: 'fx', type: 'molly', x, z, rad: 3, dur: 5000 });
      break;
    }
    case 'recon': { // 40 m içindeki düşmanları 4 sn takıma gösterir
      const ids = [...r.players.values()].filter(e => e.team !== p.team && e.alive && Math.hypot(e.x - p.x, e.z - p.z) < 40).map(e => e.id);
      bcast(r, { t: 'fx', type: 'recon', x: p.x, y: p.y, z: p.z });
      for (const m of r.players.values()) if (m.team === p.team) send(m, { t: 'reveal', ids, dur: 4000 });
      break;
    }
    case 'turret':
    case 'mine': {
      r.deployables ||= [];
      if (r.deployables.filter((x) => x.owner === p.id && x.type === ab.id).length >= 2) return;
      const hd = norm([d[0], 0, d[2]]), dist = Math.max(1.4, Math.min(3.6, rayBoxes([p.x, 0.8, p.z], hd, 3.6) - 0.8));
      const x = p.x + hd[0] * dist, z = p.z + hd[2] * dist;
      const blocked = [...BOXES, ...WALLS].some((b) => x > b.min[0] - 0.55 && x < b.max[0] + 0.55 && z > b.min[2] - 0.55 && z < b.max[2] + 0.55);
      if (blocked || Math.abs(x) > MAP.halfX - 1 || Math.abs(z) > MAP.halfZ - 1) return;
      const dur = ab.id === 'turret' ? 18000 : 30000;
      const item = { id: deployableId++, type: ab.id, owner: p.id, team: p.team, x, z, until: t + dur, next: t + 700 };
      r.deployables.push(item);
      bcast(r, { t: 'fx', type: ab.id, id: item.id, owner: p.id, team: p.team, x, z, dur });
      break;
    }
    default: break; // dash / haste istemcide uygulanır
  }
  p.cd[slot] = t + ab.cd * 1000;
  send(p, { t: 'abil', id: ab.id, slot });
}

// ---------- yere düşen silahlar · geçici duvar/ateş ----------
let dropId = 1, deployableId = 1;
function addDrop(r, w, p, ammo, thrown = false) { // thrown: G ile atılan silah öne fırlar, sahibi 1.5 sn geri alamaz
  let x = p.x + (Math.random() - 0.5) * 0.6, z = p.z + (Math.random() - 0.5) * 0.6;
  if (thrown) { const hd = norm([-Math.sin(p.yaw), 0, -Math.cos(p.yaw)]), dist = Math.max(0.3, Math.min(1.8, rayBoxes([p.x, 0.5, p.z], hd, 1.8) - 0.4)); x = p.x + hd[0] * dist; z = p.z + hd[2] * dist; }
  r.drops.push({ id: dropId++, w, x, y: p.y, z, ammo, by: thrown ? p.id : null, lockUntil: thrown ? now() + 1500 : 0 });
  if (r.drops.length > 30) r.drops.shift();
}
const pushDrops = (r) => bcast(r, { t: 'drops', d: (r.drops || []).map(d => ({ id: d.id, w: d.w, x: +d.x.toFixed(2), y: +d.y.toFixed(2), z: +d.z.toFixed(2) })) });
function takeDrop(r, p, d) {
  r.drops = r.drops.filter(x => x !== d);
  if (slotOf(d.w) === 2) p.secondary = d.w; else p.primary = d.w;
  p.mags[d.w] = d.ammo;
}
function doDrop(r, p) { // G: yakındaki silahla değiş, yoksa elindekini at
  if (!p.alive || (r.phase !== 'live' && r.phase !== 'buy')) return;
  let near = null, nd = 2.2;
  for (const d of r.drops) { const k = Math.hypot(d.x - p.x, d.z - p.z); if (k < nd && Math.abs(d.y - p.y) < 1.5) { near = d; nd = k; } }
  if (near) {
    const slot = slotOf(near.w), cur = slot === 2 ? p.secondary : p.primary;
    if (cur) addDrop(r, cur, p, cur === p.weapon ? p.ammo : (p.mags[cur] ?? WEAPONS[cur].mag), true);
    if (cur === p.weapon) p.weapon = null;
    takeDrop(r, p, near); equip(p, near.w);
  } else {
    const w = p.weapon; if (!w || WEAPONS[w].melee) return;
    addDrop(r, w, p, p.ammo, true);
    if (w === p.primary) p.primary = null; else if (w === p.secondary) p.secondary = null;
    p.weapon = null; equip(p, bestWeapon(p));
  }
  pushDrops(r);
}
function tickWorld(r, t) {
  if (r.walls.length && r.walls.some(w => t >= w.until)) { r.walls = r.walls.filter(w => t < w.until); WALLS = r.walls; }
  r.fires = r.fires.filter(f => t < f.until);
  for (const f of r.fires) {
    if (t < f.next) continue; f.next = t + 250;
    const owner = r.players.get(f.owner);
    for (const e of r.players.values()) if (e.alive && e.team !== f.team && e.y < 1.2 && Math.hypot(e.x - f.x, e.z - f.z) < f.rad) applyDamage(r, owner || e, e, 8, false, 'molly');
  }
  r.deployables ||= [];
  for (let i = r.deployables.length - 1; i >= 0; i--) {
    const item = r.deployables[i];
    if (t >= item.until) { r.deployables.splice(i, 1); bcast(r, { t: 'fx', type: 'deployableRemove', id: item.id }); continue; }
    if (item.type === 'turret' && t >= item.next) {
      item.next = t + 700;
      let target = null, best = 16;
      for (const e of r.players.values()) {
        if (!e.alive || e.team === item.team) continue;
        const dx = e.x - item.x, dz = e.z - item.z, dist = Math.hypot(dx, dz);
        if (dist >= best) continue;
        const dir = [dx / Math.max(dist, .001), ((e.y + .9) - .8) / Math.max(dist, .001), dz / Math.max(dist, .001)];
        if (rayBoxes([item.x, .8, item.z], dir, dist) >= dist - .35) { target = e; best = dist; }
      }
      const owner = r.players.get(item.owner);
      if (target && owner) {
        bcast(r, { t: 'fx', type: 'turretShot', x: item.x, z: item.z, tx: target.x, tz: target.z });
        applyDamage(r, owner, target, 7, false, 'turret');
      }
    } else if (item.type === 'mine') {
      const target = [...r.players.values()].find((e) => e.alive && e.team !== item.team && Math.hypot(e.x - item.x, e.z - item.z) < 1.35);
      if (target) {
        const owner = r.players.get(item.owner) || target;
        r.deployables.splice(i, 1);
        bcast(r, { t: 'fx', type: 'deployableRemove', id: item.id });
        bcast(r, { t: 'fx', type: 'mineBlast', x: item.x, z: item.z });
        for (const e of r.players.values()) if (e.alive && e.team !== item.team) {
          const dist = Math.hypot(e.x - item.x, e.z - item.z);
          if (dist < 4.2) applyDamage(r, owner, e, Math.max(12, Math.round(48 - dist * 8)), false, 'mine');
        }
      }
    }
  }
  let changed = false;
  for (const p of r.players.values()) {
    if (!p.alive) continue;
    for (const d of r.drops) {
      if (Math.hypot(d.x - p.x, d.z - p.z) > 1.1 || Math.abs(d.y - p.y) > 1.5 || (d.by === p.id && t < d.lockUntil)) continue;
      const slot = slotOf(d.w); if ((slot === 2 ? p.secondary : p.primary)) continue;
      takeDrop(r, p, d); if (slot === 1 || WEAPONS[p.weapon]?.melee) equip(p, d.w); changed = true; break;
    }
  }
  if (changed) pushDrops(r);
}

// ---------- botlar ----------
const BOT_NAMES = ['Kaan', 'Deniz', 'Ece', 'Berk', 'Mert', 'Selin', 'Arda', 'Zeynep', 'Can', 'Defne', 'Emre', 'Işık'];
const LEVELS = {
  easy:   { react: 650, err: 0.065, head: 0, noHead: true, speed: 4.3, gap: 380 }, // kolay botlar kafadan vuramaz
  normal: { react: 400, err: 0.034, head: 0.18, speed: 5.1, gap: 230 },
  hard:   { react: 200, err: 0.016, head: 0.33, speed: 5.8, gap: 120 },
};
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
function addBot(r, team) {
  if (r.phase !== 'lobby' || teamCount(r, team) >= r.mode) return false;
  const id = nextId++;
  const b = newPlayer({ readyState: 0, send() {} }, id, 'Bot ' + BOT_NAMES[id % BOT_NAMES.length]);
  b.isBot = true; b.room = r; b.team = team; b.agent = Object.keys(AGENTS)[Math.floor(Math.random() * Object.keys(AGENTS).length)];
  r.players.set(id, b); return true;
}
function fillBots(r) { for (const t of [0, 1]) while (teamCount(r, t) < r.mode) addBot(r, t); }
function resetBot(p) { p.bot = { target: null, seen: 0, lost: 0, goal: null, goalAt: 0, strafe: 1, strafeAt: 0, unstick: 0, uDir: 1, stuckT: 0, nextTrig: 0, last: [p.x, p.z] }; }
function botBuy(r, p) {
  const c = p.credits, any = (a) => a[Math.floor(Math.random() * a.length)];
  let w = null;
  if (c >= 4700 + ARMOR.price && Math.random() < 0.3) w = 'operator';
  else if (c >= 3200 && Math.random() < 0.25) w = 'ares';
  else if (c >= 2900) w = any(['vandal', 'phantom']);
  else if (c >= 1850 + ARMOR.price && Math.random() < 0.4) w = 'judge';
  else if (c >= 1600) w = 'spectre';
  else if (c >= 950 + ARMOR.price && Math.random() < 0.4) w = 'marshal';
  else if (c >= 800 + ARMOR.price) w = 'sheriff';
  else if (c >= 500) w = 'ghost';
  if (w) doBuy(r, p, w);
  if (p.credits >= ARMOR.price) doBuy(r, p, 'armor');
  equip(p, bestWeapon(p), false);
}
function botPush(p) {
  for (let it = 0; it < 2; it++) for (const list of [BOXES, WALLS]) for (const b of list) {
    const cx = clampN(p.x, b.min[0], b.max[0]), cz = clampN(p.z, b.min[2], b.max[2]);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= 0.16) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (0.4 - d) / d; p.x += dx * k; p.z += dz * k; }
    else { const ox = (b.max[0] - b.min[0]) / 2 - Math.abs(p.x - (b.max[0] + b.min[0]) / 2); p.x += (p.x < (b.max[0] + b.min[0]) / 2 ? -1 : 1) * (ox + 0.4); }
  }
  p.x = clampN(p.x, -MAP.halfX + 0.5, MAP.halfX - 0.5); p.z = clampN(p.z, -MAP.halfZ + 0.5, MAP.halfZ - 0.5);
}
function botThink(r, p, t, dt) {
  const B = p.bot, L = LEVELS[r.level] || LEVELS.normal;
  if (r.spikeAction?.playerId === p.id) { p.speed = 0; return; }
  const eye = [p.x, 1.6, p.z];
  // hedef seç: görüş hattı olan en yakın düşman
  let best = null, bd = 1e9;
  for (const v of r.players.values()) {
    if (v.team === p.team || !v.alive) continue;
    const to = [v.x - eye[0], 1.3 - eye[1], v.z - eye[2]], dist = Math.hypot(...to);
    if (dist > 75 || dist >= bd) continue;
    if (rayBoxes(eye, [to[0] / dist, to[1] / dist, to[2] / dist], dist) >= dist - 0.3) { best = v; bd = dist; }
  }
  if (best) { if (B.target !== best.id) { B.target = best.id; B.seen = t; } B.lost = t; B.last = [best.x, best.z]; }
  else if (t - B.lost > 1800) B.target = null;

  // hedef noktası
  let mx = 0, mz = 0, speed = L.speed;
  if (best) {
    const dx = best.x - p.x, dz = best.z - p.z, d = Math.hypot(dx, dz) || 1;
    if (t > B.strafeAt) { B.strafe = Math.random() < 0.5 ? 1 : -1; B.strafeAt = t + 500 + Math.random() * 900; }
    const adv = d > 20 ? 1 : d < 7 ? -0.7 : 0.1;
    mx = (dx / d) * adv + (-dz / d) * B.strafe * 0.8; mz = (dz / d) * adv + (dx / d) * B.strafe * 0.8; speed *= 0.75;
  } else {
    const s = r.gameMode === 'spike' ? r.spike : null;
    let objective = null;
    if (s?.planted && p.team === 1) objective = [s.x, s.z];
    else if (s?.dropped && p.team === 0) objective = [s.dropped.x, s.dropped.z];
    else if (s && !s.planted && p.team === 0 && s.carrier === p.id) objective = (MAP.sites?.length ? MAP.sites : [[-12, 0], [12, 0]])[s.siteGoal];
    if (objective) { B.goal = objective; B.goalAt = t + 1000; }
    else {
      const reached = B.goal && Math.hypot(B.goal[0] - p.x, B.goal[1] - p.z) < 2.5;
      if (!B.goal || reached || t > B.goalAt) {
        B.goal = Math.random() < 0.45 && B.last ? B.last : MAP.goals[Math.floor(Math.random() * MAP.goals.length)]; B.goalAt = t + 9000;
      }
    }
    let [gx, gz] = B.goal;
    if (Math.abs(p.x) > MAP.halfX - 12 && Math.abs(gx) < MAP.halfX - 12) { gx = Math.sign(p.x) * (MAP.halfX - 16); gz = 0; } // spawn odasından geçitle çık
    const dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz) || 1; mx = dx / d; mz = dz / d;
  }
  if (t < B.unstick) { const l = Math.hypot(mx, mz) || 1; const px = -mz / l, pz = mx / l; mx = px * B.uDir; mz = pz * B.uDir; }
  const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
  const ox = p.x, oz = p.z;
  p.x += mx * speed * dt; botPush(p); p.z += mz * speed * dt; botPush(p);
  const moved = Math.hypot(p.x - ox, p.z - oz) / dt; p.speed = moved;
  if (moved < speed * 0.3) { B.stuckT += dt; if (B.stuckT > 0.4) { B.unstick = t + 700; B.uDir = Math.random() < 0.5 ? 1 : -1; B.stuckT = 0; B.goal = null; } } else B.stuckT = 0;

  // bakış ve ateş
  if (best) {
    const aimY = best.y + (Math.random() < L.head ? 1.55 : 1.15) - (best.crouch ? 0.52 : 0);
    let d = [best.x - eye[0], aimY - eye[1], best.z - eye[2]]; d = norm(d);
    p.yaw = Math.atan2(-d[0], -d[2]); p.pitch = Math.asin(d[1]);
    const w = WEAPONS[p.weapon];
    if (t - B.seen >= L.react && t >= B.nextTrig && !p.reloadUntil) {
      doShoot(r, p, (() => { const j = spreadDir(d, L.err); return { dx: j[0], dy: j[1], dz: j[2] }; })());
      B.nextTrig = t + (w.auto ? 0 : L.gap + Math.random() * L.gap);
    }
    const ab = AGENTS[p.agent].abilities;
    if (ab.q.id === 'blast' && bd < 6) doAbility(r, p, 'q');
    if (ab.q.id === 'flash' && bd > 8 && bd < 22 && t - B.seen > 200) doAbility(r, p, 'q');
    if (ab.e.id === 'haste') doAbility(r, p, 'e');
    if (ab.q.id === 'molly' && bd > 4 && bd < 15 && t - B.seen > 300) doAbility(r, p, 'q');
    if (ab.e.id === 'wall' && p.hp < 60 && bd > 5) doAbility(r, p, 'e');
    if (ab.e.id === 'turret' && bd > 7 && bd < 15) doAbility(r, p, 'e');
    if (ab.q.id === 'turret' && bd > 7 && bd < 15) doAbility(r, p, 'q');
    if ((ab.e.id === 'mine' || ab.q.id === 'mine') && bd < 4.5) doAbility(r, p, ab.e.id === 'mine' ? 'e' : 'q');
  } else {
    p.yaw = Math.atan2(-mx, -mz); p.pitch = 0;
    if (p.hp < 60 && AGENTS[p.agent].abilities.e.id === 'heal') doAbility(r, p, 'e');
    if (AGENTS[p.agent].abilities.q.id === 'recon') doAbility(r, p, 'q');
    if (p.ammo < WEAPONS[p.weapon].mag * 0.5) startReload(p);
  }
}

// ---------- ağ ----------
wss.on('connection', (ws) => {
  const c = newPlayer(ws, nextId++, 'Oyuncu');
  clients.set(c.id, c);
  send(c, { t: 'welcome', id: c.id, map: mapPayload(), lan: lanAddrs() });
  send(c, { t: 'rooms', rooms: listRooms() });

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const r = c.room; useMap(r);
    switch (m.t) {
      case 'hello': c.name = cleanName(m.name); if (r) pushRoom(r); break;
      case 'list': send(c, { t: 'rooms', rooms: listRooms() }); break;
      case 'create': { // solo: botlara karşı, anında başlar · değilse: LAN odası (arkadaşlar kodla katılır)
        if (r) return;
        const training = !!m.training, solo = !!m.solo || training;
        const mode = training ? RANGE_TARGETS.length : Math.max(1, Math.min(5, num(m.mode, 3) | 0));
        const room = { code: makeCode(), mode, host: c.id, players: new Map(), phase: 'lobby', round: 0, score: [0, 0], phaseEnd: 0, level: 'normal', solo, training, targetMode: m.targetMode === 'static' ? 'static' : 'moving', gameMode: m.gameMode === 'spike' && !training ? 'spike' : 'elimination', spike: null, spikeAction: null, deployables: [] };
        room.level = ['easy', 'normal', 'hard'].includes(m.level) ? m.level : 'normal';
        const validMaps = room.gameMode === 'spike' ? SPIKE_MAPS : MATCH_MAPS;
        room.mapPick = training ? 'range' : (validMaps.includes(m.map) ? m.map : 'random');
         room.map = training ? 'range' : chooseMap(room.mapPick, room.gameMode);
         room.mapConfig = !training && room.map === m.map ? cleanMapEditorConfig(room.map, m.mapConfig) : null;
         useMap(room);
        c.agent = AGENTS[m.agent] ? m.agent : 'soldier';
        c.pick = 'classic';
        rooms.set(room.code, room); joinRoom(c, room);
        if (!c.room) break;
        if (training) {
          c.team = 0;
          for (let i = 0; i < RANGE_TARGETS.length; i++) addBot(room, 1);
          startTraining(room);
        }
        else if (solo) { c.team = 0; fillBots(room); startMatch(room); }
        else if (m.bots) { fillBots(room); pushRoom(room); }
        break;
      }
      case 'join': {
        if (r) return;
        const room = rooms.get(String(m.code || '').toUpperCase().trim());
        if (room && room.solo) return send(c, { t: 'err', msg: 'Bu oda botlara karşı özel maç. Arkadaş odası için ODA KUR kullan.' });
        if (!room) return send(c, { t: 'err', msg: 'Oda bulunamadı. Arkadaşınla aynı site adresinde olduğundan emin ol.' });
        if (room.phase !== 'lobby') return send(c, { t: 'err', msg: 'Bu odada maç başlamış.' });
        if (AGENTS[m.agent]) c.agent = m.agent;
        c.pick = 'classic';
        joinRoom(c, room); break;
      }
      case 'pick': break; // başlangıç silahı seçimi kaldırıldı
      case 'leave': leaveRoom(c); send(c, { t: 'left' }); send(c, { t: 'rooms', rooms: listRooms() }); break;
      case 'team':
        if (r && r.phase === 'lobby' && (m.team === 0 || m.team === 1) && m.team !== c.team && freeSlot(r, m.team)) { c.team = m.team; pushRoom(r); }
        break;
      case 'addBot': if (r && r.host === c.id && (m.team === 0 || m.team === 1) && addBot(r, m.team)) { pushRoom(r); } break;
      case 'removeBot': { const b = r && r.host === c.id && r.phase === 'lobby' ? r.players.get(m.id) : null; if (b && b.isBot) { r.players.delete(b.id); pushRoom(r); } break; }
      case 'level': if (r && r.host === c.id && LEVELS[m.level]) { r.level = m.level; pushRoom(r); } break;
       case 'setMap': if (r && r.host === c.id && r.phase === 'lobby') { const validMaps = r.gameMode === 'spike' ? SPIKE_MAPS : MATCH_MAPS; r.mapPick = validMaps.includes(m.map) ? m.map : 'random'; r.map = chooseMap(r.mapPick, r.gameMode); r.mapConfig = null; useMap(r); pushRoom(r); } break;
      case 'agent': if (r && r.phase === 'lobby' && AGENTS[m.agent]) { c.agent = m.agent; pushRoom(r); } break;
      case 'start':
        if (!r || r.host !== c.id || r.phase !== 'lobby') return;
        if (r.gameMode === 'spike') fillBots(r); // Spike odası tek başınayken de açılabilsin; arkadaşlar lobide botların yerini alabilir.
        if (teamCount(r, 0) < 1 || teamCount(r, 1) < 1) return send(c, { t: 'err', msg: 'Maçı başlatmak için iki takımda da oyuncu veya bot olmalı.' });
        startMatch(r); pushRoomList(); break;
      case 'chat': {
        if (!r || c.isBot) return;
        const t = now();
        if (t - c.lastChatAt < 600) return;
        const text = String(m.text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 180);
        if (!text) return;
        c.lastChatAt = t;
        bcast(r, { t: 'chat', id: c.id, team: c.team, name: cleanName(c.name), text });
        break;
      }
      case 'state':
        if (!r || r.paused || !c.alive || (r.phase !== 'live' && r.phase !== 'buy')) return;
        { const t = now(), dt = Math.max(0.016, (t - c.lastPos) / 1000);
          const nx = num(m.x), nz = num(m.z);
          c.speed = r.phase === 'live' ? Math.hypot(nx - c.x, nz - c.z) / dt : 0; c.lastPos = t;
          if (r.phase === 'live') { c.x = Math.max(-MAP.halfX + 1, Math.min(MAP.halfX - 1, nx)); c.z = Math.max(-MAP.halfZ + 1, Math.min(MAP.halfZ - 1, nz)); c.y = Math.max(0, Math.min(6, num(m.y))); }
          c.crouch = !!m.c; c.yaw = num(m.yaw); c.pitch = Math.max(-1.55, Math.min(1.55, num(m.pitch))); }
        break;
      case 'pause': pauseRoom(r, c); break;
      case 'resume': resumeRoom(r, c); break;
      case 'shoot': if (r && !r.paused) doShoot(r, c, m); break;
      case 'drop': if (r && !r.paused) doDrop(r, c); break;
      case 'reload': if (r && !r.paused && r.phase === 'live') startReload(c); break;
      case 'buy': if (r && !r.paused) doBuy(r, c, m.item); break;
      case 'slot': if (r && !r.paused) doSlot(r, c, m.s === 1 ? 1 : m.s === 2 ? 2 : 3); break;
      case 'ability': if (r && !r.paused) doAbility(r, c, m.slot === 'q' ? 'q' : 'e'); break;
      case 'objective': if (r && !r.paused) doObjective(r, c, m.action); break;
      default: break;
    }
  });
  ws.on('close', () => { leaveRoom(c); clients.delete(c.id); });
});

setInterval(() => { for (const r of rooms.values()) tickRoom(r); }, 50);
setInterval(pushRoomList, 3000);

function lanAddrs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) out.push(`${n.address}:${PORT}`);
  return out;
}
if (process.env.VERCEL !== '1') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n  ZORTLORANT sunucusu çalışıyor\n');
    console.log(`  Bu bilgisayar : http://localhost:${PORT}`);
    for (const list of Object.values(os.networkInterfaces()))
      for (const n of list || []) if (n.family === 'IPv4' && !n.internal) console.log(`  LAN (aynı ağdaki cihazlar için): http://${n.address}:${PORT}`);
    console.log('');
  });
}

export default server;
