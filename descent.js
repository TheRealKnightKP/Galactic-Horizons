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
  if(objectiveDone && extractionPoint) marks.push({ x:extractionPoint.x, y:extractionPoint.y, col:"#44ff88", label:"EXIT" });
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
  if(descentType === "blackout") return;
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
  if(objectiveDone && extractionPoint) dot(extractionPoint.x, extractionPoint.y, "#44ff88", 2.4);
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
  updateAlert(); updateHunter(); updateSalvage(); updateCorruption();
}
function descentDrawWorld(){       // inside camera transform
  if(!descentActive) return;
  drawAmbientDust(); drawSalvage();
}
function descentDrawHUD(){         // outside camera transform
  if(!descentActive) return;
  drawDescentArrows(); drawMinimap(); drawDescentHUD();
}

// ── Entry ─────────────────────────────────────────────────────
function startDescent(){
  descentActive = true;
  window.gameMode = "descent";
  descentLevel = 1; descentSector = 0; descentType = "breach";
  alert = 0; corruption = 0; scrap = 0; cores = 0; ammoMags = 0;
  hunter = null; hunterLevelsAlive = 0;
  descentObjectives = []; salvageObjects = []; extractionPoint = null;
  objectiveDone = false;
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
  if(typeof showSpecialToast === "function") showSpecialToast("DESCENT: THE DRIFT");
}
function endDescent(){
  descentActive = false;
  window.gameMode = "arena";
  window.quadW = GAME_W; window.quadH = GAME_H;
  window.camX = 0; window.camY = 0;
  salvageObjects = []; descentObjectives = []; ambientDust = [];
  hunter = null;
}
