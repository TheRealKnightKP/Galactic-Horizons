// ============================================================
// universe.js v2 — Thin Universe Layer
// Handles: map UI, station UI, mining, fuel, cargo, quantum travel
// Delegates: flying, combat, rendering, particles to game.js
//
// game.js additions required (at bottom of this file as TODO):
//   - gameMode global ("arena" | "universe")
//   - camX, camY, quadW, quadH globals for camera
//   - Camera offset in render()
//   - Universe hooks in gameLoop()
//   - Clamp player to quadW/quadH in universe mode
// ============================================================

// ── STATE ─────────────────────────────────────────────────────
let uniState = "inactive"; // inactive | map | flying | docked | quantum
let _uniFrameCount = 0;
let _uniMapLoopId = null;

let _uniCurrentSystem = null;
let _uniCurrentArea = null;
let _uniCurrentQuadrant = null;
let _uniQuadrantContents = null;

// Station
let uniStation = null;
let _uniDockedStation = null;
let _uniStationTab = "trading";
let _uniTradeSelected = 0;

// Mining
let _uniMiningTarget = null;
let _uniMiningProgress = 0;
const UNI_MINE_RATE = 1.5;

// Combat tracking (universe layer watches, game.js does actual combat)
let _uniInCombat = false;
let _uniDisengageTimer = 0;
const UNI_DISENGAGE_TIME = 600; // 10s at 60fps

// Quantum
let _uniQuantumTarget = null;
let _uniQuantumTimer = 0;
const UNI_QUANTUM_DURATION = 120;

// Map UI
let _uniMapLevel = "system";
let _uniMapSelectedSystem = null;
let _uniMapSelectedArea = null;
let _uniMapHover = null;

// Fuel
const UNI_FUEL_DRAIN = 0.001;
const UNI_QUANTUM_FUEL = 5;

// Quadrant sizes by type (variable — mining big, stations small)
const UNI_QUAD_SIZES = {
  station:         { w: 2000, h: 1400 },
  outpost:         { w: 1800, h: 1200 },
  mining:          { w: 4000, h: 3000 },
  patrol:          { w: 3200, h: 2400 },
  open:            { w: 3600, h: 2800 },
  mission:         { w: 2800, h: 2000 },
  debris:          { w: 3600, h: 2600 },
  wormhole_tunnel: { w: 1600, h: 1000 },
  sun_zone:        { w: 2400, h: 2400 },
};

// Universe-specific entities that sit alongside game.js's enemies array
let uniAsteroids = [];
let uniPOIs = [];

// ── ENTER UNIVERSE ────────────────────────────────────────────

function enterUniverse(world) {
  if (!world || !window._activeUniverse) return;
  const uni = window._activeUniverse;
  const p = world.player;

  // Tell game.js we're in universe mode
  if (typeof window.gameMode === "undefined") window.gameMode = "universe";
  else window.gameMode = "universe";

  _uniCurrentSystem = uni.systems[p.currentSystemId] || uni.systems["solara"];
  _uniMapSelectedSystem = _uniCurrentSystem.id;

  // Build player using Arena's setPlayerShip — gives us full combat: boost, missiles, turrets, specials
  const shipData = p.ownedShips[p.activeShipIdx || 0];
  if (!shipData) return;
  const shipKey = shipData.key;
  const uniStats = typeof UNIVERSE_SHIP_STATS !== "undefined" ? UNIVERSE_SHIP_STATS[shipKey] : null;

  if (typeof playerLoadout !== "undefined") playerLoadout.ship = shipKey;
  if (typeof setPlayerShip === "function") setPlayerShip(shipKey);

  // Augment game.js player with universe stats
  if (typeof player !== "undefined" && player) {
    player.fuel = shipData.fuel || uniStats?.fuelMax || 50;
    player.fuelMax = uniStats?.fuelMax || 50;
    player.fuelEfficiency = uniStats?.fuelEfficiency || 1.0;
    player.cargo = shipData.cargo ? [...shipData.cargo] : [];
    player.cargoCapacity = uniStats?.cargoCapacity || 2;
    player.miningPower = uniStats?.miningPower || 0;
    player.scanRange = uniStats?.scanRange || 100;
    // Restore saved HP if any
    if (shipData.hp !== null && shipData.hp !== undefined) player.hp = shipData.hp;
    if (shipData.shields !== null && shipData.shields !== undefined) player.shields = shipData.shields;
  }

  // Clear arena entities
  if (typeof enemies !== "undefined") enemies = [];
  if (typeof playerBullets !== "undefined") playerBullets = [];
  if (typeof enemyBullets !== "undefined") enemyBullets = [];
  if (typeof allies !== "undefined") allies = [];
  if (typeof hitEffects !== "undefined") hitEffects = [];
  if (typeof deathEffects !== "undefined") deathEffects = [];
  uniAsteroids = [];
  uniPOIs = [];
  uniStation = null;

  // If player was in a quadrant, load it
  if (p.currentQuadrantId && p.currentAreaId) {
    _uniCurrentArea = _uniCurrentSystem.areas[p.currentAreaId] || null;
    if (_uniCurrentArea) {
      const q = _uniCurrentArea.quadrants.find(q => q.id === p.currentQuadrantId);
      if (q) {
        uniLoadQuadrant(q);
        uniState = "flying";
        if (typeof state !== "undefined") state = "playing";
        _buildUniMobileUI();
        return;
      }
    }
  }

  // Default: show map
  uniState = "map";
  if (typeof state !== "undefined") state = "menu";
  _startUniMapLoop();
}

// ── EXIT UNIVERSE ─────────────────────────────────────────────

function exitUniverse() {
  _stopUniMapLoop();
  _hideUniMobileUI();
  uniState = "inactive";
  window.gameMode = "arena";
  if (typeof state !== "undefined") state = "menu";

  // Save player state back to world
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
  if (world && typeof player !== "undefined" && player) {
    const ship = world.player.ownedShips[world.player.activeShipIdx || 0];
    if (ship) {
      ship.fuel = player.fuel;
      ship.cargo = player.cargo ? [...player.cargo] : [];
      ship.hp = player.hp;
      ship.shields = player.shields;
    }
    world.player.currentSystemId = _uniCurrentSystem?.id || "solara";
    world.player.currentAreaId = _uniCurrentArea?.id || null;
    world.player.currentQuadrantId = _uniCurrentQuadrant?.id || null;
  }

  // Reset camera
  if (typeof window.camX !== "undefined") { window.camX = 0; window.camY = 0; }
  if (typeof window.quadW !== "undefined") { window.quadW = typeof GAME_W !== "undefined" ? GAME_W : 1280; }
  if (typeof window.quadH !== "undefined") { window.quadH = typeof GAME_H !== "undefined" ? GAME_H : 720; }

  // Reset entities
  uniAsteroids = [];
  uniPOIs = [];
  uniStation = null;
  _uniInCombat = false;

  if (typeof autoSaveUniverse === "function") autoSaveUniverse();
  if (typeof exitUniverseToMenu === "function") exitUniverseToMenu();
}

// ── LOAD QUADRANT ─────────────────────────────────────────────
// Sets up camera bounds, populates game.js enemies + universe asteroids/POIs/station

function uniLoadQuadrant(quad) {
  _uniCurrentQuadrant = quad;
  _uniInCombat = false;
  _uniDisengageTimer = 0;
  _uniMiningTarget = null;
  _uniMiningProgress = 0;

  // Set quadrant size for camera system
  const qSize = UNI_QUAD_SIZES[quad.type] || { w: 2800, h: 2000 };
  window.quadW = qSize.w;
  window.quadH = qSize.h;
  window.camX = 0;
  window.camY = 0;

  // Clear game.js entities
  if (typeof enemies !== "undefined") enemies = [];
  if (typeof playerBullets !== "undefined") playerBullets = [];
  if (typeof enemyBullets !== "undefined") enemyBullets = [];
  if (typeof hitEffects !== "undefined") hitEffects = [];
  if (typeof deathEffects !== "undefined") deathEffects = [];
  uniAsteroids = [];
  uniPOIs = [];
  uniStation = null;

  // Generate contents from seed
  const dangerLevel = _uniCurrentSystem?.dangerLevel || 1;
  _uniQuadrantContents = typeof generateQuadrantContents === "function"
    ? generateQuadrantContents(quad, dangerLevel) : { asteroids: [], pois: [], patrolSpawns: [] };

  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;

  // Spawn asteroids (universe-specific, not game.js enemies)
  _uniQuadrantContents.asteroids.forEach(ast => {
    const deltaKey = _uniCurrentSystem.id + ":" + (_uniCurrentArea?.id || "") + ":" + quad.id + ":" + ast.id;
    if (world && typeof getDelta === "function" && getDelta(world, deltaKey, "depleted")) return;
    // Scale positions to quadrant size
    const scaleX = qSize.w / 1280;
    const scaleY = qSize.h / 720;
    uniAsteroids.push({
      ...ast,
      x: ast.x * scaleX,
      y: ast.y * scaleY,
      w: 30 + Math.floor(ast.maxHealth / 5),
      h: 30 + Math.floor(ast.maxHealth / 5),
      color: ast.oreType === "gold" ? "#ffcc44" : ast.oreType === "quantanium" ? "#44ffcc" :
             ast.oreType === "scrap" ? "#888" : ast.oreType === "electronics" ? "#88aaff" : "#aa8866",
    });
  });

  // Spawn POIs
  _uniQuadrantContents.pois.forEach(poi => {
    const deltaKey = _uniCurrentSystem.id + ":" + (_uniCurrentArea?.id || "") + ":" + quad.id + ":" + poi.id;
    const discovered = world && typeof getDelta === "function" ? getDelta(world, deltaKey, "discovered") : false;
    const scaleX = qSize.w / 1280;
    const scaleY = qSize.h / 720;
    uniPOIs.push({ ...poi, x: poi.x * scaleX, y: poi.y * scaleY, discovered: !!discovered, w: 24, h: 24 });
  });

  // Spawn station
  if (quad.station) {
    uniStation = {
      x: qSize.w * 0.5 - 40, y: qSize.h * 0.35,
      w: 80, h: 80,
      color: "#00ff88",
      name: quad.station.name,
      data: quad.station,
      dockRange: 150,
      _playerNear: false,
    };
  }

  // Spawn patrols into game.js enemies array (they use Arena combat automatically)
  _uniQuadrantContents.patrolSpawns.forEach(ps => {
    const template = typeof PATROL_TEMPLATES !== "undefined" ? PATROL_TEMPLATES[ps.templateKey] : null;
    if (!template) return;
    const scaleX = qSize.w / 1280;
    const scaleY = qSize.h / 720;
    template.ships.forEach((shipName, idx) => {
      const e = typeof createEnemyObject === "function"
        ? createEnemyObject(shipName, ps.x * scaleX + idx * 60, ps.y * scaleY + (idx % 2 === 0 ? -30 : 30))
        : null;
      if (!e) return;
      e.aggroRange = ps.aggroRange || 300;
      e.aggroed = false;
      e.patrolX = e.x;
      e.patrolY = e.y;
      e.patrolAngle = Math.random() * Math.PI * 2;
      e.isPassive = template.hasPassive && idx === 0;
      e.faction = template.faction;
      e._uniPatrol = true; // flag so game.js knows this is a universe patrol
      if (typeof enemies !== "undefined") enemies.push(e);
    });
  });

  // Place player
  if (typeof player !== "undefined" && player) {
    player.x = 100;
    player.y = qSize.h / 2 - player.h / 2;
    player.vx = 0;
    player.vy = 0;
  }
}

// ── UNIVERSE UPDATE (called from game.js gameLoop) ────────────
// This is the main universe tick. game.js calls this every frame
// when gameMode === "universe" and state === "playing".

function uniUpdate() {
  if (uniState !== "flying" || typeof player === "undefined" || !player) return;
  _uniFrameCount++;

  // Fuel drain
  player.fuel = Math.max(0, player.fuel - UNI_FUEL_DRAIN / (player.fuelEfficiency || 1));

  // Track combat state based on aggroed enemies
  const aggroedCount = (typeof enemies !== "undefined" ? enemies : []).filter(e => e._uniPatrol && e.aggroed).length;
  if (aggroedCount > 0 && !_uniInCombat) {
    _uniInCombat = true;
    _uniDisengageTimer = 0;
  }
  if (_uniInCombat && aggroedCount === 0) {
    _uniDisengageTimer++;
    if (_uniDisengageTimer > 120) { // 2 seconds after last enemy dies
      _uniInCombat = false;
    }
  }

  // Aggro check — enemies aggro when player is within range
  if (typeof enemies !== "undefined") {
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    enemies.forEach(e => {
      if (!e._uniPatrol || e.aggroed || e.dead) return;
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      if (Math.hypot(pcx - ecx, pcy - ecy) < (e.aggroRange || 300)) {
        e.aggroed = true;
        _uniInCombat = true;
        _uniDisengageTimer = 0;
      }
    });

    // Non-aggroed patrols do simple patrol movement
    enemies.forEach(e => {
      if (!e._uniPatrol || e.aggroed || e.dead) return;
      e.patrolAngle = (e.patrolAngle || 0) + 0.008;
      const px = e.patrolX + Math.cos(e.patrolAngle) * 120;
      const py = e.patrolY + Math.sin(e.patrolAngle) * 120;
      const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1;
      e.vx = (e.vx || 0) + (dx / d) * 0.2;
      e.vy = (e.vy || 0) + (dy / d) * 0.2;
      e.vx *= 0.95; e.vy *= 0.95;
      e.x += e.vx; e.y += e.vy;
      // Face movement direction
      const moveAngle = Math.atan2(e.vy, e.vx);
      let rd = moveAngle - (e.rotation || 0);
      while (rd > Math.PI) rd -= Math.PI * 2; while (rd < -Math.PI) rd += Math.PI * 2;
      e.rotation = (e.rotation || 0) + Math.sign(rd) * Math.min(Math.abs(rd), 0.03);
    });

    // Passive ships flee when aggroed instead of fighting
    enemies.forEach(e => {
      if (!e._uniPatrol || !e.isPassive || !e.aggroed || e.dead) return;
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      const dx = ecx - pcx, dy = ecy - pcy, d = Math.hypot(dx, dy) || 1;
      e.vx = (e.vx || 0) + (dx / d) * e.speed * 0.5;
      e.vy = (e.vy || 0) + (dy / d) * e.speed * 0.5;
      e.vx *= 0.95; e.vy *= 0.95;
      e.x += e.vx; e.y += e.vy;
      // If escaped quadrant, remove
      if (e.x < -100 || e.x > window.quadW + 100 || e.y < -100 || e.y > window.quadH + 100) {
        e.dead = true;
      }
    });

    // Loot drops from killed passive ships
    enemies.forEach(e => {
      if (!e._uniPatrol || !e.isPassive || !e.dead || e._looted) return;
      e._looted = true;
      if (player.cargo && _uniCargoCount() < player.cargoCapacity) {
        const lootTable = ["scrap", "iron", "copper", "electronics"];
        const loot = lootTable[Math.floor(Math.random() * lootTable.length)];
        const existing = player.cargo.find(c => c.commodity === loot);
        if (existing) existing.quantity += 1 + Math.floor(Math.random() * 3);
        else player.cargo.push({ commodity: loot, quantity: 1 + Math.floor(Math.random() * 3) });
      }
    });

    // Credit rewards from kills
    enemies.forEach(e => {
      if (!e._uniPatrol || !e.dead || e._credited) return;
      e._credited = true;
      const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
      if (world) {
        world.player.credits += e.score || 50;
        if (window._activeUniverse) window._activeUniverse.player.credits = world.player.credits;
      }
    });
  }

  // Mining
  _uniUpdateMining();

  // Station proximity
  _uniCheckStation();

  // POI discovery
  _uniCheckPOIs();

  // Player death
  if (player.hp <= 0) {
    player.hp = Math.floor(player.maxHp * 0.5);
    player.shields = 0;
    player.fuel = Math.max(10, player.fuel);
    const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
    if (world) {
      const penalty = Math.floor(world.player.credits * 0.1);
      world.player.credits = Math.max(0, world.player.credits - penalty);
      if (window._activeUniverse) window._activeUniverse.player.credits = world.player.credits;
    }
    uniState = "map";
    if (typeof state !== "undefined") state = "menu";
    _uniMapLevel = "system";
    _startUniMapLoop();
  }
}

// ── UNIVERSE RENDER OVERLAY (called from game.js render) ──────
// Draws universe-specific stuff ON TOP of game.js's normal render.
// game.js handles: player, enemies, bullets, particles, backgrounds.
// We add: asteroids, POIs, station, mining beam, universe HUD.

function uniRenderOverlay() {
  if (uniState !== "flying" || typeof ctx === "undefined") return;
  const c = ctx;
  const gw = typeof GAME_W !== "undefined" ? GAME_W : 1280;
  const gh = typeof GAME_H !== "undefined" ? GAME_H : 720;
  const cx = window.camX || 0;
  const cy = window.camY || 0;

  // Asteroids
  c.save();
  uniAsteroids.forEach(ast => {
    if (ast.depleted) return;
    const sx = ast.x - cx, sy = ast.y - cy;
    if (sx < -60 || sx > gw + 60 || sy < -60 || sy > gh + 60) return;
    c.fillStyle = ast.color;
    c.beginPath();
    c.arc(sx, sy, ast.w / 2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.15)";
    c.lineWidth = 1;
    c.stroke();
    // Health bar if damaged
    if (ast.health < ast.maxHealth) {
      c.fillStyle = "#333";
      c.fillRect(sx - ast.w / 2, sy - ast.h / 2 - 10, ast.w, 5);
      c.fillStyle = "#ffcc00";
      c.fillRect(sx - ast.w / 2, sy - ast.h / 2 - 10, ast.w * (ast.health / ast.maxHealth), 5);
    }
  });
  c.restore();

  // POIs
  uniPOIs.forEach(poi => {
    const sx = poi.x - cx, sy = poi.y - cy;
    if (sx < -40 || sx > gw + 40 || sy < -40 || sy > gh + 40) return;
    c.fillStyle = poi.discovered ? "#44ff88" : "rgba(255,255,255,0.3)";
    c.font = poi.discovered ? "bold 13px monospace" : "11px monospace";
    c.textAlign = "center";
    c.fillText(poi.discovered ? "[" + poi.type + "]" : "?", sx, sy);
    c.textAlign = "left";
  });

  // Station
  if (uniStation) {
    const sx = uniStation.x - cx, sy = uniStation.y - cy;
    c.fillStyle = "#0a1a0a";
    c.fillRect(sx, sy, uniStation.w, uniStation.h);
    c.strokeStyle = uniStation._playerNear ? "#0f0" : "#00ff88";
    c.lineWidth = uniStation._playerNear ? 3 : 1.5;
    c.strokeRect(sx, sy, uniStation.w, uniStation.h);
    c.fillStyle = "#00ff88";
    c.font = "bold 10px monospace";
    c.textAlign = "center";
    c.fillText(uniStation.name, sx + uniStation.w / 2, sy - 8);
    if (uniStation._playerNear) {
      c.fillStyle = "#0f0";
      c.font = "bold 12px monospace";
      c.fillText("DOCK", sx + uniStation.w / 2, sy + uniStation.h + 18);
    }
    c.textAlign = "left";
  }

  // Mining beam
  if (_uniMiningTarget && typeof player !== "undefined" && player) {
    const px = player.x + player.w / 2 - cx;
    const py = player.y + player.h / 2 - cy;
    const mx = _uniMiningTarget.x - cx;
    const my = _uniMiningTarget.y - cy;
    const progress = _uniMiningProgress / (_uniMiningTarget.maxHealth || 100);
    c.save();
    c.globalAlpha = 0.5 + progress * 0.5;
    c.strokeStyle = "#ffcc00";
    c.lineWidth = 2 + progress * 4;
    c.shadowColor = "#ffcc00";
    c.shadowBlur = 10;
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(mx, my);
    c.stroke();
    c.restore();
  }

  // Universe HUD (always on top, not affected by camera)
  _uniRenderHUD(c, gw, gh);
}

// ── HUD ───────────────────────────────────────────────────────

function _uniRenderHUD(c, gw, gh) {
  if (typeof player === "undefined" || !player) return;
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
  const credits = world ? world.player.credits : 0;

  // Top bar
  c.fillStyle = "rgba(0,0,0,0.55)";
  c.fillRect(0, 0, gw, 30);

  c.font = "11px monospace";
  c.textAlign = "left";

  // Location
  const sysName = _uniCurrentSystem?.name || "Unknown";
  const quadName = _uniCurrentQuadrant?.name || "";
  c.fillStyle = "#aaa";
  c.fillText(sysName + (quadName ? " > " + quadName : ""), 8, 12);

  // Credits
  c.fillStyle = "#ffcc00";
  c.textAlign = "right";
  c.fillText(credits.toLocaleString() + " SC", gw - 8, 12);

  // Status line
  c.textAlign = "center";
  if (_uniInCombat) {
    c.fillStyle = "#ff4444";
    c.font = "bold 11px monospace";
    c.fillText("COMBAT - Cannot quantum travel", gw / 2, 12);
  }

  // Fuel bar (bottom left area, above Arena boost bar position)
  const fuelX = 8, fuelY = gh - 90, fuelW = 150, fuelH = 10;
  c.fillStyle = "#222";
  c.fillRect(fuelX, fuelY, fuelW, fuelH);
  const fuelFrac = Math.max(0, player.fuel / (player.fuelMax || 50));
  c.fillStyle = fuelFrac > 0.3 ? "#0af" : fuelFrac > 0.1 ? "#ff8800" : "#ff4444";
  c.fillRect(fuelX, fuelY, fuelW * fuelFrac, fuelH);
  c.fillStyle = "#aaa";
  c.font = "9px monospace";
  c.textAlign = "left";
  c.fillText("FUEL " + Math.floor(player.fuel) + "/" + (player.fuelMax || 50), fuelX, fuelY + fuelH + 10);

  // Cargo indicator
  const cargoStr = "CARGO " + _uniCargoCount() + "/" + (player.cargoCapacity || 2);
  c.fillText(cargoStr, fuelX, fuelY + fuelH + 22);
  if (player.cargo && player.cargo.length > 0) {
    c.fillStyle = "#777";
    const summary = player.cargo.map(ci => ci.commodity + "x" + ci.quantity).join(" ");
    c.fillText(summary, fuelX, fuelY + fuelH + 34);
  }

  // Mining hint
  if (player.miningPower > 0) {
    c.fillStyle = "#ffaa00";
    c.fillText("[H] Mine nearby asteroids", fuelX + fuelW + 16, fuelY + 10);
  }

  // Map hint
  c.textAlign = "right";
  c.fillStyle = "#666";
  c.font = "10px monospace";
  c.fillText("[M] Map", gw - 8, gh - 90);

  c.textAlign = "left";
}

function _uniCargoCount() {
  if (typeof player === "undefined" || !player || !player.cargo) return 0;
  return player.cargo.reduce((sum, c) => sum + c.quantity, 0);
}

// ── MINING ────────────────────────────────────────────────────

function _uniUpdateMining() {
  if (typeof player === "undefined" || !player || (player.miningPower || 0) <= 0) {
    _uniMiningTarget = null; return;
  }
  const k = typeof keys !== "undefined" ? keys : {};
  const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
  const mineRange = 150;

  // Find nearest asteroid
  let nearest = null, nearestDist = mineRange;
  uniAsteroids.forEach(ast => {
    if (ast.depleted) return;
    const d = Math.hypot(ast.x - pcx, ast.y - pcy);
    if (d < nearestDist) { nearestDist = d; nearest = ast; }
  });

  if (nearest && k["KeyH"] && _uniCargoCount() < player.cargoCapacity) {
    _uniMiningTarget = nearest;
    _uniMiningProgress += UNI_MINE_RATE * (player.miningPower / 10);

    if (_uniMiningProgress >= nearest.health) {
      nearest.depleted = true;
      _uniMiningProgress = 0;
      _uniMiningTarget = null;

      // Add ore to cargo
      const existing = player.cargo.find(c => c.commodity === nearest.oreType);
      if (existing) existing.quantity += 1;
      else player.cargo.push({ commodity: nearest.oreType, quantity: 1 });

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

// ── STATION CHECK ─────────────────────────────────────────────

function _uniCheckStation() {
  if (!uniStation || typeof player === "undefined" || !player || _uniInCombat) return;
  const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
  const scx = uniStation.x + uniStation.w / 2, scy = uniStation.y + uniStation.h / 2;
  const dist = Math.hypot(pcx - scx, pcy - scy);

  uniStation._playerNear = dist < uniStation.dockRange;

  const k = typeof keys !== "undefined" ? keys : {};
  if (uniStation._playerNear && k["KeyE"]) {
    k["KeyE"] = false;
    _uniDockedStation = uniStation.data;
    _uniStationTab = "trading";
    _uniTradeSelected = 0;
    uniState = "docked";
    if (typeof state !== "undefined") state = "menu"; // pause game.js combat loop
    if (typeof autoSaveUniverse === "function") autoSaveUniverse();
  }
}

// ── POI CHECK ─────────────────────────────────────────────────

function _uniCheckPOIs() {
  if (typeof player === "undefined" || !player) return;
  const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
  uniPOIs.forEach(poi => {
    if (poi.discovered) return;
    if (Math.hypot(poi.x - pcx, poi.y - pcy) < (player.scanRange || 100) * 0.5) {
      poi.discovered = true;
      const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
      if (world && typeof addDelta === "function") {
        const deltaKey = _uniCurrentSystem.id + ":" + (_uniCurrentArea?.id || "") + ":" + _uniCurrentQuadrant.id + ":" + poi.id;
        addDelta(world, deltaKey, "discovered", true);
      }
    }
  });
}

// ── MAP KEY HANDLING (from flying) ────────────────────────────

function _uniCheckMapKey() {
  if (uniState !== "flying") return;
  const k = typeof keys !== "undefined" ? keys : {};
  if ((k["KeyM"] || k["Escape"]) && !_uniInCombat) {
    k["KeyM"] = false;
    k["Escape"] = false;
    uniState = "map";
    if (typeof state !== "undefined") state = "menu";
    _uniMapLevel = "quadrant";
    _startUniMapLoop();
  }
}

// ── QUANTUM TRAVEL ────────────────────────────────────────────

function uniStartQuantum(systemId, areaId, quad) {
  const fuelCost = UNI_QUANTUM_FUEL / (typeof player !== "undefined" && player ? player.fuelEfficiency || 1 : 1);
  if (typeof player !== "undefined" && player && player.fuel < fuelCost) return false;
  if (typeof player !== "undefined" && player) player.fuel -= fuelCost;

  _uniQuantumTarget = { systemId, areaId, quadrant: quad };
  _uniQuantumTimer = UNI_QUANTUM_DURATION;
  uniState = "quantum";
  return true;
}

function uniStartWormhole(toSystemId) {
  const fuelCost = (typeof FUEL_COSTS !== "undefined" ? FUEL_COSTS.wormholeFlat : 10) / (typeof player !== "undefined" && player ? player.fuelEfficiency || 1 : 1);
  if (typeof player !== "undefined" && player && player.fuel < fuelCost) return false;
  if (typeof player !== "undefined" && player) player.fuel -= fuelCost;

  const uni = window._activeUniverse;
  if (!uni || !uni.systems[toSystemId]) return false;
  _uniCurrentSystem = uni.systems[toSystemId];
  _uniMapSelectedSystem = toSystemId;
  _uniQuantumTarget = { systemId: toSystemId, isWormhole: true };
  _uniQuantumTimer = 60;
  uniState = "quantum";
  return true;
}

function _uniUpdateQuantum() {
  _uniQuantumTimer--;
  if (_uniQuantumTimer <= 0) {
    if (_uniQuantumTarget && _uniQuantumTarget.quadrant) {
      const sys = window._activeUniverse?.systems[_uniQuantumTarget.systemId];
      if (sys) {
        _uniCurrentSystem = sys;
        _uniCurrentArea = sys.areas[_uniQuantumTarget.areaId] || null;
        uniLoadQuadrant(_uniQuantumTarget.quadrant);
        uniState = "flying";
        if (typeof state !== "undefined") state = "playing";
        _buildUniMobileUI();
      } else {
        uniState = "map";
        _startUniMapLoop();
      }
    } else {
      // Wormhole — back to map in new system
      uniState = "map";
      _uniMapLevel = "area";
      _startUniMapLoop();
    }
    _uniQuantumTarget = null;
    if (typeof autoSaveUniverse === "function") autoSaveUniverse();
  }
}

function _uniRenderQuantum(c, gw, gh) {
  const t = 1 - (_uniQuantumTimer / UNI_QUANTUM_DURATION);
  c.fillStyle = "#000";
  c.fillRect(0, 0, gw, gh);

  // Streaking stars
  for (let i = 0; i < 60; i++) {
    const sx = ((i * 137 + _uniFrameCount * 12) % gw);
    const sy = ((i * 97 + 50) % gh);
    const len = 20 + t * 80;
    c.strokeStyle = "rgba(150,180,255," + (0.3 + t * 0.5) + ")";
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - len, sy); c.stroke();
  }

  // Flash
  const flashR = t * gw * 0.3;
  const grad = c.createRadialGradient(gw / 2, gh / 2, 0, gw / 2, gh / 2, Math.max(1, flashR));
  grad.addColorStop(0, "rgba(100,180,255," + (0.3 * t) + ")");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = grad;
  c.beginPath(); c.arc(gw / 2, gh / 2, Math.max(1, flashR), 0, Math.PI * 2); c.fill();

  c.textAlign = "center";
  c.fillStyle = "#0af";
  c.font = "bold 18px monospace";
  c.fillText("QUANTUM TRAVEL", gw / 2, gh / 2 - 15);
  c.fillStyle = "#fff";
  c.font = "14px monospace";
  const dest = _uniQuantumTarget?.quadrant?.name || _uniQuantumTarget?.systemId || "Unknown";
  c.fillText(dest, gw / 2, gh / 2 + 10);
  c.textAlign = "left";
}

// ── DOCKED (STATION) UI ───────────────────────────────────────

function uniRenderDockedUI() {
  if (uniState !== "docked" || !_uniDockedStation) return;
  const c = typeof ctx !== "undefined" ? ctx : null;
  if (!c) return;
  const gw = typeof GAME_W !== "undefined" ? GAME_W : 1280;
  const gh = typeof GAME_H !== "undefined" ? GAME_H : 720;

  c.fillStyle = "rgba(0,0,10,0.92)";
  c.fillRect(0, 0, gw, gh);

  const st = _uniDockedStation;
  const panelW = Math.min(620, gw - 30);
  const panelH = Math.min(520, gh - 30);
  const px = (gw - panelW) / 2;
  const py = (gh - panelH) / 2;

  // Panel
  c.fillStyle = "#090914";
  c.fillRect(px, py, panelW, panelH);
  c.strokeStyle = "#0af";
  c.lineWidth = 2;
  c.strokeRect(px, py, panelW, panelH);

  // Station name
  c.textAlign = "center";
  c.fillStyle = "#0af";
  c.font = "bold 18px monospace";
  c.fillText(st.name, gw / 2, py + 26);

  // Tabs as clickable buttons
  const tabs = [
    { id: "trading", label: "TRADE" },
    { id: "refuel", label: "REFUEL" },
    { id: "repair", label: "REPAIR" },
    { id: "missions", label: "MISSIONS" },
    { id: "shipyard", label: "SHIPS" },
  ];
  const tabW = (panelW - 20) / tabs.length;
  window._uniStationTabRects = [];
  tabs.forEach((tab, i) => {
    const tx = px + 10 + i * tabW;
    const ty = py + 38;
    const tw = tabW - 4;
    const th = 26;
    const isActive = tab.id === _uniStationTab;
    c.fillStyle = isActive ? "rgba(0,170,255,0.2)" : "rgba(0,0,0,0.4)";
    c.fillRect(tx, ty, tw, th);
    c.strokeStyle = isActive ? "#0af" : "#333";
    c.lineWidth = 1;
    c.strokeRect(tx, ty, tw, th);
    c.fillStyle = isActive ? "#0af" : "#888";
    c.font = "bold 10px monospace";
    c.fillText(tab.label, tx + tw / 2, ty + 17);
    window._uniStationTabRects.push({ id: tab.id, x: tx, y: ty, w: tw, h: th });
  });

  // Content area
  const contentX = px + 12, contentY = py + 72;
  const contentW = panelW - 24, contentH = panelH - 110;

  c.textAlign = "left";
  if (_uniStationTab === "trading") _uniRenderTrading(c, contentX, contentY, contentW, contentH, st);
  else if (_uniStationTab === "refuel") _uniRenderRefuel(c, contentX, contentY, contentW, contentH);
  else if (_uniStationTab === "repair") _uniRenderRepair(c, contentX, contentY, contentW, contentH);
  else if (_uniStationTab === "missions") _uniRenderPlaceholder(c, contentX, contentY, contentW, contentH, "Mission Board", "Missions coming in Phase 1");
  else if (_uniStationTab === "shipyard") _uniRenderPlaceholder(c, contentX, contentY, contentW, contentH, "Shipyard", "Ship switching coming in Phase 1");

  // Undock button
  const btnW = 140, btnH = 28;
  const btnX = px + (panelW - btnW) / 2, btnY = py + panelH - btnH - 8;
  c.fillStyle = "rgba(255,80,80,0.12)";
  c.fillRect(btnX, btnY, btnW, btnH);
  c.strokeStyle = "#f44";
  c.lineWidth = 1;
  c.strokeRect(btnX, btnY, btnW, btnH);
  c.fillStyle = "#f44";
  c.font = "bold 11px monospace";
  c.textAlign = "center";
  c.fillText("UNDOCK", px + panelW / 2, btnY + 18);
  window._uniUndockRect = { x: btnX, y: btnY, w: btnW, h: btnH };
  c.textAlign = "left";
}

// ── TRADING ───────────────────────────────────────────────────

function _uniRenderTrading(c, x, y, w, h, station) {
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
  const credits = world ? world.player.credits : 0;
  const commodities = typeof COMMODITY_DEFS !== "undefined" ? COMMODITY_DEFS : {};

  c.fillStyle = "#fff";
  c.font = "bold 12px monospace";
  c.fillText("Credits: " + credits.toLocaleString() + " SC", x, y + 14);
  c.textAlign = "right";
  c.fillText("Cargo: " + _uniCargoCount() + "/" + ((typeof player !== "undefined" && player) ? player.cargoCapacity : 0), x + w, y + 14);
  c.textAlign = "left";

  const comKeys = Object.keys(commodities);
  const rowH = 24;
  let cy = y + 34;

  // Header
  c.fillStyle = "#555";
  c.font = "10px monospace";
  c.fillText("ITEM", x, cy);
  c.fillText("STOCK", x + 160, cy);
  c.fillText("PRICE", x + 220, cy);
  c.fillText("HAVE", x + 290, cy);
  cy += 16;

  window._uniTradeRows = [];
  const stationId = station.id;

  comKeys.forEach((key, idx) => {
    if (cy > y + h - 50) return;
    const def = commodities[key];
    const stock = typeof getStationStock === "function" && world ? getStationStock(world, stationId, key) : 50;
    const price = typeof calculatePrice === "function"
      ? calculatePrice(key, typeof deriveEntitySeed === "function" ? deriveEntitySeed(world?.masterSeed || 0, stationId) : 0, 1, 1)
      : def.basePrice;
    const playerHas = (typeof player !== "undefined" && player && player.cargo) ? player.cargo.find(ci => ci.commodity === key) : null;
    const playerQty = playerHas ? playerHas.quantity : 0;
    const isSelected = idx === _uniTradeSelected;

    if (isSelected) { c.fillStyle = "rgba(0,170,255,0.1)"; c.fillRect(x - 2, cy - 12, w + 4, rowH); }

    window._uniTradeRows.push({ idx, key, y1: cy - 12, y2: cy - 12 + rowH, x: x, w: w, price, stock, playerQty });

    c.fillStyle = isSelected ? "#fff" : (def.rarity === "rare" ? "#ffcc44" : def.rarity === "uncommon" ? "#88aaff" : "#ccc");
    c.font = "11px monospace";
    c.fillText(def.name, x, cy);
    c.fillStyle = "#aaa";
    c.fillText(stock.toString(), x + 160, cy);
    c.fillText(price + " SC", x + 220, cy);
    c.fillStyle = playerQty > 0 ? "#ffaa00" : "#555";
    c.fillText(playerQty.toString(), x + 290, cy);

    // Buy/Sell buttons for selected row
    if (isSelected) {
      const canBuy = stock > 0 && credits >= price && _uniCargoCount() < ((typeof player !== "undefined" && player) ? player.cargoCapacity : 0);
      const canSell = playerQty > 0;
      // Buy button
      const buyX = x + 340, buyY = cy - 10, buyW = 50, buyH = 18;
      c.fillStyle = canBuy ? "rgba(0,255,100,0.15)" : "rgba(50,50,50,0.2)";
      c.fillRect(buyX, buyY, buyW, buyH);
      c.strokeStyle = canBuy ? "#0f0" : "#333";
      c.strokeRect(buyX, buyY, buyW, buyH);
      c.fillStyle = canBuy ? "#0f0" : "#444";
      c.font = "bold 9px monospace";
      c.fillText("BUY", buyX + 12, buyY + 13);
      // Sell button
      const sellX = buyX + buyW + 6, sellY = buyY, sellW = 50, sellH = 18;
      c.fillStyle = canSell ? "rgba(255,130,0,0.15)" : "rgba(50,50,50,0.2)";
      c.fillRect(sellX, sellY, sellW, sellH);
      c.strokeStyle = canSell ? "#ff8800" : "#333";
      c.strokeRect(sellX, sellY, sellW, sellH);
      c.fillStyle = canSell ? "#ff8800" : "#444";
      c.fillText("SELL", sellX + 10, sellY + 13);
      // Store rects for click detection
      window._uniTradeBuyRect = canBuy ? { x: buyX, y: buyY, w: buyW, h: buyH, key, price } : null;
      window._uniTradeSellRect = canSell ? { x: sellX, y: sellY, w: sellW, h: sellH, key, price } : null;
    }
    cy += rowH;
  });
}

function _uniTradeBuy(commodityKey, price, stationId) {
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
  if (!world || typeof player === "undefined" || !player) return;
  if (world.player.credits < price || _uniCargoCount() >= player.cargoCapacity) return;
  const stock = typeof getStationStock === "function" ? getStationStock(world, stationId, commodityKey) : 0;
  if (stock <= 0) return;
  world.player.credits -= price;
  if (window._activeUniverse) window._activeUniverse.player.credits = world.player.credits;
  if (typeof modifyStationStock === "function") modifyStationStock(world, stationId, commodityKey, -1);
  const existing = player.cargo.find(ci => ci.commodity === commodityKey);
  if (existing) existing.quantity += 1;
  else player.cargo.push({ commodity: commodityKey, quantity: 1 });
}

function _uniTradeSell(commodityKey, price, stationId) {
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
  if (!world || typeof player === "undefined" || !player) return;
  const existing = player.cargo.find(ci => ci.commodity === commodityKey);
  if (!existing || existing.quantity <= 0) return;
  const sellPrice = Math.floor(price * 0.9);
  world.player.credits += sellPrice;
  if (window._activeUniverse) window._activeUniverse.player.credits = world.player.credits;
  if (typeof modifyStationStock === "function") modifyStationStock(world, stationId, commodityKey, 1);
  existing.quantity -= 1;
  if (existing.quantity <= 0) player.cargo = player.cargo.filter(ci => ci.quantity > 0);
}

// ── REFUEL ────────────────────────────────────────────────────

function _uniRenderRefuel(c, x, y, w, h) {
  if (typeof player === "undefined" || !player) return;
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
  const credits = world ? world.player.credits : 0;
  const fuelNeeded = (player.fuelMax || 50) - player.fuel;
  const pricePerUnit = typeof FUEL_COSTS !== "undefined" ? FUEL_COSTS.refuelPricePerUnit : 2;
  const totalCost = Math.ceil(fuelNeeded * pricePerUnit);
  const canRefuel = fuelNeeded > 0.5 && credits >= totalCost;

  c.textAlign = "center";
  c.fillStyle = "#fff";
  c.font = "bold 16px monospace";
  c.fillText("REFUEL", x + w / 2, y + 24);

  // Fuel bar
  const barW = w * 0.6, barH = 24;
  const barX = x + (w - barW) / 2, barY = y + 44;
  c.fillStyle = "#222"; c.fillRect(barX, barY, barW, barH);
  const fuelFrac = player.fuel / (player.fuelMax || 50);
  c.fillStyle = fuelFrac > 0.5 ? "#0af" : fuelFrac > 0.2 ? "#ff8800" : "#ff4444";
  c.fillRect(barX, barY, barW * fuelFrac, barH);
  c.strokeStyle = "#444"; c.strokeRect(barX, barY, barW, barH);
  c.fillStyle = "#fff"; c.font = "12px monospace";
  c.fillText(Math.floor(player.fuel) + " / " + (player.fuelMax || 50), x + w / 2, barY + 17);

  c.fillStyle = "#aaa"; c.font = "12px monospace";
  c.fillText("Cost: " + totalCost + " SC", x + w / 2, barY + 50);

  // Refuel button
  const btnW = 160, btnH = 34;
  const btnX = x + (w - btnW) / 2, btnY = barY + 70;
  c.fillStyle = canRefuel ? "rgba(0,170,255,0.2)" : "rgba(50,50,50,0.3)";
  c.fillRect(btnX, btnY, btnW, btnH);
  c.strokeStyle = canRefuel ? "#0af" : "#555";
  c.strokeRect(btnX, btnY, btnW, btnH);
  c.fillStyle = canRefuel ? "#0af" : "#555";
  c.font = "bold 13px monospace";
  c.fillText(fuelNeeded < 0.5 ? "TANK FULL" : "REFUEL", x + w / 2, btnY + 22);
  window._uniRefuelRect = canRefuel ? { x: btnX, y: btnY, w: btnW, h: btnH, cost: totalCost } : null;

  c.textAlign = "left";
}

// ── REPAIR ────────────────────────────────────────────────────

function _uniRenderRepair(c, x, y, w, h) {
  if (typeof player === "undefined" || !player) return;
  const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
  const credits = world ? world.player.credits : 0;
  const hpNeeded = player.maxHp - player.hp;
  const armorNeeded = player.maxArmor - player.armor;
  const repairCost = Math.ceil(hpNeeded * 0.5 + armorNeeded * 0.3);
  const canRepair = (hpNeeded > 0.5 || armorNeeded > 0.5) && credits >= repairCost;

  c.textAlign = "center";
  c.fillStyle = "#fff"; c.font = "bold 16px monospace";
  c.fillText("REPAIR BAY", x + w / 2, y + 24);

  const barW = w * 0.6, barH = 18;
  const barX = x + (w - barW) / 2;

  // HP
  const hpY = y + 46;
  c.fillStyle = "#222"; c.fillRect(barX, hpY, barW, barH);
  c.fillStyle = player.hp / player.maxHp > 0.5 ? "#0f0" : "#ff4444";
  c.fillRect(barX, hpY, barW * Math.max(0, player.hp / player.maxHp), barH);
  c.fillStyle = "#fff"; c.font = "11px monospace";
  c.fillText("HP " + Math.floor(player.hp) + "/" + player.maxHp, x + w / 2, hpY + 14);

  // Armor
  const arY = hpY + 28;
  c.fillStyle = "#222"; c.fillRect(barX, arY, barW, barH);
  c.fillStyle = "#ccc";
  c.fillRect(barX, arY, barW * Math.max(0, player.armor / player.maxArmor), barH);
  c.fillStyle = "#fff";
  c.fillText("Armor " + Math.floor(player.armor) + "/" + player.maxArmor, x + w / 2, arY + 14);

  c.fillStyle = "#aaa"; c.font = "12px monospace";
  c.fillText("Repair cost: " + repairCost + " SC", x + w / 2, arY + 44);

  const btnW = 160, btnH = 34;
  const btnX = x + (w - btnW) / 2, btnY = arY + 62;
  c.fillStyle = canRepair ? "rgba(0,255,100,0.15)" : "rgba(50,50,50,0.3)";
  c.fillRect(btnX, btnY, btnW, btnH);
  c.strokeStyle = canRepair ? "#0f0" : "#555";
  c.strokeRect(btnX, btnY, btnW, btnH);
  c.fillStyle = canRepair ? "#0f0" : "#555";
  c.font = "bold 13px monospace";
  c.fillText(hpNeeded < 0.5 && armorNeeded < 0.5 ? "HULL OK" : "REPAIR", x + w / 2, btnY + 22);
  window._uniRepairRect = canRepair ? { x: btnX, y: btnY, w: btnW, h: btnH, cost: repairCost } : null;

  c.textAlign = "left";
}

// ── PLACEHOLDER TAB ───────────────────────────────────────────

function _uniRenderPlaceholder(c, x, y, w, h, title, msg) {
  c.textAlign = "center";
  c.fillStyle = "#888"; c.font = "bold 16px monospace";
  c.fillText(title, x + w / 2, y + 30);
  c.fillStyle = "#555"; c.font = "12px monospace";
  c.fillText(msg, x + w / 2, y + 55);
  c.textAlign = "left";
}

// ── MAP RENDERING (reusing existing code from v1, will be replaced with visual map later) ──

function _startUniMapLoop() {
  if (_uniMapLoopId) return;
  _uniMapLoopId = requestAnimationFrame(_uniMapTick);
}

function _stopUniMapLoop() {
  if (_uniMapLoopId) { cancelAnimationFrame(_uniMapLoopId); _uniMapLoopId = null; }
}

function _uniMapTick() {
  if (uniState !== "map" && uniState !== "quantum" && uniState !== "docked") {
    _uniMapLoopId = null; return;
  }
  _uniFrameCount++;
  const c = typeof ctx !== "undefined" ? ctx : null;
  const gw = typeof GAME_W !== "undefined" ? GAME_W : 1280;
  const gh = typeof GAME_H !== "undefined" ? GAME_H : 720;
  if (!c) { _uniMapLoopId = requestAnimationFrame(_uniMapTick); return; }

  if (uniState === "quantum") {
    _uniUpdateQuantum();
    _uniRenderQuantum(c, gw, gh);
  } else if (uniState === "docked") {
    uniRenderDockedUI();
  } else {
    // Map
    c.fillStyle = "#020611"; c.fillRect(0, 0, gw, gh);
    const uni = window._activeUniverse;
    if (uni) {
      c.textAlign = "center";
      if (_uniMapLevel === "system") _renderSystemMap(c, gw, gh, uni);
      else if (_uniMapLevel === "area") _renderAreaMap(c, gw, gh, uni);
      else if (_uniMapLevel === "quadrant") _renderQuadrantMap(c, gw, gh, uni);
      c.textAlign = "left";
    }
    // Back hint
    c.fillStyle = "#666"; c.font = "12px monospace"; c.textAlign = "left";
    c.fillText(_uniMapLevel === "system" ? "[ESC] Exit Universe" : "[ESC] Back", 10, gh - 10);
    if (_uniCurrentSystem) {
      c.textAlign = "right"; c.fillStyle = "#555"; c.font = "11px monospace";
      c.fillText("Current: " + _uniCurrentSystem.name, gw - 10, gh - 10);
    }
    c.textAlign = "left";
  }

  _uniMapLoopId = requestAnimationFrame(_uniMapTick);
}

// System map (text-based for now, visual map coming next session)
function _renderSystemMap(c, gw, gh, uni) {
  c.fillStyle = "#0af"; c.font = "bold 22px monospace"; c.fillText("STARMAP", gw / 2, 40);
  const systems = Object.values(uni.systems);
  const cols = 3, rows = Math.ceil(systems.length / cols);
  const cellW = (gw - 100) / cols, cellH = (gh - 120) / rows;
  const startX = 50, startY = 70;
  const mx = typeof mouse !== "undefined" ? mouse.x : 0;
  const my = typeof mouse !== "undefined" ? mouse.y : 0;
  _uniMapHover = null;

  // Connections
  c.strokeStyle = "rgba(100,100,150,0.3)"; c.lineWidth = 1;
  for (const sys of systems) {
    const si = systems.indexOf(sys);
    const sx = startX + (si % cols) * cellW + cellW / 2;
    const sy = startY + Math.floor(si / cols) * cellH + cellH / 2;
    for (const connId of sys.connections) {
      const ci = systems.findIndex(s => s.id === connId);
      if (ci < 0 || ci <= si) continue;
      c.beginPath(); c.moveTo(sx, sy);
      c.lineTo(startX + (ci % cols) * cellW + cellW / 2, startY + Math.floor(ci / cols) * cellH + cellH / 2);
      c.stroke();
    }
  }

  // Nodes
  for (let i = 0; i < systems.length; i++) {
    const sys = systems[i];
    const x = startX + (i % cols) * cellW + cellW / 2;
    const y = startY + Math.floor(i / cols) * cellH + cellH / 2;
    const r = 28;
    const hovered = Math.hypot(mx - x, my - y) < r + 10;
    if (hovered) _uniMapHover = sys.id;
    const isCurrent = _uniCurrentSystem && sys.id === _uniCurrentSystem.id;
    const fc = sys.faction === "harvester" ? "#ff8800" : sys.faction === "eldritch" ? "#cc0033" : "#4488ff";
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = hovered ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.5)";
    c.fill(); c.strokeStyle = isCurrent ? "#0f0" : fc; c.lineWidth = isCurrent ? 3 : 2; c.stroke();
    c.fillStyle = isCurrent ? "#0f0" : hovered ? "#fff" : "#aaa"; c.font = "bold 11px monospace";
    c.fillText(sys.name, x, y + r + 16);
    c.fillStyle = "#666"; c.font = "9px monospace"; c.fillText("Danger " + sys.dangerLevel, x, y + r + 28);
    if (isCurrent) { c.fillStyle = "#0f0"; c.font = "bold 9px monospace"; c.fillText("YOU ARE HERE", x, y - r - 8); }
  }
  c.fillStyle = "#555"; c.font = "11px monospace"; c.fillText("Click a system to view areas", gw / 2, gh - 30);
}

function _renderAreaMap(c, gw, gh, uni) {
  const sys = uni.systems[_uniMapSelectedSystem];
  if (!sys) { _uniMapLevel = "system"; return; }
  c.fillStyle = "#0af"; c.font = "bold 20px monospace"; c.fillText(sys.name + " - Areas", gw / 2, 40);
  const areas = Object.values(sys.areas);
  const cols = Math.min(4, areas.length), rows = Math.ceil(areas.length / cols);
  const cellW = (gw - 80) / cols, cellH = Math.min(110, (gh - 140) / rows);
  const mx = typeof mouse !== "undefined" ? mouse.x : 0, my = typeof mouse !== "undefined" ? mouse.y : 0;
  _uniMapHover = null;
  for (let i = 0; i < areas.length; i++) {
    const area = areas[i], col = i % cols, row = Math.floor(i / cols);
    const x = 40 + col * cellW, y = 70 + row * cellH, w = cellW - 8, h = cellH - 8;
    const hovered = mx > x && mx < x + w && my > y && my < y + h;
    if (hovered) _uniMapHover = area.id;
    const tc = area.type === "planet" ? "#4488ff" : area.type === "belt" ? "#aa8844" : area.type === "wormhole" ? "#aa44ff" : area.type === "sun" ? "#ffcc00" : area.type === "anomaly" ? "#ff4488" : "#666";
    c.fillStyle = hovered ? "rgba(255,255,255,0.06)" : "rgba(10,14,26,0.8)"; c.fillRect(x, y, w, h);
    c.strokeStyle = tc; c.lineWidth = hovered ? 2 : 1; c.strokeRect(x, y, w, h);
    c.textAlign = "left"; c.fillStyle = "#fff"; c.font = "bold 12px monospace"; c.fillText(area.name, x + 8, y + 20);
    c.fillStyle = tc; c.font = "10px monospace"; c.fillText(area.type.toUpperCase(), x + 8, y + 34);
    c.fillStyle = "#666"; c.font = "9px monospace"; c.fillText(area.quadrants.length + " sectors", x + 8, y + 48);
    if (area.type === "wormhole" && area.targetSystem) { c.fillStyle = "#aa44ff"; c.fillText("-> " + area.targetSystem, x + 8, y + 62); }
  }
  c.textAlign = "center"; c.fillStyle = "#555"; c.font = "11px monospace"; c.fillText("Click an area to view sectors", gw / 2, gh - 30);
}

function _renderQuadrantMap(c, gw, gh, uni) {
  const sys = uni.systems[_uniMapSelectedSystem];
  if (!sys) { _uniMapLevel = "system"; return; }
  const area = sys.areas[_uniMapSelectedArea];
  if (!area) { _uniMapLevel = "area"; return; }
  c.fillStyle = "#0af"; c.font = "bold 18px monospace"; c.fillText(area.name + " - Sectors", gw / 2, 40);
  const quads = area.quadrants, cols = Math.min(4, quads.length), rows = Math.ceil(quads.length / cols);
  const cellW = (gw - 80) / cols, cellH = Math.min(120, (gh - 140) / rows);
  const mx = typeof mouse !== "undefined" ? mouse.x : 0, my = typeof mouse !== "undefined" ? mouse.y : 0;
  _uniMapHover = null;
  for (let i = 0; i < quads.length; i++) {
    const q = quads[i], col = i % cols, row = Math.floor(i / cols);
    const x = 40 + col * cellW, y = 70 + row * cellH, w = cellW - 8, h = cellH - 8;
    const hovered = mx > x && mx < x + w && my > y && my < y + h;
    if (hovered) _uniMapHover = q.id;
    const tc = q.type === "station" ? "#00ff88" : q.type === "mining" ? "#ffaa00" : q.type === "patrol" ? "#ff4444" : q.type === "debris" ? "#aa8844" : q.type === "wormhole_tunnel" ? "#aa44ff" : "#446688";
    c.fillStyle = hovered ? "rgba(255,255,255,0.06)" : "rgba(10,14,26,0.8)"; c.fillRect(x, y, w, h);
    c.strokeStyle = tc; c.lineWidth = hovered ? 2 : 1; c.strokeRect(x, y, w, h);
    c.textAlign = "left"; c.fillStyle = "#fff"; c.font = "bold 11px monospace"; c.fillText(q.name || q.id, x + 8, y + 18);
    c.fillStyle = tc; c.font = "10px monospace"; c.fillText(q.type.toUpperCase(), x + 8, y + 32);
    if (hovered) {
      c.fillStyle = "rgba(0,255,100,0.15)"; c.fillRect(x + 4, y + h - 24, w - 8, 18);
      c.fillStyle = "#0f0"; c.font = "bold 10px monospace"; c.textAlign = "center"; c.fillText("CLICK TO TRAVEL", x + w / 2, y + h - 10);
    }
  }
  c.textAlign = "center"; c.fillStyle = "#555"; c.font = "11px monospace";
  c.fillText("Click a sector to quantum travel", gw / 2, gh - 30);
  if (typeof player !== "undefined" && player) { c.fillStyle = "#888"; c.font = "10px monospace"; c.fillText("Fuel: " + Math.floor(player.fuel) + "/" + (player.fuelMax || 50), gw / 2, gh - 48); }
}

// ── INPUT HANDLERS ────────────────────────────────────────────

document.addEventListener("mousedown", function(e) {
  if (uniState === "inactive") return;
  const ds = typeof displayScale !== "undefined" ? displayScale : 1;
  const mx = e.clientX / ds, my = e.clientY / ds;

  if (uniState === "map" && _uniMapHover) {
    if (_uniMapLevel === "system") { _uniMapSelectedSystem = _uniMapHover; _uniMapLevel = "area"; }
    else if (_uniMapLevel === "area") { _uniMapSelectedArea = _uniMapHover; _uniMapLevel = "quadrant"; }
    else if (_uniMapLevel === "quadrant") {
      const sys = window._activeUniverse?.systems[_uniMapSelectedSystem];
      const area = sys?.areas[_uniMapSelectedArea];
      const quad = area?.quadrants.find(q => q.id === _uniMapHover);
      if (quad) {
        if (quad.type === "wormhole_tunnel" && quad.toSystem) uniStartWormhole(quad.toSystem);
        else uniStartQuantum(_uniMapSelectedSystem, _uniMapSelectedArea, quad);
      }
    }
    return;
  }

  if (uniState === "docked") {
    // Tab clicks
    if (window._uniStationTabRects) {
      for (const r of window._uniStationTabRects) {
        if (mx > r.x && mx < r.x + r.w && my > r.y && my < r.y + r.h) { _uniStationTab = r.id; return; }
      }
    }
    // Trade row clicks
    if (_uniStationTab === "trading" && window._uniTradeRows) {
      for (const r of window._uniTradeRows) {
        if (my > r.y1 && my < r.y2 && mx > r.x && mx < r.x + r.w) { _uniTradeSelected = r.idx; return; }
      }
      // Buy/Sell button clicks
      if (window._uniTradeBuyRect) {
        const r = window._uniTradeBuyRect;
        if (mx > r.x && mx < r.x + r.w && my > r.y && my < r.y + r.h) {
          _uniTradeBuy(r.key, r.price, _uniDockedStation.id); return;
        }
      }
      if (window._uniTradeSellRect) {
        const r = window._uniTradeSellRect;
        if (mx > r.x && mx < r.x + r.w && my > r.y && my < r.y + r.h) {
          _uniTradeSell(r.key, r.price, _uniDockedStation.id); return;
        }
      }
    }
    // Refuel button
    if (_uniStationTab === "refuel" && window._uniRefuelRect) {
      const r = window._uniRefuelRect;
      if (mx > r.x && mx < r.x + r.w && my > r.y && my < r.y + r.h) {
        if (typeof player !== "undefined" && player) player.fuel = player.fuelMax || 50;
        const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
        if (world) { world.player.credits -= r.cost; if (window._activeUniverse) window._activeUniverse.player.credits = world.player.credits; }
        window._uniRefuelRect = null; return;
      }
    }
    // Repair button
    if (_uniStationTab === "repair" && window._uniRepairRect) {
      const r = window._uniRepairRect;
      if (mx > r.x && mx < r.x + r.w && my > r.y && my < r.y + r.h) {
        if (typeof player !== "undefined" && player) { player.hp = player.maxHp; player.armor = player.maxArmor; }
        const world = typeof getCurrentWorld === "function" ? getCurrentWorld() : null;
        if (world) { world.player.credits -= r.cost; if (window._activeUniverse) window._activeUniverse.player.credits = world.player.credits; }
        window._uniRepairRect = null; return;
      }
    }
    // Undock button
    if (window._uniUndockRect) {
      const r = window._uniUndockRect;
      if (mx > r.x && mx < r.x + r.w && my > r.y && my < r.y + r.h) {
        uniState = "flying";
        if (typeof state !== "undefined") state = "playing";
        _uniDockedStation = null;
        _stopUniMapLoop();
        return;
      }
    }
    return;
  }
});

document.addEventListener("keydown", function(e) {
  if (uniState === "inactive") return;
  if (uniState === "map" && e.code === "Escape") { e.preventDefault(); _uniMapBack(); return; }
  if (uniState === "docked" && e.code === "Escape") { e.preventDefault(); uniState = "flying"; if (typeof state !== "undefined") state = "playing"; _uniDockedStation = null; _stopUniMapLoop(); return; }
});

function _uniMapBack() {
  if (_uniMapLevel === "quadrant") _uniMapLevel = "area";
  else if (_uniMapLevel === "area") _uniMapLevel = "system";
  else exitUniverse();
}

// ── MOBILE UI ─────────────────────────────────────────────────
// Build dock/mine/map buttons for mobile. Arena mobile controls (joysticks, boost, missile)
// already work via game.js — we just need universe-specific buttons.

function _buildUniMobileUI() {
  if (!IS_MOBILE) return;
  _hideUniMobileUI();

  const ui = document.createElement("div");
  ui.id = "uniMobileUI";
  ui.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:998;touch-action:none";

  // Map button
  const mapBtn = document.createElement("div");
  mapBtn.textContent = "MAP";
  mapBtn.style.cssText = "position:absolute;top:40px;right:10px;padding:8px 16px;background:rgba(0,170,255,0.18);border:2px solid rgba(0,170,255,0.7);border-radius:8px;color:#0af;font:bold 12px monospace;pointer-events:all;touch-action:none;user-select:none";
  mapBtn.addEventListener("touchstart", e => {
    e.preventDefault();
    if (!_uniInCombat && uniState === "flying") {
      uniState = "map"; if (typeof state !== "undefined") state = "menu";
      _uniMapLevel = "quadrant"; _startUniMapLoop();
    }
  }, { passive: false });
  ui.appendChild(mapBtn);

  // Dock button (shows when near station)
  const dockBtn = document.createElement("div");
  dockBtn.id = "uniDockBtn";
  dockBtn.textContent = "DOCK";
  dockBtn.style.cssText = "position:absolute;top:80px;right:10px;padding:8px 16px;background:rgba(0,255,100,0.18);border:2px solid rgba(0,255,100,0.7);border-radius:8px;color:#0f0;font:bold 12px monospace;pointer-events:all;touch-action:none;user-select:none;display:none";
  dockBtn.addEventListener("touchstart", e => {
    e.preventDefault();
    if (uniStation && uniStation._playerNear && !_uniInCombat) {
      if (typeof keys !== "undefined") keys["KeyE"] = true;
      setTimeout(() => { if (typeof keys !== "undefined") keys["KeyE"] = false; }, 50);
    }
  }, { passive: false });
  ui.appendChild(dockBtn);

  // Mine button (shows when mining ship near asteroid)
  const mineBtn = document.createElement("div");
  mineBtn.id = "uniMineBtn";
  mineBtn.textContent = "MINE";
  mineBtn.style.cssText = "position:absolute;top:120px;right:10px;padding:8px 16px;background:rgba(255,170,0,0.18);border:2px solid rgba(255,170,0,0.7);border-radius:8px;color:#ffaa00;font:bold 12px monospace;pointer-events:all;touch-action:none;user-select:none;display:none";
  mineBtn.addEventListener("touchstart", e => {
    e.preventDefault();
    if (typeof keys !== "undefined") keys["KeyH"] = true;
  }, { passive: false });
  mineBtn.addEventListener("touchend", e => {
    e.preventDefault();
    if (typeof keys !== "undefined") keys["KeyH"] = false;
  }, { passive: false });
  ui.appendChild(mineBtn);

  document.body.appendChild(ui);
  _uniMobileUI = ui;

  // Show Arena mobile controls too (joysticks, boost, missile)
  const arenaUI = document.getElementById("mobileUI");
  if (arenaUI) arenaUI.style.display = "block";
}

function _hideUniMobileUI() {
  if (_uniMobileUI) { _uniMobileUI.remove(); _uniMobileUI = null; }
}

// Update mobile button visibility each frame
function _uniUpdateMobileButtons() {
  if (!IS_MOBILE || !_uniMobileUI) return;
  const dockBtn = document.getElementById("uniDockBtn");
  const mineBtn = document.getElementById("uniMineBtn");
  if (dockBtn) dockBtn.style.display = (uniStation && uniStation._playerNear && !_uniInCombat) ? "block" : "none";
  if (mineBtn) mineBtn.style.display = (typeof player !== "undefined" && player && player.miningPower > 0 && uniAsteroids.length > 0) ? "block" : "none";
}

// ══════════════════════════════════════════════════════════════
// GAME.JS INTEGRATION — TODO LIST
// These changes must be made to game.js for universe.js to work:
// ══════════════════════════════════════════════════════════════
//
// 1. Add globals at the top of game.js:
//    window.gameMode = "arena";  // "arena" | "universe"
//    window.camX = 0;
//    window.camY = 0;
//    window.quadW = GAME_W;
//    window.quadH = GAME_H;
//
// 2. In updatePlayer(), change position clamping:
//    BEFORE: player.x = Math.max(0, Math.min(GAME_W - player.w, ...));
//    AFTER:  const boundW = window.gameMode === "universe" ? window.quadW : GAME_W;
//            const boundH = window.gameMode === "universe" ? window.quadH : GAME_H;
//            player.x = Math.max(0, Math.min(boundW - player.w, ...));
//            player.y = Math.max(0, Math.min(boundH - player.h, ...));
//
// 3. Add camera update at end of updatePlayer():
//    if (window.gameMode === "universe") {
//      window.camX = Math.max(0, Math.min(window.quadW - GAME_W, player.x + player.w/2 - GAME_W/2));
//      window.camY = Math.max(0, Math.min(window.quadH - GAME_H, player.y + player.h/2 - GAME_H/2));
//    }
//
// 4. In render(), wrap entity drawing with camera offset:
//    if (window.gameMode === "universe") ctx.translate(-window.camX, -window.camY);
//    ... all existing drawing code ...
//    if (window.gameMode === "universe") ctx.translate(window.camX, window.camY);
//    // Then call uniRenderOverlay() for asteroids, stations, HUD
//    if (window.gameMode === "universe" && typeof uniRenderOverlay === "function") uniRenderOverlay();
//
// 5. In gameLoop(), skip arena-specific logic in universe mode:
//    if (state === "playing") {
//      if (window.gameMode === "universe") {
//        updatePlayer(); updateEnemies(); updateBullets(); checkCollisions();
//        updateHitEffects(); updateDeathEffects(); updateThrusterParticles();
//        if (typeof uniUpdate === "function") uniUpdate();
//        if (typeof _uniCheckMapKey === "function") _uniCheckMapKey();
//        if (typeof _uniUpdateMobileButtons === "function") _uniUpdateMobileButtons();
//      } else {
//        // existing arena gameLoop code
//      }
//    }
//
// 6. In render(), skip arena HUD in universe mode:
//    if (window.gameMode !== "universe") { drawBoostHUD(); drawSpecialHUD(); ... }
//
// 7. In updateEnemies(), skip Dreadnaught/beam/reinforcement logic for universe patrols:
//    enemies with e._uniPatrol && !e.aggroed should be skipped by updateEnemies
//    enemies with e._uniPatrol && e.aggroed should fight normally (arena AI works)
//    enemies with e.isPassive && e.aggroed are handled by uniUpdate (flee logic)
