import * as THREE from 'three';
import { clone as cloneSkinned } from './vendor/jsm/utils/SkeletonUtils.js';

// Namlu -Z yönüne bakar. Birim: metre. Her silah: parça listesi + namlu ucu (muzzle) + uzunluk (len).
const MATS = new Map();
function mat(color, { metal = 0.35, rough = 0.55, emissive = 0 } = {}) {
  const key = `${color}|${metal}|${rough}|${emissive}`;
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive: emissive ? color : 0x000000, emissiveIntensity: emissive }));
  return MATS.get(key);
}
const C = { body: '#262b34', dark: '#14171d', steel: '#aab2c2', gun: '#5d6677', wood: '#7a5230', woodD: '#5a3a20', tan: '#8a7a55', glove: '#3a404c', sleeve: '#56667d' };

function box(w, h, d, x, y, z, color, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o));
  m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; return m;
}
function cyl(r, len, x, y, z, color, o = {}) { // Z ekseni boyunca silindir
  const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r2 ?? r, r, len, o.seg || 8), mat(color, o));
  m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m;
}
function ring(r, x, y, z, color, o = {}) { // dikey disk (mercek, kama)
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.006, 12), mat(color, o));
  m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m;
}

const SPECS = {
  classic: { len: 0.26, muzzle: -0.17, build: (g) => {
    g.add(box(.05, .055, .23, 0, .035, -.02, C.gun, { metal: .6 }));          // sürgü
    g.add(box(.044, .035, .2, 0, -.005, 0, C.body));                           // gövde
    g.add(box(.042, .115, .06, 0, -.075, .075, C.body, { rx: .22 }));          // kabza
    g.add(box(.036, .02, .06, 0, -.03, -.01, C.dark));                          // tetik koruması
    g.add(box(.03, .016, .1, 0, -.04, -.045, C.dark, { }));
    g.add(cyl(.011, .05, 0, .033, -.155, C.steel, { metal: .9 }));             // namlu ucu
    g.add(box(.012, .014, .012, 0, .07, -.12, C.dark)); g.add(box(.028, .014, .012, 0, .07, .09, C.dark)); // nişangah
    g.add(box(.052, .008, .1, 0, .035, -.02, '#ff6a2b', { emissive: .6 }));    // vurgu çizgisi
  } },
  sheriff: { len: 0.34, muzzle: -0.25, build: (g) => {
    g.add(box(.05, .06, .13, 0, .01, .02, C.steel, { metal: .85, rough: .3 }));  // gövde
    g.add(cyl(.04, .09, 0, .012, -.04, C.steel, { metal: .85, rough: .3, seg: 10 })); // tambur
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(cyl(.007, .095, Math.cos(a) * .026, .012 + Math.sin(a) * .026, -.04, C.dark, { seg: 5 })); }
    g.add(cyl(.019, .24, 0, .028, -.17, C.steel, { metal: .85, rough: .3 }));  // namlu
    g.add(box(.016, .018, .22, 0, .05, -.15, C.steel, { metal: .85 }));         // rib
    g.add(box(.044, .13, .06, 0, -.08, .08, C.wood, { rx: .28, rough: .8, metal: 0 })); // ahşap kabza
    g.add(box(.012, .035, .02, 0, .045, .075, C.dark, { rx: -.6 }));            // horoz
    g.add(box(.012, .02, .012, 0, .062, -.265, C.dark));
  } },
  spectre: { len: 0.5, muzzle: -0.46, build: (g) => {
    g.add(box(.062, .095, .38, 0, 0, 0, C.body));
    g.add(box(.04, .02, .34, 0, .058, 0, C.dark));                              // üst ray
    g.add(cyl(.032, .2, 0, .008, -.28, C.dark, { metal: .6, seg: 10 }));       // susturucu
    g.add(cyl(.018, .06, 0, .008, -.19, C.steel, { metal: .9 }));
    g.add(box(.05, .16, .07, 0, -.115, .02, C.dark, { rx: .12 }));              // şarjör
    g.add(box(.045, .1, .055, 0, -.085, .15, C.body, { rx: .25 }));             // kabza
    g.add(box(.045, .08, .05, 0, -.075, -.13, C.gun));                          // ön kabza
    g.add(box(.05, .07, .12, 0, 0, .25, C.dark)); g.add(box(.036, .07, .09, 0, .01, .33, C.gun));  // dipçik
    g.add(box(.03, .03, .05, 0, .09, -.05, C.dark)); g.add(box(.012, .012, .012, 0, .11, -.05, '#46e6ff', { emissive: 1 })); // kırmızı nokta
    g.add(box(.064, .006, .12, 0, .01, -.04, '#2fd3c0', { emissive: .5 }));
  } },
  bucky: { len: 0.82, muzzle: -0.62, build: (g) => {
    g.add(box(.07, .1, .28, 0, 0, .02, C.body));                                 // gövde
    g.add(cyl(.03, .66, 0, .03, -.32, C.gun, { metal: .7 }));                    // ana namlu
    g.add(cyl(.024, .5, 0, -.03, -.25, C.dark, { metal: .6 }));                  // depo tüpü
    g.add(box(.072, .065, .17, 0, -.03, -.2, C.wood, { rough: .85, metal: 0 }));  // pompa
    g.add(box(.068, .09, .3, 0, -.02, .32, C.wood, { rx: -.1, rough: .85, metal: 0 })); // dipçik
    g.add(box(.05, .1, .05, 0, -.085, .1, C.woodD, { rx: .25, rough: .85, metal: 0 }));
    g.add(box(.012, .02, .012, 0, .075, -.6, '#ffd24a', { emissive: .8 }));
    g.add(box(.02, .008, .3, 0, .052, -.12, C.dark));
  } },
  vandal: { len: 0.82, muzzle: -0.68, build: (g) => {
    g.add(box(.065, .1, .36, 0, 0, .02, C.body));                                // alıcı
    g.add(box(.058, .075, .3, 0, -.002, -.3, C.gun));                             // el koruması
    g.add(box(.05, .018, .28, 0, .05, -.3, C.dark));
    g.add(cyl(.016, .2, 0, .012, -.56, C.steel, { metal: .9 }));                 // namlu
    g.add(cyl(.026, .06, 0, .012, -.67, C.dark, { metal: .8 }));                  // namlu freni
    g.add(box(.05, .19, .075, 0, -.14, -.03, C.dark, { rx: .32 }));               // kavisli şarjör
    g.add(box(.042, .1, .055, 0, -.095, .15, C.body, { rx: .28 }));               // kabza
    g.add(box(.055, .09, .26, 0, -.015, .33, C.gun, { rx: -.05 }));               // dipçik
    g.add(box(.055, .06, .04, 0, -.01, .47, C.dark));
    g.add(box(.028, .035, .09, 0, .088, .02, C.dark)); g.add(box(.02, .012, .008, 0, .112, .0, '#ff4a4a', { emissive: 1 })); // nişangah
    g.add(box(.067, .006, .16, 0, .02, .02, '#ff6a2b', { emissive: .5 }));
  } },
  ghost: { len: 0.3, muzzle: -0.21, build: (g) => {
    g.add(box(.046, .06, .26, 0, .03, -.02, C.dark, { metal: .7 }));            // susturuculu sürgü
    g.add(box(.042, .035, .22, 0, -.012, .0, C.body));
    g.add(box(.04, .12, .06, 0, -.08, .08, C.body, { rx: .2 }));                // kabza
    g.add(cyl(.019, .12, 0, .028, -.2, C.dark, { metal: .8, seg: 10 }));         // susturucu
    g.add(box(.012, .014, .012, 0, .068, -.13, C.dark)); g.add(box(.026, .014, .012, 0, .068, .1, C.dark));
    g.add(box(.048, .008, .12, 0, .035, -.03, '#53e3c4', { emissive: .7 }));   // turkuaz vurgu
  } },
  marshal: { len: 0.95, muzzle: -0.82, build: (g) => {
    g.add(box(.058, .09, .4, 0, 0, .08, C.body));                                // alıcı
    g.add(cyl(.019, .6, 0, .012, -.42, C.steel, { metal: .85, rough: .35 }));    // uzun namlu
    g.add(cyl(.032, .3, 0, .09, -.02, C.dark, { metal: .6 }));                   // dürbün
    g.add(cyl(.04, .05, 0, .09, -.18, C.dark, { metal: .5 })); g.add(cyl(.036, .04, 0, .09, .15, C.dark, { metal: .5 }));
    g.add(ring(.034, 0, .09, -.206, '#ff4655', { emissive: 1, metal: 0, rough: .1 }));
    g.add(box(.05, .06, .09, 0, .035, .02, C.dark));                              // dürbün ayağı
    g.add(box(.062, .11, .26, 0, -.02, .38, C.wood, { rx: -.05, rough: .8, metal: 0 })); // ahşap dipçik
    g.add(box(.044, .1, .055, 0, -.09, .16, C.woodD, { rx: .25, rough: .85, metal: 0 }));
    g.add(box(.012, .03, .06, .045, .0, .12, C.steel, { metal: .9 }));            // sürgü kolu
    g.add(box(.05, .1, .05, 0, -.085, .0, C.dark));
  } },
  judge: { len: 0.62, muzzle: -0.5, build: (g) => {
    g.add(box(.068, .1, .3, 0, 0, .02, C.body));                                 // gövde
    g.add(cyl(.036, .4, 0, .026, -.25, C.gun, { metal: .7, seg: 10 }));          // kalın namlu
    g.add(cyl(.03, .3, 0, -.03, -.2, C.dark, { metal: .6 }));
    g.add(box(.07, .06, .14, 0, -.03, -.16, C.body));                             // el koruması
    g.add(box(.05, .1, .05, 0, -.09, .12, C.body, { rx: .25 }));
    g.add(box(.062, .09, .22, 0, -.01, .28, C.gun, { rx: -.06 }));
    g.add(box(.07, .006, .22, 0, .052, -.02, '#ff4655', { emissive: .6 }));
    g.add(box(.012, .02, .012, 0, .074, -.46, '#ffd24a', { emissive: .8 }));
  } },
  phantom: { len: 0.78, muzzle: -0.66, build: (g) => {
    g.add(box(.062, .098, .36, 0, 0, .02, C.body));                              // alıcı
    g.add(box(.056, .07, .24, 0, -.002, -.27, C.gun));                            // el koruması
    g.add(cyl(.034, .22, 0, .01, -.55, C.dark, { metal: .6, seg: 10 }));          // susturucu
    g.add(cyl(.015, .12, 0, .01, -.4, C.steel, { metal: .9 }));
    g.add(box(.046, .17, .07, 0, -.13, -.02, C.dark, { rx: .08 }));               // düz şarjör
    g.add(box(.04, .1, .055, 0, -.095, .15, C.body, { rx: .28 }));
    g.add(box(.05, .09, .26, 0, -.012, .33, C.body, { rx: -.04 }));               // dipçik
    g.add(box(.045, .05, .08, 0, .075, -.02, C.dark));                            // kırmızı nokta
    g.add(box(.012, .012, .012, 0, .105, -.04, '#ff4655', { emissive: 1 }));
    g.add(box(.064, .006, .16, 0, .02, .02, '#53e3c4', { emissive: .6 }));
    g.add(box(.03, .02, .3, 0, .056, -.2, C.dark));                               // üst ray
  } },
  ares: { len: 0.82, muzzle: -0.7, build: (g) => {
    g.add(box(.075, .11, .4, 0, 0, .02, C.body));
    g.add(box(.062, .08, .3, 0, 0, -.3, C.gun));                                  // el koruması
    g.add(cyl(.018, .2, 0, .012, -.57, C.steel, { metal: .9 }));
    g.add(cyl(.026, .06, 0, .012, -.68, C.dark, { metal: .8 }));
    g.add(box(.09, .13, .12, 0, -.115, -.02, C.dark));                            // kutu şarjör (şerit)
    g.add(box(.078, .02, .14, 0, -.05, -.02, C.steel, { metal: .8 }));
    g.add(box(.04, .1, .055, 0, -.1, .17, C.body, { rx: .28 }));
    g.add(box(.055, .1, .26, 0, -.012, .35, C.gun, { rx: -.05 }));
    g.add(box(.03, .04, .3, 0, .075, -.08, C.dark));                              // taşıma sapı/ray
    g.add(box(.012, .02, .012, 0, .105, -.2, '#ffd24a', { emissive: .8 }));
    g.add(box(.078, .006, .22, 0, .02, .02, '#ff4655', { emissive: .6 }));
  } },
  operator: { len: 1.05, muzzle: -0.92, build: (g) => {
    g.add(box(.068, .105, .42, 0, 0, .06, C.body));
    g.add(cyl(.026, .66, 0, .012, -.5, C.dark, { metal: .7 }));                   // kalın namlu
    g.add(cyl(.036, .16, 0, .012, -.88, C.dark, { metal: .8 }));                  // susturucu
    g.add(cyl(.036, .34, 0, .098, -.02, C.dark, { metal: .6 }));                  // dürbün gövdesi
    g.add(cyl(.047, .06, 0, .098, -.2, C.dark, { metal: .5 })); g.add(cyl(.043, .05, 0, .098, .17, C.dark, { metal: .5 }));
    g.add(ring(.04, 0, .098, -.232, '#46e6ff', { emissive: 1, metal: 0, rough: .1 })); // ön mercek
    g.add(ring(.036, 0, .098, .196, '#46e6ff', { emissive: .7, metal: 0, rough: .1 }));
    g.add(box(.02, .05, .02, 0, .06, -.1, C.dark)); g.add(box(.02, .05, .02, 0, .06, .08, C.dark));
    g.add(box(.05, .12, .06, 0, -.11, .08, C.body));                              // şarjör
    g.add(box(.042, .1, .055, 0, -.095, .26, C.body, { rx: .28 }));
    g.add(box(.07, .12, .3, 0, -.01, .5, C.gun, { rx: -.04 }));                   // dipçik
    g.add(box(.066, .03, .12, 0, .06, .44, C.dark));                              // yanak desteği
    g.add(box(.03, .1, .02, .0, -.07, -.4, C.dark, { rx: .2 })); // iki ayak
    g.add(box(.07, .006, .22, 0, .02, .06, '#46e6ff', { emissive: .6 }));
  } },
  // Karambit: kavisli pençe bıçak + parmak halkası. Parçalar halka merkezli "spin" grubunda (çevirme animasyonu için)
  knife: { len: 0.3, muzzle: -0.14, build: (g) => {
    const spin = new THREE.Group(); spin.position.set(0, 0, .125); g.add(spin); g.userData.spin = spin;
    const P = new THREE.Group(); P.position.set(0, 0, -.125); spin.add(P);
    const sh = new THREE.Shape();
    sh.moveTo(0, .014); sh.bezierCurveTo(.05, .024, .11, .004, .145, -.058); sh.bezierCurveTo(.1, -.03, .05, -.022, 0, -.014); sh.lineTo(0, .014);
    const bg = new THREE.ExtrudeGeometry(sh, { depth: .004, bevelEnabled: true, bevelThickness: .0025, bevelSize: .0025, bevelSegments: 2, curveSegments: 18 });
    bg.translate(0, 0, -.002);
    const blade = new THREE.Mesh(bg, mat('#dfe5ee', { metal: .45, rough: .3 })); blade.rotation.y = Math.PI / 2; P.add(blade);
    const fg = new THREE.Shape(); fg.moveTo(.012, .004); fg.bezierCurveTo(.05, .01, .09, -.004, .118, -.04); fg.bezierCurveTo(.088, -.014, .05, -.004, .012, -.002); fg.lineTo(.012, .004);
    const fuller = new THREE.Mesh(new THREE.ExtrudeGeometry(fg, { depth: .0105, bevelEnabled: false, curveSegments: 14 }), mat('#ff4655', { emissive: .7, metal: .3 }));
    fuller.geometry.translate(0, 0, -.00525); fuller.rotation.y = Math.PI / 2; P.add(fuller);
    const hnd = new THREE.Mesh(new THREE.CylinderGeometry(.015, .017, .11, 12), mat('#1b2029', { metal: .2, rough: .8 }));
    hnd.rotation.x = Math.PI / 2; hnd.scale.set(.75, 1, 1); hnd.position.set(0, 0, .055); P.add(hnd);
    for (const z of [.03, .055, .08]) { const t = new THREE.Mesh(new THREE.TorusGeometry(.0155, .0028, 6, 14), mat('#2e3644', { rough: .9 })); t.scale.set(.78, 1, 1); t.position.set(0, 0, z); P.add(t); }
    const bol = new THREE.Mesh(new THREE.CylinderGeometry(.019, .019, .012, 12), mat('#aab2c2', { metal: .9, rough: .3 })); bol.rotation.x = Math.PI / 2; bol.scale.set(.75, 1, 1); bol.position.set(0, 0, .002); P.add(bol);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.022, .006, 10, 24), mat('#aab2c2', { metal: .9, rough: .3 })); ring.rotation.y = Math.PI / 2; ring.position.set(0, 0, .125); P.add(ring);
  } },
};

// ---- GLB ile değiştirme (public/models/weapons/<id>.glb) ----
const glbCache = {};
export function registerWeaponGLB(id, gltf) { glbCache[id] = gltf; }
export async function loadWeaponGLBs(GLTFLoader) {
  let list = [];
  try { list = (await (await fetch('/assets.json', { cache: 'no-store' })).json()).weapons || []; } catch { return []; }
  const loader = new GLTFLoader(); const done = [];
  await Promise.all(list.map((f) => new Promise((res) => {
    const id = f.replace(/\.glb$/i, '').toLowerCase();
    if (!SPECS[id] && id !== 'vandal_mirage') return res();
    loader.load(`models/weapons/${f}`, (g) => { registerWeaponGLB(id, g); done.push(id); res(); }, undefined, () => res());
  })));
  return done;
}
function fromGLB(id, spec, modelId = id) {
  const source = glbCache[modelId], g = new THREE.Group(), m = cloneSkinned(source.scene);
  // This AK GLB has an incomplete first-person rig. Render its imported mesh
  // in its authored bind pose as static geometry instead of relying on that rig.
  if (modelId === 'vandal') {
    const skinnedMeshes = [];
    m.traverse((o) => { if (o.isSkinnedMesh) skinnedMeshes.push(o); });
    for (const mesh of skinnedMeshes) {
      const geometry = mesh.geometry.clone();
      const baked = new THREE.Mesh(geometry, mesh.material);
      baked.name = mesh.name;
      baked.position.copy(mesh.position);
      baked.quaternion.copy(mesh.quaternion);
      baked.scale.copy(mesh.scale);
      baked.matrixAutoUpdate = mesh.matrixAutoUpdate;
      baked.updateMatrix();
      mesh.parent.add(baked);
      mesh.parent.remove(mesh);
    }
  }
  // Skinned GLB silahlarının statik bind-pose bounds'u model dışına taşabiliyor;
  // menü ve uzaktaki oyuncu çizimlerinde yanlış frustum-culling modeli saklıyordu.
  m.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  const oriented = new THREE.Group(); oriented.add(m);
  const initial = new THREE.Box3().setFromObject(oriented), s0 = initial.getSize(new THREE.Vector3());
  if (s0.x >= s0.y && s0.x > s0.z * 1.15) oriented.rotation.y = Math.PI / 2;
  else if (s0.y > s0.x * 1.15 && s0.y > s0.z * 1.15) oriented.rotation.x = -Math.PI / 2;
  oriented.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(oriented);
  const wrap = new THREE.Group(); wrap.add(oriented); b = new THREE.Box3().setFromObject(wrap);
  // İndirilen FPS modelleri elde fazla büyük görünüyordu; görünüm silahını oyun ölçeğinde küçült.
  const size = b.getSize(new THREE.Vector3()), k = (spec.len * 0.72) / Math.max(size.z, 0.001), c = b.getCenter(new THREE.Vector3());
  wrap.scale.setScalar(k); wrap.position.set(-c.x * k, -c.y * k, -c.z * k); g.add(wrap);
  // CS AK modelinin içinde silahın elde tutulacağı referans düğümü var.
  // Bunu kullanmak, gövdeye göre tahmin edilen eski GRIP noktasının modeli
  // karakterin elinden uzağa/çok büyük görünmesine yol açmasını önler.
  if (modelId === 'vandal') {
    const grip = m.getObjectByName('weapon_hand_r_3') || m.getObjectByName('weapon_hand_r');
    if (grip) {
      wrap.updateMatrixWorld(true); grip.updateWorldMatrix(true, false);
      g.userData.gripPoint = wrap.worldToLocal(grip.getWorldPosition(new THREE.Vector3())).clone();
    }
  }
  const clips = modelId === 'vandal' ? [] : (source.animations || []);
  if (clips.length) {
    const mixer = new THREE.AnimationMixer(m), actions = {};
    const clipFor = (re) => clips.find((clip) => re.test(clip.name));
    for (const [key, re] of Object.entries({
      idle: /^firstperson_idle$/i, draw: /^firstperson_draw$/i, reload: /^firstperson_reload$/i,
      shoot: /^firstperson_shoot1$/i, inspect: /^firstperson_lookat01$/i,
    })) { const clip = clipFor(re); if (clip) actions[key] = mixer.clipAction(clip); }
    if (actions.idle) { actions.idle.setLoop(THREE.LoopRepeat); actions.idle.play(); g.userData.activeWeaponAction = actions.idle; }
    g.userData.weaponMixer = mixer; g.userData.weaponActions = actions;
  }
  return g;
}

function buildKnifeVariant(g, variant) {
  if (variant === 'karambit') { SPECS.knife.build(g); return; }
  const spin = new THREE.Group(); spin.position.set(0, 0, .04); g.add(spin); g.userData.spin = spin;
  const bladeMat = mat(variant === 'sapphire' ? '#68c8e8' : variant === 'gold' ? '#d8b04b' : '#dce3ed', { metal: .72, rough: .26 });
  const gripMat = mat('#26313d', { metal: .24, rough: .82 });
  const length = variant === 'stiletto' ? .27 : variant === 'tanto' ? .21 : .23;
  const width = variant === 'bowie' ? .062 : variant === 'stiletto' ? .027 : .045;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(width, .014, length), bladeMat);
  blade.position.set(0, 0, -.055 - (length - .21) * .35); spin.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(width * .72, variant === 'tanto' ? .075 : .065, variant === 'tanto' ? 4 : 6), bladeMat);
  tip.rotation.x = Math.PI / 2; tip.position.set(0, 0, -.055 - (length - .21) * .35 - length / 2 - .025); spin.add(tip);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.018, .02, .12, 10), gripMat);
  grip.rotation.x = Math.PI / 2; grip.position.z = .09; spin.add(grip);
  for (const z of [.055, .085, .115]) { const band = new THREE.Mesh(new THREE.TorusGeometry(.018, .0025, 6, 12), mat('#8695a6', { metal: .6 })); band.rotation.y = Math.PI / 2; band.position.z = z; spin.add(band); }
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(.023, 10, 8), mat(variant === 'gold' ? '#d8b04b' : '#8695a6', { metal: .72 })); pommel.position.z = .155; spin.add(pommel);
}
export function buildGun(id, modelId = id) {
  const spec = SPECS[id] || SPECS.classic, g = new THREE.Group();
  if (glbCache[modelId]) { const m = fromGLB(id, spec, modelId); g.add(m); if (m.userData.gripPoint) g.userData.gripPoint = m.userData.gripPoint; if (m.userData.weaponMixer) { g.userData.weaponMixer = m.userData.weaponMixer; g.userData.weaponActions = m.userData.weaponActions; } }
  else if (id === 'knife' && ['bowie', 'tanto', 'stiletto', 'sapphire', 'gold'].includes(modelId)) buildKnifeVariant(g, modelId);
  else spec.build(g);
  g.userData.knife = id === 'knife';
  g.userData.muzzle = spec.muzzle; g.userData.id = id;
  return g;
}
export function hasWeaponAnimation(gun, key) { return !!gun?.userData.weaponActions?.[key]; }
export function playWeaponAnimation(gun, key) {
  const actions = gun?.userData.weaponActions, action = actions?.[key];
  if (!action) return false;
  const previous = gun.userData.activeWeaponAction;
  if (key === 'idle') {
    action.reset().setLoop(THREE.LoopRepeat).fadeIn(0.1).play();
  } else {
    if (previous && previous !== action) previous.fadeOut(0.06);
    action.reset().setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
    action.fadeIn(0.06).play();
    const mixer = gun.userData.weaponMixer;
    if (!gun.userData.finishListener) {
      gun.userData.finishListener = (event) => {
        if (event.action !== gun.userData.activeWeaponAction) return;
        const idle = gun.userData.weaponActions?.idle;
        if (idle) { idle.reset().setLoop(THREE.LoopRepeat).fadeIn(0.1).play(); event.action.fadeOut(0.08); gun.userData.activeWeaponAction = idle; }
      };
      mixer.addEventListener('finished', gun.userData.finishListener);
    }
  }
  gun.userData.activeWeaponAction = action;
  return true;
}
export const GUN_IDS = Object.keys(SPECS);

// ---- Silah kaplamaları: koyu gövde parçaları yeniden boyanır, açık parçalar parlayabilir ----
export const SKINS = {
  default: { name: 'Varsayılan', swatch: '#3a404c' },
  mirage:  { name: 'AK Mirage', swatch: '#b9783e', model: 'vandal_mirage' },
  gold:    { name: 'Altın', swatch: '#c9a03c', body: '#c9a03c', metal: 0.95, rough: 0.22 },
  dragon:  { name: 'Kızıl Ejder', swatch: '#8a1218', body: '#5a0d12', glow: '#ff5a1f' },
  ice:     { name: 'Buz', swatch: '#cfe6f7', body: '#dde9f5', glow: '#5fd8ff', rough: 0.3 },
  neon:    { name: 'Gece Neon', swatch: '#ff3df2', body: '#101018', glow: '#ff3df2' },
  ocean:   { name: 'Derin Okyanus', swatch: '#168aad', body: '#0b5268', glow: '#38d9ff', metal: .7, rough: .3 },
  emerald: { name: 'Zümrüt', swatch: '#36a269', body: '#164e38', glow: '#7cffae', metal: .55, rough: .34 },
  amethyst:{ name: 'Ametist', swatch: '#9258d7', body: '#382052', glow: '#d7a4ff', metal: .62, rough: .3 },
  carbon:  { name: 'Karbon', swatch: '#596273', body: '#252c37', metal: .82, rough: .2 },
  camo:    { name: 'Kamuflaj', swatch: '#4b5a3a', camo: true },
};
let camoTex = null;
function camoTexture() {
  if (camoTex) return camoTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#4b5a3a'; g.fillRect(0, 0, 128, 128);
  for (const col of ['#2f3a24', '#6b7552', '#1f241a', '#7d6b4a']) for (let i = 0; i < 9; i++) {
    g.fillStyle = col; g.beginPath(); const x = Math.random() * 128, y = Math.random() * 128;
    g.ellipse(x, y, 8 + Math.random() * 16, 5 + Math.random() * 10, Math.random() * 3, 0, 7); g.fill();
  }
  camoTex = new THREE.CanvasTexture(c); camoTex.wrapS = camoTex.wrapT = THREE.RepeatWrapping; camoTex.repeat.set(3, 3); camoTex.colorSpace = THREE.SRGBColorSpace;
  return camoTex;
}
export function applySkin(root, id) {
  const S = SKINS[id]; if (!S || id === 'default') return root;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const arr = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : [o.material.clone()];
    for (const m of arr) {
      if (!m.color) continue;
      const hsl = {}; m.color.getHSL(hsl);
      // GLB silahların tek, beyaz renkli materyali çoğu zaman rengi dokudan
      // alır. Eski parlaklık eşiği bu materyale hiç dokunmadığı için kaplama
      // seçiliyor ama modelde görünmüyordu. Dokulu yüzeylerde kaplama rengini
      // dokuya çarpan materyal rengi olarak uygula.
      if (S.camo) { m.map = camoTexture(); m.color.set('#ffffff'); m.metalness = 0.1; m.roughness = 0.8; }
      else if (m.map) {
        m.color.set(S.body || S.swatch);
        if (S.metal != null) m.metalness = S.metal;
        if (S.rough != null) m.roughness = S.rough;
        if (S.glow && m.emissive) { m.emissive.set(S.glow); m.emissiveIntensity = 0.8; }
      } else if (hsl.l < 0.45) {
        m.color.set(S.body || S.swatch); if (S.metal != null) m.metalness = S.metal; if (S.rough != null) m.roughness = S.rough;
      } else if (S.glow && m.emissive) { m.color.set(S.glow); m.emissive.set(S.glow); m.emissiveIntensity = 0.8; }
      m.needsUpdate = true;
    }
    o.material = Array.isArray(o.material) ? arr : arr[0];
  });
  return root;
}

// Silahın kabzası (silah-yerel koordinat): el buraya oturur
export const GRIP = { classic: [0, -.09, .09], ghost: [0, -.09, .09], sheriff: [0, -.1, .1], spectre: [0, -.1, .15], bucky: [0, -.07, .1], vandal: [0, -.1, .15], operator: [0, -.1, .26], marshal: [0, -.1, .16], judge: [0, -.09, .12], phantom: [0, -.1, .15], ares: [0, -.1, .17], knife: [0, -.015, .055] };

// ---- Birinci şahıs kollar: eldivenli eller parmaklarıyla kabzayı ve ön tutamağı sarar ----
// g: kabza ekseni (t üst, b alt noktası [y, z]; w/d yarı kalınlık) · f: destek eli (c merkez [y, z], r [x, y] yarıçap; v: dikey tutamak)
const HOLD_GLB = {
  classic:  { g: { t: [-.006, .083], b: [-.084, .094], w: .019, d: .028 } },
  ghost:    { g: { t: [-.012, .114], b: [-.07, .122], w: .018, d: .025 } },
  sheriff:  { g: { t: [-.008, .118], b: [-.072, .148], w: .02, d: .02 } },
  spectre:  { g: { t: [-.008, .036], b: [-.058, .046], w: .018, d: .019 }, f: { c: [.068, -.16], r: [.02, .028] } },
  bucky:    { g: { t: [.036, .19], b: [-.024, .262], w: .016, d: .02 }, f: { c: [.026, -.07], r: [.018, .03] } },
  judge:    { g: { t: [-.035, .168], b: [-.15, .2], w: .024, d: .022 }, f: { c: [.02, -.15], r: [.034, .046] } },
  phantom:  { g: { t: [-.006, .156], b: [-.066, .18], w: .02, d: .024 }, f: { c: [.07, -.12], r: [.026, .026] } },
  vandal:   { g: { t: [.008, .148], b: [-.046, .176], w: .016, d: .02 }, f: { c: [.083, -.155], r: [.017, .03] } },
  ares:     { g: { t: [-.034, .022], b: [-.108, .042], w: .02, d: .024 }, f: { v: 1, t: [.045, -.305], b: [-.046, -.305], w: .015, d: .015 } },
  marshal:  { g: { t: [-.002, .216], b: [-.072, .276], w: .022, d: .02 }, f: { c: [.01, -.115], r: [.026, .022] } },
  operator: { g: { t: [-.002, .255], b: [-.056, .285], w: .02, d: .02 }, f: { c: [.066, -.1], r: [.03, .028] } },
};
const HOLD_PROC = {
  classic:  { g: { t: [-.02, .063], b: [-.13, .088], w: .021, d: .03 } },
  ghost:    { g: { t: [-.022, .068], b: [-.138, .092], w: .02, d: .03 } },
  sheriff:  { g: { t: [-.017, .062], b: [-.142, .098], w: .022, d: .03 } },
  spectre:  { g: { t: [-.037, .138], b: [-.133, .162], w: .023, d: .028 }, f: { v: 1, t: [-.035, -.13], b: [-.115, -.13], w: .022, d: .025 } },
  bucky:    { g: { t: [-.037, .088], b: [-.133, .112], w: .025, d: .025 }, f: { c: [-.03, -.2], r: [.036, .033] } },
  judge:    { g: { t: [-.042, .108], b: [-.138, .132], w: .025, d: .028 }, f: { c: [-.03, -.16], r: [.035, .03] } },
  phantom:  { g: { t: [-.047, .136], b: [-.143, .164], w: .02, d: .028 }, f: { c: [-.002, -.27], r: [.028, .035] } },
  vandal:   { g: { t: [-.047, .136], b: [-.143, .164], w: .021, d: .028 }, f: { c: [-.002, -.3], r: [.029, .038] } },
  ares:     { g: { t: [-.052, .156], b: [-.148, .184], w: .02, d: .028 }, f: { c: [0, -.3], r: [.031, .04] } },
  marshal:  { g: { t: [-.042, .148], b: [-.138, .172], w: .022, d: .028 }, f: { c: [.012, -.3], r: [.022, .022] } },
  operator: { g: { t: [-.047, .246], b: [-.143, .274], w: .021, d: .028 }, f: { c: [.012, -.36], r: [.026, .026] } },
};
const V3 = (x, y, z) => new THREE.Vector3(x, y, z), UPV = V3(0, 1, 0);
function limb(g, a, b, r1, r2, m, seg = 10) { // a→b arası silindir
  const d = b.clone().sub(a), len = d.length();
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, seg), m);
  o.position.copy(a).addScaledVector(d, .5); o.quaternion.setFromUnitVectors(UPV, d.normalize()); g.add(o); return o;
}
function ball(g, p, r, m) { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m); o.position.copy(p); g.add(o); return o; }
const ep = (a, b, y, deg) => { const t = deg * Math.PI / 180; return V3(a * Math.cos(t), y, -b * Math.sin(t)); }; // 0° sağ, 90° ön

// Kanonik el: kabza ekseni +Y, avuç +X tarafında, parmaklar öne (-Z) doğru sarılır. a/b kabza yarıçapları
function wrapHand(M, { a, b, len = .09, trigger = false, thumb = 'wrap', wrap = 1 }) {
  const g = new THREE.Group(), fr = .0088;
  const top = Math.min(len / 2 - .006, .036), sp = Math.max(.0185, Math.min(.021, (len - .012) / 3.4));
  const fingers = trigger ? [top - sp * .4, top - sp * 1.4, top - sp * 2.4] : [top, top - sp, top - sp * 2, top - sp * 3];
  const sweep = (trigger ? [195, 185, 165] : [205, 200, 185, 165]).map((d) => 62 + (d - 62) * wrap);
  fingers.forEach((y, i) => {
    const pinky = i === fingers.length - 1, r = pinky ? fr * .86 : fr, A = a + r + .001, B = b + r + .001, end = sweep[i];
    const k = ep(a + .021, b + .021, y, 28), p1 = ep(A, B, y, 62), p2 = ep(A, B, y, 62 + (end - 62) * .5), tip = ep(A, B, y - .002, end);
    ball(g, k, r * 1.15, M.glove); limb(g, k, p1, r * 1.1, r, M.glove); ball(g, p1, r, M.glove);
    limb(g, p1, p2, r, r * .95, M.glove); ball(g, p2, r * .95, M.glove); limb(g, p2, tip, r * .95, r * .85, M.skin); ball(g, tip, r * .85, M.skin);
  });
  if (trigger) { // işaret parmağı tetikte
    const y = top + .012, k = ep(a + .02, b + .02, y, 30), p1 = V3(a + .008, y + .004, -b - .022), p2 = V3(a * .3, y, -b - .042), tip = V3(-.002, y - .012, -b - .042);
    ball(g, k, fr * 1.15, M.glove); limb(g, k, p1, fr * 1.1, fr, M.glove); ball(g, p1, fr, M.glove);
    limb(g, p1, p2, fr, fr * .95, M.glove); ball(g, p2, fr * .95, M.glove); limb(g, p2, tip, fr * .95, fr * .85, M.skin); ball(g, tip, fr * .85, M.skin);
  }
  const yl = fingers[fingers.length - 1] - .01, yh = (trigger ? top + .02 : top + .012), ym = (yl + yh) / 2, hh = yh - yl + .012;
  const palm = new THREE.Mesh(new THREE.BoxGeometry(.027, hh, .07), M.glove); palm.position.copy(ep(a + .015, b + .015, ym, -22)); palm.rotation.y = -22 * Math.PI / 180; g.add(palm);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(.012, hh * .78, .05), M.pad); pad.position.copy(ep(a + .032, b + .032, ym, -18)); pad.rotation.y = -18 * Math.PI / 180; g.add(pad);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(.004, hh * .62, .007), M.accent); stripe.position.copy(ep(a + .039, b + .039, ym, -8)); stripe.rotation.y = -8 * Math.PI / 180; g.add(stripe);
  const kn = new THREE.Mesh(new THREE.CapsuleGeometry(.011, hh * .8, 4, 8), M.pad); kn.position.copy(ep(a + .028, b + .028, ym + .002, 26)); g.add(kn);
  const tr = .0105;
  const T = thumb === 'forward'
    ? [ep(a + .024, b + .024, yh - .006, -55), ep(a + .02, b + .02, yh + .002, -15), ep(a + .016, b + .016, yh + .006, 20), ep(a + .013, b + .013, yh + .008, 48)]
    : [ep(a + .02, b + .02, yh - .01, -88), ep(a + .014, b + .014, yh + .002, -135), ep(a + tr, b + tr, yh + .006, -180), ep(a + tr, b + tr, yh + .004, -212)];
  ball(g, T[0], tr * 1.3, M.glove); limb(g, T[0], T[1], tr * 1.2, tr, M.glove); ball(g, T[1], tr, M.glove);
  limb(g, T[1], T[2], tr, tr * .95, M.glove); ball(g, T[2], tr * .95, M.glove); limb(g, T[2], T[3], tr * .95, tr * .85, M.skin); ball(g, T[3], tr * .85, M.skin);
  g.userData.wrist = ep(a + .03, b + .03, ym - .004, -62).add(V3(0, 0, .018));
  return g;
}
// kanonik eli silah uzayına yerleştir; X/Y/Z: kanonik eksenlerin silahtaki karşılıkları
function placeHand(hand, X, Y, Z, origin, mirror) {
  const outer = new THREE.Group(), m = new THREE.Matrix4().makeBasis(X, Y, Z); m.setPosition(origin);
  outer.matrixAutoUpdate = false; outer.matrix.copy(m);
  if (mirror) hand.scale.x = -1;
  outer.add(hand);
  const w = hand.userData.wrist.clone(); if (mirror) w.x = -w.x;
  return { obj: outer, wrist: w.applyMatrix4(m) };
}
// bilekten dirseğe ve omuza kol (eldiven manşeti, kol, zırh plakası, ceket)
function armFrom(g, M, W, elbowOff, shoulderOff) {
  const E = W.clone().add(elbowOff), S = E.clone().add(shoulderOff), dir = E.clone().sub(W).normalize();
  const cuff = W.clone().addScaledVector(dir, .065);
  ball(g, W, .026, M.glove); limb(g, W, cuff, .028, .033, M.glove, 12);
  limb(g, cuff.clone().addScaledVector(dir, -.006), cuff.clone().addScaledVector(dir, .006), .036, .036, M.accent, 14);
  limb(g, cuff, E, .036, .046, M.sleeve, 12);
  const b0 = cuff.clone().lerp(E, .18), b1 = cuff.clone().lerp(E, .62); // zırhlı kolluk + vurgu halkası
  limb(g, b0, b1, .041, .047, M.pad, 12);
  limb(g, b0.clone().lerp(b1, .78), b0.clone().lerp(b1, .86), .0485, .0485, M.accent, 14);
  ball(g, E, .047, M.jacket); limb(g, E, S, .05, .06, M.jacket, 12);
}
const HAND_MATS = {};
function handMats(o) {
  const key = `${o.accent}|${o.sleeve}|${o.skin}`;
  return HAND_MATS[key] ||= {
    glove: new THREE.MeshStandardMaterial({ color: '#2a2e35', roughness: .85, metalness: .05 }),
    pad: new THREE.MeshStandardMaterial({ color: '#16191e', roughness: .6, metalness: .25 }),
    skin: new THREE.MeshStandardMaterial({ color: o.skin, roughness: .75, metalness: 0 }),
    sleeve: new THREE.MeshStandardMaterial({ color: o.sleeve, roughness: .9, metalness: 0 }),
    jacket: new THREE.MeshStandardMaterial({ color: new THREE.Color(o.sleeve).multiplyScalar(.7), roughness: .95, metalness: 0 }),
    accent: new THREE.MeshStandardMaterial({ color: o.accent, emissive: o.accent, emissiveIntensity: .55, roughness: .4 }),
  };
}

// Birinci şahıs eller + kollar (silah modeline göre konumlanır). userData.right / userData.left ayrı animasyon için
export function buildHands(id, opts = {}) {
  const M = handMats({ accent: opts.accent || '#ff4655', sleeve: opts.sleeve || '#39465a', skin: opts.skin || '#c8957a' });
  const g = new THREE.Group(), R = new THREE.Group(), L = new THREE.Group(); g.add(R, L); g.userData.right = R; g.userData.left = L;
  if (id === 'knife') { // karambit sapını saran yumruk
    const h = placeHand(wrapHand(M, { a: .012, b: .015, len: .1 }), V3(1, 0, 0), V3(0, 0, -1), V3(0, 1, 0), V3(0, 0, .058));
    R.add(h.obj); armFrom(R, M, h.wrist, V3(.05, -.12, .27), V3(.1, -.2, .25));
    return g;
  }
  const H = (glbCache[id] ? HOLD_GLB : HOLD_PROC)[id] || HOLD_PROC.classic, G = H.g;
  const t = V3(0, G.t[0], G.t[1]), b = V3(0, G.b[0], G.b[1]), A = t.clone().sub(b), len = A.length(); A.normalize();
  const F = V3(0, 0, -1).addScaledVector(A, A.z).normalize(), Xr = V3(1, 0, 0), Zc = F.clone().negate();
  const center = t.clone().add(b).multiplyScalar(.5);
  const rh = placeHand(wrapHand(M, { a: G.w, b: G.d, len, trigger: true }), Xr, A, Zc, center);
  R.add(rh.obj); armFrom(R, M, rh.wrist, V3(.06, -.13, .27), V3(.1, -.2, .25));
  const f = H.f;
  if (!f) { // tabanca: sol el sağ elin parmaklarını önden kavrar
    const lh = placeHand(wrapHand(M, { a: G.w + .02, b: G.d + .02, len: len * .9, thumb: 'forward' }), Xr, A, Zc, center.clone().addScaledVector(A, -.012), true);
    L.add(lh.obj); armFrom(L, M, lh.wrist, V3(-.13, -.13, .25), V3(-.08, -.2, .25));
  } else if (f.v) { // dikey ön tutamak
    const ft = V3(0, f.t[0], f.t[1]), fb = V3(0, f.b[0], f.b[1]), fA = ft.clone().sub(fb), fl = fA.length(); fA.normalize();
    const lh = placeHand(wrapHand(M, { a: f.w, b: f.d, len: fl }), Xr, fA, Zc, ft.clone().add(fb).multiplyScalar(.5), true);
    L.add(lh.obj); armFrom(L, M, lh.wrist, V3(-.15, -.16, .24), V3(-.06, -.2, .28));
  } else { // el koruması altından kavrayan sol el
    const lh = placeHand(wrapHand(M, { a: f.r[1], b: f.r[0], len: .1, wrap: .8 }), V3(0, 1, 0), V3(0, 0, -1), V3(-1, 0, 0), V3(0, f.c[0], f.c[1]), true);
    L.add(lh.obj); armFrom(L, M, lh.wrist, V3(-.15, -.17, .24), V3(-.06, -.2, .28));
  }
  return g;
}
