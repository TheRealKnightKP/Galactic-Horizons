// shop.js

let weaponInventory = {};

const WEAPON_BASE_PRICES = {
  laser_repeater: 800, laser_cannon: 2500, ballistic_gatling: 1800,
  ballistic_cannon: 3500, ballistic_railgun: 7000,
  scattergun_ballistic: 2200, scattergun_laser: 2200, distortion: 2000,
  vengeance_cannon: 0, // not purchasable, bespoke only
};
function wKey(type, size)   { return `${type}_s${size}`; }
function wPrice(type, size) { return Math.round((WEAPON_BASE_PRICES[type] || 2000) * Math.pow(1.9, size - 1)); }
function wOwned(wk)         { return weaponInventory[wk] || 0; }

function wEquipped(wk) {
  if (!wk || wk === "builtin") return 0;
  let n = 0;
  if (playerLoadout.mainWeapon === wk) n++;
  (playerLoadout.pdcWeapons || []).forEach(w => { if (w === wk) n++; });
  playerLoadout.allies.forEach(a => { if (a && a.weapon === wk) n++; });
  return n;
}
function wCanEquip(wk, currentWk) {
  if (!wk || wk === "builtin") return true;
  return wOwned(wk) - wEquipped(wk) + (currentWk === wk ? 1 : 0) > 0;
}

// === KONAMI CODE ===
const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","KeyB","KeyA"];
let konamiProgress = 0;
let cometUnlocked = false;
let vengeanaceUnlocked = false;
let retributionUnlocked = false;
document.addEventListener("keydown", e => {
  if (e.code === KONAMI[konamiProgress]) {
    konamiProgress++;
    if (konamiProgress === KONAMI.length) {
      konamiProgress = 0;
      let msg = "";
      if (!cometUnlocked) {
        cometUnlocked = true;
        if (!ownedShips.includes("Comet")) ownedShips.push("Comet");
        msg += "🌠 COMET";
      }
      if (!vengeanaceUnlocked) {
        vengeanaceUnlocked = true;
        if (!ownedShips.includes("Vengeance")) ownedShips.push("Vengeance");
        msg += (msg ? " + " : "") + "⚔ VENGEANCE";
      }
      if (msg) {
        const el = document.createElement("div");
        el.textContent = "🔓 SECRET SHIPS UNLOCKED: " + msg;
        el.style.cssText = "position:fixed;top:40%;left:50%;transform:translateX(-50%);background:#111;color:#ff4400;font:bold 24px monospace;padding:18px 36px;border:2px solid #ff4400;z-index:9999;border-radius:8px;pointer-events:none;text-align:center";
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
      }
    }
  } else {
    konamiProgress = e.code === KONAMI[0] ? 1 : 0;
  }
});

// === PLAYER LOADOUT STATE ===
let playerLoadout = {
  ship: "Starlight",
  mainWeapon: "builtin",
  pdcWeapons: [],
  shieldTier: 1,
  ownedShieldTiers: [1],
  armorTier: 1,
  ownedArmorTiers: [1],
  engineTier: 1,
  ownedEngineTiers: [1],
  allies: [null, null],
  unlockedAllyShips: [],
  missileKind: "standard",
  missileRack: [],  // [{kind, tier}, ...] — ordered list of missiles to cycle through
};

// Per-ship upgrade storage
let shipUpgrades = {};
function getShipUpgrades(name) {
  if (!shipUpgrades[name]) shipUpgrades[name] = {
    mainWeapon:"builtin", pdcWeapons:[],
    shieldTier:1, ownedShieldTiers:[1],
    armorTier:1,  ownedArmorTiers:[1],
    engineTier:1, ownedEngineTiers:[1],
  };
  return shipUpgrades[name];
}
function saveShipUpgrades(name) {
  const u = getShipUpgrades(name);
  u.mainWeapon        = playerLoadout.mainWeapon;
  u.pdcWeapons        = [...(playerLoadout.pdcWeapons||[])];
  u.shieldTier        = playerLoadout.shieldTier;
  u.ownedShieldTiers  = [...playerLoadout.ownedShieldTiers];
  u.armorTier         = playerLoadout.armorTier;
  u.ownedArmorTiers   = [...playerLoadout.ownedArmorTiers];
  u.engineTier        = playerLoadout.engineTier;
  u.ownedEngineTiers  = [...playerLoadout.ownedEngineTiers];
  u.missileTier           = playerLoadout.missileTier||1;
  u.ownedMissileTiers     = [...(playerLoadout.ownedMissileTiers||[1])];
  u.weaponQualityTier     = playerLoadout.weaponQualityTier||1;
  u.ownedWeaponQualityTiers = [...(playerLoadout.ownedWeaponQualityTiers||[1])];
  u.turretTier            = playerLoadout.turretTier||1;
  u.ownedTurretTiers      = [...(playerLoadout.ownedTurretTiers||[1])];
  u.missileRack           = [...(playerLoadout.missileRack||[])];
}
function loadShipUpgrades(name) {
  const u = getShipUpgrades(name);
  playerLoadout.mainWeapon       = u.mainWeapon;
  playerLoadout.pdcWeapons       = [...u.pdcWeapons];
  playerLoadout.shieldTier       = u.shieldTier;
  playerLoadout.ownedShieldTiers = [...u.ownedShieldTiers];
  playerLoadout.armorTier        = u.armorTier;
  playerLoadout.ownedArmorTiers  = [...u.ownedArmorTiers];
  playerLoadout.engineTier       = u.engineTier;
  playerLoadout.ownedEngineTiers = [...u.ownedEngineTiers];
  playerLoadout.missileTier           = u.missileTier||1;
  playerLoadout.ownedMissileTiers     = [...(u.ownedMissileTiers||[1])];
  playerLoadout.weaponQualityTier     = u.weaponQualityTier||1;
  playerLoadout.ownedWeaponQualityTiers = [...(u.ownedWeaponQualityTiers||[1])];
  playerLoadout.turretTier            = u.turretTier||1;
  playerLoadout.ownedTurretTiers      = [...(u.ownedTurretTiers||[1])];
  playerLoadout.missileRack           = [...(u.missileRack||[])];
}

// Ally inventory
let allyInventory = {};
let allyPurchaseCount = {};
function allyOwned(name)     { return allyInventory[name] || 0; }
function allyEquipped(name)  { return playerLoadout.allies.filter(a=>a&&a.ship===name).length; }
function allyAvailable(name, excludeIdx=-1) {
  const equipped = playerLoadout.allies.filter((a,i)=>a&&a.ship===name&&i!==excludeIdx).length;
  return allyOwned(name) - equipped;
}

const ALLY_BEHAVIORS = {
  0: { name: "Balanced",   speedMult:1.00, dmgMult:1.00, dodgeMult:1.00, shieldMult:1.00, rpmMult:1.00, desc:"No specialization." },
  1: { name: "Interceptor",speedMult:1.15, dmgMult:1.00, dodgeMult:1.00, shieldMult:1.00, rpmMult:1.00, desc:"+15% speed, -10% accuracy.", accuracyPenalty:0.10 },
  2: { name: "Gunner",     speedMult:1.00, dmgMult:1.15, dodgeMult:0.90, shieldMult:1.00, rpmMult:1.00, desc:"+15% damage, -10% dodge." },
  3: { name: "Evader",     speedMult:1.00, dmgMult:0.90, dodgeMult:1.15, shieldMult:1.00, rpmMult:1.00, desc:"+15% dodge, -10% damage." },
  4: { name: "Tank",       speedMult:1.00, dmgMult:1.00, dodgeMult:1.00, shieldMult:1.15, rpmMult:0.90, desc:"+15% shields, -10% RPM." },
  5: { name: "Rapid",      speedMult:1.00, dmgMult:1.00, dodgeMult:1.00, shieldMult:0.90, rpmMult:1.15, desc:"+15% RPM, -10% shields." },
};

let _shopTab    = "ships";
let _loadoutTab = "ship";

// ============================
// MOBILE KONAMI UI
// ============================
function buildMobileKonamiUI() {
  if (document.getElementById("mobileKonamiUI")) return;
  const overlay = document.createElement("div");
  overlay.id = "mobileKonamiUI";
  overlay.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;align-items:center;justify-content:center;flex-direction:column;font-family:monospace";
  overlay.style.display = "none";

  const box = document.createElement("div");
  box.style.cssText = "background:#0a0a14;border:2px solid #ff4400;border-radius:12px;padding:28px 32px;text-align:center;min-width:320px;max-width:90vw";

  const title = document.createElement("div");
  title.textContent = "🔓 Secret Code";
  title.style.cssText = "color:#ff4400;font:bold 20px monospace;margin-bottom:6px";

  const hint = document.createElement("div");
  hint.textContent = "↑ ↑ ↓ ↓ ← → ← → B A";
  hint.style.cssText = "color:#555;font:12px monospace;margin-bottom:18px";

  const progress = document.createElement("div");
  progress.id = "mobileKonamiProgress";
  progress.style.cssText = "color:#0af;font:13px monospace;margin-bottom:16px;min-height:18px";

  // Build direction + button grid
  const btnGrid = document.createElement("div");
  btnGrid.style.cssText = "display:grid;grid-template-columns:repeat(4,64px);gap:8px;justify-content:center;margin-bottom:16px";

  const seqLabels = ["↑","↑","↓","↓","←","→","←","→","B","A"];
  let mobileKonamiStep = 0;

  function updateProgress() {
    progress.textContent = seqLabels.slice(0,mobileKonamiStep).join(" ") + (mobileKonamiStep>0?" ✓":"");
  }

  // Arrow buttons
  const directions = [
    {label:"↑",  code:"ArrowUp"},
    {label:"↓",  code:"ArrowDown"},
    {label:"←",  code:"ArrowLeft"},
    {label:"→",  code:"ArrowRight"},
    {label:"B",  code:"KeyB"},
    {label:"A",  code:"KeyA"},
  ];

  directions.forEach(d => {
    const btn = document.createElement("button");
    btn.textContent = d.label;
    btn.style.cssText = "width:64px;height:64px;font:bold 22px monospace;background:#001122;border:1px solid #0af;color:#0af;border-radius:8px;cursor:pointer";
    btn.addEventListener("touchstart", e => {
      e.preventDefault();
      if (d.code === KONAMI[mobileKonamiStep]) {
        mobileKonamiStep++;
        updateProgress();
        if (mobileKonamiStep === KONAMI.length) {
          mobileKonamiStep = 0;
          let msg = "";
          if (!cometUnlocked) {
            cometUnlocked = true;
            if (!ownedShips.includes("Comet")) ownedShips.push("Comet");
            msg += "COMET ";
          }
          if (!vengeanaceUnlocked) {
            vengeanaceUnlocked = true;
            if (!ownedShips.includes("Vengeance")) ownedShips.push("Vengeance");
            msg += "VENGEANCE";
          }
          progress.textContent = msg ? ("✅ UNLOCKED: " + msg) : "✅ Already unlocked!";
          progress.style.color = "#0f0";
          setTimeout(() => { progress.textContent = ""; progress.style.color = "#0af"; }, 3000);
        }
      } else {
        mobileKonamiStep = d.code === KONAMI[0] ? 1 : 0;
        updateProgress();
      }
    }, { passive: false });
    btnGrid.appendChild(btn);
  });

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕ Close";
  closeBtn.style.cssText = "width:100%;margin-top:8px;padding:10px;font:bold 14px monospace;background:rgba(80,0,0,0.4);border:1px solid #f44;color:#f44;border-radius:6px;cursor:pointer";
  closeBtn.addEventListener("touchstart", e => { e.preventDefault(); overlay.style.display = "none"; }, { passive: false });

  box.appendChild(title);
  box.appendChild(hint);
  box.appendChild(progress);
  box.appendChild(btnGrid);
  box.appendChild(closeBtn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showMobileKonamiUI() {
  buildMobileKonamiUI();
  const el = document.getElementById("mobileKonamiUI");
  if (el) { el.style.display = "flex"; }
}

// ============================
// SHIP SHOP
// ============================
function showShop() {
  _shopTab = "ships";
  // Sync unlock flags from ownedShips (handles page reload / persistent state)
  if (ownedShips && ownedShips.includes("Comet"))       cometUnlocked = true;
  if (ownedShips && ownedShips.includes("Vengeance"))   vengeanaceUnlocked = true;
  if (ownedShips && ownedShips.includes("Retribution")) retributionUnlocked = true;
  document.getElementById("shopMenu").style.display = "block";
  document.getElementById("shopMoney").textContent = "Credits: " + money;
  const backBtn = document.getElementById("shopBackBtn");
  if(backBtn) backBtn.style.display = shopOpenedFromMenu ? "block" : "none";
  // Inject mobile secret button if on mobile
  if (typeof IS_MOBILE !== "undefined" && IS_MOBILE) {
    if (!document.getElementById("mobileSecretBtn")) {
      const sb = document.createElement("button");
      sb.id = "mobileSecretBtn";
      sb.textContent = "🔒";
      sb.style.cssText = "position:fixed;bottom:12px;right:12px;width:44px;height:44px;font-size:20px;background:rgba(0,0,0,0.6);border:1px solid #333;color:#444;border-radius:50%;z-index:9998;padding:0";
      sb.addEventListener("touchstart", e => { e.preventDefault(); showMobileKonamiUI(); }, { passive: false });
      document.body.appendChild(sb);
    }
  }
  renderShopTab();
}

function setShopTab(tab) { _shopTab = tab; renderShopTab(); }

function renderShopTab() {
  const s = document.getElementById("shopTabShips");
  const w = document.getElementById("shopTabWeapons");
  let a = document.getElementById("shopTabAllies");
  if (!a) {
    a = document.createElement("button");
    a.id = "shopTabAllies";
    a.textContent = "Allies";
    a.style.cssText = "width:auto;display:inline-block;margin:2px";
    a.onclick = () => setShopTab("allies");
    if (w && w.parentNode) w.parentNode.insertBefore(a, w.nextSibling);
  }
  if (s) s.style.borderBottom = _shopTab === "ships"   ? "2px solid #0af" : "none";
  if (w) w.style.borderBottom = _shopTab === "weapons" ? "2px solid #0af" : "none";
  if (a) a.style.borderBottom = _shopTab === "allies"  ? "2px solid #0af" : "none";
  const body = document.getElementById("shopBody");
  if (!body) return;
  if (_shopTab === "ships")   renderShopShips(body);
  else if (_shopTab === "allies") renderShopAllies(body);
  else renderShopWeapons(body);
}

function renderShopShips(container) {
  let html = `<div style="display:flex;flex-wrap:wrap;gap:12px;padding:8px">`;
  for (const [name, ship] of Object.entries(SHIPS)) {
    if (ship.secret && !cometUnlocked && name === "Comet") continue;
    if (ship.secret && !vengeanaceUnlocked && name === "Vengeance") continue;
    if (ship.secret && !retributionUnlocked && name === "Retribution") continue;
    const isSpecial = ship.secret;
    const canAfford = ship.price !== null && money >= ship.price;
    const owned = ownedShips && ownedShips.includes(name);
    const desc  = SHIP_DESCRIPTIONS[name] || "";
    const tier  = ship.armorType;
    const tierColor = {light:"#88ccff",medium:"#88ff88",heavy:"#ffcc44",subcapital:"#ff8844",capital:"#ff44ff"}[tier] || "#fff";
    html += `
    <div style="background:#0a0e1a;border:1px solid #223;border-radius:8px;width:200px;padding:0;overflow:hidden;position:relative">
      <div style="position:relative;width:200px;height:120px;background:#050810;display:flex;align-items:center;justify-content:center;overflow:hidden">
        <img src="assets/${ship.image}" style="max-width:180px;max-height:110px;object-fit:contain;image-rendering:pixelated"
             onerror="this.style.display='none'">
        <div style="position:absolute;top:6px;right:6px;cursor:pointer;z-index:2"
             onclick="toggleShipInfo('${name}')">
          <div style="width:22px;height:22px;border-radius:50%;background:#0af;color:#000;font:bold 13px monospace;display:flex;align-items:center;justify-content:center">i</div>
        </div>
        ${ship.secret ? `<div style="position:absolute;top:6px;left:6px;background:#ff4400;color:#fff;font:bold 10px monospace;padding:2px 6px;border-radius:4px">SECRET</div>` : ""}
        <div id="shipinfo_${name}" style="display:none;position:absolute;inset:0;background:rgba(0,5,15,0.95);padding:8px;font:11px monospace;color:#ccc;overflow-y:auto;z-index:3">
          <div style="color:#0af;font-weight:bold;margin-bottom:4px">${name}</div>
          <div style="color:#aaa;margin-bottom:6px;line-height:1.4">${desc}</div>
          <div>HP: <span style="color:#0f0">${ship.hp}</span></div>
          <div>Shields: <span style="color:#0af">${ship.shields}</span></div>
          <div>Armor: <span style="color:${tierColor}">${ARMOR_TYPES[tier]?.name || tier}</span></div>
          <div>Speed: <span style="color:#ff0">${ship.speed}</span></div>
          <div>Missiles: <span style="color:#f80">${ship.missiles}</span></div>
          ${ship.pdc > 0 ? `<div>PDC: <span style="color:#88f">${ship.pdc} turrets</span></div>` : ""}
          ${ship.extraAllySlots ? `<div>Ally slots: <span style="color:#0af">+${ship.extraAllySlots}</span></div>` : ""}
          <div style="margin-top:4px;color:#555;cursor:pointer" onclick="toggleShipInfo('${name}')">[close]</div>
        </div>
      </div>
      <div style="padding:8px">
        <div style="color:#eee;font:bold 14px monospace">${name}${isSpecial?` <span style="background:#ff4400;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;vertical-align:middle">SPECIAL</span>`:""}</div>
        <div style="color:${tierColor};font:11px monospace;margin:2px 0">${ARMOR_TYPES[tier]?.name || ""} class</div>
        <div style="color:${canAfford?"#0f0":owned?"#aaa":"#f44"};font:12px monospace;margin:4px 0">
          ${ship.price !== null ? ship.price.toLocaleString() + " cr" : "???"}
        </div>
        ${!owned && ship.price !== null
          ? `<button ${canAfford?"":"disabled"} onclick="buyShip('${name}')" style="width:100%">Buy</button>`
          : owned
          ? `<button ${name===currentShipName?"disabled":""} onclick="equipShip('${name}')" style="width:100%">${name===currentShipName?"Equipped":"Equip"}</button>`
          : ""}
      </div>
    </div>`;
  }
  html += `</div>`;
  container.innerHTML = html;
}

function toggleShipInfo(name) {
  const el = document.getElementById("shipinfo_" + name);
  if (el) el.style.display = el.style.display === "none" ? "block" : "none";
}

function renderShopAllies(container) {
  let html = `<div style="padding:10px;color:#aaa;font:12px monospace">
    <p style="color:#0af;font:bold 14px monospace;margin-bottom:8px">Ally Ships</p>
    <p style="margin-bottom:12px">Buy individual ally units. Each purchased ally can be assigned to a slot in your <b>Loadout → Allies</b> panel.</p>
    <div style="display:flex;flex-wrap:wrap;gap:12px">`;
  for (const sn of ALLY_SHIP_ORDER) {
    const aDef = ALLY_SHIP_DEFS[sn];
    const owned = allyOwned(sn);
    const equipped = allyEquipped(sn);
    const available = owned - equipped;
    const canAfford = money >= aDef.price;
    html += `<div style="background:#0a0e1a;border:1px solid #223;border-radius:8px;width:190px;padding:10px">
      <img src="assets/${aDef.image}" style="width:100%;height:80px;object-fit:contain;image-rendering:pixelated" onerror="this.style.display='none'">
      <div style="color:#eee;font:bold 13px monospace;margin:6px 0">${sn}</div>
      <div style="color:#888;font:11px monospace;line-height:1.6">
        HP: ${aDef.hp} | Shields: ${aDef.shields}<br>
        Armor: ${aDef.armorType} | Weapon: S${aDef.weaponSize}<br>
        Owned: <span style="color:#0af">${owned}</span> &nbsp; Equipped: <span style="color:#ff8">${equipped}</span> &nbsp; Available: <span style="color:#0f0">${available}</span>
      </div>
      <div style="color:${canAfford?"#0f0":"#f44"};font:12px monospace;margin:6px 0">${sn==="Sprite"?"Free":aDef.price.toLocaleString()+" cr"}</div>
      <button style="width:100%;${canAfford?"":"opacity:0.4"}" onclick="buyAllyShipFromShop('${sn}')" ${canAfford?"":"disabled"}>
        Buy ${sn} #${(allyPurchaseCount[sn]||0)+1}
      </button>
    </div>`;
  }
  html += `</div></div>`;
  container.innerHTML = html;
}

function renderShopWeapons(container) {
  const selectedSizes = window._wpSizes || {};
  const selectedQty   = window._wpQtys  || {};
  let html = `<div style="padding:10px;color:#aaa;font:12px monospace">
    <p style="color:#0af;font:bold 14px monospace;margin-bottom:8px">Weapons</p>
    <p style="margin-bottom:14px;color:#888">Choose a weapon, pick a size and quantity, then buy. (Vengeance Cannon is bespoke — not for sale.)</p>
    <div style="display:flex;flex-direction:column;gap:10px">`;
  for (const [type, def] of Object.entries(WEAPON_DEFS)) {
    if (type === "vengeance_cannon") continue;
    const selSize = selectedSizes[type] || 1;
    const selQty  = selectedQty[type]  || 1;
    const price   = wPrice(type, selSize) * selQty;
    const k       = wKey(type, selSize);
    const owned   = wOwned(k);
    const canAfford = money >= price;
    const priceStr = price >= 1000000 ? (price/1000000).toFixed(2)+"M" : price >= 1000 ? (price/1000).toFixed(1)+"k" : price;
    // Stat preview
    const ws = typeof getWeaponStats === "function" ? getWeaponStats(type, selSize) : null;
    const statLine = ws ? `DMG:${ws.damage} | PEN:${ws.penetration} | SPD:${ws.speed}` : "";
    html += `<div style="background:#0a0e1a;border:1px solid #223;border-radius:8px;padding:10px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:10px">
      <div style="min-width:160px">
        <div style="color:#eee;font:bold 13px monospace">${def.name}</div>
        <div style="color:#888;font:10px monospace">${def.category} &nbsp; Owned: <span style="color:#0af">×${owned}</span></div>
        <div style="color:#666;font:10px monospace;margin-top:2px">${statLine}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <label style="color:#888;font:11px monospace">Size:</label>
        <select style="background:#111;border:1px solid #445;color:#eee;font:12px monospace;padding:2px 4px;border-radius:4px"
          onchange="window._wpSizes=window._wpSizes||{};window._wpSizes['${type}']=parseInt(this.value);renderShopTab()">
          ${Array.from({length:8},(_,i)=>i+1).map(sz=>`<option value="${sz}" ${sz===selSize?"selected":""}>S${sz} — ${(()=>{const p=wPrice(type,sz);return p>=1000000?(p/1000000).toFixed(1)+"M":p>=1000?Math.round(p/1000)+"k":p;})()}/ea</option>`).join("")}
        </select>
        <label style="color:#888;font:11px monospace">Qty:</label>
        <input type="number" min="1" max="99" value="${selQty}" style="width:52px;background:#111;border:1px solid #445;color:#eee;font:12px monospace;padding:2px 4px;border-radius:4px;text-align:center"
          onchange="window._wpQtys=window._wpQtys||{};window._wpQtys['${type}']=Math.max(1,parseInt(this.value)||1);renderShopTab()">
        <button style="padding:4px 14px;font:bold 12px monospace;${canAfford?"background:rgba(0,170,255,0.18);border:2px solid #0af;color:#0af":"background:rgba(80,80,80,0.2);border:1px solid #444;color:#555;opacity:0.5"};border-radius:6px;cursor:pointer"
          onclick="buyWeaponQty('${type}',${selSize},${selQty})" ${canAfford?"":"disabled"}>
          Buy ×${selQty} <span style="font:11px monospace">(${priceStr})</span>
        </button>
      </div>
    </div>`;
  }
  // Missile section
  html += `</div><hr style="border-color:#223;margin:14px 0"><p style="color:#0af;font:bold 14px monospace;margin-bottom:8px">Missiles</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px">`;
  const mkDefs = typeof MISSILE_KINDS !== "undefined" ? MISSILE_KINDS : {};
  const mtDefs = typeof MISSILE_TYPES !== "undefined" ? MISSILE_TYPES : {};
  for (const [kind, mk] of Object.entries(mkDefs)) {
    for (const [tier, mt] of Object.entries(mtDefs)) {
      const mKey  = `missile_${kind}_${tier}`;
      const mOwned = (typeof missileInventory !== "undefined" ? missileInventory[mKey] || 0 : 0);
      const mSelQty = (window._mQtys || {})[mKey] || 1;
      const mPrice = Math.round(mt.damage * mk.slots * 0.8 * mSelQty * tier);
      const canAffordM = money >= mPrice;
      const priceM = mPrice >= 1000 ? Math.round(mPrice/1000)+"k" : mPrice;
      html += `<div style="background:#0a0e1a;border:1px solid #223;border-radius:8px;padding:10px 12px;width:190px">
        <div style="color:#eee;font:bold 12px monospace">${mk.name} T${tier}</div>
        <div style="color:#888;font:10px monospace;line-height:1.5;margin-bottom:6px">${mk.desc}<br>DMG: ${Math.round(mt.damage * mk.slots)} | Slots: ${mk.slots}<br>Owned: <span style="color:#f80">×${mOwned}</span></div>
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px">
          <label style="color:#888;font:10px monospace">Qty:</label>
          <input type="number" min="1" max="99" value="${mSelQty}" style="width:44px;background:#111;border:1px solid #445;color:#eee;font:11px monospace;padding:2px;border-radius:4px;text-align:center"
            onchange="window._mQtys=window._mQtys||{};window._mQtys['${mKey}']=Math.max(1,parseInt(this.value)||1);renderShopTab()">
        </div>
        <button style="width:100%;padding:4px;font:11px monospace;${canAffordM?"background:rgba(255,120,0,0.18);border:2px solid #f80;color:#f80":"background:rgba(80,80,80,0.2);border:1px solid #444;color:#555;opacity:0.5"};border-radius:6px;cursor:pointer"
          onclick="buyMissiles('${kind}',${tier},${mSelQty})" ${canAffordM?"":"disabled"}>
          Buy ×${mSelQty} (${priceM})
        </button>
      </div>`;
    }
  }
  html += `</div></div>`;
  container.innerHTML = html;
}

function buyWeapon(type, size) {
  const price = wPrice(type, size);
  if (money < price) return;
  money -= price;
  const k = wKey(type, size);
  weaponInventory[k] = (weaponInventory[k] || 0) + 1;
  renderShopTab(); updateHUD();
}
function buyWeaponQty(type, size, qty) {
  const price = wPrice(type, size) * qty;
  if (money < price) return;
  money -= price;
  const k = wKey(type, size);
  weaponInventory[k] = (weaponInventory[k] || 0) + qty;
  renderShopTab(); updateHUD();
}
let missileInventory = {};
function buyMissiles(kind, tier, qty) {
  const mk = MISSILE_KINDS[kind]; const mt = MISSILE_TYPES[tier];
  if (!mk || !mt) return;
  const price = Math.round(mt.damage * mk.slots * 0.8 * qty * tier);
  if (money < price) return;
  money -= price;
  const k = `missile_${kind}_${tier}`;
  missileInventory[k] = (missileInventory[k] || 0) + qty;
  renderShopTab(); updateHUD();
}

function buyShip(name) {
  const ship = SHIPS[name];
  if (!ship || money < ship.price) return;
  money -= ship.price;
  if (!ownedShips.includes(name)) ownedShips.push(name);
  saveShipUpgrades(currentShipName);
  playerLoadout.ship = name;
  loadShipUpgrades(name);
  setPlayerShip(name); currentShipName = name;
  showShop(); updateHUD();
}
function equipShip(name) {
  if (!ownedShips || !ownedShips.includes(name)) return;
  saveShipUpgrades(currentShipName);
  playerLoadout.ship = name;
  loadShipUpgrades(name);
  setPlayerShip(name); currentShipName = name;
  showShop(); updateHUD();
}
function openShopFromMenu() {
  shopOpenedFromMenu = true;
  document.getElementById("mainMenu").style.display = "none";
  state = "shop"; showShop();
}
function closeShop() {
  document.getElementById("shopMenu").style.display = "none";
  if (shopOpenedFromMenu) {
    shopOpenedFromMenu = false;
    document.getElementById("mainMenu").style.display = "block";
    state = "menu"; return;
  }
  if (currentWave === 0) nextWave(); else state = "playing";
}

// ============================
// LOADOUT
// ============================
function ensureAllySlots() {
  const d = SHIPS[playerLoadout.ship || "Starlight"];
  const n = 2 + (d.extraAllySlots || 0);
  while (playerLoadout.allies.length < n)
    playerLoadout.allies.push(null);
}

function openLoadout() {
  document.getElementById("mainMenu").style.display = "none";
  document.getElementById("loadoutMenu").style.display = "block";
  _loadoutTab = "ship";
  ensureAllySlots();
  renderLoadout();
}
function closeLoadout() {
  document.getElementById("loadoutMenu").style.display = "none";
  document.getElementById("mainMenu").style.display = "block";
}
function loadoutTab(tab) { _loadoutTab = tab; renderLoadout(); }
function renderInventoryPanel(container) {
  let html = `<div style="padding:10px;color:#aaa;font:12px monospace">`;
  html += `<p style="color:#0af;font:bold 14px monospace;margin-bottom:8px">Weapons Inventory</p>`;
  const hasAny = Object.entries(weaponInventory).some(([k,v])=>v>0);
  if (!hasAny) {
    html += `<p style="color:#555">No weapons purchased yet. Buy from Shop → Weapons tab.</p>`;
  } else {
    html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">`;
    for (const [k,qty] of Object.entries(weaponInventory)) {
      if (!qty) continue;
      const lastS = k.lastIndexOf("_s");
      const type = k.substring(0, lastS);
      const sizeStr = k.substring(lastS + 2);
      const def = WEAPON_DEFS[type];
      if (!def) continue;
      const equipped = wEquipped(k);
      html += `<div style="background:#0a0e1a;border:1px solid #223;border-radius:6px;padding:6px 10px;min-width:110px">
        <div style="color:#eee;font:bold 11px monospace">${def.name} S${sizeStr}</div>
        <div style="color:#0af;font:11px monospace">×${qty} owned</div>
        ${equipped>0?`<div style="color:#ff8;font:10px monospace">×${equipped} equipped</div>`:""}
        <div style="color:#0f0;font:10px monospace">×${qty-equipped} free</div>
      </div>`;
    }
    html += `</div>`;
  }
  html += `<p style="color:#0af;font:bold 14px monospace;margin-bottom:8px">Missiles Inventory</p>`;
  if (typeof missileInventory === "undefined" || !Object.entries(missileInventory).some(([k,v])=>v>0)) {
    html += `<p style="color:#555">No missiles purchased yet. Buy from Shop → Weapons tab.</p>`;
  } else {
    html += `<div style="display:flex;flex-wrap:wrap;gap:6px">`;
    for (const [k,qty] of Object.entries(missileInventory)) {
      if (!qty) continue;
      const parts = k.split("_");
      const kind = parts[1]; const tier = parseInt(parts[2]);
      const mk = MISSILE_KINDS?.[kind]; const mt = MISSILE_TYPES?.[tier];
      if (!mk || !mt) continue;
      html += `<div style="background:#0a0e1a;border:1px solid #223;border-radius:6px;padding:6px 10px;min-width:110px">
        <div style="color:#f80;font:bold 11px monospace">${mk.name} T${tier}</div>
        <div style="color:#f80;font:11px monospace">×${qty}</div>
        <div style="color:#888;font:10px monospace">DMG:${Math.round(mt.damage*mk.slots)}</div>
      </div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  container.innerHTML = html;
}

function renderLoadout() {
  document.getElementById("loadoutMoney").textContent = "Credits: " + money;
  document.getElementById("tabShip").style.borderBottom     = _loadoutTab === "ship"      ? "2px solid #0af" : "none";
  document.getElementById("tabAllies").style.borderBottom   = _loadoutTab === "allies"    ? "2px solid #0af" : "none";
  // Add inventory tab if it doesn't exist
  let tabInv = document.getElementById("tabInventory");
  if (!tabInv) {
    tabInv = document.createElement("button");
    tabInv.id = "tabInventory";
    tabInv.textContent = "Inventory";
    tabInv.style.cssText = "width:auto;display:inline-block;margin:2px";
    tabInv.onclick = () => loadoutTab("inventory");
    const tabAllies = document.getElementById("tabAllies");
    if (tabAllies && tabAllies.parentNode) tabAllies.parentNode.insertBefore(tabInv, tabAllies.nextSibling);
  }
  tabInv.style.borderBottom = _loadoutTab === "inventory" ? "2px solid #ff8800" : "none";
  const sp = document.getElementById("loadoutShipPanel");
  const ap = document.getElementById("loadoutAlliesPanel");
  if (_loadoutTab === "ship") {
    sp.style.display = "block"; ap.style.display = "none";
    renderShipLoadoutPanel(sp);
  } else if (_loadoutTab === "inventory") {
    sp.style.display = "none"; ap.style.display = "block";
    renderInventoryPanel(ap);
  } else {
    sp.style.display = "none"; ap.style.display = "block";
    renderAllyLoadoutPanel(ap);
  }
}

function buildWeaponSelect(slotSize, currentWk, onchangeFn) {
  let html = `<select onchange="${onchangeFn}">`;
  html += `<option value="builtin" ${!currentWk||currentWk==="builtin"?"selected":""}>Built-in</option>`;
  for (const [type, def] of Object.entries(WEAPON_DEFS)) {
    if (type === "vengeance_cannon") continue;
    const k = wKey(type, slotSize);
    const owned = wOwned(k);
    if (owned > 0 && wCanEquip(k, currentWk))
      html += `<option value="${k}" ${currentWk===k?"selected":""}>${def.name} (×${owned})</option>`;
  }
  html += `</select>`;
  return html;
}

function buildShieldSelect(ownedTiers, currentTier, onchangeFn, buyFn, shipShields, shipName) {
  const shipPrices = (typeof SHIP_UPGRADE_PRICES!=="undefined"&&shipName&&SHIP_UPGRADE_PRICES[shipName]?.shield)||null;
  let html = `<select onchange="${onchangeFn}">`;
  for (let t = 1; t <= 3; t++) {
    if ((ownedTiers||[1]).includes(t)) {
      const val = shipShields ? Math.floor(shipShields * SHIELD_TIERS[t].mult) : "";
      html += `<option value="${t}" ${currentTier===t?"selected":""}>${SHIELD_TIERS[t].name}${val?" ("+val+")":""}</option>`;
    }
  }
  html += `</select>`;
  for (let t = 2; t <= 3; t++) {
    if (!(ownedTiers||[1]).includes(t)) {
      const prereq = t === 3 ? (ownedTiers||[1]).includes(2) : true;
      const price = shipPrices?.[t] ?? SHIELD_TIER_PRICES[t];
      const canBuy = prereq && money >= price;
      html += ` <button style="width:auto;display:inline-block;font-size:11px;${canBuy?"":"opacity:0.4"}" onclick="${buyFn}(${t})" ${canBuy?"":"disabled"}>Buy ${SHIELD_TIERS[t].name} (${price.toLocaleString()} cr)</button>`;
    }
  }
  return html;
}

function buildArmorSelect(ownedTiers, currentTier, onchangeFn, buyFn, baseArmor, shipName) {
  const shipPrices = (typeof SHIP_UPGRADE_PRICES!=="undefined"&&shipName&&SHIP_UPGRADE_PRICES[shipName]?.armor)||null;
  let html = `<select onchange="${onchangeFn}">`;
  for (let t = 1; t <= 3; t++) {
    if ((ownedTiers||[1]).includes(t))
      html += `<option value="${t}" ${currentTier===t?"selected":""}>${ARMOR_UPGRADE_TIERS[t].name} (${Math.round(baseArmor*ARMOR_UPGRADE_TIERS[t].mult)})</option>`;
  }
  html += `</select>`;
  for (let t = 2; t <= 3; t++) {
    if (!(ownedTiers||[1]).includes(t)) {
      const prereq = t === 3 ? (ownedTiers||[1]).includes(2) : true;
      const price = shipPrices?.[t] ?? ARMOR_UPGRADE_PRICES[t];
      const canBuy = prereq && money >= price;
      html += ` <button style="width:auto;display:inline-block;font-size:11px;${canBuy?"":"opacity:0.4"}" onclick="${buyFn}(${t})" ${canBuy?"":"disabled"}>Buy ${ARMOR_UPGRADE_TIERS[t].name} (${price.toLocaleString()} cr)</button>`;
    }
  }
  return html;
}

function buildEngineSelect(ownedTiers, currentTier, onchangeFn, buyFn, shipName) {
  const shipPrices = (typeof SHIP_UPGRADE_PRICES!=="undefined"&&shipName&&SHIP_UPGRADE_PRICES[shipName]?.engine)||null;
  let html = `<select onchange="${onchangeFn}">`;
  for (let t = 1; t <= 3; t++) {
    if ((ownedTiers||[1]).includes(t)) {
      const tier = ENGINE_UPGRADE_TIERS[t];
      html += `<option value="${t}" ${currentTier===t?"selected":""}>${tier.name} (${Math.round(tier.speedMult*100)}% spd)</option>`;
    }
  }
  html += `</select>`;
  for (let t = 2; t <= 3; t++) {
    if (!(ownedTiers||[1]).includes(t)) {
      const prereq = t === 3 ? (ownedTiers||[1]).includes(2) : true;
      const price = shipPrices?.[t] ?? ENGINE_UPGRADE_PRICES[t];
      const canBuy = prereq && money >= price;
      const tier = ENGINE_UPGRADE_TIERS[t];
      html += ` <button style="width:auto;display:inline-block;font-size:11px;${canBuy?"":"opacity:0.4"}" onclick="${buyFn}(${t})" ${canBuy?"":"disabled"}>Buy ${tier.name} (${price.toLocaleString()} cr)</button>`;
    }
  }
  const ct = ENGINE_UPGRADE_TIERS[currentTier];
  html += `<div style="color:#888;font-size:11px;margin-top:3px">Speed ×${ct.speedMult} | Boost dur ×${ct.boostDurMult} | CD ×${ct.boostCDMult} | +${Math.round(ct.dodgeBonus*100)}% dodge</div>`;
  return html;
}

function renderShipLoadoutPanel(container) {
  const sName = playerLoadout.ship || "Starlight";
  const sd = SHIPS[sName];
  let html = `<h3 style="color:#0af;margin:8px 0">${sName}</h3>`;

  if (sd.weaponType === "none") {
    html += `<p><b>Main Weapon:</b> None (PDC-only ship)</p>`;
  } else if (sd.bespoke) {
    html += `<p><b>Main Weapon:</b> <span style="color:#ffcc44">Bespoke ${WEAPON_DEFS[sd.weaponType]?.name} S${sd.weaponSize} — fixed</span></p>`;
  } else {
    html += `<p><b>Main Weapon</b> (S${sd.weaponSize}): ${buildWeaponSelect(sd.weaponSize, playerLoadout.mainWeapon, "setMainWeapon(this.value)")}</p>`;
  }

  if (sd.pdc > 0) {
    const pdcSizes = sd.pdcSizes || null;
    html += `<p><b>PDC Weapons:</b></p><div style="margin-left:10px">`;
    for (let ti = 0; ti < sd.pdc; ti++) {
      const tSize = pdcSizes ? pdcSizes[ti] : (sd.pdcSize || 1);
      const curWk = (playerLoadout.pdcWeapons && playerLoadout.pdcWeapons[ti]) || "builtin";
      html += `<div style="margin:3px 0">Turret ${ti+1} (S${tSize}): ${buildWeaponSelect(tSize, curWk, `setPDCWeapon(${ti},this.value)`)}</div>`;
    }
    html += `</div>`;
  }

  const shipMaxMissiles = sd.missiles || 0;
  if (shipMaxMissiles > 0) {
    html += buildMissileRackUI(sName, shipMaxMissiles);
  }
  html += `<p><b>Shields:</b> ${buildShieldSelect(playerLoadout.ownedShieldTiers, playerLoadout.shieldTier, "setPlayerShieldTier(parseInt(this.value))", "buyPlayerShield", sd.shields, sName)}</p>`;
  html += `<p><b>Hull Armor:</b> ${buildArmorSelect(playerLoadout.ownedArmorTiers, playerLoadout.armorTier, "setPlayerArmorTier(parseInt(this.value))", "buyPlayerArmor", sd.armor, sName)}</p>`;
  html += `<p><b>Engines:</b> ${buildEngineSelect(playerLoadout.ownedEngineTiers, playerLoadout.engineTier, "setPlayerEngineTier(parseInt(this.value))", "buyPlayerEngine", sName)}</p>`;

  // Missile storage upgrade
  const mPrices = (typeof SHIP_UPGRADE_PRICES !== "undefined" && SHIP_UPGRADE_PRICES[sName]?.missile) || { 2: 30000, 3: 90000 };
  if (shipMaxMissiles > 0) {
    const ownedMs = playerLoadout.ownedMissileTiers || [1];
    const curMs = playerLoadout.missileTier || 1;
    html += `<p><b>Missile Storage:</b> <select onchange="setPlayerMissileTier(parseInt(this.value))">`;
    for (let t=1;t<=3;t++) {
      if (ownedMs.includes(t)) {
        const msT = typeof MISSILE_STORAGE_TIERS !== "undefined" ? MISSILE_STORAGE_TIERS[t] : {name:"T"+t, mult:1+(t-1)*0.5};
        const cap = Math.round(shipMaxMissiles * msT.mult);
        html += `<option value="${t}" ${curMs===t?"selected":""}>${msT.name} (${cap} missiles)</option>`;
      }
    }
    html += `</select>`;
    for (let t=2;t<=3;t++) {
      if (!(ownedMs.includes(t))) {
        const prereq = t===3 ? ownedMs.includes(2) : true;
        const price = mPrices[t] || (t===2?30000:90000);
        const canBuy = prereq && money >= price;
        const msT = typeof MISSILE_STORAGE_TIERS !== "undefined" ? MISSILE_STORAGE_TIERS[t] : {name:"T"+t};
        html += ` <button style="width:auto;display:inline-block;font-size:11px;${canBuy?"":"opacity:0.4"}" onclick="buyPlayerMissileTier(${t})" ${canBuy?"":"disabled"}>Buy ${msT.name} (${price.toLocaleString()} cr)</button>`;
      }
    }
    html += `</p>`;
  }

  // Weapon quality upgrade
  const wqPrices = (typeof SHIP_UPGRADE_PRICES !== "undefined" && SHIP_UPGRADE_PRICES[sName]?.weapon) || { 2: 25000, 3: 80000 };
  if (sd.weaponType !== "none" && !sd.bespoke) {
    const ownedWq = playerLoadout.ownedWeaponQualityTiers || [1];
    const curWq = playerLoadout.weaponQualityTier || 1;
    html += `<p><b>Weapon Quality:</b> <select onchange="setPlayerWeaponQualityTier(parseInt(this.value))">`;
    for (let t=1;t<=3;t++) {
      if (ownedWq.includes(t)) {
        const wqT = typeof WEAPON_QUALITY_TIERS !== "undefined" ? WEAPON_QUALITY_TIERS[t] : {name:"T"+t, damageMult:1+(t-1)*0.5};
        html += `<option value="${t}" ${curWq===t?"selected":""}>${wqT.name} (×${wqT.damageMult} dmg)</option>`;
      }
    }
    html += `</select>`;
    for (let t=2;t<=3;t++) {
      if (!(ownedWq.includes(t))) {
        const prereq = t===3 ? ownedWq.includes(2) : true;
        const price = wqPrices[t] || (t===2?25000:80000);
        const canBuy = prereq && money >= price;
        const wqT = typeof WEAPON_QUALITY_TIERS !== "undefined" ? WEAPON_QUALITY_TIERS[t] : {name:"T"+t};
        html += ` <button style="width:auto;display:inline-block;font-size:11px;${canBuy?"":"opacity:0.4"}" onclick="buyPlayerWeaponQualityTier(${t})" ${canBuy?"":"disabled"}>Buy ${wqT.name} (${price.toLocaleString()} cr)</button>`;
      }
    }
    html += `</p>`;
  }

  // Turret upgrade (for ships with PDC)
  const tuPrices = (typeof SHIP_UPGRADE_PRICES !== "undefined" && SHIP_UPGRADE_PRICES[sName]?.turret);
  if (sd.pdc > 0 && tuPrices) {
    const ownedTu = playerLoadout.ownedTurretTiers || [1];
    const curTu = playerLoadout.turretTier || 1;
    html += `<p><b>Turret Upgrade:</b> <select onchange="setPlayerTurretTier(parseInt(this.value))">`;
    for (let t=1;t<=3;t++) {
      if (ownedTu.includes(t)) {
        const tuT = typeof TURRET_UPGRADE_TIERS !== "undefined" ? TURRET_UPGRADE_TIERS[t] : {name:"T"+t, rpmMult:1+(t-1)*0.5};
        html += `<option value="${t}" ${curTu===t?"selected":""}>${tuT.name} (×${tuT.rpmMult} RPM)</option>`;
      }
    }
    html += `</select>`;
    for (let t=2;t<=3;t++) {
      if (!(ownedTu.includes(t))) {
        const prereq = t===3 ? ownedTu.includes(2) : true;
        const price = tuPrices[t] || (t===2?30000:90000);
        const canBuy = prereq && money >= price;
        const tuT = typeof TURRET_UPGRADE_TIERS !== "undefined" ? TURRET_UPGRADE_TIERS[t] : {name:"T"+t};
        html += ` <button style="width:auto;display:inline-block;font-size:11px;${canBuy?"":"opacity:0.4"}" onclick="buyPlayerTurretTier(${t})" ${canBuy?"":"disabled"}>Buy ${tuT.name} (${price.toLocaleString()} cr)</button>`;
      }
    }
    html += `</p>`;
  }

  container.innerHTML = html;
}

function renderAllyLoadoutPanel(container) {
  ensureAllySlots();
  const sd = SHIPS[playerLoadout.ship || "Starlight"];
  const totalSlots = 2 + (sd.extraAllySlots || 0);
  let html = `<p style="color:#aaa;margin:4px 0 8px">Ally slots: ${totalSlots} &nbsp;<span style="color:#666;font-size:11px">Buy allies in Shop → Allies tab</span></p>`;
  for (let i = 0; i < totalSlots; i++) {
    const slot = playerLoadout.allies[i];
    if (!slot) {
      html += `<div class="ally-slot" style="background:#0a0a14;border:1px dashed #334;border-radius:6px;padding:8px;margin-bottom:8px;color:#555;font:12px monospace">
        <b style="color:#444">Slot ${i+1} — Empty</b><br>
        <div style="margin-top:6px">`;
      const available = ALLY_SHIP_ORDER.filter(sn => allyAvailable(sn, i) > 0);
      if (available.length > 0) {
        html += `Assign: `;
        available.forEach(sn => {
          html += `<button style="width:auto;display:inline-block;font-size:11px;margin:2px" onclick="assignAllyToSlot(${i},'${sn}')">+ ${sn} (${allyAvailable(sn,i)} avail)</button>`;
        });
      } else {
        html += `<span style="color:#444">No allies available — buy some in Shop → Allies</span>`;
      }
      html += `</div></div>`;
    } else {
      const aDef = ALLY_SHIP_DEFS[slot.ship] || ALLY_SHIP_DEFS.Sprite;
      const beh = ALLY_BEHAVIORS[slot.behavior||0];
      html += `<div class="ally-slot" style="background:#0a0e1a;border:1px solid #334;border-radius:6px;padding:8px;margin-bottom:8px">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">`;
      html += `<b style="color:#0af">Slot ${i+1}: <span id="allyNameDisplay_${i}">${slot.name||slot.ship}</span></b>`;
      html += `<button style="width:auto;font-size:10px;padding:2px 7px;background:rgba(255,50,50,0.15);border-color:#f44;color:#f44" onclick="removeAllyFromSlot(${i})">Remove</button>`;
      html += `</div>`;
      html += `<div style="margin:4px 0">Name: <input id="allyNameInput_${i}" value="${slot.name||slot.ship}" style="background:#111;border:1px solid #445;color:#eee;font:11px monospace;padding:2px 5px;width:130px" onchange="setAllyName(${i},this.value)"></div>`;
      html += `<div style="color:#666;font:10px monospace;margin-bottom:4px">${slot.ship} | S${aDef.weaponSize} weapon | ${aDef.armorType} armor</div>`;
      html += `<div style="margin:4px 0">Behavior: <select onchange="setAllyBehavior(${i},parseInt(this.value))">`;
      for (let b = 0; b <= 5; b++) {
        const bDef = ALLY_BEHAVIORS[b];
        html += `<option value="${b}" ${(slot.behavior||0)===b?"selected":""}>${bDef.name}</option>`;
      }
      html += `</select> <span style="color:#666;font-size:10px">${beh.desc}</span></div>`;
      html += `<div style="margin:4px 0">Weapon (S${aDef.weaponSize}): ${buildWeaponSelect(aDef.weaponSize, slot.weapon, `setAllyWeapon(${i},this.value)`)}</div>`;
      html += `<div style="margin:4px 0">Shield: ${buildShieldSelect(slot.ownedShieldTiers||[1], slot.shieldTier||1, `setAllyShieldTier(${i},parseInt(this.value))`, `buyAllyShield_${i}`, aDef.shields)}</div>`;
      html += `<div style="margin:4px 0">Armor: ${buildArmorSelect(slot.ownedArmorTiers||[1], slot.armorTier||1, `setAllyArmorTier(${i},parseInt(this.value))`, `buyAllyArmor_${i}`, aDef.hp)}</div>`;
      html += `<div style="margin:4px 0">Engines: ${buildEngineSelect(slot.ownedEngineTiers||[1], slot.engineTier||1, `setAllyEngineTier(${i},parseInt(this.value))`, `buyAllyEngine_${i}`)}</div>`;
      if (aDef.weaponSize > 0) {
        html += `<div style="margin:4px 0">Weapon Quality: ${buildWeaponQualitySelect(slot.ownedWeaponQualityTiers||[1], slot.weaponQualityTier||1, `setAllyWeaponQualityTier(${i},parseInt(this.value))`, `buyAllyWeaponQuality_${i}`)}</div>`;
      }
      html += `</div>`;
    }
  }
  container.innerHTML = html;
  for (let i = 0; i < totalSlots; i++) {
    window[`buyAllyShield_${i}`]         = (tier) => buyAllyShield(i, tier);
    window[`buyAllyArmor_${i}`]          = (tier) => buyAllyArmor(i, tier);
    window[`buyAllyEngine_${i}`]         = (tier) => buyAllyEngine(i, tier);
    window[`buyAllyWeaponQuality_${i}`]  = (tier) => buyAllyWeaponQuality(i, tier);
  }
}


// ============================
// MISSILE RACK UI
// ============================

// Total slot-weight of the current rack
function getRackSlotWeight() {
  const mk = typeof MISSILE_KINDS !== "undefined" ? MISSILE_KINDS : {};
  return (playerLoadout.missileRack||[]).reduce((sum, e) => sum + (mk[e.kind]?.slots||1), 0);
}

// How many of {kind, tier} are currently in the rack
function countInRack(kind, tier) {
  return (playerLoadout.missileRack||[]).filter(e=>e.kind===kind&&e.tier===tier).length;
}

// How many of {kind, tier} are in inventory but NOT yet in rack
function availableInInv(kind, tier) {
  const key = `missile_${kind}_${tier}`;
  const inInv = (typeof missileInventory!=="undefined" ? missileInventory[key]||0 : 0);
  return Math.max(0, inInv - countInRack(kind, tier));
}

function getMissileSlotCap(shipName) {
  const sd = SHIPS[shipName];
  const baseCap = sd?.missiles || 0;
  const tier = playerLoadout.missileTier || 1;
  const mult = (typeof MISSILE_STORAGE_TIERS!=="undefined" ? MISSILE_STORAGE_TIERS[tier]?.mult : 1) || 1;
  return Math.round(baseCap * mult);
}

function buildMissileRackUI(shipName, _unused) {
  const sd = SHIPS[shipName];
  const mTier = sd?.missileType || 2;
  const tierLabel = mTier===1 ? "T1 Fast" : mTier===2 ? "T2 Standard" : "T3 Heavy";
  const slotCap = getMissileSlotCap(shipName);
  const usedSlots = getRackSlotWeight();
  const freeSlots = slotCap - usedSlots;
  const mkDefs = typeof MISSILE_KINDS !== "undefined" ? MISSILE_KINDS : {};
  const rack = playerLoadout.missileRack || [];

  const pct = slotCap > 0 ? Math.min(100, (usedSlots / slotCap) * 100) : 0;
  const barColor = freeSlots < 0 ? "#f44" : freeSlots < 1 ? "#fa0" : "#0af";

  // Group rack by kind for display
  const grouped = {};
  rack.forEach(e => { grouped[e.kind] = (grouped[e.kind]||0)+1; });

  let html = `<div style="background:#060810;border:1px solid #223;border-radius:8px;padding:10px 12px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
      <b style="color:#0af;font:13px monospace">Missile Rack</b>
      <span style="font:10px monospace;color:#666">Ship tier: <span style="color:#fa0">${tierLabel}</span></span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <span style="font:11px monospace;color:${barColor}">Slots: ${usedSlots.toFixed(1)} / ${slotCap}</span>
      <span style="font:9px monospace;color:#444">micro=½sl &nbsp; nuke=5sl</span>
    </div>
    <div style="background:#0a0e1a;border-radius:4px;height:7px;margin-bottom:10px;overflow:hidden">
      <div style="background:${barColor};height:100%;width:${pct}%"></div>
    </div>`;

  // Loaded missiles
  if (rack.length === 0) {
    html += `<div style="color:#444;font:11px monospace;text-align:center;margin-bottom:10px">Rack is empty — load missiles below</div>`;
  } else {
    html += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">`;
    for (const [kind, cnt] of Object.entries(grouped)) {
      const mk = mkDefs[kind]||{name:kind,slots:1};
      const kc = kind==="nuke"?"#ff4400":kind==="emp"?"#44ffcc":kind==="micro"?"#ffcc44":kind==="cluster"?"#ff88ff":"#aaddff";
      const slotUsed = (mk.slots*cnt).toFixed(1);
      html += `<div style="display:flex;align-items:center;gap:3px;background:#0b1020;border:1px solid ${kc}55;border-radius:5px;padding:2px 7px;font:11px monospace">
        <span style="color:${kc};font-weight:bold">×${cnt} ${mk.name}</span>
        <span style="color:#444;font-size:9px">${slotUsed}sl</span>
        <button onclick="rackRemoveOne('${kind}',${mTier})" title="Remove 1" style="background:none;border:none;color:#f88;cursor:pointer;font:bold 13px monospace;padding:0 1px;line-height:1">−</button>
        <button onclick="rackRemoveAll('${kind}',${mTier})" title="Remove all" style="background:none;border:none;color:#f44;cursor:pointer;font:bold 11px monospace;padding:0 1px;line-height:1">✕</button>
      </div>`;
    }
    html += `</div>`;
    html += `<button onclick="rackClear()" style="width:auto;font-size:10px;padding:1px 7px;opacity:0.55;margin-bottom:8px">Clear All</button>`;
  }

  // Load section
  html += `<div style="border-top:1px solid #161e2e;padding-top:9px">
    <div style="color:#666;font:10px monospace;margin-bottom:6px">Load from inventory (${tierLabel} missiles):</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px">`;

  for (const [kind, mk] of Object.entries(mkDefs)) {
    const inInv = availableInInv(kind, mTier) + countInRack(kind, mTier); // total owned
    const notInRack = availableInInv(kind, mTier);
    const slotCost = mk.slots;
    const maxCanLoad = slotCap > 0 ? Math.floor((freeSlots + 0.001) / slotCost) : 0;
    const canLoad = notInRack > 0 && maxCanLoad >= 1;
    const actualMax = Math.min(notInRack, maxCanLoad);
    const kc = kind==="nuke"?"#ff4400":kind==="emp"?"#44ffcc":kind==="micro"?"#ffcc44":kind==="cluster"?"#ff88ff":"#aaddff";

    html += `<div style="background:#0b1020;border:1px solid ${canLoad?"#223":"#141420"};border-radius:6px;padding:5px 8px;min-width:138px;${canLoad?"":"opacity:0.45"}">
      <div style="color:${kc};font:bold 11px monospace">${mk.name} <span style="color:#444;font-weight:normal">${slotCost}sl each</span></div>
      <div style="color:#555;font:9px monospace;line-height:1.4;margin-bottom:4px">${mk.desc}</div>
      <div style="font:10px monospace;color:${inInv>0?"#888":"#444"};margin-bottom:4px">
        Owned: <span style="color:${inInv>0?"#0af":"#444"}">${inInv}</span> &nbsp; In rack: <span style="color:#fa0">${countInRack(kind,mTier)}</span>
      </div>`;
    if (canLoad) {
      html += `<div style="display:flex;align-items:center;gap:4px">
        <input type="number" id="rqty_${kind}" min="1" max="${actualMax}" value="1"
          style="width:38px;background:#111;border:1px solid #334;color:#eee;font:11px monospace;padding:1px 3px;border-radius:3px;text-align:center"
          oninput="this.value=Math.min(${actualMax},Math.max(1,parseInt(this.value)||1))">
        <button onclick="rackLoad('${kind}',${mTier})"
          style="width:auto;padding:2px 8px;font:bold 11px monospace;background:rgba(0,170,255,0.14);border:1px solid #0af;color:#0af;border-radius:4px;cursor:pointer">Load</button>
      </div>`;
    } else {
      html += `<div style="color:#333;font:9px monospace">${inInv===0?"Buy from Shop first":"No slots available"}</div>`;
    }
    html += `</div>`;
  }
  html += `</div></div></div>`;
  return html;
}

function rackLoad(kind, tier) {
  const sName = playerLoadout.ship||"Starlight";
  const mk = (typeof MISSILE_KINDS!=="undefined"?MISSILE_KINDS[kind]:null)||{slots:1};
  const slotCap = getMissileSlotCap(sName);
  const qtyEl = document.getElementById("rqty_"+kind);
  const qty = Math.max(1, parseInt(qtyEl?.value)||1);
  const avail = availableInInv(kind, tier);
  const free = slotCap - getRackSlotWeight();
  const maxLoad = Math.min(qty, avail, Math.floor((free+0.001)/mk.slots));
  if (maxLoad < 1) return;
  if (!playerLoadout.missileRack) playerLoadout.missileRack = [];
  for (let i=0; i<maxLoad; i++) playerLoadout.missileRack.push({kind, tier});
  if (typeof setPlayerShip==="function") setPlayerShip(sName);
  renderLoadout();
}

function rackRemoveOne(kind, tier) {
  if (!playerLoadout.missileRack) return;
  const idx = playerLoadout.missileRack.findLastIndex(e=>e.kind===kind&&e.tier===tier);
  if (idx >= 0) playerLoadout.missileRack.splice(idx, 1);
  const sName = playerLoadout.ship||"Starlight";
  if (typeof setPlayerShip==="function") setPlayerShip(sName);
  renderLoadout();
}

function rackRemoveAll(kind, tier) {
  if (!playerLoadout.missileRack) return;
  playerLoadout.missileRack = playerLoadout.missileRack.filter(e=>!(e.kind===kind&&e.tier===tier));
  const sName = playerLoadout.ship||"Starlight";
  if (typeof setPlayerShip==="function") setPlayerShip(sName);
  renderLoadout();
}

function clearMissileRack() {
  playerLoadout.missileRack = [];
  const sName = playerLoadout.ship||"Starlight";
  if (typeof setPlayerShip==="function") setPlayerShip(sName);
  renderLoadout();
}

// === NEW UPGRADE SETTERS ===
function setPlayerMissileTier(t)        { if((playerLoadout.ownedMissileTiers||[1]).includes(t)){playerLoadout.missileTier=t; setPlayerShip(currentShipName); renderLoadout();} }
function setPlayerWeaponQualityTier(t)  { if((playerLoadout.ownedWeaponQualityTiers||[1]).includes(t)){playerLoadout.weaponQualityTier=t; setPlayerShip(currentShipName); renderLoadout();} }
function setPlayerTurretTier(t)         { if((playerLoadout.ownedTurretTiers||[1]).includes(t)){playerLoadout.turretTier=t; setPlayerShip(currentShipName); renderLoadout();} }
function buyPlayerMissileTier(t) {
  const sn=playerLoadout.ship||"Starlight";
  const prices=(typeof SHIP_UPGRADE_PRICES!=="undefined"&&SHIP_UPGRADE_PRICES[sn]?.missile)||{2:30000,3:90000};
  const price=prices[t]; if(!price||money<price||(playerLoadout.ownedMissileTiers||[1]).includes(t))return;
  if(t===3&&!(playerLoadout.ownedMissileTiers||[1]).includes(2))return;
  money-=price; if(!playerLoadout.ownedMissileTiers)playerLoadout.ownedMissileTiers=[1];
  playerLoadout.ownedMissileTiers.push(t); playerLoadout.missileTier=t;
  saveShipUpgrades(sn); setPlayerShip(sn); renderLoadout(); updateHUD();
}
function buyPlayerWeaponQualityTier(t) {
  const sn=playerLoadout.ship||"Starlight";
  const prices=(typeof SHIP_UPGRADE_PRICES!=="undefined"&&SHIP_UPGRADE_PRICES[sn]?.weapon)||{2:25000,3:80000};
  const price=prices[t]; if(!price||money<price||(playerLoadout.ownedWeaponQualityTiers||[1]).includes(t))return;
  if(t===3&&!(playerLoadout.ownedWeaponQualityTiers||[1]).includes(2))return;
  money-=price; if(!playerLoadout.ownedWeaponQualityTiers)playerLoadout.ownedWeaponQualityTiers=[1];
  playerLoadout.ownedWeaponQualityTiers.push(t); playerLoadout.weaponQualityTier=t;
  saveShipUpgrades(sn); setPlayerShip(sn); renderLoadout(); updateHUD();
}
function buyPlayerTurretTier(t) {
  const sn=playerLoadout.ship||"Starlight";
  const prices=(typeof SHIP_UPGRADE_PRICES!=="undefined"&&SHIP_UPGRADE_PRICES[sn]?.turret)||{2:30000,3:90000};
  const price=prices[t]; if(!price||money<price||(playerLoadout.ownedTurretTiers||[1]).includes(t))return;
  if(t===3&&!(playerLoadout.ownedTurretTiers||[1]).includes(2))return;
  money-=price; if(!playerLoadout.ownedTurretTiers)playerLoadout.ownedTurretTiers=[1];
  playerLoadout.ownedTurretTiers.push(t); playerLoadout.turretTier=t;
  saveShipUpgrades(sn); setPlayerShip(sn); renderLoadout(); updateHUD();
}
// Ally setters
function setAllyArmorTier(idx,t)        { const sl=playerLoadout.allies[idx];if(!sl||(!(sl.ownedArmorTiers||[1]).includes(t)))return;sl.armorTier=t;renderLoadout(); }
function setAllyEngineTier(idx,t)       { const sl=playerLoadout.allies[idx];if(!sl||(!(sl.ownedEngineTiers||[1]).includes(t)))return;sl.engineTier=t;renderLoadout(); }
function setAllyWeaponQualityTier(idx,t){ const sl=playerLoadout.allies[idx];if(!sl||(!(sl.ownedWeaponQualityTiers||[1]).includes(t)))return;sl.weaponQualityTier=t;renderLoadout(); }
function buyAllyArmor(idx,t)    { const sl=playerLoadout.allies[idx];const p=ARMOR_UPGRADE_PRICES[t];if(!sl||!p||money<p)return;if(t===3&&!(sl.ownedArmorTiers||[1]).includes(2))return;if((sl.ownedArmorTiers||[1]).includes(t))return;money-=p;if(!sl.ownedArmorTiers)sl.ownedArmorTiers=[1];sl.ownedArmorTiers.push(t);sl.armorTier=t;renderLoadout();updateHUD(); }
function buyAllyEngine(idx,t)   { const sl=playerLoadout.allies[idx];const p=ENGINE_UPGRADE_PRICES[t];if(!sl||!p||money<p)return;if(t===3&&!(sl.ownedEngineTiers||[1]).includes(2))return;if((sl.ownedEngineTiers||[1]).includes(t))return;money-=p;if(!sl.ownedEngineTiers)sl.ownedEngineTiers=[1];sl.ownedEngineTiers.push(t);sl.engineTier=t;renderLoadout();updateHUD(); }
function buyAllyWeaponQuality(idx,t) { const sl=playerLoadout.allies[idx];const prices={2:20000,3:65000};const p=prices[t];if(!sl||!p||money<p)return;if(t===3&&!(sl.ownedWeaponQualityTiers||[1]).includes(2))return;if((sl.ownedWeaponQualityTiers||[1]).includes(t))return;money-=p;if(!sl.ownedWeaponQualityTiers)sl.ownedWeaponQualityTiers=[1];sl.ownedWeaponQualityTiers.push(t);sl.weaponQualityTier=t;renderLoadout();updateHUD(); }

function buildWeaponQualitySelect(ownedTiers, curTier, onchangeFn, buyFn) {
  const prices={2:20000,3:65000};
  let html=`<select onchange="${onchangeFn}">`;
  for(let t=1;t<=3;t++){if((ownedTiers||[1]).includes(t)){const wqT=typeof WEAPON_QUALITY_TIERS!=="undefined"?WEAPON_QUALITY_TIERS[t]:{name:"T"+t,damageMult:1+(t-1)*0.5};html+=`<option value="${t}" ${curTier===t?"selected":""}>${wqT.name} (×${wqT.damageMult})</option>`;}}
  html+=`</select>`;
  for(let t=2;t<=3;t++){if(!(ownedTiers||[1]).includes(t)){const prereq=t===3?(ownedTiers||[1]).includes(2):true;const price=prices[t];const canBuy=prereq&&money>=price;const wqT=typeof WEAPON_QUALITY_TIERS!=="undefined"?WEAPON_QUALITY_TIERS[t]:{name:"T"+t};html+=` <button style="width:auto;display:inline-block;font-size:11px;${canBuy?"":"opacity:0.4"}" onclick="${buyFn}(${t})" ${canBuy?"":"disabled"}>Buy ${wqT.name} (${price.toLocaleString()} cr)</button>`;}}
  return html;
}

// === SETTERS ===
function setMissileKind(k) { playerLoadout.missileKind=k; if(typeof setPlayerMissileKind==="function")setPlayerMissileKind(k); renderLoadout(); }
function setMainWeapon(wk)           { playerLoadout.mainWeapon = wk; renderLoadout(); }
function setPDCWeapon(idx, wk)       { if (!playerLoadout.pdcWeapons) playerLoadout.pdcWeapons = []; playerLoadout.pdcWeapons[idx] = wk; renderLoadout(); }
function setPlayerShieldTier(tier)   { if ((playerLoadout.ownedShieldTiers||[1]).includes(tier)) { playerLoadout.shieldTier = tier; renderLoadout(); } }
function setPlayerArmorTier(tier)    { if ((playerLoadout.ownedArmorTiers||[1]).includes(tier))  { playerLoadout.armorTier  = tier; renderLoadout(); } }
function setPlayerEngineTier(tier)   { if ((playerLoadout.ownedEngineTiers||[1]).includes(tier)) { playerLoadout.engineTier = tier; setPlayerShip(currentShipName); renderLoadout(); } }
function setAllyName(idx, name)      { if (!playerLoadout.allies[idx]) return; playerLoadout.allies[idx].name = name.trim()||playerLoadout.allies[idx].ship; renderLoadout(); }
function setAllyBehavior(idx, beh)   { if (!playerLoadout.allies[idx]) return; playerLoadout.allies[idx].behavior = beh; renderLoadout(); }
function assignAllyToSlot(idx, sn)   { if (allyAvailable(sn, idx) <= 0) return; playerLoadout.allies[idx] = { ship:sn, name:`${sn}#${allyPurchaseCount[sn]||1}`, weapon:"builtin", shieldTier:1, ownedShieldTiers:[1], behavior:0 }; renderLoadout(); }
function removeAllyFromSlot(idx)     { playerLoadout.allies[idx] = null; renderLoadout(); }
function setAllyWeapon(idx, wk)      { playerLoadout.allies[idx].weapon = wk; renderLoadout(); }
function setAllyShieldTier(idx,tier) { const s=playerLoadout.allies[idx]; if(!s||(!(s.ownedShieldTiers||[1]).includes(tier)))return; s.shieldTier=tier; renderLoadout(); }

// === BUY ===
function _shipPrice(cat, tier) {
  const sn = playerLoadout.ship||"Starlight";
  return (typeof SHIP_UPGRADE_PRICES!=="undefined"&&SHIP_UPGRADE_PRICES[sn]?.[cat]?.[tier]) ?? null;
}
function buyPlayerShield(tier) {
  const price = _shipPrice("shield",tier)??SHIELD_TIER_PRICES[tier];
  if (!price||money<price||(playerLoadout.ownedShieldTiers||[1]).includes(tier)) return;
  if (tier===3&&!(playerLoadout.ownedShieldTiers||[1]).includes(2)) return;
  money -= price;
  if (!playerLoadout.ownedShieldTiers) playerLoadout.ownedShieldTiers=[1];
  playerLoadout.ownedShieldTiers.push(tier); playerLoadout.shieldTier=tier;
  saveShipUpgrades(currentShipName);
  renderLoadout(); updateHUD();
}
function buyPlayerArmor(tier) {
  const price = _shipPrice("armor",tier)??ARMOR_UPGRADE_PRICES[tier];
  if (!price||money<price||(playerLoadout.ownedArmorTiers||[1]).includes(tier)) return;
  if (tier===3&&!(playerLoadout.ownedArmorTiers||[1]).includes(2)) return;
  money -= price;
  if (!playerLoadout.ownedArmorTiers) playerLoadout.ownedArmorTiers=[1];
  playerLoadout.ownedArmorTiers.push(tier); playerLoadout.armorTier=tier;
  saveShipUpgrades(currentShipName);
  renderLoadout(); updateHUD();
}
function buyPlayerEngine(tier) {
  const price = _shipPrice("engine",tier)??ENGINE_UPGRADE_PRICES[tier];
  if (!price||money<price||(playerLoadout.ownedEngineTiers||[1]).includes(tier)) return;
  if (tier===3&&!(playerLoadout.ownedEngineTiers||[1]).includes(2)) return;
  money -= price;
  if (!playerLoadout.ownedEngineTiers) playerLoadout.ownedEngineTiers=[1];
  playerLoadout.ownedEngineTiers.push(tier); playerLoadout.engineTier=tier;
  saveShipUpgrades(currentShipName);
  setPlayerShip(currentShipName);
  renderLoadout(); updateHUD();
}
function buyAllyShield(idx, tier) {
  const price = SHIELD_TIER_PRICES[tier];
  const slot = playerLoadout.allies[idx];
  if (!slot||!price||money<price) return;
  if (!(slot.ownedShieldTiers||[1]).includes(1)) slot.ownedShieldTiers=[1];
  if (slot.ownedShieldTiers.includes(tier)) return;
  if (tier===3&&!slot.ownedShieldTiers.includes(2)) return;
  money -= price;
  slot.ownedShieldTiers.push(tier); slot.shieldTier=tier;
  renderLoadout(); updateHUD();
}
function _purchaseAlly(shipName) {
  const aDef = ALLY_SHIP_DEFS[shipName];
  if (!aDef || money < aDef.price) return null;
  money -= aDef.price;
  allyInventory[shipName] = (allyInventory[shipName] || 0) + 1;
  allyPurchaseCount[shipName] = (allyPurchaseCount[shipName] || 0) + 1;
  if (!playerLoadout.unlockedAllyShips.includes(shipName))
    playerLoadout.unlockedAllyShips.push(shipName);
  return {
    ship: shipName,
    name: `${shipName}#${allyPurchaseCount[shipName]}`,
    weapon: "builtin",
    shieldTier: 1,
    ownedShieldTiers: [1],
    behavior: 0,
  };
}

function buyAllyShipFromShop(shipName) {
  const slot = _purchaseAlly(shipName);
  if (!slot) return;
  const emptyIdx = playerLoadout.allies.indexOf(null);
  if (emptyIdx !== -1) playerLoadout.allies[emptyIdx] = slot;
  renderShopTab(); updateHUD();
}

function buyAllyShip(shipName, slotIdx) {
  const slot = _purchaseAlly(shipName);
  if (!slot) return;
  playerLoadout.allies[slotIdx] = slot;
  renderLoadout(); updateHUD();
}
