// shop.js

let weaponInventory = {};

const WEAPON_BASE_PRICES = {
  laser_repeater: 800, laser_cannon: 2500, ballistic_gatling: 1800,
  ballistic_cannon: 3500, ballistic_railgun: 7000,
  scattergun_ballistic: 2200, scattergun_laser: 2200, distortion: 2000,
};
function wKey(type, size)   { return `${type}_s${size}`; }
function wPrice(type, size) { return Math.round((WEAPON_BASE_PRICES[type] || 2000) * Math.pow(1.9, size - 1)); }
function wOwned(wk)         { return weaponInventory[wk] || 0; }

function wEquipped(wk) {
  if (!wk || wk === "builtin") return 0;
  let n = 0;
  if (playerLoadout.mainWeapon === wk) n++;
  (playerLoadout.pdcWeapons || []).forEach(w => { if (w === wk) n++; });
  playerLoadout.allies.forEach(a => { if (a.weapon === wk) n++; });
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
document.addEventListener("keydown", e => {
  if (e.code === KONAMI[konamiProgress]) {
    konamiProgress++;
    if (konamiProgress === KONAMI.length) {
      konamiProgress = 0;
      if (!cometUnlocked) {
        cometUnlocked = true;
        if (!ownedShips.includes("Comet")) ownedShips.push("Comet");
        // Flash message
        const msg = document.createElement("div");
        msg.textContent = "🌠 SECRET SHIP UNLOCKED: COMET";
        msg.style.cssText = "position:fixed;top:40%;left:50%;transform:translateX(-50%);background:#111;color:#ff4400;font:bold 28px monospace;padding:18px 36px;border:2px solid #ff4400;z-index:9999;border-radius:8px;pointer-events:none";
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
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
  allies: [
    { ship: "Sprite", weapon: "builtin", shieldTier: 1, ownedShieldTiers: [1] },
    { ship: "Sprite", weapon: "builtin", shieldTier: 1, ownedShieldTiers: [1] },
  ],
  unlockedAllyShips: ["Sprite"],
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
}

// Ally inventory - how many of each ship you own
let allyInventory = { Sprite: 2 };
function allyOwned(name)     { return allyInventory[name] || 0; }
function allyEquipped(name)  { return playerLoadout.allies.filter(a=>a.ship===name).length; }
function allyAvailable(name, excludeIdx=-1) {
  const equipped = playerLoadout.allies.filter((a,i)=>a.ship===name&&i!==excludeIdx).length;
  return allyOwned(name) - equipped;
}

let _shopTab    = "ships";
let _loadoutTab = "ship";

// ============================
// SHIP SHOP
// ============================
function showShop() {
  _shopTab = "ships";
  document.getElementById("shopMenu").style.display = "block";
  document.getElementById("shopMoney").textContent = "Credits: " + money;
  const backBtn = document.getElementById("shopBackBtn");
  if(backBtn) backBtn.style.display = shopOpenedFromMenu ? "block" : "none";
  renderShopTab();
}

function setShopTab(tab) { _shopTab = tab; renderShopTab(); }

function renderShopTab() {
  const s = document.getElementById("shopTabShips");
  const w = document.getElementById("shopTabWeapons");
  if (s) s.style.borderBottom = _shopTab === "ships"   ? "2px solid #0af" : "none";
  if (w) w.style.borderBottom = _shopTab === "weapons" ? "2px solid #0af" : "none";
  const body = document.getElementById("shopBody");
  if (!body) return;
  if (_shopTab === "ships") renderShopShips(body);
  else renderShopWeapons(body);
}

function renderShopShips(container) {
  let html = `<div style="display:flex;flex-wrap:wrap;gap:12px;padding:8px">`;
  for (const [name, ship] of Object.entries(SHIPS)) {
    // Hide secret ships unless unlocked
    if (ship.secret && !cometUnlocked) continue;
    const canAfford = ship.price !== null && money >= ship.price;
    const owned = ownedShips && ownedShips.includes(name);
    const desc  = SHIP_DESCRIPTIONS[name] || "";
    const tier  = ship.armorType;
    const tierColor = {light:"#88ccff",medium:"#88ff88",heavy:"#ffcc44",subcapital:"#ff8844",capital:"#ff44ff"}[tier] || "#fff";
    html += `
    <div style="background:#0a0e1a;border:1px solid #223;border-radius:8px;width:200px;padding:0;overflow:hidden;position:relative">
      <!-- Ship image square -->
      <div style="position:relative;width:200px;height:120px;background:#050810;display:flex;align-items:center;justify-content:center;overflow:hidden">
        <img src="assets/${ship.image}" style="max-width:180px;max-height:110px;object-fit:contain;image-rendering:pixelated"
             onerror="this.style.display='none'">
        <!-- Info icon top-right -->
        <div style="position:absolute;top:6px;right:6px;cursor:pointer;z-index:2"
             onclick="toggleShipInfo('${name}')">
          <div style="width:22px;height:22px;border-radius:50%;background:#0af;color:#000;font:bold 13px monospace;display:flex;align-items:center;justify-content:center">i</div>
        </div>
        <!-- Secret badge -->
        ${ship.secret ? `<div style="position:absolute;top:6px;left:6px;background:#ff4400;color:#fff;font:bold 10px monospace;padding:2px 6px;border-radius:4px">SECRET</div>` : ""}
        <!-- Info overlay (hidden by default) -->
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
      <!-- Ship name + price -->
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

function renderShopWeapons(container) {
  const maxSize = 8;
  let html = `<p style="color:#aaa;font-size:12px;margin:4px 0">Each purchase is one weapon unit.</p>
  <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
    <tr style="color:#0af"><th style="text-align:left;padding:4px 6px">Weapon</th>`;
  for (let s = 1; s <= maxSize; s++) html += `<th style="padding:4px">S${s}</th>`;
  html += `</tr>`;
  for (const [type, def] of Object.entries(WEAPON_DEFS)) {
    html += `<tr style="border-top:1px solid #223"><td style="padding:4px 6px;white-space:nowrap">
      <b style="color:#eee">${def.name}</b><br><span style="color:#888;font-size:11px">${def.category}</span>
    </td>`;
    for (let s = 1; s <= maxSize; s++) {
      const price = wPrice(type, s);
      const k = wKey(type, s);
      const owned = wOwned(k);
      const canAfford = money >= price;
      const priceStr = price >= 1000000 ? (price/1000000).toFixed(1)+"M" : price >= 1000 ? Math.round(price/1000)+"k" : price;
      html += `<td style="padding:2px 4px;text-align:center;min-width:52px">
        <div style="color:#888;font-size:10px">${priceStr}</div>
        <div style="color:#0af;font-size:11px;font-weight:bold">×${owned}</div>
        <button style="width:auto;padding:1px 5px;font-size:11px;${canAfford?"":"opacity:0.4"}"
          onclick="buyWeapon('${type}',${s})" ${canAfford?"":"disabled"}>+1</button>
      </td>`;
    }
    html += `</tr>`;
  }
  html += `</table></div>`;
  container.innerHTML = html;
}

function buyWeapon(type, size) {
  const price = wPrice(type, size);
  if (money < price) return;
  money -= price;
  const k = wKey(type, size);
  weaponInventory[k] = (weaponInventory[k] || 0) + 1;
  renderShopTab();
  updateHUD();
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
    playerLoadout.allies.push({ ship: "Sprite", weapon: "builtin", shieldTier: 1, ownedShieldTiers: [1] });
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

function renderLoadout() {
  document.getElementById("loadoutMoney").textContent = "Credits: " + money;
  document.getElementById("tabShip").style.borderBottom   = _loadoutTab === "ship"   ? "2px solid #0af" : "none";
  document.getElementById("tabAllies").style.borderBottom = _loadoutTab === "allies" ? "2px solid #0af" : "none";
  const sp = document.getElementById("loadoutShipPanel");
  const ap = document.getElementById("loadoutAlliesPanel");
  if (_loadoutTab === "ship") {
    sp.style.display = "block"; ap.style.display = "none";
    renderShipLoadoutPanel(sp);
  } else {
    sp.style.display = "none"; ap.style.display = "block";
    renderAllyLoadoutPanel(ap);
  }
}

function buildWeaponSelect(slotSize, currentWk, onchangeFn) {
  let html = `<select onchange="${onchangeFn}">`;
  html += `<option value="builtin" ${!currentWk||currentWk==="builtin"?"selected":""}>Built-in</option>`;
  for (const [type, def] of Object.entries(WEAPON_DEFS)) {
    const k = wKey(type, slotSize);
    const owned = wOwned(k);
    if (owned > 0 && wCanEquip(k, currentWk))
      html += `<option value="${k}" ${currentWk===k?"selected":""}>${def.name} (×${owned})</option>`;
  }
  html += `</select>`;
  return html;
}

function buildShieldSelect(ownedTiers, currentTier, onchangeFn, buyFn, shipShields) {
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
      const price = SHIELD_TIER_PRICES[t];
      const canBuy = prereq && money >= price;
      html += ` <button style="width:auto;display:inline-block;font-size:11px;${canBuy?"":"opacity:0.4"}" onclick="${buyFn}(${t})" ${canBuy?"":"disabled"}>Buy ${SHIELD_TIERS[t].name} (${price.toLocaleString()} cr)</button>`;
    }
  }
  return html;
}

function buildArmorSelect(ownedTiers, currentTier, onchangeFn, buyFn, baseArmor) {
  let html = `<select onchange="${onchangeFn}">`;
  for (let t = 1; t <= 3; t++) {
    if ((ownedTiers||[1]).includes(t))
      html += `<option value="${t}" ${currentTier===t?"selected":""}>${ARMOR_UPGRADE_TIERS[t].name} (${Math.round(baseArmor*ARMOR_UPGRADE_TIERS[t].mult)})</option>`;
  }
  html += `</select>`;
  for (let t = 2; t <= 3; t++) {
    if (!(ownedTiers||[1]).includes(t)) {
      const prereq = t === 3 ? (ownedTiers||[1]).includes(2) : true;
      const price = ARMOR_UPGRADE_PRICES[t];
      const canBuy = prereq && money >= price;
      html += ` <button style="width:auto;display:inline-block;font-size:11px;${canBuy?"":"opacity:0.4"}" onclick="${buyFn}(${t})" ${canBuy?"":"disabled"}>Buy ${ARMOR_UPGRADE_TIERS[t].name} (${price.toLocaleString()} cr)</button>`;
    }
  }
  return html;
}

function buildEngineSelect(ownedTiers, currentTier, onchangeFn, buyFn) {
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
      const price = ENGINE_UPGRADE_PRICES[t];
      const canBuy = prereq && money >= price;
      const tier = ENGINE_UPGRADE_TIERS[t];
      html += ` <button style="width:auto;display:inline-block;font-size:11px;${canBuy?"":"opacity:0.4"}" onclick="${buyFn}(${t})" ${canBuy?"":"disabled"}>Buy ${tier.name} (${price.toLocaleString()} cr)</button>`;
    }
  }
  // Show stats of current tier
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

  html += `<p><b>Shields:</b> ${buildShieldSelect(playerLoadout.ownedShieldTiers, playerLoadout.shieldTier, "setPlayerShieldTier(parseInt(this.value))", "buyPlayerShield", sd.shields)}</p>`;
  html += `<p><b>Hull Armor:</b> ${buildArmorSelect(playerLoadout.ownedArmorTiers, playerLoadout.armorTier, "setPlayerArmorTier(parseInt(this.value))", "buyPlayerArmor", sd.armor)}</p>`;
  html += `<p><b>Engines:</b> ${buildEngineSelect(playerLoadout.ownedEngineTiers, playerLoadout.engineTier, "setPlayerEngineTier(parseInt(this.value))", "buyPlayerEngine")}</p>`;

  container.innerHTML = html;
}

function renderAllyLoadoutPanel(container) {
  ensureAllySlots();
  const sd = SHIPS[playerLoadout.ship || "Starlight"];
  const totalSlots = 2 + (sd.extraAllySlots || 0);
  let html = `<p style="color:#aaa;margin:4px 0">Ally slots: ${totalSlots}</p>`;
  for (let i = 0; i < totalSlots; i++) {
    const slot = playerLoadout.allies[i] || { ship: "Sprite", weapon: "builtin", shieldTier: 1, ownedShieldTiers: [1] };
    const aDef = ALLY_SHIP_DEFS[slot.ship] || ALLY_SHIP_DEFS.Sprite;
    html += `<div class="ally-slot"><b>Slot ${i+1}</b><br>`;
    html += `Ship: <select onchange="setAllyShip(${i},this.value)">`;
    for (const sn of ALLY_SHIP_ORDER) {
      if (!playerLoadout.unlockedAllyShips.includes(sn)) continue;
      const avail = allyAvailable(sn, i);
      const isCurrent = slot.ship === sn;
      if (avail <= 0 && !isCurrent) continue;
      html += `<option value="${sn}" ${isCurrent?"selected":""}>${sn} (×${allyOwned(sn)} owned, ${avail+(isCurrent?1:0)} avail)</option>`;
    }
    html += `</select>`;
    const curIdx = ALLY_SHIP_ORDER.indexOf(slot.ship);
    const nextShip = ALLY_SHIP_ORDER[curIdx + 1];
    if (nextShip) {
      const cost = ALLY_SHIP_DEFS[nextShip].price;
      const canBuy = money >= cost;
      const owned = allyOwned(nextShip);
      html += ` <button style="width:auto;display:inline-block;font-size:11px;${canBuy?"":"opacity:0.4"}" onclick="buyAllyShip('${nextShip}',${i})" ${canBuy?"":"disabled"}>Buy ${nextShip} ×${owned+1} (${cost.toLocaleString()} cr)</button>`;
    }
    html += `<br>Weapon (S${aDef.weaponSize}): ${buildWeaponSelect(aDef.weaponSize, slot.weapon, `setAllyWeapon(${i},this.value)`)}<br>`;
    html += `Shield: ${buildShieldSelect(slot.ownedShieldTiers||[1], slot.shieldTier||1, `setAllyShieldTier(${i},parseInt(this.value))`, `buyAllyShield_${i}`, aDef.shields)}`;
    html += `</div>`;
  }
  container.innerHTML = html;
  for (let i = 0; i < totalSlots; i++) window[`buyAllyShield_${i}`] = (tier) => buyAllyShield(i, tier);
}

// === SETTERS ===
function setMainWeapon(wk)           { playerLoadout.mainWeapon = wk; renderLoadout(); }
function setPDCWeapon(idx, wk)       { if (!playerLoadout.pdcWeapons) playerLoadout.pdcWeapons = []; playerLoadout.pdcWeapons[idx] = wk; renderLoadout(); }
function setPlayerShieldTier(tier)   { if ((playerLoadout.ownedShieldTiers||[1]).includes(tier)) { playerLoadout.shieldTier = tier; renderLoadout(); } }
function setPlayerArmorTier(tier)    { if ((playerLoadout.ownedArmorTiers||[1]).includes(tier))  { playerLoadout.armorTier  = tier; renderLoadout(); } }
function setPlayerEngineTier(tier)   { if ((playerLoadout.ownedEngineTiers||[1]).includes(tier)) { playerLoadout.engineTier = tier; setPlayerShip(currentShipName); renderLoadout(); } }
function setAllyShip(idx, name)      { if (!playerLoadout.unlockedAllyShips.includes(name)) return; if (allyAvailable(name, idx) <= 0) return; playerLoadout.allies[idx].ship = name; playerLoadout.allies[idx].weapon = "builtin"; renderLoadout(); }
function setAllyWeapon(idx, wk)      { playerLoadout.allies[idx].weapon = wk; renderLoadout(); }
function setAllyShieldTier(idx,tier) { const s=playerLoadout.allies[idx]; if(!s||(!(s.ownedShieldTiers||[1]).includes(tier)))return; s.shieldTier=tier; renderLoadout(); }

// === BUY ===
function buyPlayerShield(tier) {
  const price = SHIELD_TIER_PRICES[tier];
  if (!price||money<price||(playerLoadout.ownedShieldTiers||[1]).includes(tier)) return;
  if (tier===3&&!(playerLoadout.ownedShieldTiers||[1]).includes(2)) return;
  money -= price;
  if (!playerLoadout.ownedShieldTiers) playerLoadout.ownedShieldTiers=[1];
  playerLoadout.ownedShieldTiers.push(tier); playerLoadout.shieldTier=tier;
  saveShipUpgrades(currentShipName);
  renderLoadout(); updateHUD();
}
function buyPlayerArmor(tier) {
  const price = ARMOR_UPGRADE_PRICES[tier];
  if (!price||money<price||(playerLoadout.ownedArmorTiers||[1]).includes(tier)) return;
  if (tier===3&&!(playerLoadout.ownedArmorTiers||[1]).includes(2)) return;
  money -= price;
  if (!playerLoadout.ownedArmorTiers) playerLoadout.ownedArmorTiers=[1];
  playerLoadout.ownedArmorTiers.push(tier); playerLoadout.armorTier=tier;
  saveShipUpgrades(currentShipName);
  renderLoadout(); updateHUD();
}
function buyPlayerEngine(tier) {
  const price = ENGINE_UPGRADE_PRICES[tier];
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
function buyAllyShip(shipName, slotIdx) {
  const aDef = ALLY_SHIP_DEFS[shipName];
  if (!aDef || money < aDef.price) return;
  money -= aDef.price;
  allyInventory[shipName] = (allyInventory[shipName] || 0) + 1;
  if (!playerLoadout.unlockedAllyShips.includes(shipName))
    playerLoadout.unlockedAllyShips.push(shipName);
  if (allyAvailable(shipName, slotIdx) > 0) {
    playerLoadout.allies[slotIdx].ship = shipName;
    playerLoadout.allies[slotIdx].weapon = "builtin";
  }
  renderLoadout(); updateHUD();
}
