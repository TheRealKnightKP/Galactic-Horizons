// game.js
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let GAME_W = window.innerWidth;
let GAME_H = window.innerHeight;
const SIZE_SCALE = 0.25;
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
  document.addEventListener("keydown", e => { keys[e.code] = true;  e.preventDefault(); });
  document.addEventListener("keyup",   e => { keys[e.code] = false; });
} else {
  window.addEventListener("load", buildMobileControls);
}

function buildMobileControls() {
  // Fixed to BODY at real screen edges — outside game letterbox entirely
  const ui = document.createElement("div");
  ui.id = "mobileUI";
  ui.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:999;touch-action:none;display:none";

  // ── LEFT SIDE ──────────────────────────────────────────────
  const leftPanel = document.createElement("div");
  leftPanel.style.cssText = "position:absolute;left:0;bottom:0;width:220px;height:280px;pointer-events:none";

  const boostBtn = document.createElement("div");
  boostBtn.textContent = "BOOST";
  boostBtn.style.cssText = "position:absolute;left:65px;bottom:185px;width:70px;height:70px;background:rgba(0,180,255,0.18);border:2px solid rgba(0,180,255,0.7);border-radius:50%;color:#0af;font:bold 13px monospace;display:flex;align-items:center;justify-content:center;pointer-events:all;touch-action:none;user-select:none;-webkit-user-select:none";
  boostBtn.addEventListener("touchstart", e => { e.preventDefault(); keys["ShiftLeft"] = true;  initAudio(); }, { passive: false });
  boostBtn.addEventListener("touchend",   e => { e.preventDefault(); keys["ShiftLeft"] = false; }, { passive: false });

  const leftBase = document.createElement("div");
  leftBase.style.cssText = "position:absolute;left:10px;bottom:20px;width:160px;height:160px;background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.2);border-radius:50%;pointer-events:all;touch-action:none";
  const leftKnob = document.createElement("div");
  leftKnob.style.cssText = "position:absolute;width:60px;height:60px;background:rgba(255,255,255,0.22);border:2px solid rgba(255,255,255,0.55);border-radius:50%;left:50px;top:50px";
  leftBase.appendChild(leftKnob);

  leftBase.addEventListener("touchstart", e => {
    e.preventDefault();
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

  leftPanel.appendChild(boostBtn);
  leftPanel.appendChild(leftBase);

  // ── RIGHT SIDE ─────────────────────────────────────────────
  const rightPanel = document.createElement("div");
  rightPanel.style.cssText = "position:absolute;right:0;bottom:0;width:220px;height:280px;pointer-events:none";

  const missileBtn = document.createElement("div");
  missileBtn.textContent = "MISSILE";
  missileBtn.style.cssText = "position:absolute;right:65px;bottom:185px;width:70px;height:70px;background:rgba(255,120,0,0.18);border:2px solid rgba(255,120,0,0.7);border-radius:50%;color:#f80;font:bold 12px monospace;display:flex;align-items:center;justify-content:center;pointer-events:all;touch-action:none;user-select:none;-webkit-user-select:none";
  missileBtn.addEventListener("touchstart", e => { e.preventDefault(); keys["KeyF"] = true;  }, { passive: false });
  missileBtn.addEventListener("touchend",   e => { e.preventDefault(); keys["KeyF"] = false; }, { passive: false });

  const rightBase = document.createElement("div");
  rightBase.style.cssText = "position:absolute;right:10px;bottom:20px;width:160px;height:160px;background:rgba(255,80,80,0.05);border:2px solid rgba(255,80,80,0.25);border-radius:50%;pointer-events:all;touch-action:none";
  const rightKnob = document.createElement("div");
  rightKnob.style.cssText = "position:absolute;width:60px;height:60px;background:rgba(255,80,80,0.28);border:2px solid rgba(255,120,80,0.7);border-radius:50%;left:50px;top:50px";
  rightBase.appendChild(rightKnob);

  rightBase.addEventListener("touchstart", e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const r = rightBase.getBoundingClientRect();
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

  rightPanel.appendChild(missileBtn);
  rightPanel.appendChild(rightBase);

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
  shoot_ballistic: "assets/sounds/shoot_ballistic.wav",
  shoot_railgun:   "assets/sounds/shoot_railgun.wav",
  hit_ballistic:   "assets/sounds/hit_ballistic.wav",
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
  if (category==="ballistic") playSound("shoot_ballistic", { volume:0.35, pitch:p });
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
  const cat=bullet.category||"laser", size=bullet.weaponSize||1, bw=bullet.w||4, LIFE=12;
  if (cat==="ballistic") {
    hitEffects.push({ type:"ballistic", x, y, maxR:bw>=15?size*9:size*5, life:LIFE, maxLife:LIFE });
  } else if (cat==="laser") {
    const count=3+Math.floor(size*0.8);
    for (let i=0;i<count;i++) {
      const a=Math.random()*Math.PI*2, spd=1.5+Math.random()*2.5;
      hitEffects.push({ type:"laser_pellet", x, y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd, len:4+size*1.5, life:LIFE, maxLife:LIFE });
    }
  } else if (cat==="distortion") {
    for (let i=0;i<3;i++) hitEffects.push({ type:"distortion_wave", x, y, maxR:18+size*6, delay:i*3, life:LIFE, maxLife:LIFE });
  }
}

function spawnRailgunEffect(x, y, size) {
  const LIFE=16, count=6+Math.floor(size*1.2);
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
  for (let i=0;i<3+size*2;i++) {
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
let state="menu", money=0, currentWave=0, infiniteMode=false, currentShipName="Starlight";
let player={}, allies=[], enemies=[], playerBullets=[], enemyBullets=[];
let missileTimer=0, ownedShips=[], shopOpenedFromMenu=false;
let waveTransitionTimer=0, waveTransitionText="", beamFlashes=[];

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

function buildAlly(i,totalSlots) {
  const slot=playerLoadout.allies[i]||{ship:"Sprite",weapon:"builtin",shieldTier:1};
  const sName=slot.ship||"Sprite";
  const aDef=ALLY_SHIP_DEFS[sName]||ALLY_SHIP_DEFS.Sprite;
  const shieldMult=SHIELD_TIERS[slot.shieldTier||1].mult;
  const wType=resolveWType(slot.weapon,"laser_repeater");
  const wStats=getWeaponStats(wType,aDef.weaponSize);
  return {
    type:sName, x:player.x-80-i*50, y:player.y+(i-(totalSlots-1)/2)*70,
    w:Math.round(aDef.w*SIZE_SCALE), h:Math.round(aDef.h*SIZE_SCALE), hp:aDef.hp, maxHp:aDef.hp,
    shields:Math.round(aDef.shields*shieldMult), maxShields:Math.round(aDef.shields*shieldMult),
    armor:100, maxArmor:100, armorType:aDef.armorType,
    img:getImage(aDef.image), color:aDef.color,
    shootTimer:Math.floor(Math.random()*30), vx:0, vy:0, rotation:0, spriteAngleOffset:Math.PI,
    weaponType:wType, weaponSize:aDef.weaponSize, weaponStats:wStats, isAlly:true,
  };
}

function setPlayerShip(name) {
  currentShipName=name; playerLoadout.ship=name;
  const d=SHIPS[name];
  let wType;
  if (d.bespoke||d.weaponType==="none") wType=d.weaponType;
  else wType=resolveWType(playerLoadout.mainWeapon,d.weaponType);
  const wStats=(wType&&wType!=="none")?getWeaponStats(wType,d.weaponSize):null;
  const shieldMult=SHIELD_TIERS[playerLoadout.shieldTier||1].mult;
  const baseShields=Math.round(d.shields*shieldMult);
  const armorMult=ARMOR_UPGRADE_TIERS[playerLoadout.armorTier||1].mult;
  const baseArmor=Math.round(d.armor*armorMult);
  const baseHp=Math.round(d.hp*armorMult);
  const engTier=ENGINE_UPGRADE_TIERS[playerLoadout.engineTier||1];
  const spriteOffset=(name==="Dominion")?0:Math.PI;
  const baseSpeed=d.speed*engTier.speedMult;
  const isComet=name==="Comet";
  const boostDuration=Math.round((isComet?120:60)*engTier.boostDurMult);
  const boostCooldownMax=Math.round((isComet?120:180)*engTier.boostCDMult);
  const dodgeBase=Math.min(0.90,(isComet?0.35:0.0)+engTier.dodgeBonus);
  const dodgeBoosted=Math.min(0.95,(isComet?0.75:0.25)+engTier.dodgeBonus);
  player={
    x:80, y:GAME_H/2-20, w:Math.round((40+(d.size||1)*16)*SIZE_SCALE), h:Math.round((24+(d.size||1)*8)*SIZE_SCALE),
    hp:baseHp, maxHp:baseHp, shields:baseShields, maxShields:baseShields,
    armor:baseArmor, maxArmor:baseArmor, armorType:d.armorType||"light",
    missiles:d.missiles, speed:baseSpeed, maxSpeed:baseSpeed, accel:baseSpeed*0.20,
    weaponType:wType, weaponSize:d.weaponSize, weaponStats:wStats,
    bespoke:d.bespoke, doubleShot:d.doubleShot||false, pdcCount:d.pdc, missileType:d.missileType||2,
    img:getImage(d.image), color:d.color, rotation:0, spriteAngleOffset:spriteOffset,
    vx:0, vy:0, shootTimer:0,
    boosting:false, boostTimer:0, boostCooldown:0,
    boostDuration, boostCooldownMax, dodgeBase, dodgeBoosted,
    railgunCharge:0, railgunCharging:false,
  };
  player.turrets=[];
  const pdcSizes=d.pdcSizes||null;
  for (let ti=0;ti<(d.pdc||0);ti++) {
    const tSize=pdcSizes?pdcSizes[ti]:(d.pdcSize||1);
    const pdcWk=playerLoadout.pdcWeapons&&playerLoadout.pdcWeapons[ti];
    const pdcType=resolveWType(pdcWk,"laser_repeater");
    const pdcStats=getWeaponStats(pdcType,tSize);
    const ry=(ti-(d.pdc-1)/2)*12;
    player.turrets.push({rx:0,ry,fireRate:pdcStats?pdcStats.fireInterval*2:40,shootTimer:Math.floor(Math.random()*40),weaponStats:pdcStats});
  }
  const totalSlots=2+(d.extraAllySlots||0);
  if (name==="Leviathan") {
    while(playerLoadout.allies.length<totalSlots) playerLoadout.allies.push({ship:"Rouge",weapon:"builtin",shieldTier:1,ownedShieldTiers:[1]});
    for(let i=0;i<totalSlots;i++){
      if(!playerLoadout.allies[i]) playerLoadout.allies[i]={ship:"Rouge",weapon:"builtin",shieldTier:1,ownedShieldTiers:[1]};
      else if(playerLoadout.allies[i].ship==="Sprite") playerLoadout.allies[i].ship="Rouge";
    }
    if(!playerLoadout.unlockedAllyShips.includes("Rouge")) playerLoadout.unlockedAllyShips.push("Rouge");
  }
  allies=[];
  for(let i=0;i<totalSlots;i++) allies.push(buildAlly(i,totalSlots));
}

function respawnDeadAllies() {
  const d=SHIPS[currentShipName];
  const totalSlots=2+(d.extraAllySlots||0);
  allies=allies.filter(a=>a.hp>0);
  while(allies.length<totalSlots) allies.push(buildAlly(allies.length,totalSlots));
}

function spawnWave() {
  enemies=[]; playerBullets=[]; enemyBullets=[]; beamFlashes=[]; hitEffects=[]; deathEffects=[];
  const waveData=infiniteMode?generateInfiniteWave(currentWave):WAVES[currentWave-1];
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
      stunTimer:0, vx:0, vy:name==="Dreadnaught"?d.speed:0,
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
    if(name==="Dominion") e.beamTimer=ENEMIES.Dominion.beamCooldownFrames||600;
    if(name==="Dreadnaught"){e.beamTimer=ENEMIES.Dreadnaught.beamCooldownFrames;e.beamWarningAngle=null;}
    enemies.push(e);
  });
}

function nextWave() {
  currentWave++;
  if(!infiniteMode&&currentWave>WAVES.length){endGame(true);return;}
  respawnDeadAllies(); spawnWave(); state="playing";
  document.getElementById("hud").style.display="block";
  document.getElementById("inGameBack").style.display="block";
  if(IS_MOBILE){const ui=document.getElementById("mobileUI");if(ui)ui.style.display="block";}
}

function startGame(infinite) {
  infiniteMode=infinite; currentWave=0;
  document.getElementById("mainMenu").style.display="none";
  money=1000000;
  if(!ownedShips||ownedShips.length===0) ownedShips=["Starlight"];
  setPlayerShip(playerLoadout.ship||"Starlight");
  if(IS_MOBILE){const ui=document.getElementById("mobileUI");if(ui)ui.style.display="none";}
  state="shop"; shopOpenedFromMenu=false; showShop();
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
  if(target===player){
    const dodge=player.boosting?player.dodgeBoosted:player.dodgeBase;
    if(dodge>0&&Math.random()<dodge)return;
  }
  if(target.isAlly){
    if(Math.random()<0.25)return;
    bullet={...bullet,damage:(bullet.damage||0)*0.75};
  }
  if(bullet.missile){
    if(target.shields>0){target.shields-=bullet.damage;if(target.shields<0){target.hp+=target.shields;target.shields=0;}}
    else target.hp-=bullet.damage;
    return;
  }
  const cat=bullet.category||"laser", wSize=bullet.weaponSize||1, rawDmg=bullet.damage||0, pen=bullet.penetration||0;
  const armorMult=armorDamageMultiplier(wSize,target.armorType||"light");
  let shieldDmg,hullDmg;
  if(cat==="ballistic"){shieldDmg=rawDmg*0.25;hullDmg=rawDmg*0.5;}
  else if(cat==="distortion"){shieldDmg=rawDmg*0.15;hullDmg=rawDmg*0.1;}
  else{shieldDmg=rawDmg;hullDmg=rawDmg;}
  const hadShields=target.shields>0;
  target.shields=Math.max(0,target.shields-shieldDmg);
  const shieldsNowDown=hadShields&&target.shields<=0;
  if(cat==="ballistic"||!hadShields||shieldsNowDown){
    target.armor=Math.max(0,target.armor-pen*armorMult);
    const hullFactor=1-(target.armor/(target.maxArmor||100));
    target.hp-=hullDmg*hullFactor;
  }
  if(cat==="distortion"&&target.shields<=0&&!target.stunTimer) target.stunTimer=getStunDuration(wSize);
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
      if(e.hp<=0){spawnDeathEffect(e);playExplosion(ENEMIES[e.type]?.size||2);e.dead=true;money+=e.score;}
    });
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
// UPDATE PLAYER
// ============================================================
function updatePlayer() {
  if(player.boosting){
    player.boostTimer--;
    if(player.boostTimer<=0){player.boosting=false;player.boostCooldown=player.boostCooldownMax;}
  } else if(player.boostCooldown>0){
    player.boostCooldown--;
  } else if(keys["ShiftLeft"]||keys["ShiftRight"]){
    player.boosting=true;player.boostTimer=player.boostDuration;
  }
  const curMaxSpd=player.boosting?player.maxSpeed*2:player.maxSpeed;
  const curAccel=player.boosting?player.accel*2.5:player.accel;
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
  if(player.shields<player.maxShields)player.shields+=shieldRegen;
  const isShooting=IS_MOBILE?mobileAim.shooting:(keys["Space"]||mouse.down);
  const isRailgun=player.weaponStats&&player.weaponStats.hitscan;
  if(isRailgun){
    if(isShooting&&player.shootTimer<=0){
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
      if(player.doubleShot)playerBullets.push(...fireDoubleShot(player,player.weaponStats,player.rotation,true));
      else playerBullets.push(...fireBullets(player,player.weaponStats,player.rotation,true));
      player.shootTimer=player.weaponStats.fireInterval;
    }
  }
  missileTimer--;
  if(keys["KeyF"]&&missileTimer<=0&&player.missiles>0){
    player.missiles--;
    const mt=MISSILE_TYPES[player.missileType||2];
    playerBullets.push({x:player.x+player.w/2,y:player.y+player.h/2,vx:Math.cos(player.rotation)*mt.speed,vy:Math.sin(player.rotation)*mt.speed,w:18,h:8,damage:mt.damage,color:mt.color,missile:true,category:"missile",weaponSize:6});
    missileTimer=45;
  }
  player.turrets&&player.turrets.forEach(t=>{
    t.shootTimer--;
    if(t.shootTimer<=0&&t.weaponStats){
      const tbx=player.x+player.w/2,tby=player.y+player.h/2+t.ry;
      let target=null,bestD=Infinity;
      enemies.forEach(e=>{const d=Math.hypot(e.x+e.w/2-tbx,e.y+e.h/2-tby);if(d<bestD){bestD=d;target=e;}});
      if(target){
        const pred=predictPos(target.x+target.w/2,target.y+target.h/2,target.vx||0,target.vy||0,tbx,tby,t.weaponStats.speed);
        playerBullets.push(...fireBullets({x:tbx-player.w/2,y:tby-player.h/2,w:player.w,h:player.h},t.weaponStats,Math.atan2(pred.y-tby,pred.x-tbx),true));
      }
      t.shootTimer=t.fireRate;
    }
  });
}

// ============================================================
// UPDATE ALLIES
// ============================================================
function updateAllies() {
  const shieldDown=player.shields<=0;
  const cos=Math.cos(player.rotation),sin=Math.sin(player.rotation);
  allies.forEach((a,i)=>{
    a.vx=a.vx||0;a.vy=a.vy||0;
    let fx,fy;
    if(shieldDown){
      const dist=70+i*45,perp=(i-(allies.length-1)/2)*60;
      fx=player.x+player.w/2+cos*dist-sin*perp-a.w/2;
      fy=player.y+player.h/2+sin*dist+cos*perp-a.h/2;
    } else {fx=player.x-80-i*50;fy=player.y+(i-(allies.length-1)/2)*65;}
    const springK=shieldDown?0.06:0.0024,maxSpd=shieldDown?14:4;
    a.vx+=(fx-a.x)*springK;a.vy+=(fy-a.y)*springK;
    const spd=Math.hypot(a.vx,a.vy);
    if(spd>maxSpd){a.vx*=maxSpd/spd;a.vy*=maxSpd/spd;}
    a.x+=a.vx;a.y+=a.vy;
    if(a.shields<a.maxShields)a.shields+=0.03;
    let closest=null,closestD=1e9;
    enemies.forEach(e=>{const d=Math.hypot(e.x+e.w/2-a.x-a.w/2,e.y+e.h/2-a.y-a.h/2);if(d<closestD){closestD=d;closest=e;}});
    a.rotation=closest?Math.atan2(closest.y+closest.h/2-a.y-a.h/2,closest.x+closest.w/2-a.x-a.w/2):player.rotation;
    a.shootTimer--;
    if(a.shootTimer<=0&&closest&&a.weaponStats){
      const acx=a.x+a.w/2,acy=a.y+a.h/2;
      const pred=predictPos(closest.x+closest.w/2,closest.y+closest.h/2,closest.vx||0,closest.vy||0,acx,acy,a.weaponStats.speed);
      const bullets=fireBullets(a,a.weaponStats,Math.atan2(pred.y-acy,pred.x-acx),true);
      bullets.forEach(b=>b.color="#aaffaa");
      playerBullets.push(...bullets);
      a.shootTimer=(a.weaponStats.fireInterval||28)*2;
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
    if(e.type==="Dreadnaught"){
      e.x=GAME_W-e.w/2;e.y+=e.vy;
      if(e.y<=0){e.y=0;e.vy=Math.abs(e.vy);}
      if(e.y+e.h>=GAME_H){e.y=GAME_H-e.h;e.vy=-Math.abs(e.vy);}
      if(Math.abs(e.vy)<e.speed*0.8)e.vy=e.speed*(e.vy>=0?1:-1);
      e.rotation=Math.atan2(pcy-e.y-e.h/2,pcx-e.x-e.w/2);
      if(e.shields<e.maxShields)e.shields+=0.015;
      e.turrets&&e.turrets.forEach(t=>{
        t.shootTimer--;
        if(t.shootTimer<=0&&t.weaponStats){
          const tx=e.x+t.rx,ty=e.y+t.ry;
          const pred=predictPos(pcx,pcy,player.vx||0,player.vy||0,tx,ty,t.weaponStats.speed);
          enemyBullets.push(...fireBullets({x:tx-1,y:ty-1,w:2,h:2},t.weaponStats,Math.atan2(pred.y-ty,pred.x-tx),false));
          t.shootTimer=t.fireRate;
        }
      });
      e.beamTimer--;
      const vkDef=ENEMIES.Dreadnaught;
      if(e.beamTimer===vkDef.beamWarningFrames)e.beamWarningAngle=Math.atan2(pcy-e.y-e.h/2,pcx-e.x-e.w/2);
      if(e.beamTimer<=0){
        const ecx=e.x+e.w/2,ecy=e.y+e.h/2;
        const cos=Math.cos(e.beamWarningAngle),sin=Math.sin(e.beamWarningAngle);
        const ep=rayEndpoint(ecx,ecy,cos,sin);
        if(rayHitsRect(ecx,ecy,cos,sin,player))player.hp=-1;
        allies.forEach(a=>{if(rayHitsRect(ecx,ecy,cos,sin,a))a.hp=-1;});
        beamFlashes.push({x1:ecx,y1:ecy,x2:ep.x,y2:ep.y,life:45,maxLife:45,color:"#ff2200",width:14});
        e.beamTimer=vkDef.beamCooldownFrames;e.beamWarningAngle=null;
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
        const ORBIT_RADIUS=260,MIN_RANGE=130;
        const myIdx=smallList.indexOf(e);
        e.surroundAngle+=0.018;
        const orbitAngle=e.surroundAngle+(Math.PI*2*myIdx/Math.max(totalSmall,1));
        const targetX=pcx+Math.cos(orbitAngle)*ORBIT_RADIUS-e.w/2;
        const targetY=pcy+Math.sin(orbitAngle)*ORBIT_RADIUS-e.h/2;
        const tdx=targetX-e.x,tdy=targetY-e.y,tDist=Math.hypot(tdx,tdy)||1;
        e.vx+=(tdx/tDist)*accel*2.2;e.vy+=(tdy/tDist)*accel*2.2;
        if(dist<MIN_RANGE){e.vx-=ndx*accel*5;e.vy-=ndy*accel*5;}
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
      e.x+=e.vx;e.y+=e.vy;
      const m=25;
      if(e.x<m)e.vx+=accel*1.5;if(e.x>GAME_W-e.w-m)e.vx-=accel*1.5;
      if(e.y<m)e.vy+=accel*1.5;if(e.y>GAME_H-e.h-m)e.vy-=accel*1.5;
      e.x=Math.max(0,Math.min(GAME_W-e.w,e.x));e.y=Math.max(0,Math.min(GAME_H-e.h,e.y));
    }
    if(e.shields<e.maxShields)e.shields+=0.015;
    e.rotation=Math.atan2(pcy-e.y-e.h/2,pcx-e.x-e.w/2);
    const frMult=e.stunTimer>0?2:1;
    e.turrets&&e.turrets.forEach(t=>{
      t.shootTimer--;
      if(t.shootTimer<=0&&t.weaponStats){
        const tx=e.x+t.rx,ty=e.y+t.ry;
        const pred=predictPos(pcx,pcy,player.vx||0,player.vy||0,tx,ty,t.weaponStats.speed);
        enemyBullets.push(...fireBullets({x:tx-1,y:ty-1,w:2,h:2},t.weaponStats,Math.atan2(pred.y-ty,pred.x-tx),false));
        t.shootTimer=t.fireRate*frMult;
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
  beamFlashes=beamFlashes.filter(f=>f.life>0);
  updateHitEffects(); updateDeathEffects();
  const inBounds=b=>!b.dead&&b.x>-60&&b.x<GAME_W+60&&b.y>-60&&b.y<GAME_H+60;
  playerBullets=playerBullets.filter(inBounds);
  enemyBullets=enemyBullets.filter(inBounds);
}

function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}

function checkCollisions() {
  playerBullets.forEach(b=>{
    if(b.visualOnly||b.dead)return;
    enemies.forEach(e=>{
      if(e.dead||!overlaps(b,e))return;
      spawnHitEffect(b.x+b.w/2,b.y+b.h/2,b);
      playHitSound(b.category);
      if(b.piercing){if(!b.hitSet)b.hitSet=new Set();if(b.hitSet.has(e))return;b.hitSet.add(e);}else b.dead=true;
      applyDamage(e,b);
      if(e.hp<=0){spawnDeathEffect(e);playExplosion(ENEMIES[e.type]?.size||2);e.dead=true;money+=e.score;}
    });
  });
  enemyBullets.forEach(b=>{
    if(b.dead)return;
    if(overlaps(b,player)){b.dead=true;applyDamage(player,b);}
    allies.forEach(a=>{
      if(!a.dead&&overlaps(b,a)){applyDamage(a,b);if(a.hp<=0){spawnDeathEffect(a);a.dead=true;}}
    });
  });
  if(player.pdcCount>0){
    enemyBullets.forEach(b=>{
      if(!b.dead&&Math.abs(b.x-player.x)<180&&Math.random()<player.pdcCount*0.03)b.dead=true;
    });
  }
  playerBullets=playerBullets.filter(b=>!b.dead);
  enemyBullets=enemyBullets.filter(b=>!b.dead);
  enemies=enemies.filter(e=>!e.dead);
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
  ctx.restore();
  if(obj.stunTimer>0){ctx.fillStyle="rgba(160,80,255,0.25)";ctx.fillRect(obj.x,obj.y,obj.w,obj.h);}
  const bx=obj.x,bw=obj.w;
  if(obj.maxShields>0){ctx.fillStyle="#222";ctx.fillRect(bx,obj.y-17,bw,4);ctx.fillStyle="#0af";ctx.fillRect(bx,obj.y-17,bw*Math.max(0,obj.shields/obj.maxShields),4);}
  if(obj.maxArmor>0){ctx.fillStyle="#333";ctx.fillRect(bx,obj.y-12,bw,4);ctx.fillStyle="#ccc";ctx.fillRect(bx,obj.y-12,bw*Math.max(0,obj.armor/obj.maxArmor),4);}
  ctx.fillStyle="#222";ctx.fillRect(bx,obj.y-7,bw,4);
  ctx.fillStyle="#0f0";ctx.fillRect(bx,obj.y-7,bw*Math.max(0,obj.hp/obj.maxHp),4);
}

function drawBullets() {
  [...playerBullets,...enemyBullets].forEach(b=>{
    ctx.fillStyle=b.color||"#fff";ctx.fillRect(b.x,b.y,b.w,b.h);
    if(b.missile){ctx.fillStyle="#ff4400";ctx.fillRect(b.x-6,b.y+1,6,b.h-2);}
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
    if(e.type!=="Dreadnaught"||e.beamWarningAngle===null||e.beamWarningAngle===undefined)return;
    const ecx=e.x+e.w/2,ecy=e.y+e.h/2;
    const cos=Math.cos(e.beamWarningAngle),sin=Math.sin(e.beamWarningAngle);
    const ep=rayEndpoint(ecx,ecy,cos,sin);
    const secs=Math.ceil(e.beamTimer/60);
    const pulse=0.35+0.55*Math.abs(Math.sin(Date.now()/120));
    ctx.save();ctx.globalAlpha=pulse;ctx.strokeStyle="#ff2200";ctx.lineWidth=10;
    ctx.setLineDash([24,14]);ctx.shadowColor="#ff4400";ctx.shadowBlur=30;
    ctx.beginPath();ctx.moveTo(ecx,ecy);ctx.lineTo(ep.x,ep.y);ctx.stroke();ctx.setLineDash([]);
    ctx.globalAlpha=0.9;ctx.fillStyle="#ff2200";ctx.font="bold 26px monospace";ctx.textAlign="center";
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
  if(currentShipName==="Comet"){
    const dodgeNow=player.boosting?player.dodgeBoosted:player.dodgeBase;
    ctx.fillStyle="#ffcc00";ctx.font="13px monospace";
    ctx.fillText(`DODGE ${Math.round(dodgeNow*100)}%`,bx+6,by+44);
  }
}

function render() {
  ctx.fillStyle="#000011";ctx.fillRect(0,0,GAME_W,GAME_H);
  ctx.fillStyle="#ffffff";
  for(let i=0;i<150;i++)ctx.fillRect((i*137)%GAME_W,(i*97)%GAME_H,1,1);
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
  enemies.forEach(drawEntity);
  allies.forEach(drawEntity);
  drawEntity(player);
  drawRailgunCharge();
  drawAimArrow();
  drawBullets();
  drawBeamFlashes();
  drawHitEffects();
  drawDeathEffects();
  drawBeamWarnings();
  drawBoostHUD();
  ctx.fillStyle="rgba(255,255,255,0.4)";ctx.font="18px monospace";
  ctx.fillText(infiniteMode?`Wave ${currentWave} (Infinite)`:`Wave ${currentWave} / ${WAVES.length}`,10,GAME_H-12);
  if(player.hp<player.maxHp*0.25){ctx.fillStyle="rgba(255,0,0,0.12)";ctx.fillRect(0,0,GAME_W,GAME_H);}
}

// ============================================================
// HUD + LOOP
// ============================================================
function updateHUD() {
  const inGame = state==="playing"||state==="waveTransition";
  document.getElementById("hud").style.display = inGame ? "block" : "none";
  document.getElementById("inGameBack").style.display = inGame ? "block" : "none";
  document.getElementById("health").textContent   = Math.max(0,Math.floor(player.hp||0));
  document.getElementById("armorHUD").textContent = Math.max(0,Math.floor(player.armor||0));
  document.getElementById("shields").textContent  = Math.max(0,Math.floor(player.shields||0));
  document.getElementById("money").textContent    = money;
  document.getElementById("wave").textContent     = currentWave;
  document.getElementById("missiles").textContent = player.missiles||0;
}

function gameLoop() {
  if(state==="playing"){
    updatePlayer();updateAllies();updateEnemies();updateBullets();checkCollisions();
    if(enemies.length===0){
      const reward=infiniteMode?generateInfiniteWave(currentWave).reward:(WAVES[currentWave-1]?.reward||0);
      money+=reward;
      player.shields=player.maxShields;player.armor=player.maxArmor;
      allies.forEach(a=>{a.shields=a.maxShields;a.armor=a.maxArmor;});
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
  requestAnimationFrame(gameLoop);
}

function confirmLeaveGame() {
  if(confirm("Are you sure you want to leave? All progress will be lost.")) {
    enemies=[]; playerBullets=[]; enemyBullets=[]; beamFlashes=[]; hitEffects=[]; deathEffects=[];
    state="menu";
    document.getElementById("mainMenu").style.display="block";
    document.getElementById("hud").style.display="none";
    document.getElementById("inGameBack").style.display="none";
    if(IS_MOBILE){const ui=document.getElementById("mobileUI");if(ui)ui.style.display="none";}
  }
}

gameLoop();


