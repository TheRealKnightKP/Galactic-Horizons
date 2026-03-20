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
    connections: ["ashfall", "meridian", "haven_reach"],
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
    connections: ["meridian", "thornreach", "vantage"],
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
    connections: ["solara", "duskfall", "char", "voidspine"],
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
    connections: ["meridian", "ashfall", "thornreach", "char", "crossroads"],
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
    connections: ["kestrel", "duskfall", "marrow", "cinderdeep", "vantage", "crossroads"],
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
    connections: ["thornreach", "char", "hollow", "bonefield"],
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
    connections: ["ashfall", "duskfall", "marrow", "hollow", "voidspine", "bonefield", "crossroads"],
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

  // === NEW CIVILIAN SYSTEMS ===
  haven_reach: {
    name: "Haven Reach",
    desc: "Quiet agricultural system. Peaceful, but close enough to the frontier to feel the tension.",
    defaultFaction: "civilian",
    sunHealth: 100,
    connections: ["solara", "vantage"],
    areas: [
      { id: "haven_reach_sun",  type: "sun",      name: "Reach Star",        fixed: true },
      { id: "farmworld",        type: "planet",   name: "Farmworld",         biome: "temperate",    fixed: true },
      { id: "reach_belt",       type: "belt",     name: "Reach Dusts",       biome: "asteroid" },
      { id: "wh_solara_hr",     type: "wormhole", name: "Solara Gate",       targetSystem: "solara",     fixed: true },
      { id: "wh_vantage_hr",    type: "wormhole", name: "Vantage Passage",   targetSystem: "vantage",    fixed: true },
    ],
    dangerLevel: 1,
  },

  vantage: {
    name: "Vantage",
    desc: "High-traffic trading corridor. Ships from all factions pass through here.",
    defaultFaction: "civilian",
    sunHealth: 95,
    connections: ["haven_reach", "kestrel", "thornreach", "crossroads"],
    areas: [
      { id: "vantage_sun",      type: "sun",      name: "Vantage Star",      fixed: true },
      { id: "tradepost",        type: "planet",   name: "Tradepost",         biome: "industrial",   fixed: true },
      { id: "vantage_belt",     type: "belt",     name: "Transit Belt",      biome: "asteroid" },
      { id: "vantage_debris",   type: "anomaly",  name: "Old Convoy Wreck",  biome: "derelict" },
      { id: "wh_haven_reach_v", type: "wormhole", name: "Haven Gate",        targetSystem: "haven_reach", fixed: true },
      { id: "wh_kestrel_v",     type: "wormhole", name: "Kestrel Passage",   targetSystem: "kestrel",     fixed: true },
      { id: "wh_thornreach_v",  type: "wormhole", name: "Thornreach Rift",   targetSystem: "thornreach",  fixed: true },
    ],
    dangerLevel: 2,
  },

  // === NEW HARVESTER SYSTEMS ===
  cinderdeep: {
    name: "Cinderdeep",
    desc: "Harvester industrial heartland. Massive mining operations strip nearby asteroids bare.",
    defaultFaction: "harvester",
    sunHealth: 70,
    connections: ["thornreach", "bonefield"],
    areas: [
      { id: "cinderdeep_sun",   type: "sun",      name: "Cinderdeep Star",   fixed: true },
      { id: "scorchmoon",       type: "planet",   name: "Scorchmoon",        biome: "volcanic",     fixed: true },
      { id: "cinder_belt",      type: "belt",     name: "Strip Fields",      biome: "asteroid" },
      { id: "cinder_mine",      type: "belt",     name: "Private Dig Site",  biome: "asteroid" },
      { id: "suneater_cinder",  type: "anomaly",  name: "Suneater Array",    biome: "sun_harvester", fixed: true },
      { id: "wh_thornreach_cd", type: "wormhole", name: "Thornreach Gate",   targetSystem: "thornreach",  fixed: true },
      { id: "wh_bonefield_cd",  type: "wormhole", name: "Bonefield Passage", targetSystem: "bonefield",   fixed: true },
    ],
    dangerLevel: 3,
  },

  bonefield: {
    name: "Bonefield",
    desc: "Ancient Harvester graveyard system. Ships from a lost war drift here. Rich salvage, heavy patrols.",
    defaultFaction: "harvester",
    sunHealth: 55,
    connections: ["cinderdeep", "char", "marrow"],
    areas: [
      { id: "bonefield_sun",    type: "sun",      name: "Dim Star",          fixed: true },
      { id: "boneyard_prime",   type: "anomaly",  name: "Boneyard Prime",    biome: "derelict",     fixed: true },
      { id: "bonefield_belt",   type: "belt",     name: "Bone Drift",        biome: "asteroid" },
      { id: "bonefield_debris", type: "anomaly",  name: "Fleet Wreckage",    biome: "derelict" },
      { id: "wh_cinderdeep_bf", type: "wormhole", name: "Cinderdeep Gate",   targetSystem: "cinderdeep",  fixed: true },
      { id: "wh_char_bf",       type: "wormhole", name: "Char Wound",        targetSystem: "char",        fixed: true },
      { id: "wh_marrow_bf",     type: "wormhole", name: "Marrow Passage",    targetSystem: "marrow",      fixed: true },
    ],
    dangerLevel: 4,
  },

  // === NEW ELDRITCH SYSTEM ===
  voidspine: {
    name: "Voidspine",
    desc: "Eldritch staging ground. Ships gather here before raids into civilian space.",
    defaultFaction: "eldritch",
    sunHealth: 20,
    connections: ["char", "ashfall"],
    areas: [
      { id: "voidspine_sun",    type: "sun",      name: "Dying Ember",       fixed: true },
      { id: "rupture",          type: "planet",   name: "Rupture",           biome: "corrupted",    fixed: true },
      { id: "voidspine_belt",   type: "belt",     name: "Shard Field",       biome: "asteroid" },
      { id: "void_staging",     type: "anomaly",  name: "Void Staging Area", biome: "eldritch_core", fixed: true },
      { id: "wh_char_vs",       type: "wormhole", name: "Char Gate",         targetSystem: "char",    fixed: true },
      { id: "wh_ashfall_vs",    type: "wormhole", name: "Ashfall Tear",      targetSystem: "ashfall", fixed: true },
    ],
    dangerLevel: 5,
  },

  // === CONTESTED SYSTEM (no default faction — always a war zone) ===
  crossroads: {
    name: "Crossroads",
    desc: "No faction controls this system. All three want it. It is always burning.",
    defaultFaction: "civilian",  // neutral starting point
    sunHealth: 60,
    connections: ["duskfall", "thornreach", "char", "vantage"],
    areas: [
      { id: "crossroads_sun",   type: "sun",      name: "Crossroads Star",   fixed: true },
      { id: "no_mans_land",     type: "planet",   name: "No Man's Land",     biome: "scorched",     fixed: true },
      { id: "crossroads_belt",  type: "belt",     name: "Contested Belt",    biome: "asteroid" },
      { id: "battleground",     type: "anomaly",  name: "Eternal Battleground", biome: "derelict", fixed: true },
      { id: "wh_duskfall_cr",   type: "wormhole", name: "Duskfall Gate",     targetSystem: "duskfall",   fixed: true },
      { id: "wh_thornreach_cr", type: "wormhole", name: "Thornreach Rift",   targetSystem: "thornreach", fixed: true },
      { id: "wh_char_cr",       type: "wormhole", name: "Char Passage",      targetSystem: "char",       fixed: true },
      { id: "wh_vantage_cr",    type: "wormhole", name: "Vantage Gate",      targetSystem: "vantage",    fixed: true },
    ],
    dangerLevel: 4,
  },
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
  private_mine:    { hasStation: false, hasAsteroids: true,  hasPatrols: true,  fixed: false, desc: "Harvester private mining operation — locked asteroids, guards, rare ore" },
  warzone:         { hasStation: false, hasAsteroids: false, hasPatrols: true,  fixed: false, desc: "Active faction conflict — combat zone" },
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
  // COMMON — low value, easy to find, high volatility is low
  iron:          { name: "Iron",            basePrice: 18,    volatility: 0.06,  category: "metal",     rarity: "common",   sellMult: 0.55 },
  copper:        { name: "Copper",          basePrice: 28,    volatility: 0.08,  category: "metal",     rarity: "common",   sellMult: 0.55 },
  titanium:      { name: "Titanium",        basePrice: 55,    volatility: 0.10,  category: "metal",     rarity: "common",   sellMult: 0.60 },
  ice:           { name: "Ice",             basePrice: 12,    volatility: 0.04,  category: "resource",  rarity: "common",   sellMult: 0.50 },
  food:          { name: "Food Supplies",   basePrice: 20,    volatility: 0.05,  category: "supply",    rarity: "common",   sellMult: 0.55 },
  scrap:         { name: "Scrap Metal",     basePrice: 8,     volatility: 0.03,  category: "salvage",   rarity: "common",   sellMult: 0.50 },

  // UNCOMMON — moderate value, found in specific locations
  gold:          { name: "Gold",            basePrice: 220,   volatility: 0.18,  category: "metal",     rarity: "uncommon", sellMult: 0.65, miningPowerMin: 2 },
  electronics:   { name: "Electronics",     basePrice: 180,   volatility: 0.15,  category: "tech",      rarity: "uncommon", sellMult: 0.60 },
  medSupplies:   { name: "Med Supplies",    basePrice: 120,   volatility: 0.12,  category: "supply",    rarity: "uncommon", sellMult: 0.60 },
  fuel_cells:    { name: "Fuel Cells",      basePrice: 90,    volatility: 0.10,  category: "fuel",      rarity: "uncommon", sellMult: 0.58 },
  polymers:      { name: "Polymers",        basePrice: 75,    volatility: 0.09,  category: "material",  rarity: "uncommon", sellMult: 0.58 },

  // RARE — high value, harder to acquire
  quantanium:    { name: "Quantanium",      basePrice: 850,   volatility: 0.35,  category: "exotic",    rarity: "rare",     sellMult: 0.70, miningPowerMin: 3 },
  starmetal:     { name: "Star Metal",      basePrice: 600,   volatility: 0.28,  category: "metal",     rarity: "rare",     sellMult: 0.68 },
  biodata:       { name: "Biodata",         basePrice: 450,   volatility: 0.22,  category: "tech",      rarity: "rare",     sellMult: 0.65 },

  // SALVAGE-ONLY materials
  armor_plating:    { name: "Armor Plating",     basePrice: 1200,  volatility: 0.20,  category: "salvage",   rarity: "rare",     sellMult: 0.65, salvageOnly: true },
  quantum_cores:    { name: "Quantum Cores",      basePrice: 8500,  volatility: 0.45,  category: "salvage",   rarity: "exotic",   sellMult: 0.72, salvageOnly: true, tractorBeamRequired: true },
  void_capacitor:   { name: "Void Capacitor",     basePrice: 22000, volatility: 0.55,  category: "salvage",   rarity: "exotic",   sellMult: 0.74, salvageOnly: true, tractorBeamRequired: true },
  crystallized_fuel:{ name: "Crystallized Fuel",  basePrice: 6000,  volatility: 0.40,  category: "salvage",   rarity: "exotic",   sellMult: 0.70, salvageOnly: true },

  // PRIVATE MINE exclusives (Harvester systems only)
  platinum_hq:   { name: "HQ Platinum",     basePrice: 1200,  volatility: 0.38,  category: "metal",     rarity: "exotic",   sellMult: 0.72, miningPowerMin: 2, privateOnly: true },
  uranium:       { name: "Uranium",          basePrice: 950,   volatility: 0.30,  category: "resource",  rarity: "exotic",   sellMult: 0.70, miningPowerMin: 2, privateOnly: true },
  rhodium:       { name: "Rhodium",          basePrice: 2200,  volatility: 0.50,  category: "metal",     rarity: "exotic",   sellMult: 0.75, miningPowerMin: 3, privateOnly: true },

  // FACTION-SPECIFIC
  harv_resin:    { name: "Harvester Resin", basePrice: 280,   volatility: 0.20,  category: "harvester", rarity: "rare",     sellMult: 0.62 },
  void_shard:    { name: "Void Shard",      basePrice: 1100,  volatility: 0.40,  category: "eldritch",  rarity: "exotic",   sellMult: 0.70 },

  // ILLEGAL
  narcotics:     { name: "Narcotics",       basePrice: 520,   volatility: 0.45,  category: "illegal",   rarity: "rare",     sellMult: 0.68 },
  weapons:       { name: "Weapons Cache",   basePrice: 420,   volatility: 0.30,  category: "illegal",   rarity: "uncommon", sellMult: 0.65 },
};

function calculatePrice(commodityKey, stationSeed, eventMult, factionMult) {
  const def = COMMODITY_DEFS[commodityKey];
  if (!def) return 0;
  const rng = seededRNG(stationSeed + commodityKey.length);
  const stationMult = 0.75 + rng() * 0.5;
  // Time-based fluctuation — changes every 30 seconds, not every frame
  const timeBucket = Math.floor(Date.now() / 30000);
  const timeRng = seededRNG(stationSeed + timeBucket + commodityKey.length * 7);
  const fluctuation = 1 + (timeRng() - 0.5) * 2 * def.volatility;
  return Math.round(def.basePrice * stationMult * (eventMult || 1) * (factionMult || 1) * fluctuation);
}

function getSellPrice(commodityKey, stationSeed, eventMult, factionMult) {
  const def = COMMODITY_DEFS[commodityKey];
  if (!def) return 0;
  const buyPrice = calculatePrice(commodityKey, stationSeed, eventMult, factionMult);
  return Math.round(buyPrice * (def.sellMult || 0.55));
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

  // Civilian passive ships (flee on contact, lootable if destroyed)
  civilian_hauler:  { ships: ["Hauler"],                               faction: "civilian",  dangerMin: 1, hasPassive: true, flees: true },
  civilian_convoy:  { ships: ["Hauler", "Hauler", "Raptor"],          faction: "civilian",  dangerMin: 1, hasPassive: true, flees: true, isConvoy: true },

  // Harvester patrols
  harvester_scout:  { ships: ["Raptor", "Raptor"],                     faction: "harvester", dangerMin: 2 },
  harvester_patrol: { ships: ["Rouge", "Rouge", "Raptor", "Raptor"],   faction: "harvester", dangerMin: 3 },
  harvester_fleet:  { ships: ["Corsair", "Bulwark", "Rouge", "Rouge"], faction: "harvester", dangerMin: 4 },
  harvester_mining: { ships: ["MiningVessel", "Raptor"],               faction: "harvester", dangerMin: 2, hasPassive: true, flees: true },
  harvester_hauler: { ships: ["Hauler", "Rouge"],                      faction: "harvester", dangerMin: 3, hasPassive: true, flees: true },

  // Private mine guards (used in private_mine quadrants only)
  priv_mine_light:  { ships: ["Raptor", "Raptor", "Raptor"],           faction: "harvester", dangerMin: 2, isGuard: true },
  priv_mine_heavy:  { ships: ["Rouge", "Rouge", "Corsair", "Raptor"],  faction: "harvester", dangerMin: 3, isGuard: true },

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

// ── FACTION REPUTATION HELPERS ────────────────────────────────
function getPlayerRep(world, faction) {
  if (!world || !world.player || !world.player.factionRep) return 0;
  return world.player.factionRep[faction] || 0;
}

function changePlayerRep(world, faction, amount) {
  if (!world || !world.player) return;
  if (!world.player.factionRep) world.player.factionRep = { warden: 0, harvester: 0, eldritch: 0 };
  world.player.factionRep[faction] = Math.max(-100, Math.min(100, (world.player.factionRep[faction] || 0) + amount));
}

function getRepPriceMult(world, faction) {
  const rep = getPlayerRep(world, faction);
  const tier = getRepTier(rep);
  return FACTION_REP.priceMult[tier] || 1.0;
}

function isStationAccessible(world, stationFaction) {
  if (!stationFaction || stationFaction === "civilian") return true;
  const rep = getPlayerRep(world, stationFaction);
  return getRepTier(rep) !== "hostile";
}

function doPatrolsAggro(world, patrolFaction) {
  if (!patrolFaction || patrolFaction === "civilian") return false;
  const rep = getPlayerRep(world, patrolFaction);
  const tier = getRepTier(rep);
  return tier === "hostile" || tier === "unfriendly";
}

// ── NPC WAR SYSTEM ────────────────────────────────────────────
const WAR_CONFIG = {
  chancePerJump:      0.15,   // 15% per jump that a new war starts somewhere
  maxActiveWars:      2,      // max simultaneous wars in universe
  durationMinJumps:   3,      // war lasts at least this many player jumps
  durationMaxJumps:   8,      // war lasts at most this many jumps before auto-resolve
  cooldownJumps:      10,     // jumps before same system can have another war
  influenceGain:      20,     // % influence winner gains
  influenceLoss:      20,     // % influence loser loses
  capitalThreshold:   20,     // if capital faction drops below this %, faction is scattered
  warzoneAttackers:   { min: 4, max: 8 },
  warzoneDefenders:   { min: 4, max: 8 },
  capitalDefBonus:    2,      // capital warzones have 2x defenders
};

const FACTION_CAPITALS = {
  warden:    "solara",
  harvester: "marrow",
  eldritch:  "hollow",
};

// Starting influence values per system
const SYSTEM_START_INFLUENCE = {
  // Civilian systems
  solara:      { warden: 80, harvester: 5,  eldritch: 0  },
  meridian:    { warden: 75, harvester: 8,  eldritch: 0  },
  kestrel:     { warden: 50, harvester: 15, eldritch: 0  },
  ashfall:     { warden: 30, harvester: 20, eldritch: 5  },
  duskfall:    { warden: 35, harvester: 35, eldritch: 5  },
  haven_reach: { warden: 70, harvester: 5,  eldritch: 0  },
  vantage:     { warden: 40, harvester: 25, eldritch: 10 },
  // Harvester systems
  thornreach:  { warden: 10, harvester: 70, eldritch: 5  },
  marrow:      { warden: 5,  harvester: 85, eldritch: 5  },
  cinderdeep:  { warden: 5,  harvester: 80, eldritch: 5  },
  bonefield:   { warden: 5,  harvester: 65, eldritch: 15 },
  // Eldritch systems
  char:        { warden: 5,  harvester: 30, eldritch: 60 },
  hollow:      { warden: 0,  harvester: 10, eldritch: 85 },
  voidspine:   { warden: 0,  harvester: 5,  eldritch: 80 },
  // Contested
  crossroads:  { warden: 25, harvester: 25, eldritch: 25 },
};

// ── WORLD GENERATION FLOW ─────────────────────────────────────
// 1. Player creates new world → random masterSeed
// 2. SYSTEM_DEFS are fixed (names, connections, areas) — same every world
// 3. For each system: systemSeed = deriveEntitySeed(masterSeed, systemId)
// 4. For each area: areaSeed = deriveEntitySeed(systemSeed, areaId)
//    - Fixed areas (marked fixed:true) generate their fixed quadrants
//    - Non-fixed areas generate seed-based quadrants (4-6 per area)
// 5. For each non-fixed quadrant: seed-generate contents (asteroids, POIs, patrol routes)
// 6. Planets get their own seed: planetSeed = deriveEntitySeed(masterSeed, planetId)
// 7. Player starts: one starter ship, 1000 Sol Credits, neutral rep with all factions
// 8. Save = masterSeed + empty delta list + fresh player state
