// data.js

const WEAPON_DEFS = {
  laser_repeater:      { name: "Laser Repeater",       category: "laser",      fireInterval: 10,  dmgMult: 0.5,  penMult: 1.0, speed: 12, w: 7,  h: 3, spread: 0,    playerColor: "#00eeff", enemyColor: "#ff3333" },
  laser_cannon:        { name: "Laser Cannon",          category: "laser",      fireInterval: 22,  dmgMult: 1.1,  penMult: 1.4, speed: 9,  w: 11, h: 4, spread: 0,    playerColor: "#0055ff", enemyColor: "#ff6600" },
  ballistic_gatling:   { name: "Ballistic Gatling",     category: "ballistic",  fireInterval: 7,   dmgMult: 0.45, penMult: 1.3, speed: 15, w: 6,  h: 3, spread: 0.05, playerColor: "#ffee44", enemyColor: "#ffbb00" },
  ballistic_cannon:    { name: "Ballistic Cannon",      category: "ballistic",  fireInterval: 30,  dmgMult: 1.9,  penMult: 2.2, speed: 9,  w: 15, h: 5, spread: 0,    playerColor: "#ffcc00", enemyColor: "#ff8800" },
  ballistic_railgun:   { name: "Ballistic Railgun",     category: "ballistic",  fireInterval: 90,  dmgMult: 10.0, penMult: 5.0, speed: 22, w: 36, h: 3, spread: 0,    playerColor: "#ffffff", enemyColor: "#ffff88", hitscan: true },
  scattergun_ballistic:{ name: "Ballistic Scattergun",  category: "ballistic",  fireInterval: 20,  dmgMult: 0.75, penMult: 2.0, speed: 9,  w: 6,  h: 4, spread: 0.3,  playerColor: "#ffcc44", enemyColor: "#ffaa44", scattergun: true, pellets: 5, rangeFraction: 0.22, piercing: true },
  scattergun_laser:    { name: "Laser Scattergun",      category: "laser",      fireInterval: 20,  dmgMult: 0.75, penMult: 1.8, speed: 11, w: 6,  h: 4, spread: 0.3,  playerColor: "#00ffbb", enemyColor: "#ff44bb", scattergun: true, pellets: 5, rangeFraction: 0.22, piercing: true },
  distortion:          { name: "Distortion Repeater",   category: "distortion", fireInterval: 15,  dmgMult: 0.25, penMult: 0.4, speed: 9,  w: 8,  h: 4, spread: 0,    playerColor: "#aa44ff", enemyColor: "#cc66ff", stunOnHull: true },
  vengeance_cannon:    { name: "Vengeance Cannon",      category: "ballistic",  fireInterval: 30,  dmgMult: 1.9,  penMult: 2.2, speed: 12, w: 15, h: 5, spread: 0,    playerColor: "#ff0000", enemyColor: "#ff8800", vengeanceGun: true },
};

function calcBaseDmg(size) { return Math.round(7  * Math.pow(1.52, size - 1)); }
function calcBasePen(size) { return Math.round(4  * Math.pow(1.62, size - 1)); }
function getWeaponStats(type, size) {
  const d = WEAPON_DEFS[type];
  if (!d) return null;
  const s = Math.max(1, Math.min(10, size));
  return { ...d, damage: Math.round(calcBaseDmg(s) * d.dmgMult), penetration: Math.round(calcBasePen(s) * d.penMult * 10) / 10, size: s };
}
function getStunDuration(weaponSize) { return 60 + Math.round(weaponSize * 28); }

const ARMOR_TYPES = {
  light:      { name: "Light",      minFull: 1, minHalf: 1 },
  medium:     { name: "Medium",     minFull: 2, minHalf: 1 },
  heavy:      { name: "Heavy",      minFull: 3, minHalf: 2 },
  subcapital: { name: "Subcapital", minFull: 4, minHalf: 3 },
  capital:    { name: "Capital",    minFull: 5, minHalf: 4 },
};
function armorDamageMultiplier(weaponSize, armorTypeKey) {
  const a = ARMOR_TYPES[armorTypeKey];
  if (!a) return 1;
  if (weaponSize >= a.minFull) return 1;
  if (weaponSize >= a.minHalf) return 0.5;
  return 0;
}

const ARMOR_UPGRADE_TIERS = {
  1: { name: "Stock Plating",  mult: 3.0 },
  2: { name: "Extra Plating",  mult: 5.0 },
  3: { name: "Hardened",       mult: 7.5 },
};
const ARMOR_UPGRADE_PRICES = { 2: 30000, 3: 120000 };


// === PER-SHIP UPGRADE PRICES ===
const SHIP_UPGRADE_PRICES = {
  Starlight:  { shield:{ 2:8000,  3:25000  }, armor:{ 2:8000,  3:25000  }, engine:{ 2:8000,  3:25000  }, weapon:{ 2:10000, 3:30000  }, missile:{ 2:12000, 3:35000  } },
  Falcon:     { shield:{ 2:10000, 3:32000  }, armor:{ 2:10000, 3:32000  }, engine:{ 2:12000, 3:38000  }, weapon:{ 2:14000, 3:42000  }, missile:{ 2:15000, 3:44000  } },
  Rouge:      { shield:{ 2:15000, 3:50000  }, armor:{ 2:15000, 3:50000  }, engine:{ 2:18000, 3:55000  }, weapon:{ 2:20000, 3:60000  }, missile:{ 2:18000, 3:55000  } },
  Marauder:   { shield:{ 2:16000, 3:52000  }, armor:{ 2:18000, 3:58000  }, engine:{ 2:16000, 3:50000  }, weapon:{ 2:20000, 3:60000  }, missile:{ 2:16000, 3:48000  } },
  Wasp:       { shield:{ 2:22000, 3:75000  }, armor:{ 2:22000, 3:75000  }, engine:{ 2:28000, 3:88000  }, weapon:{ 2:28000, 3:85000  }, missile:{ 2:22000, 3:70000  } },
  Supernova:  { shield:{ 2:28000, 3:90000  }, armor:{ 2:28000, 3:90000  }, engine:{ 2:25000, 3:80000  }, weapon:{ 2:35000, 3:105000 }, missile:{ 2:30000, 3:95000  } },
  Bulwark:    { shield:{ 2:20000, 3:65000  }, armor:{ 2:25000, 3:80000  }, engine:{ 2:18000, 3:58000  }, weapon:{ 2:0,     3:0      }, missile:{ 2:20000, 3:60000  }, turret:{ 2:30000, 3:90000  } },
  Tempest:    { shield:{ 2:40000, 3:130000 }, armor:{ 2:45000, 3:140000 }, engine:{ 2:38000, 3:120000 }, weapon:{ 2:50000, 3:155000 }, missile:{ 2:40000, 3:125000 }, turret:{ 2:45000, 3:140000 } },
  Nemesis:    { shield:{ 2:38000, 3:120000 }, armor:{ 2:40000, 3:125000 }, engine:{ 2:35000, 3:110000 }, weapon:{ 2:50000, 3:155000 }, missile:{ 2:35000, 3:110000 } },
  Prometheus: { shield:{ 2:55000, 3:175000 }, armor:{ 2:55000, 3:175000 }, engine:{ 2:50000, 3:160000 }, weapon:{ 2:60000, 3:190000 }, missile:{ 2:55000, 3:175000 }, turret:{ 2:60000, 3:185000 } },
  Leviathan:  { shield:{ 2:75000, 3:240000 }, armor:{ 2:75000, 3:240000 }, engine:{ 2:65000, 3:210000 }, weapon:{ 2:0,     3:0      }, missile:{ 2:70000, 3:220000 }, turret:{ 2:80000, 3:250000 } },
  Dominion:   { shield:{ 2:90000, 3:285000 }, armor:{ 2:90000, 3:285000 }, engine:{ 2:80000, 3:255000 }, weapon:{ 2:100000,3:315000 }, missile:{ 2:85000, 3:270000 }, turret:{ 2:95000, 3:300000 } },
  Comet:      { shield:{ 2:20000, 3:65000  }, armor:{ 2:20000, 3:65000  }, engine:{ 2:22000, 3:70000  }, weapon:{ 2:25000, 3:78000  }, missile:{ 2:20000, 3:65000  } },
  Vengeance:  { shield:{ 2:25000, 3:80000  }, armor:{ 2:25000, 3:80000  }, engine:{ 2:28000, 3:88000  }, weapon:{ 2:0,     3:0      }, missile:{ 2:25000, 3:78000  } },
};

// === MISSILE STORAGE UPGRADES ===
const MISSILE_STORAGE_TIERS = {
  1: { name: "Stock Racks",   mult: 1.0  },
  2: { name: "Extended Racks", mult: 1.5  },
  3: { name: "Max Capacity",  mult: 2.0  },
};

// === WEAPON QUALITY UPGRADES ===
const WEAPON_QUALITY_TIERS = {
  1: { name: "Standard",    damageMult: 1.0  },
  2: { name: "Upgraded",    damageMult: 1.5  },
  3: { name: "Elite",       damageMult: 2.0  },
};

// === TURRET UPGRADE TIERS ===
const TURRET_UPGRADE_TIERS = {
  1: { name: "Stock Turrets",   rpmMult: 1.0 },
  2: { name: "High-RPM",        rpmMult: 1.5 },
  3: { name: "Overclocked",     rpmMult: 2.0 },
};

const SHIELD_TIERS = {
  1: { name: "Standard",   mult: 1.0, regenRate: 0.02 },
  2: { name: "Reinforced", mult: 1.5, regenRate: 0.04 },
  3: { name: "Milspec",    mult: 2.0, regenRate: 0.07 },
};
const SHIELD_TIER_PRICES = { 2: 20000, 3: 80000 };

// === ENGINE UPGRADES ===
const ENGINE_UPGRADE_TIERS = {
  1: { name: "Stock Engines",    speedMult: 1.00, boostDurMult: 1.00, boostCDMult: 1.00, dodgeBonus: 0.00 },
  2: { name: "Tuned Engines",    speedMult: 1.20, boostDurMult: 1.30, boostCDMult: 0.75, dodgeBonus: 0.05 },
  3: { name: "Overclocked",      speedMult: 1.50, boostDurMult: 1.60, boostCDMult: 0.50, dodgeBonus: 0.12 },
};
const ENGINE_UPGRADE_PRICES = { 2: 25000, 3: 100000 };

const ALLY_SHIP_DEFS = {
  Sprite:    { price: 0,      weaponSize: 1, hp: 60,  shields: 70,   armorType: "light",   image: "Merlin.png",        color: "#88ff88", w: 52, h: 32 },
  Raptor:    { price: 5000,   weaponSize: 2, hp: 120, shields: 130,  armorType: "light",   image: "Gladius.png",       color: "#aaffaa", w: 52, h: 32 },
  Rouge:     { price: 15000,  weaponSize: 3, hp: 300, shields: 320,  armorType: "medium",  image: "Cutlass.png",       color: "#aaffaa", w: 72, h: 44 },
  Wasp:      { price: 40000,  weaponSize: 4, hp: 500, shields: 560,  armorType: "medium",  image: "Hornet.png",        color: "#aaffaa", w: 80, h: 48 },
  Supernova: { price: 60000,  weaponSize: 5, hp: 600, shields: 680,  armorType: "heavy",   image: "Constellation.png", color: "#44ffcc", w: 92, h: 56 },
  Medic:     { price: 50000,  weaponSize: 0, hp: 450, shields: 500,  armorType: "medium",  image: "Hornet.png",        color: "#44ffee", w: 80, h: 48, isHealer:true },
};
const ALLY_SHIP_ORDER = ["Sprite","Raptor","Rouge","Wasp","Supernova","Medic"];

// === SHIP DESCRIPTIONS ===
const SHIP_DESCRIPTIONS = {
  Starlight:  "Entry-level light fighter. Fast and responsive but fragile. Perfect for learning. Can become faster and dodgier for a short time.",
  Falcon:     "A nimble interceptor with better armament. Great speed, low survivability. Has a mode where it shortly phases out of dimensions, becoming invulnerable.",
  Rouge:      "Versatile medium gunship with a PDC mount and solid missiles. A reliable all-rounder. Can overclock its guns a lot for a short time.",
  Marauder:   "Rugged medium freighter turned fighter. Slower but tougher than the Rouge. Can become tougher for a short period of time.",
  Wasp:       "Heavy fighter with exceptional speed and an S4 PDC. Best early capital-killer. Can call in an extra ally.",
  Supernova:  "Heavy gunship with massive missile capacity and triple PDC array. Great fire support. Can fabricate missiles on the spot, or replace shot during a period of time.",
  Bulwark:    "Pure PDC platform — no main guns, but 10 turrets that shred anything incoming. Can overclock its turrets.",
  Tempest:    "Subcapital assault ship with twin S5 ballistic cannons and heavy PDC coverage. Can repair itself and allies for a short duration",
  Nemesis:    "Capital warship with twin S8 ballistic cannons. Devastating against large targets. Can go into overdrive to increase speed and tankyness.",
  Prometheus: "Heavy capital corvette with excellent shields, torpedo loadout, and six turret banks. It can replace missiles shot during a certain time period.",
  Leviathan:  "Super-capital carrier. Slow, but fields 8 ally slots. Built to command an army, it can make its allies invicible for a short time.",
  Dominion:   "The ultimate warship. Its railgun penetrates entire formations in a single shot. Nothing can stand in its way.",
  Comet:      "A ghost ship found drifting at the edge of the system. Unnaturally agile — and lucky. Seems like an elite would use this.",
  Vengeance:  "A ship born from revenge. Bespoke high-velocity cannon hits like a capital ship. 'Revenge' mode pushes it beyond its limits — at a cost.",
};

// Ships that DO NOT get shield faces or directional armor (too small / no point)
const NO_SHIELD_FACES = new Set(["Starlight","Falcon","Comet","Vengeance","Raptor","Rouge","Sprite","ShadowComet"]);

const SHIPS = {
  // --- LIGHT ---
  Starlight:  { price: 0,         hp: 90,    shields: 120,  armor: 100, missiles: 2,  speed: 2.8,  weaponType: "laser_repeater",    weaponSize: 1,  bespoke: false, doubleShot: true, pdc: 0,  pdcSize: 0,                         image: "Starlight.png",        color: "#88aaff", size: 1,  missileType: 1, armorType: "light"                      },
  Falcon:     { price: 20000,     hp: 70,    shields: 100,  armor: 100, missiles: 3,  speed: 3.8,  weaponType: "laser_repeater",    weaponSize: 2,  bespoke: false, pdc: 0,  pdcSize: 0,                         image: "Mustang.png",          color: "#ffbb00", size: 1,  missileType: 1, armorType: "light"                      },
  // --- MEDIUM ---
  Rouge:      { price: 55000,     hp: 300,   shields: 450,  armor: 100, missiles: 12, speed: 1.7,  weaponType: "laser_repeater",    weaponSize: 3,  bespoke: false, pdc: 1,  pdcSize: 0,                         image: "Cutlass.png",          color: "#ff8844", size: 2,  missileType: 2, armorType: "medium"                     },
  Marauder:   { price: 70000,     hp: 380,   shields: 400,  armor: 100, missiles: 6,  speed: 1.5,  weaponType: "laser_repeater",    weaponSize: 3,  bespoke: false, pdc: 1,  pdcSize: 2,                         image: "Freelancer.png",       color: "#ff9966", size: 2,  missileType: 2, armorType: "medium"                     },
  // --- HEAVY ---
  Wasp:       { price: 140000,    hp: 500,   shields: 560,  armor: 100, missiles: 12, speed: 3.2,  weaponType: "laser_repeater",    weaponSize: 4,  bespoke: false, pdc: 1,  pdcSize: 4,                         image: "Hornet.png",           color: "#0099ff", size: 3,  missileType: 2, armorType: "medium"                     },
  Supernova:  { price: 160000,    hp: 1000,  shields: 900,  armor: 100, missiles: 52, speed: 1.0,  weaponType: "laser_repeater",    weaponSize: 5,  bespoke: false, doubleShot: true, pdc: 3,  pdcSize: 3,                         image: "Constellation.png",   color: "#44ff88", size: 4,  missileType: 1, armorType: "heavy",    extraAllySlots: 1 },
  // --- SUBCAPITAL ---
  Bulwark:    { price: 30000,     hp: 1750,  shields: 1200, armor: 100, missiles: 16, speed: 0.75, weaponType: "none",              weaponSize: 0,  bespoke: true,  pdc: 10, pdcSize: 4,                         image: "HammerHead.png",       color: "#4488ff", size: 6,  missileType: 3, armorType: "subcapital"                 },
  Tempest:    { price: 380000,    hp: 2000,  shields: 2200, armor: 100, missiles: 32, speed: 0.70, weaponType: "laser_repeater",    weaponSize: 5,  bespoke: false, doubleShot: true, pdc: 4, pdcSizes: [5,5,4,4], image: "StarlancerTAC.png",  color: "#00ffcc", size: 7,  missileType: 1, armorType: "subcapital", extraAllySlots: 1 },
  // --- CAPITAL ---
  Nemesis:    { price: 280000,    hp: 2000,  shields: 2500, armor: 100, missiles: 24, speed: 0.75, weaponType: "ballistic_cannon",  weaponSize: 8,  bespoke: true,  doubleShot: true, pdc: 6, pdcSize: 3,         image: "Nemesis.png",          color: "#ffff44", size: 6,  missileType: 3, armorType: "capital"                    },
  Prometheus: { price: 500000,    hp: 5000,  shields: 4000, armor: 100, missiles: 20, speed: 0.6,  weaponType: "ballistic_cannon",  weaponSize: 6,  bespoke: true,  pdc: 6,  pdcSize: 4,                         image: "Polaris.png",          color: "#ff44ff", size: 7,  missileType: 3, armorType: "capital",   extraAllySlots: 2 },
  // --- SUPER CAPITAL ---
  Leviathan:  { price: 750000,    hp: 7500,  shields: 7000,  armor: 100, missiles: 24, speed: 0.5,  weaponType: "none",    weaponSize: 0,  bespoke: false, pdc: 8, pdcSizes: [7,5,5,5,4,4,4,4], image: "Kraken.png", color: "#88ff00", size: 8,  missileType: 3, armorType: "capital", extraAllySlots: 6 },
  Dominion:   { price: 1200000,   hp: 10000, shields: 8000, armor: 100, missiles: 32, speed: 0.45, weaponType: "ballistic_railgun", weaponSize: 10, bespoke: true,  pdc: 8,  pdcSizes: [6,6,5,5,4,4,3,3],        image: "Idris.jpg",            color: "#cc88ff", size: 10, missileType: 3, armorType: "capital",   extraAllySlots: 4 },
  // --- SECRET ---
  Comet:      { price: null,      hp: 100,   shields: 90,   armor: 100, missiles: 30,  speed: 4.0,  weaponType: "ballistic_cannon",  weaponSize: 5,  bespoke: true,  doubleShot: true, pdc: 0,  pdcSize: 0,                         image: "Meteor.png",           color: "#ff2200", size: 1,  missileType: 2, armorType: "light",  secret: true       },
  Vengeance:  { price: null,      hp: 200,   shields: 400,  armor: 100, missiles: 20,  speed: 3.8,  weaponType: "vengeance_cannon",  weaponSize: 8,  bespoke: true,  doubleShot: false, pdc: 1, pdcSize: 4,                         image: "Meteor.png",           color: "#ff0044", size: 2,  missileType: 2, armorType: "medium", secret: true, extraAllySlots: 1 },
};

const ENEMIES = {
  Raptor:      { hp: 120,   shields: 130,   armor: 200, speed: 3.8,  score: 100,   fireRate: 70, weaponType: "laser_repeater",    weaponSize: 2,  armorType: "light",      image: "Gladius.png",         color: "#ff4444" },
  Rouge:       { hp: 500,   shields: 520,   armor: 200, speed: 2.0,  score: 350,   fireRate: 55, weaponType: "laser_repeater",    weaponSize: 3,  armorType: "medium",     image: "Cutlass.png",         color: "#ff8844" },
  Corsair:     { hp: 800,   shields: 750,   armor: 200, speed: 1.5,  score: 600,   fireRate: 50, weaponType: "laser_repeater",    weaponSize: 5,  armorType: "heavy",      image: "Corsair.png",         color: "#ff44ff" },
  Bulwark:     { hp: 3700,  shields: 4500,  armor: 200, speed: 0.35, score: 3000,  fireRate: 28, weaponType: "laser_repeater",    weaponSize: 4,  armorType: "subcapital", image: "HammerHead.png",      color: "#4466ff" },
  Prometheus:  { hp: 8000,  shields: 7000,  armor: 200, speed: 0.25, score: 6000,  fireRate: 32, weaponType: "ballistic_cannon",  weaponSize: 6,  armorType: "capital",    image: "Polaris.png",         color: "#dd44ff" },
  Dominion:    { hp: 18000, shields: 14000, armor: 200, speed: 0.15, score: 10000, fireRate: 22, weaponType: "ballistic_railgun", weaponSize: 10, armorType: "capital",    image: "Idris.jpg",           color: "#ff0000" },
  Dreadnaught: { hp: 80000, shields: 60000, armor: 200, speed: 0.08, score: 50000, fireRate: 35, weaponType: "laser_cannon",      weaponSize: 8,  armorType: "capital",    image: "VanduulKingship.png", color: "#ff6600" },
  Healer:      { hp: 3500, shields: 3000,  armor: 200, speed: 0.28, score: 2500,  fireRate: 45, weaponType: "laser_cannon",      weaponSize: 4,  armorType: "subcapital", image: "HammerHead.png", color: "#44ffaa" },
  Sprite:      { hp: 60,    shields: 70,    armor: 200, speed: 2.0,  score: 120,   fireRate: 60, weaponType: "laser_repeater",    weaponSize: 1,  armorType: "light",      image: "Merlin.png",          color: "#88ff88" },
  ShadowComet: { hp: 1400,  shields: 1000,  armor: 300, speed: 4.5,  score: 0,     fireRate: 16, weaponType: "ballistic_cannon",  weaponSize: 8,  armorType: "light",      image: "Meteor.png",          color: "#ff0044" },
};

ENEMIES.Raptor.turrets = [
  { rx: 34, ry: 21, weaponType: "laser_repeater", weaponSize: 2, fireRate: 140 },
  { rx: 34, ry: 21, weaponType: "laser_repeater", weaponSize: 2, fireRate: 140 },
  { rx: 34, ry: 21, weaponType: "laser_repeater", weaponSize: 2, fireRate: 140 },
];
ENEMIES.Raptor.size = 2;

ENEMIES.Rouge.turrets = [
  { rx: 34, ry: 14, weaponType: "laser_repeater", weaponSize: 3, fireRate: 24 },
  { rx: 34, ry: 28, weaponType: "laser_repeater", weaponSize: 3, fireRate: 24 },
];
ENEMIES.Rouge.size = 4;

ENEMIES.Corsair.turrets = [
  { rx: 34, ry: 21, weaponType: "laser_cannon",   weaponSize: 4, fireRate: 28 },
  { rx: 20, ry: 10, weaponType: "laser_repeater",  weaponSize: 4, fireRate: 33 },
  { rx: 20, ry: 32, weaponType: "laser_repeater",  weaponSize: 4, fireRate: 33 },
];
ENEMIES.Corsair.size = 7;

ENEMIES.Bulwark.turrets = [
  { rx: 10, ry:  8, weaponType: "laser_cannon", weaponSize: 4, fireRate: 18 },
  { rx: 10, ry: 26, weaponType: "laser_cannon", weaponSize: 4, fireRate: 18 },
  { rx: 10, ry: 44, weaponType: "laser_cannon", weaponSize: 4, fireRate: 18 },
  { rx: 40, ry:  6, weaponType: "laser_cannon", weaponSize: 4, fireRate: 12 },
  { rx: 40, ry: 26, weaponType: "laser_cannon", weaponSize: 4, fireRate: 12 },
  { rx: 40, ry: 44, weaponType: "laser_cannon", weaponSize: 4, fireRate: 12 },
];
ENEMIES.Bulwark.size = 6;

ENEMIES.Prometheus.turrets = [
  { rx: 20,  ry: 10, weaponType: "ballistic_cannon", weaponSize: 6, fireRate: 22 },
  { rx: 20,  ry: 42, weaponType: "ballistic_cannon", weaponSize: 6, fireRate: 22 },
  { rx: 60,  ry:  8, weaponType: "laser_cannon",     weaponSize: 4, fireRate: 16 },
  { rx: 60,  ry: 44, weaponType: "laser_cannon",     weaponSize: 4, fireRate: 16 },
  { rx: 100, ry: 10, weaponType: "laser_cannon",     weaponSize: 4, fireRate: 14 },
  { rx: 100, ry: 42, weaponType: "laser_cannon",     weaponSize: 4, fireRate: 14 },
  { rx: 60,  ry:  8, weaponType: "laser_cannon",     weaponSize: 4, fireRate: 16 },
  { rx: 60,  ry: 44, weaponType: "laser_cannon",     weaponSize: 4, fireRate: 16 },
  { rx: 100, ry: 10, weaponType: "laser_cannon",     weaponSize: 4, fireRate: 14 },
  { rx: 100, ry: 42, weaponType: "laser_cannon",     weaponSize: 4, fireRate: 14 },
  { rx: 130, ry: 26, weaponType: "ballistic_cannon", weaponSize: 6, fireRate: 28 },
];
ENEMIES.Prometheus.size = 7;

ENEMIES.Dominion.turrets = (function () {
  const positions = [[20,10],[40,10],[60,10],[80,10],[100,10],[20,40],[40,40],[60,40],[80,40],[100,40],[60,60]];
  const configs = [
    { weaponType: "ballistic_cannon", weaponSize: 7 },
    { weaponType: "ballistic_cannon", weaponSize: 5 },
    { weaponType: "ballistic_cannon", weaponSize: 5 },
    { weaponType: "ballistic_cannon", weaponSize: 5 },
    { weaponType: "laser_cannon",     weaponSize: 5 },
    { weaponType: "laser_cannon",     weaponSize: 3 },
    { weaponType: "laser_cannon",     weaponSize: 3 },
    { weaponType: "laser_repeater",   weaponSize: 3 },
    { weaponType: "laser_repeater",   weaponSize: 3 },
    { weaponType: "laser_repeater",   weaponSize: 3 },
    { weaponType: "laser_repeater",   weaponSize: 3 },
    { weaponType: "ballistic_railgun",   weaponSize: 3 },
    { weaponType: "ballistic_railgun",   weaponSize: 3 },
  ];
  return positions.map((p, i) => ({
    rx: p[0], ry: p[1],
    weaponType: configs[i].weaponType,
    weaponSize: configs[i].weaponSize,
    fireRate: i < 5 ? 16 : 10
  }));
})();
ENEMIES.Dominion.size = 8;
ENEMIES.Dominion.beamCooldownFrames = 480;
ENEMIES.Dominion.beamDamage = 1200;

ENEMIES.Dreadnaught.turrets = (function () {
  const positions = [
    [15,15],[15,50],[15,85],[15,120],
    [45,8], [45,60],[45,115],
    [75,8], [75,60],[75,115],
    [105,8],[105,60],[105,115],
    [135,15],[135,50],[135,85],[135,120],
    [165,25],[165,70],
    [30,5], [30,130],
    [90,5], [90,130],
    [150,5],[150,130],
  ];
  const configs = [
    {weaponType:"laser_cannon",     weaponSize:8},
    {weaponType:"laser_cannon",     weaponSize:8},
    {weaponType:"laser_cannon",     weaponSize:8},
    {weaponType:"laser_cannon",     weaponSize:8},
    {weaponType:"ballistic_cannon", weaponSize:8},
    {weaponType:"ballistic_cannon", weaponSize:8},
    {weaponType:"ballistic_cannon", weaponSize:8},
    {weaponType:"ballistic_cannon", weaponSize:8},
    {weaponType:"laser_cannon",     weaponSize:6},
    {weaponType:"laser_cannon",     weaponSize:6},
    {weaponType:"laser_repeater",   weaponSize:5},
    {weaponType:"laser_repeater",   weaponSize:5},
    {weaponType:"laser_repeater",   weaponSize:5},
    {weaponType:"laser_repeater",   weaponSize:5},
    {weaponType:"ballistic_cannon", weaponSize:7},
    {weaponType:"ballistic_cannon", weaponSize:7},
    {weaponType:"laser_cannon",     weaponSize:7},
    {weaponType:"laser_cannon",     weaponSize:7},
    {weaponType:"ballistic_railgun",weaponSize:4},
    {weaponType:"ballistic_railgun",weaponSize:4},
    {weaponType:"laser_repeater",   weaponSize:4},
    {weaponType:"laser_repeater",   weaponSize:4},
    {weaponType:"ballistic_gatling",weaponSize:5},
    {weaponType:"ballistic_gatling",weaponSize:5},
    {weaponType:"laser_repeater",   weaponSize:6},
    {weaponType:"laser_repeater",   weaponSize:6},
  ];
  return positions.map((p,i)=>({
    rx:p[0], ry:p[1],
    weaponType:configs[i].weaponType,
    weaponSize:configs[i].weaponSize,
    fireRate:i<8?18:i<16?12:8,
  }));
})();
ENEMIES.Dreadnaught.size = 16;
ENEMIES.Dreadnaught.beamCooldownFrames = 720;
ENEMIES.Dreadnaught.beamWarningFrames  = 180;
ENEMIES.Dreadnaught.beamDamage         = 999999;
ENEMIES.Dreadnaught.beamCount          = 3;
ENEMIES.Dreadnaught.beamSpread         = 0.28;

// Shadow Comet stats (fully upgraded Comet equivalent)
ENEMIES.ShadowComet.size = 1;
ENEMIES.ShadowComet.turrets = [];
ENEMIES.ShadowComet.dodgeChance = 0.55; // very hard to hit
ENEMIES.ShadowComet.isShadowComet = true;
ENEMIES.Healer.turrets = [
  { rx: 30, ry:  8, weaponType: "laser_cannon", weaponSize: 4, fireRate: 22 },
  { rx: 30, ry: 44, weaponType: "laser_cannon", weaponSize: 4, fireRate: 22 },
  { rx:  8, ry: 26, weaponType: "laser_repeater", weaponSize: 3, fireRate: 18 },
];
ENEMIES.Healer.size = 6;
ENEMIES.Healer.isHealer = true;
ENEMIES.Healer.healRadius = 280;
ENEMIES.Healer.healPerFrame = 8;


const MISSILE_TYPES = {
  1: { name: "Type 1 (Fast Strike)", speed: 8, damage: 400,  color: "#ff8800" },
  2: { name: "Type 2 (Standard)",    speed: 6, damage: 600,  color: "#ffaa44" },
  3: { name: "Type 3 (Warhead)",     speed: 4, damage: 1000, color: "#ff4444" },
};

const WAVES = [
  { reinforceDelay:4500, reinforceEnemies:["Raptor"], enemies: ["Raptor","Raptor","Raptor"],                                                                                          reward: 1000   },
  { reinforceDelay:4200, reinforceEnemies:["Raptor","Raptor"], enemies: ["Raptor","Raptor","Raptor","Raptor"],                                                                                 reward: 1500   },
  { reinforceDelay:3900, reinforceEnemies:["Raptor"], enemies: ["Raptor","Raptor","Raptor","Rouge"],                                                                                  reward: 2500   },
  { reinforceDelay:3900, reinforceEnemies:["Raptor","Raptor"], enemies: ["Rouge","Rouge","Raptor","Raptor"],                                                                                   reward: 3500   },
  { reinforceDelay:3600, reinforceEnemies:["Rouge"], enemies: ["Rouge","Rouge","Rouge","Raptor"],                                                                                    reward: 5000   },
  { reinforceDelay:3600, reinforceEnemies:["Rouge","Raptor"], enemies: ["Rouge","Rouge","Rouge","Raptor","Raptor","Raptor"],                                                                   reward: 7000   },
  { reinforceDelay:3300, reinforceEnemies:["Raptor","Raptor"], enemies: ["Corsair","Rouge","Raptor","Raptor"],                                                                                 reward: 9000   },
  { reinforceDelay:3300, reinforceEnemies:["Rouge","Raptor"], enemies: ["Corsair","Corsair","Rouge","Rouge","Raptor"],                                                                        reward: 12000  },
  { reinforceDelay:2700, reinforceEnemies:["Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor"], enemies: ["Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor","Raptor"], reward: 16000 },
  { reinforceDelay:3000, reinforceEnemies:["Corsair","Raptor"], enemies: ["Bulwark","Corsair","Rouge","Raptor"],                                                                                reward: 22000  },
  { reinforceDelay:3000, reinforceEnemies:["Corsair","Corsair"], enemies: ["Bulwark","Corsair","Corsair","Rouge","Rouge"],                                                                       reward: 28000  },
  // Wave 12: Shadow Comet boss fight
  { shadowCometWave: true, reinforceDelay:0, reinforceEnemies:[], enemies: [], reward: 35000 },
  { reinforceDelay:2700, reinforceEnemies:["Bulwark","Corsair"], enemies: ["Bulwark","Bulwark","Corsair","Corsair","Corsair","Rouge","Rouge"],                                                    reward: 44000  },
  { reinforceDelay:2400, reinforceEnemies:["Bulwark","Corsair","Corsair"], enemies: ["Bulwark","Bulwark","Bulwark","Corsair","Corsair","Rouge","Rouge","Raptor","Healer"],                                           reward: 55000  },
  { reinforceDelay:2400, reinforceEnemies:["Corsair","Corsair","Raptor"], enemies: ["Prometheus","Healer","Corsair","Corsair","Rouge","Rouge","Raptor","Raptor"],                                                   reward: 70000  },
  { reinforceDelay:2250, reinforceEnemies:["Bulwark","Corsair","Rouge"], enemies: ["Prometheus","Healer","Bulwark","Corsair","Corsair","Rouge","Raptor","Raptor"],                                                 reward: 85000  },
  { reinforceDelay:2100, reinforceEnemies:["Corsair","Corsair","Corsair"], enemies: ["Dominion","Corsair","Corsair","Corsair","Rouge","Rouge"],                                                             reward: 100000 },
  { reinforceDelay:2100, reinforceEnemies:["Bulwark","Bulwark","Corsair"], enemies: ["Dominion","Bulwark","Bulwark","Corsair","Rouge","Rouge","Rouge"],                                                     reward: 130000 },
  { reinforceDelay:1950, reinforceEnemies:["Bulwark","Corsair","Corsair"], enemies: ["Prometheus","Dominion","Bulwark","Corsair","Corsair","Corsair","Corsair"],                                            reward: 160000 },
  { reinforceDelay:1800, reinforceEnemies:["Dominion","Bulwark","Corsair","Corsair"], enemies: ["Dreadnaught","Bulwark","Bulwark","Corsair","Corsair","Corsair"],                                                     reward: 500000 },
];


const SHIP_SPECIALS = {
  Starlight:  { name:"Evasive Maneuver", cooldown:600,  duration:300, desc:"+50% dodge and speed boost for 5s." },
  Falcon:     { name:"Ghost Protocol",   cooldown:480,  duration:120, desc:"2 seconds of full invulnerability." },
  Rouge:      { name:"Suppression Burst",cooldown:600,  duration:180, desc:"All weapons fire at 3× RPM for 3s." },
  Marauder:   { name:"Damage Control",   cooldown:720,  duration:240, desc:"50% damage reduction for 4s." },
  Wasp:       { name:"Wingman",          cooldown:900,  duration:600, desc:"Summons your best ally as a temporary wingman for 10s." },
  Supernova:  { name:"Resupply Mode",    cooldown:600,  duration:360, desc:"Fire missiles free for 6s — or hold fire to restock some." },
  Bulwark:    { name:"Overshoot",        cooldown:720,  duration:300, desc:"All PDC turrets fire at double RPM for 5s." },
  Tempest:    { name:"Combat Medic",     cooldown:900,  duration:300, desc:"Repair pulse — heals you and all allies over 5s." },
  Nemesis:    { name:"Overclock",        cooldown:720,  duration:300, desc:"2× speed and −50% damage taken for 5s." },
  Prometheus: { name:"Torpedo Salvo",    cooldown:1800, duration:300, desc:"Fires 1/4 of missiles in sequence over 5s. No ammo cost." },
  Leviathan:  { name:"Fleet Vanguard",   cooldown:1800, duration:240, desc:"All allies: invincible + 2× RPM + 50% damage for 4s." },
  Dominion:   { name:"Overcharge",       cooldown:2700, duration:1,   desc:"Next railgun: instant, 3× damage, full pen. 45s cooldown." },
  Comet:      { name:"Ghost Mode",       cooldown:480,  duration:300, desc:"3× RPM, guns auto-aim, 100% dodge for 5s." },
  Vengeance:  { name:"Revenge",          cooldown:300,  duration:-1,  desc:"90% dodge, 2× dmg & speed. Costs 5hp/s. Toggle off to deactivate." },
};

// ── MISSILE KINDS ────────────────────────────────────────────
const MISSILE_KINDS = {
  standard: { name:"Standard",  slots:1,   aoe:0,    lockOn:true,  friendly:false, corrosion:false,
    desc:"Reliable homing missile." },
  emp:      { name:"EMP",       slots:1,   aoe:110,  lockOn:false, friendly:false, corrosion:false,
    desc:"Small AOE, strips shields and stuns. No lock-on." },
  cluster:  { name:"Cluster",   slots:1,   aoe:0,    lockOn:true,  friendly:false, corrosion:false,
    desc:"Splits into 4 mini-missiles on impact area." },
  nuke:     { name:"Nuke",      slots:5,   aoe:320,  lockOn:false, friendly:true,  corrosion:true,
    desc:"Massive AOE. Damages allies if in blast. Leaves 10s corrosion." },
  micro:    { name:"Micro",     slots:0.5, aoe:0,    lockOn:true,  friendly:false, corrosion:false,
    desc:"Half slot cost, half damage. Two fit per slot." },
};

const MISSILE_TYPE_MULT = { 1:0.7, 2:1.0, 3:1.5 };

// ── ARCHETYPE WEIGHTS per enemy type ────────────────────────
const ARCHETYPE_POOL = {
  Raptor:  ["skirmisher","bruiser","adaptive","flanker","interceptor","packhunter","suppressor"],
  Rouge:   ["skirmisher","bruiser","adaptive","interceptor","suppressor"],
  Corsair: ["bruiser","adaptive","flanker","interceptor","packhunter"],
  Sprite:  ["skirmisher","adaptive"],
};
const ARCHETYPE_LABEL = {
  skirmisher:"SK", bruiser:"BR", adaptive:"AD",
  interceptor:"IC", flanker:"FL", packhunter:"PH", suppressor:"SU",
};
const ARCHETYPE_COLOR = {
  skirmisher:"#88ccff", bruiser:"#ff6644", adaptive:"#cc88ff",
  interceptor:"#ff4488", flanker:"#ffcc44", packhunter:"#ff8800", suppressor:"#44ffcc",
};

function generateInfiniteWave(waveNum) {
  // Check if this is a Shadow Comet wave (every X2: 12, 22, 32, ...)
  if (waveNum >= 12 && waveNum % 10 === 2) {
    return { shadowCometWave: true, enemies: [], reward: waveNum * 2000 };
  }
  const pool =
  waveNum < 5  ? ["Raptor"] :
  waveNum < 8  ? ["Raptor","Rouge"] :
  waveNum < 12 ? ["Raptor","Rouge","Corsair"] :
  waveNum < 18 ? ["Rouge","Corsair","Bulwark"] :
  waveNum < 25 ? ["Corsair","Bulwark","Prometheus","Dominion"] :
  ["Bulwark","Prometheus","Dominion"];
  const count = Math.floor(waveNum / 4 + 2) * 2;
  const enemies = [];
  for (let i = 0; i < count; i++) enemies.push(pool[Math.floor(Math.random() * pool.length)]);
  if (waveNum % 8  === 0) enemies.push("Bulwark");
  if (waveNum % 15 === 0) enemies.push("Dominion");
  if (waveNum % 25 === 0) enemies.push("Dreadnaught");
  return { enemies, reward: waveNum * 1500 };
}

// How many times has Shadow Comet been beaten (for infinite mode scaling)
// This is tracked in game.js via shadowCometKills
function getShadowCometStats(killCount) {
  const scaleMult = Math.pow(1.5, killCount);
  const base = ENEMIES.ShadowComet;
  return {
    ...base,
    hp:     Math.round(base.hp     * scaleMult),
    shields:Math.round(base.shields* scaleMult),
    speed:  Math.min(12, base.speed * scaleMult), // cap speed so it doesn't get insane
    damage: scaleMult, // multiplier applied to weapon damage in game.js
  };
}
