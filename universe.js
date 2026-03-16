// ============================================================
// universe.js — Phase 0.5: Vertical Slice
// The Universe Mode game loop, rendering, and gameplay.
// Depends on: game.js (canvas, input, drawEntity, audio),
//             universe_data.js, universe_saves.js
// ============================================================

// ── UNIVERSE STATE ────────────────────────────────────────────
let uniState = "inactive"; // inactive | map | flying | docked | quantum | combat
let _uniLoopId = null;
let _uniFrameCount = 0;

// Active universe data (set by startUniverseMode in universe_menu.js)
// window._activeUniverse holds the regenerated universe

// Current location tracking
let _uniCurrentSystem = null;  // system object
let _uniCurrentArea = null;    // area object
let _uniCurrentQuadrant = null; // quadrant object
let _uniQuadrantContents = null; // generated contents for current quadrant

// Player ship in universe (separate from Arena player)
let uniPlayer = null;
let uniBullets = [];       // player bullets
let uniEnemyBullets = [];  // enemy bullets
let uniEnemies = [];       // active patrol enemies
let uniAsteroids = [];     // active asteroids in quadrant
let uniPOIs = [];          // active POIs in quadrant
let uniStation = null;     // station entity if quadrant has one
let uniBeamFlashes = [];
let uniHitEffects = [];
let uniDeathEffects = [];

// Combat state
let _uniInCombat = false;
let _uniDisengageTimer = 0; // frames since last player attack
const UNI_DISENGAGE_TIME = 600; // 10 seconds at 60fps

// Mining state
let _uniMiningTarget = null;
let _uniMiningProgress = 0;
const UNI_MINE_RATE = 1.5; // hp per frame when mining

// Quantum travel
let _uniQuantumTarget = null; // { systemId, areaId, quadrantId }
let _uniQuantumTimer = 0;
const UNI_QUANTUM_DURATION = 120; // 2 seconds cutscene

// Map UI state
let _uniMapLevel = "system"; // system | area | quadrant
let _uniMapSelectedSystem = null;
let _uniMapSelectedArea = null;
let _uniMapHover = null;

// Fuel
const UNI_FUEL_DRAIN_RATE = 0.001; // per frame while flying
const UNI_QUANTUM_FUEL_BASE = 5;   // base fuel per quantum jump

// ── UNIVERSE ENTRY/EXIT ───────────────────────────────────────

function enterUniverse(world) {
  if (!world || !window._activeUniverse) return;
  const uni = window._activeUniverse;
  const p = world.player;

  // Tell Arena to stand down
  if (typeof state !== "undefined") state = "menu";

  // Set current location
  _uniCurrentSystem = uni.systems[p.currentSystemId] || uni.systems["solara"];
  _uniMapSelectedSystem = _uniCurrentSystem.id;

  // Build player ship from owned ships
  const shipData = p.ownedShips[p.activeShipIdx || 0];
  if (!shipData) { console.error("No ship!"); return; }
  const shipKey = shipData.key;
  const arenaDef = typeof SHIPS !== "undefined" ? SHIPS[shipKey] : null;
  const uniStats = typeof UNIVERSE_SHIP_STATS !== "undefined" ? UNIVERSE_SHIP_STATS[shipKey] : null;

  const sizeNum = arenaDef?.size || 2;
  const sw = Math.round((40 + sizeNum * 16) * (typeof SIZE_SCALE !== "undefined" ? SIZE_SCALE : 0.5));
  const sh = Math.round((24 + sizeNum * 8) * (typeof SIZE_SCALE !== "undefined" ? SIZE_SCALE : 0.5));

  uniPlayer = {
    x: 200, y: typeof GAME_H !== "undefined" ? GAME_H / 2 : 360,
    w: sw, h: sh,
    vx: 0, vy: 0,
    rotation: 0,
    spriteAngleOffset: Math.PI,
    speed: (arenaDef?.speed || 2) * 0.8,
    hp: shipData.hp || arenaDef?.hp || 500,
    maxHp: arenaDef?.hp || 500,
    shields: shipData.shields || arenaDef?.shields || 300,
    maxShields: arenaDef?.shields || 300,
    armor: shipData.armor || arenaDef?.armor || 100,
    maxArmor: arenaDef?.armor || 100,
    armorType: arenaDef?.armorType || "light",
    img: typeof getImage === "function" ? getImage(arenaDef?.image || "Starlight.png") : null,
    color: arenaDef?.color || "#4488ff",
    shipName: shipKey,
    shipKey: shipKey,

    // Universe stats
    fuel: shipData.fuel || uniStats?.fuelMax || 50,
    fuelMax: uniStats?.fuelMax || 50,
    fuelEfficiency: uniStats?.fuelEfficiency || 1.0,
    cargo: shipData.cargo || [],
    cargoCapacity: uniStats?.cargoCapacity || 2,
    miningPower: uniStats?.miningPower || 0,
    scanRange: uniStats?.scanRange || 100,

    // Combat
    weaponType: arenaDef?.weaponType || "laser_repeater",
    weaponSize: arenaDef?.weaponSize || 2,
    weaponStats: null,
    shootTimer: 0,
    doubleShot: arenaDef?.doubleShot || false,
  };

  // Get weapon stats
  if (typeof getWeaponStats === "function" && uniPlayer.weaponType !== "none") {
    uniPlayer.weaponStats = getWeaponStats(uniPlayer.weaponType, uniPlayer.weaponSize);
  }

  // If player was in a quadrant, load it. Otherwise show map.
  if (p.currentQuadrantId && p.currentAreaId) {
    _uniCurrentArea = _uniCurrentSystem.areas[p.currentAreaId] || null;
    if (_uniCurrentArea) {
      const q = _uniCurrentArea.quadrants.find(q => q.id === p.currentQuadrantId);
      if (q) {
        loadQuadrant(q);
        uniState = "flying";
        startUniLoop();
        return;
      }
    }
  }

  // Default: show map
  uniState = "map";
  startUniLoop();
}

function exitUniverse() {
  stopUniLoop();
  uniState = "inactive";

  // Save player state back to world
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
  if (world && uniPlayer) {
    const ship = world.player.ownedShips[world.player.activeShipIdx || 0];
    if (ship) {
      ship.fuel = uniPlayer.fuel;
      ship.cargo = [...uniPlayer.cargo];
      ship.hp = uniPlayer.hp;
      ship.shields = uniPlayer.shields;
      ship.armor = uniPlayer.armor;
    }
    world.player.credits = window._activeUniverse?.player?.credits || world.player.credits;
    world.player.currentSystemId = _uniCurrentSystem?.id || "solara";
    world.player.currentAreaId = _uniCurrentArea?.id || null;
    world.player.currentQuadrantId = _uniCurrentQuadrant?.id || null;
  }

  if (typeof autoSaveUniverse === "function") autoSaveUniverse();

  // Clear state
  uniPlayer = null;
  uniBullets = [];
  uniEnemyBullets = [];
  uniEnemies = [];
  uniAsteroids = [];
  uniPOIs = [];
  uniStation = null;
  _uniCurrentQuadrant = null;
  _uniQuadrantContents = null;
  _uniInCombat = false;

  // Return to universe menu
  if (typeof exitUniverseToMenu === "function") exitUniverseToMenu();
}

// ── GAME LOOP ─────────────────────────────────────────────────

function startUniLoop() {
  if (_uniLoopId) return;
  // Hide arena UI
  const hud = document.getElementById("hud");
  if (hud) hud.style.display = "none";
  const igb = document.getElementById("inGameBack");
  if (igb) igb.style.display = "none";
  const mUI = document.getElementById("mobileUI");
  if (mUI) mUI.style.display = "none";

  _uniLoopId = requestAnimationFrame(uniLoop);
}

function stopUniLoop() {
  if (_uniLoopId) {
    cancelAnimationFrame(_uniLoopId);
    _uniLoopId = null;
  }
}

function uniLoop() {
  _uniFrameCount++;
  const gw = typeof GAME_W !== "undefined" ? GAME_W : 1280;
  const gh = typeof GAME_H !== "undefined" ? GAME_H : 720;
  const c = typeof ctx !== "undefined" ? ctx : null;
  if (!c) { _uniLoopId = requestAnimationFrame(uniLoop); return; }

  switch (uniState) {
    case "map":       uniUpdateMap(); uniRenderMap(c, gw, gh); break;
    case "flying":    uniUpdateFlying(); uniRenderFlying(c, gw, gh); break;
    case "combat":    uniUpdateFlying(); uniRenderFlying(c, gw, gh); break;
    case "docked":    uniRenderDocked(c, gw, gh); break;
    case "quantum":   uniUpdateQuantum(); uniRenderQuantum(c, gw, gh); break;
    default: break;
  }

  _uniLoopId = requestAnimationFrame(uniLoop);
}

// ── MAP VIEW ──────────────────────────────────────────────────
// Shows system → area → quadrant selection

function uniUpdateMap() {
  // Map input handled by click events on canvas
}

function uniRenderMap(c, gw, gh) {
  // Background
  c.fillStyle = "#020611";
  c.fillRect(0, 0, gw, gh);

  const uni = window._activeUniverse;
  if (!uni) return;

  c.textAlign = "center";

  if (_uniMapLevel === "system") {
    renderSystemMap(c, gw, gh, uni);
  } else if (_uniMapLevel === "area") {
    renderAreaMap(c, gw, gh, uni);
  } else if (_uniMapLevel === "quadrant") {
    renderQuadrantMap(c, gw, gh, uni);
  }

  // Back button hint
  c.textAlign = "left";
  c.fillStyle = "#666";
  c.font = "12px monospace";
  if (_uniMapLevel === "system") {
    c.fillText("[ESC] Exit Universe", 10, gh - 10);
  } else {
    c.fillText("[ESC] Back", 10, gh - 10);
  }

  // Location info
  c.textAlign = "right";
  c.fillStyle = "#555";
  c.font = "11px monospace";
  const locStr = _uniCurrentSystem ? "Current: " + _uniCurrentSystem.name : "";
  c.fillText(locStr, gw - 10, gh - 10);
  c.textAlign = "left";
}

function renderSystemMap(c, gw, gh, uni) {
  c.fillStyle = "#0af";
  c.font = "bold 22px monospace";
  c.fillText("STARMAP", gw / 2, 40);

  const systems = Object.values(uni.systems);
  const cols = 3, rows = Math.ceil(systems.length / cols);
  const cellW = (gw - 100) / cols, cellH = (gh - 120) / rows;
  const startX = 50, startY = 70;

  // Draw connections first
  c.strokeStyle = "rgba(100,100,150,0.3)";
  c.lineWidth = 1;
  for (const sys of systems) {
    const si = systems.indexOf(sys);
    const sx = startX + (si % cols) * cellW + cellW / 2;
    const sy = startY + Math.floor(si / cols) * cellH + cellH / 2;
    for (const connId of sys.connections) {
      const ci = systems.findIndex(s => s.id === connId);
      if (ci < 0 || ci <= si) continue;
      const cx = startX + (ci % cols) * cellW + cellW / 2;
      const cy = startY + Math.floor(ci / cols) * cellH + cellH / 2;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(cx, cy); c.stroke();
    }
  }

  // Draw system nodes
  _uniMapHover = null;
  const mx = typeof mouse !== "undefined" ? mouse.x : 0;
  const my = typeof mouse !== "undefined" ? mouse.y : 0;

  for (let i = 0; i < systems.length; i++) {
    const sys = systems[i];
    const x = startX + (i % cols) * cellW + cellW / 2;
    const y = startY + Math.floor(i / cols) * cellH + cellH / 2;
    const r = 28;

    const hovered = Math.hypot(mx - x, my - y) < r + 10;
    if (hovered) _uniMapHover = sys.id;

    const isCurrent = _uniCurrentSystem && sys.id === _uniCurrentSystem.id;
    const factionColor = sys.faction === "harvester" ? "#ff8800" : sys.faction === "eldritch" ? "#cc0033" : sys.faction === "civilian" ? "#4488ff" : "#888";

    // Node circle
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = hovered ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.5)";
    c.fill();
    c.strokeStyle = isCurrent ? "#0f0" : factionColor;
    c.lineWidth = isCurrent ? 3 : 2;
    c.stroke();

    // Sun health indicator
    const sunFrac = (sys.sunHealth || 100) / 100;
    if (sunFrac < 1) {
      c.beginPath();
      c.arc(x, y, r - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sunFrac);
      c.strokeStyle = sunFrac > 0.5 ? "#ffcc00" : sunFrac > 0.2 ? "#ff6600" : "#ff0000";
      c.lineWidth = 2;
      c.stroke();
    }

    // System name
    c.fillStyle = isCurrent ? "#0f0" : hovered ? "#fff" : "#aaa";
    c.font = "bold 11px monospace";
    c.fillText(sys.name, x, y + r + 16);

    // Danger level
    c.fillStyle = "#666";
    c.font = "9px monospace";
    c.fillText("Danger: " + sys.dangerLevel, x, y + r + 28);

    // Current marker
    if (isCurrent) {
      c.fillStyle = "#0f0";
      c.font = "bold 9px monospace";
      c.fillText("YOU ARE HERE", x, y - r - 8);
    }
  }

  // Instructions
  c.fillStyle = "#555";
  c.font = "11px monospace";
  c.fillText("Click a system to view its areas", gw / 2, gh - 30);
}

function renderAreaMap(c, gw, gh, uni) {
  const sys = uni.systems[_uniMapSelectedSystem];
  if (!sys) { _uniMapLevel = "system"; return; }

  c.fillStyle = "#0af";
  c.font = "bold 20px monospace";
  c.fillText(sys.name + " - Areas", gw / 2, 40);

  const areas = Object.values(sys.areas);
  const cols = Math.min(4, areas.length);
  const rows = Math.ceil(areas.length / cols);
  const cellW = (gw - 80) / cols, cellH = Math.min(110, (gh - 140) / rows);
  const startX = 40, startY = 70;

  const mx = typeof mouse !== "undefined" ? mouse.x : 0;
  const my = typeof mouse !== "undefined" ? mouse.y : 0;
  _uniMapHover = null;

  for (let i = 0; i < areas.length; i++) {
    const area = areas[i];
    const col = i % cols, row = Math.floor(i / cols);
    const x = startX + col * cellW;
    const y = startY + row * cellH;
    const w = cellW - 8, h = cellH - 8;

    const hovered = mx > x && mx < x + w && my > y && my < y + h;
    if (hovered) _uniMapHover = area.id;

    const typeColor = area.type === "planet" ? "#4488ff" : area.type === "belt" ? "#aa8844" :
                      area.type === "wormhole" ? "#aa44ff" : area.type === "sun" ? "#ffcc00" :
                      area.type === "moon" ? "#8888aa" : area.type === "anomaly" ? "#ff4488" : "#666";

    c.fillStyle = hovered ? "rgba(255,255,255,0.06)" : "rgba(10,14,26,0.8)";
    c.fillRect(x, y, w, h);
    c.strokeStyle = typeColor;
    c.lineWidth = hovered ? 2 : 1;
    c.strokeRect(x, y, w, h);

    c.fillStyle = "#fff";
    c.font = "bold 12px monospace";
    c.textAlign = "left";
    c.fillText(area.name, x + 8, y + 20);

    c.fillStyle = typeColor;
    c.font = "10px monospace";
    c.fillText(area.type.toUpperCase(), x + 8, y + 34);

    c.fillStyle = "#666";
    c.font = "9px monospace";
    c.fillText(area.quadrants.length + " quadrants", x + 8, y + 48);

    if (area.type === "wormhole" && area.targetSystem) {
      c.fillStyle = "#aa44ff";
      c.fillText("-> " + area.targetSystem, x + 8, y + 62);
    }
  }

  c.textAlign = "center";
  c.fillStyle = "#555";
  c.font = "11px monospace";
  c.fillText("Click an area to view quadrants", gw / 2, gh - 30);
}

function renderQuadrantMap(c, gw, gh, uni) {
  const sys = uni.systems[_uniMapSelectedSystem];
  if (!sys) { _uniMapLevel = "system"; return; }
  const area = sys.areas[_uniMapSelectedArea];
  if (!area) { _uniMapLevel = "area"; return; }

  c.fillStyle = "#0af";
  c.font = "bold 18px monospace";
  c.fillText(area.name + " - Quadrants", gw / 2, 40);

  const quads = area.quadrants;
  const cols = Math.min(4, quads.length);
  const rows = Math.ceil(quads.length / cols);
  const cellW = (gw - 80) / cols, cellH = Math.min(120, (gh - 140) / rows);
  const startX = 40, startY = 70;

  const mx = typeof mouse !== "undefined" ? mouse.x : 0;
  const my = typeof mouse !== "undefined" ? mouse.y : 0;
  _uniMapHover = null;

  for (let i = 0; i < quads.length; i++) {
    const q = quads[i];
    const col = i % cols, row = Math.floor(i / cols);
    const x = startX + col * cellW;
    const y = startY + row * cellH;
    const w = cellW - 8, h = cellH - 8;

    const hovered = mx > x && mx < x + w && my > y && my < y + h;
    if (hovered) _uniMapHover = q.id;

    const qDef = typeof QUADRANT_TYPES !== "undefined" ? QUADRANT_TYPES[q.type] : null;
    const typeColor = q.type === "station" ? "#00ff88" : q.type === "mining" ? "#ffaa00" :
                      q.type === "patrol" ? "#ff4444" : q.type === "debris" ? "#aa8844" :
                      q.type === "wormhole_tunnel" ? "#aa44ff" : q.type === "sun_zone" ? "#ffcc00" :
                      q.type === "mission" ? "#ff8844" : "#446688";

    c.fillStyle = hovered ? "rgba(255,255,255,0.06)" : "rgba(10,14,26,0.8)";
    c.fillRect(x, y, w, h);
    c.strokeStyle = typeColor;
    c.lineWidth = hovered ? 2 : 1;
    c.strokeRect(x, y, w, h);

    c.textAlign = "left";
    c.fillStyle = "#fff";
    c.font = "bold 11px monospace";
    c.fillText(q.name || q.id, x + 8, y + 18);

    c.fillStyle = typeColor;
    c.font = "10px monospace";
    c.fillText(q.type.toUpperCase(), x + 8, y + 32);

    if (qDef) {
      c.fillStyle = "#666";
      c.font = "9px monospace";
      let flags = [];
      if (qDef.hasStation) flags.push("STATION");
      if (qDef.hasAsteroids) flags.push("ASTEROIDS");
      if (qDef.hasPatrols) flags.push("PATROLS");
      c.fillText(flags.join(" | ") || "EMPTY SPACE", x + 8, y + 46);
    }

    // Travel button hint
    if (hovered) {
      c.fillStyle = "rgba(0,255,100,0.15)";
      c.fillRect(x + 4, y + h - 24, w - 8, 18);
      c.fillStyle = "#0f0";
      c.font = "bold 10px monospace";
      c.textAlign = "center";
      c.fillText("CLICK TO TRAVEL", x + w / 2, y + h - 10);
      c.textAlign = "left";
    }
  }

  c.textAlign = "center";
  c.fillStyle = "#555";
  c.font = "11px monospace";
  c.fillText("Click a quadrant to quantum travel there", gw / 2, gh - 30);

  // Fuel cost estimate
  c.fillStyle = "#888";
  c.font = "10px monospace";
  if (uniPlayer) c.fillText("Fuel: " + Math.floor(uniPlayer.fuel) + " / " + uniPlayer.fuelMax, gw / 2, gh - 48);
}

// ── MAP CLICK HANDLING ────────────────────────────────────────

function _uniHandleMapClick() {
  if (uniState !== "map" || !_uniMapHover) return;

  if (_uniMapLevel === "system") {
    _uniMapSelectedSystem = _uniMapHover;
    _uniMapLevel = "area";
  } else if (_uniMapLevel === "area") {
    _uniMapSelectedArea = _uniMapHover;
    _uniMapLevel = "quadrant";
  } else if (_uniMapLevel === "quadrant") {
    // Travel to this quadrant
    const sys = window._activeUniverse?.systems[_uniMapSelectedSystem];
    if (!sys) return;
    const area = sys.areas[_uniMapSelectedArea];
    if (!area) return;
    const quad = area.quadrants.find(q => q.id === _uniMapHover);
    if (!quad) return;

    // Check if wormhole tunnel — means system change
    if (quad.type === "wormhole_tunnel" && quad.toSystem) {
      beginWormholeTravel(quad);
      return;
    }

    // Check fuel
    const fuelCost = UNI_QUANTUM_FUEL_BASE / (uniPlayer?.fuelEfficiency || 1);
    if (uniPlayer && uniPlayer.fuel < fuelCost) {
      // Not enough fuel — flash warning
      return;
    }

    // Begin quantum travel
    _uniQuantumTarget = {
      systemId: _uniMapSelectedSystem,
      areaId: _uniMapSelectedArea,
      quadrant: quad,
    };
    if (uniPlayer) uniPlayer.fuel -= fuelCost;
    _uniQuantumTimer = UNI_QUANTUM_DURATION;
    uniState = "quantum";
  }
}

function _uniHandleMapBack() {
  if (_uniMapLevel === "quadrant") _uniMapLevel = "area";
  else if (_uniMapLevel === "area") _uniMapLevel = "system";
  else exitUniverse();
}

// ── WORMHOLE TRAVEL ───────────────────────────────────────────

function beginWormholeTravel(quad) {
  const fuelCost = (typeof FUEL_COSTS !== "undefined" ? FUEL_COSTS.wormholeFlat : 10) / (uniPlayer?.fuelEfficiency || 1);
  if (uniPlayer && uniPlayer.fuel < fuelCost) return;
  if (uniPlayer) uniPlayer.fuel -= fuelCost;

  const toSys = quad.toSystem;
  const uni = window._activeUniverse;
  if (!uni || !uni.systems[toSys]) return;

  _uniCurrentSystem = uni.systems[toSys];
  _uniMapSelectedSystem = toSys;
  _uniMapLevel = "area";

  // TODO: Phase 1+ — playable wormhole obstacle course
  // For now, just instant travel with a quick flash
  _uniQuantumTimer = 60; // shorter for wormholes
  _uniQuantumTarget = { systemId: toSys, areaId: null, quadrant: null, isWormhole: true };
  uniState = "quantum";
}

// ── QUANTUM TRAVEL ────────────────────────────────────────────

function uniUpdateQuantum() {
  _uniQuantumTimer--;
  if (_uniQuantumTimer <= 0) {
    if (_uniQuantumTarget && _uniQuantumTarget.quadrant) {
      const sys = window._activeUniverse?.systems[_uniQuantumTarget.systemId];
      if (sys) {
        _uniCurrentSystem = sys;
        _uniCurrentArea = sys.areas[_uniQuantumTarget.areaId] || null;
        loadQuadrant(_uniQuantumTarget.quadrant);
        uniState = "flying";
      } else {
        uniState = "map";
      }
    } else {
      // Wormhole — back to map in new system
      uniState = "map";
    }
    _uniQuantumTarget = null;
    if (typeof autoSaveUniverse === "function") autoSaveUniverse();
  }
}

function uniRenderQuantum(c, gw, gh) {
  const t = 1 - (_uniQuantumTimer / UNI_QUANTUM_DURATION);
  c.fillStyle = "#000";
  c.fillRect(0, 0, gw, gh);

  // Streaking stars effect
  const starCount = 60;
  for (let i = 0; i < starCount; i++) {
    const sx = ((i * 137 + _uniFrameCount * 12) % gw);
    const sy = ((i * 97 + 50) % gh);
    const len = 20 + t * 80;
    c.strokeStyle = "rgba(150,180,255," + (0.3 + t * 0.5) + ")";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(sx - len, sy);
    c.stroke();
  }

  // Center flash
  const flashR = t * gw * 0.3;
  const grad = c.createRadialGradient(gw / 2, gh / 2, 0, gw / 2, gh / 2, flashR);
  grad.addColorStop(0, "rgba(100,180,255," + (0.3 * t) + ")");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = grad;
  c.beginPath();
  c.arc(gw / 2, gh / 2, flashR, 0, Math.PI * 2);
  c.fill();

  // Text
  c.textAlign = "center";
  c.fillStyle = "#0af";
  c.font = "bold 18px monospace";
  const destName = _uniQuantumTarget?.quadrant?.name || _uniQuantumTarget?.systemId || "Unknown";
  c.fillText("QUANTUM TRAVEL", gw / 2, gh / 2 - 15);
  c.fillStyle = "#fff";
  c.font = "14px monospace";
  c.fillText(destName, gw / 2, gh / 2 + 10);
  c.textAlign = "left";
}

// ── LOAD QUADRANT ─────────────────────────────────────────────

function loadQuadrant(quad) {
  _uniCurrentQuadrant = quad;
  uniBullets = [];
  uniEnemyBullets = [];
  uniEnemies = [];
  uniAsteroids = [];
  uniPOIs = [];
  uniStation = null;
  uniBeamFlashes = [];
  uniHitEffects = [];
  uniDeathEffects = [];
  _uniInCombat = false;
  _uniDisengageTimer = 0;
  _uniMiningTarget = null;
  _uniMiningProgress = 0;

  // Generate quadrant contents
  const dangerLevel = _uniCurrentSystem?.dangerLevel || 1;
  _uniQuadrantContents = typeof generateQuadrantContents === "function"
    ? generateQuadrantContents(quad, dangerLevel)
    : { asteroids: [], pois: [], patrolSpawns: [] };

  // Apply deltas for depleted asteroids, discovered POIs
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;

  // Spawn asteroids
  _uniQuadrantContents.asteroids.forEach(ast => {
    const deltaKey = _uniCurrentSystem.id + ":" + (_uniCurrentArea?.id || "") + ":" + quad.id + ":" + ast.id;
    const depleted = world ? (typeof getDelta === "function" ? getDelta(world, deltaKey, "depleted") : undefined) : undefined;
    if (depleted) return; // skip depleted asteroids
    uniAsteroids.push({
      ...ast,
      w: 30 + Math.floor(ast.maxHealth / 5),
      h: 30 + Math.floor(ast.maxHealth / 5),
      color: ast.oreType === "gold" ? "#ffcc44" : ast.oreType === "quantanium" ? "#44ffcc" :
             ast.oreType === "scrap" ? "#888" : ast.oreType === "electronics" ? "#88aaff" : "#aa8866",
      rotation: 0,
    });
  });

  // Spawn POIs
  _uniQuadrantContents.pois.forEach(poi => {
    const deltaKey = _uniCurrentSystem.id + ":" + (_uniCurrentArea?.id || "") + ":" + quad.id + ":" + poi.id;
    const discovered = world ? (typeof getDelta === "function" ? getDelta(world, deltaKey, "discovered") : undefined) : undefined;
    uniPOIs.push({ ...poi, discovered: !!discovered, w: 20, h: 20 });
  });

  // Spawn station if applicable
  if (quad.station) {
    const gw = typeof GAME_W !== "undefined" ? GAME_W : 1280;
    const gh = typeof GAME_H !== "undefined" ? GAME_H : 720;
    uniStation = {
      x: gw * 0.7, y: gh * 0.4,
      w: 60, h: 60,
      color: "#00ff88",
      name: quad.station.name,
      data: quad.station,
      dockRange: 120,
    };
  }

  // Spawn patrol
  _uniQuadrantContents.patrolSpawns.forEach(ps => {
    const template = typeof PATROL_TEMPLATES !== "undefined" ? PATROL_TEMPLATES[ps.templateKey] : null;
    if (!template) return;
    template.ships.forEach((shipName, idx) => {
      const eDef = typeof ENEMIES !== "undefined" ? ENEMIES[shipName] : null;
      if (!eDef) return;
      const sizeNum = eDef.size || 2;
      const ew = Math.round((32 + sizeNum * 18) * (typeof SIZE_SCALE !== "undefined" ? SIZE_SCALE : 0.5));
      const eh = Math.round((20 + sizeNum * 10) * (typeof SIZE_SCALE !== "undefined" ? SIZE_SCALE : 0.5));
      uniEnemies.push({
        type: shipName,
        x: ps.x + idx * 60,
        y: ps.y + (idx % 2 === 0 ? -30 : 30),
        w: ew, h: eh,
        hp: eDef.hp, maxHp: eDef.hp,
        shields: eDef.shields, maxShields: eDef.shields,
        armor: eDef.armor || 200, maxArmor: eDef.armor || 200,
        armorType: eDef.armorType || "light",
        speed: eDef.speed,
        fireRate: eDef.fireRate,
        shootTimer: Math.floor(Math.random() * eDef.fireRate),
        img: typeof getImage === "function" ? getImage(eDef.image) : null,
        color: eDef.color,
        score: eDef.score || 50,
        spriteAngleOffset: Math.PI,
        rotation: Math.PI,
        turnSpeed: 0.04,
        vx: 0, vy: 0,
        aggroRange: ps.aggroRange || 300,
        aggroed: false,
        patrolX: ps.x + idx * 60,
        patrolY: ps.y + (idx % 2 === 0 ? -30 : 30),
        patrolAngle: Math.random() * Math.PI * 2,
        isPassive: template.hasPassive && idx === 0, // first ship in passive patrols is the passive one
        faction: template.faction,
      });
    });
  });

  // Place player
  if (uniPlayer) {
    const gw = typeof GAME_W !== "undefined" ? GAME_W : 1280;
    const gh = typeof GAME_H !== "undefined" ? GAME_H : 720;
    uniPlayer.x = 100;
    uniPlayer.y = gh / 2 - uniPlayer.h / 2;
    uniPlayer.vx = 0;
    uniPlayer.vy = 0;
  }
}

// ── FLYING / COMBAT UPDATE ────────────────────────────────────

function uniUpdateFlying() {
  if (!uniPlayer) return;
  const gw = typeof GAME_W !== "undefined" ? GAME_W : 1280;
  const gh = typeof GAME_H !== "undefined" ? GAME_H : 720;
  const k = typeof keys !== "undefined" ? keys : {};
  const m = typeof mouse !== "undefined" ? mouse : { x: gw / 2, y: gh / 2, down: false };
  const mj = typeof mobileJoy !== "undefined" ? mobileJoy : { active: false, dx: 0, dy: 0 };
  const isMobile = typeof IS_MOBILE !== "undefined" && IS_MOBILE;
  const ma = typeof mobileAim !== "undefined" ? mobileAim : { shooting: false };

  // Movement
  const accel = uniPlayer.speed * 0.18;
  const friction = 0.88;

  if (isMobile && mj.active) {
    uniPlayer.vx += mj.dx * accel;
    uniPlayer.vy += mj.dy * accel;
  }
  if (k["ArrowUp"] || k["KeyW"]) uniPlayer.vy -= accel;
  if (k["ArrowDown"] || k["KeyS"]) uniPlayer.vy += accel;
  if (k["ArrowLeft"] || k["KeyA"]) uniPlayer.vx -= accel;
  if (k["ArrowRight"] || k["KeyD"]) uniPlayer.vx += accel;

  uniPlayer.vx *= friction;
  uniPlayer.vy *= friction;
  const spd = Math.hypot(uniPlayer.vx, uniPlayer.vy);
  if (spd > uniPlayer.speed) {
    uniPlayer.vx *= uniPlayer.speed / spd;
    uniPlayer.vy *= uniPlayer.speed / spd;
  }

  uniPlayer.x = Math.max(0, Math.min(gw - uniPlayer.w, uniPlayer.x + uniPlayer.vx));
  uniPlayer.y = Math.max(0, Math.min(gh - uniPlayer.h, uniPlayer.y + uniPlayer.vy));
  uniPlayer.rotation = Math.atan2(m.y - uniPlayer.y - uniPlayer.h / 2, m.x - uniPlayer.x - uniPlayer.w / 2);

  // Fuel drain
  uniPlayer.fuel = Math.max(0, uniPlayer.fuel - UNI_FUEL_DRAIN_RATE / (uniPlayer.fuelEfficiency || 1));

  // Shield regen
  if (uniPlayer.shields < uniPlayer.maxShields) {
    uniPlayer.shields = Math.min(uniPlayer.maxShields, uniPlayer.shields + 0.05);
  }

  // Shooting
  const isShooting = isMobile ? ma.shooting : (k["Space"] || m.down);
  uniPlayer.shootTimer--;
  if (isShooting && uniPlayer.shootTimer <= 0 && uniPlayer.weaponStats) {
    const bullets = typeof fireBullets === "function"
      ? fireBullets(uniPlayer, uniPlayer.weaponStats, uniPlayer.rotation, true)
      : [];
    uniBullets.push(...bullets);
    uniPlayer.shootTimer = uniPlayer.weaponStats.fireInterval || 15;
    _uniDisengageTimer = 0; // reset disengage timer on attack
  }

  // Update disengage timer
  if (_uniInCombat) {
    _uniDisengageTimer++;
    if (_uniDisengageTimer >= UNI_DISENGAGE_TIME) {
      _uniInCombat = false;
      uniState = "flying";
    }
  }

  // Update bullets
  uniBullets.forEach(b => { b.x += b.vx || 0; b.y += b.vy || 0; });
  uniEnemyBullets.forEach(b => { b.x += b.vx || 0; b.y += b.vy || 0; });
  uniBullets = uniBullets.filter(b => b.x > -60 && b.x < gw + 60 && b.y > -60 && b.y < gh + 60);
  uniEnemyBullets = uniEnemyBullets.filter(b => b.x > -60 && b.x < gw + 60 && b.y > -60 && b.y < gh + 60);

  // Update beams
  uniBeamFlashes.forEach(f => f.life--);
  uniBeamFlashes = uniBeamFlashes.filter(f => f.life > 0);

  // Update enemies
  uniUpdateEnemies(gw, gh);

  // Collisions
  uniCheckCollisions();

  // Mining
  uniUpdateMining();

  // Station proximity check
  uniCheckStationDock();

  // POI discovery
  uniCheckPOIs();

  // Map key
  if (k["KeyM"] || k["Escape"]) {
    if (!_uniInCombat) {
      k["KeyM"] = false;
      k["Escape"] = false;
      uniState = "map";
      _uniMapLevel = "quadrant";
    }
  }

  // Check player death
  if (uniPlayer.hp <= 0) {
    // Universe death — respawn at last station with penalties
    uniPlayer.hp = uniPlayer.maxHp * 0.5;
    uniPlayer.shields = 0;
    uniPlayer.fuel = Math.max(10, uniPlayer.fuel);
    const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
    if (world) {
      const penalty = Math.floor(world.player.credits * 0.1);
      world.player.credits = Math.max(0, world.player.credits - penalty);
      if (window._activeUniverse) window._activeUniverse.player.credits = world.player.credits;
    }
    uniState = "map";
    _uniMapLevel = "system";
  }
}

// ── ENEMY AI ──────────────────────────────────────────────────

function uniUpdateEnemies(gw, gh) {
  if (!uniPlayer) return;
  const pcx = uniPlayer.x + uniPlayer.w / 2;
  const pcy = uniPlayer.y + uniPlayer.h / 2;

  uniEnemies.forEach(e => {
    if (e.dead) return;
    const ecx = e.x + e.w / 2;
    const ecy = e.y + e.h / 2;
    const distToPlayer = Math.hypot(pcx - ecx, pcy - ecy);

    // Aggro check
    if (!e.aggroed && distToPlayer < e.aggroRange) {
      e.aggroed = true;
      _uniInCombat = true;
      _uniDisengageTimer = 0;
      if (uniState === "flying") uniState = "combat";
    }

    if (e.isPassive && !e.aggroed) {
      // Passive ships patrol slowly
      e.patrolAngle += 0.005;
      const px = e.patrolX + Math.cos(e.patrolAngle) * 80;
      const py = e.patrolY + Math.sin(e.patrolAngle) * 80;
      const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1;
      e.vx += (dx / d) * 0.3;
      e.vy += (dy / d) * 0.3;
    } else if (e.isPassive && e.aggroed) {
      // Passive ship flees
      const dx = ecx - pcx, dy = ecy - pcy, d = Math.hypot(dx, dy) || 1;
      e.vx += (dx / d) * e.speed * 0.5;
      e.vy += (dy / d) * e.speed * 0.5;
      // Check if escaped
      if (e.x < -50 || e.x > gw + 50 || e.y < -50 || e.y > gh + 50) {
        e.dead = true;
      }
    } else if (e.aggroed) {
      // Combat AI — simplified from Arena
      const dx = pcx - ecx, dy = pcy - ecy, d = Math.hypot(dx, dy) || 1;
      const ndx = dx / d, ndy = dy / d;
      const accel = e.speed * 0.15;
      const targetDist = 300;

      if (d < 150) {
        e.vx -= ndx * accel * 3;
        e.vy -= ndy * accel * 3;
      } else if (d > targetDist + 80) {
        e.vx += ndx * accel * 1.5;
        e.vy += ndy * accel * 1.5;
      } else {
        const strafeSign = (uniEnemies.indexOf(e) % 2 === 0) ? 1 : -1;
        e.vx += (-ndy * strafeSign) * accel;
        e.vy += (ndx * strafeSign) * accel;
      }

      // Shoot at player
      e.shootTimer--;
      if (e.shootTimer <= 0) {
        const wStats = typeof getWeaponStats === "function" ? getWeaponStats("laser_repeater", 2) : null;
        if (wStats) {
          const pred = typeof predictPos === "function"
            ? predictPos(pcx, pcy, uniPlayer.vx || 0, uniPlayer.vy || 0, ecx, ecy, wStats.speed || 8)
            : { x: pcx, y: pcy };
          const angle = Math.atan2(pred.y - ecy, pred.x - ecx);
          const inaccuracy = (Math.random() - 0.5) * 0.3;
          const bullets = typeof fireBullets === "function"
            ? fireBullets({ x: ecx - e.w / 2, y: ecy - e.h / 2, w: e.w, h: e.h }, wStats, angle + inaccuracy, false)
            : [];
          uniEnemyBullets.push(...bullets);
        }
        e.shootTimer = e.fireRate;
      }
    } else {
      // Patrol
      e.patrolAngle += 0.008;
      const px = e.patrolX + Math.cos(e.patrolAngle) * 120;
      const py = e.patrolY + Math.sin(e.patrolAngle) * 120;
      const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1;
      e.vx += (dx / d) * 0.2;
      e.vy += (dy / d) * 0.2;
    }

    // Apply velocity
    e.vx *= 0.92;
    e.vy *= 0.92;
    const spd = Math.hypot(e.vx, e.vy);
    if (spd > e.speed) { e.vx *= e.speed / spd; e.vy *= e.speed / spd; }
    e.x += e.vx;
    e.y += e.vy;
    e.x = Math.max(0, Math.min(gw - e.w, e.x));
    e.y = Math.max(0, Math.min(gh - e.h, e.y));

    // Face player if aggroed, else face movement direction
    const targetRot = e.aggroed
      ? Math.atan2(pcy - ecy, pcx - ecx)
      : Math.atan2(e.vy, e.vx);
    let rotDiff = targetRot - (e.rotation || 0);
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    e.rotation = (e.rotation || 0) + Math.sign(rotDiff) * Math.min(Math.abs(rotDiff), e.turnSpeed || 0.04);

    // Shield regen
    if (e.shields < e.maxShields) e.shields = Math.min(e.maxShields, e.shields + 0.01);
  });

  uniEnemies = uniEnemies.filter(e => !e.dead);

  // Check if combat ended
  if (_uniInCombat && uniEnemies.filter(e => e.aggroed).length === 0) {
    _uniInCombat = false;
    uniState = "flying";
  }
}

// ── COLLISIONS ────────────────────────────────────────────────

function uniCheckCollisions() {
  if (!uniPlayer) return;

  // Player bullets vs enemies
  uniBullets.forEach(b => {
    if (b.dead) return;
    uniEnemies.forEach(e => {
      if (e.dead) return;
      if (!_uniOverlaps(b, e)) return;
      b.dead = true;
      // Simplified damage
      const dmg = b.damage || 10;
      if (e.shields > 0) {
        e.shields -= dmg * 0.5;
        if (e.shields < 0) { e.hp += e.shields; e.shields = 0; }
      } else {
        e.hp -= dmg * 0.8;
      }
      if (typeof spawnHitEffect === "function") spawnHitEffect(b.x, b.y, b);
      if (typeof playHitSound === "function") playHitSound(b.category || "laser");

      if (e.hp <= 0) {
        e.dead = true;
        if (typeof spawnDeathEffect === "function") spawnDeathEffect(e);
        if (typeof playExplosion === "function") playExplosion(3);
        // Credit reward
        const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
        if (world) {
          world.player.credits += e.score || 50;
          if (window._activeUniverse) window._activeUniverse.player.credits = world.player.credits;
        }
        // Loot from passive ships
        if (e.isPassive && uniPlayer.cargo.length < uniPlayer.cargoCapacity) {
          const lootTable = ["scrap", "iron", "copper", "electronics"];
          const loot = lootTable[Math.floor(Math.random() * lootTable.length)];
          uniPlayer.cargo.push({ commodity: loot, quantity: 1 + Math.floor(Math.random() * 3) });
        }
      }
    });
  });

  // Enemy bullets vs player
  uniEnemyBullets.forEach(b => {
    if (b.dead) return;
    if (!_uniOverlaps(b, uniPlayer)) return;
    b.dead = true;
    const dmg = b.damage || 8;
    if (uniPlayer.shields > 0) {
      uniPlayer.shields -= dmg * 0.5;
      if (uniPlayer.shields < 0) { uniPlayer.hp += uniPlayer.shields; uniPlayer.shields = 0; }
    } else {
      uniPlayer.hp -= dmg * 0.8;
    }
  });

  uniBullets = uniBullets.filter(b => !b.dead);
  uniEnemyBullets = uniEnemyBullets.filter(b => !b.dead);
}

function _uniOverlaps(a, b) {
  const acx = a.x + (a.w || 4) / 2, acy = a.y + (a.h || 4) / 2;
  const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
  const r = (Math.min(a.w || 4, a.h || 4) * 0.45) + (Math.min(b.w, b.h) * 0.45);
  return Math.hypot(acx - bcx, acy - bcy) < r;
}

// ── MINING ────────────────────────────────────────────────────

function uniUpdateMining() {
  if (!uniPlayer || uniPlayer.miningPower <= 0) { _uniMiningTarget = null; return; }
  const k = typeof keys !== "undefined" ? keys : {};

  // Find nearest asteroid in range
  const pcx = uniPlayer.x + uniPlayer.w / 2;
  const pcy = uniPlayer.y + uniPlayer.h / 2;
  let nearest = null, nearestDist = 120; // mining range

  uniAsteroids.forEach(ast => {
    if (ast.depleted) return;
    const d = Math.hypot(ast.x - pcx, ast.y - pcy);
    if (d < nearestDist) { nearestDist = d; nearest = ast; }
  });

  const holdingMine = k["KeyH"]; // H to mine, or could use mouse

  if (nearest && holdingMine && uniPlayer.cargo.length < uniPlayer.cargoCapacity) {
    _uniMiningTarget = nearest;
    _uniMiningProgress += UNI_MINE_RATE * (uniPlayer.miningPower / 10);

    if (_uniMiningProgress >= nearest.health) {
      // Asteroid depleted
      nearest.depleted = true;
      _uniMiningProgress = 0;
      _uniMiningTarget = null;

      // Add ore to cargo
      const existing = uniPlayer.cargo.find(c => c.commodity === nearest.oreType);
      if (existing) {
        existing.quantity += 1;
      } else if (uniPlayer.cargo.length < uniPlayer.cargoCapacity) {
        uniPlayer.cargo.push({ commodity: nearest.oreType, quantity: 1 });
      }

      // Record delta
      const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
      if (world && typeof addDelta === "function") {
        const deltaKey = _uniCurrentSystem.id + ":" + (_uniCurrentArea?.id || "") + ":" + _uniCurrentQuadrant.id + ":" + nearest.id;
        addDelta(world, deltaKey, "depleted", true);
      }

      uniAsteroids = uniAsteroids.filter(a => !a.depleted);
    }
  } else {
    _uniMiningTarget = null;
    _uniMiningProgress = Math.max(0, _uniMiningProgress - 0.5);
  }
}

// ── STATION DOCKING ───────────────────────────────────────────

function uniCheckStationDock() {
  if (!uniStation || !uniPlayer || _uniInCombat) return;
  const k = typeof keys !== "undefined" ? keys : {};

  const pcx = uniPlayer.x + uniPlayer.w / 2;
  const pcy = uniPlayer.y + uniPlayer.h / 2;
  const scx = uniStation.x + uniStation.w / 2;
  const scy = uniStation.y + uniStation.h / 2;
  const dist = Math.hypot(pcx - scx, pcy - scy);

  uniStation._playerNear = dist < uniStation.dockRange;

  if (uniStation._playerNear && k["KeyE"]) {
    k["KeyE"] = false;
    uniState = "docked";
    _uniDockedStation = uniStation.data;
    _uniStationTab = "trading";
    if (typeof autoSaveUniverse === "function") autoSaveUniverse();
  }
}

// ── POI DISCOVERY ─────────────────────────────────────────────

function uniCheckPOIs() {
  if (!uniPlayer) return;
  const pcx = uniPlayer.x + uniPlayer.w / 2;
  const pcy = uniPlayer.y + uniPlayer.h / 2;

  uniPOIs.forEach(poi => {
    if (poi.discovered) return;
    const d = Math.hypot(poi.x - pcx, poi.y - pcy);
    if (d < uniPlayer.scanRange * 0.5) {
      poi.discovered = true;
      const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
      if (world && typeof addDelta === "function") {
        const deltaKey = _uniCurrentSystem.id + ":" + (_uniCurrentArea?.id || "") + ":" + _uniCurrentQuadrant.id + ":" + poi.id;
        addDelta(world, deltaKey, "discovered", true);
      }
    }
  });
}

// ── STATION UI (DOCKED) ───────────────────────────────────────

let _uniDockedStation = null;
let _uniStationTab = "trading";
let _uniTradeSelected = -1; // selected commodity row index

function uniRenderDocked(c, gw, gh) {
  // Dim background
  c.fillStyle = "rgba(0,0,10,0.92)";
  c.fillRect(0, 0, gw, gh);

  if (!_uniDockedStation) { uniState = "flying"; return; }

  const st = _uniDockedStation;
  const panelW = Math.min(600, gw - 40);
  const panelH = Math.min(500, gh - 40);
  const px = (gw - panelW) / 2;
  const py = (gh - panelH) / 2;

  // Panel background
  c.fillStyle = "#0a0e1a";
  c.fillRect(px, py, panelW, panelH);
  c.strokeStyle = "#0af";
  c.lineWidth = 2;
  c.strokeRect(px, py, panelW, panelH);

  // Station name
  c.textAlign = "center";
  c.fillStyle = "#0af";
  c.font = "bold 18px monospace";
  c.fillText(st.name, gw / 2, py + 28);

  // Tabs
  const tabs = ["trading", "refuel", "repair", "missions", "shipyard"];
  const tabW = panelW / tabs.length;
  tabs.forEach((tab, i) => {
    const tx = px + i * tabW;
    const isActive = tab === _uniStationTab;
    c.fillStyle = isActive ? "rgba(0,170,255,0.15)" : "rgba(0,0,0,0.3)";
    c.fillRect(tx, py + 40, tabW, 28);
    c.strokeStyle = isActive ? "#0af" : "#333";
    c.lineWidth = 1;
    c.strokeRect(tx, py + 40, tabW, 28);
    c.fillStyle = isActive ? "#0af" : "#888";
    c.font = "bold 10px monospace";
    c.fillText(tab.toUpperCase(), tx + tabW / 2, py + 58);
  });

  // Tab content area
  const contentY = py + 75;
  const contentH = panelH - 110;

  if (_uniStationTab === "trading") {
    uniRenderTrading(c, px + 10, contentY, panelW - 20, contentH, st);
  } else if (_uniStationTab === "refuel") {
    uniRenderRefuel(c, px + 10, contentY, panelW - 20, contentH);
  } else if (_uniStationTab === "repair") {
    uniRenderRepair(c, px + 10, contentY, panelW - 20, contentH);
  } else if (_uniStationTab === "missions") {
    uniRenderMissions(c, px + 10, contentY, panelW - 20, contentH);
  } else if (_uniStationTab === "shipyard") {
    uniRenderShipyard(c, px + 10, contentY, panelW - 20, contentH);
  }

  // Leave button
  c.textAlign = "center";
  c.fillStyle = "rgba(255,255,255,0.08)";
  c.fillRect(px + panelW / 2 - 60, py + panelH - 30, 120, 24);
  c.strokeStyle = "#888";
  c.lineWidth = 1;
  c.strokeRect(px + panelW / 2 - 60, py + panelH - 30, 120, 24);
  c.fillStyle = "#aaa";
  c.font = "bold 11px monospace";
  c.fillText("[ESC] UNDOCK", gw / 2, py + panelH - 14);
  c.textAlign = "left";
}

// ── TRADING ───────────────────────────────────────────────────

function uniRenderTrading(c, x, y, w, h, station) {
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
  const credits = world ? world.player.credits : 0;
  const commodities = typeof COMMODITY_DEFS !== "undefined" ? COMMODITY_DEFS : {};

  c.fillStyle = "#fff";
  c.font = "bold 12px monospace";
  c.textAlign = "left";
  c.fillText("Credits: " + credits.toLocaleString() + " SC", x, y + 14);
  c.fillText("Cargo: " + _uniCargoCount() + " / " + uniPlayer.cargoCapacity, x + w - 200, y + 14);

  const comKeys = Object.keys(commodities);
  const rowH = 22;
  let cy = y + 32;

  // Header
  c.fillStyle = "#666";
  c.font = "10px monospace";
  c.fillText("COMMODITY", x, cy);
  c.fillText("STOCK", x + 170, cy);
  c.fillText("PRICE", x + 230, cy);
  c.fillText("HAVE", x + 310, cy);
  cy += 16;

  // Store row positions for click detection
  window._uniTradeRows = [];

  comKeys.forEach((key, idx) => {
    if (cy > y + h - 40) return;
    const def = commodities[key];
    const stationId = station.id;
    const stock = typeof getStationStock === "function" && world
      ? getStationStock(world, stationId, key) : 50;
    const price = typeof calculatePrice === "function"
      ? calculatePrice(key, typeof deriveEntitySeed === "function" ? deriveEntitySeed(world?.masterSeed || 0, stationId) : 0, 1, 1)
      : def.basePrice;
    const playerHas = uniPlayer.cargo.find(c => c.commodity === key);
    const playerQty = playerHas ? playerHas.quantity : 0;

    const isSelected = idx === _uniTradeSelected;

    // Row background
    if (isSelected) {
      c.fillStyle = "rgba(0,170,255,0.12)";
      c.fillRect(x - 4, cy - 12, w + 8, rowH);
    }

    window._uniTradeRows.push({ idx, key, y1: cy - 12, y2: cy - 12 + rowH, price, stock, playerQty });

    c.fillStyle = isSelected ? "#fff" : (def.rarity === "rare" ? "#ffcc44" : def.rarity === "uncommon" ? "#88aaff" : "#ccc");
    c.font = "11px monospace";
    c.fillText(def.name, x, cy);
    c.fillStyle = "#aaa";
    c.fillText(stock.toString(), x + 170, cy);
    c.fillText(price + " SC", x + 230, cy);
    c.fillStyle = playerQty > 0 ? "#ffaa00" : "#555";
    c.fillText(playerQty.toString(), x + 310, cy);

    // Buy/sell hints for selected row
    if (isSelected) {
      const canBuy = stock > 0 && credits >= price && _uniCargoCount() < uniPlayer.cargoCapacity;
      const canSell = playerQty > 0;
      c.fillStyle = canBuy ? "#0f0" : "#444";
      c.fillText("[B]uy", x + 370, cy);
      c.fillStyle = canSell ? "#ff8800" : "#444";
      c.fillText("[N]sell", x + 430, cy);
    }

    cy += rowH;
  });

  // Navigation hint
  c.fillStyle = "#555";
  c.font = "9px monospace";
  c.fillText("Click row to select. [B] Buy 1. [N] Sell 1. [UP/DOWN] Navigate.", x, y + h - 8);

  // Handle buy/sell keys
  const k = typeof keys !== "undefined" ? keys : {};
  if (_uniTradeSelected >= 0 && _uniTradeSelected < comKeys.length) {
    const row = window._uniTradeRows?.find(r => r.idx === _uniTradeSelected);
    if (row) {
      if (k["KeyB"]) {
        k["KeyB"] = false;
        _uniTradeBuy(row.key, row.price, station.id, world);
      }
      if (k["KeyN"]) {
        k["KeyN"] = false;
        _uniTradeSell(row.key, row.price, station.id, world);
      }
    }
  }
  // Navigate with arrows (only in docked/trading)
  if (k["ArrowUp"]) { k["ArrowUp"] = false; _uniTradeSelected = Math.max(0, _uniTradeSelected - 1); }
  if (k["ArrowDown"]) { k["ArrowDown"] = false; _uniTradeSelected = Math.min(comKeys.length - 1, _uniTradeSelected + 1); }
}

function _uniCargoCount() {
  if (!uniPlayer || !uniPlayer.cargo) return 0;
  return uniPlayer.cargo.reduce((sum, c) => sum + c.quantity, 0);
}

function _uniTradeBuy(commodityKey, price, stationId, world) {
  if (!world || !uniPlayer) return;
  const credits = world.player.credits;
  const stock = typeof getStationStock === "function" ? getStationStock(world, stationId, commodityKey) : 0;
  if (stock <= 0 || credits < price || _uniCargoCount() >= uniPlayer.cargoCapacity) return;

  // Deduct credits
  world.player.credits -= price;
  if (window._activeUniverse) window._activeUniverse.player.credits = world.player.credits;

  // Reduce station stock
  if (typeof modifyStationStock === "function") modifyStationStock(world, stationId, commodityKey, -1);

  // Add to cargo
  const existing = uniPlayer.cargo.find(c => c.commodity === commodityKey);
  if (existing) existing.quantity += 1;
  else uniPlayer.cargo.push({ commodity: commodityKey, quantity: 1 });
}

function _uniTradeSell(commodityKey, price, stationId, world) {
  if (!world || !uniPlayer) return;
  const existing = uniPlayer.cargo.find(c => c.commodity === commodityKey);
  if (!existing || existing.quantity <= 0) return;

  // Add credits (sell at 90% of buy price)
  const sellPrice = Math.floor(price * 0.9);
  world.player.credits += sellPrice;
  if (window._activeUniverse) window._activeUniverse.player.credits = world.player.credits;

  // Increase station stock
  if (typeof modifyStationStock === "function") modifyStationStock(world, stationId, commodityKey, 1);

  // Remove from cargo
  existing.quantity -= 1;
  if (existing.quantity <= 0) uniPlayer.cargo = uniPlayer.cargo.filter(c => c.quantity > 0);
}

// ── REFUEL ────────────────────────────────────────────────────

function uniRenderRefuel(c, x, y, w, h) {
  if (!uniPlayer) return;
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
  const credits = world ? world.player.credits : 0;
  const fuelNeeded = uniPlayer.fuelMax - uniPlayer.fuel;
  const pricePerUnit = typeof FUEL_COSTS !== "undefined" ? FUEL_COSTS.refuelPricePerUnit : 2;
  const totalCost = Math.ceil(fuelNeeded * pricePerUnit);

  c.textAlign = "center";
  c.fillStyle = "#fff";
  c.font = "bold 14px monospace";
  c.fillText("REFUEL", x + w / 2, y + 20);

  // Fuel bar
  const barW = w * 0.6, barH = 24;
  const barX = x + (w - barW) / 2, barY = y + 40;
  c.fillStyle = "#222";
  c.fillRect(barX, barY, barW, barH);
  const fuelFrac = uniPlayer.fuel / uniPlayer.fuelMax;
  c.fillStyle = fuelFrac > 0.5 ? "#0af" : fuelFrac > 0.2 ? "#ff8800" : "#ff4444";
  c.fillRect(barX, barY, barW * fuelFrac, barH);
  c.strokeStyle = "#444";
  c.strokeRect(barX, barY, barW, barH);

  c.fillStyle = "#fff";
  c.font = "12px monospace";
  c.fillText(Math.floor(uniPlayer.fuel) + " / " + uniPlayer.fuelMax, x + w / 2, barY + 16);

  c.fillStyle = "#aaa";
  c.font = "12px monospace";
  c.fillText("Fuel needed: " + Math.ceil(fuelNeeded), x + w / 2, barY + 50);
  c.fillText("Cost: " + totalCost + " SC", x + w / 2, barY + 68);
  c.fillText("Your credits: " + credits.toLocaleString() + " SC", x + w / 2, barY + 86);

  // Refuel button
  const canRefuel = fuelNeeded > 0.5 && credits >= totalCost;
  const btnY = barY + 105;
  c.fillStyle = canRefuel ? "rgba(0,170,255,0.2)" : "rgba(50,50,50,0.3)";
  c.fillRect(x + w / 2 - 80, btnY, 160, 30);
  c.strokeStyle = canRefuel ? "#0af" : "#555";
  c.strokeRect(x + w / 2 - 80, btnY, 160, 30);
  c.fillStyle = canRefuel ? "#0af" : "#555";
  c.font = "bold 12px monospace";
  c.fillText(fuelNeeded < 0.5 ? "TANK FULL" : "[R] REFUEL", x + w / 2, btnY + 20);

  c.textAlign = "left";

  // Handle refuel input
  const k = typeof keys !== "undefined" ? keys : {};
  if (k["KeyR"] && canRefuel) {
    k["KeyR"] = false;
    uniPlayer.fuel = uniPlayer.fuelMax;
    if (world) {
      world.player.credits -= totalCost;
      if (window._activeUniverse) window._activeUniverse.player.credits = world.player.credits;
    }
  }
}

// ── REPAIR ────────────────────────────────────────────────────

function uniRenderRepair(c, x, y, w, h) {
  if (!uniPlayer) return;
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
  const credits = world ? world.player.credits : 0;
  const hpNeeded = uniPlayer.maxHp - uniPlayer.hp;
  const repairCost = Math.ceil(hpNeeded * 0.5);

  c.textAlign = "center";
  c.fillStyle = "#fff";
  c.font = "bold 14px monospace";
  c.fillText("REPAIR BAY", x + w / 2, y + 20);

  // HP bar
  const barW = w * 0.6, barH = 20;
  const barX = x + (w - barW) / 2, barY = y + 44;
  c.fillStyle = "#222"; c.fillRect(barX, barY, barW, barH);
  const hpFrac = uniPlayer.hp / uniPlayer.maxHp;
  c.fillStyle = hpFrac > 0.5 ? "#0f0" : hpFrac > 0.25 ? "#ff8800" : "#ff4444";
  c.fillRect(barX, barY, barW * hpFrac, barH);
  c.fillStyle = "#fff"; c.font = "11px monospace";
  c.fillText("HP: " + Math.floor(uniPlayer.hp) + " / " + uniPlayer.maxHp, x + w / 2, barY + 15);

  // Armor bar
  const arY = barY + 30;
  c.fillStyle = "#222"; c.fillRect(barX, arY, barW, barH);
  const arFrac = uniPlayer.armor / uniPlayer.maxArmor;
  c.fillStyle = "#ccc"; c.fillRect(barX, arY, barW * arFrac, barH);
  c.fillStyle = "#fff";
  c.fillText("Armor: " + Math.floor(uniPlayer.armor) + " / " + uniPlayer.maxArmor, x + w / 2, arY + 15);

  c.fillStyle = "#aaa"; c.font = "12px monospace";
  c.fillText("Repair cost: " + repairCost + " SC", x + w / 2, arY + 50);

  const canRepair = hpNeeded > 0.5 && credits >= repairCost;
  const btnY = arY + 65;
  c.fillStyle = canRepair ? "rgba(0,255,100,0.15)" : "rgba(50,50,50,0.3)";
  c.fillRect(x + w / 2 - 80, btnY, 160, 30);
  c.strokeStyle = canRepair ? "#0f0" : "#555";
  c.strokeRect(x + w / 2 - 80, btnY, 160, 30);
  c.fillStyle = canRepair ? "#0f0" : "#555";
  c.font = "bold 12px monospace";
  c.fillText(hpNeeded < 0.5 ? "HULL OK" : "[F] REPAIR", x + w / 2, btnY + 20);
  c.textAlign = "left";

  const k = typeof keys !== "undefined" ? keys : {};
  if (k["KeyF"] && canRepair) {
    k["KeyF"] = false;
    uniPlayer.hp = uniPlayer.maxHp;
    uniPlayer.armor = uniPlayer.maxArmor;
    if (world) {
      world.player.credits -= repairCost;
      if (window._activeUniverse) window._activeUniverse.player.credits = world.player.credits;
    }
  }
}

// ── MISSIONS (placeholder) ────────────────────────────────────

function uniRenderMissions(c, x, y, w, h) {
  c.textAlign = "center";
  c.fillStyle = "#888";
  c.font = "14px monospace";
  c.fillText("Mission Board", x + w / 2, y + 30);
  c.fillStyle = "#555";
  c.font = "11px monospace";
  c.fillText("Missions coming in Phase 1", x + w / 2, y + 55);
  c.textAlign = "left";
}

// ── SHIPYARD (placeholder) ────────────────────────────────────

function uniRenderShipyard(c, x, y, w, h) {
  c.textAlign = "center";
  c.fillStyle = "#888";
  c.font = "14px monospace";
  c.fillText("Shipyard", x + w / 2, y + 30);
  c.fillStyle = "#555";
  c.font = "11px monospace";
  c.fillText("Ship switching coming in Phase 1", x + w / 2, y + 55);
  c.textAlign = "left";
}

// ── FLYING RENDER ─────────────────────────────────────────────

function uniRenderFlying(c, gw, gh) {
  // Star background
  if (typeof _buildStarBg === "function" && typeof _starCanvas !== "undefined") {
    if (!_starCanvas) _buildStarBg();
    if (_starCanvas) c.drawImage(_starCanvas, 0, 0);
    else { c.fillStyle = "#020611"; c.fillRect(0, 0, gw, gh); }
  } else {
    c.fillStyle = "#020611";
    c.fillRect(0, 0, gw, gh);
  }

  // Asteroids
  uniAsteroids.forEach(ast => {
    c.save();
    c.fillStyle = ast.color;
    c.beginPath();
    c.arc(ast.x, ast.y, ast.w / 2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.15)";
    c.lineWidth = 1;
    c.stroke();
    // Health bar
    if (ast.health < ast.maxHealth) {
      c.fillStyle = "#333";
      c.fillRect(ast.x - ast.w / 2, ast.y - ast.h / 2 - 8, ast.w, 4);
      c.fillStyle = "#ffcc00";
      c.fillRect(ast.x - ast.w / 2, ast.y - ast.h / 2 - 8, ast.w * (ast.health / ast.maxHealth), 4);
    }
    c.restore();
  });

  // POIs
  uniPOIs.forEach(poi => {
    c.save();
    c.fillStyle = poi.discovered ? "#44ff88" : "#555";
    c.font = poi.discovered ? "bold 14px monospace" : "12px monospace";
    c.textAlign = "center";
    c.fillText(poi.discovered ? "[" + poi.type + "]" : "?", poi.x, poi.y);
    c.textAlign = "left";
    c.restore();
  });

  // Station
  if (uniStation) {
    c.save();
    c.fillStyle = "#0a1a0a";
    c.fillRect(uniStation.x, uniStation.y, uniStation.w, uniStation.h);
    c.strokeStyle = uniStation._playerNear ? "#0f0" : "#00ff88";
    c.lineWidth = uniStation._playerNear ? 3 : 1.5;
    c.strokeRect(uniStation.x, uniStation.y, uniStation.w, uniStation.h);
    c.fillStyle = "#00ff88";
    c.font = "bold 10px monospace";
    c.textAlign = "center";
    c.fillText(uniStation.name, uniStation.x + uniStation.w / 2, uniStation.y - 8);
    if (uniStation._playerNear) {
      c.fillStyle = "#0f0";
      c.fillText("[E] DOCK", uniStation.x + uniStation.w / 2, uniStation.y + uniStation.h + 16);
    }
    c.textAlign = "left";
    c.restore();
  }

  // Enemies
  uniEnemies.forEach(e => {
    if (typeof drawEntity === "function") drawEntity(e);
    else {
      c.fillStyle = e.color || "#ff4444";
      c.fillRect(e.x, e.y, e.w, e.h);
    }
    // Aggro indicator
    if (e.aggroed) {
      c.fillStyle = "#ff4444";
      c.font = "bold 9px monospace";
      c.textAlign = "center";
      c.fillText("HOSTILE", e.x + e.w / 2, e.y - 22);
      c.textAlign = "left";
    }
  });

  // Player
  if (uniPlayer) {
    if (typeof drawEntity === "function") drawEntity(uniPlayer);
    else {
      c.fillStyle = uniPlayer.color || "#4488ff";
      c.fillRect(uniPlayer.x, uniPlayer.y, uniPlayer.w, uniPlayer.h);
    }
  }

  // Bullets
  uniBullets.forEach(b => {
    c.fillStyle = b.color || "#88ddff";
    c.fillRect(b.x, b.y, b.w || 4, b.h || 4);
  });
  uniEnemyBullets.forEach(b => {
    c.fillStyle = b.color || "#ff8844";
    c.fillRect(b.x, b.y, b.w || 4, b.h || 4);
  });

  // Beam flashes
  uniBeamFlashes.forEach(f => {
    const alpha = f.life / f.maxLife;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = f.color || "#88ddff";
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x2, f.y2); c.stroke();
    c.restore();
  });

  // Hit/death effects (reuse Arena's if available)
  if (typeof drawHitEffects === "function") drawHitEffects();
  if (typeof drawDeathEffects === "function") drawDeathEffects();

  // Mining beam
  if (_uniMiningTarget && uniPlayer) {
    const progress = _uniMiningProgress / (_uniMiningTarget.maxHealth || 100);
    c.save();
    c.globalAlpha = 0.5 + progress * 0.5;
    c.strokeStyle = "#ffcc00";
    c.lineWidth = 2 + progress * 3;
    c.beginPath();
    c.moveTo(uniPlayer.x + uniPlayer.w / 2, uniPlayer.y + uniPlayer.h / 2);
    c.lineTo(_uniMiningTarget.x, _uniMiningTarget.y);
    c.stroke();
    c.restore();
  }

  // HUD
  uniRenderHUD(c, gw, gh);
}

// ── HUD ───────────────────────────────────────────────────────

function uniRenderHUD(c, gw, gh) {
  if (!uniPlayer) return;
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
  const credits = world ? world.player.credits : 0;

  // Top bar
  c.fillStyle = "rgba(0,0,0,0.6)";
  c.fillRect(0, 0, gw, 32);

  c.fillStyle = "#fff";
  c.font = "11px monospace";
  c.textAlign = "left";

  // Location
  const sysName = _uniCurrentSystem?.name || "Unknown";
  const areaName = _uniCurrentArea?.name || "";
  const quadName = _uniCurrentQuadrant?.name || "";
  c.fillText(sysName + (areaName ? " > " + areaName : "") + (quadName ? " > " + quadName : ""), 8, 14);

  // Credits
  c.fillStyle = "#ffcc00";
  c.textAlign = "right";
  c.fillText(credits.toLocaleString() + " SC", gw - 8, 14);

  // Bottom bar
  c.fillStyle = "rgba(0,0,0,0.6)";
  c.fillRect(0, gh - 48, gw, 48);

  // HP bar
  const barX = 8, barY = gh - 42, barW = 140, barH = 10;
  c.fillStyle = "#333"; c.fillRect(barX, barY, barW, barH);
  const hpFrac = Math.max(0, uniPlayer.hp / uniPlayer.maxHp);
  c.fillStyle = hpFrac > 0.5 ? "#0f0" : hpFrac > 0.25 ? "#ff8800" : "#ff4444";
  c.fillRect(barX, barY, barW * hpFrac, barH);
  c.fillStyle = "#aaa"; c.font = "9px monospace"; c.textAlign = "left";
  c.fillText("HP " + Math.floor(uniPlayer.hp), barX, barY + barH + 10);

  // Shield bar
  const shBarY = barY + 14;
  c.fillStyle = "#333"; c.fillRect(barX, shBarY, barW, barH);
  const shFrac = Math.max(0, uniPlayer.shields / uniPlayer.maxShields);
  c.fillStyle = "#0af";
  c.fillRect(barX, shBarY, barW * shFrac, barH);
  c.fillText("SH " + Math.floor(uniPlayer.shields), barX, shBarY + barH + 10);

  // Fuel bar
  const fuelX = 180;
  c.fillStyle = "#333"; c.fillRect(fuelX, barY, barW, barH);
  const fuelFrac = Math.max(0, uniPlayer.fuel / uniPlayer.fuelMax);
  c.fillStyle = fuelFrac > 0.3 ? "#0af" : fuelFrac > 0.1 ? "#ff8800" : "#ff4444";
  c.fillRect(fuelX, barY, barW * fuelFrac, barH);
  c.fillText("FUEL " + Math.floor(uniPlayer.fuel) + "/" + uniPlayer.fuelMax, fuelX, barY + barH + 10);

  // Cargo
  const cargoX = 360;
  c.fillStyle = "#aaa"; c.font = "10px monospace";
  c.fillText("CARGO " + uniPlayer.cargo.length + "/" + uniPlayer.cargoCapacity, cargoX, barY + 8);
  if (uniPlayer.cargo.length > 0) {
    const summary = uniPlayer.cargo.map(c => c.commodity + "x" + c.quantity).join(" ");
    c.fillStyle = "#777"; c.font = "9px monospace";
    c.fillText(summary, cargoX, barY + 22);
  }

  // Mining power indicator
  if (uniPlayer.miningPower > 0) {
    c.fillStyle = "#ffaa00"; c.font = "9px monospace";
    c.fillText("[H] Mine", cargoX, barY + 38);
  }

  // Combat status
  if (_uniInCombat) {
    c.fillStyle = "#ff4444"; c.font = "bold 11px monospace";
    c.textAlign = "center";
    c.fillText("IN COMBAT — Cannot quantum travel", gw / 2, gh - 52);
  }

  // Map hint
  c.textAlign = "right";
  c.fillStyle = "#666"; c.font = "10px monospace";
  c.fillText("[M] Map  [ESC] Map", gw - 8, gh - 6);

  c.textAlign = "left";
}

// ── INPUT HOOKS ───────────────────────────────────────────────
// Click handling for map and station UI

document.addEventListener("mousedown", function(e) {
  if (uniState === "inactive") return;
  if (uniState === "map") {
    _uniHandleMapClick();
    return;
  }
  if (uniState === "docked") {
    _uniHandleStationClick(e);
    return;
  }
});

document.addEventListener("keydown", function(e) {
  if (uniState === "inactive") return;

  if (uniState === "map" && e.code === "Escape") {
    e.preventDefault();
    _uniHandleMapBack();
    return;
  }

  if (uniState === "docked") {
    if (e.code === "Escape") {
      e.preventDefault();
      uniState = "flying";
      _uniDockedStation = null;
      return;
    }
    // Tab switching with number keys
    const tabMap = { "Digit1": "trading", "Digit2": "refuel", "Digit3": "repair", "Digit4": "missions", "Digit5": "shipyard" };
    if (tabMap[e.code]) {
      _uniStationTab = tabMap[e.code];
      return;
    }
  }
});

function _uniHandleStationClick(e) {
  if (!_uniDockedStation) return;
  const gw = typeof GAME_W !== "undefined" ? GAME_W : 1280;
  const gh = typeof GAME_H !== "undefined" ? GAME_H : 720;
  const ds = typeof displayScale !== "undefined" ? displayScale : 1;

  const mx = e.clientX / ds;
  const my = e.clientY / ds;

  const panelW = Math.min(600, gw - 40);
  const panelH = Math.min(500, gh - 40);
  const px = (gw - panelW) / 2;
  const py = (gh - panelH) / 2;

  // Tab clicks
  const tabs = ["trading", "refuel", "repair", "missions", "shipyard"];
  const tabW = panelW / tabs.length;
  if (my > py + 40 && my < py + 68) {
    const tabIdx = Math.floor((mx - px) / tabW);
    if (tabIdx >= 0 && tabIdx < tabs.length) {
      _uniStationTab = tabs[tabIdx];
    }
  }

  // Trading row clicks
  if (_uniStationTab === "trading" && window._uniTradeRows) {
    for (const row of window._uniTradeRows) {
      const rowScreenY1 = row.y1;
      const rowScreenY2 = row.y2;
      if (my > rowScreenY1 && my < rowScreenY2 && mx > px + 10 && mx < px + panelW - 10) {
        _uniTradeSelected = row.idx;
        break;
      }
    }
  }

  // Leave button
  if (my > py + panelH - 30 && my < py + panelH - 6 && mx > px + panelW / 2 - 60 && mx < px + panelW / 2 + 60) {
    uniState = "flying";
    _uniDockedStation = null;
  }
}

// ── INTEGRATION ───────────────────────────────────────────────
// universe_menu.js calls startUniverseMode() which checks for
// enterUniverse() (defined above). If found, launches real gameplay.
// If not (universe.js not loaded), shows placeholder.
// No redefinition needed here — universe_menu.js handles the routing.
