// GLB harita yükleyicisi ve çarpışma üreticisi.
// İsteğe bağlı ayar dosyası: public/models/maps/map.json
//   { "fit": 90, "scale": 1, "rotY": 0, "minHeight": 0.5, "ignore": ["grass","tree"], "spawnX": 36, "goals": [[x,z],...] }
// fit: haritanın en uzun kenarını bu metreye ölçekler (scale verilmezse). Varsayılan 90.
import fs from 'fs';
import path from 'path';

const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) { // sütun-öncelikli 4x4
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function trs(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q, x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
const tp = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

function readGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('GLB değil');
  let off = 12, json = null, bin = Buffer.alloc(0);
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) json = JSON.parse(buf.toString('utf8', off + 8, off + 8 + len));
    if (type === 0x004e4942) bin = buf.subarray(off + 8, off + 8 + len);
    off += 8 + len;
  }
  if (!json) throw new Error('GLB JSON bölümü yok');
  return { json, bin };
}

function qmul(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
function rootFor(cfg) {
  const x = (cfg.rotX || 0) * Math.PI / 180, y = (cfg.rotY || 0) * Math.PI / 180, z = (cfg.rotZ || 0) * Math.PI / 180;
  const qx = [Math.sin(x / 2), 0, 0, Math.cos(x / 2)], qy = [0, Math.sin(y / 2), 0, Math.cos(y / 2)], qz = [0, 0, Math.sin(z / 2), Math.cos(z / 2)];
  return trs([0, 0, 0], qmul(qmul(qx, qy), qz));
}
function componentReader(buf, type, offset) {
  if (type === 5121) return buf.readUInt8(offset);
  if (type === 5123) return buf.readUInt16LE(offset);
  if (type === 5125) return buf.readUInt32LE(offset);
  if (type === 5126) return buf.readFloatLE(offset);
  throw new Error(`GLB erişimci türü desteklenmiyor: ${type}`);
}
function readAccessor(j, bin, index, width) {
  const a = j.accessors[index], v = j.bufferViews[a.bufferView];
  if (!a || !v || a.sparse) throw new Error('Seyrek GLB erişimcisi desteklenmiyor');
  const bytes = a.componentType === 5121 ? 1 : a.componentType === 5123 ? 2 : 4;
  const stride = v.byteStride || width * bytes, start = (v.byteOffset || 0) + (a.byteOffset || 0), out = new Array(a.count);
  for (let i = 0; i < a.count; i++) {
    const p = start + i * stride;
    out[i] = width === 1 ? componentReader(bin, a.componentType, p) : Array.from({ length: width }, (_, k) => componentReader(bin, a.componentType, p + k * bytes));
  }
  return out;
}

function triangleGridBoxes(j, bin, raw, scale, offset, halfX, halfZ, cfg) {
  const cell = Math.max(0.5, Math.min(1.5, cfg.collisionCell || 0.9));
  const lowY = cfg.collisionMinY ?? 0.65, highY = cfg.collisionMaxY ?? 2.2;
  const ignore = (cfg.ignore || []).map(s => s.toLowerCase()), cells = new Map();
  const nx = Math.ceil(halfX * 2 / cell), nz = Math.ceil(halfZ * 2 / cell);
  const mark = (x, z, h) => {
    const ix = Math.floor((x + halfX) / cell), iz = Math.floor((z + halfZ) / cell);
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return;
    const key = `${iz}:${ix}`;
    cells.set(key, Math.max(cells.get(key) || 0, h));
  };
  for (const r of raw) {
    if (ignore.some(s => r.name.includes(s))) continue;
    for (const primitive of j.meshes[r.meshIndex].primitives || []) {
      if (primitive.mode !== undefined && primitive.mode !== 4) continue;
      const posId = primitive.attributes?.POSITION;
      if (posId === undefined) continue;
      const vertices = readAccessor(j, bin, posId, 3);
      const indices = primitive.indices === undefined ? vertices.map((_, i) => i) : readAccessor(j, bin, primitive.indices, 1);
      for (let i = 0; i + 2 < indices.length; i += 3) {
        const tri = [vertices[indices[i]], vertices[indices[i + 1]], vertices[indices[i + 2]]]
          .map(p => tp(r.m, p).map((v, a) => v * scale + offset[a]));
        const a = tri[0], b = tri[1], c = tri[2];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const nxv = uy * vz - uz * vy, nyv = uz * vx - ux * vz, nzv = ux * vy - uy * vx;
        const normalLength = Math.hypot(nxv, nyv, nzv);
        if (normalLength < 1e-6 || Math.abs(nyv) / normalLength > 0.58) continue;
        const minY = Math.min(a[1], b[1], c[1]), maxY = Math.max(a[1], b[1], c[1]);
        if (maxY < lowY || minY > highY || maxY - minY < 0.45) continue;
        const top = Math.min(6, maxY);
        for (const [p, q] of [[a, b], [b, c], [c, a]]) {
          const dx = q[0] - p[0], dz = q[2] - p[2];
          const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (cell * 0.42)));
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            mark(p[0] + dx * t, p[2] + dz * t, top);
          }
        }
      }
    }
  }
  const rows = new Map();
  for (const [key, h] of cells) {
    const [iz, ix] = key.split(':').map(Number);
    if (!rows.has(iz)) rows.set(iz, []);
    rows.get(iz).push([ix, h]);
  }
  const active = new Map(), boxes = [];
  const finish = (v) => boxes.push({
    x: +(-halfX + (v.start + v.end + 1) * cell / 2).toFixed(2),
    z: +(-halfZ + (v.zStart + v.zEnd + 1) * cell / 2).toFixed(2),
    w: +((v.end - v.start + 1) * cell).toFixed(2), d: +((v.zEnd - v.zStart + 1) * cell).toFixed(2),
    h: +Math.min(6, v.h).toFixed(2), k: 'wall',
  });
  let previousZ = -2;
  for (const iz of [...rows.keys()].sort((a, b) => a - b)) {
    if (iz !== previousZ + 1) { for (const v of active.values()) finish(v); active.clear(); }
    const xs = rows.get(iz).sort((a, b) => a[0] - b[0]);
    const runs = []; let start = null, end = null, top = 0;
    for (const [ix, h] of xs) {
      if (start === null || ix > end + 1) { if (start !== null) runs.push({ start, end, h: top }); start = end = ix; top = h; }
      else { end = ix; top = Math.max(top, h); }
    }
    if (start !== null) runs.push({ start, end, h: top });
    const next = new Map();
    for (const run of runs) {
      const key = `${run.start}:${run.end}`, old = active.get(key);
      next.set(key, old ? { ...old, zEnd: iz, h: Math.max(old.h, run.h) } : { ...run, zStart: iz, zEnd: iz });
    }
    for (const [key, v] of active) if (!next.has(key)) finish(v);
    active.clear(); for (const [key, v] of next) active.set(key, v);
    previousZ = iz;
  }
  for (const v of active.values()) finish(v);
  return boxes;
}

export function loadCustomMap(dir, mapId = path.basename(dir)) {
  const glb = path.join(dir, 'map.glb');
  if (!fs.existsSync(glb)) return null;
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(dir, 'map.json'), 'utf8')); } catch { /* ayar yok */ }
  const { json: j, bin } = readGlb(fs.readFileSync(glb));
  const scene = j.scenes?.[j.scene ?? 0];
  if (!scene) throw new Error('GLB içinde sahne yok');

  // 1) her mesh düğümü için dünya AABB'si (ham birimde)
  const raw = [];
  const walk = (ni, parent) => {
    const n = j.nodes[ni];
    const m = mul(parent, n.matrix || trs(n.translation, n.rotation, n.scale));
    if (n.mesh !== undefined) {
      const mesh = j.meshes[n.mesh];
      const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (const pr of mesh.primitives) {
        const acc = j.accessors[pr.attributes.POSITION];
        if (!acc?.min || !acc?.max) continue;
        for (let k = 0; k < 8; k++) {
          const c = [k & 1 ? acc.max[0] : acc.min[0], k & 2 ? acc.max[1] : acc.min[1], k & 4 ? acc.max[2] : acc.min[2]];
          const w = tp(m, c);
          for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], w[a]); hi[a] = Math.max(hi[a], w[a]); }
        }
      }
      if (lo[0] < 1e8) raw.push({ name: (n.name || mesh.name || '').toLowerCase(), lo, hi, m, meshIndex: n.mesh });
    }
    for (const c of n.children || []) walk(c, m);
  };
  const root = rootFor(cfg);
  for (const ni of scene.nodes) walk(ni, root);
  if (!raw.length) throw new Error('GLB içinde mesh yok');

  // 2) ölçek ve merkezleme: zemin y=0, harita x/z merkezde
  const L = [1e9, 1e9, 1e9], H = [-1e9, -1e9, -1e9];
  for (const r of raw) for (let a = 0; a < 3; a++) { L[a] = Math.min(L[a], r.lo[a]); H[a] = Math.max(H[a], r.hi[a]); }
  const sizeX = H[0] - L[0], sizeZ = H[2] - L[2];
  const scale = cfg.scale || (cfg.fit || 90) / Math.max(sizeX, sizeZ);
  const offset = [-(L[0] + H[0]) / 2 * scale, -L[1] * scale + (cfg.yOffset || 0), -(L[2] + H[2]) / 2 * scale];
  const halfX = Math.ceil(sizeX * scale / 2), halfZ = Math.ceil(sizeZ * scale / 2);

  // Birleştirilmiş GLB mesh'lerinde tek AABB bütün haritayı kapatabilir; bu modda duvar üçgenleri taranır.
  const minH = cfg.minHeight ?? 0.6, ignore = (cfg.ignore || []).map(s => s.toLowerCase());
  let boxes = cfg.collisionMode === 'grid' ? triangleGridBoxes(j, bin, raw, scale, offset, halfX, halfZ, cfg) : [];
  if (cfg.collisionMode !== 'grid') for (const r of raw) {
    if (ignore.some(s => r.name.includes(s))) continue;
    const lo = r.lo.map((v, a) => v * scale + offset[a]), hi = r.hi.map((v, a) => v * scale + offset[a]);
    const w = hi[0] - lo[0], d = hi[2] - lo[2], top = hi[1];
    if (top < minH) continue;
    if (w < 0.25 && d < 0.25) continue;
    if (hi[1] - lo[1] < 0.3) continue;
    if (w > halfX * 1.7 && d > halfZ * 1.7) continue;
    if (lo[1] > 2.8) continue;
    boxes.push({ x: +((lo[0] + hi[0]) / 2).toFixed(2), z: +((lo[2] + hi[2]) / 2).toFixed(2), w: +w.toFixed(2), d: +d.toFixed(2), h: +Math.min(top, 6).toFixed(2), k: 'wall' });
  }
  // Dış sınır duvarları.
  boxes.push({ x: 0, z: -halfZ - 0.5, w: halfX * 2 + 2, d: 1, h: 6, k: 'outer' }, { x: 0, z: halfZ + 0.5, w: halfX * 2 + 2, d: 1, h: 6, k: 'outer' },
    { x: -halfX - 0.5, z: 0, w: 1, d: halfZ * 2 + 2, h: 6, k: 'outer' }, { x: halfX + 0.5, z: 0, w: 1, d: halfZ * 2 + 2, h: 6, k: 'outer' });

  const spawnX = cfg.spawnX ?? Math.max(5, halfX - 5);
  const spawns = Array.isArray(cfg.spawns) ? cfg.spawns.map(s => [Number(s[0]), Number(s[1]), Number(s[2] || 0)]) : null;
  const goals = cfg.goals || [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5], [-.25, 0], [.25, 0], [0, -.3], [0, .3]]
    .map(([a, b]) => [Math.round(a * halfX * 1.6), Math.round(b * halfZ * 1.6)]);
  const relativeFile = mapId === 'maps' || mapId === 'map' ? 'models/maps/map.glb' : `models/maps/${mapId}/map.glb`;
  return {
    name: cfg.name || 'Özel Harita', halfX, halfZ, spawnX, spawnAxis: cfg.spawnAxis || 'x', spawns,
    spawnY: Number.isFinite(Number(cfg.spawnY)) ? Math.max(0, Math.min(8, Number(cfg.spawnY))) : 0.18,
    playerScale: cfg.playerScale != null && Number.isFinite(Number(cfg.playerScale)) ? Math.min(1.5, Math.max(0.55, Number(cfg.playerScale))) : 1,
    goals, boxes,
    sites: (cfg.sites || []).map(s => [Number(s[0]), Number(s[1])]),
    custom: { file: relativeFile, scale, offset, rotX: (cfg.rotX || 0) * Math.PI / 180, rotY: (cfg.rotY || 0) * Math.PI / 180, rotZ: (cfg.rotZ || 0) * Math.PI / 180 },
  };
}
