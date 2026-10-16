import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js';

const STORAGE = 'zl_map_editor_v1:';
const clone = (v) => JSON.parse(JSON.stringify(v));
const num = (v, fallback = 0) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback;

export function createMapAdmin({ mapIds, mapNames, mapDefinitions = {}, renderer, canvas, toast = () => {}, onSave = () => {} }) {
  const root = document.createElement('section');
  root.id = 'mapAdmin';
  root.innerHTML = `
    <div class="ma-shell">
      <header class="ma-head"><div><small>YÖNETİCİ ARAÇLARI</small><h2>HARİTA DÜZENLEYİCİ</h2></div><button data-act="close" aria-label="Kapat">×</button></header>
       <div class="ma-toolbar"><label>HARİTA<select data-field="map"></select></label><label>HARİTA BOYUTU<input data-field="fit" type="number" min="20" max="300" step="1"></label><label>OYUNCU MODELİ<input data-field="playerScale" type="number" min="0.55" max="1.5" step="0.05"></label><label>DOĞUŞ YÜKSEKLİĞİ<input data-field="spawnY" type="number" min="0" max="8" step="0.05"></label><label>İŞARET TÜRÜ<select data-field="marker"><option value="t">T doğuş</option><option value="ct">CT doğuş</option><option value="a">A bombası</option><option value="b">B bombası</option></select></label><button data-act="freecam">SERBEST KAMERA: AÇIK</button></div>
      <div class="ma-body"><div class="ma-stage"><div class="ma-help">WASD: gezin · Q/E: aşağı/yukarı · sağ fareyi sürükle: bak · tıkla: seçili işareti koy · tekerlek: hız</div></div>
        <aside class="ma-side"><h3>YERLEŞİM</h3><div class="ma-fields">
          <label>T doğuş X<input data-coord="t" data-axis="0" type="number" step="0.25"></label><label>T doğuş Z<input data-coord="t" data-axis="1" type="number" step="0.25"></label><label>T bakış açısı<input data-coord="t" data-axis="2" type="number" step="0.05"></label>
          <label>CT doğuş X<input data-coord="ct" data-axis="0" type="number" step="0.25"></label><label>CT doğuş Z<input data-coord="ct" data-axis="1" type="number" step="0.25"></label><label>CT bakış açısı<input data-coord="ct" data-axis="2" type="number" step="0.05"></label>
          <label>A bombası X<input data-coord="a" data-axis="0" type="number" step="0.25"></label><label>A bombası Z<input data-coord="a" data-axis="1" type="number" step="0.25"></label>
          <label>B bombası X<input data-coord="b" data-axis="0" type="number" step="0.25"></label><label>B bombası Z<input data-coord="b" data-axis="1" type="number" step="0.25"></label>
        </div><p class="ma-note">İşaretleri sürükleyebilir veya türünü seçip haritaya tıklayarak yerleştirebilirsin. Kaydettiğin harita ölçüsü ve doğuş/bomba noktaları bu tarayıcıdan açılan yeni maçlarda kullanılır. Düzeni saklamak için JSON indir.</p><div class="ma-actions"><button data-act="save">KAYDET</button><button data-act="export">JSON İNDİR</button><button data-act="reset">SIFIRLA</button><button class="primary" data-act="start">OYUNA DÖN</button></div><div class="ma-status" aria-live="polite"></div></aside>
      </div>
    </div>`;
  document.body.append(root);
  const $ = (s) => root.querySelector(s), stage = $('.ma-stage'), status = $('.ma-status');
  // Oyunun mevcut WebGL renderer'ını kullan; ikinci renderer bazı cihazlarda
  // menü/cephanelik bağlamını düşürüp Vandal önizlemesini boş bırakabiliyor.
  const canvasHome = canvas.parentElement, canvasHomeNext = canvas.nextSibling;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#111b24');
  scene.add(new THREE.HemisphereLight(0xe4efff, 0x7d786d, 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(-30, 60, 25); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(68, 1, 0.05, 1600); camera.rotation.order = 'YXZ';
  const grid = new THREE.GridHelper(200, 100, 0x66808d, 0x273844); grid.position.y = -0.035; scene.add(grid);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: '#62645f', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.08; scene.add(ground);
  const world = new THREE.Group(); scene.add(world);
  const markerRoot = new THREE.Group(); scene.add(markerRoot);
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const mapSelect = $('[data-field="map"]');
  for (const id of mapIds) mapSelect.add(new Option(mapNames[id] || id, id));
  let data = null, opened = false, freecam = true, yaw = 0, pitch = -0.55, speed = 18, frame = 0, last = 0, previewModel = null, previewBounds = null, boundsRoot = null, boundsHelper = null, builtWorld = null;
  let drag = false, draggingMarker = null, previous = [0, 0], downPos = [0, 0];
  const keys = new Set();
  const markerMeshes = {};

  async function mapConfig(id) {
    let file = {};
    try { const r = await fetch(`models/maps/${id}/map.json`, { cache: 'no-store' }); if (r.ok) file = await r.json(); } catch {}
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE + id) || '{}'); } catch {}
    return { ...(mapDefinitions[id] || {}), ...file, ...saved };
  }
  function defaultData(id, cfg) {
    const halfX = num(cfg.halfX, 30), halfZ = num(cfg.halfZ, 30);
    let fit = num(cfg.worldFit, Math.max(halfX, halfZ) * 2), axis = cfg.spawnAxis || 'x', spawn = num(cfg.spawnX, 16);
    let spawns = Array.isArray(cfg.spawns) ? cfg.spawns.map((x) => [num(x[0]), num(x[1]), num(x[2])]) : axis === 'z' ? [[0, -spawn, Math.PI], [0, spawn, 0]] : [[-spawn, 0, -Math.PI / 2], [spawn, 0, Math.PI / 2]];
    let sites = Array.isArray(cfg.sites) ? cfg.sites.map((x) => [num(x[0]), num(x[1])]) : [];
    if (sites.length < 2) sites = id === 'range' ? [[0, 0], [0, 0]] : [[-Math.max(8, fit * .22), 0], [Math.max(8, fit * .22), 0]];
    return { ...cfg, id, fit, modelFit: num(cfg.modelFit, num(cfg.fit, fit)), sizeScale: num(cfg.sizeScale, 1), halfX, halfZ, boxes: Array.isArray(cfg.boxes) ? clone(cfg.boxes) : [], spawnX: spawn, spawnAxis: axis, spawnY: num(cfg.spawnY, 0.18), spawns: [spawns[0] || [0, -spawn, Math.PI], spawns[1] || [0, spawn, 0]], sites: [sites[0], sites[1]] };
  }
  function syncFields() {
    $('[data-field="fit"]').value = data.fit;
    $('[data-field="playerScale"]').value = num(data.playerScale, num(localStorage.getItem('zl_admin_playerScale'), 1));
    $('[data-field="spawnY"]').value = data.spawnY;
    for (const [key, index] of [['t', 0], ['ct', 1]]) for (let axis = 0; axis < 3; axis++) {
      const input = $(`[data-coord="${key}"][data-axis="${axis}"]`); input.value = data.spawns[index][axis] ?? 0;
    }
    for (const [key, index] of [['a', 0], ['b', 1]]) for (let axis = 0; axis < 2; axis++) {
      const input = $(`[data-coord="${key}"][data-axis="${axis}"]`); input.value = data.sites[index][axis] ?? 0;
    }
  }
  function setMarker(key, x, z) {
    const i = key === 't' ? 0 : key === 'ct' ? 1 : key === 'a' ? 0 : 1;
    if (key === 't' || key === 'ct') { data.spawns[i][0] = +x.toFixed(2); data.spawns[i][1] = +z.toFixed(2); }
    else { data.sites[i][0] = +x.toFixed(2); data.sites[i][1] = +z.toFixed(2); }
    syncFields(); renderMarkers();
  }
  function makeMarker(key, color, label) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(key === 'a' || key === 'b' ? 1.4 : .55, key === 'a' || key === 'b' ? 1.65 : .78, 32), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: .9 })); ring.rotation.x = -Math.PI / 2; g.add(ring);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.35, 1.2, 12), new THREE.MeshBasicMaterial({ color })); cone.position.y = .75; g.add(cone);
    const spriteCanvas = document.createElement('canvas'); spriteCanvas.width = 128; spriteCanvas.height = 64; const ctx = spriteCanvas.getContext('2d'); ctx.fillStyle = '#081018dd'; ctx.fillRect(4, 4, 120, 56); ctx.fillStyle = color; ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 64, 33);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(spriteCanvas), transparent: true, depthTest: false })); sprite.scale.set(3.4, 1.7, 1); sprite.position.y = 2.5; g.add(sprite);
    g.userData.markerKey = key; markerRoot.add(g); markerMeshes[key] = g;
  }
  makeMarker('t', '#ff4655', 'T'); makeMarker('ct', '#53e3c4', 'CT'); makeMarker('a', '#ffd24a', 'A'); makeMarker('b', '#ff9e52', 'B');
  function renderMarkers() {
    if (!data) return;
    for (const [key, i] of [['t', 0], ['ct', 1]]) { const v = data.spawns[i]; markerMeshes[key].position.set(v[0], data.spawnY, v[1]); markerMeshes[key].rotation.y = num(v[2]); }
    for (const [key, i] of [['a', 0], ['b', 1]]) markerMeshes[key].position.set(data.sites[i][0], 0.08, data.sites[i][1]);
  }
  function clearWorld() { while (world.children.length) { const o = world.children.pop(); o.parent = null; o.traverse?.((m) => { m.geometry?.dispose?.(); if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose?.()); else m.material?.dispose?.(); }); } boundsRoot = null; boundsHelper = null; builtWorld = null; }
  function drawBuiltInMap() {
    if (builtWorld) { world.remove(builtWorld); builtWorld.traverse((m) => { m.geometry?.dispose?.(); if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose?.()); else m.material?.dispose?.(); }); }
    builtWorld = new THREE.Group();
    const colors = { wall: '#817f78', house: '#a98966', crate: '#b37e45', stack: '#aa7045', pillar: '#8b8990', barrel: '#9a5a45', tree: '#517a56', planter: '#628b69', container: '#477e8e', outer: '#37444b', rock: '#6b7477' };
    for (const b of data.boxes || []) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshStandardMaterial({ color: colors[b.k] || '#938a71', roughness: .88 }));
      mesh.position.set(b.x, b.h / 2, b.z); builtWorld.add(mesh);
    }
    world.add(builtWorld);
  }
  function addBounds() {
    if (boundsRoot) { world.remove(boundsRoot); boundsRoot.geometry?.dispose?.(); boundsRoot.material?.dispose?.(); boundsRoot = null; }
    if (boundsHelper) { world.remove(boundsHelper); boundsHelper.geometry?.dispose?.(); boundsHelper = null; }
    const sx = num(data.halfX, data.fit / 2), sz = num(data.halfZ, data.fit / 2);
    const box = new THREE.BoxGeometry(sx * 2, 0.04, sz * 2), mesh = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: '#938a71', transparent: true, opacity: .45 })); mesh.position.y = -.04; world.add(mesh); boundsRoot = mesh;
    const edge = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(-sx, 0, -sz), new THREE.Vector3(sx, 2, sz)), '#adbcc4'); world.add(edge); boundsHelper = edge;
  }
  function fitPreview() {
    if (!previewModel || !previewBounds) return;
    const scale = num(data.scale, data.modelFit / Math.max(previewBounds.size.x, previewBounds.size.z, 1)) * data.sizeScale;
    previewModel.scale.setScalar(scale);
    previewModel.position.set(-previewBounds.center.x * scale, -previewBounds.min.y * scale + num(data.yOffset), -previewBounds.center.z * scale);
  }
  async function loadMap(id) {
    data = defaultData(id, await mapConfig(id)); previewModel = null; previewBounds = null;
    mapSelect.value = id; syncFields(); renderMarkers(); clearWorld(); addBounds();
    drawBuiltInMap();
    if (id === 'minecraft_dm') {
      status.textContent = '3B harita yükleniyor…';
      new GLTFLoader().load(`models/maps/${id}/map.glb`, (g) => {
        if (!opened || mapSelect.value !== id) return;
        const model = g.scene; model.rotation.set(num(data.rotX) * Math.PI / 180, num(data.rotY) * Math.PI / 180, num(data.rotZ) * Math.PI / 180); model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model); previewBounds = { min: bounds.min.clone(), center: bounds.getCenter(new THREE.Vector3()), size: bounds.getSize(new THREE.Vector3()) }; previewModel = model;
        fitPreview();
        model.traverse((o) => { if (o.isMesh) { o.frustumCulled = true; for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.side = THREE.DoubleSide; } });
        world.add(model); status.textContent = `${mapNames[id]} · düzenleme hazır`;
      }, undefined, () => { status.textContent = 'Model yüklenemedi; sınır alanı gösteriliyor.'; });
    } else status.textContent = `${mapNames[id] || id} · yerleşim düzenleme hazır`;
    camera.position.set(0, Math.max(18, data.fit * .48), Math.max(22, data.fit * .65));
    yaw = 0; pitch = -.5;
  }
  function updateFieldsToData() {
    data.fit = clamp(+$('[data-field="fit"]').value, 10, 300);
    data.spawnY = clamp(num($('[data-field="spawnY"]').value, 0.18), 0, 8);
    for (const [key, index] of [['t', 0], ['ct', 1]]) for (let axis = 0; axis < 3; axis++) data.spawns[index][axis] = num($(`[data-coord="${key}"][data-axis="${axis}"]`).value);
    for (const [key, index] of [['a', 0], ['b', 1]]) for (let axis = 0; axis < 2; axis++) data.sites[index][axis] = num($(`[data-coord="${key}"][data-axis="${axis}"]`).value);
    renderMarkers();
  }
  function resizeWorld() {
    const previous = Math.max(1, data.fit); updateFieldsToData();
    const factor = data.fit / previous;
    if (Math.abs(factor - 1) > 1e-4) {
      data.sizeScale *= factor; data.halfX *= factor; data.halfZ *= factor; data.spawnX *= factor;
      for (const v of [...data.spawns, ...data.sites, ...(data.goals || [])]) { v[0] *= factor; v[1] *= factor; }
      for (const b of data.boxes || []) { b.x *= factor; b.z *= factor; b.w *= factor; b.d *= factor; b.h *= factor; }
      syncFields(); renderMarkers(); addBounds(); drawBuiltInMap(); fitPreview();
    }
  }
  function save() { updateFieldsToData(); data.playerScale = clamp(num($('[data-field="playerScale"]').value, 1), .55, 1.5); localStorage.setItem('zl_admin_playerScale', data.playerScale); localStorage.setItem(STORAGE + data.id, JSON.stringify(data)); onSave(clone(data)); status.textContent = 'Harita, doğuş ve bomba alanları bu tarayıcıya kaydedildi.'; toast('Harita ayarları kaydedildi.'); }
  function exportConfig() {
    updateFieldsToData(); data.playerScale = clamp(num($('[data-field="playerScale"]').value, 1), .55, 1.5); localStorage.setItem('zl_admin_playerScale', data.playerScale);
    const { id, ...cfg } = data;
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' }), link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = `${id}-map.json`; link.click(); URL.revokeObjectURL(link.href);
    status.textContent = 'JSON dosyası indirildi. Projeye eklemek için haritanın map.json dosyasının yerine koy.';
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, Number.isFinite(x) ? x : a)); }
  function resize() { const r = canvas.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function setRayFromEvent(e) { pointer.x = e.offsetX / canvas.clientWidth * 2 - 1; pointer.y = -(e.offsetY / canvas.clientHeight) * 2 + 1; ray.setFromCamera(pointer, camera); }
  function floorHit() { return ray.ray.intersectPlane(floorPlane, new THREE.Vector3()); }
  function animate(t) {
    if (!opened) return;
    frame = requestAnimationFrame(animate); const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
    camera.rotation.set(pitch, yaw, 0);
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const move = new THREE.Vector3(); if (keys.has('KeyW')) move.add(forward); if (keys.has('KeyS')) move.sub(forward); if (keys.has('KeyD')) move.add(right); if (keys.has('KeyA')) move.sub(right); if (keys.has('KeyE')) move.y += 1; if (keys.has('KeyQ')) move.y -= 1;
    if (move.lengthSq()) camera.position.addScaledVector(move.normalize(), speed * dt);
    renderer.render(scene, camera);
  }
  function open() { opened = true; root.classList.add('on'); stage.prepend(canvas); resize(); loadMap(mapSelect.value || mapIds[0] || 'haven'); cancelAnimationFrame(frame); frame = requestAnimationFrame(animate); }
  function close() { opened = false; root.classList.remove('on'); cancelAnimationFrame(frame); keys.clear(); canvasHome.insertBefore(canvas, canvasHomeNext); dispatchEvent(new Event('resize')); }
  root.querySelector('[data-act="close"]').onclick = close;
  root.querySelector('[data-act="start"]').onclick = close;
  root.querySelector('[data-act="save"]').onclick = save;
  root.querySelector('[data-act="export"]').onclick = exportConfig;
  root.querySelector('[data-act="reset"]').onclick = () => { localStorage.removeItem(STORAGE + data.id); loadMap(data.id); };
  root.querySelector('[data-act="freecam"]').onclick = (e) => { freecam = !freecam; e.currentTarget.textContent = `SERBEST KAMERA: ${freecam ? 'AÇIK' : 'KAPALI'}`; };
  mapSelect.onchange = () => loadMap(mapSelect.value);
  root.querySelector('[data-field="fit"]').onchange = resizeWorld;
  root.querySelectorAll('[data-coord]').forEach((input) => input.onchange = () => { updateFieldsToData(); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    drag = e.button === 2 || e.button === 1; previous = [e.clientX, e.clientY]; downPos = previous; canvas.setPointerCapture(e.pointerId);
    if (e.button === 0 && data) { setRayFromEvent(e); const hit = ray.intersectObjects(markerRoot.children, true).find((h) => { let n = h.object; while (n && !n.userData.markerKey) n = n.parent; return !!n; });
      if (hit) { let n = hit.object; while (n && !n.userData.markerKey) n = n.parent; draggingMarker = n.userData.markerKey; $('[data-field="marker"]').value = draggingMarker; }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (draggingMarker && (e.buttons & 1)) { setRayFromEvent(e); const p = floorHit(); if (p) setMarker(draggingMarker, p.x, p.z); return; }
    if (!drag || !freecam) return; yaw -= (e.clientX - previous[0]) * .004; pitch = clamp(pitch - (e.clientY - previous[1]) * .004, -1.45, 1.45); previous = [e.clientX, e.clientY];
  });
  canvas.addEventListener('pointerup', (e) => {
    const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 5;
    if (!moved && e.button === 0 && data) {
      setRayFromEvent(e);
      const hits = ray.intersectObjects(markerRoot.children, true), hit = hits.find((h) => h.object.parent?.userData.markerKey || h.object.parent?.parent?.userData.markerKey);
      if (hit) {
        let node = hit.object; while (node && !node.userData.markerKey) node = node.parent;
        if (node) $('[data-field="marker"]').value = node.userData.markerKey;
      } else {
        const point = ray.ray.intersectPlane(floorPlane, new THREE.Vector3());
        if (point) setMarker($('[data-field="marker"]').value, point.x, point.z);
      }
    }
    drag = false; draggingMarker = null;
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); speed = clamp(speed * (e.deltaY > 0 ? .85 : 1.18), 2, 160); }, { passive: false });
  addEventListener('keydown', (e) => { if (!opened) return; if (e.code === 'Escape') { close(); return; } if (e.target?.matches?.('input,select,textarea,button')) return; keys.add(e.code); });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('resize', () => { if (opened) resize(); });
  return { open, close };
}
