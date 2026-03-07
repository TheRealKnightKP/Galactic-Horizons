// game.js
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let GAME_W = window.innerWidth;
let GAME_H = window.innerHeight;
const SIZE_SCALE = 0.5;
let displayScale = 1;

const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1);

function resizeCanvas() {
  GAME_W = window.innerWidth;
  GAME_H = window.innerHeight;
  displayScale = 1;
  canvas.width  = GAME_W;
  canvas.height = GAME_H;
  canvas.style.width  = GAME_W + "px";
  canvas.style.height = GAME_H + "px";
  const container = document.getElementById("gameContainer");
  if (container) {
    container.style.width    = GAME_W + "px";
    container.style.height   = GAME_H + "px";
    container.style.left     = "0px";
    container.style.top      = "0px";
    container.style.position = "fixed";
  }
}

window.addEventListener("resize", () => { setTimeout(resizeCanvas, 50); });
window.addEventListener("orientationchange", () => { setTimeout(resizeCanvas, 350); });
resizeCanvas();

const mouse = { x: GAME_W / 2, y: GAME_H / 2, down: false };
const keys  = {};
let mobileJoy = { active: false, touchId: null, startX: 0, startY: 0, dx: 0, dy: 0 };
let mobileAim = { active: false, touchId: null, startX: 0, startY: 0, dx: 0, dy: 0, shooting: false };

if (!IS_MOBILE) {
  canvas.addEventListener("mousemove", e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / displayScale;
    mouse.y = (e.clientY - r.top)  / displayScale;
  });
  canvas.addEventListener("mousedown", () => { mouse.down = true; initAudio(); });
  canvas.addEventListener("mouseup",   () => mouse.down = false);
  document.addEventListener("keydown", e => {
    keys[e.code] = true;
    if(e.code==="KeyE"&&state==="playing") cycleFormation();
    if(e.code==="KeyQ"&&state==="playing") activateSpecial();
    if(e.code==="KeyR"&&state==="playing") activatePing();
    e.preventDefault();
  });
  document.addEventListener("keyup",   e => { keys[e.code] = false; });
} else {
  window.addEventListener("load", buildMobileControls);
}

function buildMobileControls() {
  const ui = document.createElement("div");
  ui.id = "mobileUI";
  ui.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:999;touch-action:none;display:none";

  const leftPanel = document.createElement("div");
  leftPanel.style.cssText = "position:absolute;left:0;bottom:0;width:220px;height:280px;pointer-events:none";

  const missileBtn = document.createElement("div");
  missileBtn.textContent = "MISSILE";
  missileBtn.style.cssText = "position:absolute;left:65px;bottom:185px;width:70px;height:70px;background:rgba(255,120,0,0.18);border:2px solid rgba(255,120,0,0.7);border-radius:50%;color:#f80;font:bold 12px monospace;display:flex;align-items:center;justify-content:center;pointer-events:all;touch-action:none;user-select:none;-webkit-user-select:none";
  missileBtn.addEventListener("touchstart", e => { e.preventDefault(); keys["KeyF"] = true;  initAudio(); }, { passive: false });
  missileBtn.addEventListener("touchend",   e => { e.preventDefault(); keys["KeyF"] = false; }, { passive: false });

  const leftBase = document.createElement("div");
  leftBase.style.cssText = "position:absolute;left:10px;bottom:20px;width:160px;height:160px;background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.2);border-radius:50%;pointer-events:all;touch-action:none";
  const leftKnob = document.createElement("div");
  leftKnob.style.cssText = "position:absolute;width:60px;height:60px;background:rgba(255,255,255,0.22);border:2px solid rgba(255,255,255,0.55);border-radius:50%;left:50px;top:50px";
  leftBase.appendChild(leftKnob);

  leftBase.addEventListener("touchstart", e => {
    e.preventDefault(); lastTouchTime=Date.now();
    const t = e.changedTouches[0];
    const r = leftBase.getBoundingClientRect();
    mobileJoy.active  = true;
    mobileJoy.touchId = t.identifier;
    mobileJoy.startX  = r.left + r.width  / 2;
    mobileJoy.startY  = r.top  + r.height / 2;
    initAudio();
  }, { passive: false });
  leftBase.addEventListener("touchmove", e => {
    e.preventDefault();
    if (!mobileJoy.active) return;
    let t = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === mobileJoy.touchId) { t = e.touches[i]; break; }
    }
    if (!t) return;
    const maxR = 56;
    let dx = t.clientX - mobileJoy.startX;
    let dy = t.clientY - mobileJoy.startY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) { dx *= maxR / dist; dy *= maxR / dist; }
    mobileJoy.dx = dx / maxR; mobileJoy.dy = dy / maxR;
    leftKnob.style.left = (50 + dx) + "px";
    leftKnob.style.top  = (50 + dy) + "px";
  }, { passive: false });
  leftBase.addEventListener("touchend", e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === mobileJoy.touchId) {
        mobileJoy.active = false; mobileJoy.touchId = null;
        mobileJoy.dx = 0; mobileJoy.dy = 0;
        leftKnob.style.left = "50px"; leftKnob.style.top = "50px";
      }
    }
  });

  leftPanel.appendChild(missileBtn);
  leftPanel.appendChild(leftBase);

  const rightPanel = document.createElement("div");
  rightPanel.style.cssText = "position:absolute;right:0;bottom:0;width:220px;height:280px;pointer-events:none";

  const boostBtn = document.createElement("div");
  boostBtn.textContent = "BOOST";
  boostBtn.style.cssText = "position:absolute;right:65px;bottom:185px;width:70px;height:70px;background:rgba(0,180,255,0.18);border:2px solid rgba(0,180,255,0.7);border-radius:50%;color:#0af;font:bold 13px monospace;display:flex;align-items:center;justify-content:center;pointer-events:all;touch-action:none;user-select:none;-webkit-user-select:none";
  boostBtn.addEventListener("touchstart", e => { e.preventDefault(); keys["ShiftLeft"] = true;  initAudio(); }, { passive: false });
  boostBtn.addEventListener("touchend",   e => { e.preventDefault(); keys["ShiftLeft"] = false; }, { passive: false });

  const rightBase = document.createElement("div");
  rightBase.style.cssText = "position:absolute;right:10px;bottom:20px;width:160px;height:160px;background:rgba(255,80,80,0.05);border:2px solid rgba(255,80,80,0.25);border-radius:50%;pointer-events:all;touch-action:none";
  const rightKnob = document.createElement("div");
  rightKnob.style.cssText = "position:absolute;width:60px;height:60px;background:rgba(255,80,80,0.28);border:2px solid rgba(255,120,80,0.7);border-radius:50%;left:50px;top:50px";
  rightBase.appendChild(rightKnob);

  rightBase.addEventListener("touchstart", e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const r = rightBase.getBoundingClientRect();
    lastTouchTime=Date.now();
    mobileAim.active   = true;
    mobileAim.shooting = true;
    mobileAim.touchId  = t.identifier;
    mobileAim.startX   = r.left + r.width  / 2;
    mobileAim.startY   = r.top  + r.height / 2;
    mouse.down = true;
    initAudio();
  }, { passive: false });
  rightBase.addEventListener("touchmove", e => {
    e.preventDefault();
    if (!mobileAim.active) return;
    let t = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === mobileAim.touchId) { t = e.touches[i]; break; }
    }
    if (!t) return;
    const maxR = 56;
    let dx = t.clientX - mobileAim.startX;
    let dy = t.clientY - mobileAim.startY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) { dx *= maxR / dist; dy *= maxR / dist; }
    mobileAim.dx = dx / maxR; mobileAim.dy = dy / maxR;
    rightKnob.style.left = (50 + dx) + "px";
    rightKnob.style.top  = (50 + dy) + "px";
    if (dist > 6) {
      mouse.x = (player.x + player.w / 2) + (dx / maxR) * 800;
      mouse.y = (player.y + player.h / 2) + (dy / maxR) * 800;
    }
  }, { passive: false });
  rightBase.addEventListener("touchend", e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === mobileAim.touchId) {
        mobileAim.active   = false;
        mobileAim.shooting = false;
        mobileAim.touchId  = null;
        mobileAim.dx = 0; mobileAim.dy = 0;
        mouse.down = false;
        rightKnob.style.left = "50px"; rightKnob.style.top = "50px";
      }
    }
  });

  rightPanel.appendChild(boostBtn);
  rightPanel.appendChild(rightBase);

  const formationBtn = document.createElement("div");
  formationBtn.id = "formationBtn";
  formationBtn.textContent = "◀ BEHIND";
  formationBtn.style.cssText = "position:absolute;bottom:28px;left:50%;transform:translateX(-50%);padding:8px 20px;background:rgba(0,170,255,0.18);border:2px solid rgba(0,170,255,0.7);border-radius:16px;color:#0af;font:bold 15px monospace;pointer-events:all;touch-action:none;user-select:none;-webkit-user-select:none;white-space:nowrap;z-index:10";
  formationBtn.addEventListener("touchstart", e => { e.preventDefault(); cycleFormation(); }, { passive: false });
  ui.appendChild(formationBtn);

  const specialMobileBtn = document.createElement("div");
  specialMobileBtn.id = "mobileSpecialBtn";
  specialMobileBtn.textContent = "SPECIAL";
  specialMobileBtn.style.cssText = "position:absolute;bottom:68px;left:calc(50% - 110px);padding:8px 16px;background:rgba(255,130,0,0.18);border:2px solid rgba(255,130,0,0.7);border-radius:14px;color:#f80;font:bold 15px monospace;pointer-events:all;touch-action:none;user-select:none;-webkit-user-select:none;white-space:nowrap;z-index:10";
  specialMobileBtn.addEventListener("touchstart", e=>{e.preventDefault();activateSpecial();},{passive:false});
  ui.appendChild(specialMobileBtn);

  const pingMobileBtn = document.createElement("div");
  pingMobileBtn.textContent = "PING";
  pingMobileBtn.style.cssText = "position:absolute;bottom:68px;left:calc(50% + 20px);padding:8px 16px;background:rgba(255,220,0,0.18);border:2px solid rgba(255,220,0,0.7);border-radius:14px;color:#fc0;font:bold 15px monospace;pointer-events:all;touch-action:none;user-select:none;-webkit-user-select:none;white-space:nowrap;z-index:10";
  pingMobileBtn.addEventListener("touchstart", e=>{e.preventDefault();activatePing();},{passive:false});
  ui.appendChild(pingMobileBtn);

  ui.appendChild(leftPanel);
  ui.appendChild(rightPanel);
  document.body.appendChild(ui);
}

// ============================================================
// AUDIO
// ============================================================
let audioCtx = null;
const audioBuffers = {};
let audioReady = false;

const SOUND_FILES = {
  shoot_laser:     "assets/sounds/shoot_laser.wav",
  shoot_balistic: "assets/sounds/shoot_balistic.wav",
  shoot_railgun:   "assets/sounds/shoot_railgun.wav",
  hit_balistic:   "assets/sounds/hit_balistic.wav",
  hit_laser:       "assets/sounds/hit_laser.wav",
  hit_distortion:  "assets/sounds/hit_distortion.wav",
  explode:         "assets/sounds/explode.wav",
};

function initAudio() {
  if (audioCtx) { if (audioCtx.state === "suspended") audioCtx.resume(); return; }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let loaded = 0;
  const total = Object.keys(SOUND_FILES).length;
  for (const [key, path] of Object.entries(SOUND_FILES)) {
    fetch(path)
      .then(r => { if (!r.ok) throw new Error("missing"); return r.arrayBuffer(); })
      .then(buf => audioCtx.decodeAudioData(buf))
      .then(decoded => { audioBuffers[key] = decoded; loaded++; if (loaded===total) audioReady=true; })
      .catch(() => { loaded++; if (loaded===total) audioReady=true; });
  }
}

function playSound(key, { volume = 1.0, pitch = 1.0 } = {}) {
  if (!audioCtx || !audioBuffers[key]) return;
  if (audioCtx.state === "suspended") { audioCtx.resume(); return; }
  try {
    const src  = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = audioBuffers[key];
    src.playbackRate.value = Math.max(0.1, pitch);
    gain.gain.value = Math.min(2.0, volume);
    src.connect(gain); gain.connect(audioCtx.destination);
    src.start();
  } catch(e) {}
}

function playExplosion(size) {
  playSound("explode", { pitch: Math.max(0.25, 1.5-size*0.09), volume: Math.min(1.8, 0.4+size*0.1) });
}
function playShootSound(category, isPlayer) {
  if (!isPlayer) return;
  const p = 0.9 + Math.random()*0.2;
  if (category==="ballistic") playSound("shoot_balistic", { volume:0.35, pitch:p });
  else if (category==="laser"||category==="distortion") playSound("shoot_laser", { volume:0.28, pitch:p });
}
function playHitSound(category) {
  const p = 0.85 + Math.random()*0.3;
  if (category==="ballistic")       playSound("hit_balistic",  { volume:0.5,  pitch:p });
  else if (category==="distortion") playSound("hit_distortion", { volume:0.45, pitch:p });
  else                              playSound("hit_laser",       { volume:0.4,  pitch:p });
}

// ============================================================
// HIT EFFECTS
// ============================================================
let hitEffects = [];

function spawnHitEffect(x, y, bullet) {
  if(hitEffects.length >= MAX_HIT_EFFECTS) return;
  const cat=bullet.category||"laser", size=bullet.weaponSize||1, bw=bullet.w||4, LIFE=12;
  if (cat==="ballistic") {
    hitEffects.push({ type:"ballistic", x, y, maxR:bw>=15?size*9:size*5, life:LIFE, maxLife:LIFE });
  } else if (cat==="laser") {
    const count=Math.min(3, 2+Math.floor(size*0.4));
    for (let i=0;i<count;i++) {
      const a=Math.random()*Math.PI*2, spd=1.5+Math.random()*2.5;
      hitEffects.push({ type:"laser_pellet", x, y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd, len:4+size*1.5, life:LIFE, maxLife:LIFE });
    }
  } else if (cat==="distortion") {
    for (let i=0;i<2;i++) hitEffects.push({ type:"distortion_wave", x, y, maxR:18+size*6, delay:i*3, life:LIFE, maxLife:LIFE });
  }
}

function spawnRailgunEffect(x, y, size) {
  const LIFE=16, count=Math.min(5, 3+Math.floor(size*0.4));
  for (let i=0;i<count;i++) {
    const ox=(Math.random()-0.5)*size*14, oy=(Math.random()-0.5)*size*14;
    hitEffects.push({ type:"railgun_circle", x:x+ox, y:y+oy, maxR:4+Math.random()*size*5, life:LIFE, maxLife:LIFE });
  }
}

function updateHitEffects() {
  hitEffects.forEach(e => { e.life--; if(e.type==="laser_pellet"){e.x+=e.vx;e.y+=e.vy;} });
  hitEffects = hitEffects.filter(e=>e.life>0);
}

function drawHitEffects() {
  hitEffects.forEach(e => {
    const t=1-e.life/e.maxLife, alpha=e.life/e.maxLife;
    if (e.type==="ballistic") {
      const r=e.maxR*t;
      ctx.save(); ctx.globalAlpha=alpha*0.85; ctx.strokeStyle="#ff8800"; ctx.lineWidth=2+(1-t)*3; ctx.shadowColor="#ff4400"; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(e.x,e.y,Math.max(0.5,r),0,Math.PI*2); ctx.stroke(); ctx.restore();
    } else if (e.type==="laser_pellet") {
      ctx.save(); ctx.globalAlpha=alpha; ctx.strokeStyle="#ff8866"; ctx.lineWidth=1.5; ctx.shadowColor="#ff4422"; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.moveTo(e.x,e.y); ctx.lineTo(e.x-e.vx*3,e.y-e.vy*3); ctx.stroke(); ctx.restore();
    } else if (e.type==="distortion_wave") {
      const adjLife=e.life-(e.delay||0); if(adjLife<=0)return;
      const r=e.maxR*(1-adjLife/e.maxLife);
      ctx.save(); ctx.globalAlpha=(adjLife/e.maxLife)*0.7; ctx.strokeStyle="#bb66ff"; ctx.lineWidth=1.5; ctx.setLineDash([5,5]); ctx.shadowColor="#8844ff"; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(e.x,e.y,Math.max(0.5,r),0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    } else if (e.type==="railgun_circle") {
      const r=e.maxR*Math.min(1,t*2.5);
      ctx.save(); ctx.globalAlpha=alpha*0.9; ctx.fillStyle=t<0.4?"#ffffff":"#ff7700"; ctx.shadowColor="#ffaa00"; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.arc(e.x,e.y,Math.max(0.5,r),0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  });
}

// ============================================================
// DEATH EFFECTS
// ============================================================
let deathEffects = [];

function spawnDeathEffect(enemy) {
  const cx=enemy.x+enemy.w/2, cy=enemy.y+enemy.h/2;
  const size=ENEMIES[enemy.type]?.size||2;
  const colors=["#ff2200","#ff5500","#ff9900","#ffcc00","#4488ff","#ffffff"];
  const count=Math.min(8, 2+Math.floor(size*1.5));
  for (let i=0;i<count;i++) {
    if(deathEffects.length>=MAX_DEATH_EFFECTS) break;
    const delay=Math.floor(Math.random()*Math.max(1,size*3));
    const radius=6+Math.random()*size*9;
    const life=18+Math.floor(Math.random()*22);
    const color=colors[Math.floor(Math.random()*colors.length)];
    const ox=(Math.random()-0.5)*enemy.w*0.55, oy=(Math.random()-0.5)*enemy.w*0.55;
    deathEffects.push({ type:"death_exp", x:cx+ox, y:cy+oy, radius, life, maxLife:life, delay, color });
  }
  if (size>=5) deathEffects.push({ type:"death_shockwave", x:cx, y:cy, maxR:enemy.w*1.3, life:22, maxLife:22 });
}

function updateDeathEffects() {
  deathEffects.forEach(e=>{ if(e.delay>0)e.delay--; else e.life--; });
  deathEffects=deathEffects.filter(e=>e.life>0||e.delay>0);
}

function drawDeathEffects() {
  deathEffects.forEach(e=>{
    if(e.delay>0)return;
    const t=1-e.life/e.maxLife, alpha=e.life/e.maxLife;
    if (e.type==="death_exp") {
      const r=e.radius*Math.min(1,t*2.8);
      ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=e.color; ctx.shadowColor=e.color; ctx.shadowBlur=18;
      ctx.beginPath(); ctx.arc(e.x,e.y,Math.max(0.5,r),0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=alpha*0.55; ctx.fillStyle="#ffffff";
      ctx.beginPath(); ctx.arc(e.x,e.y,Math.max(0.5,r*0.35),0,Math.PI*2); ctx.fill(); ctx.restore();
    } else if (e.type==="death_shockwave") {
      const r=e.maxR*t;
      ctx.save(); ctx.globalAlpha=(1-t)*0.6; ctx.strokeStyle="#ffffff"; ctx.lineWidth=4*(1-t); ctx.shadowColor="#aaaaff"; ctx.shadowBlur=22;
      ctx.beginPath(); ctx.arc(e.x,e.y,Math.max(0.5,r),0,Math.PI*2); ctx.stroke(); ctx.restore();
    }
  });
}

// ============================================================
// GAME STATE
// ============================================================
let state="menu", money=5000000, currentWave=0, infiniteMode=false, currentShipName="Starlight";
let player={}, allies=[], enemies=[], playerBullets=[], enemyBullets=[];
let missileTimer=0, ownedShips=[], shopOpenedFromMenu=false;
let waveTransitionTimer=0, waveTransitionText="", beamFlashes=[], nukeRings=[];
let frameCount = 0;
let allyFormation = "behind";
let playerTookDamageThisWave = false;
const MAX_HIT_EFFECTS = 80;
const MAX_DEATH_EFFECTS = 40;
let pingTarget = null;
let waveReinforceTimer = 0;
let waveReinforceDone = false;
let lastTouchTime = 0;

// Shadow Comet tracking
let shadowCometKills = 0;
let shadowCometNoHitWave = false;
let shadowCometActive = false;
let shadowCometCutsceneState = "none";
let shadowCometCutsceneTimer = 0;
let pdcDisabledThisWave = false;
let shadowCometTurretLimit = false;

const imgCache={};
function getImage(fn) {
  if (!imgCache[fn]) { const i=new Image(); i.src="assets/"+fn; imgCache[fn]=i; }
  return imgCache[fn];
}
function resolveWType(wk,fallback) {
  if (!wk||wk==="builtin") return fallback;
  return wk.replace(/_s\d+$/,"");
}

const SMALL_ENEMY_TYPES=new Set(["Raptor","Rouge","Corsair","Sprite"]);
function isSmallEnemy(type){return SMALL_ENEMY_TYPES.has(type);}
function getEnemyAccel(e) {
  const s=ENEMIES[e.type]?.size||2;
  return e.speed*Math.max(0.06,0.55/Math.sqrt(s));
}
function getEnemyInaccuracySpread() {
  const acc=Math.min(0.75,0.15+(Math.max(0,currentWave-1)/19)*0.60);
  return 1.2*(1-acc/0.75);
}

// ── SHIELD FACES ──────────────────────────────────────────────
function shipHasShieldFaces(name) {
  return typeof NO_SHIELD_FACES !== "undefined" ? !NO_SHIELD_FACES.has(name) : true;
}

function initShieldFaces(obj) {
  const name = obj.type || obj.shipName || (obj === player ? currentShipName : null);
  const useFaces = name ? shipHasShieldFaces(name) : true;
  if (!useFaces) {
    obj.shieldFaces = null;
    obj.maxShieldFaces = null;
    return;
  }
  const q = obj.maxShields / 4;
  obj.shieldFaces = { front: q, back: q, left: q, right: q };
  obj.maxShieldFaces = { front: q, back: q, left: q, right: q };
}

function getHitFace(bullet, target) {
  // Use angle from bullet TO target center — this is the impact direction
  // rel ≈ 0   → impact from front of ship → FRONT face
  // rel ≈ ±π  → impact from behind → BACK face
  // rel ≈ +π/2 → impact from ship's right → RIGHT face
  // rel ≈ -π/2 → impact from ship's left  → LEFT face
  const tcx = target.x + target.w/2;
  const tcy = target.y + target.h/2;
  const impactAngle = Math.atan2(tcy - (bullet.y + (bullet.h||0)/2),
                                  tcx - (bullet.x + (bullet.w||0)/2));
  let rel = impactAngle - (target.rotation||0);
  while(rel >  Math.PI) rel -= Math.PI*2;
  while(rel < -Math.PI) rel += Math.PI*2;
  if(Math.abs(rel) < Math.PI*0.25) return "front";
  if(Math.abs(rel) > Math.PI*0.75) return "back";
  return rel > 0 ? "right" : "left";
}

function getDirectionalArmorMult(bullet, target) {
  const name = target.type || target.shipName || (target === player ? currentShipName : null);
  if (name && !shipHasShieldFaces(name)) return 1.0;
  if(!target.rotation && target.rotation!==0) return 1.0;
  const face = getHitFace(bullet, target);
  if(face==="front"||face==="back") return 0.7;
  return 1.1;
}

function applyShieldFaceHit(target, bullet, shieldDmg) {
  if(!target.shieldFaces) {
    target.shields = Math.max(0, target.shields - shieldDmg);
    return;
  }
  const face = getHitFace(bullet, target);
  const faceHp = target.shieldFaces[face];
  if (faceHp <= 0) return;
  const absorbed = Math.min(faceHp, shieldDmg);
  target.shieldFaces[face] = Math.max(0, faceHp - absorbed);
  target.shields = Object.values(target.shieldFaces).reduce((s,v)=>s+v,0);
}

function isFaceDown(target, bullet) {
  if (!target.shieldFaces) return target.shields <= 0;
  const face = getHitFace(bullet, target);
  return target.shieldFaces[face] <= 0;
}

function regenShieldFaces(obj, regenRate) {
  if(!obj.shieldFaces) {
    if(obj.shields<obj.maxShields) obj.shields = Math.min(obj.maxShields, obj.shields+regenRate);
    return;
  }
  for(const f of ["front","back","left","right"]) {
    if(obj.shieldFaces[f] < obj.maxShieldFaces[f]) {
      obj.shieldFaces[f] = Math.min(obj.maxShieldFaces[f], obj.shieldFaces[f] + regenRate/4);
    }
  }
  obj.shields = Object.values(obj.shieldFaces).reduce((s,v)=>s+v,0);
}

function drawShieldFaces(obj) {
  if (!obj.shieldFaces) return;
  const cx = obj.x + obj.w/2;
  const cy = obj.y + obj.h/2;
  const r = Math.max(obj.w, obj.h) * 0.55 + 4;
  const rotation = obj.rotation || 0;

  const faceAngles = {
    front: rotation,
    right: rotation + Math.PI/2,
    back:  rotation + Math.PI,
    left:  rotation - Math.PI/2,
  };
  const arcHalf = Math.PI * 0.3;

  ctx.save();
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  for (const [face, centerAngle] of Object.entries(faceAngles)) {
    const hp = obj.shieldFaces[face];
    const maxHp = obj.maxShieldFaces[face];
    if (maxHp <= 0 || hp <= 0) continue;

    const frac = hp / maxHp;
    const arcSpan = arcHalf * 2 * frac;
    if (arcSpan < 0.01) continue;

    const startAngle = centerAngle - arcSpan / 2;
    const endAngle   = centerAngle + arcSpan / 2;

    const alpha = 0.4 + 0.6 * frac;
    const glowR = Math.round(0   + (1-frac)*80);
    const glowG = Math.round(160 + (1-frac)*95);
    const glowB = 255;
    ctx.strokeStyle = `rgba(${glowR},${glowG},${glowB},${alpha})`;
    ctx.shadowColor  = `rgba(0,180,255,${alpha * 0.8})`;
    ctx.shadowBlur   = 8 + 6 * frac;

    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.stroke();
  }
  ctx.restore();
}

function buildAlly(i,totalSlots) {
  const slot=playerLoadout.allies[i];
  if(!slot||!slot.ship) return null;
  const sName=slot.ship;
  const aDef=ALLY_SHIP_DEFS[sName]||ALLY_SHIP_DEFS.Sprite;
  const shieldMult=SHIELD_TIERS[slot.shieldTier||1].mult;
  const wType=resolveWType(slot.weapon,"laser_repeater");
  const _AB=typeof ALLY_BEHAVIORS!=="undefined"?ALLY_BEHAVIORS:{0:{name:"Balanced",speedMult:1,dmgMult:1,dodgeMult:1,shieldMult:1,rpmMult:1}};
  const beh=_AB[slot.behavior||0]||_AB[0];
  const armorMult2=ARMOR_UPGRADE_TIERS[slot.armorTier||1].mult;
  const engTier2=ENGINE_UPGRADE_TIERS[slot.engineTier||1];
  const wqMult2=(typeof WEAPON_QUALITY_TIERS!=="undefined"&&WEAPON_QUALITY_TIERS[slot.weaponQualityTier||1]?.damageMult)||1.0;
  const shieldsFinal=Math.round(aDef.shields*shieldMult*beh.shieldMult);
  const wStatBase=getWeaponStats(wType,aDef.weaponSize);
  let wStats=null;
  if(wStatBase){
    wStats={...wStatBase,
      damage:Math.round(wStatBase.damage*beh.dmgMult*wqMult2),
      fireInterval:Math.round(wStatBase.fireInterval/beh.rpmMult),
    };
  }
  const dodge=Math.min(0.95, Math.max(0, 0.25*beh.dodgeMult*engTier2.dodgeBonus+0.25));
  const allyHp=Math.round(aDef.hp*armorMult2);
  const allyArmor=Math.round(100*armorMult2);
  const allySpeed=(aDef.w>0?2.5:2.0)*engTier2.speedMult;
  const a = {
    type:sName, shipName:sName, name:slot.name||sName,
    x:player.x-80-i*50, y:player.y+(i-(totalSlots-1)/2)*70,
    w:Math.round(aDef.w*SIZE_SCALE), h:Math.round(aDef.h*SIZE_SCALE), hp:allyHp, maxHp:allyHp,
    shields:shieldsFinal, maxShields:shieldsFinal,
    armor:allyArmor, maxArmor:allyArmor, armorType:aDef.armorType,
    img:getImage(aDef.image), color:aDef.color,
    shootTimer:Math.floor(Math.random()*30), vx:0, vy:0, rotation:0, spriteAngleOffset:Math.PI,
    weaponType:wType, weaponSize:aDef.weaponSize, weaponStats:wStats, isAlly:true,
    isHealer:aDef.isHealer||false,
    dodge, speedMult:beh.speedMult,
  };
  initShieldFaces(a);
  return a;
}

function setPlayerShip(name) {
  currentShipName=name; playerLoadout.ship=name;
  const d=SHIPS[name];
  let wType;
  if (d.bespoke||d.weaponType==="none") wType=d.weaponType;
  else wType=resolveWType(playerLoadout.mainWeapon,d.weaponType);
  const _wStatsRaw=(wType&&wType!=="none")?getWeaponStats(wType,d.weaponSize):null;
  const _wqMult=(typeof WEAPON_QUALITY_TIERS!=="undefined"&&WEAPON_QUALITY_TIERS[playerLoadout.weaponQualityTier||1]?.damageMult)||1.0;
  const wStats=_wStatsRaw?{..._wStatsRaw,damage:Math.round(_wStatsRaw.damage*_wqMult)}:null;
  const shieldMult=SHIELD_TIERS[playerLoadout.shieldTier||1].mult;
  const baseShields=Math.round(d.shields*shieldMult);
  const armorMult=ARMOR_UPGRADE_TIERS[playerLoadout.armorTier||1].mult;
  const baseArmor=Math.round(d.armor*armorMult);
  const baseHp=Math.round(d.hp*armorMult);
  const engTier=ENGINE_UPGRADE_TIERS[playerLoadout.engineTier||1];
  const spriteOffset=(name==="Dominion")?0:Math.PI;
  const baseSpeed=d.speed*engTier.speedMult;
  const isComet=name==="Comet"||name==="Vengeance";
  const boostDuration=Math.round((isComet?120:60)*engTier.boostDurMult);
  const boostCooldownMax=Math.round((isComet?120:180)*engTier.boostCDMult);
  const sizeNum=d.size||1;
  const baseDodgeBySize = sizeNum<=1?0.12 : sizeNum<=2?0.09 : sizeNum<=3?0.07 : sizeNum<=4?0.05 : sizeNum<=6?0.03 : 0.02;
  const specialDodge=isComet?0.35:0;
  const dodgeBase=Math.min(0.90, specialDodge + baseDodgeBySize + engTier.dodgeBonus);
  const dodgeBoosted=Math.min(0.95, specialDodge + baseDodgeBySize*2 + engTier.dodgeBonus);
  player={
    x:80, y:GAME_H/2-20, w:Math.round((40+(d.size||1)*16)*SIZE_SCALE), h:Math.round((24+(d.size||1)*8)*SIZE_SCALE),
    hp:baseHp, maxHp:baseHp, shields:baseShields, maxShields:baseShields,
    armor:baseArmor, maxArmor:baseArmor, armorType:d.armorType||"light",
    missiles:Math.round(d.missiles*(typeof MISSILE_STORAGE_TIERS!=="undefined"?MISSILE_STORAGE_TIERS[playerLoadout.missileTier||1].mult:1)),
    maxMissiles:Math.round(d.missiles*(typeof MISSILE_STORAGE_TIERS!=="undefined"?MISSILE_STORAGE_TIERS[playerLoadout.missileTier||1].mult:1)),
    speed:baseSpeed, maxSpeed:baseSpeed, accel:baseSpeed*0.20,
    weaponType:wType, weaponSize:d.weaponSize, weaponStats:wStats,
    bespoke:d.bespoke, doubleShot:d.doubleShot||false, pdcCount:d.pdc, missileType:d.missileType||2,
    missileRack:[...(playerLoadout.missileRack||[])], missileRackIdx:0,
    img:getImage(d.image), color:d.color, rotation:0, spriteAngleOffset:spriteOffset,
    vx:0, vy:0, shootTimer:0,
    boosting:false, boostTimer:0, boostCooldown:0,
    boostDuration, boostCooldownMax, dodgeBase, dodgeBoosted,
    railgunCharge:0, railgunCharging:false,
    specialCooldown:0, specialActive:false, specialTimer:0,
    specialMissilesUsed:0, specialSalvoTimer:0, specialSalvoCount:0, specialSalvoTotal:0,
    dominionOvercharged:false,
    revengeActive:false, revengeCooldown:0,
    shipName: name,
  };
  initShieldFaces(player);
  player.turrets=[];
  const pdcSizes=d.pdcSizes||null;
  for (let ti=0;ti<(d.pdc||0);ti++) {
    const tSize=pdcSizes?pdcSizes[ti]:(d.pdcSize||1);
    const pdcWk=playerLoadout.pdcWeapons&&playerLoadout.pdcWeapons[ti];
    const pdcType=resolveWType(pdcWk,"laser_repeater");
    const pdcStats=getWeaponStats(pdcType,tSize);
    const ry=(ti-(d.pdc-1)/2)*12;
    const _tuMult=(typeof TURRET_UPGRADE_TIERS!=="undefined"&&TURRET_UPGRADE_TIERS[playerLoadout.turretTier||1]?.rpmMult)||1.0;
    const _tuFireRate=Math.round((pdcStats?pdcStats.fireInterval*2:40)/_tuMult);
    player.turrets.push({rx:0,ry,fireRate:_tuFireRate,shootTimer:Math.floor(Math.random()*40),weaponStats:pdcStats});
  }
  const totalSlots=2+(d.extraAllySlots||0);
  while(playerLoadout.allies.length<totalSlots) playerLoadout.allies.push(null);
  allies=[];
  for(let i=0;i<totalSlots;i++){const a=buildAlly(i,totalSlots);if(a)allies.push(a);}
}

function respawnDeadAllies() {
  const d=SHIPS[currentShipName];
  const totalSlots=2+(d.extraAllySlots||0);
  allies=[];
  for(let i=0;i<totalSlots;i++){const a=buildAlly(i,totalSlots);if(a)allies.push(a);}
}

// ── SHADOW COMET WAVE ─────────────────────────────────────────
function spawnShadowCometWave() {
  enemies=[]; playerBullets=[]; enemyBullets=[]; beamFlashes=[]; nukeRings=[]; hitEffects=[]; deathEffects=[];
  if(window._packs) window._packs={};
  allies=[];
  // Bulwark and Leviathan get 1 manual turret against Shadow Comet
  const _scShip = playerLoadout.ship || currentShipName;
  if (_scShip === "Bulwark" || _scShip === "Leviathan") {
    pdcDisabledThisWave = false; // keep turrets on for these ships
    shadowCometTurretLimit = true; // flag to limit to 1 effective turret
  } else {
    pdcDisabledThisWave = true;
  }
  shadowCometActive = true;
  shadowCometNoHitWave = true;
  shadowCometCutsceneState = "intercepted";
  shadowCometCutsceneTimer = 180;

  const scaled = getShadowCometStats(shadowCometKills);
  const d = ENEMIES.ShadowComet;
  const sizeNum = d.size || 1;
  const ew = Math.round((40 + sizeNum * 16) * SIZE_SCALE);
  const eh = Math.round((24 + sizeNum * 8)  * SIZE_SCALE);

  const sc = {
    type: "ShadowComet",
    x: GAME_W * 0.7,
    y: GAME_H / 2 - eh / 2,
    w: ew, h: eh,
    hp: scaled.hp, maxHp: scaled.hp,
    shields: scaled.shields, maxShields: scaled.shields,
    armor: d.armor, maxArmor: d.armor, armorType: d.armorType,
    speed: scaled.speed,
    fireRate: d.fireRate, shootTimer: 30,
    img: getImage(d.image), color: d.color, score: 0,
    spriteAngleOffset: Math.PI,
    stunTimer: 0, vx: 0, vy: 0,
    isShadowComet: true,
    damageMult: scaled.damage || 1,
    dodgeTimer: 0,
    repositionTimer: 0,
    repositionTarget: null,
    rotation: Math.PI,
    turnSpeed: 0.12,
    turrets: [],
  };
  initShieldFaces(sc);
  window._pendingShadowComet = sc;

  player.x = GAME_W * 0.25;
  player.y = GAME_H / 2 - player.h / 2;
  player.vx = 0; player.vy = 0;
  // Face toward Shadow Comet position
  const _scx = GAME_W * 0.7 + 20;
  const _scy = GAME_H / 2;
  player.rotation = Math.atan2(_scy - (player.y + player.h/2), _scx - (player.x + player.w/2));
}

function updateShadowCometCutscene() {
  shadowCometCutsceneTimer--;
  if (shadowCometCutsceneState === "intercepted" && shadowCometCutsceneTimer <= 0) {
    shadowCometCutsceneState = "dialogue";
    shadowCometCutsceneTimer = 150;
  } else if (shadowCometCutsceneState === "dialogue" && shadowCometCutsceneTimer <= 0) {
    shadowCometCutsceneState = "fighting";
    if (window._pendingShadowComet) {
      enemies.push(window._pendingShadowComet);
      window._pendingShadowComet = null;
    }
    state = "playing";
  }
}

function drawShadowCometCutscene() {
  ctx.fillStyle = "#000011"; ctx.fillRect(0,0,GAME_W,GAME_H);
  for(let i=0;i<150;i++) ctx.fillRect((i*137)%GAME_W,(i*97)%GAME_H,1,1);

  drawEntity(player);
  if (window._pendingShadowComet) drawEntity(window._pendingShadowComet);

  ctx.textAlign = "center";

  if (shadowCometCutsceneState === "intercepted") {
    showSpecialToast("⚠ Allies were intercepted. Turrets disabled.");
    if (window._pendingShadowComet) {
      const sc = window._pendingShadowComet;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(sc.x + sc.w/2 - 80, sc.y - 34, 160, 22);
      ctx.fillStyle = "#ff4444";
      ctx.font = "bold 13px monospace";
      ctx.fillText("Shadow Comet", sc.x + sc.w/2, sc.y - 18);
      ctx.restore();
    }
  } else if (shadowCometCutsceneState === "dialogue") {
    showSpecialToast("⚠ Allies were intercepted. Turrets disabled.");
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.fillRect(GAME_W/2 - 260, GAME_H/2 - 44, 520, 64);
    ctx.strokeStyle = "#ff4444"; ctx.lineWidth = 1.5;
    ctx.strokeRect(GAME_W/2 - 260, GAME_H/2 - 44, 520, 64);
    ctx.fillStyle = "#ff4444"; ctx.font = "bold 12px monospace";
    ctx.fillText("Shadow Comet", GAME_W/2, GAME_H/2 - 28);
    ctx.fillStyle = "#eee"; ctx.font = "15px monospace";
    ctx.fillText("\"It's just you and me!\"", GAME_W/2, GAME_H/2 - 4);
    ctx.restore();
    if (window._pendingShadowComet) {
      const sc = window._pendingShadowComet;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(sc.x + sc.w/2 - 80, sc.y - 34, 160, 22);
      ctx.fillStyle = "#ff4444"; ctx.font = "bold 13px monospace";
      ctx.fillText("Shadow Comet", sc.x + sc.w/2, sc.y - 18);
      ctx.restore();
    }
  }
  ctx.textAlign = "left";
}

function updateShadowCometAI(e) {
  const pcx = player.x + player.w/2, pcy = player.y + player.h/2;
  const ecx = e.x + e.w/2, ecy = e.y + e.h/2;

  const targetRot = Math.atan2(pcy - ecy, pcx - ecx);
  let rotDiff = targetRot - (e.rotation||0);
  while(rotDiff > Math.PI) rotDiff -= Math.PI*2;
  while(rotDiff < -Math.PI) rotDiff += Math.PI*2;
  e.rotation = (e.rotation||0) + Math.sign(rotDiff) * Math.min(Math.abs(rotDiff), e.turnSpeed||0.12);

  e.repositionTimer = (e.repositionTimer||0) - 1;
  if (e.repositionTimer <= 0) {
    e.repositionTimer = 40 + Math.floor(Math.random() * 60);
    e.repositionTarget = {
      x: GAME_W * (0.55 + Math.random() * 0.35),
      y: 60 + Math.random() * (GAME_H - 120),
    };
  }

  if (e.repositionTarget) {
    const tdx = e.repositionTarget.x - e.x;
    const tdy = e.repositionTarget.y - e.y;
    const dist = Math.hypot(tdx, tdy) || 1;
    e.vx += (tdx/dist) * e.speed * 0.35;
    e.vy += (tdy/dist) * e.speed * 0.35;
  }

  e.dodgeTimer = (e.dodgeTimer||0) - 1;
  if (e.dodgeTimer <= 0) {
    e.dodgeTimer = 18 + Math.floor(Math.random() * 30);
    const perpAngle = e.rotation + (Math.random() > 0.5 ? Math.PI/2 : -Math.PI/2);
    e.vx += Math.cos(perpAngle) * e.speed * 1.2;
    e.vy += Math.sin(perpAngle) * e.speed * 1.2;
  }

  e.vx *= 0.88; e.vy *= 0.88;
  const spd = Math.hypot(e.vx, e.vy);
  if (spd > e.speed * 2) { e.vx *= (e.speed*2)/spd; e.vy *= (e.speed*2)/spd; }
  e.x += e.vx; e.y += e.vy;
  e.x = Math.max(10, Math.min(GAME_W - e.w - 10, e.x));
  e.y = Math.max(10, Math.min(GAME_H - e.h - 10, e.y));

  e.shootTimer--;
  if (e.shootTimer <= 0) {
    const wStats = getWeaponStats("ballistic_cannon", 5);
    if (wStats) {
      const slowStats = { ...wStats, speed: 3.5, damage: Math.round(wStats.damage * (e.damageMult||1)) };
      const pred = predictPos(pcx, pcy, player.vx||0, player.vy||0, ecx, ecy, slowStats.speed);
      const angle = Math.atan2(pred.y - ecy, pred.x - ecx);
      const inaccuracy = (Math.random() - 0.5) * 0.15;
      const bullets = fireBullets({x:ecx-e.w/2, y:ecy-e.h/2, w:e.w, h:e.h}, slowStats, angle+inaccuracy, false);
      bullets.forEach(b => { b.color = "#ff2200"; b.shadowCometBullet = true; });
      enemyBullets.push(...bullets);
    }
    e.shootTimer = e.fireRate;
  }
}

function checkShadowCometDefeat() {
  const reward = infiniteMode ? generateInfiniteWave(currentWave).reward : (WAVES[currentWave-1]?.reward || 35000);
  money += reward;
  shadowCometKills++;
  shadowCometActive = false;
  pdcDisabledThisWave = false;

  let unlockMsg = "";
  if (!ownedShips.includes("Comet")) {
    ownedShips.push("Comet");
    cometUnlocked = true;
    unlockMsg = "🌠 COMET UNLOCKED";
  } else if (!isCometFullyUpgraded()) {
    fullUpgradeComet();
    unlockMsg = "⚡ COMET FULLY UPGRADED";
  } else if (shadowCometNoHitWave && !ownedShips.includes("Vengeance")) {
    ownedShips.push("Vengeance");
    vengeanaceUnlocked = true;
    unlockMsg = "⚔ VENGEANCE UNLOCKED — Perfect run!";
  }

  if (unlockMsg) {
    const el = document.createElement("div");
    el.textContent = unlockMsg;
    el.style.cssText = "position:fixed;top:28%;left:50%;transform:translateX(-50%);background:#0a0a0a;color:#ff4400;font:bold 24px monospace;padding:20px 36px;border:2px solid #ff4400;z-index:9999;border-radius:8px;pointer-events:none;text-align:center";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  waveTransitionText = `Wave ${currentWave} Cleared!  +${reward} credits`;
  waveTransitionTimer = 300; state = "waveTransition"; updateHUD();
}

function isCometFullyUpgraded() {
  const ups = shipUpgrades["Comet"];
  if (!ups) return false;
  return ups.shieldTier >= 3 && ups.armorTier >= 3 && ups.engineTier >= 3;
}

function fullUpgradeComet() {
  const ups = shipUpgrades["Comet"] || {};
  ups.shieldTier = 3; ups.ownedShieldTiers = [1,2,3];
  ups.armorTier  = 3; ups.ownedArmorTiers  = [1,2,3];
  ups.engineTier = 3; ups.ownedEngineTiers = [1,2,3];
  shipUpgrades["Comet"] = ups;
  if (currentShipName === "Comet") {
    loadShipUpgrades("Comet");
    setPlayerShip("Comet");
  }
}

function spawnWave() {
  enemies=[]; playerBullets=[]; enemyBullets=[]; beamFlashes=[]; nukeRings=[]; hitEffects=[]; deathEffects=[];
  if(window._packs) window._packs={};
  waveReinforceTimer=0; waveReinforceDone=false;
  shadowCometActive = false;
  pdcDisabledThisWave = false;

  const waveData=infiniteMode?generateInfiniteWave(currentWave):WAVES[currentWave-1];

  if (waveData && waveData.shadowCometWave) {
    spawnShadowCometWave();
    state = "shadowCometCutscene";
    document.getElementById("hud").style.display = "block";
    document.getElementById("inGameBack").style.display = "block";
    if(IS_MOBILE){const ui=document.getElementById("mobileUI");if(ui)ui.style.display="block";}
    return;
  }

  const wrd=waveData.reinforceDelay||0;
  if(wrd>0) waveReinforceTimer=wrd;
  waveData.enemies.forEach(name=>{
    const d=ENEMIES[name];
    const sizeNum=d.size||2;
    const ew=Math.round((32+sizeNum*18)*SIZE_SCALE), eh=Math.round((20+sizeNum*10)*SIZE_SCALE);
    const spawnX=name==="Dreadnaught"?GAME_W-ew/2:Math.floor(GAME_W*0.5+Math.random()*GAME_W*0.45);
    const spawnY=name==="Dreadnaught"?GAME_H/2:Math.floor(40+Math.random()*(GAME_H-80));
    const e={
      type:name, x:spawnX, y:spawnY, w:ew, h:eh,
      hp:d.hp, maxHp:d.hp, shields:d.shields, maxShields:d.shields,
      armor:d.armor||200, maxArmor:d.armor||200, armorType:d.armorType||"light",
      speed:d.speed, fireRate:d.fireRate, shootTimer:Math.floor(Math.random()*d.fireRate),
      img:getImage(d.image), color:d.color, score:d.score,
      spriteAngleOffset:(name==="Dominion"||name==="Dreadnaught")?0:Math.PI,
      stunTimer:0, vx:0, vy:0,
      surroundAngle:Math.random()*Math.PI*2,
    };
    e.turrets=[];
    if(d.turrets){
      const sf=1+((d.size||1)-1)*0.35;
      d.turrets.forEach(t=>e.turrets.push({
        rx:t.rx||0, ry:t.ry||0,
        fireRate:Math.max(6,Math.floor((t.fireRate||d.fireRate||60)*sf)),
        shootTimer:Math.floor(Math.random()*60),
        weaponStats:getWeaponStats(t.weaponType||"laser_repeater",t.weaponSize||2),
      }));
    }
    initShieldFaces(e);
    if(name==="Dominion") e.beamTimer=ENEMIES.Dominion.beamCooldownFrames||600;
    if(name==="Dreadnaught"){e.beamTimer=ENEMIES.Dreadnaught.beamCooldownFrames;e.beamWarningAngle=null;}
    if(typeof ARCHETYPE_POOL!=="undefined"&&ARCHETYPE_POOL[name]){
      const pool=ARCHETYPE_POOL[name];
      e.archetype=pool[Math.floor(Math.random()*pool.length)];
      e.archetypeTimer=0;
    }
    const sizeFactor = ENEMIES[name]?.size || 2;
    e.turnSpeed = sizeFactor <= 2 ? 0.08
                : sizeFactor <= 4 ? 0.05
                : sizeFactor <= 6 ? 0.03
                : 0.015;
    initShieldFaces(e);
    enemies.push(e);
  });
}

function nextWave() {
  currentWave++;
  if(!infiniteMode&&currentWave>WAVES.length){endGame(true);return;}
  pdcDisabledThisWave = false;
  shadowCometActive = false;
  shadowCometTurretLimit = false;
  respawnDeadAllies();
  spawnWave();
  if (state !== "shadowCometCutscene") {
    state="playing";
    document.getElementById("hud").style.display="block";
    document.getElementById("inGameBack").style.display="block";
    if(IS_MOBILE){const ui=document.getElementById("mobileUI");if(ui)ui.style.display="block";}
  }
}

function startGame(infinite) {
  infiniteMode=infinite; currentWave=0;
  document.getElementById("mainMenu").style.display="none";
  if(!ownedShips||ownedShips.length===0) ownedShips=["Starlight"];
  setPlayerShip(playerLoadout.ship||"Starlight");
  if(IS_MOBILE){const ui=document.getElementById("mobileUI");if(ui)ui.style.display="none";}
  showWavesConfirm(infinite);
}

function showWavesConfirm(infinite) {
  document.getElementById("mainMenu").style.display="none";
  let el=document.getElementById("wavesConfirm");
  if(!el){
    el=document.createElement("div");
    el.id="wavesConfirm";
    el.style.cssText="position:fixed;inset:0;background:rgba(0,0,20,0.92);display:flex;align-items:center;justify-content:center;z-index:9000";
    const box=document.createElement("div");
    box.style.cssText="background:#090914;border:2px solid #0af;border-radius:12px;padding:32px 40px;text-align:center;font-family:monospace;max-width:420px";
    box.innerHTML=`
      <div style="color:#0af;font:bold 22px monospace;margin-bottom:10px">⚠ Enter Waves Mode?</div>
      <div style="color:#aaa;font:14px monospace;margin-bottom:18px;line-height:1.6">Once you enter, your credits carry over<br>between waves but there's no turning back.<br>Configure your ship in <b style="color:#fff">Loadout</b> before entering.</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button id="wc_yes" style="padding:10px 28px;font:bold 15px monospace;background:rgba(0,170,255,0.18);border:2px solid #0af;color:#0af;border-radius:8px;cursor:pointer">Let's go!</button>
        <button id="wc_no"  style="padding:10px 28px;font:bold 15px monospace;background:rgba(255,60,60,0.12);border:2px solid #f44;color:#f44;border-radius:8px;cursor:pointer">Go Back</button>
      </div>`;
    el.appendChild(box);
    document.body.appendChild(el);
  }
  el.style.display="flex";
  el.querySelector("#wc_yes").onclick=()=>{
    el.style.display="none";
    nextWave(); // go straight in — no shop
  };
  el.querySelector("#wc_no").onclick=()=>{
    el.style.display="none";
    document.getElementById("mainMenu").style.display="block";
    state="menu";
  };
}

function returnToMenuPreserveMoney() {
  document.getElementById("gameOverMenu").style.display="none";
  document.getElementById("mainMenu").style.display="block";
  state="menu";
}

function endGame(won) {
  state="gameover";
  document.getElementById("gameOverText").textContent=won?"🏆 Victory!":"💀 Game Over";
  document.getElementById("finalMoney").textContent=money;
  document.getElementById("gameOverMenu").style.display="block";
  document.getElementById("hud").style.display="none";
  document.getElementById("inGameBack").style.display="none";
  if(IS_MOBILE){const ui=document.getElementById("mobileUI");if(ui)ui.style.display="none";}
}

// ============================================================
// DAMAGE
// ============================================================
function applyDamage(target,bullet) {
  if(bullet.visualOnly)return;

  if (target===player && bullet.shadowCometBullet) shadowCometNoHitWave = false;

  if(target===player){
    if(player.specialActive&&(currentShipName==="Falcon"||currentShipName==="Comet"))return;
    if(player.specialActive&&currentShipName==="Starlight"&&Math.random()<0.5)return;
    if(currentShipName==="Vengeance"&&player.revengeActive&&Math.random()<0.90)return;
    const dodge=player.boosting?player.dodgeBoosted:player.dodgeBase;
    if(dodge>0&&Math.random()<dodge)return;
    playerTookDamageThisWave=true;
    if(player.specialActive&&currentShipName==="Marauder") bullet={...bullet,damage:(bullet.damage||0)*0.5};
    if(player.specialActive&&currentShipName==="Nemesis")  bullet={...bullet,damage:(bullet.damage||0)*0.5};
  }
  if(target.isAlly){
    if(target.vanguardActive)return;
    const allyDodge=target.dodge||0.25;
    if(Math.random()<allyDodge)return;
    let dmgMult=0.75;
    if(allyFormation==="surround"&&!pingTarget) dmgMult*=0.8;
    if(pingTarget&&!pingTarget.dead) dmgMult*=0.9;
    bullet={...bullet,damage:(bullet.damage||0)*dmgMult};
  }

  if(target.isShadowComet && Math.random() < (target.dodgeChance||0.55)) return;

  if(bullet.missile){
    if(target.shields>0){target.shields-=bullet.damage;if(target.shields<0){target.hp+=target.shields;target.shields=0;}}
    else target.hp-=bullet.damage;
    return;
  }

  const cat=bullet.category||"laser", wSize=bullet.weaponSize||1, rawDmg=bullet.damage||0, pen=bullet.penetration||0;
  const armorMult=armorDamageMultiplier(wSize,target.armorType||"light");
  const dirMult=getDirectionalArmorMult(bullet,target);
  const stunSynergy=(cat==="ballistic"&&target.stunTimer>0)?1.5:1.0;
  const laserShieldMult=(cat==="laser"&&target.distortionWeakened)?1.5:1.0;

  let shieldDmg,hullDmg;
  if(cat==="ballistic"){shieldDmg=rawDmg*0.25;hullDmg=rawDmg*0.5*stunSynergy*dirMult;}
  else if(cat==="distortion"){shieldDmg=rawDmg*0.15;hullDmg=rawDmg*0.1;}
  else{shieldDmg=rawDmg*laserShieldMult;hullDmg=rawDmg*dirMult;}

  if (target!==player && currentShipName==="Vengeance" && player.revengeActive) {
    shieldDmg*=2; hullDmg*=2;
  }

  const faceWasDown = isFaceDown(target, bullet);
  applyShieldFaceHit(target, bullet, shieldDmg);
  const faceIsDownNow = isFaceDown(target, bullet);

  const hullExposed = faceWasDown || faceIsDownNow || cat==="ballistic" || cat==="distortion";
  if(hullExposed){
    target.armor=Math.max(0,target.armor-pen*armorMult);
    const hullFactor=1-(target.armor/(target.maxArmor||100));
    target.hp-=hullDmg*hullFactor;
  }

  if(cat==="distortion"){
    const hitFaceDown = isFaceDown(target, bullet);
    if(hitFaceDown && !target.stunTimer){
      target.stunTimer=getStunDuration(wSize);
      target.distortionWeakened=false;
    } else if(!hitFaceDown){
      target.distortionWeakened=true;
    }
  }
}

function predictPos(tx,ty,tvx,tvy,sx,sy,spd) {
  if(spd<=0)return{x:tx,y:ty};
  let px=tx,py=ty;
  for(let i=0;i<4;i++){const dist=Math.hypot(px-sx,py-sy);if(dist<1)break;const t=dist/spd;px=tx+tvx*t;py=ty+tvy*t;}
  return{x:px,y:py};
}

function rayHitsRect(ox,oy,cos,sin,obj) {
  const ex=obj.x+obj.w/2,ey=obj.y+obj.h/2,dx=ex-ox,dy=ey-oy,t=dx*cos+dy*sin;
  if(t<0)return false;
  return(ex-(ox+cos*t))**2+(ey-(oy+sin*t))**2<=(Math.max(obj.w,obj.h)*0.5)**2;
}

function rayEndpoint(ox,oy,cos,sin) {
  let tMax=99999;
  if(cos>0)tMax=Math.min(tMax,(GAME_W-ox)/cos);if(cos<0)tMax=Math.min(tMax,-ox/cos);
  if(sin>0)tMax=Math.min(tMax,(GAME_H-oy)/sin);if(sin<0)tMax=Math.min(tMax,-oy/sin);
  return{x:ox+cos*tMax,y:oy+sin*tMax};
}

// ============================================================
// FIRE BULLETS
// ============================================================
const RAILGUN_CHARGE_FRAMES = 30;

function fireRailgun(origin,wStats,angle,isPlayer) {
  if(!wStats)return;
  const bx=origin.x+origin.w/2, by=origin.y+origin.h/2;
  const col=isPlayer?wStats.playerColor:wStats.enemyColor;
  const base={category:wStats.category,weaponSize:wStats.size,penetration:wStats.penetration,color:col};
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const ep=rayEndpoint(bx,by,cos,sin);
  if(isPlayer){
    enemies.forEach(e=>{
      if(!rayHitsRect(bx,by,cos,sin,e))return;
      spawnRailgunEffect(e.x+e.w/2,e.y+e.h/2,wStats.size);
      applyDamage(e,{...base,damage:wStats.damage});
      playHitSound("ballistic");
      if(e.hp<=0){
        spawnDeathEffect(e);
        playExplosion(ENEMIES[e.type]?.size||2);
        e.dead=true;
        money+=e.score;
        if(e.isShadowComet) checkShadowCometDefeat();
      }
    });
    enemies=enemies.filter(e=>!e.dead);
    playSound("shoot_railgun",{volume:0.8});
  }
  beamFlashes.push({x1:bx,y1:by,x2:ep.x,y2:ep.y,life:12,maxLife:12,color:isPlayer?"#88ddff":"#ffff88"});
}

function fireBullets(origin,wStats,angle,isPlayer) {
  if(!wStats)return[];
  const bx=origin.x+origin.w/2, by=origin.y+origin.h/2;
  const col=isPlayer?wStats.playerColor:wStats.enemyColor;
  const base={category:wStats.category,weaponSize:wStats.size,penetration:wStats.penetration,color:col};
  const ssm=isPlayer?Math.max(0.65,1-(wStats.size-1)*0.035):Math.max(0.28,1-(wStats.size-1)*0.08);
  const scaledSpeed=wStats.speed*ssm;
  const dmgScale=(!isPlayer&&wStats.category==="ballistic")?0.5:1.0;
  const inaccuracy=isPlayer?0:getEnemyInaccuracySpread();
  if(wStats.hitscan){
    if(!isPlayer){
      const cos=Math.cos(angle),sin=Math.sin(angle);
      const ep=rayEndpoint(bx,by,cos,sin);
      beamFlashes.push({x1:bx,y1:by,x2:ep.x,y2:ep.y,life:12,maxLife:12,color:"#ffff88"});
    }
    return[];
  }
  if(isPlayer)playShootSound(wStats.category,true);
  if(wStats.scattergun){
    const maxRange=GAME_W*(wStats.rangeFraction||0.22);
    return Array.from({length:wStats.pellets||5},()=>{
      const a=angle+(Math.random()-0.5)*(wStats.spread+inaccuracy);
      return{...base,x:bx,y:by,vx:Math.cos(a)*scaledSpeed,vy:Math.sin(a)*scaledSpeed,w:wStats.w,h:wStats.h,damage:wStats.damage*dmgScale,maxRange,distTraveled:0,piercing:true};
    });
  }
  const a=angle+(Math.random()-0.5)*((wStats.spread||0)+inaccuracy);
  return[{...base,x:bx,y:by,vx:Math.cos(a)*scaledSpeed,vy:Math.sin(a)*scaledSpeed,w:wStats.w,h:wStats.h,damage:wStats.damage*dmgScale}];
}

function fireDoubleShot(origin,wStats,angle,isPlayer) {
  if(!wStats)return[];
  const cx=origin.x+origin.w/2,cy=origin.y+origin.h/2;
  const px=Math.cos(angle+Math.PI/2),py=Math.sin(angle+Math.PI/2);
  const results=[];
  for(const s of[-1,1])results.push(...fireBullets({x:cx+px*12*s-origin.w/2,y:cy+py*12*s-origin.h/2,w:origin.w,h:origin.h},wStats,angle,isPlayer));
  return results;
}

// ============================================================
// AIM ARROW + RAILGUN CHARGE VISUALS
// ============================================================
function drawAimArrow() {
  if(state!=="playing")return;
  const cx=player.x+player.w/2, cy=player.y+player.h/2;
  const angle=player.rotation;
  const isRailgun=player.weaponStats&&player.weaponStats.hitscan;
  const arrowStart=Math.max(player.w,player.h)*0.75;
  const arrowLen=44;
  const ax=cx+Math.cos(angle)*(arrowStart+arrowLen);
  const ay=cy+Math.sin(angle)*(arrowStart+arrowLen);
  const tailX=cx+Math.cos(angle)*arrowStart;
  const tailY=cy+Math.sin(angle)*arrowStart;
  let arrowColor="#ffffff", arrowAlpha=0.5;
  if(isRailgun){
    if(player.railgunCharging){
      const ct=player.railgunCharge/RAILGUN_CHARGE_FRAMES;
      arrowColor=`rgb(${Math.floor(100+155*ct)},${Math.floor(200-150*ct)},255)`;
      arrowAlpha=0.4+0.5*ct;
    } else arrowColor="#44aaff";
  }
  ctx.save();
  ctx.globalAlpha=arrowAlpha;
  ctx.strokeStyle=arrowColor; ctx.fillStyle=arrowColor;
  ctx.lineWidth=2; ctx.shadowColor=arrowColor; ctx.shadowBlur=6;
  ctx.beginPath(); ctx.moveTo(tailX,tailY); ctx.lineTo(ax,ay); ctx.stroke();
  ctx.save();
  ctx.translate(ax,ay); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-14,-6); ctx.lineTo(-14,6); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawRailgunCharge() {
  if(!player.railgunCharging||player.railgunCharge<=0)return;
  if(!player.weaponStats||!player.weaponStats.hitscan)return;
  const chargeT=player.railgunCharge/RAILGUN_CHARGE_FRAMES;
  const cx=player.x+player.w/2, cy=player.y+player.h/2;
  const frontDist=Math.max(player.w,player.h)*0.6;
  const bx=cx+Math.cos(player.rotation)*frontDist;
  const by=cy+Math.sin(player.rotation)*frontDist;
  const maxRadius=18+(player.weaponSize||1)*3;
  const r=maxRadius*chargeT;
  const pulse=0.8+0.2*Math.sin(Date.now()/40);
  ctx.save();
  ctx.globalAlpha=chargeT*0.4*pulse;
  const grad=ctx.createRadialGradient(bx,by,0,bx,by,r*2.5);
  grad.addColorStop(0,"rgba(100,200,255,0.8)");
  grad.addColorStop(1,"rgba(100,200,255,0)");
  ctx.fillStyle=grad;
  ctx.beginPath();ctx.arc(bx,by,r*2.5,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=chargeT*pulse;
  const coreGrad=ctx.createRadialGradient(bx,by,0,bx,by,Math.max(0.5,r));
  coreGrad.addColorStop(0,"#ffffff");
  coreGrad.addColorStop(0.3,"#aaddff");
  coreGrad.addColorStop(1,"#0066ff");
  ctx.fillStyle=coreGrad;
  ctx.shadowColor="#00aaff"; ctx.shadowBlur=20*chargeT;
  ctx.beginPath();ctx.arc(bx,by,Math.max(0.5,r),0,Math.PI*2);ctx.fill();
  if(chargeT>0.6){
    const sparkCount=Math.floor(chargeT*6);
    ctx.globalAlpha=chargeT*0.8; ctx.strokeStyle="#ffffff"; ctx.lineWidth=1.5;
    for(let i=0;i<sparkCount;i++){
      const sa=((Date.now()/80)+i*(Math.PI*2/sparkCount))%(Math.PI*2);
      const sr=r*1.2+Math.sin(Date.now()/60+i)*r*0.5;
      ctx.beginPath();
      ctx.moveTo(bx+Math.cos(sa)*r,by+Math.sin(sa)*r);
      ctx.lineTo(bx+Math.cos(sa)*sr,by+Math.sin(sa)*sr);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ============================================================
// SHIP SPECIALS + COMMAND PING
// ============================================================
function showSpecialToast(msg) {
  let t=document.getElementById("specialToast");
  if(!t){
    t=document.createElement("div");t.id="specialToast";
    t.style.cssText="position:fixed;top:90px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.88);color:#ff8800;font:bold 15px monospace;padding:5px 18px;border:1px solid #ff8800;border-radius:4px;z-index:9999;pointer-events:none;transition:opacity 0.4s";
    document.body.appendChild(t);
  }
  t.textContent=msg;t.style.opacity="1";
  clearTimeout(t._t);t._t=setTimeout(()=>t.style.opacity="0",1800);
}

function spawnWaspAlly() {
  let bestShip="Sprite",bestPrice=-1;
  for(const sn of ALLY_SHIP_ORDER){
    const av=(typeof allyInventory!=="undefined"?allyInventory[sn]||0:0)
            -(playerLoadout.allies.filter(a=>a&&a.ship===sn).length);
    const pr=ALLY_SHIP_DEFS[sn]?.price||0;
    if(av>0&&pr>=bestPrice){bestPrice=pr;bestShip=sn;}
  }
  const aDef=ALLY_SHIP_DEFS[bestShip]||ALLY_SHIP_DEFS.Sprite;
  const wStats=getWeaponStats("laser_repeater",aDef.weaponSize);
  allies.push({
    type:bestShip, name:"[TEMP] "+bestShip,
    x:player.x-60,y:player.y,
    w:Math.round(aDef.w*SIZE_SCALE),h:Math.round(aDef.h*SIZE_SCALE),
    hp:aDef.hp,maxHp:aDef.hp,shields:aDef.shields,maxShields:aDef.shields,
    armor:100,maxArmor:100,armorType:aDef.armorType,
    img:getImage(aDef.image),color:"#ffdd88",
    shootTimer:10,vx:0,vy:0,rotation:0,spriteAngleOffset:Math.PI,
    weaponType:"laser_repeater",weaponSize:aDef.weaponSize,weaponStats:wStats,
    isAlly:true,dodge:0.25,speedMult:1.0,
    tempAlly:true,tempTimer:600,
  });
}

function activateSpecial() {
  if(!player||state!=="playing")return;
  const sp=typeof SHIP_SPECIALS!=="undefined"?SHIP_SPECIALS[currentShipName]:null;
  if(!sp)return;

  if (currentShipName === "Vengeance") {
    if (player.revengeActive) {
      player.revengeActive = false;
      player.specialActive = false;
      player.revengeCooldown = 300;
      showSpecialToast("⏸ Revenge Deactivated");
    } else {
      if (player.revengeCooldown > 0) return;
      player.revengeActive = true;
      player.specialActive = true;
      showSpecialToast("⚡ REVENGE MODE");
    }
    return;
  }

  if(player.specialCooldown>0||(player.specialActive&&currentShipName!=="Dominion"))return;
  if(currentShipName==="Dominion"){
    if(player.dominionOvercharged)return;
    player.dominionOvercharged=true;
    player.specialCooldown=sp.cooldown;
    showSpecialToast("⚡ OVERCHARGE READY");
    return;
  }
  player.specialActive=true;
  player.specialTimer=sp.duration;
  switch(currentShipName){
    case"Starlight":break;
    case"Comet":break;
    case"Supernova":player.specialMissilesUsed=0;break;
    case"Prometheus":{const n=Math.max(1,Math.floor(player.missiles/4));player.specialSalvoTotal=n;player.specialSalvoCount=0;player.specialSalvoTimer=0;break;}
    case"Wasp":spawnWaspAlly();break;
    case"Leviathan":allies.forEach(a=>{a.vanguardActive=true;a.vanguardRPM=true;});break;
  }
  showSpecialToast("▶ "+sp.name);
}

function updateSpecial() {
  if (currentShipName === "Vengeance") {
    if (player.revengeCooldown > 0) player.revengeCooldown--;
    if (player.revengeActive) {
      player.hp -= 5/60;
      if (player.hp <= 1) {
        player.revengeActive = false;
        player.specialActive = false;
        player.revengeCooldown = 300;
        showSpecialToast("⚠ Revenge auto-deactivated!");
      }
    }
    return;
  }

  if(player.specialCooldown>0)player.specialCooldown--;
  if(!player.specialActive)return;
  const sp=typeof SHIP_SPECIALS!=="undefined"?SHIP_SPECIALS[currentShipName]:null;
  if(!sp)return;
  player.specialTimer--;
  switch(currentShipName){
    case"Tempest":{
      const heal=player.maxHp*0.0015;
      player.hp=Math.min(player.maxHp,player.hp+heal);
      allies.forEach(a=>{if(!a.tempAlly)a.hp=Math.min(a.maxHp,a.hp+a.maxHp*0.0015);});
      break;}
    case"Prometheus":{
      player.specialSalvoTimer--;
      if(player.specialSalvoTimer<=0&&player.specialSalvoCount<player.specialSalvoTotal){
        const _rackEntry=(player.missileRack&&player.missileRack[0])||{kind:"standard",tier:player.missileType||2};
        const mt=MISSILE_TYPES[_rackEntry.tier||player.missileType||2];
        playerBullets.push({x:player.x+player.w/2,y:player.y+player.h/2,
          vx:Math.cos(player.rotation)*mt.speed,vy:Math.sin(player.rotation)*mt.speed,
          w:18,h:8,damage:mt.damage,color:mt.color,missile:true,category:"missile",weaponSize:6});
        player.specialSalvoCount++;
        player.specialSalvoTimer=Math.ceil(sp.duration/Math.max(1,player.specialSalvoTotal));
      }
      break;}
  }
  if(player.specialTimer<=0){
    if(currentShipName==="Supernova"&&player.specialMissilesUsed===0){
      const mx=SHIPS[currentShipName]?.missiles||52;
      player.missiles=Math.min(player.missiles+Math.ceil(mx*0.15),mx);
    }
    if(currentShipName==="Leviathan") allies.forEach(a=>{a.vanguardActive=false;a.vanguardRPM=false;});
    player.specialActive=false;
    player.specialCooldown=sp.cooldown;
  }
}

function activatePing() {
  if(!player||state!=="playing"||enemies.length===0)return;
  const pcx=player.x+player.w/2,pcy=player.y+player.h/2;
  let closest=null,closestD=1e9;
  enemies.forEach(e=>{const d=Math.hypot(e.x+e.w/2-pcx,e.y+e.h/2-pcy);if(d<closestD){closestD=d;closest=e;}});
  if(closest){pingTarget=closest;showSpecialToast("🎯 PING: "+closest.type);}
}

function drawSpecialHUD() {
  if (currentShipName === "Vengeance") {
    const bx=8,by=GAME_H-82,bw=166,bh=26;
    if (player.revengeActive) {
      const pulse=0.7+0.3*Math.abs(Math.sin(Date.now()/150));
      ctx.fillStyle=`rgba(200,0,50,${0.25*pulse})`;ctx.fillRect(bx,by,bw,bh);
      ctx.globalAlpha=pulse;ctx.fillStyle="#ff2244";ctx.font="bold 12px monospace";
      ctx.fillText("⚡ REVENGE — TAP TO END",bx+5,by+17);ctx.globalAlpha=1;
    } else if (player.revengeCooldown > 0) {
      const frac = 1 - player.revengeCooldown/300;
      ctx.fillStyle="rgba(50,50,50,0.4)";ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle="rgba(90,90,90,0.7)";ctx.fillRect(bx,by,bw*frac,bh);
      ctx.fillStyle="#666";ctx.font="bold 12px monospace";
      ctx.fillText(`Revenge CD ${(player.revengeCooldown/60).toFixed(1)}s`,bx+5,by+17);
    } else {
      ctx.fillStyle="rgba(200,0,50,0.22)";ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle="#ff2244";ctx.font="bold 12px monospace";
      ctx.fillText((IS_MOBILE?"TAP":"[Q] ")+"REVENGE",bx+5,by+17);
    }
    return;
  }

  const sp=typeof SHIP_SPECIALS!=="undefined"?SHIP_SPECIALS[currentShipName]:null;
  if(!sp)return;
  const bx=8,by=GAME_H-82,bw=166,bh=26;
  if(player.dominionOvercharged){
    ctx.fillStyle="rgba(255,150,0,0.28)";ctx.fillRect(bx,by,bw,bh);
    const pulse=0.7+0.3*Math.abs(Math.sin(Date.now()/200));
    ctx.globalAlpha=pulse;ctx.fillStyle="#ffaa00";ctx.font="bold 12px monospace";
    ctx.fillText("⚡ OVERCHARGE READY",bx+5,by+18);ctx.globalAlpha=1;
  } else if(player.specialActive){
    const frac=player.specialTimer/Math.max(1,sp.duration);
    ctx.fillStyle="rgba(255,100,0,0.18)";ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle="rgba(255,130,0,0.7)";ctx.fillRect(bx,by,bw*frac,bh);
    ctx.fillStyle="#ff8800";ctx.font="bold 12px monospace";ctx.fillText(sp.name,bx+5,by+17);
  } else if(player.specialCooldown>0){
    const frac=1-player.specialCooldown/Math.max(1,sp.cooldown);
    ctx.fillStyle="rgba(50,50,50,0.4)";ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle="rgba(90,90,90,0.7)";ctx.fillRect(bx,by,bw*frac,bh);
    ctx.fillStyle="#666";ctx.font="bold 12px monospace";
    ctx.fillText(`${sp.name} ${(player.specialCooldown/60).toFixed(1)}s`,bx+5,by+17);
  } else {
    ctx.fillStyle="rgba(255,100,0,0.22)";ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle="#ff8800";ctx.font="bold 12px monospace";
    ctx.fillText((IS_MOBILE?"TAP":"[Q] ")+sp.name,bx+5,by+17);
  }
  if(pingTarget&&!pingTarget.dead){
    ctx.fillStyle="rgba(255,200,0,0.15)";ctx.fillRect(bx,by+bh+2,bw,20);
    ctx.fillStyle="#ffcc00";ctx.font="12px monospace";
    ctx.fillText("🎯 "+pingTarget.type,bx+5,by+bh+16);
  }
}

// ============================================================
// UPDATE PLAYER
// ============================================================
function updatePlayer() {
  if(player.specialCooldown>0)player.specialCooldown--;

  if(state==="shadowCometCutscene") return;

  const nemMult=(player.specialActive&&currentShipName==="Nemesis")?2.0
             :(player.specialActive&&currentShipName==="Starlight")?1.5
             :(currentShipName==="Vengeance"&&player.revengeActive)?2.0:1.0;

  if(player.boosting){
    player.boostTimer--;
    if(player.boostTimer<=0){player.boosting=false;player.boostCooldown=player.boostCooldownMax;}
  } else if(player.boostCooldown>0){
    player.boostCooldown--;
  } else if(keys["ShiftLeft"]||keys["ShiftRight"]){
    player.boosting=true;player.boostTimer=player.boostDuration;
  }
  const curMaxSpd=player.boosting?player.maxSpeed*2:player.maxSpeed*nemMult;
  const curAccel=player.boosting?player.accel*2.5:player.accel*nemMult;
  const FRICTION=0.86;
  if(IS_MOBILE&&mobileJoy.active){player.vx+=mobileJoy.dx*curAccel;player.vy+=mobileJoy.dy*curAccel;}
  if(keys["ArrowUp"]  ||keys["KeyW"])player.vy-=curAccel;
  if(keys["ArrowDown"] ||keys["KeyS"])player.vy+=curAccel;
  if(keys["ArrowLeft"] ||keys["KeyA"])player.vx-=curAccel;
  if(keys["ArrowRight"]||keys["KeyD"])player.vx+=curAccel;
  player.vx*=FRICTION;player.vy*=FRICTION;
  const spd=Math.hypot(player.vx,player.vy);
  if(spd>curMaxSpd){player.vx*=curMaxSpd/spd;player.vy*=curMaxSpd/spd;}
  player.x=Math.max(0,Math.min(GAME_W-player.w,player.x+player.vx));
  player.y=Math.max(0,Math.min(GAME_H-player.h,player.y+player.vy));

  player.rotation=Math.atan2(mouse.y-player.y-player.h/2,mouse.x-player.x-player.w/2);

  const shieldRegen=SHIELD_TIERS[playerLoadout.shieldTier||1].regenRate;
  regenShieldFaces(player, shieldRegen);

  const isShooting=IS_MOBILE?mobileAim.shooting:(keys["Space"]||mouse.down);
  const isRailgun=player.weaponStats&&player.weaponStats.hitscan;
  if(isRailgun){
    if(player.dominionOvercharged&&isShooting&&player.shootTimer<=0){
      const oc={...player.weaponStats,damage:player.weaponStats.damage*3};
      fireRailgun(player,oc,player.rotation,true);
      player.dominionOvercharged=false;
      player.railgunCharge=0;player.railgunCharging=false;
      player.shootTimer=player.weaponStats.fireInterval;
    } else if(isShooting&&player.shootTimer<=0){
      player.railgunCharging=true;
      player.railgunCharge=Math.min(RAILGUN_CHARGE_FRAMES,player.railgunCharge+1);
      if(player.railgunCharge>=RAILGUN_CHARGE_FRAMES){
        fireRailgun(player,player.weaponStats,player.rotation,true);
        player.railgunCharge=0; player.railgunCharging=false;
        player.shootTimer=player.weaponStats.fireInterval;
      }
    } else {
      if(player.railgunCharging){player.railgunCharge=0;player.railgunCharging=false;}
      player.shootTimer--;
    }
  } else {
    player.shootTimer--;
    if(isShooting&&player.shootTimer<=0&&player.weaponType!=="none"&&player.weaponStats){
      if(player.specialActive&&currentShipName==="Comet"){
        let cne=null,cnd=1e9;
        enemies.forEach(e=>{const d=Math.hypot(e.x+e.w/2-player.x-player.w/2,e.y+e.h/2-player.y-player.h/2);if(d<cnd){cnd=d;cne=e;}});
        if(cne)player.rotation=Math.atan2(cne.y+cne.h/2-player.y-player.h/2,cne.x+cne.w/2-player.x-player.w/2);
      }
      let finalBullets;
      if(player.doubleShot) finalBullets=fireDoubleShot(player,player.weaponStats,player.rotation,true);
      else finalBullets=fireBullets(player,player.weaponStats,player.rotation,true);
      if(currentShipName==="Vengeance"){
        finalBullets.forEach(b=>{ b.vengeanceShot=true; });
      }
      playerBullets.push(...finalBullets);
      const rougeM=(player.specialActive&&currentShipName==="Rouge")?1/3:1.0;
      const cometM=(player.specialActive&&currentShipName==="Comet")?1/3:1.0;
      player.shootTimer=Math.round(player.weaponStats.fireInterval*rougeM*cometM);
    }
  }

  missileTimer--;
  // Rack-based missile system: missileRack = [{kind, tier}, ...], cycles through
  if(keys["KeyF"]&&missileTimer<=0){
    const rack=player.missileRack||[];
    if(rack.length>0){
      if(!player.missileRackIdx)player.missileRackIdx=0;
      // advance index until we find a live rack entry (rack never depletes mid-game, it just cycles)
      const entry=rack[player.missileRackIdx%rack.length];
      const mKind=entry.kind||"standard";
      const mTier=entry.tier||2;
      const mkDef=(typeof MISSILE_KINDS!=="undefined"&&MISSILE_KINDS[mKind])||{slots:1,aoe:0,lockOn:true,friendly:false,corrosion:false};
      const freeAmmo=player.specialActive&&currentShipName==="Supernova";
      // Missile count tracks total uses remaining (slots-weighted)
      if(player.missiles>0||freeAmmo){
        if(!freeAmmo) player.missiles=Math.max(0,player.missiles-1);
        else player.specialMissilesUsed++;
        player.missileRackIdx=(player.missileRackIdx+1)%rack.length;
        const mt=MISSILE_TYPES[mTier]||MISSILE_TYPES[2];
        const baseDmg=mt.damage*(mkDef.damageMult||1.0);
        let lockTarget=null;
        if(mkDef.lockOn&&enemies.length>0){
          const pcx=player.x+player.w/2,pcy=player.y+player.h/2;
          const cos=Math.cos(player.rotation),sin=Math.sin(player.rotation);
          let bestScore=1e9;
          enemies.forEach(e=>{
            const ex=e.x+e.w/2,ey=e.y+e.h/2;
            const t=(ex-pcx)*cos+(ey-pcy)*sin;
            if(t<0)return;
            const perp=Math.abs((ey-pcy)*cos-(ex-pcx)*sin);
            if(perp<bestScore){bestScore=perp;lockTarget=e;}
          });
        }
        const aim=lockTarget?Math.atan2(lockTarget.y+lockTarget.h/2-player.y-player.h/2,lockTarget.x+lockTarget.w/2-player.x-player.w/2):player.rotation;
        if(mKind==="cluster"){
          for(let ci=0;ci<4;ci++){
            const a=aim+(ci-1.5)*0.18;
            playerBullets.push({x:player.x+player.w/2,y:player.y+player.h/2,
              vx:Math.cos(a)*mt.speed*1.2,vy:Math.sin(a)*mt.speed*1.2,
              w:10,h:5,damage:baseDmg*0.3,color:"#ffaa00",
              missile:true,category:"missile",weaponSize:4,lockTarget:lockTarget||null});
          }
        } else {
          const aoe=mkDef.aoe||0;
          const mColor=mKind==="emp"?"#44ffcc":mKind==="nuke"?"#ff2200":mKind==="micro"?"#ffcc44":mt.color;
          playerBullets.push({x:player.x+player.w/2,y:player.y+player.h/2,
            vx:Math.cos(aim)*mt.speed,vy:Math.sin(aim)*mt.speed,
            w:mKind==="nuke"?28:mKind==="micro"?10:18,
            h:mKind==="nuke"?16:mKind==="micro"?5:8,
            damage:baseDmg,
            color:mColor,missile:true,category:"missile",weaponSize:mKind==="nuke"?8:6,
            missileKind:mKind,aoeRadius:aoe,corrosion:mkDef.corrosion,
            friendlyFire:mkDef.friendly,lockTarget:lockTarget||null});
        }
        missileTimer=mKind==="micro"?20:mKind==="nuke"?70:40;
      }
    }
  }

  if (!pdcDisabledThisWave) {
    player.turrets&&player.turrets.forEach(t=>{
      t.shootTimer--;
      if(t.shootTimer<=0&&t.weaponStats){
        const tbx=player.x+player.w/2,tby=player.y+player.h/2+t.ry;
        let target=null,bestD=Infinity;
        enemies.forEach(e=>{const d=Math.hypot(e.x+e.w/2-tbx,e.y+e.h/2-tby);if(d<bestD){bestD=d;target=e;}});
        if(target){
          const pred=predictPos(target.x+target.w/2,target.y+target.h/2,target.vx||0,target.vy||0,tbx,tby,t.weaponStats.speed||8);
          const pdcAngle=Math.atan2(pred.y-tby,pred.x-tbx);
          const pdcOrigin={x:tbx-player.w/2,y:tby-player.h/2,w:player.w,h:player.h};
          if(t.weaponStats.hitscan){fireRailgun(pdcOrigin,t.weaponStats,pdcAngle,true);}
          else{playerBullets.push(...fireBullets(pdcOrigin,t.weaponStats,pdcAngle,true));}
        }
        const bulwM=(player.specialActive&&currentShipName==="Bulwark")?0.5:1.0;
        t.shootTimer=Math.round(t.fireRate*bulwM);
      }
    });
  }
}

// ============================================================
// UPDATE ALLIES
// ============================================================
function updateAllies() {
  if(pingTarget&&pingTarget.dead) pingTarget=null;
  const shieldDown=player.shields<=0;
  const cos=Math.cos(player.rotation),sin=Math.sin(player.rotation);
  const pcx=player.x+player.w/2, pcy=player.y+player.h/2;
  allies.forEach((a,i)=>{
    if(a.tempAlly){a.tempTimer=(a.tempTimer||0)-1;if(a.tempTimer<=0){a.hp=-1;return;}}
    a.vx=a.vx||0;a.vy=a.vy||0;
    let fx,fy;
    if(a.isHealer){
      const dist=60+i*40,perp=(i-(allies.length-1)/2)*50;
      const fx2=pcx-cos*dist-sin*perp-a.w/2;
      const fy2=pcy-sin*dist+cos*perp-a.h/2;
      const dx2=fx2-a.x,dy2=fy2-a.y,dist2=Math.hypot(dx2,dy2)||1;
      const spd2=Math.min(22,dist2*0.4);
      a.vx+=(dx2/dist2)*2;a.vy+=(dy2/dist2)*2;
      const as=Math.hypot(a.vx,a.vy);if(as>spd2){a.vx*=spd2/as;a.vy*=spd2/as;}
      a.vx*=0.84;a.vy*=0.84;a.x+=a.vx;a.y+=a.vy;
      a.rotation=player.rotation;
      regenShieldFaces(a, 0.04);
      // Healer actively heals player and other allies
      const healAmt=0.12;
      player.hp=Math.min(player.maxHp, player.hp+healAmt);
      regenShieldFaces(player, 0.08);
      allies.forEach(other=>{
        if(other===a)return;
        other.hp=Math.min(other.maxHp, other.hp+healAmt);
        regenShieldFaces(other, 0.06);
      });
      a.shootTimer=999;
      return;
    }
    if(pingTarget&&!pingTarget.dead){
      const ptcx=pingTarget.x+pingTarget.w/2,ptcy=pingTarget.y+pingTarget.h/2;
      const n=Math.max(1,allies.length);
      const angle=(Math.PI*2*i/n);
      fx=ptcx+Math.cos(angle)*(65+n*12)-a.w/2;
      fy=ptcy+Math.sin(angle)*(65+n*12)-a.h/2;
    } else if(shieldDown){
      const dist=70+i*45,perp=(i-(allies.length-1)/2)*60;
      fx=pcx+cos*dist-sin*perp-a.w/2;
      fy=pcy+sin*dist+cos*perp-a.h/2;
    } else if(allyFormation==="front"){
      const dist=80+i*50,perp=(i-(allies.length-1)/2)*65;
      fx=pcx+cos*dist-sin*perp-a.w/2;
      fy=pcy+sin*dist+cos*perp-a.h/2;
    } else if(allyFormation==="surround"){
      const n=Math.max(1,allies.length);
      const angle=(Math.PI*2*i/n)+player.rotation;
      const r=52+n*12;
      fx=pcx+Math.cos(angle)*r-a.w/2;
      fy=pcy+Math.sin(angle)*r-a.h/2;
    } else {
      const dist=80+i*50,perp=(i-(allies.length-1)/2)*65;
      fx=pcx-cos*dist-sin*perp-a.w/2;
      fy=pcy-sin*dist+cos*perp-a.h/2;
    }
    const dx=fx-a.x,dy=fy-a.y,dist=Math.hypot(dx,dy)||1;
    const baseMaxSpd=22*(a.speedMult||1);
    const speedFrac=Math.max(0.05,Math.min(1.0,dist/160));
    a.vx+=(dx/dist)*2.0; a.vy+=(dy/dist)*2.0;
    const spd=Math.hypot(a.vx,a.vy);
    const targetSpd=baseMaxSpd*speedFrac;
    if(spd>targetSpd){a.vx*=targetSpd/spd;a.vy*=targetSpd/spd;}
    a.vx*=0.84; a.vy*=0.84;
    a.x+=a.vx;a.y+=a.vy;
    const regenMult=(allyFormation==="behind"&&!pingTarget)?3.0:1.0;
    regenShieldFaces(a, 0.03*regenMult);

    let closest=null,closestD=1e9;
    if(pingTarget&&!pingTarget.dead){closest=pingTarget;}
    else enemies.forEach(e=>{const d=Math.hypot(e.x+e.w/2-a.x-a.w/2,e.y+e.h/2-a.y-a.h/2);if(d<closestD){closestD=d;closest=e;}});
    a.rotation=closest?Math.atan2(closest.y+closest.h/2-a.y-a.h/2,closest.x+closest.w/2-a.x-a.w/2):player.rotation;
    a.shootTimer--;
    if(a.shootTimer<=0&&closest&&a.weaponStats){
      const acx=a.x+a.w/2,acy=a.y+a.h/2;
      const pred=predictPos(closest.x+closest.w/2,closest.y+closest.h/2,closest.vx||0,closest.vy||0,acx,acy,a.weaponStats.speed||8);
      const aimAngle=Math.atan2(pred.y-acy,pred.x-acx);
      const fmtMult=(allyFormation==="front"&&!pingTarget)?1.3:1.0;
      const vgMult=a.vanguardActive?1.5:1.0;
      if(a.weaponStats.hitscan){
        fireRailgun(a,a.weaponStats,aimAngle,true);
      } else {
        const bullets=fireBullets(a,a.weaponStats,aimAngle,true);
        bullets.forEach(b=>{b.color="#aaffaa";b.damage=(b.damage||0)*fmtMult*vgMult;});
        playerBullets.push(...bullets);
      }
      const pingMult=(pingTarget&&!pingTarget.dead)?0.9:1.0;
      a.shootTimer=(a.weaponStats.fireInterval||28)*2*pingMult;
    }
  });
}

// ============================================================
// UPDATE ENEMIES
// ============================================================
function updateEnemies() {
  const pcx=player.x+player.w/2,pcy=player.y+player.h/2;
  const smallList=enemies.filter(e=>isSmallEnemy(e.type)&&!e.dead);
  const totalSmall=smallList.length;
  enemies.forEach(e=>{
    if(e.isShadowComet){
      updateShadowCometAI(e);
      regenShieldFaces(e, 0.01);
      return;
    }
    if(e.type==="Dreadnaught"){
      e.x=GAME_W-e.w/2;e.y+=e.vy;
      if(e.y<=0){e.y=0;e.vy=Math.abs(e.vy);}
      if(e.y+e.h>=GAME_H){e.y=GAME_H-e.h;e.vy=-Math.abs(e.vy);}
      if(Math.abs(e.vy)<e.speed*0.8)e.vy=e.speed*(e.vy>=0?1:-1);
      const targetRot=Math.atan2(pcy-e.y-e.h/2,pcx-e.x-e.w/2);
      let rotDiff=targetRot-(e.rotation||0);
      while(rotDiff>Math.PI)rotDiff-=Math.PI*2;
      while(rotDiff<-Math.PI)rotDiff+=Math.PI*2;
      e.rotation=(e.rotation||0)+Math.sign(rotDiff)*Math.min(Math.abs(rotDiff),e.turnSpeed||0.015);
      regenShieldFaces(e, 0.015);
      if(e.corrosionTimer>0){e.corrosionTimer--;e.hp-=e.maxHp*0.0001;}
      e.turrets&&e.turrets.forEach(t=>{
        t.shootTimer--;
        if(t.shootTimer<=0&&t.weaponStats){
          const tx=e.x+t.rx,ty=e.y+t.ry;
          const pred=predictPos(pcx,pcy,player.vx||0,player.vy||0,tx,ty,t.weaponStats.speed||8);
          const dAngle=Math.atan2(pred.y-ty,pred.x-tx);
          let dSide=dAngle-(e.rotation||0);
          while(dSide>Math.PI)dSide-=Math.PI*2; while(dSide<-Math.PI)dSide+=Math.PI*2;
          const dSideMult=(Math.abs(Math.abs(dSide)-Math.PI/2)<Math.PI/4)?2.0:1.0;
          enemyBullets.push(...fireBullets({x:tx-1,y:ty-1,w:2,h:2},t.weaponStats,dAngle,false));
          t.shootTimer=t.fireRate*dSideMult;
        }
      });
      e.beamTimer--;
      const vkDef=ENEMIES.Dreadnaught;
      if(e.beamTimer===vkDef.beamWarningFrames){
        const baseAngle=Math.atan2(pcy-e.y-e.h/2,pcx-e.x-e.w/2);
        const count=vkDef.beamCount||1;
        const spread=vkDef.beamSpread||0;
        e.beamWarningAngles=[];
        for(let b=0;b<count;b++){
          e.beamWarningAngles.push(baseAngle+(b-(count-1)/2)*spread);
        }
      }
      if(e.beamTimer<=0){
        const ecx=e.x+e.w/2,ecy=e.y+e.h/2;
        (e.beamWarningAngles||[]).forEach(angle=>{
          const cos=Math.cos(angle),sin=Math.sin(angle);
          const ep=rayEndpoint(ecx,ecy,cos,sin);
          if(rayHitsRect(ecx,ecy,cos,sin,player))player.hp=-1;
          allies.forEach(a=>{if(rayHitsRect(ecx,ecy,cos,sin,a))a.hp=-1;});
          beamFlashes.push({x1:ecx,y1:ecy,x2:ep.x,y2:ep.y,life:45,maxLife:45,color:"#ff2200",width:14});
        });
        e.beamTimer=vkDef.beamCooldownFrames;e.beamWarningAngles=null;
      }
      return;
    }
    if(e.stunTimer>0){e.stunTimer--;}
    else{
      const ecx=e.x+e.w/2,ecy=e.y+e.h/2;
      const dx=pcx-ecx,dy=pcy-ecy,dist=Math.hypot(dx,dy)||1;
      const ndx=dx/dist,ndy=dy/dist;
      const accel=getEnemyAccel(e),friction=0.92;
      if(isSmallEnemy(e.type)){
        e.archetypeTimer=(e.archetypeTimer||0)-1;
        if(e.archetype==="adaptive"&&e.archetypeTimer<=0){
          e.archetypeMode=e.archetypeMode==="bruiser"?"skirmisher":"bruiser";
          e.archetypeTimer=120+Math.floor(Math.random()*180);
        }
        const mode=e.archetypeMode||e.archetype||"skirmisher";
        const orbitR = mode==="skirmisher"||mode==="suppressor"
          ? (mode==="suppressor"?600:360)
          : mode==="bruiser"||mode==="interceptor" ? 120 : 260;
        let tx=pcx,ty=pcy;
        if(mode==="interceptor"&&allies.length>0){
          let closestA=allies[0],cad=1e9;
          allies.forEach(a=>{const d=Math.hypot(a.x+a.w/2-ecx,a.y+a.h/2-ecy);if(d<cad){cad=d;closestA=a;}});
          tx=closestA.x+closestA.w/2; ty=closestA.y+closestA.h/2;
        }
        const myIdx=smallList.indexOf(e);
        e.surroundAngle+=mode==="flanker"?0.03:0.018;
        if(mode==="flanker"){
          if(e.archetypeTimer<=0){e.flankerPhase=e.flankerPhase==="flank"?"normal":"flank";e.archetypeTimer=90+Math.floor(Math.random()*120);}
          if(e.flankerPhase==="flank"){
            const sideAngle=Math.atan2(ty-ecy,tx-ecx)+(Math.random()>0.5?Math.PI/2:-Math.PI/2);
            const sideX=ecx+Math.cos(sideAngle)*180-e.w/2;
            const sideY=ecy+Math.sin(sideAngle)*180-e.h/2;
            const sd=Math.hypot(sideX-e.x,sideY-e.y)||1;
            e.vx+=(sideX-e.x)/sd*accel*3;e.vy+=(sideY-e.y)/sd*accel*3;
          }
        }
        if(mode==="packhunter"){
          // ── Pack Hunter: 3-ship column toward player ──────────────────────
          // Init: first time this enemy runs, grab 2 nearest unassigned small
          // enemies, override their archetypes, and register in global _packs.
          if(!window._packs) window._packs={};
          if(!e.packGroupId){
            const gid="pk_"+Date.now()+"_"+Math.random().toString(36).slice(2,6);
            const candidates=smallList.filter(o=>o!==e&&!o.packGroupId);
            candidates.sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y));
            const members=[e,...candidates.slice(0,2)];
            members.forEach((m,i)=>{
              m.archetype="packhunter";
              m.packGroupId=gid;
              m.packOrder=i; // 0=front(faces player), 1=mid, 2=back
            });
            window._packs[gid]={members,rotateCD:0};
          }
          const pd=window._packs[e.packGroupId];
          if(pd){
            // Remove dead members from pack list
            pd.members=pd.members.filter(m=>!m.dead);
            if(pd.members.length===0){delete window._packs[e.packGroupId];}
            else{
              // Cooldown tick (only once per group — the member with lowest packOrder does it)
              const isGroupTick=pd.members.every(m=>m===e||m.packOrder>e.packOrder);
              if(isGroupTick){
                if(pd.rotateCD>0) pd.rotateCD--;
                // Rotation: when front (order=0) shields drop below 25%, rotate orders
                const front=pd.members.find(m=>m.packOrder===0);
                if(front&&front.shields<front.maxShields*0.25&&pd.rotateCD<=0&&pd.members.length>1){
                  // Shift orders: 0→last, everyone else moves up
                  pd.members.sort((a,b)=>a.packOrder-b.packOrder);
                  pd.members.push(pd.members.shift()); // move order-0 to end
                  pd.members.forEach((m,i)=>m.packOrder=i);
                  pd.rotateCD=240; // 4s before next rotation
                }
              }
              // Formation: all ships form a column pointing from player outward
              // Front (order 0) = 210px from player center
              // Each subsequent ship = +130px behind the previous
              const lineAngle=Math.atan2(ecy-pcy,ecx-pcx); // angle FROM player TO pack
              const FRONT_DIST=210, SPACING=130;
              const myDist=FRONT_DIST+e.packOrder*SPACING;
              const formX=pcx+Math.cos(lineAngle)*myDist-e.w/2;
              const formY=pcy+Math.sin(lineAngle)*myDist-e.h/2;
              const fdx=formX-e.x,fdy=formY-e.y,fd=Math.hypot(fdx,fdy)||1;
              // Strong pull to formation position
              e.vx+=(fdx/fd)*accel*4.5;
              e.vy+=(fdy/fd)*accel*4.5;
              // All members face the player (rotate toward pcx,pcy)
              e.rotation=Math.atan2(pcy-(e.y+e.h/2),pcx-(e.x+e.w/2));
            }
          }
        } else {
          const orbitAngle=e.surroundAngle+(Math.PI*2*myIdx/Math.max(totalSmall,1));
          const targetX=tx+Math.cos(orbitAngle)*orbitR-e.w/2;
          const targetY=ty+Math.sin(orbitAngle)*orbitR-e.h/2;
          const tdx=targetX-e.x,tdy=targetY-e.y,tDist=Math.hypot(tdx,tdy)||1;
          e.vx+=(tdx/tDist)*accel*2.2;e.vy+=(tdy/tDist)*accel*2.2;
        }
        if(dist<80){e.vx-=ndx*accel*5;e.vy-=ndy*accel*5;}
        smallList.forEach(other=>{
          if(other===e)return;
          const odx=e.x-other.x,ody=e.y-other.y,od=Math.hypot(odx,ody)||1;
          if(od<85){e.vx+=(odx/od)*accel*1.5;e.vy+=(ody/od)*accel*1.5;}
        });
      } else {
        const TARGET_RANGE=430,FLEE_RANGE=260;
        const strafeSign=(enemies.indexOf(e)%2===0)?1:-1;
        if(dist<FLEE_RANGE){e.vx-=ndx*accel*4;e.vy-=ndy*accel*4;}
        else if(dist>TARGET_RANGE+100){e.vx+=ndx*accel*1.5;e.vy+=ndy*accel*1.5;}
        else{
          e.vx+=(-ndy*strafeSign)*accel*1.8;e.vy+=(ndx*strafeSign)*accel*1.8;
          const re=dist-TARGET_RANGE;
          e.vx+=ndx*(re/TARGET_RANGE)*accel*0.8;e.vy+=ndy*(re/TARGET_RANGE)*accel*0.8;
        }
        enemies.forEach(other=>{
          if(other===e||isSmallEnemy(other.type)||other.type==="Dreadnaught")return;
          const odx=e.x-other.x,ody=e.y-other.y,od=Math.hypot(odx,ody)||1;
          if(od<200){e.vx+=(odx/od)*accel;e.vy+=(ody/od)*accel;}
        });
      }
      e.vx*=friction;e.vy*=friction;
      const spd=Math.hypot(e.vx,e.vy);
      if(spd>e.speed){e.vx*=e.speed/spd;e.vy*=e.speed/spd;}
      if(!isSmallEnemy(e.type)){
        const dToPlayer=Math.hypot(pcx-e.x-e.w/2,pcy-e.y-e.h/2);
        if(Math.abs(dToPlayer-430)<60){e.vx*=0.88;e.vy*=0.88;}
      }
      e.x+=e.vx;e.y+=e.vy;
      const m=25;
      if(e.x<m)e.vx+=accel*1.5;if(e.x>GAME_W-e.w-m)e.vx-=accel*1.5;
      if(e.y<m)e.vy+=accel*1.5;if(e.y>GAME_H-e.h-m)e.vy-=accel*1.5;
      e.x=Math.max(0,Math.min(GAME_W-e.w,e.x));e.y=Math.max(0,Math.min(GAME_H-e.h,e.y));
    }
    regenShieldFaces(e, 0.015);
    // Enemy healer aura — heals nearby enemies
    if(e.type==="Healer"&&!e.stunTimer){
      const ehr=ENEMIES.Healer.healRadius||280;
      const ehp=ENEMIES.Healer.healPerFrame||8;
      enemies.forEach(other=>{
        if(other===e||other.dead)return;
        const hd=Math.hypot(other.x+other.w/2-e.x-e.w/2,other.y+other.h/2-e.y-e.h/2);
        if(hd<ehr){
          other.hp=Math.min(other.maxHp,other.hp+ehp*0.016);
          regenShieldFaces(other,0.04);
        }
      });
    }
    // Gradual turn toward player
    const targetRot=Math.atan2(pcy-e.y-e.h/2,pcx-e.x-e.w/2);
    let rotDiff=targetRot-(e.rotation||0);
    while(rotDiff>Math.PI)rotDiff-=Math.PI*2;
    while(rotDiff<-Math.PI)rotDiff+=Math.PI*2;
    e.rotation=(e.rotation||0)+Math.sign(rotDiff)*Math.min(Math.abs(rotDiff),e.turnSpeed||0.04);
    const frMult=e.stunTimer>0?2:1;
    e.turrets&&e.turrets.forEach(t=>{
      t.shootTimer--;
      if(t.shootTimer<=0&&t.weaponStats){
        const tx=e.x+t.rx,ty=e.y+t.ry;
        const pred=predictPos(pcx,pcy,player.vx||0,player.vy||0,tx,ty,t.weaponStats.speed||8);
        const aimAngle=Math.atan2(pred.y-ty,pred.x-tx);
        // Half RPM if target is roughly to the side of the turret
        const shipAngle=e.rotation||0;
        let sideAngle=aimAngle-shipAngle;
        while(sideAngle>Math.PI)sideAngle-=Math.PI*2;
        while(sideAngle<-Math.PI)sideAngle+=Math.PI*2;
        const isSideShot=Math.abs(Math.abs(sideAngle)-Math.PI/2)<Math.PI/4;
        const sideMult=isSideShot?2.0:1.0; // double the timer = half RPM
        if(t.weaponStats.hitscan){
          const cos=Math.cos(aimAngle),sin=Math.sin(aimAngle);
          const ep=rayEndpoint(tx,ty,cos,sin);
          beamFlashes.push({x1:tx,y1:ty,x2:ep.x,y2:ep.y,life:12,maxLife:12,color:"#ffff88"});
          if(rayHitsRect(tx,ty,cos,sin,player)){spawnRailgunEffect(player.x+player.w/2,player.y+player.h/2,t.weaponStats.size||3);applyDamage(player,{...t.weaponStats,damage:t.weaponStats.damage,category:"ballistic"});}
          allies.forEach(a=>{if(rayHitsRect(tx,ty,cos,sin,a)){applyDamage(a,{...t.weaponStats,damage:t.weaponStats.damage,category:"ballistic"});}});
        } else {
          enemyBullets.push(...fireBullets({x:tx-1,y:ty-1,w:2,h:2},t.weaponStats,aimAngle,false));
        }
        t.shootTimer=t.fireRate*frMult*sideMult;
      }
    });
    if(e.type==="Dominion"){
      e.beamTimer--;
      if(e.beamTimer<=0){
        const ecx=e.x+e.w/2,ecy=e.y+e.h/2;
        const pred=predictPos(pcx,pcy,player.vx||0,player.vy||0,ecx,ecy,16);
        const angle=Math.atan2(pred.y-ecy,pred.x-ecx);
        enemyBullets.push({x:ecx,y:ecy,vx:Math.cos(angle)*16,vy:Math.sin(angle)*16,w:14,h:14,damage:ENEMIES.Dominion.beamDamage,color:"#00aaff",category:"laser",weaponSize:10,penetration:9999,missile:true});
        e.beamTimer=ENEMIES.Dominion.beamCooldownFrames||600;
      }
    }
  });
}

// ============================================================
// BULLETS + COLLISIONS
// ============================================================
function updateBullets() {
  [...playerBullets,...enemyBullets].forEach(b=>{
    b.x+=b.vx||0;b.y+=b.vy||0;
    if(b.maxRange!==undefined){
      b.distTraveled=(b.distTraveled||0)+Math.hypot(b.vx,b.vy);
      if(b.distTraveled>=b.maxRange)b.dead=true;
    }
  });
  beamFlashes.forEach(f=>f.life--);
  nukeRings.forEach(r=>{r.life--;r.r=r.maxR*(1-(r.life/r.maxLife));});
  nukeRings=nukeRings.filter(r=>r.life>0);
  beamFlashes=beamFlashes.filter(f=>f.life>0);
  updateHitEffects(); updateDeathEffects();
  const inBounds=b=>!b.dead&&b.x>-60&&b.x<GAME_W+60&&b.y>-60&&b.y<GAME_H+60;
  playerBullets=playerBullets.filter(inBounds);
  enemyBullets=enemyBullets.filter(inBounds);
}

function overlaps(a,b){
  const acx=a.x+a.w/2, acy=a.y+a.h/2;
  const bcx=b.x+b.w/2, bcy=b.y+b.h/2;
  const r=(Math.min(a.w,a.h)*0.45)+(Math.min(b.w,b.h)*0.45);
  return Math.hypot(acx-bcx,acy-bcy)<r;
}

function checkCollisions() {
  playerBullets.forEach(b=>{
    if(b.visualOnly||b.dead)return;
    enemies.forEach(e=>{
      if(e.dead||!overlaps(b,e))return;
      if(b.missile&&b.aoeRadius>0){
        b.dead=true;
        const bx=b.x+b.w/2,by=b.y+b.h/2;
        enemies.forEach(target=>{
          if(target.dead)return;
          const dist=Math.hypot(target.x+target.w/2-bx,target.y+target.h/2-by);
          if(dist>b.aoeRadius)return;
          const falloff=1-(dist/b.aoeRadius)*0.5;
          if(b.missileKind==="emp"){
            if(target.shieldFaces) for(const f of Object.keys(target.shieldFaces)) target.shieldFaces[f]=0;
            target.shields=0;
            target.stunTimer=Math.max(target.stunTimer||0,180);
          } else {
            applyDamage(target,{...b,damage:(b.damage||0)*falloff,aoeRadius:0});
            if(b.corrosion) target.corrosionTimer=600;
          }
          if(target.hp<=0){spawnDeathEffect(target);playExplosion(ENEMIES[target.type]?.size||2);target.dead=true;money+=target.score;}
        });
        if(b.friendlyFire){
          const playerDist=Math.hypot(player.x+player.w/2-bx,player.y+player.h/2-by);
          if(playerDist<b.aoeRadius) applyDamage(player,{...b,damage:(b.damage||0)*(1-playerDist/b.aoeRadius)*0.5,aoeRadius:0});
          allies.forEach(a=>{
            const d=Math.hypot(a.x+a.w/2-bx,a.y+a.h/2-by);
            if(d<b.aoeRadius) applyDamage(a,{...b,damage:(b.damage||0)*(1-d/b.aoeRadius)*0.5,aoeRadius:0});
          });
        }
        // Visual explosion ring for nukes
        if(b.missileKind==="nuke"){
          nukeRings.push({x:bx,y:by,r:0,maxR:b.aoeRadius,life:40,maxLife:40,color:"#ff4400"});
          nukeRings.push({x:bx,y:by,r:0,maxR:b.aoeRadius*0.7,life:30,maxLife:30,color:"#ff8800"});
          nukeRings.push({x:bx,y:by,r:0,maxR:b.aoeRadius*0.4,life:20,maxLife:20,color:"#ffff00"});
          spawnDeathEffect({x:bx-60,y:by-60,w:120,h:120,type:"Bulwark"});
        } else {
          spawnDeathEffect({x:bx-30,y:by-30,w:60,h:60,type:"Raptor"});
        }
        return;
      }
      if(b.piercing){
        if(!b.hitSet)b.hitSet=new Set();
        if(b.hitSet.has(e))return;
        b.hitSet.add(e);
        if(!b.lastEffectFrame||b.lastEffectFrame<frameCount){
          spawnHitEffect(b.x+b.w/2,b.y+b.h/2,b);
          playHitSound(b.category);
          b.lastEffectFrame=frameCount;
        }
      } else {
        spawnHitEffect(b.x+b.w/2,b.y+b.h/2,b);
        playHitSound(b.category);
        b.dead=true;
      }
      applyDamage(e,b);
      if(e.hp<=0){
        spawnDeathEffect(e);
        playExplosion(ENEMIES[e.type]?.size||2);
        e.dead=true;
        money+=e.score;
        if(e.isShadowComet) checkShadowCometDefeat();
      }
    });
  });
  enemyBullets.forEach(b=>{
    if(b.dead)return;
    if(overlaps(b,player)){b.dead=true;applyDamage(player,b);}
    allies.forEach(a=>{
      if(!a.dead&&overlaps(b,a)){applyDamage(a,b);if(a.hp<=0){spawnDeathEffect(a);a.dead=true;}}
    });
  });
  if(player.pdcCount>0&&!pdcDisabledThisWave){
    enemyBullets.forEach(b=>{
      if(!b.dead&&Math.abs(b.x-player.x)<180&&Math.random()<player.pdcCount*0.03)b.dead=true;
    });
  }
  playerBullets=playerBullets.filter(b=>!b.dead);
  enemyBullets=enemyBullets.filter(b=>!b.dead);
  enemies=enemies.filter(e=>!e.dead);
  if(pingTarget&&pingTarget.dead) pingTarget=null;
  allies=allies.filter(a=>!a.dead);
}

// ============================================================
// DRAW
// ============================================================
function drawEntity(obj) {
  const hasImg=obj.img&&obj.img.complete&&obj.img.naturalWidth>0;
  const cx=obj.x+obj.w/2,cy=obj.y+obj.h/2;
  ctx.save();ctx.translate(cx,cy);ctx.rotate((obj.rotation||0)+(obj.spriteAngleOffset||0));
  if(hasImg)ctx.drawImage(obj.img,-obj.w/2,-obj.h/2,obj.w,obj.h);
  else{ctx.fillStyle=obj.color||"#fff";ctx.fillRect(-obj.w/2,-obj.h/2,obj.w,obj.h);}

  const isPlayer=obj===player, isAlly=obj.isAlly;
  const isShadow=obj.isShadowComet;
  const frameColor=isPlayer?"#4488ff":isAlly?"#44ff88":isShadow?"#ff2200":"#ff4444";
  const hw=obj.w/2, hh=obj.h/2, cs=Math.min(hw,hh)*0.35, lw=2.5;
  ctx.strokeStyle=frameColor; ctx.lineWidth=lw;
  ctx.shadowColor=frameColor; ctx.shadowBlur=6;
  ctx.beginPath();ctx.moveTo(-hw,-hh+cs);ctx.lineTo(-hw,-hh);ctx.lineTo(-hw+cs,-hh);ctx.stroke();
  ctx.beginPath();ctx.moveTo(hw-cs,-hh);ctx.lineTo(hw,-hh);ctx.lineTo(hw,-hh+cs);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-hw,hh-cs);ctx.lineTo(-hw,hh);ctx.lineTo(-hw+cs,hh);ctx.stroke();
  ctx.beginPath();ctx.moveTo(hw-cs,hh);ctx.lineTo(hw,hh);ctx.lineTo(hw,hh-cs);ctx.stroke();
  ctx.restore();

  if(obj.stunTimer>0){ctx.fillStyle="rgba(160,80,255,0.25)";ctx.fillRect(obj.x,obj.y,obj.w,obj.h);}

  if(obj===player&&currentShipName==="Vengeance"&&player.revengeActive){
    ctx.save();
    ctx.globalAlpha=0.18+0.10*Math.abs(Math.sin(Date.now()/120));
    ctx.fillStyle="#ff0044";ctx.shadowColor="#ff0044";ctx.shadowBlur=30;
    ctx.fillRect(obj.x-4,obj.y-4,obj.w+8,obj.h+8);
    ctx.restore();
  }

  const bx=obj.x,bw=obj.w;

  // Shield faces as arcs for eligible ships, simple bar for small ships
  if(obj.shieldFaces){
    drawShieldFaces(obj);
  } else if(obj.maxShields>0){
    ctx.fillStyle="#222";ctx.fillRect(bx,obj.y-17,bw,4);
    ctx.fillStyle="#0af";ctx.fillRect(bx,obj.y-17,bw*Math.max(0,obj.shields/obj.maxShields),4);
  }

  if(obj.maxArmor>0){ctx.fillStyle="#333";ctx.fillRect(bx,obj.y-12,bw,4);ctx.fillStyle="#ccc";ctx.fillRect(bx,obj.y-12,bw*Math.max(0,obj.armor/obj.maxArmor),4);}
  ctx.fillStyle="#222";ctx.fillRect(bx,obj.y-7,bw,4);
  ctx.fillStyle=obj.isHealer?"#44ffee":obj.corrosionTimer>0?"#ff8800":"#0f0";
  ctx.fillRect(bx,obj.y-7,bw*Math.max(0,obj.hp/obj.maxHp),4);

  if(obj.archetype&&typeof ARCHETYPE_LABEL!=="undefined"){
    const lbl=ARCHETYPE_LABEL[obj.archetype]||"";
    const col=(typeof ARCHETYPE_COLOR!=="undefined"&&ARCHETYPE_COLOR[obj.archetype])||"#fff";
    ctx.save();ctx.font="bold 8px monospace";ctx.fillStyle=col;
    ctx.fillText(lbl,bx+2,obj.y-19);ctx.restore();
  }
}

function drawBullets() {
  [...playerBullets,...enemyBullets].forEach(b=>{
    if(b.vengeanceShot){
      ctx.save();
      ctx.globalAlpha=0.85;
      ctx.shadowColor="#ff0000";ctx.shadowBlur=14;
      ctx.strokeStyle="#ff0000";ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(b.x+b.w/2,b.y+b.h/2,Math.max(2,b.w*0.3),0,Math.PI*2);ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.fillStyle=b.color||"#fff";ctx.fillRect(b.x,b.y,b.w,b.h);
    if(b.missile){ctx.fillStyle="#ff4400";ctx.fillRect(b.x-6,b.y+1,6,b.h-2);}
  });
}

function drawNukeRings() {
  nukeRings.forEach(r=>{
    const alpha=r.life/r.maxLife;
    ctx.save();
    ctx.globalAlpha=alpha*0.85;
    ctx.strokeStyle=r.color;
    ctx.lineWidth=Math.max(2, 8*alpha);
    ctx.shadowColor=r.color;
    ctx.shadowBlur=20*alpha;
    ctx.beginPath();
    ctx.arc(r.x,r.y,Math.max(1,r.r),0,Math.PI*2);
    ctx.stroke();
    // Inner fill flash at start
    if(alpha>0.6){
      ctx.globalAlpha=(alpha-0.6)*2*0.3;
      ctx.fillStyle=r.color;
      ctx.beginPath();
      ctx.arc(r.x,r.y,Math.max(1,r.r*0.5),0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  });
}
function drawBeamFlashes() {
  beamFlashes.forEach(f=>{
    const alpha=f.life/f.maxLife;
    ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=f.color||"#88ddff";
    ctx.lineWidth=(f.width||4)*(0.5+alpha*0.5);ctx.shadowColor=f.color||"#88ddff";ctx.shadowBlur=24*alpha;
    ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.restore();
  });
}

function drawBeamWarnings() {
  enemies.forEach(e=>{
    if(e.type!=="Dreadnaught"||!e.beamWarningAngles)return;
    const ecx=e.x+e.w/2,ecy=e.y+e.h/2;
    const secs=Math.ceil(e.beamTimer/60);
    const pulse=0.35+0.55*Math.abs(Math.sin(Date.now()/120));
    e.beamWarningAngles.forEach(angle=>{
      const cos=Math.cos(angle),sin=Math.sin(angle);
      const ep=rayEndpoint(ecx,ecy,cos,sin);
      ctx.save();ctx.globalAlpha=pulse;ctx.strokeStyle="#ff2200";ctx.lineWidth=10;
      ctx.setLineDash([24,14]);ctx.shadowColor="#ff4400";ctx.shadowBlur=30;
      ctx.beginPath();ctx.moveTo(ecx,ecy);ctx.lineTo(ep.x,ep.y);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    });
    ctx.save();ctx.globalAlpha=0.9;ctx.fillStyle="#ff2200";ctx.font="bold 26px monospace";ctx.textAlign="center";
    ctx.fillText(`⚠ DREADNAUGHT BEAM — MOVE! (${secs}s)`,GAME_W/2,60);
    ctx.textAlign="left";ctx.restore();
  });
}

function drawBoostHUD() {
  const bx=GAME_W-180,by=GAME_H-48;
  if(player.boosting){
    const frac=player.boostTimer/player.boostDuration;
    ctx.fillStyle="rgba(0,180,255,0.18)";ctx.fillRect(bx,by,160,28);
    ctx.fillStyle=`rgba(0,200,255,${0.5+0.5*Math.abs(Math.sin(Date.now()/80))})`;ctx.fillRect(bx,by,160*frac,28);
    ctx.fillStyle="#00eeff";ctx.font="bold 14px monospace";ctx.fillText("BOOST",bx+6,by+19);
  } else if(player.boostCooldown>0){
    const frac=1-player.boostCooldown/player.boostCooldownMax;
    ctx.fillStyle="rgba(80,80,80,0.4)";ctx.fillRect(bx,by,160,28);
    ctx.fillStyle="rgba(120,120,120,0.7)";ctx.fillRect(bx,by,160*frac,28);
    ctx.fillStyle="#888";ctx.font="bold 14px monospace";ctx.fillText(`BOOST CD ${(player.boostCooldown/60).toFixed(1)}s`,bx+6,by+19);
  } else {
    ctx.fillStyle="rgba(0,255,120,0.25)";ctx.fillRect(bx,by,160,28);
    ctx.fillStyle="#00ff88";ctx.font="bold 14px monospace";
    ctx.fillText(IS_MOBILE?"BOOST READY":"BOOST READY [SHIFT]",bx+6,by+19);
  }
  {
    const dodgeNow=player.boosting?player.dodgeBoosted:player.dodgeBase;
    ctx.fillStyle="#ffcc00";ctx.font="12px monospace";
    ctx.fillText(`DODGE ${Math.round(dodgeNow*100)}%`,bx+6,by+44);
  }
}

function render() {
  ctx.fillStyle="#000011";ctx.fillRect(0,0,GAME_W,GAME_H);
  ctx.fillStyle="#ffffff";
  for(let i=0;i<150;i++)ctx.fillRect((i*137)%GAME_W,(i*97)%GAME_H,1,1);

  if(state==="shadowCometCutscene"){
    drawShadowCometCutscene();
    return;
  }

  if(state==="waveTransition"){
    allies.forEach(drawEntity);drawEntity(player);drawDeathEffects();
    const secs=Math.ceil(waveTransitionTimer/60);
    ctx.fillStyle="rgba(0,0,0,0.55)";ctx.fillRect(GAME_W/2-320,GAME_H/2-55,640,110);
    ctx.textAlign="center";
    ctx.fillStyle="#0af";ctx.font="bold 30px monospace";ctx.fillText(waveTransitionText,GAME_W/2,GAME_H/2-8);
    ctx.fillStyle="#fff";ctx.font="20px monospace";ctx.fillText("Next wave in "+secs+"s  —  Shields & armor restored",GAME_W/2,GAME_H/2+28);
    ctx.textAlign="left";return;
  }
  if(state!=="playing")return;
  if(player.boosting){
    ctx.save();ctx.globalAlpha=0.18;ctx.strokeStyle="#00ccff";ctx.lineWidth=1;
    for(let i=0;i<18;i++){
      const sx=(i*211+Date.now()*0.4)%GAME_W,sy=(i*97)%GAME_H;
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx-40,sy);ctx.stroke();
    }
    ctx.restore();
  }

  if(currentShipName==="Vengeance"&&player.revengeActive){
    ctx.save();ctx.globalAlpha=0.07;ctx.fillStyle="#ff0000";ctx.fillRect(0,0,GAME_W,GAME_H);ctx.restore();
  }

  if(pdcDisabledThisWave){
    ctx.save();ctx.globalAlpha=0.7;ctx.fillStyle="#ff2200";ctx.font="bold 13px monospace";
    ctx.fillText("⚠ TURRETS DISABLED",10,GAME_H-30);ctx.restore();
  }

  enemies.forEach(drawEntity);
  allies.forEach(drawEntity);
  drawEntity(player);
  drawRailgunCharge();
  drawAimArrow();
  drawBullets();
  drawNukeRings();
  drawBeamFlashes();
  drawHitEffects();
  drawDeathEffects();
  drawBeamWarnings();
  drawBoostHUD();
  drawSpecialHUD();
  ctx.fillStyle="rgba(255,255,255,0.4)";ctx.font="18px monospace";
  ctx.fillText(infiniteMode?`Wave ${currentWave} (Infinite)`:`Wave ${currentWave} / ${WAVES.length}`,10,GAME_H-12);
  if(player.hp<player.maxHp*0.25){ctx.fillStyle="rgba(255,0,0,0.12)";ctx.fillRect(0,0,GAME_W,GAME_H);}
}

// ============================================================
// HUD + LOOP
// ============================================================
function updateHUD() {
  const inGame = state==="playing"||state==="waveTransition"||state==="shadowCometCutscene";
  document.getElementById("hud").style.display = inGame ? "block" : "none";
  document.getElementById("inGameBack").style.display = inGame ? "block" : "none";
  document.getElementById("health").textContent   = Math.max(0,Math.floor(player.hp||0));
  document.getElementById("armorHUD").textContent = Math.max(0,Math.floor(player.armor||0));
  document.getElementById("shields").textContent  = Math.max(0,Math.floor(player.shields||0));
  document.getElementById("money").textContent    = money;
  document.getElementById("wave").textContent     = currentWave;
  {
    const rack=player.missileRack||[];
    const rackIdx=(player.missileRackIdx||0)%Math.max(1,rack.length);
    const nextKind=rack[rackIdx]?.kind||"—";
    const mkName=(typeof MISSILE_KINDS!=="undefined"&&MISSILE_KINDS[nextKind]?.name)||nextKind;
    document.getElementById("missiles").textContent=(player.missiles||0)+" ["+mkName+"]";
  }
}

function setPlayerMissileKind(k) {
  if(player) player.missileKind=k;
}

function cycleFormation() {
  const modes=["behind","front","surround"];
  const idx=modes.indexOf(allyFormation);
  allyFormation=modes[(idx+1)%modes.length];
  const labels={behind:"◀ BEHIND",front:"▶ FRONT",surround:"⬟ SURROUND"};
  const btn=document.getElementById("formationBtn");
  if(btn) btn.textContent=labels[allyFormation];
  let toast=document.getElementById("formationToast");
  if(!toast){
    toast=document.createElement("div");
    toast.id="formationToast";
    toast.style.cssText="position:fixed;top:50px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#0af;font:bold 16px monospace;padding:6px 18px;border:1px solid #0af;border-radius:4px;z-index:9999;pointer-events:none;transition:opacity 0.4s";
    document.body.appendChild(toast);
  }
  toast.textContent=labels[allyFormation];
  toast.style.opacity="1";
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>toast.style.opacity="0",1500);
}

function checkMeteorUnlock() {}

function gameLoop() {
  frameCount++;
  if(state==="shadowCometCutscene"){
    updateShadowCometCutscene();
    updateDeathEffects();
    render();
    updateHUD();
    requestAnimationFrame(gameLoop);
    return;
  }
  if(state==="playing"){
    updatePlayer();updateAllies();updateEnemies();updateBullets();checkCollisions();updateSpecial();
    if(waveReinforceTimer>0){waveReinforceTimer--;if(waveReinforceTimer<=0&&!waveReinforceDone){
      waveReinforceDone=true;
      const wd=infiniteMode?generateInfiniteWave(currentWave):WAVES[currentWave-1];
      if(wd&&wd.reinforceEnemies){
        wd.reinforceEnemies.forEach(name=>{
          const d=ENEMIES[name];if(!d)return;
          const sn=d.size||2,ew=Math.round((32+sn*18)*SIZE_SCALE),eh=Math.round((20+sn*10)*SIZE_SCALE);
          const re={type:name,x:GAME_W,y:80+Math.random()*(GAME_H-160),w:ew,h:eh,
            hp:d.hp,maxHp:d.hp,shields:d.shields,maxShields:d.shields,
            armor:d.armor||200,maxArmor:d.armor||200,armorType:d.armorType||"light",
            speed:d.speed,fireRate:d.fireRate,shootTimer:Math.floor(Math.random()*d.fireRate),
            img:getImage(d.image),color:d.color,score:d.score,
            spriteAngleOffset:Math.PI,stunTimer:0,vx:0,vy:0,surroundAngle:Math.random()*Math.PI*2,
            turnSpeed:(()=>{const sz=d.size||2;return sz<=2?0.08:sz<=4?0.05:sz<=6?0.03:0.015;})()};
          re.turrets=[];if(d.turrets){const sf=1+((d.size||1)-1)*0.35;d.turrets.forEach(t=>re.turrets.push({rx:t.rx||0,ry:t.ry||0,fireRate:Math.max(6,Math.floor((t.fireRate||d.fireRate||60)*sf)),shootTimer:Math.floor(Math.random()*60),weaponStats:getWeaponStats(t.weaponType||"laser_repeater",t.weaponSize||2)}));}
          if(typeof ARCHETYPE_POOL!=="undefined"&&ARCHETYPE_POOL[name]){const p=ARCHETYPE_POOL[name];re.archetype=p[Math.floor(Math.random()*p.length)];re.archetypeTimer=0;}
          initShieldFaces(re);
          enemies.push(re);
        });
        showSpecialToast("⚠ REINFORCEMENTS!");
      }
    }}
    if(enemies.length===0&&!shadowCometActive){
      const reward=infiniteMode?generateInfiniteWave(currentWave).reward:(WAVES[currentWave-1]?.reward||0);
      money+=reward;
      player.shields=player.maxShields;player.armor=player.maxArmor;
      player.missiles=player.maxMissiles||player.missiles;
      if(player.shieldFaces) initShieldFaces(player);
      allies.forEach(a=>{
        a.shields=a.maxShields;a.armor=a.maxArmor;
        if(a.shieldFaces) initShieldFaces(a);
      });
      waveTransitionText=`Wave ${currentWave} Cleared!  +${reward} credits`;
      waveTransitionTimer=300;state="waveTransition";updateHUD();
    }
    if(player.hp<=0)endGame(false);
    updateHUD();
  }
  if(state==="waveTransition"){
    updatePlayer();updateDeathEffects();waveTransitionTimer--;
    if(waveTransitionTimer<=0)nextWave();
    updateHUD();
  }
  render();
  if(IS_MOBILE){
    const ui=document.getElementById("mobileUI");
    if(ui){
      const idle=Date.now()-lastTouchTime>4000;
      ui.style.opacity=idle?"0.3":"1.0";
      ui.style.transition="opacity 0.6s";
    }
  }
  requestAnimationFrame(gameLoop);
}

function confirmLeaveGame() {
  if(confirm("Are you sure you want to leave? All progress will be lost.")) {
    enemies=[]; playerBullets=[]; enemyBullets=[]; beamFlashes=[]; nukeRings=[]; hitEffects=[]; deathEffects=[];
  if(window._packs) window._packs={};
    shadowCometActive=false; pdcDisabledThisWave=false;
    state="menu";
    document.getElementById("mainMenu").style.display="block";
    document.getElementById("hud").style.display="none";
    document.getElementById("inGameBack").style.display="none";
    if(IS_MOBILE){const ui=document.getElementById("mobileUI");if(ui)ui.style.display="none";}
  }
}

gameLoop();
