// Hem sunucu hem istemci tarafından kullanılan ortak veriler
export const EYE = 1.6, HEIGHT = 1.8, RADIUS = 0.4;

export const ROUND = {
  buy: 12, firstBuy: 16, live: 100, end: 2.8, matchEnd: 8,
  wins: 7, startCredits: 800, win: 3000, lose: 1900, kill: 200, maxCredits: 9000,
};

export const ARMOR = { price: 650, amount: 50 };

// rpm: dakikadaki atış, spread: radyan (koni), auto: basılı tutarak ateş
export const WEAPONS = {
  classic:  { name: 'Classic',  type: 'Tabanca',  price: 0,    dmg: 26,  rpm: 380, mag: 12, reload: 1.5, spread: 0.010, pellets: 1,  auto: false, range: 90 },
  ghost:    { name: 'Ghost',    type: 'Tabanca',  price: 500,  dmg: 30,  rpm: 400, mag: 15, reload: 1.5, spread: 0.009, pellets: 1,  auto: false, range: 95 },
  sheriff:  { name: 'Sheriff',  type: 'Tabanca',  price: 800,  dmg: 55,  rpm: 170, mag: 6,  reload: 2.2, spread: 0.006, pellets: 1,  auto: false, range: 100 },
  bucky:    { name: 'Bucky',    type: 'Pompalı',  price: 900,  dmg: 14,  rpm: 90,  mag: 5,  reload: 2.4, spread: 0.075, pellets: 12, auto: false, range: 35 },
  marshal:  { name: 'Marshal',  type: 'Keskin',   price: 950,  dmg: 100, rpm: 80,  mag: 5,  reload: 2.6, spread: 0.003, pellets: 1,  auto: false, range: 180 },
  spectre:  { name: 'Spectre',  type: 'SMG',      price: 1600, dmg: 20,  rpm: 800, mag: 30, reload: 1.9, spread: 0.020, pellets: 1,  auto: true,  range: 70 },
  judge:    { name: 'Judge',    type: 'Pompalı',  price: 1850, dmg: 12,  rpm: 210, mag: 7,  reload: 2.2, spread: 0.060, pellets: 8,  auto: true,  range: 30 },
  phantom:  { name: 'Phantom',  type: 'Tüfek',    price: 2900, dmg: 32,  rpm: 660, mag: 30, reload: 2.3, spread: 0.013, pellets: 1,  auto: true,  range: 130 },
  vandal:   { name: 'Vandal',   type: 'Tüfek',    price: 2900, dmg: 36,  rpm: 540, mag: 25, reload: 2.4, spread: 0.012, pellets: 1,  auto: true,  range: 140 },
  ares:     { name: 'Ares',     type: 'Makineli', price: 3200, dmg: 30,  rpm: 780, mag: 50, reload: 3.2, spread: 0.022, pellets: 1,  auto: true,  range: 110 },
  operator: { name: 'Operator', type: 'Keskin',   price: 4700, dmg: 150, rpm: 72,  mag: 5,  reload: 3.4, spread: 0.002, pellets: 1,  auto: false, range: 200 },
  // 3. slot: bıçak (satılmaz). Sol tık hızlı kesik, sağ tık ağır darbe
  knife:    { name: 'Karambit', type: 'Bıçak',    price: 0,    dmg: 40,  heavy: 80, rpm: 140, heavyRpm: 60, mag: 0, reload: 0, spread: 0, pellets: 1, auto: true, range: 2.6, melee: true },
};
// Slotlar (Valorant gibi): 1 = ana silah, 2 = tabanca, 3 = bıçak
export const slotOf = (id) => (WEAPONS[id]?.melee ? 3 : WEAPONS[id]?.type === 'Tabanca' ? 2 : 1);
export const BUY_LIST = Object.keys(WEAPONS).filter((id) => !WEAPONS[id].melee);

export const AGENTS = {
  soldier: {
    name: 'Nöbet', role: 'Düellocu', roleEn: 'DUELIST', model: 'Soldier.glb', color: '#ff6a2b',
    anim: { idle: 'Idle', run: 'Run' },
    abilities: {
      e: { id: 'dash',  name: 'Atılış',  cd: 10, desc: 'Baktığın yöne hızla atılır.' },
      q: { id: 'smoke', name: 'Sis',     cd: 22, desc: 'Önüne 10 saniyelik sis perdesi atar.' },
    },
  },
  xbot: {
    name: 'Hayalet', role: 'Kontrolcü', roleEn: 'CONTROLLER', model: 'Xbot.glb', color: '#2fd3c0',
    anim: { idle: 'idle', run: 'run' },
    abilities: {
      e: { id: 'heal',  name: 'Onarım',  cd: 35, desc: '50 can yeniler.' },
      q: { id: 'flash', name: 'Flaş',    cd: 18, desc: 'Baktığın noktada patlar, düşmanları kör eder.' },
    },
  },
  robot: {
    name: 'Volt', role: 'Başlatıcı', roleEn: 'INITIATOR', model: 'RobotExpressive.glb', color: '#e8d34a',
    anim: { idle: 'Idle', run: 'Running' },
    abilities: {
      e: { id: 'haste', name: 'Aşırı Yük', cd: 24, desc: '5 saniye boyunca %40 daha hızlı koşarsın.' },
      q: { id: 'blast', name: 'Şok Dalgası', cd: 26, desc: 'Çevrendeki düşmanlara 40 hasar verir.' },
    },
  },
  viper: {
    name: 'Zehir', role: 'Kontrolcü', roleEn: 'CONTROLLER', model: 'Soldier.glb', skin: '#4ade80', color: '#4ade80',
    anim: { idle: 'Idle', run: 'Run' },
    abilities: {
      e: { id: 'smoke', name: 'Sis',     cd: 22, desc: 'Önüne 10 saniyelik sis perdesi atar.' },
      q: { id: 'flash', name: 'Flaş',    cd: 18, desc: 'Baktığın noktada patlar, düşmanları kör eder.' },
    },
  },
  rogue: {
    name: 'Kızıl', role: 'Düellocu', roleEn: 'DUELIST', model: 'Xbot.glb', skin: '#ff4655', color: '#ff4655',
    anim: { idle: 'idle', run: 'run' },
    abilities: {
      e: { id: 'dash',  name: 'Atılış',  cd: 10, desc: 'Baktığın yöne hızla atılır.' },
      q: { id: 'blast', name: 'Şok Dalgası', cd: 26, desc: 'Çevrendeki düşmanlara 40 hasar verir.' },
    },
  },
  sage: {
    name: 'Ruh', role: 'Başlatıcı', roleEn: 'INITIATOR', model: 'Xbot.glb', skin: '#b388ff', color: '#b388ff',
    anim: { idle: 'idle', run: 'run' },
    abilities: {
      e: { id: 'haste', name: 'Aşırı Yük', cd: 24, desc: '5 saniye boyunca %40 daha hızlı koşarsın.' },
      q: { id: 'heal',  name: 'Onarım',  cd: 35, desc: '50 can yeniler.' },
    },
  },
  // Quaternius low-poly karakterler (CC0) — silah tutma animasyonlu
  swat: {
    name: 'Tetik', role: 'Düellocu', roleEn: 'DUELIST', model: 'Swat.glb', color: '#3b82f6', hand: 'Wrist.R', gripOff: [0, -0.05, 0.05],
    anim: { idle: 'CharacterArmature|Idle_Gun_Pointing', walk: 'CharacterArmature|Walk', run: 'CharacterArmature|Run_Shoot' },
    abilities: {
      e: { id: 'dash',  name: 'Atılış',  cd: 10, desc: 'Baktığın yöne hızla atılır.' },
      q: { id: 'flash', name: 'Flaş',    cd: 18, desc: 'Baktığın noktada patlar, düşmanları kör eder.' },
    },
  },
  operative: {
    name: 'Nova', role: 'Kontrolcü', roleEn: 'CONTROLLER', model: 'Operative.glb', color: '#f472b6', hand: 'Wrist.R', gripOff: [0, -0.05, 0.05],
    anim: { idle: 'CharacterArmature|Idle_Gun_Pointing', walk: 'CharacterArmature|Walk', run: 'CharacterArmature|Run_Shoot' },
    abilities: {
      e: { id: 'smoke', name: 'Sis',     cd: 22, desc: 'Önüne 10 saniyelik sis perdesi atar.' },
      q: { id: 'heal',  name: 'Onarım',  cd: 35, desc: '50 can yeniler.' },
    },
  },
  trooper: {
    name: 'Er', role: 'Başlatıcı', roleEn: 'INITIATOR', model: 'ShooterSoldier.glb', color: '#a3e635', hand: 'Index1.R',
    hide: ['Revolver', 'Sniper', 'Revolver_Small', 'Pistol', 'SMG', 'GrenadeLauncher', 'ShortCannon', 'Shotgun', 'Sniper_2', 'RocketLauncher', 'AK', 'Shovel', 'Knife_2', 'Knife_1'],
    anim: { idle: 'CharacterArmature|Idle_Shoot', run: 'CharacterArmature|Run_Gun' },
    abilities: {
      e: { id: 'haste', name: 'Aşırı Yük', cd: 24, desc: '5 saniye boyunca %40 daha hızlı koşarsın.' },
      q: { id: 'flash', name: 'Flaş',    cd: 18, desc: 'Baktığın noktada patlar, düşmanları kör eder.' },
    },
  },

  kale: {
    name: 'Kale', role: 'Gözcü', roleEn: 'SENTINEL', model: 'Swat.glb', skin: '#94a3b8', color: '#94a3b8', hand: 'Wrist.R', gripOff: [0, -0.05, 0.05],
    anim: { idle: 'CharacterArmature|Idle_Gun_Pointing', walk: 'CharacterArmature|Walk', run: 'CharacterArmature|Run_Shoot' },
    abilities: {
      e: { id: 'wall',  name: 'Bariyer', cd: 28, desc: 'Önüne 8 saniyelik, mermi geçirmeyen duvar kurar.' },
      q: { id: 'recon', name: 'Keşif',   cd: 30, desc: '40 m içindeki düşmanları 4 saniye takımına gösterir.' },
    },
  },
  alev: {
    name: 'Alev', role: 'Düellocu', roleEn: 'DUELIST', model: 'Operative.glb', skin: '#f97316', color: '#f97316', hand: 'Wrist.R', gripOff: [0, -0.05, 0.05],
    anim: { idle: 'CharacterArmature|Idle_Gun_Pointing', walk: 'CharacterArmature|Walk', run: 'CharacterArmature|Run_Shoot' },
    abilities: {
      e: { id: 'dash',  name: 'Atılış',  cd: 10, desc: 'Baktığın yöne hızla atılır.' },
      q: { id: 'molly', name: 'Molotof', cd: 26, desc: 'Baktığın yere 5 saniye yanan ateş alanı atar.' },
    },
  },
  romanov: {
    name: 'Romanov · CS2', role: 'Düellocu', roleEn: 'DUELIST', model: 'agents/Romanov.glb', color: '#8c4b36',
    retargetFrom: 'swat', hand: 'hand_r_49',
    anim: { idle: 'CharacterArmature|Idle_Gun_Pointing', walk: 'CharacterArmature|Walk', run: 'CharacterArmature|Run_Shoot' },
    abilities: {
      e: { id: 'dash', name: 'Atılış', cd: 10, desc: 'Baktığın yöne hızla atılır.' },
      q: { id: 'smoke', name: 'Sis', cd: 22, desc: 'Önüne 10 saniyelik sis perdesi atar.' },
    },
  },
  miami: {
    name: 'Miami · CS2', role: 'Gözcü', roleEn: 'SENTINEL', model: 'agents/Miami.glb', color: '#d4b55c',
    retargetFrom: 'swat', hand: 'hand_r_49',
    anim: { idle: 'CharacterArmature|Idle_Gun_Pointing', walk: 'CharacterArmature|Walk', run: 'CharacterArmature|Run_Shoot' },
    abilities: {
      e: { id: 'wall', name: 'Bariyer', cd: 28, desc: 'Önüne 8 saniyelik, mermi geçirmeyen duvar kurar.' },
      q: { id: 'recon', name: 'Keşif', cd: 30, desc: '40 m içindeki düşmanları 4 saniye takımına gösterir.' },
    },
  },
  engineer: {
    name: 'Mühendis', role: 'Gözcü', roleEn: 'SENTINEL', model: 'Swat.glb', skin: '#52a8c7', color: '#52a8c7', hand: 'Wrist.R', gripOff: [0, -0.05, 0.05],
    anim: { idle: 'CharacterArmature|Idle_Gun_Pointing', walk: 'CharacterArmature|Walk', run: 'CharacterArmature|Run_Shoot' },
    abilities: {
      e: { id: 'turret', name: 'Nöbetçi Taret', cd: 32, desc: 'Önüne 18 saniyeliğine otomatik savunma tareti kurar.' },
      q: { id: 'mine', name: 'Şok Mayını', cd: 24, desc: 'Yaklaşan rakibe hasar veren görünür bir mayın bırakır.' },
    },
  },
  trapper: {
    name: 'Tuzakçı', role: 'Gözcü', roleEn: 'SENTINEL', model: 'Operative.glb', skin: '#c78b52', color: '#c78b52', hand: 'Wrist.R', gripOff: [0, -0.05, 0.05],
    anim: { idle: 'CharacterArmature|Idle_Gun_Pointing', walk: 'CharacterArmature|Walk', run: 'CharacterArmature|Run_Shoot' },
    abilities: {
      e: { id: 'mine', name: 'Şok Mayını', cd: 24, desc: 'Yaklaşan rakibe hasar veren görünür bir mayın bırakır.' },
      q: { id: 'turret', name: 'Nöbetçi Taret', cd: 32, desc: 'Önüne 18 saniyeliğine otomatik savunma tareti kurar.' },
    },
  },
};

export const TEAMS = [
  { name: 'Saldırı', color: '#ff4655' },
  { name: 'Savunma', color: '#53e3c4' },
];

// ---- Haritalar: simetrik arena üretimi ----
// Kutular: [x, z, genişlik(x), derinlik(z), yükseklik, tür]. Her satır 4 köşeye aynalanır.
// mirrorZ=false: satırlar tüm z aralığını verir, yalnızca x'e (takımlar arası) aynalanır
function buildMapFromQuarter(name, halfX, halfZ, spawnX, quarter, goals, mirrorZ = true) {
  const seen = new Set();
  const boxes = [];
  for (const [x, z, w, d, h, k] of quarter) {
    for (const sx of [1, -1]) for (const sz of mirrorZ ? [1, -1] : [1]) {
      const bx = x * sx || 0, bz = z * sz || 0, key = `${bx}|${bz}|${w}|${d}`;
      if (seen.has(key)) continue;
      seen.add(key);
      boxes.push({ x: bx, z: bz, w, d, h, k });
    }
  }
  boxes.push({ x: 0, z: -(halfZ + 0.5), w: halfX * 2 + 2, d: 1, h: 6, k: 'outer' });
  boxes.push({ x: 0, z: halfZ + 0.5, w: halfX * 2 + 2, d: 1, h: 6, k: 'outer' });
  boxes.push({ x: -(halfX + 0.5), z: 0, w: 1, d: halfZ * 2 + 2, h: 6, k: 'outer' });
  boxes.push({ x: halfX + 0.5, z: 0, w: 1, d: halfZ * 2 + 2, h: 6, k: 'outer' });
  return { name, halfX, halfZ, spawnX, boxes, goals, sites: [[-12, 0], [12, 0]] };
}

export const MAP_DEFS = {
  haven: buildMapFromQuarter('Haven C-Site', 44, 28, 39, [
    [-31, -15, 1, 18, 5, 'wall'],
    [-27, -9, 2.4, 2.4, 1.3, 'crate'],
    [-18, -18, 10, 8, 4.5, 'house'],
    [-8, -25, 4, 1.5, 1.4, 'crate'],
    [-12, -9, 1.2, 7, 3.4, 'wall'],
    [-8, -4, 1.6, 1.6, 4.2, 'pillar'],
    [-4, -14, 8, 1.2, 3.4, 'wall'],
    [0, 0, 5, 5, 2.4, 'stack'],
    [-4.5, -8, 3, 3, 1.3, 'crate'],
    [0, -8.5, 2.4, 2.4, 2.4, 'crate'],
    [-16, -5, 3, 3, 1.3, 'crate'],
  ], [[-26, -26], [26, 26], [-26, 26], [26, -26], [-8, -20], [8, 20], [-8, 20], [8, -20], [-12, 0], [12, 0], [0, -6], [0, 6], [-20, -10], [20, 10]]),

  // Bind: çöl; kuzeyde kapalı uzun koridor, güneyde büyük evler (z'de simetrik değil)
  bind: buildMapFromQuarter('Bind Çöl Pazarı', 40, 26, 35, [
    [-28, -11, 1.2, 12, 5, 'wall'],
    [-28, 13, 1.2, 10, 5, 'wall'],
    [-17, -15, 12, 1.2, 4.5, 'wall'],
    [-17, -21, 3, 3, 1.3, 'crate'],
    [-6, -17, 6, 6, 4.5, 'house'],
    [-13, -5, 3, 3, 2.6, 'stack'],
    [-19, 8, 8, 8, 4.5, 'house'],
    [-8, 14, 1.2, 10, 3.8, 'wall'],
    [-10, 3, 2.4, 2.4, 1.3, 'crate'],
    [-3, -4, 1.8, 1.8, 4, 'pillar'],
    [-4, 22, 3, 1.6, 1.4, 'crate'],
    [-24, 21, 1.4, 1.4, 1.3, 'barrel'],
    [-24, -22, 1.2, 1.2, 4, 'tree'],
    [0, 0, 4, 4, 2.4, 'stack'],
    [0, -21, 2.2, 2.2, 2.2, 'crate'],
    [0, 10, 6, 1.2, 3, 'wall'],
  ], [[-20, -20], [20, -20], [-20, 20], [20, 20], [-12, 0], [12, 0], [0, -8], [0, 8], [-6, -24], [6, -24], [-12, 18], [12, 18], [0, 22], [0, -12]], false),

  // Split: gece şehri; yüksek duvarlı dar ara sokaklar, ortada kule
  split: buildMapFromQuarter('Split Neon Sokak', 42, 30, 37, [
    [-30, -14, 1.2, 20, 5.5, 'wall'],
    [-20, -8, 12, 1.2, 5, 'wall'],
    [-12, -18, 1.2, 12, 5, 'wall'],
    [-20, -22, 6, 5, 4, 'house'],
    [-6, -6, 1.2, 6, 4, 'wall'],
    [-4, -14, 6, 6, 6.5, 'house'],
    [0, 0, 3, 3, 1.3, 'crate'],
    [-16, -2, 2.6, 2.6, 1.3, 'crate'],
    [-25, -26, 3, 3, 1.3, 'crate'],
    [-8, -26, 2.4, 2.4, 2.4, 'crate'],
    [-2, -25, 1.6, 1.6, 4, 'pillar'],
    [-26, -12, 1.4, 1.4, 1.2, 'barrel'],
  ], [[-24, -14], [24, 14], [-24, 14], [24, -14], [-9, -20], [9, 20], [-9, 20], [9, -20], [-10, 0], [10, 0], [0, -6], [0, 6], [0, -20], [0, 20], [-18, -14], [18, 14]]),

  // Ascent: İtalyan meydanı; ortada çeşme, köşelerde konaklar, sütun sırası
  ascent: buildMapFromQuarter('Ascent Meydan', 46, 30, 40, [
    [-34, -13, 1.2, 18, 5.2, 'wall'],
    [-22, -16, 10, 8, 5, 'house'],
    [-10, -22, 10, 1.2, 4, 'wall'],
    [-8, -8, 6, 6, 3.2, 'house'],
    [0, -15, 1.6, 1.6, 5, 'pillar'],
    [-4, -26, 1.6, 1.6, 5, 'pillar'],
    [-18, -4, 3, 3, 1.3, 'crate'],
    [-26, -26, 3, 1.6, 1.4, 'crate'],
    [0, 0, 6, 6, 1.1, 'planter'],
    [-14, -28, 1.4, 1.4, 1.3, 'barrel'],
    [-30, -4, 1.2, 1.2, 4.5, 'tree'],
  ], [[-30, -26], [30, 26], [-30, 26], [30, -26], [-14, -14], [14, 14], [-14, 14], [14, -14], [-14, 0], [14, 0], [0, -8], [0, 8], [0, -22], [0, 22], [-20, -26], [20, 26]]),

  // Breeze: tropik; çok açık, uzun görüş hatları, ortada alçak platform
  breeze: buildMapFromQuarter('Breeze Ada', 48, 32, 42, [
    [-36, -14, 1.3, 18, 5, 'wall'],
    [-36, 17, 1.3, 14, 5, 'wall'],
    [-22, -20, 12, 8, 5, 'house'],
    [-24, 12, 3, 3, 1.4, 'crate'],
    [-12, -6, 2.2, 2.2, 5, 'pillar'],
    [-12, 6, 2.2, 2.2, 5, 'pillar'],
    [-6, -24, 10, 1.4, 3.6, 'wall'],
    [-16, 22, 8, 1.4, 3.6, 'wall'],
    [0, 0, 7, 7, 1.2, 'planter'],
    [0, 14, 3, 3, 2.8, 'stack'],
    [-30, 26, 1.4, 1.4, 1.2, 'barrel'],
    [-6, 26, 3, 3, 1.4, 'crate'],
    [-20, 2, 1.2, 1.2, 5, 'tree'],
    [-28, -28, 1.2, 1.2, 5, 'tree'],
    [-10, 18, 1.2, 1.2, 5, 'tree'],
  ], [[-30, -28], [30, -28], [-30, 28], [30, 28], [-18, 0], [18, 0], [0, -10], [0, 10], [-6, -28], [6, -28], [-16, 16], [16, 16], [0, 24], [-24, -8], [24, -8]], false),

  spike_arena: buildMapFromQuarter('Kızıl Vadi · Spike', 46, 30, 39, [
    [-34, -15, 1.4, 18, 5.2, 'wall'],
    [-28, -22, 7, 5, 4.4, 'house'],
    [-23, -9, 3.2, 3.2, 1.4, 'crate'],
    [-17, -20, 8, 1.4, 3.6, 'wall'],
    [-13, -11, 1.4, 12, 4.5, 'wall'],
    [-8, -24, 3, 3, 2.6, 'stack'],
    [-5, -4, 5, 2.2, 1.4, 'crate'],
    [0, -13, 10, 1.4, 3.2, 'wall'],
    [0, -3, 3, 3, 1.4, 'crate'],
    [-20, -1, 2.4, 2.4, 4.3, 'pillar'],
    [-28, -3, 3, 3, 1.4, 'barrel'],
  ], [[-34, -23], [34, -23], [-34, 23], [34, 23], [-12, -13], [12, -13], [-12, 13], [12, 13], [-2, 0], [2, 0], [-22, 0], [22, 0]], false),
};

// Lotus: orman tapınağı; sütunlu avlu, taşlar, tapınak odası
MAP_DEFS.lotus = buildMapFromQuarter('Lotus Tapınağı', 44, 30, 39, [
  [-30, -17, 1.2, 16, 5, 'wall'],
  [-22, -8, 1.4, 1.4, 4.6, 'pillar'],
  [-16, -8, 1.4, 1.4, 4.6, 'pillar'],
  [-10, -8, 1.4, 1.4, 4.6, 'pillar'],
  [-22, -16, 1.4, 1.4, 4.6, 'pillar'],
  [-10, -16, 1.4, 1.4, 4.6, 'pillar'],
  [-16, -12, 3, 3, 1.0, 'planter'],
  [-16, -24, 8, 1.2, 3.4, 'wall'],
  [-4, -20, 4, 4, 4.4, 'house'],
  [0, 0, 5, 5, 2.4, 'stack'],
  [-6, -6, 2.4, 2.4, 1.3, 'rock'],
  [-26, -4, 2.2, 2.2, 1.2, 'rock'],
  [-26, -26, 1.2, 1.2, 5, 'tree'],
  [-12, -28, 1.2, 1.2, 5, 'tree'],
], [[-24, -24], [24, 24], [-24, 24], [24, -24], [-16, -20], [16, 20], [-16, 20], [16, -20], [-16, -4], [16, 4], [-12, 0], [12, 0], [0, -10], [0, 10], [0, -26], [0, 26], [-6, -12], [6, 12]]);

// Dust2 esintili üç rotalı çöl haritası: üst uzun yol, açık orta ve alt tüneller.
MAP_DEFS.dust2 = {
  name: 'Dust 2 · Çöl Geçidi', halfX: 52, halfZ: 34, spawnX: 46,
  boxes: [
    // Dış çeperler: diğer haritalardaki gibi görüş ve hareket sınırı sağlar.
    { x: 0, z: -34.5, w: 106, d: 1, h: 6, k: 'outer' },
    { x: 0, z: 34.5, w: 106, d: 1, h: 6, k: 'outer' },
    { x: -52.5, z: 0, w: 1, d: 70, h: 6, k: 'outer' },
    { x: 52.5, z: 0, w: 1, d: 70, h: 6, k: 'outer' },
    // A uzun yolu ve A alanı
    { x: -18, z: -30, w: 30, d: 1.2, h: 5, k: 'wall' },
    { x: -22, z: -18, w: 22, d: 1.2, h: 4.5, k: 'wall' },
    { x: 10, z: -18, w: 24, d: 1.2, h: 4.5, k: 'wall' },
    { x: -28, z: -24, w: 8, d: 7, h: 4.5, k: 'house' },
    { x: 8, z: -25, w: 7, d: 6, h: 4.5, k: 'house' },
    { x: 31, z: -23, w: 1.4, d: 12, h: 4.5, k: 'wall' },
    { x: 22, z: -31, w: 17, d: 1.2, h: 4.5, k: 'wall' },
    { x: 22, z: -15, w: 17, d: 1.2, h: 4.5, k: 'wall' },
    { x: 25, z: -26, w: 2.4, d: 2.4, h: 1.3, k: 'crate' },
    { x: 19, z: -21, w: 2.4, d: 2.4, h: 1.3, k: 'crate' },
    // Orta geçit ve görüşü bölen alçak siperler
    { x: -2, z: -8, w: 13, d: 1.2, h: 4, k: 'wall' },
    { x: 22, z: -8, w: 14, d: 1.2, h: 4, k: 'wall' },
    { x: -18, z: 8, w: 20, d: 1.2, h: 4, k: 'wall' },
    { x: 20, z: 8, w: 18, d: 1.2, h: 4, k: 'wall' },
    { x: -4, z: 0, w: 3, d: 3, h: 1.3, k: 'crate' },
    { x: 7, z: 3, w: 3, d: 3, h: 1.3, k: 'crate' },
    { x: 14, z: 0, w: 1.6, d: 1.6, h: 4, k: 'pillar' },
    // Alt tüneller ve B alanı
    { x: -18, z: 30, w: 30, d: 1.2, h: 5, k: 'wall' },
    { x: -22, z: 18, w: 22, d: 1.2, h: 4.5, k: 'wall' },
    { x: 10, z: 18, w: 24, d: 1.2, h: 4.5, k: 'wall' },
    { x: -28, z: 24, w: 8, d: 7, h: 4.5, k: 'house' },
    { x: 8, z: 25, w: 7, d: 6, h: 4.5, k: 'house' },
    { x: 31, z: 23, w: 1.4, d: 12, h: 4.5, k: 'wall' },
    { x: 22, z: 31, w: 17, d: 1.2, h: 4.5, k: 'wall' },
    { x: 22, z: 15, w: 17, d: 1.2, h: 4.5, k: 'wall' },
    { x: 25, z: 26, w: 2.4, d: 2.4, h: 1.3, k: 'crate' },
    { x: 19, z: 21, w: 2.4, d: 2.4, h: 1.3, k: 'crate' },
    // Tünel ağzı dekoru, uzun görüş çizgisinde alçak siper
    { x: -38, z: -23, w: 2.6, d: 2.6, h: 2.4, k: 'barrel' },
    { x: -38, z: 23, w: 2.6, d: 2.6, h: 2.4, k: 'barrel' },
  ],
  goals: [[-34, -23], [-20, -3], [0, 0], [16, 0], [26, -23], [-34, 23], [26, 23]],
  sites: [[25, -23], [25, 23]],
};

// Icebox: karlı liman; renkli konteyner sıraları, dar koridorlar
MAP_DEFS.icebox = buildMapFromQuarter('Icebox Liman', 50, 26, 44, [
  [-34, -10, 8, 2.6, 2.6, 'container'],
  [-24, -18, 2.6, 9, 2.6, 'container'],
  [-16, -6, 9, 2.6, 5.2, 'container'],
  [-8, -16, 2.6, 8, 2.6, 'container'],
  [-6, -4, 2, 2, 5, 'pillar'],
  [0, -12, 6, 2.6, 2.6, 'container'],
  [-28, -22, 6, 1.2, 4, 'wall'],
  [-14, -22, 2.4, 2.4, 1.3, 'crate'],
  [0, 0, 4, 4, 2.6, 'stack'],
  [-40, -20, 1.4, 1.4, 1.3, 'barrel'],
  [-36, -22, 1.2, 1.2, 4.5, 'tree'],
], [[-30, -16], [30, 16], [-30, 16], [30, -16], [-12, -12], [12, 12], [-12, 12], [12, -12], [0, -5], [0, 5], [-20, 0], [20, 0], [-4, -20], [4, 20]]);

MAP_DEFS.range = {
  name: 'Atış Poligonu', halfX: 42, halfZ: 20, spawnX: 33,
  boxes: [
    { x: 0, z: -19.5, w: 84, d: 1, h: 5, k: 'outer' },
    { x: 0, z: 19.5, w: 84, d: 1, h: 5, k: 'outer' },
    { x: -41.5, z: 0, w: 1, d: 40, h: 5, k: 'outer' },
    { x: 41.5, z: 0, w: 1, d: 40, h: 5, k: 'outer' },
    { x: -1, z: -12, w: 4, d: 2, h: 1.1, k: 'crate' },
    { x: 10, z: 12, w: 4, d: 2, h: 1.1, k: 'crate' },
    { x: 22, z: -12, w: 4, d: 2, h: 1.1, k: 'crate' },
  ],
  goals: [[-12, 0], [0, 0], [12, 0], [24, 0]], sites: [],
};

// Minecraft modeli dışında indirilen harita mesh'leri kaldırıldı; bu haritalar artık yerleşik geometrilerden üretiliyor.
MAP_DEFS.minecraft_dm = { name: 'CS Deathmatch · Minecraft', halfX: 34, halfZ: 56, spawnX: 13.33, boxes: [], goals: [], sites: [] };

for (const [id, d] of Object.entries(MAP_DEFS)) d.id = id;

export const MAP_LIST = Object.keys(MAP_DEFS);
export const MAP_SPIKE_LIST = MAP_LIST.filter((id) => MAP_DEFS[id].sites?.length);
export const MAP_NAMES = Object.fromEntries(MAP_LIST.map((id) => [id, MAP_DEFS[id].name]));

export const MAP = {
  id: 'haven',
  name: MAP_DEFS.haven.name,
  halfX: MAP_DEFS.haven.halfX,
  halfZ: MAP_DEFS.haven.halfZ,
  spawnX: MAP_DEFS.haven.spawnX,
  spawnAxis: 'x',
  spawns: null,
  spawnY: 0.18,
  playerScale: 1,
  // Ayrı kopya: ...spread aynı dizi referansını paylaşırdı; setMap boxes'ı silince harita boşalıyordu
  boxes: MAP_DEFS.haven.boxes.map((b) => ({ ...b })),
  goals: MAP_DEFS.haven.goals.slice(),
  sites: MAP_DEFS.haven.sites.map((s) => [...s]),
  custom: null,
  spawn(team, i, n = 1) {
    if (this.spawns?.[team]) {
      const [sx, sz, yaw] = this.spawns[team];
      return { x: sx + (i - (n - 1) / 2) * 3.4, y: this.spawnY ?? 0.18, z: sz, yaw };
    }
    const sx = this.spawnX;
    if (this.spawnAxis === 'z') return { x: (i - (n - 1) / 2) * 3.4, y: this.spawnY ?? 0.18, z: team === 0 ? -sx : sx, yaw: team === 0 ? Math.PI : 0 };
    return { x: team === 0 ? -sx : sx, y: this.spawnY ?? 0.18, z: (i - (n - 1) / 2) * 3.4, yaw: team === 0 ? -Math.PI / 2 : Math.PI / 2 };
  },
  apply(d) {
    if (!d) return;
    if (d.boxes) { this.boxes = d.boxes.map((b) => ({ ...b })); }
    for (const k of ['id', 'name', 'halfX', 'halfZ', 'spawnX', 'spawnAxis', 'spawns', 'spawnY', 'goals', 'custom', 'playerScale']) if (d[k] !== undefined) this[k] = d[k];
    if (d.sites !== undefined) this.sites = d.sites.map((s) => [...s]);
  },
  setMap(id) {
    const def = MAP_DEFS[id] || MAP_DEFS.haven;
    this.id = def.id;
    this.name = def.name;
    this.halfX = def.halfX;
    this.halfZ = def.halfZ;
    this.spawnX = def.spawnX;
    this.spawnAxis = def.spawnAxis || 'x';
    this.spawns = null;
    this.spawnY = 0.18;
    this.playerScale = 1;
    this.boxes = def.boxes.map((b) => ({ ...b }));
    this.goals = def.goals.slice();
    this.sites = (def.sites || []).map((s) => [...s]);
    this.custom = null;
  },
};
