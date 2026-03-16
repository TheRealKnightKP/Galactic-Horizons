// ============================================================
// universe_saves.js — Phase 0.2: Save/Load System
// IndexedDB-backed, seed-based world storage
// ============================================================

// ── DATABASE SETUP ────────────────────────────────────────────
const UNI_DB_NAME = "GalacticHorizonsUniverse";
const UNI_DB_VERSION = 1;
const UNI_STORE_NAME = "worlds";
let _uniDB = null;

function openUniverseDB() {
  return new Promise((resolve, reject) => {
    if (_uniDB) { resolve(_uniDB); return; }
    const req = indexedDB.open(UNI_DB_NAME, UNI_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(UNI_STORE_NAME)) {
        const store = db.createObjectStore(UNI_STORE_NAME, { keyPath: "worldId" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
    };
    req.onsuccess = (e) => { _uniDB = e.target.result; resolve(_uniDB); };
    req.onerror = (e) => { console.error("IndexedDB open failed:", e); reject(e); };
  });
}

// ── HELPER: Generate unique world ID ──────────────────────────
function generateWorldId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return "w_" + ts + "_" + rand;
}

// ── HELPER: Generate master seed ──────────────────────────────
function generateMasterSeed() {
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}

// ── CREATE NEW WORLD ──────────────────────────────────────────
// Generates a fresh world with a random seed. Saves initial state.
// Returns the world save object.

async function createNewWorld(worldName) {
  const db = await openUniverseDB();
  const worldId = generateWorldId();
  const masterSeed = generateMasterSeed();

  const world = {
    worldId: worldId,
    masterSeed: masterSeed,
    name: worldName || "New World",
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
    playTime: 0,
    saveVersion: "0.1",

    // Player state — fresh start
    player: {
      credits: 1000,
      factionRep: { warden: 0, harvester: 0, eldritch: 0 },
      joinedFaction: null,
      crimestat: 0,
      currentSystemId: "solara",
      currentAreaId: null,
      currentQuadrantId: null,
      ownedShips: [
        {
          id: "ship_0",
          key: "Starlight",
          fuel: 50,       // starts full (Starlight fuelMax = 50)
          cargo: [],      // [{ commodity, quantity }]
          hp: null,       // null = full, set on damage
          shields: null,
          armor: null,
        }
      ],
      activeShipIdx: 0,
      allies: [],
      activeMissions: [],
      completedMissionIds: [],
      discoveredPOIs: [],
      inventory: {},
    },

    // Delta changes — starts empty, grows as player affects the world
    deltas: [],

    // Active NPC events — starts empty
    activeEvents: [],

    // Faction influence overrides — only stores systems that changed from default
    // Default values come from SYSTEM_DEFS[sysId].defaultFaction
    factionInfluence: {},

    // Sun health overrides — only stores systems that changed from default
    sunHealth: {},
  };

  // Write to IndexedDB
  return new Promise((resolve, reject) => {
    const tx = db.transaction(UNI_STORE_NAME, "readwrite");
    const store = tx.objectStore(UNI_STORE_NAME);
    const req = store.put(world);
    req.onsuccess = () => { resolve(world); };
    req.onerror = (e) => { console.error("Create world failed:", e); reject(e); };
  });
}

// ── SAVE WORLD ────────────────────────────────────────────────
// Writes the current world state to IndexedDB.
// Call this on: quantum travel, docking, mission complete, manual save,
// page close (visibilitychange/pagehide).

async function saveWorld(world) {
  if (!world || !world.worldId) { console.warn("saveWorld: no world to save"); return false; }
  const db = await openUniverseDB();
  world.lastPlayedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(UNI_STORE_NAME, "readwrite");
    const store = tx.objectStore(UNI_STORE_NAME);
    const req = store.put(world);
    req.onsuccess = () => { resolve(true); };
    req.onerror = (e) => { console.error("Save world failed:", e); reject(false); };
  });
}

// ── LOAD WORLD ────────────────────────────────────────────────
// Reads a world from IndexedDB by worldId.
// After loading, the caller should regenerate the universe from
// masterSeed and apply deltas.

async function loadWorld(worldId) {
  const db = await openUniverseDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(UNI_STORE_NAME, "readonly");
    const store = tx.objectStore(UNI_STORE_NAME);
    const req = store.get(worldId);
    req.onsuccess = (e) => {
      const world = e.target.result;
      if (!world) { resolve(null); return; }
      resolve(world);
    };
    req.onerror = (e) => { console.error("Load world failed:", e); reject(null); };
  });
}

// ── LIST ALL WORLDS ───────────────────────────────────────────
// Returns array of { worldId, name, createdAt, lastPlayedAt, playTime }
// for the world select screen. Sorted by lastPlayedAt descending.

async function listWorlds() {
  const db = await openUniverseDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(UNI_STORE_NAME, "readonly");
    const store = tx.objectStore(UNI_STORE_NAME);
    const req = store.getAll();
    req.onsuccess = (e) => {
      const worlds = (e.target.result || []).map(w => ({
        worldId: w.worldId,
        name: w.name,
        createdAt: w.createdAt,
        lastPlayedAt: w.lastPlayedAt,
        playTime: w.playTime,
        masterSeed: w.masterSeed,
        playerCredits: w.player?.credits || 0,
        playerSystem: w.player?.currentSystemId || "unknown",
        playerFaction: w.player?.joinedFaction || "none",
      }));
      worlds.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
      resolve(worlds);
    };
    req.onerror = (e) => { console.error("List worlds failed:", e); reject([]); };
  });
}

// ── DELETE WORLD ──────────────────────────────────────────────
async function deleteWorld(worldId) {
  const db = await openUniverseDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(UNI_STORE_NAME, "readwrite");
    const store = tx.objectStore(UNI_STORE_NAME);
    const req = store.delete(worldId);
    req.onsuccess = () => { resolve(true); };
    req.onerror = (e) => { console.error("Delete world failed:", e); reject(false); };
  });
}

// ── DELTA MANAGEMENT ──────────────────────────────────────────
// Deltas track what changed from the seed-generated default.
// Each delta is a compact object: { t: target, k: key, v: value }
//
// Examples:
//   { t:"solara:haven:q1:ast_3",       k:"depleted",     v:true }
//   { t:"solara:ironhold:station_1",    k:"iron.stock",   v:-50 }
//   { t:"sys:thornreach",               k:"factionInf.harvester", v:72 }
//   { t:"poi:kestrel:dusthaven:cave_4", k:"discovered",   v:true }
//
// On load, deltas are applied sequentially on top of seed-generated state.
// New deltas for the same target+key overwrite old ones (compacted on save).

function addDelta(world, target, key, value) {
  if (!world || !world.deltas) return;
  // Check if this target+key already exists — overwrite if so
  const existing = world.deltas.findIndex(d => d.t === target && d.k === key);
  if (existing >= 0) {
    world.deltas[existing].v = value;
  } else {
    world.deltas.push({ t: target, k: key, v: value });
  }
}

function getDelta(world, target, key) {
  if (!world || !world.deltas) return undefined;
  const d = world.deltas.find(d => d.t === target && d.k === key);
  return d ? d.v : undefined;
}

function hasDelta(world, target, key) {
  if (!world || !world.deltas) return false;
  return world.deltas.some(d => d.t === target && d.k === key);
}

// Compact deltas — remove duplicates, keep only latest value per target+key
// Call this periodically or before save to keep delta list clean
function compactDeltas(world) {
  if (!world || !world.deltas) return;
  const seen = new Map();
  // Walk backwards so latest entry wins
  for (let i = world.deltas.length - 1; i >= 0; i--) {
    const d = world.deltas[i];
    const dk = d.t + "|" + d.k;
    if (!seen.has(dk)) {
      seen.set(dk, d);
    }
  }
  world.deltas = Array.from(seen.values()).reverse();
}

// ── WORLD REGENERATION ────────────────────────────────────────
// Rebuilds the live game state from a saved world.
// 1. Takes the masterSeed
// 2. Regenerates all system/area/quadrant content deterministically
// 3. Applies deltas on top
// 4. Returns a ready-to-play universe state object

function regenerateUniverse(world) {
  if (!world || !world.masterSeed) { console.error("No world to regenerate"); return null; }

  const masterSeed = world.masterSeed;
  const universe = {
    systems: {},
    player: { ...world.player },
    activeEvents: [...(world.activeEvents || [])],
  };

  // Regenerate each system from SYSTEM_DEFS + seed
  for (const [sysId, def] of Object.entries(typeof SYSTEM_DEFS !== "undefined" ? SYSTEM_DEFS : {})) {
    const systemSeed = deriveEntitySeed(masterSeed, sysId);
    const rng = seededRNG(systemSeed);

    const system = {
      id: sysId,
      name: def.name,
      desc: def.desc,
      faction: def.defaultFaction,
      sunHealth: def.sunHealth,
      connections: [...def.connections],
      dangerLevel: def.dangerLevel,
      areas: {},
    };

    // Override faction influence if delta exists
    if (world.factionInfluence && world.factionInfluence[sysId]) {
      system.factionInfluence = { ...world.factionInfluence[sysId] };
    }
    // Override sun health if delta exists
    if (world.sunHealth && world.sunHealth[sysId] !== undefined) {
      system.sunHealth = world.sunHealth[sysId];
    }

    // Regenerate areas
    for (const areaDef of def.areas) {
      const areaSeed = deriveEntitySeed(systemSeed, areaDef.id);
      const areaRng = seededRNG(areaSeed);

      const area = {
        id: areaDef.id,
        name: areaDef.name,
        type: areaDef.type,
        biome: areaDef.biome || null,
        fixed: areaDef.fixed || false,
        parent: areaDef.parent || null,
        targetSystem: areaDef.targetSystem || null,
        quadrants: [],
      };

      // Generate quadrants for this area
      if (areaDef.type === "wormhole") {
        // Wormhole gets one tunnel quadrant
        area.quadrants.push({
          id: areaDef.id + "_tunnel",
          type: "wormhole_tunnel",
          name: areaDef.name,
          seed: areaSeed,
          fixed: true,
          fromSystem: sysId,
          toSystem: areaDef.targetSystem,
          difficulty: Math.min(5, Math.max(1, Math.ceil(def.dangerLevel * 0.8))),
        });
      } else if (areaDef.type === "sun") {
        // Sun gets one hazard zone quadrant
        area.quadrants.push({
          id: areaDef.id + "_zone",
          type: "sun_zone",
          name: areaDef.name,
          seed: areaSeed,
          fixed: true,
        });
      } else if (areaDef.type === "planet" || areaDef.type === "moon") {
        // Planets/moons get: 1 station quadrant (fixed), 3-5 seed-generated quadrants
        area.quadrants.push({
          id: areaDef.id + "_station",
          type: "station",
          name: areaDef.name + " Station",
          seed: deriveEntitySeed(areaSeed, "station"),
          fixed: true,
          station: {
            id: areaDef.id + "_st",
            name: areaDef.name + " Station",
            faction: system.faction,
            services: {
              hasTrading: true,
              hasMissions: true,
              hasShipyard: areaDef.biome !== "barren",
              hasRefuel: true,
              hasRepair: true,
            },
            districts: ["trading_post", "mission_board", "shipyard", "repair_bay", "cantina"],
          },
        });

        // Seed-generated quadrants around the planet
        const quadCount = 3 + Math.floor(areaRng() * 3); // 3-5
        const possibleTypes = ["mining", "patrol", "open", "debris", "open"];
        for (let qi = 0; qi < quadCount; qi++) {
          const qSeed = deriveEntitySeed(areaSeed, qi);
          const qType = possibleTypes[Math.floor(areaRng() * possibleTypes.length)];
          area.quadrants.push({
            id: areaDef.id + "_q" + qi,
            type: qType,
            name: areaDef.name + " Sector " + (qi + 1),
            seed: qSeed,
            fixed: false,
          });
        }
      } else if (areaDef.type === "belt") {
        // Belts get: 4-6 mining/debris/open quadrants, all seed-generated
        const quadCount = 4 + Math.floor(areaRng() * 3); // 4-6
        const beltTypes = ["mining", "mining", "debris", "open", "patrol", "mining"];
        for (let qi = 0; qi < quadCount; qi++) {
          const qSeed = deriveEntitySeed(areaSeed, qi);
          const qType = beltTypes[Math.floor(areaRng() * beltTypes.length)];
          area.quadrants.push({
            id: areaDef.id + "_q" + qi,
            type: qType,
            name: areaDef.name + " Field " + (qi + 1),
            seed: qSeed,
            fixed: false,
          });
        }
      } else if (areaDef.type === "anomaly") {
        // Anomalies get: 1-2 special quadrants
        area.quadrants.push({
          id: areaDef.id + "_core",
          type: "mission",
          name: areaDef.name,
          seed: areaSeed,
          fixed: areaDef.fixed || false,
        });
        if (areaRng() > 0.4) {
          area.quadrants.push({
            id: areaDef.id + "_outer",
            type: "debris",
            name: areaDef.name + " Outskirts",
            seed: deriveEntitySeed(areaSeed, 1),
            fixed: false,
          });
        }
      }

      system.areas[areaDef.id] = area;
    }

    universe.systems[sysId] = system;
  }

  // Apply deltas
  // Deltas modify specific values in the regenerated state
  // For now, deltas are stored and applied by game logic at runtime
  // (station stock changes, POI discovery, asteroid depletion, etc.)
  universe._deltas = world.deltas || [];

  return universe;
}

// ── QUADRANT CONTENT GENERATION ───────────────────────────────
// Generates the actual contents of a quadrant when the player enters it.
// Only called for the quadrant being loaded — not all at once.

function generateQuadrantContents(quadrant, systemDanger) {
  if (!quadrant || !quadrant.seed) return {};
  const rng = seededRNG(quadrant.seed);
  const contents = { asteroids: [], pois: [], patrolSpawns: [] };

  // Asteroids (for mining and debris quadrants)
  if (quadrant.type === "mining" || quadrant.type === "debris") {
    const orePool = quadrant.type === "mining"
      ? ["iron", "iron", "copper", "titanium", "gold", "quantanium"]
      : ["scrap", "scrap", "iron", "electronics", "polymers"];
    const count = 8 + Math.floor(rng() * 12); // 8-19 asteroids
    for (let i = 0; i < count; i++) {
      const ore = orePool[Math.floor(rng() * orePool.length)];
      contents.asteroids.push({
        id: "ast_" + i,
        x: 80 + rng() * 1120,  // within 1280 width, with margin
        y: 60 + rng() * 600,   // within 720 height, with margin
        oreType: ore,
        health: 50 + Math.floor(rng() * 100),
        maxHealth: 50 + Math.floor(rng() * 100),
        depleted: false,
      });
    }
  }

  // POIs (for non-station, non-wormhole quadrants)
  if (quadrant.type !== "station" && quadrant.type !== "wormhole_tunnel" && quadrant.type !== "sun_zone") {
    const poiChance = quadrant.type === "debris" ? 0.6 : 0.3;
    if (rng() < poiChance) {
      const poiTypes = ["crashed_ship", "abandoned_cargo", "data_cache", "distress_signal"];
      contents.pois.push({
        id: "poi_" + Math.floor(rng() * 10000),
        x: 200 + rng() * 880,
        y: 150 + rng() * 420,
        type: poiTypes[Math.floor(rng() * poiTypes.length)],
        discovered: false,
        looted: false,
      });
    }
  }

  // Patrol spawns (for patrol and station quadrants)
  if (quadrant.type === "patrol" || quadrant.type === "station" || quadrant.type === "mission") {
    const patrolKeys = Object.keys(typeof PATROL_TEMPLATES !== "undefined" ? PATROL_TEMPLATES : {});
    const validPatrols = patrolKeys.filter(k => {
      const p = PATROL_TEMPLATES[k];
      return p.dangerMin <= (systemDanger || 1);
    });
    if (validPatrols.length > 0 && rng() < 0.7) {
      const patrolKey = validPatrols[Math.floor(rng() * validPatrols.length)];
      contents.patrolSpawns.push({
        templateKey: patrolKey,
        x: 600 + rng() * 500,
        y: 100 + rng() * 520,
        aggroRange: 250 + Math.floor(rng() * 150),
      });
    }
  }

  return contents;
}

// ── WORMHOLE GENERATION ───────────────────────────────────────
// Generates obstacle pillars for a wormhole tunnel.

function generateWormholeObstacles(seed, difficulty, length) {
  const rng = seededRNG(seed);
  const pillars = [];
  const density = 0.3 + difficulty * 0.15; // more pillars at higher difficulty
  const count = Math.floor(length * density);

  for (let i = 0; i < count; i++) {
    pillars.push({
      x: 100 + rng() * 1080,                          // lateral position
      z: (i / count) * length,                         // depth position along tunnel
      width: 30 + Math.floor(rng() * (40 + difficulty * 20)),   // pillar width
      height: 60 + Math.floor(rng() * (80 + difficulty * 30)),  // pillar height
      speed: 0,                                        // some could drift laterally later
    });
  }

  return pillars;
}

// ── AUTO-SAVE TRIGGERS ────────────────────────────────────────
// Universe auto-saves on these events:
// - Quantum travel (after arriving at new quadrant)
// - Docking at a station
// - Completing or failing a mission
// - Buying/selling at a trading post
// - Page close (beforeunload / pagehide / visibilitychange)
// These are called from universe.js game logic — not wired yet.

let _currentUniWorld = null; // reference to the active world in memory

function setCurrentWorld(world) {
  _currentUniWorld = world;
}

function getCurrentWorld() {
  return _currentUniWorld;
}

async function autoSaveUniverse() {
  if (!_currentUniWorld) return;
  compactDeltas(_currentUniWorld);
  await saveWorld(_currentUniWorld);
}

// Auto-save on page close (same pattern as Arena)
function _uniExitSave() {
  if (!_currentUniWorld) return;
  compactDeltas(_currentUniWorld);
  // Synchronous fallback — IndexedDB doesn't support sendBeacon
  // but we can do a sync write attempt
  try {
    const tx = _uniDB?.transaction(UNI_STORE_NAME, "readwrite");
    if (tx) {
      const store = tx.objectStore(UNI_STORE_NAME);
      _currentUniWorld.lastPlayedAt = Date.now();
      store.put(_currentUniWorld);
    }
  } catch (e) { /* best effort */ }
}

window.addEventListener("beforeunload", _uniExitSave);
window.addEventListener("pagehide", _uniExitSave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") _uniExitSave();
});

// ── COMMODITY STOCK MANAGEMENT ────────────────────────────────
// Station commodity stocks are seed-generated, then modified by deltas.
// When player buys/sells, we record the change as a delta.

function getStationStock(world, stationId, commodityKey) {
  // Check delta first
  const deltaVal = getDelta(world, stationId, commodityKey + ".stock");
  if (deltaVal !== undefined) return deltaVal;
  // Otherwise generate from seed
  const stationSeed = deriveEntitySeed(world.masterSeed, stationId, commodityKey);
  const rng = seededRNG(stationSeed);
  const def = (typeof COMMODITY_DEFS !== "undefined" ? COMMODITY_DEFS : {})[commodityKey];
  if (!def) return 0;
  const baseStock = def.rarity === "common" ? 100 + Math.floor(rng() * 200)
                  : def.rarity === "uncommon" ? 30 + Math.floor(rng() * 70)
                  : 5 + Math.floor(rng() * 20);
  return baseStock;
}

function modifyStationStock(world, stationId, commodityKey, change) {
  const current = getStationStock(world, stationId, commodityKey);
  const newStock = Math.max(0, current + change);
  addDelta(world, stationId, commodityKey + ".stock", newStock);
  return newStock;
}

// ── PLAY TIME TRACKING ────────────────────────────────────────
let _uniPlayTimeInterval = null;

function startPlayTimeTracking() {
  if (_uniPlayTimeInterval) clearInterval(_uniPlayTimeInterval);
  _uniPlayTimeInterval = setInterval(() => {
    if (_currentUniWorld) _currentUniWorld.playTime += 1;
  }, 1000);
}

function stopPlayTimeTracking() {
  if (_uniPlayTimeInterval) { clearInterval(_uniPlayTimeInterval); _uniPlayTimeInterval = null; }
}
