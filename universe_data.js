// ============================================================
// universe_data.js — Phase 0.1: Data Schema
// STATUS: DESIGN ONLY — NOT WIRED TO ANYTHING YET
// ============================================================

// ── SEED-BASED GENERATION ─────────────────────────────────────
// Master seed generates the universe. Each entity derives its own
// seed for deterministic regeneration. Save files store ONLY the
// master seed + a delta list of player-caused changes.
//
// IMPORTANT: Not everything is seed-generated.
// FIXED (same every world): system names, system connections,
//   planet/moon names, biomes, station locations, outpost locations,
//   sun areas, wormhole gates, faction capitals, area definitions.
// SEED-GENERATED (varies per world): asteroid field layouts, POI
//   placements in non-fixed areas, resource distribution, NPC
//   starting positions, commodity stock amounts, patrol routes.

function seededRNG(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function deriveEntitySeed(masterSeed, ...ids) {
  let h = masterSeed;
  for (const id of ids) {
    if (typeof id === "string") {
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    } else {
      h = (h * 2654435761 + id) >>> 0;
    }
  }
  return h;
}

// ── WORLD STRUCTURE ───────────────────────────────────────────
// Universe > Systems > Areas > Quadrants
// Systems connect via Wormholes (playable obstacle course sections)
// Grid-like connectivity on the starmap

const WORLD_TEMPLATE = {
  masterSeed: 0,
  name: "",
  createdAt: 0,
  playTime: 0,

  player: {
    credits: 1000,
    factionRep: { warden: 0, harvester: 0, eldritch: 0 },
    joinedFaction: null,
    crimestat: 0,
    currentSystemId: "solara",
    currentAreaId: null,
    currentQuadrantId: null,
    ownedShips: [],
    activeShipIdx: 0,
    allies: [],
    activeMissions: [],
    discoveredPOIs: [],
    inventory: {},
  },

  deltas: [],
};

// ── SYSTEMS ───────────────────────────────────────────────────
// ALL system definitions are FIXED — names, connections, areas,
// faction defaults, danger levels. These never change between worlds.
// Only seed-generated content within quadrants varies per world.

const SYSTEM_DEFS = {
  // === CIVILIAN SYSTEMS (Warden-patrolled) ===
  solara: {
    name: "Solara",
    desc: "The heart of civilized space. Central trade hub, well-patrolled by Wardens.",
    defaultFaction: "civilian",
    sunHealth: 100,
    connections: ["ashfall", "meridian"],
    areas: [
      // FIXED areas — these exist in every world, same positions
      { id: "solara_sun",     type: "sun",      name: "Solara Star",       fixed: true },
      { id: "haven",          type: "planet",   name: "Haven",             biome: "temperate",    fixed: true },
      { id: "haven_m1",       type: "moon",     name: "Lux",              biome: "barren",       fixed: true, parent: "haven" },
      { id: "ironhold",       type: "planet",   name: "Ironhold",          biome: "industrial",   fixed: true },
      { id: "solara_belt",    type: "belt",     name: "Solara Ring",       biome: "asteroid" },
      { id: "wh_ashfall",     type: "wormhole", name: "Ashfall Conduit",   targetSystem: "ashfall",  fixed: true },
      { id: "wh_meridian",    type: "wormhole", name: "Meridian Gate",     targetSystem: "meridian", fixed: true },
    ],
    dangerLevel: 1,
  },

  meridian: {
    name: "Meridian",
    desc: "Thriving colony system. Strong Warden presence, active shipyards.",
    defaultFaction: "civilian",
    sunHealth: 100,
    connections: ["solara", "kestrel", "duskfall"],
    areas: [
      { id: "meridian_sun",   type: "sun",      name: "Meridian Star",     fixed: true },
      { id: "arcadia",        type: "planet",   name: "Arcadia",           biome: "oceanic",      fixed: true },
      { id: "forge",          type: "planet",   name: "Forge",             biome: "volcanic",     fixed: true },
      { id: "meridian_belt",  type: "belt",     name: "Shardfield",        biome: "asteroid" },
      { id: "wh_solara",      type: "wormhole", name: "Solara Gate",       targetSystem: "solara",   fixed: true },
      { id: "wh_kestrel",     type: "wormhole", name: "Kestrel Passage",   targetSystem: "kestrel",  fixed: true },
      { id: "wh_duskfall",    type: "wormhole", name: "Duskfall Rift",     targetSystem: "duskfall",  fixed: true },
    ],
    dangerLevel: 1,
  },

  kestrel: {
    name: "Kestrel",
    desc: "Frontier system. Rich mining but thin patrols. Opportunists thrive here.",
    defaultFaction: "civilian",
    sunHealth: 100,
    connections: ["meridian", "thornreach"],
    areas: [
      { id: "kestrel_sun",    type: "sun",      name: "Kestrel Star",      fixed: true },
      { id: "dusthaven",      type: "planet",   name: "Dusthaven",         biome: "desert",       fixed: true },
      { id: "kestrel_belt",   type: "belt",     name: "Goldrush Belt",     biome: "asteroid" },
      { id: "kestrel_belt2",  type: "belt",     name: "Outer Fragments",   biome: "asteroid" },
      { id: "wh_meridian",    type: "wormhole", name: "Meridian Gate",     targetSystem: "meridian",    fixed: true },
      { id: "wh_thornreach",  type: "wormhole", name: "Thornreach Scar",   targetSystem: "thornreach",  fixed: true },
    ],
    dangerLevel: 2,
  },

  ashfall: {
    name: "Ashfall",
    desc: "Lawless border system. No permanent Warden presence. Rich but dangerous.",
    defaultFaction: "civilian",
    sunHealth: 100,
    connections: ["solara", "duskfall", "char"],
    areas: [
      { id: "ashfall_sun",    type: "sun",      name: "Ashfall Star",      fixed: true },
      { id: "cinderrock",     type: "planet",   name: "Cinderrock",        biome: "scorched",     fixed: true },
      { id: "ashfall_ruin",   type: "anomaly",  name: "Derelict Yards",    biome: "derelict" },
      { id: "ashfall_belt",   type: "belt",     name: "Ashfall Drift",     biome: "asteroid" },
      { id: "wh_solara",      type: "wormhole", name: "Solara Conduit",    targetSystem: "solara",   fixed: true },
      { id: "wh_duskfall",    type: "wormhole", name: "Duskfall Tear",     targetSystem: "duskfall",  fixed: true },
      { id: "wh_char",        type: "wormhole", name: "Char Gate",         targetSystem: "char",      fixed: true },
    ],
    dangerLevel: 3,
  },

  // === CONTESTED / BORDER SYSTEMS ===
  duskfall: {
    name: "Duskfall",
    desc: "Border system between civilian space and Harvester territory. Tense and profitable.",
    defaultFaction: "civilian",
    sunHealth: 85,
    connections: ["meridian", "ashfall", "thornreach", "char"],
    areas: [
      { id: "duskfall_sun",   type: "sun",      name: "Duskfall Star",     fixed: true },
      { id: "twilight",       type: "planet",   name: "Twilight",          biome: "tundra",       fixed: true },
      { id: "duskfall_belt",  type: "belt",     name: "Dimfield",          biome: "asteroid" },
      { id: "wh_meridian",    type: "wormhole", name: "Meridian Gate",     targetSystem: "meridian",    fixed: true },
      { id: "wh_ashfall",     type: "wormhole", name: "Ashfall Tear",      targetSystem: "ashfall",     fixed: true },
      { id: "wh_thornreach",  type: "wormhole", name: "Thornreach Gate",   targetSystem: "thornreach",  fixed: true },
      { id: "wh_char",        type: "wormhole", name: "Char Passage",      targetSystem: "char",        fixed: true },
    ],
    dangerLevel: 3,
  },

  // === HARVESTER SYSTEMS ===
  thornreach: {
    name: "Thornreach",
    desc: "Harvester frontier. Bone-ships patrol the lanes. The sun burns dim.",
    defaultFaction: "harvester",
    sunHealth: 65,
    connections: ["kestrel", "duskfall", "marrow"],
    areas: [
      { id: "thornreach_sun", type: "sun",      name: "Thornreach Star",   fixed: true },
      { id: "spireworld",     type: "planet",   name: "Spireworld",        biome: "harvester_city",  fixed: true },
      { id: "thornreach_belt",type: "belt",     name: "Thorn Belt",        biome: "asteroid" },
      { id: "suneater_alpha", type: "anomaly",  name: "Suneater Alpha",    biome: "sun_harvester",   fixed: true },
      { id: "wh_kestrel",     type: "wormhole", name: "Kestrel Gate",      targetSystem: "kestrel",   fixed: true },
      { id: "wh_duskfall",    type: "wormhole", name: "Duskfall Gate",     targetSystem: "duskfall",  fixed: true },
      { id: "wh_marrow",      type: "wormhole", name: "Marrow Rift",       targetSystem: "marrow",    fixed: true },
    ],
    dangerLevel: 4,
  },

  marrow: {
    name: "Marrow",
    desc: "Deep Harvester space. Their capital. Cities built from bone and sun-fire.",
    defaultFaction: "harvester",
    sunHealth: 45,
    connections: ["thornreach", "char", "hollow"],
    areas: [
      { id: "marrow_sun",     type: "sun",      name: "Marrow Star",       fixed: true },
      { id: "ostara",         type: "planet",   name: "Ostara",            biome: "harvester_city",  fixed: true },
      { id: "boneyards",      type: "belt",     name: "Bone Yards",        biome: "asteroid" },
      { id: "suneater_prime", type: "anomaly",  name: "Suneater Prime",    biome: "sun_harvester",   fixed: true },
      { id: "wh_thornreach",  type: "wormhole", name: "Thornreach Rift",   targetSystem: "thornreach", fixed: true },
      { id: "wh_char",        type: "wormhole", name: "Char Wound",        targetSystem: "char",       fixed: true },
      { id: "wh_hollow",      type: "wormhole", name: "Hollow Gate",       targetSystem: "hollow",     fixed: true },
    ],
    dangerLevel: 4,
  },

  // === ELDRITCH SYSTEMS ===
  char: {
    name: "Char",
    desc: "Contested hellscape. Harvester and Eldritch forces clash over a dying sun.",
    defaultFaction: "eldritch",
    sunHealth: 30,
    connections: ["ashfall", "duskfall", "marrow", "hollow"],
    areas: [
      { id: "char_sun",       type: "sun",      name: "Char Star",         fixed: true },
      { id: "scorchworld",    type: "planet",   name: "Scorchworld",       biome: "corrupted",    fixed: true },
      { id: "char_debris",    type: "anomaly",  name: "War Debris Field",  biome: "derelict" },
      { id: "wh_ashfall",     type: "wormhole", name: "Ashfall Gate",      targetSystem: "ashfall",   fixed: true },
      { id: "wh_duskfall",    type: "wormhole", name: "Duskfall Passage",  targetSystem: "duskfall",  fixed: true },
      { id: "wh_marrow",      type: "wormhole", name: "Marrow Wound",      targetSystem: "marrow",    fixed: true },
      { id: "wh_hollow",      type: "wormhole", name: "Hollow Rift",       targetSystem: "hollow",    fixed: true },
    ],
    dangerLevel: 5,
  },

  hollow: {
    name: "Hollow",
    desc: "Eldritch heartland. The sun is nearly consumed. A black hole forms.",
    defaultFaction: "eldritch",
    sunHealth: 10,
    connections: ["marrow", "char"],
    areas: [
      { id: "hollow_sun",     type: "sun",      name: "The Dying Light",   fixed: true },
      { id: "voidworld",      type: "planet",   name: "Voidworld",         biome: "corrupted",      fixed: true },
      { id: "black_maw",      type: "anomaly",  name: "The Black Maw",     biome: "eldritch_core",  fixed: true },
      { id: "suneater_void",  type: "anomaly",  name: "Void Suneater",     biome: "sun_harvester",  fixed: true },
      { id: "wh_marrow",      type: "wormhole", name: "Marrow Gate",       targetSystem: "marrow",  fixed: true },
      { id: "wh_char",        type: "wormhole", name: "Char Rift",         targetSystem: "char",    fixed: true },
    ],
    dangerLevel: 5,
  },

  // TODO: Expand to 30 systems post-Phase 2
  // Additional civilian, harvester, eldritch, and contested systems
};

// ── AREA TYPES ────────────────────────────────────────────────
const AREA_TYPES = {
  planet:   { hasLanding: true,  hasMoons: true,  desc: "Planetary body with potential outposts" },
  moon:     { hasLanding: true,  hasMoons: false,  desc: "Moon — smaller, in parent planet's area" },
  belt:     { hasLanding: false, hasMoons: false,  desc: "Asteroid belt — mining zone" },
  anomaly:  { hasLanding: false, hasMoons: false,  desc: "Special location — derelict, suneater, etc." },
  sun:      { hasLanding: false, hasMoons: false,  desc: "System star — affected by harvesting" },
  wormhole: { hasLanding: false, hasMoons: false,  desc: "Inter-system wormhole — playable obstacle course" },
};

// ── QUADRANT GENERATION ───────────────────────────────────────
// Fixed areas (stations, outposts, sun, wormhole gates) generate
// fixed quadrants that exist in every world.
// Non-fixed areas (belts, some anomalies) generate seed-based
// quadrants that vary per world.
// Average 4-6 quadrants per area.

const QUADRANT_TYPES = {
  station:         { hasStation: true,  hasAsteroids: false, hasPatrols: false, fixed: true,  desc: "Space station and surrounding area" },
  outpost:         { hasStation: true,  hasAsteroids: false, hasPatrols: false, fixed: true,  desc: "Planetary ground outpost" },
  mining:          { hasStation: false, hasAsteroids: true,  hasPatrols: false, fixed: false, desc: "Asteroid mining field" },
  patrol:          { hasStation: false, hasAsteroids: false, hasPatrols: true,  fixed: false, desc: "Patrol route — combat likely" },
  open:            { hasStation: false, hasAsteroids: false, hasPatrols: false, fixed: false, desc: "Open space — player can build here" },
  mission:         { hasStation: false, hasAsteroids: false, hasPatrols: true,  fixed: false, desc: "Mission objective area" },
  debris:          { hasStation: false, hasAsteroids: true,  hasPatrols: false, fixed: false, desc: "Wreckage field — salvage opportunities" },
  wormhole_tunnel: { hasStation: false, hasAsteroids: false, hasPatrols: false, fixed: true,  desc: "Wormhole interior — obstacle course" },
  sun_zone:        { hasStation: false, hasAsteroids: false, hasPatrols: false, fixed: true,  desc: "Star proximity zone — hazardous" },
};

const QUADRANT_TEMPLATE = {
  id: "",
  type: "open",
  name: "",
  seed: 0,
  fixed: false,       // if true, exists identically in every world
  width: 1280,
  height: 720,
  // Generated from seed at load time (non-fixed quadrants only):
  // asteroids: [], pois: [], patrolSpawns: []
  // Fixed quadrants have their contents defined in SYSTEM_DEFS
};

// ── STATIONS ──────────────────────────────────────────────────
const STATION_TEMPLATE = {
  id: "",
  name: "",
  faction: "civilian",
  services: {
    hasTrading: true,
    hasMissions: true,
    hasShipyard: true,
    hasRefuel: true,
    hasRepair: true,
  },
  districts: ["trading_post", "mission_board", "shipyard", "repair_bay", "cantina"],
};

// ── COMMODITIES ───────────────────────────────────────────────
const COMMODITY_DEFS = {
  // COMMON
  iron:        { name: "Iron",          basePrice: 10,   volatility: 0.05, category: "metal",    rarity: "common" },
  copper:      { name: "Copper",        basePrice: 15,   volatility: 0.08, category: "metal",    rarity: "common" },
  titanium:    { name: "Titanium",      basePrice: 25,   volatility: 0.10, category: "metal",    rarity: "common" },
  ice:         { name: "Ice",           basePrice: 5,    volatility: 0.03, category: "resource", rarity: "common" },
  food:        { name: "Food Supplies", basePrice: 8,    volatility: 0.04, category: "supply",   rarity: "common" },
  scrap:       { name: "Scrap Metal",   basePrice: 3,    volatility: 0.02, category: "salvage",  rarity: "common" },

  // UNCOMMON
  gold:        { name: "Gold",          basePrice: 80,   volatility: 0.15, category: "metal",    rarity: "uncommon" },
  electronics: { name: "Electronics",   basePrice: 60,   volatility: 0.12, category: "tech",     rarity: "uncommon" },
  medSupplies: { name: "Med Supplies",  basePrice: 45,   volatility: 0.10, category: "supply",   rarity: "uncommon" },
  fuel_cells:  { name: "Fuel Cells",    basePrice: 35,   volatility: 0.08, category: "fuel",     rarity: "uncommon" },
  polymers:    { name: "Polymers",      basePrice: 30,   volatility: 0.07, category: "material", rarity: "uncommon" },

  // RARE
  quantanium:  { name: "Quantanium",    basePrice: 200,  volatility: 0.30, category: "exotic",   rarity: "rare" },
  starmetal:   { name: "Star Metal",    basePrice: 150,  volatility: 0.25, category: "metal",    rarity: "rare" },
  biodata:     { name: "Biodata",       basePrice: 120,  volatility: 0.20, category: "tech",     rarity: "rare" },

  // FACTION-SPECIFIC
  harv_resin:  { name: "Harvester Resin",  basePrice: 90,  volatility: 0.18, category: "harvester", rarity: "rare" },
  void_shard:  { name: "Void Shard",       basePrice: 250, volatility: 0.35, category: "eldritch",  rarity: "rare" },

  // ILLEGAL
  narcotics:   { name: "Narcotics",     basePrice: 180,  volatility: 0.40, category: "illegal",  rarity: "rare" },
  weapons:     { name: "Weapons Cache", basePrice: 140,  volatility: 0.25, category: "illegal",  rarity: "uncommon" },
};

function calculatePrice(commodityKey, stationSeed, eventMult, factionMult) {
  const def = COMMODITY_DEFS[commodityKey];
  if (!def) return 0;
  const rng = seededRNG(stationSeed + commodityKey.length);
  const stationMult = 0.7 + rng() * 0.6;
  // Time-based fluctuation — changes every 30 seconds, not every frame
  const timeBucket = Math.floor(Date.now() / 30000);
  const timeRng = seededRNG(stationSeed + timeBucket + commodityKey.length * 7);
  const fluctuation = 1 + (timeRng() - 0.5) * 2 * def.volatility;
  return Math.round(def.basePrice * stationMult * (eventMult || 1) * (factionMult || 1) * fluctuation);
}

// ── UNIVERSE SHIPS ────────────────────────────────────────────
// Arena ships get universe stat extensions.
// Some Arena ships serve dual roles in Universe.
// Universe-exclusive ships fill specialized roles.

const UNIVERSE_SHIP_STATS = {
  // === ARENA SHIPS — universe stat extensions ===
  // All combat ships. Expensive to run in Universe (high fuel, low cargo).
  Starlight:    { cargoCapacity: 2,   fuelMax: 50,   miningPower: 1, scanRange: 100,  fuelEfficiency: 1.0,  role: "combat" },
  Falcon:       { cargoCapacity: 2,   fuelMax: 60,   miningPower: 0, scanRange: 120,  fuelEfficiency: 1.2,  role: "combat" },
  Rouge:        { cargoCapacity: 4,   fuelMax: 80,   miningPower: 0, scanRange: 80,   fuelEfficiency: 0.8,  role: "combat" },
  Marauder:     { cargoCapacity: 15,  fuelMax: 120,  miningPower: 0, scanRange: 120,  fuelEfficiency: 1.3,  role: "combat/blockade_runner",
    universeDesc: "Fast gunship with decent cargo hold. Can outrun most patrols — the smuggler's choice." },
  Wasp:         { cargoCapacity: 3,   fuelMax: 70,   miningPower: 0, scanRange: 90,   fuelEfficiency: 0.9,  role: "combat" },
  Supernova:    { cargoCapacity: 8,   fuelMax: 200,  miningPower: 2, scanRange: 250,  fuelEfficiency: 1.5,  role: "combat/explorer",
    universeDesc: "Heavy fire support with a surprisingly capable long-range sensor suite. Born to explore." },
  Bulwark:      { cargoCapacity: 10,  fuelMax: 120,  miningPower: 0, scanRange: 50,   fuelEfficiency: 0.4,  role: "combat" },
  Tempest:      { cargoCapacity: 8,   fuelMax: 130,  miningPower: 0, scanRange: 70,   fuelEfficiency: 0.5,  role: "combat" },
  Nemesis:      { cargoCapacity: 12,  fuelMax: 150,  miningPower: 0, scanRange: 60,   fuelEfficiency: 0.4,  role: "combat" },
  Prometheus:   { cargoCapacity: 15,  fuelMax: 180,  miningPower: 0, scanRange: 50,   fuelEfficiency: 0.3,  role: "combat" },
  Leviathan:    { cargoCapacity: 30,  fuelMax: 250,  miningPower: 0, scanRange: 40,   fuelEfficiency: 0.2,  role: "combat/carrier" },
  Dominion:     { cargoCapacity: 20,  fuelMax: 200,  miningPower: 0, scanRange: 50,   fuelEfficiency: 0.25, role: "combat" },
  Comet:        { cargoCapacity: 1,   fuelMax: 40,   miningPower: 0, scanRange: 150,  fuelEfficiency: 1.5,  role: "combat" },
  Vengeance:    { cargoCapacity: 2,   fuelMax: 50,   miningPower: 0, scanRange: 100,  fuelEfficiency: 1.0,  role: "combat" },
  Retribution:  { cargoCapacity: 5,   fuelMax: 80,   miningPower: 0, scanRange: 80,   fuelEfficiency: 0.6,  role: "combat" },

  // === ARENA SHIPS — dual-role in Universe ===
  // Healer → Salvage Ship (repairs hull by extracting material = natural salvager)
  Healer: {
    cargoCapacity: 60, fuelMax: 200, miningPower: 0, scanRange: 150, fuelEfficiency: 0.8,
    role: "salvage",
    hasTractorBeam: true,
    universeDesc: "Hull repair specialist repurposed for salvage. Extracts materials from wrecks to patch hulls — or sell.",
    // Uses existing Medic.png / EnemyMedic.png assets
  },

  // === UNIVERSE-EXCLUSIVE SHIPS ===
  Hauler: {
    price: 45000,
    cargoCapacity: 200, fuelMax: 300, miningPower: 0, scanRange: 60, fuelEfficiency: 0.6,
    hp: 800, shields: 600, armor: 150, speed: 0.8,
    weaponType: "laser_repeater", weaponSize: 2, pdc: 1, pdcSize: 2,
    armorType: "medium", size: 5,
    role: "hauler",
    image: "Galactic_Horizons_Rougue.png", // PLACEHOLDER — needs own asset
    desc: "Massive cargo hauler. Slow and poorly armed, but nothing carries more freight.",
  },

  MiningVessel: {
    price: 35000,
    cargoCapacity: 80, fuelMax: 200, miningPower: 10, scanRange: 80, fuelEfficiency: 0.7,
    hp: 600, shields: 500, armor: 120, speed: 0.9,
    weaponType: "laser_repeater", weaponSize: 2, pdc: 0, pdcSize: 0,
    armorType: "medium", size: 4,
    role: "mining",
    image: "Starlight.png", // PLACEHOLDER — needs own asset
    desc: "Purpose-built for ore extraction. Mining laser cuts through rock like nothing else.",
  },
};

// ── FUEL COSTS ────────────────────────────────────────────────
const FUEL_COSTS = {
  quantumPerKM: 1,
  inQuadrantPerMinute: 0.2,
  wormholeFlat: 10,
  planetLaunch: 5,
  refuelPricePerUnit: 2,
};

// ── FACTION REPUTATION ────────────────────────────────────────
const FACTION_REP = {
  thresholds: {
    hostile:    -100,
    unfriendly: -50,
    neutral:    0,
    friendly:   50,
    allied:     100,
    honored:    200,
  },
  gains: {
    completeMission: 15,
    aidEvent: 25,
    repairSuneater: 30,
    killEnemyFaction: 5,
    tradeLargeHaul: 3,
    completeSecondChance: 40,  // Second Chance mission — big rep recovery
  },
  losses: {
    killFactionNPC: -30,
    killCivilianInFactionSpace: -15,
    failMission: -10,
    helpEnemyFaction: -20,
  },
  priceMult: {
    hostile: 999,    // refused service
    unfriendly: 1.3,
    neutral: 1.0,
    friendly: 0.85,
    allied: 0.75,
    honored: 0.65,
  },
};

function getRepTier(repValue) {
  if (repValue <= FACTION_REP.thresholds.hostile)    return "hostile";
  if (repValue <= FACTION_REP.thresholds.unfriendly) return "unfriendly";
  if (repValue >= FACTION_REP.thresholds.honored)    return "honored";
  if (repValue >= FACTION_REP.thresholds.allied)     return "allied";
  if (repValue >= FACTION_REP.thresholds.friendly)   return "friendly";
  return "neutral";
}

// ── MISSIONS ──────────────────────────────────────────────────
const MISSION_TYPES = {
  bounty:        { name: "Bounty",            icon: "BNT", minRep: "neutral" },
  delivery:      { name: "Delivery",          icon: "DLV", minRep: "neutral" },
  mining:        { name: "Mining Contract",   icon: "MNE",  minRep: "neutral" },
  explore:       { name: "Exploration",       icon: "EXP", minRep: "friendly" },
  salvage:       { name: "Salvage Op",        icon: "SLV", minRep: "neutral" },
  protect:       { name: "Protection Detail", icon: "PRT",  minRep: "friendly" },
  aid:           { name: "Aid Faction Event", icon: "AID",  minRep: "friendly" },
  suneater:      { name: "Repair Suneater",   icon: "SUN",  minRep: "allied" },
  second_chance: { name: "Second Chance",     icon: "2ND",  minRep: "hostile",
    desc: "Available ONLY when faction rep is negative. A difficult redemption mission — the only way to dig yourself out of hostile standing. Dangerous, multi-objective, no backup from the faction you wronged.",
    special: true, // only appears when rep < 0, only one available at a time
  },
};

const MISSION_TEMPLATE = {
  id: "",
  type: "",
  title: "",
  desc: "",
  faction: null,
  reward: 0,
  repReward: 0,
  targetSystem: "",
  targetArea: "",
  targetQuadrant: "",
  objectives: [],
  status: "active",
  expiresAt: 0,
};

// Second Chance mission generation rules:
// - Only appears at mission boards when player has negative rep with that board's faction
// - Only ONE Second Chance mission active at a time
// - Multi-objective: e.g. deliver rare cargo + kill a specific target + survive ambush
// - No faction allies help you during the mission — you're on your own
// - Reward: large rep boost (enough to go from hostile to unfriendly, or unfriendly to neutral)
// - Failure: additional rep loss — makes the hole deeper
// - Cannot be abandoned without penalty

// ── WORMHOLE DATA ─────────────────────────────────────────────
const WORMHOLE_TEMPLATE = {
  id: "",
  fromSystem: "",
  toSystem: "",
  seed: 0,
  length: 300,
  difficulty: 1,   // 1-5, affects pillar density and speed
  // Generated at load from seed:
  // pillars: [{ x, y, width, height }]
  // effects: [] (visual — colors, particles, distortion)
};

// ── PATROL TEMPLATES ──────────────────────────────────────────
const PATROL_TEMPLATES = {
  // Warden patrols (civilian space law enforcement)
  warden_light:     { ships: ["Raptor", "Raptor"],                     faction: "warden",    dangerMin: 1 },
  warden_medium:    { ships: ["Rouge", "Raptor", "Raptor"],            faction: "warden",    dangerMin: 2 },
  warden_heavy:     { ships: ["Corsair", "Rouge", "Raptor"],           faction: "warden",    dangerMin: 3 },

  // Harvester patrols
  harvester_scout:  { ships: ["Raptor", "Raptor"],                     faction: "harvester", dangerMin: 2 },
  harvester_patrol: { ships: ["Rouge", "Rouge", "Raptor", "Raptor"],   faction: "harvester", dangerMin: 3 },
  harvester_fleet:  { ships: ["Corsair", "Bulwark", "Rouge", "Rouge"], faction: "harvester", dangerMin: 4 },
  harvester_mining: { ships: ["MiningVessel", "Raptor"],               faction: "harvester", dangerMin: 2, hasPassive: true },
  harvester_hauler: { ships: ["Hauler", "Rouge"],                      faction: "harvester", dangerMin: 3, hasPassive: true },

  // Eldritch patrols
  eldritch_scout:   { ships: ["ShadowComet"],                          faction: "eldritch",  dangerMin: 3 },
  eldritch_raid:    { ships: ["ShadowComet", "ShadowComet", "Raptor"], faction: "eldritch",  dangerMin: 4 },
  eldritch_terror:  { ships: ["ShadowVengeance", "ShadowComet", "ShadowComet"], faction: "eldritch", dangerMin: 5 },
};

// ── NPC EVENTS (Scripted for launch) ──────────────────────────
const NPC_EVENT_TYPES = {
  blockade:      { name: "Blockade",         priceMult: 2.0, patrolMult: 2.0, desc: "Faction blocking trade routes" },
  surplus:       { name: "Supply Surplus",   priceMult: 0.6, patrolMult: 1.0, desc: "Oversupply drives prices down" },
  war_front:     { name: "Border Conflict",  priceMult: 1.4, patrolMult: 3.0, desc: "Active fighting between factions" },
  pirate_raid:   { name: "Pirate Activity",  priceMult: 1.2, patrolMult: 1.5, desc: "Pirate raids increasing danger" },
  supply_crisis: { name: "Supply Crisis",    priceMult: 1.8, patrolMult: 1.0, desc: "Critical shortage at stations" },
};

// ── SAVE/LOAD SCHEMA ──────────────────────────────────────────
const SAVE_SCHEMA = {
  worldId: "",
  masterSeed: 0,
  name: "",
  createdAt: 0,
  playTime: 0,
  player: {},
  deltas: [],
  activeEvents: [],
  factionInfluence: {},
  sunHealth: {},
};

// ── FACTION SHIP SHOPS ────────────────────────────────────────
// What ships each faction's stations sell
// Civilian stations sell warden + universal ships
// Harvester stations sell harvester ships
// Eldritch stations sell eldritch ships

const UNI_SHIP_SHOP = {
  civilian: [
    { key: "Starlight",      price: 0,      desc: "Starter combat ship. Light and nimble." },
    { key: "Falcon",         price: 8000,   desc: "Fast interceptor. Good dodge, light weapons." },
    { key: "Rouge",          price: 12000,  desc: "Versatile fighter with decent cargo space." },
    { key: "Marauder",       price: 25000,  desc: "Blockade runner. Fast, good cargo, outruns patrols." },
    { key: "Wasp",           price: 18000,  desc: "Light assault craft. Spawns temporary allies." },
    { key: "Supernova",      price: 40000,  desc: "Explorer class. Massive fuel range, deep scanner." },
    { key: "MiningVessel",   price: 35000,  desc: "Purpose-built miner. Best mining laser in the fleet." },
    { key: "Hauler",         price: 45000,  desc: "Cargo hauler. Massive hold, weak combat." },
    { key: "Healer",         price: 40000,  desc: "Salvage ship. Tractor beam, hull extraction." },
  ],
  warden: [
    { key: "Bulwark",        price: 50000,  desc: "Warden heavy tank. Turrets, thick armor." },
    { key: "Tempest",        price: 55000,  desc: "Warden support cruiser. Heals allies in combat." },
    { key: "Nemesis",        price: 65000,  desc: "Warden assault ship. Speed boost special." },
    { key: "Leviathan",      price: 120000, desc: "Warden capital ship. Deploys fighters." },
  ],
  harvester: [
    { key: "Prometheus",     price: 80000,  desc: "Harvester missile cruiser. Devastating salvos." },
    { key: "Dominion",       price: 100000, desc: "Harvester battleship. Beam weapon, overcharge." },
  ],
  eldritch: [
    { key: "Comet",          price: 90000,  desc: "Eldritch interceptor. Extreme speed and dodge." },
    { key: "Vengeance",      price: 130000, desc: "Eldritch assault ship. Revenge mode doubles damage." },
    { key: "Retribution",    price: 200000, desc: "Eldritch dreadnought. Summons shadow allies." },
  ],
};

function getShopShipsForStation(stationFaction) {
  const ships = [...(UNI_SHIP_SHOP.civilian || [])];
  if (stationFaction === "civilian" || stationFaction === "warden") {
    ships.push(...(UNI_SHIP_SHOP.warden || []));
  }
  if (stationFaction === "harvester") {
    ships.push(...(UNI_SHIP_SHOP.harvester || []));
  }
  if (stationFaction === "eldritch") {
    ships.push(...(UNI_SHIP_SHOP.eldritch || []));
  }
  return ships;
}

// ── WORLD GENERATION FLOW ─────────────────────────────────────
// 1. Player creates new world → random masterSeed
// 2. SYSTEM_DEFS are fixed (names, connections, areas) — same every world
// 3. For each system: systemSeed = deriveEntitySeed(masterSeed, systemId)
// 4. For each area: areaSeed = deriveEntitySeed(systemSeed, areaId)
//    - Fixed areas (marked fixed:true) generate their fixed quadrants
//    - Non-fixed areas generate seed-based quadrants (4-6 per area)
// 5. For each non-fixed quadrant: seed-generate contents (asteroids, POIs, patrol routes)
// 6. Planets get their own seed: planetSeed = deriveEntitySeed(masterSeed, planetId)
//    - Used for surface POI generation when planets are added
// 7. Player starts: one starter ship, 1000 Sol Credits, neutral rep with all factions
// 8. Save = masterSeed + empty delta list + fresh player state
//
// On load:
// 1. Read masterSeed + deltas + player from save
// 2. Regenerate all fixed + seed-based content
// 3. Apply deltas (commodity changes, depleted asteroids, discovered POIs, etc.)
// 4. Restore player state
// 5. Ready to play
