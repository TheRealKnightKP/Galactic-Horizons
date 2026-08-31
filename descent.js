// ============================================================
// DESCENT INTO THE HORRORS
// A raid mode. You are the intruder; enemies are the obstacle, not the
// objective. Open map, alert pressure, a Hunter that follows you down,
// and everything you carry is scavenged.
//
// HARD RULE: "kill all enemies" is never a win condition in Descent.
// ============================================================

// ── Map sizing per level type ─────────────────────────────────
const DESCENT_MAP_SIZES = {
  breach:   { w: 2600, h: 1800 },
  hunt:     { w: 3600, h: 2600 },
  blackout: { w: 2200, h: 1600 },
  hold:     { w: 1600, h: 1200 },   // deliberately cramped: you are pinned
  siege:    { w: 2400, h: 2400 },
  trench:   { w: 6000, h: 720  },
  shaft:    { w: 900,  h: 7000 },   // the trench with the axis swapped
};

// ── Sectors: each changes a RULE, not just a backdrop ─────────
const DESCENT_SECTORS = [
  { id:"drift",  name:"The Drift",  bg:"#05070f", tint:null,
    desc:"Open space. Warden and Harvester dead drift here.", rule:null },
  { id:"reef",   name:"The Reef",   bg:"#070a14", tint:"rgba(60,90,70,0.05)",
    desc:"Hulls fused by growth.", rule:"coverAlert" },
  { id:"throat", name:"The Throat", bg:"#0a0710", tint:"rgba(90,40,80,0.07)",
    desc:"Space closes in.", rule:"narrow" },
  { id:"marrow", name:"The Marrow", bg:"#120508", tint:"rgba(150,30,40,0.09)",
    desc:"No stars. Only them.", rule:"hostile" },
  { id:"core",   name:"The Core",   bg:"#180307", tint:"rgba(200,20,30,0.12)",
    desc:"The heart of Hollow.", rule:"nocover" },
];

// ── Alert ─────────────────────────────────────────────────────
const ALERT_MAX = 100;
const ALERT_PER_SHOT      = 0.4;
const ALERT_ON_HIT        = 2;
const ALERT_ON_STRUCTURE  = 15;
const ALERT_OPEN_PER_SEC  = 0.3;
const ALERT_QUIET_PER_SEC = 1.5;
const ALERT_COVER_PER_SEC = 2.5;
const ALERT_SILENT_KILL   = -4;
const ALERT_REINFORCE_AT  = 40;
const ALERT_BEHIND_AT     = 70;
const ALERT_HUNTER_AT     = 100;
const ALERT_POST_OBJ_MULT = 2.0;

// ── Salvage economy ───────────────────────────────────────────
const SCRAP_AUTO_RANGE   = 90;
const HULK_STRIP_FRAMES  = 180;   // 3s stationary
const HULK_STRIP_RANGE   = 70;

let descentActive   = false;
let descentLevel    = 0;          // 1..15
let descentSector   = 0;          // index into DESCENT_SECTORS
let descentType     = "breach";
let alert           = 0;
let corruption      = 0;
let scrap = 0, cores = 0, ammoMags = 0;
let objectiveDone   = false;
let extractionPoint = null;
let hunter          = null;
let hunterLevelsAlive = 0;
let descentObjectives = [];       // { x, y, w, h, hp, maxHp, kind, dead }
let salvageObjects  = [];         // { x,y,w,h,kind,value,stripT,dead }
let ambientDust     = [];

function descentSectorFor(level){ return Math.min(4, Math.floor((level - 1) / 3)); }
function descentSectorDef(){ return DESCENT_SECTORS[descentSector] || DESCENT_SECTORS[0]; }

// ── Ambient parallax dust ─────────────────────────────────────
// Without this a 2600px map feels like swimming: no velocity feedback.
function seedAmbientDust(){
  ambientDust = [];
  for(let i = 0; i < 130; i++){
    ambientDust.push({
      x: Math.random() * (window.quadW || GAME_W),
      y: Math.random() * (window.quadH || GAME_H),
      z: [0.4, 0.7, 1.0][i % 3],
      r: 0.6 + Math.random() * 1.6,
      a: 0.15 + Math.random() * 0.4,
    });
  }
}
function drawAmbientDust(){
  if(!ambientDust.length) return;
  const cx = window.camX || 0, cy = window.camY || 0;
  const W = window.quadW || GAME_W, H = window.quadH || GAME_H;
  ctx.save();
  for(const d of ambientDust){
    // parallax: shift by camera scaled by depth, wrap within the map
    let sx = d.x - cx * d.z, sy = d.y - cy * d.z;
    sx = ((sx % W) + W) % W; sy = ((sy % H) + H) % H;
    if(sx < cx - 40 || sx > cx + GAME_W + 40 || sy < cy - 40 || sy > cy + GAME_H + 40) continue;
    ctx.globalAlpha = d.a * (0.35 + 0.65 * d.z);
    ctx.fillStyle = d.z > 0.8 ? "#9fb4d0" : "#4a5f7a";
    ctx.fillRect(sx, sy, d.r, d.r);
  }
  ctx.restore();
}

// ── Alert ─────────────────────────────────────────────────────
function alertAdd(n){
  if(!descentActive) return;
  alert = Math.max(0, Math.min(ALERT_MAX, alert + n));
  if(alert >= ALERT_HUNTER_AT && !hunter) spawnHunter();
}
function nearCover(){
  if(typeof debris === "undefined") return false;
  const pcx = player.x + player.w/2, pcy = player.y + player.h/2;
  for(const d of debris){
    if(d.dead) continue;
    if(Math.hypot(d.x + d.w/2 - pcx, d.y + d.h/2 - pcy) < 140) return true;
  }
  return false;
}
function updateAlert(){
  if(!descentActive || state !== "playing") return;
  const covered = nearCover();
  const sectorCoverBonus = descentSectorDef().rule === "coverAlert" ? 2 : 1;
  let delta;
  if(covered)                   delta = -ALERT_COVER_PER_SEC * sectorCoverBonus / 60;
  else if(!player._firedRecently) delta = -ALERT_QUIET_PER_SEC / 60;
  else                          delta =  ALERT_OPEN_PER_SEC / 60;
  if(objectiveDone) delta = Math.abs(delta) * ALERT_POST_OBJ_MULT * (delta < 0 ? -0.4 : 1);
  alertAdd(delta);
  if(player._quietTimer === undefined) player._quietTimer = 0;
  player._quietTimer++;
  if(player._quietTimer > 180) player._firedRecently = false;
}
function alertTier(){
  if(alert >= ALERT_HUNTER_AT)   return 3;
  if(alert >= ALERT_BEHIND_AT)   return 2;
  if(alert >= ALERT_REINFORCE_AT) return 1;
  return 0;
}

// ── The Hunter ────────────────────────────────────────────────
// Does not despawn at level end. Follows you down. One mutation stronger
// per level it survives. The arrow is ALWAYS visible: the dread is knowing.
function spawnHunter(){
  if(hunter) return;
  const W = window.quadW || GAME_W, H = window.quadH || GAME_H;
  const base = (typeof ENEMIES !== "undefined" && ENEMIES.Corsair) ? ENEMIES.Corsair : null;
  if(!base || typeof createEnemyObject !== "function") return;
  const px = player.x, py = player.y;
  let sx, sy, tries = 0;
  do {
    sx = Math.random() * (W - 80); sy = Math.random() * (H - 80); tries++;
  } while(Math.hypot(sx - px, sy - py) < 700 && tries < 30);
  const h = createEnemyObject("Corsair", sx, sy);
  if(!h) return;
  h.isHunter = true;
  h.maxHp *= 2.2 + 0.5 * hunterLevelsAlive;
  h.hp = h.maxHp;
  h.speed = (h.speed || 2) * 1.25;
  h.color = "#ff8800";
  h.affix = "warded"; h.affixStripped = 0;
  hunter = h;
  enemies.push(h);
  if(typeof showSpecialToast === "function") showSpecialToast("!! HUNTER INBOUND !!");
}
function updateHunter(){
  if(!hunter) return;
  if(hunter.dead || enemies.indexOf(hunter) === -1){
    if(hunter.dead){
      alert = 0; hunterLevelsAlive = 0;
      if(typeof showSpecialToast === "function") showSpecialToast("HUNTER DESTROYED");
    }
    hunter = null;
  }
}

// ── Salvage ───────────────────────────────────────────────────
function spawnSalvage(x, y, kind){
  const defs = {
    scrapfield: { w: 14, h: 14, value: 3 + Math.floor(Math.random()*6) },
    hulk:       { w: 46, h: 34, value: 15 + Math.floor(Math.random()*26) },
    cache:      { w: 34, h: 34, value: 20 },
    core:       { w: 20, h: 20, value: 1 },
  };
  const d = defs[kind] || defs.scrapfield;
  salvageObjects.push({ x, y, w: d.w, h: d.h, kind, value: d.value, stripT: 0, dead: false });
}
function updateSalvage(){
  if(!descentActive) return;
  const pcx = player.x + player.w/2, pcy = player.y + player.h/2;
  const moving = Math.hypot(player.vx || 0, player.vy || 0) > 0.6;
  for(const s of salvageObjects){
    if(s.dead) continue;
    const d = Math.hypot(s.x + s.w/2 - pcx, s.y + s.h/2 - pcy);
    if(s.kind === "scrapfield"){
      // auto-collect: the decision is whether to STAY, never whether to hoover
      if(d < SCRAP_AUTO_RANGE){
        s.x += (pcx - s.x - s.w/2) * 0.12; s.y += (pcy - s.y - s.h/2) * 0.12;
        if(d < 26){ s.dead = true; scrap += s.value; }
      }
    } else if(s.kind === "core"){
      if(d < 40){ s.dead = true; cores += s.value; if(typeof showSpecialToast==="function") showSpecialToast("CORE RECOVERED"); }
    } else if(s.kind === "hulk"){
      // 3 seconds stationary: the greed mechanic in miniature
      if(d < HULK_STRIP_RANGE && !moving){
        s.stripT++;
        if(s.stripT >= HULK_STRIP_FRAMES){ s.dead = true; scrap += s.value; }
      } else if(s.stripT > 0 && (d > HULK_STRIP_RANGE + 30 || moving)){
        s.stripT = Math.max(0, s.stripT - 2);
      }
    }
  }
  if(salvageObjects.some(s => s.dead)) salvageObjects = salvageObjects.filter(s => !s.dead);
}
function drawSalvage(){
  for(const s of salvageObjects){
    if(s.dead) continue;
    ctx.save();
    if(s.kind === "scrapfield"){
      ctx.globalAlpha = 0.85; ctx.fillStyle = "#9a8a6a";
      ctx.fillRect(s.x, s.y, s.w, s.h);
    } else if(s.kind === "hulk"){
      ctx.globalAlpha = 0.9; ctx.fillStyle = "rgba(70,66,58,0.9)";
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = "#bfae82"; ctx.lineWidth = 2;
      ctx.strokeRect(s.x, s.y, s.w, s.h);
      if(s.stripT > 0){
        ctx.fillStyle = "#ffdd66";
        ctx.fillRect(s.x, s.y - 6, s.w * (s.stripT / HULK_STRIP_FRAMES), 3);
      }
    } else if(s.kind === "core"){
      ctx.globalAlpha = 0.9; ctx.fillStyle = "#66ddff";
      ctx.beginPath(); ctx.arc(s.x + s.w/2, s.y + s.h/2, s.w/2, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

// ── Off-screen indicators ─────────────────────────────────────
function drawDescentArrows(){
  if(!descentActive || state !== "playing") return;
  const cx = window.camX || 0, cy = window.camY || 0;
  const pcx = player.x + player.w/2, pcy = player.y + player.h/2;
  const marks = [];
  for(const o of descentObjectives) if(!o.dead) marks.push({ x:o.x, y:o.y, col:"#ffcc44", label:"OBJ" });
  if(warpGate) marks.push({ x:warpGate.x, y:warpGate.y, col:"#44ff88", label:"GATE" });
  if(hunter && !hunter.dead) marks.push({ x:hunter.x, y:hunter.y, col:"#ff8800", label:"HUNTER" });
  for(const s of salvageObjects){
    if(s.dead || s.kind === "scrapfield") continue;
    if(Math.hypot(s.x - pcx, s.y - pcy) < 1200) marks.push({ x:s.x, y:s.y, col:"#8a7a5a", label:"" });
  }
  ctx.save();
  for(const m of marks){
    const sx = m.x - cx, sy = m.y - cy;
    const on = sx > 20 && sx < GAME_W - 20 && sy > 20 && sy < GAME_H - 20;
    if(on) continue;
    const dx = m.x - pcx, dy = m.y - pcy;
    const ang = Math.atan2(dy, dx);
    const pad = 34;
    let ex = GAME_W/2 + Math.cos(ang) * (GAME_W/2 - pad);
    let ey = GAME_H/2 + Math.sin(ang) * (GAME_H/2 - pad);
    ex = Math.max(pad, Math.min(GAME_W - pad, ex));
    ey = Math.max(pad, Math.min(GAME_H - pad, ey));
    ctx.translate(ex, ey); ctx.rotate(ang);
    ctx.globalAlpha = 0.9; ctx.fillStyle = m.col;
    ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-7,-6); ctx.lineTo(-7,6); ctx.closePath(); ctx.fill();
    ctx.rotate(-ang); ctx.translate(-ex, -ey);
    if(m.label){
      const dist = Math.round(Math.hypot(dx, dy));
      ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
      ctx.fillStyle = m.col; ctx.globalAlpha = 0.8;
      ctx.fillText(m.label + " " + dist, ex, ey + (ey > GAME_H/2 ? -14 : 20));
      ctx.textAlign = "left";
    }
  }
  ctx.restore();
}

// ── Minimap ───────────────────────────────────────────────────
// Enemy visibility scales with ALERT: staying quiet costs you information.
function drawMinimap(){
  if(!descentActive || state !== "playing") return;
  if(descentType === "blackout" || (mission && mission.name === "Dead Reckoning")) return;
  const W = window.quadW || GAME_W, H = window.quadH || GAME_H;
  const mw = 112, mh = Math.max(56, Math.round(mw * (H / W)));
  const mx = GAME_W - mw - 12, my = 62;
  const sx = mw / W, sy = mh / H;
  ctx.save();
  ctx.globalAlpha = 0.55; ctx.fillStyle = "rgba(4,8,14,0.85)";
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = "rgba(120,160,200,0.5)"; ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, mw, mh);
  ctx.globalAlpha = 0.95;
  const dot = (wx, wy, col, r) => { ctx.fillStyle = col;
    ctx.fillRect(mx + wx*sx - r, my + wy*sy - r, r*2, r*2); };
  // enemy transponders: range grows with alert
  const range = 600 + (alert / ALERT_MAX) * 4000;
  const pcx = player.x + player.w/2, pcy = player.y + player.h/2;
  for(const e of enemies){
    if(e.dead || e.isHunter) continue;
    if(Math.hypot(e.x - pcx, e.y - pcy) > range) continue;
    dot(e.x, e.y, "rgba(255,80,80,0.9)", 1.4);
  }
  for(const s of salvageObjects){
    if(s.dead) continue;
    dot(s.x, s.y, s.kind === "core" ? "#66ddff" : "rgba(160,150,120,0.8)", 1.2);
  }
  for(const o of descentObjectives) if(!o.dead) dot(o.x, o.y, "#ffcc44", 2.2);
  if(warpGate) dot(warpGate.x, warpGate.y, "#44ff88", 2.4);
  if(hunter && !hunter.dead) dot(hunter.x, hunter.y, "#ff8800", 2.2);   // ALWAYS shown
  // player
  ctx.fillStyle = "#ffffff";
  ctx.save();
  ctx.translate(mx + pcx*sx, my + pcy*sy); ctx.rotate(player.rotation || 0);
  ctx.beginPath(); ctx.moveTo(4,0); ctx.lineTo(-3,-3); ctx.lineTo(-3,3); ctx.closePath(); ctx.fill();
  ctx.restore();
  // viewport box
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.strokeRect(mx + (window.camX||0)*sx, my + (window.camY||0)*sy, GAME_W*sx, GAME_H*sy);
  ctx.restore();
}

// ── HUD: alert, corruption, resources ─────────────────────────
function drawDescentHUD(){
  if(!descentActive || state !== "playing") return;
  const x = 14, y = 92, w = 150, h = 9;
  ctx.save();
  // alert
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x-1, y-1, w+2, h+2);
  const t = alertTier();
  const col = t >= 3 ? "#ff3322" : t === 2 ? "#ff8822" : t === 1 ? "#ffcc22" : "#22aa66";
  ctx.fillStyle = col; ctx.fillRect(x, y, w * (alert/ALERT_MAX), h);
  for(const m of [ALERT_REINFORCE_AT, ALERT_BEHIND_AT]){
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + w*m/ALERT_MAX, y-2); ctx.lineTo(x + w*m/ALERT_MAX, y+h+2); ctx.stroke();
  }
  ctx.font = "bold 9px monospace"; ctx.fillStyle = col;
  ctx.fillText("ALERT", x, y - 3);
  // corruption
  if(corruption > 0){
    const cy2 = y + 16;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x-1, cy2-1, w+2, 6);
    ctx.fillStyle = "#aa44cc";
    ctx.fillRect(x, cy2, w * Math.min(1, corruption/(player.maxHp||1)), 4);
    ctx.fillStyle = "#cc77ee"; ctx.fillText("CORRUPTION", x, cy2 - 3);
  }
  // resources
  ctx.font = "bold 12px monospace"; ctx.fillStyle = "#c9b98a";
  ctx.fillText("SCRAP " + scrap, x, y + 40);
  ctx.fillStyle = "#66ddff";
  ctx.fillText("CORES " + cores, x + 100, y + 40);
  // level banner
  const sec = descentSectorDef();
  ctx.font = "bold 11px monospace"; ctx.fillStyle = "rgba(200,160,200,0.8)";
  ctx.fillText(sec.name.toUpperCase() + "  ·  LEVEL " + descentLevel + "/15", x, y + 56);
  ctx.restore();
}

// ── Corruption ────────────────────────────────────────────────
// Counter-play: redlining your weapon burns it. The answer to corruption is
// aggression, at the moment aggression is most dangerous.
function addCorruption(n){
  if(!descentActive) return;
  const mult = descentSectorDef().rule === "hostile" ? 2 : 1;
  corruption = Math.min((player.maxHp || 100) * 0.6, corruption + n * mult);
}
function updateCorruption(){
  if(!descentActive || state !== "playing") return;
  if(typeof HEAT_REDLINE_START !== "undefined" && player.heat >= HEAT_REDLINE_START){
    corruption = Math.max(0, corruption - 1.5/60);
  }
  // effective hull ceiling shrinks
  const cap = Math.max(1, (player.maxHp || 1) - corruption);
  if(player.hp > cap) player.hp = cap;
}

// ── Distance cull ─────────────────────────────────────────────
// Enemies far from the player tick at quarter rate and hold fire.
function descentCulled(e){
  if(!descentActive || !e) return false;
  const pcx = player.x + player.w/2, pcy = player.y + player.h/2;
  return Math.hypot(e.x - pcx, e.y - pcy) > GAME_W * 1.5;
}

// ── Frame hooks ───────────────────────────────────────────────
function descentUpdate(){
  if(!descentActive) return;
  for(const e of enemies) if(e && !e.eldritchName) eldritchify(e);
  updateWarp();
  if(warpBlocksPlay()) return;      // world is swapping; freeze play
  updateAlert(); updateHunter(); updateSalvage(); updateCorruption();
  missionTick();
  updateWarpGate();
  try { objectivesCollide(playerBullets); } catch(e){}
}
function descentDrawWorld(){       // inside camera transform
  if(!descentActive) return;
  drawGroundLayer(); drawAmbientDust(); drawSalvage(); drawObjectives(); drawWarpGate();
  if(mission && mission.drawWorld){ try{ mission.drawWorld(); }catch(e){} }
}
function descentDrawHUD(){         // outside camera transform
  if(!descentActive) return;
  if(!warpBlocksPlay()){ drawDescentArrows(); drawMinimap(); drawDescentHUD(); missionDrawHUD(); }
  drawWarpOverlay();
}

// ── Entry ─────────────────────────────────────────────────────
function startDescent(){
  descentActive = true;
  window.gameMode = "descent";
  descentLevel = 1; descentSector = 0; descentType = "breach";
  alert = 0; corruption = 0; scrap = 0; cores = 0; ammoMags = 0;
  hunter = null; hunterLevelsAlive = 0;
  descentObjectives = []; salvageObjects = []; extractionPoint = null;
  objectiveDone = false; warpGate = null; warpPhase = "none"; warpTimer = 0;
  const size = DESCENT_MAP_SIZES[descentType];
  window.quadW = size.w; window.quadH = size.h;
  window.camX = 0; window.camY = 0;
  seedAmbientDust();
  if(typeof resetRunState === "function") resetRunState();

  // startGame() only opens the "Enter Waves Mode?" confirm and returns, so
  // calling it here left both menus hidden and the run never started.
  // Confirm first, then begin on accept.
  document.getElementById("topMenu").style.display = "none";
  document.getElementById("arenaMenu").style.display = "none";
  if(typeof startGame === "function") startGame(false);
  const wc = document.getElementById("wavesConfirm");
  if(!wc){ beginDescentRun(); return; }
  const box = wc.querySelector("div");
  if(box){
    const title = box.querySelector("div");
    if(title) title.textContent = "Begin the Descent?";
    const body = box.querySelectorAll("div")[1];
    if(body) body.innerHTML = "You go in alone and you do not come back out.<br>" +
      "Nothing is repaired for you. What you carry is what you find.<br>" +
      "There is no turning back.";
  }
  const yes = wc.querySelector("#wc_yes");
  const no  = wc.querySelector("#wc_no");
  if(yes) yes.onclick = () => { wc.style.display = "none"; beginDescentRun(); };
  if(no)  no.onclick  = () => {
    wc.style.display = "none";
    descentActive = false; window.gameMode = "arena";
    window.quadW = GAME_W; window.quadH = GAME_H;
    document.getElementById("arenaMenu").style.display = "block";
  };
}

function beginDescentRun(){
  if(typeof nextWave === "function") nextWave();
  window.gameMode = "descent";
  descentActive = true;
  const sz = DESCENT_MAP_SIZES[descentType];
  window.quadW = sz.w; window.quadH = sz.h;
  seedAmbientDust();
  // drop the player near the left edge so there is map ahead of them
  player.x = 120; player.y = window.quadH/2 - player.h/2;
  window.camX = 0; window.camY = 0;
  salvageObjects = [];
  for(let i = 0; i < 6; i++){
    spawnSalvage(400 + Math.random()*(window.quadW-800),
                 120 + Math.random()*(window.quadH-240),
                 Math.random() < 0.4 ? "hulk" : "scrapfield");
  }
  for(const e of enemies) eldritchify(e);
  loadMission(descentLevel);
}
function endDescent(){
  descentActive = false;
  window.gameMode = "arena";
  window.quadW = GAME_W; window.quadH = GAME_H;
  window.camX = 0; window.camY = 0;
  salvageObjects = []; descentObjectives = []; ambientDust = [];
  hunter = null; warpGate = null; warpPhase = "none"; warpTimer = 0;
}

// ============================================================
// WARP GATE, TRANSITION & ELDRITCH ROSTER
// ============================================================

// ── Eldritch enemy roster ─────────────────────────────────────
// Named types for Descent. Art comes later; these reference existing
// sprites via `art` until yours drop in. Names are the contract.
const ELDRITCH_ENEMIES = {
  Husk:     { base:"Raptor",   name:"Husk",      desc:"A Warden hull with something else steering." },
  Gnaw:     { base:"Sprite",   name:"Gnaw",      desc:"Small, fast, teeth of torn plating." },
  Lacerator:{ base:"Rouge",    name:"Lacerator", desc:"Bladed prow. Charges in straight lines." },
  Weaver:   { base:"Corsair",  name:"Weaver",    desc:"Spins filament between wrecks." },
  Bloat:    { base:"Bulwark",  name:"Bloat",     desc:"Distended. Ruptures when killed." },
  Choir:    { base:"Healer",   name:"Choir",     desc:"Sings the others back together." },
  Maw:      { base:"Dreadnaught", name:"Maw",    desc:"A mouth built from a carrier." },
  Sentinel: { base:"Prometheus", name:"Sentinel",desc:"Grown into a station. Does not move." },
};
const ELDRITCH_STATIONS = {
  Spire:   { art:"EldritchStation.png", name:"Eldritch Spire" },
  Nursery: { art:"EldritchStation.png", name:"Nursery" },
  Gate:    { art:"EldritchStation.png", name:"Hollow Gate" },
};
// Map a vanilla enemy type to its Eldritch counterpart for Descent spawns.
function eldritchNameFor(type){
  for(const k in ELDRITCH_ENEMIES) if(ELDRITCH_ENEMIES[k].base === type) return k;
  return null;
}
// Descent enemies wear the Eldritch sprite sets (Shadow Comet / Vengeance),
// never Harvester or Warden hulls. Small/fast use Comet frames, heavy use
// Vengeance frames; frame index varies so a group is not identical.
const ELDRITCH_ART_LIGHT = ["EldritchComet1.png","EldritchComet2.png","EldritchComet3.png"];
const ELDRITCH_ART_HEAVY = ["EldritchVengeance1.png","EldritchVengeance2.png","EldritchVengeance3.png"];
function eldritchify(e){
  if(!descentActive || !e) return e;
  const k = eldritchNameFor(e.type);
  if(k) e.eldritchName = k;
  const sz = (typeof ENEMIES!=="undefined" && ENEMIES[e.type]?.size) || 1;
  const set = sz >= 4 ? ELDRITCH_ART_HEAVY : ELDRITCH_ART_LIGHT;
  const file = set[Math.floor(Math.random()*set.length)];
  if(typeof getImage === "function"){
    const img = getImage(file);
    if(img) { e.img = img; e._eldritchArt = file; }
  }
  e.color = sz >= 4 ? "#c02040" : "#a0407a";
  return e;
}

// ── Warp gate ─────────────────────────────────────────────────
// You are not teleported onward. You fly to the gate and enter it.
// If you die on the way, the run ends. Leaving is a choice.
const GATE_RADIUS = 46;
const GATE_HOLD_FRAMES = 45;      // ~0.75s inside the ring to commit
let warpGate = null;              // { x, y, hold }

function openWarpGate(){
  if(warpGate) return;
  const W = window.quadW || GAME_W, H = window.quadH || GAME_H;
  // far side of the map from the player, so extraction is a commitment
  const px = player.x;
  warpGate = { x: px < W/2 ? W - 200 : 200, y: 120 + Math.random()*(H - 240), hold: 0 };
  objectiveDone = true;
  if(typeof showSpecialToast === "function") showSpecialToast("WARP GATE OPEN — GET OUT");
}
function updateWarpGate(){
  if(!descentActive || !warpGate || warpTimer > 0) return;
  const pcx = player.x + player.w/2, pcy = player.y + player.h/2;
  const d = Math.hypot(warpGate.x - pcx, warpGate.y - pcy);
  if(d < GATE_RADIUS){
    // Hunter blocks extraction: you cannot outrun the consequence of greed
    if(hunter && !hunter.dead){
      warpGate.hold = 0;
      if(typeof showSpecialToast === "function" && frameCount % 90 === 0)
        showSpecialToast("GATE JAMMED — THE HUNTER IS HERE");
      return;
    }
    warpGate.hold++;
    if(warpGate.hold >= GATE_HOLD_FRAMES) beginWarp();
  } else if(warpGate.hold > 0){
    warpGate.hold = Math.max(0, warpGate.hold - 2);
  }
}
function drawWarpGate(){
  if(!warpGate) return;
  const t = frameCount * 0.04;
  ctx.save();
  // outer ring
  ctx.globalAlpha = 0.85; ctx.strokeStyle = "#44ff99"; ctx.lineWidth = 3;
  if(_shadowsEnabled){ ctx.shadowColor = "#44ff99"; ctx.shadowBlur = 14; }
  ctx.beginPath(); ctx.arc(warpGate.x, warpGate.y, GATE_RADIUS, 0, Math.PI*2); ctx.stroke();
  // rotating inner shards
  for(let i=0;i<5;i++){
    const a = t + i * Math.PI*2/5;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(warpGate.x, warpGate.y, GATE_RADIUS - 12, a, a + 0.5);
    ctx.stroke();
  }
  // hold progress
  if(warpGate.hold > 0){
    ctx.globalAlpha = 0.95; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(warpGate.x, warpGate.y, GATE_RADIUS + 8, -Math.PI/2,
            -Math.PI/2 + Math.PI*2*(warpGate.hold/GATE_HOLD_FRAMES));
    ctx.stroke();
  }
  ctx.restore();
}

// ── Warp transition: out, travel, in ──────────────────────────
// Deliberately NOT a resupply. You arrive with exactly what you left with.
const WARP_OUT = 55, WARP_TRAVEL = 130, WARP_IN = 60;
let warpTimer = 0, warpPhase = "none";
let _warpStreaks = [];

function beginWarp(){
  warpPhase = "out"; warpTimer = WARP_OUT;
  if(typeof addShake === "function") addShake(8);
  _warpStreaks = [];
  for(let i=0;i<90;i++) _warpStreaks.push({
    a: Math.random()*Math.PI*2, r: 40 + Math.random()*400,
    len: 20 + Math.random()*90, v: 6 + Math.random()*16 });
  if(typeof showSpecialToast === "function") showSpecialToast("WARPING OUT");
}
function updateWarp(){
  if(warpPhase === "none") return;
  warpTimer--;
  if(warpTimer > 0) return;
  if(warpPhase === "out"){
    warpPhase = "travel"; warpTimer = WARP_TRAVEL;
    advanceDescentLevel();          // world swaps mid-travel, unseen
  } else if(warpPhase === "travel"){
    warpPhase = "in"; warpTimer = WARP_IN;
    if(typeof addShake === "function") addShake(12);
    if(typeof showSpecialToast === "function")
      showSpecialToast(descentSectorDef().name.toUpperCase() + " — LEVEL " + descentLevel);
  } else {
    warpPhase = "none";
  }
}
function warpBlocksPlay(){ return warpPhase !== "none"; }

function drawWarpOverlay(){
  if(warpPhase === "none") return;
  const cx = GAME_W/2, cy = GAME_H/2;
  const p = 1 - (warpTimer / (warpPhase==="out"?WARP_OUT:warpPhase==="travel"?WARP_TRAVEL:WARP_IN));
  ctx.save();
  if(warpPhase === "out"){
    ctx.globalAlpha = p * 0.9; ctx.fillStyle = "#000";
    ctx.fillRect(0,0,GAME_W,GAME_H);
    // collapsing ring: the space around you folding in
    ctx.globalAlpha = p*0.85; ctx.strokeStyle="#66ffcc"; ctx.lineWidth=3+p*6;
    ctx.beginPath(); ctx.arc(cx,cy,Math.max(4,420*(1-p)),0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha = p*0.35; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(cx,cy,Math.max(2,560*(1-p*0.8)),0,Math.PI*2); ctx.stroke();
    for(const s of _warpStreaks){
      const r = s.r * (1 - p*0.85);
      ctx.globalAlpha = p * 0.8; ctx.strokeStyle = "#66ffcc"; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(s.a)*r, cy + Math.sin(s.a)*r);
      ctx.lineTo(cx + Math.cos(s.a)*(r + s.len*p), cy + Math.sin(s.a)*(r + s.len*p));
      ctx.stroke();
    }
  } else if(warpPhase === "travel"){
    ctx.fillStyle = "#000"; ctx.fillRect(0,0,GAME_W,GAME_H);
    for(const s of _warpStreaks){
      s.r += s.v;
      if(s.r > 900) s.r = 20;
      ctx.globalAlpha = 0.75; ctx.strokeStyle = "#3ad9a6"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(s.a)*s.r, cy + Math.sin(s.a)*s.r);
      ctx.lineTo(cx + Math.cos(s.a)*(s.r + s.len*1.6), cy + Math.sin(s.a)*(s.r + s.len*1.6));
      ctx.stroke();
    }
    // tunnel walls
    ctx.globalAlpha = 0.18; ctx.strokeStyle="#1f7a5e"; ctx.lineWidth=2;
    for(let i=0;i<6;i++){
      const rr = ((frameCount*7 + i*150) % 900);
      ctx.beginPath(); ctx.arc(cx,cy,rr,0,Math.PI*2); ctx.stroke();
    }
    // no resupply: state the cost plainly, mid-transit
    ctx.globalAlpha = 0.85; ctx.textAlign = "center";
    ctx.font = "bold 13px monospace"; ctx.fillStyle = "#7fd9bb";
    ctx.fillText("IN TRANSIT", cx, cy - 16);
    ctx.font = "11px monospace"; ctx.fillStyle = "#557";
    ctx.fillText("no resupply · no repair · " + Math.round(corruption) + " corruption carried", cx, cy + 8);
    ctx.textAlign = "left";
  } else {
    ctx.globalAlpha = 1 - p; ctx.fillStyle = "#000";
    ctx.fillRect(0,0,GAME_W,GAME_H);
    // arrival flash
    if(p < 0.25){ ctx.globalAlpha = (0.25-p)*2.2; ctx.fillStyle="#bfffe8";
      ctx.fillRect(0,0,GAME_W,GAME_H); }
    for(const s of _warpStreaks){
      const r = s.r * (0.3 + p*1.4);
      ctx.globalAlpha = (1-p) * 0.7; ctx.strokeStyle = "#66ffcc"; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(s.a)*r, cy + Math.sin(s.a)*r);
      ctx.lineTo(cx + Math.cos(s.a)*(r + s.len*(1-p)), cy + Math.sin(s.a)*(r + s.len*(1-p)));
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Level advance ─────────────────────────────────────────────
function advanceDescentLevel(){
  descentLevel++;
  descentSector = descentSectorFor(descentLevel);
  const types = ["breach","hold","hunt","blackout","breach","siege"];
  descentType = types[(descentLevel - 1) % types.length];
  const sz = DESCENT_MAP_SIZES[descentType] || DESCENT_MAP_SIZES.breach;
  window.quadW = sz.w; window.quadH = sz.h;
  // Nothing is restored. That is the mode.
  warpGate = null; objectiveDone = false;
  salvageObjects = []; descentObjectives = [];
  enemies.length = 0; enemyBullets.length = 0; playerBullets.length = 0;
  if(typeof debris !== "undefined") { debris.length = 0; _debrisArea = 0; }
  player.x = 120; player.y = window.quadH/2 - player.h/2;
  player.vx = 0; player.vy = 0;
  window.camX = 0; window.camY = 0;
  seedAmbientDust();
  for(let i = 0; i < 6 + descentLevel; i++){
    spawnSalvage(400 + Math.random()*(window.quadW-800),
                 120 + Math.random()*(window.quadH-240),
                 Math.random() < 0.4 ? "hulk" : "scrapfield");
  }
  if(hunter && !hunter.dead) hunterLevelsAlive++;
  alert = Math.max(0, alert - 25);   // you shook them briefly
  if(typeof currentWave !== "undefined") currentWave = descentLevel;
  if(typeof spawnWave === "function") { try { spawnWave(); } catch(e){} }
  for(const e of enemies) eldritchify(e);
  loadMission(descentLevel);
}

// ============================================================
// MISSIONS — the objective is never a body count
// ============================================================

let mission = null;   // { id, name, brief, tick(), done(), failed(), draw() }

const MISSION_DEFS = {

  // ── 1. Cut the Picket ─────────────────────────────────────
  picket: {
    name: "Cut the Picket", brief: "Destroy 2 of 3 Sentinel nodes. Ignore the Husks.",
    setup(){
      const W = window.quadW, H = window.quadH;
      for(let i=0;i<3;i++)
        descentObjectives.push({ x: W*0.55 + i*160, y: H*(0.25+i*0.25), w:54, h:54,
          hp:2600, maxHp:2600, kind:"sentinel", dead:false, optional:i===2 });
      this._respawn = 0;
    },
    tick(){
      // Husks keep coming until the nodes fall: clearing them is not the answer
      this._respawn = (this._respawn||0) + 1;
      if(this._respawn > 260 && enemies.filter(e=>!e.dead).length < 7){
        this._respawn = 0;
        if(typeof spawnSingleEnemy === "function") spawnSingleEnemy("Raptor");
      }
    },
    done(){ return descentObjectives.filter(o=>o.dead && !o.optional).length >= 2; }
  },

  // ── 2. Nothing Out Here ───────────────────────────────────
  salvagerun: {
    name: "Nothing Out Here", brief: "Bank 250 scrap before the gate closes.",
    setup(){
      this.target = 250; this.t = 90*60; this.start = scrap;
      for(let i=0;i<14;i++)
        spawnSalvage(300+Math.random()*(window.quadW-600), 100+Math.random()*(window.quadH-200),
                     Math.random()<0.6 ? "hulk" : "scrapfield");
      openWarpGate();   // gate is open from the start
    },
    tick(){ this.t--; if(this.t % 300 === 0) alertAdd(4); },
    done(){ return (scrap - this.start) >= this.target; },
    failed(){ return this.t <= 0; },
    draw(){
      ctx.font="bold 12px monospace"; ctx.textAlign="center";
      ctx.fillStyle = this.t < 900 ? "#ff6655" : "#c9b98a";
      ctx.fillText("SCRAP " + (scrap-this.start) + "/" + this.target +
                   "   ·   " + Math.ceil(this.t/60) + "s", GAME_W/2, (IS_MOBILE?150:86));
      ctx.textAlign="left";
    }
  },

  // ── 4. Quiet Passage ──────────────────────────────────────
  quiet: {
    name: "Quiet Passage", brief: "Reach the gate. Keep ALERT under 50.",
    setup(){ openWarpGate(); this.tripped = false; },
    tick(){
      if(!this.tripped && alert >= 50){
        this.tripped = true;
        spawnHunter();
        if(typeof showSpecialToast==="function") showSpecialToast("YOU WERE HEARD");
      }
    },
    done(){ return false; }   // reaching the gate ends it
  },

  // ── 5. Nursery ────────────────────────────────────────────
  nursery: {
    name: "Nursery", brief: "Destroy all four Nurseries. They breed faster as they die.",
    setup(){
      const W=window.quadW,H=window.quadH;
      const pts=[[0.3,0.25],[0.72,0.3],[0.35,0.75],[0.78,0.7]];
      for(const [fx,fy] of pts)
        descentObjectives.push({ x:W*fx, y:H*fy, w:48, h:48, hp:1800, maxHp:1800,
                                 kind:"nursery", dead:false, t:0 });
    },
    tick(){
      const killed = descentObjectives.filter(o=>o.dead).length;
      const rate = Math.max(90, 240 - killed*55);
      for(const o of descentObjectives){
        if(o.dead) continue;
        o.t = (o.t||0)+1;
        if(o.t > rate){ o.t = 0;
          if(typeof spawnSingleEnemy==="function") spawnSingleEnemy("Sprite", o.x, o.y); }
      }
    },
    done(){ return descentObjectives.every(o=>o.dead); }
  },

  // ── 6. Dead Reckoning ─────────────────────────────────────
  blackout: {
    name: "Dead Reckoning", brief: "No sensors. Wrecks glow. Follow them to the gate.",
    setup(){
      openWarpGate();
      for(let i=0;i<18;i++)
        spawnSalvage(200+Math.random()*(window.quadW-400), 100+Math.random()*(window.quadH-200),
                     Math.random()<0.35 ? "hulk" : "scrapfield");
    },
    done(){ return false; }
  },

  // ── 3. The Lacerator ──────────────────────────────────────
  hunt: {
    name: "The Lacerator", brief: "Kill the Lacerator. It flees and heals off wrecks.",
    setup(){
      const t = (typeof createEnemyObject==="function")
        ? createEnemyObject("Rouge", window.quadW*0.7, window.quadH*0.5) : null;
      if(t){ t.maxHp *= 4; t.hp = t.maxHp; t.isQuarry = true; t.color = "#ff5588";
             t.eldritchName = "Lacerator"; enemies.push(t); this.q = t; }
    },
    tick(){
      const q = this.q; if(!q || q.dead) return;
      if(q.hp < q.maxHp*0.4){                       // flee
        const a = Math.atan2(q.y-player.y, q.x-player.x);
        q.vx += Math.cos(a)*0.35; q.vy += Math.sin(a)*0.35;
      }
      if(typeof debris !== "undefined"){            // heal off wrecks - including yours
        for(const d of debris){
          if(d.dead) continue;
          if(Math.hypot(d.x-q.x, d.y-q.y) < 90){ q.hp = Math.min(q.maxHp, q.hp + 1.2); break; }
        }
      }
    },
    done(){ return this.q && this.q.dead; }
  },

  // ── Event Horizon (gravity well) ──────────────────────────
  gravity: {
    name: "Event Horizon", brief: "Take the Cores near the horizon. Then leave.",
    setup(){
      this.gx = window.quadW/2; this.gy = window.quadH/2;
      this.inner = 150; this.K = 260000;
      for(let i=0;i<3;i++){
        const a = i*Math.PI*2/3, r = 330;
        spawnSalvage(this.gx+Math.cos(a)*r, this.gy+Math.sin(a)*r, "core");
      }
      this.taken = cores;
    },
    tick(){
      // a = K / d^2, clamped. Not a hazard you avoid: a force you fly against.
      const pull = (o, m) => {
        const dx = this.gx-(o.x+(o.w||0)/2), dy = this.gy-(o.y+(o.h||0)/2);
        const d = Math.max(40, Math.hypot(dx,dy));
        const a = Math.min(0.9, this.K/(d*d)) * m;
        o.vx = (o.vx||0) + (dx/d)*a; o.vy = (o.vy||0) + (dy/d)*a;
        return d;
      };
      const d = pull(player, 1);
      if(d < this.inner){ player.hp -= 1.2; addShake(3); }
      for(const e of enemies) if(!e.dead) pull(e, 0.7);
      if(typeof debris !== "undefined") for(const w of debris){
        if(w.dead) continue;
        const dx=this.gx-w.x, dy=this.gy-w.y, dd=Math.max(40,Math.hypot(dx,dy));
        w.x += (dx/dd)*0.6; w.y += (dy/dd)*0.6;
      }
      for(const s of salvageObjects) if(!s.dead) pull(s, 0.35);
    },
    done(){ return cores - this.taken >= 2; },
    drawWorld(){
      const t = frameCount*0.02;
      ctx.save();
      const g = ctx.createRadialGradient(this.gx,this.gy,10,this.gx,this.gy,this.inner*2.6);
      g.addColorStop(0,"rgba(0,0,0,1)"); g.addColorStop(0.4,"rgba(30,0,50,0.9)");
      g.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=g; ctx.beginPath();
      ctx.arc(this.gx,this.gy,this.inner*2.6,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="rgba(190,90,255,0.5)"; ctx.lineWidth=2;
      for(let i=0;i<3;i++){
        ctx.globalAlpha=0.35-i*0.1;
        ctx.beginPath(); ctx.arc(this.gx,this.gy,this.inner+i*70+Math.sin(t+i)*8,0,Math.PI*2); ctx.stroke();
      }
      ctx.restore();
    }
  },

  // ── Ash Fields (ground targets) ───────────────────────────
  ashfields: {
    name: "Ash Fields", brief: "Destroy 6 AA batteries. Lasers cannot hit ground.",
    setup(){
      groundLayer = { tint:"rgba(90,60,45,0.20)", scroll:0.55 };
      const W=window.quadW,H=window.quadH;
      for(let i=0;i<9;i++)
        descentObjectives.push({ x: 300+Math.random()*(W-600), y: 120+Math.random()*(H-240),
          w:40,h:40, hp:900,maxHp:900, kind:"aa", isGround:true, dead:false, t:Math.random()*120 });
    },
    tick(){
      for(const o of descentObjectives){
        if(o.dead) continue;
        o.t = (o.t||0)+1;
        if(o.t > 150){ o.t = 0;
          const a = Math.atan2(player.y-o.y, player.x-o.x);
          if(typeof fireBullets==="function" && WEAPON_DEFS.ballistic_cannon){
            const bs = fireBullets({x:o.x,y:o.y,w:o.w,h:o.h},
              {...WEAPON_DEFS.ballistic_cannon, damage:14, speed:6, size:3}, a, false);
            bs.forEach(b=>{ b._fromGround = true; });
            enemyBullets.push(...bs);
          }
        }
      }
    },
    done(){ return descentObjectives.filter(o=>o.dead).length >= 6; }
  },
};

// ── Ground layer ──────────────────────────────────────────────
let groundLayer = null;
function drawGroundLayer(){
  if(!groundLayer) return;
  const W = window.quadW, H = window.quadH;
  ctx.save();
  ctx.fillStyle = groundLayer.tint || "rgba(80,60,50,0.18)";
  ctx.fillRect(0,0,W,H);
  // cheap terrain: a hatch grid that parallaxes with the camera
  ctx.globalAlpha = 0.12; ctx.strokeStyle = "#c8a882"; ctx.lineWidth = 1;
  const step = 140, ox = ((window.camX||0)*(1-(groundLayer.scroll||0.6)))%step;
  for(let x=-step; x<W+step; x+=step){
    ctx.beginPath(); ctx.moveTo(x+ox,0); ctx.lineTo(x+ox,H); ctx.stroke();
  }
  for(let y=0; y<H; y+=step){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
  ctx.restore();
}

// ── Objectives: damage, draw ──────────────────────────────────
// Ground targets are immune to lasers. That is the first hard content check
// your 24 weapons have ever had.
function objectiveTakeHit(o, bullet){
  if(o.dead) return false;
  if(o.isGround){
    const cat = bullet && bullet.category;
    const ok = cat === "ballistic" || cat === "lc_ballistic" || bullet.missile || bullet.aoeRadius;
    if(!ok) return false;
  }
  o.hp -= (bullet.damage || 10);
  if(typeof spawnHitEffect === "function") spawnHitEffect(bullet.x, bullet.y, bullet);
  if(o.hp <= 0){
    o.dead = true; addShake(9);
    if(typeof spawnSalvage === "function"){ spawnSalvage(o.x,o.y,"hulk"); spawnSalvage(o.x+20,o.y,"core"); }
    alertAdd(ALERT_ON_STRUCTURE);
    if(typeof showSpecialToast === "function") showSpecialToast("STRUCTURE DOWN");
  }
  return true;
}
function objectivesCollide(list){
  for(const b of list){
    if(b.dead || b._fromGround) continue;
    for(const o of descentObjectives){
      if(o.dead) continue;
      if(b.x < o.x+o.w && b.x+(b.w||2) > o.x && b.y < o.y+o.h && b.y+(b.h||2) > o.y){
        if(objectiveTakeHit(o,b)) b.dead = true;
        break;
      }
    }
  }
}
function drawObjectives(){
  for(const o of descentObjectives){
    if(o.dead) continue;
    const f = o.hp/o.maxHp;
    ctx.save();
    if(o.isGround){ ctx.globalAlpha=0.9; ctx.fillStyle="#6a5a48";
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.strokeStyle="#d09a5a"; ctx.lineWidth=2; ctx.strokeRect(o.x,o.y,o.w,o.h);
    } else {
      ctx.globalAlpha=0.92; ctx.fillStyle="rgba(60,20,55,0.9)";
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.strokeStyle="#c060d0"; ctx.lineWidth=2.5;
      if(_shadowsEnabled){ ctx.shadowColor="#c060d0"; ctx.shadowBlur=10; }
      ctx.strokeRect(o.x,o.y,o.w,o.h);
    }
    ctx.globalAlpha=0.95; ctx.fillStyle="rgba(0,0,0,0.6)";
    ctx.fillRect(o.x, o.y-8, o.w, 4);
    ctx.fillStyle = o.isGround ? "#ffbb55" : "#ff66cc";
    ctx.fillRect(o.x, o.y-8, o.w*f, 4);
    ctx.restore();
  }
}

// ── Mission driver ────────────────────────────────────────────
const MISSION_ORDER = ["picket","salvagerun","hunt","quiet","nursery","blackout",
                       "gravity","ashfields","picket","nursery","hunt","gravity",
                       "blackout","ashfields","picket"];
function loadMission(level){
  const key = MISSION_ORDER[(level-1) % MISSION_ORDER.length];
  const def = MISSION_DEFS[key];
  mission = def ? Object.create(def) : null;
  descentObjectives = [];
  groundLayer = null;
  if(mission && mission.setup) { try { mission.setup(); } catch(e){ console.error("mission setup", e); } }
  if(mission && typeof showSpecialToast === "function")
    showSpecialToast(mission.name.toUpperCase());
}
function missionTick(){
  if(!mission) return;
  if(mission.tick) { try { mission.tick(); } catch(e){} }
  if(!warpGate && mission.done && mission.done()) openWarpGate();
  if(mission.failed && mission.failed()){
    // A failed mission you survive is a better story than a reset:
    // the gate opens anyway, you just leave with nothing.
    if(!warpGate){ openWarpGate();
      if(typeof showSpecialToast==="function") showSpecialToast("OBJECTIVE LOST — GET OUT"); }
  }
}
function missionDrawHUD(){
  if(!mission) return;
  ctx.save();
  ctx.font="bold 11px monospace"; ctx.textAlign="center"; ctx.globalAlpha=0.85;
  ctx.fillStyle="#c9a8d8";
  // pushed down: at y=18 it sat under the notch / status bar and was unreadable
  const my = IS_MOBILE ? 116 : 62;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(GAME_W/2-190, my-14, 380, mission.brief ? 34 : 20);
  ctx.fillStyle="#c9a8d8";
  ctx.fillText(mission.name.toUpperCase(), GAME_W/2, my);
  ctx.font="10px monospace"; ctx.fillStyle="#93a3b5";
  if(mission.brief) ctx.fillText(mission.brief, GAME_W/2, my+14);
  ctx.textAlign="left"; ctx.restore();
  if(mission.draw) { try { mission.draw(); } catch(e){} }
}
