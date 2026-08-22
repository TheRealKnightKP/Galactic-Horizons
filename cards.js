// ============================================================
// ARENA V2 §7/§8 — cards, conditions, death screen, base
// Loaded after game.js. Everything here is additive: if the card
// system is disabled the Arena behaves exactly as before.
// ============================================================

let runMods = {};            // one-run modifiers granted by cards
let runCards = [];           // cards taken this run, for the death screen
let cardPending = false;
let nextCondition = null;    // condition for the NEXT special card
let conditionProgress = { affixKills: 0, tookCoverDamage: false, faceHitZero: false, waveStartFrame: 0 };
let baseLevels = {};         // persistent, saved with the account

// ── base ──────────────────────────────────────────────────────
function baseLevel(k) { return baseLevels[k] || 0; }
function loadBase() {
  try { baseLevels = JSON.parse(localStorage.getItem("gh_base") || "{}"); } catch (e) { baseLevels = {}; }
}
function saveBase() {
  try { localStorage.setItem("gh_base", JSON.stringify(baseLevels)); } catch (e) {}
}
function baseUpgradeCost(k) {
  const b = BASE_BUILDINGS[k]; if (!b) return null;
  const lv = baseLevel(k); if (lv >= b.max) return null;
  return b.cost[lv];
}
function buyBaseUpgrade(k) {
  const cost = baseUpgradeCost(k);
  if (cost === null || money < cost) return false;
  money -= cost; baseLevels[k] = baseLevel(k) + 1; saveBase();
  if (typeof saveGame === "function") saveGame();
  if (typeof renderBasePanel === "function") renderBasePanel();
  return true;
}
loadBase();

// ── card option count / rerolls come from the base ─────────────
function cardOptionCount() { return Math.min(6, CARD_OPTIONS + baseLevel("supply")); }
function cardRerollsPerRun() { return baseLevel("comms") >= 3 ? 1 : 0; }

// ── condition tracking ────────────────────────────────────────
function pickNextCondition() {
  nextCondition = CARD_CONDITIONS[Math.floor(Math.random() * CARD_CONDITIONS.length)];
  return nextCondition;
}
function resetConditionProgress() {
  conditionProgress = { affixKills: 0, tookCoverDamage: false, faceHitZero: false, waveStartFrame: Date.now() };
}
function noteAffixKill() { conditionProgress.affixKills++; }
function noteFaceZero() { conditionProgress.faceHitZero = true; }
function noteCoverDamage() { conditionProgress.tookCoverDamage = true; }

function conditionMet(cond) {
  if (!cond) return false;
  const secs = (Date.now() - (conditionProgress.waveStartFrame || Date.now())) / 1000;
  switch (cond.id) {
    case "fast":      return secs < 25;
    case "reinforce": return secs >= 25;                       // you waited them out
    case "flawless":  return !conditionProgress.faceHitZero;
    case "affix":     return conditionProgress.affixKills >= 3;
    case "redline":   return (player.heat || 0) >= HEAT_REDLINE_START;
    case "nocover":   return !conditionProgress.tookCoverDamage;
  }
  return false;
}

// ── card generation (Chunk 4) ─────────────────────────────────
let runDeck = [];            // cards held this run (cap CARD_CAP)
let runWeapons = [];         // weapon inventory, cap WEAPON_INV_CAP
let pityCounter = 0;

function isCardWave(wave) {
  if (wave < CARD_START_WAVE) return false;
  if (wave % CARD_SPECIAL_EVERY === 0) return true;
  return (wave - CARD_START_WAVE) % CARD_EVERY === 0;
}
function isSpecialWave(wave) { return wave >= CARD_START_WAVE && wave % CARD_SPECIAL_EVERY === 0; }

function heldArchetypes() {
  const set = {};
  for (const c of runDeck) if (c.arch) set[c.arch] = true;
  return set;
}
function availableFusions() {
  const held = heldArchetypes();
  const have = new Set(runDeck.map(c => c.id));
  return CARD_FUSIONS.filter(f => !have.has(f.id) && f.req.every(a => held[a]));
}
function rollRarity() {
  if (pityCounter >= CARD_PITY_LIMIT) return "rare";
  const r = Math.random() * 100;
  if (r < CARD_RARITY_WEIGHTS.epic) return "epic";
  if (r < CARD_RARITY_WEIGHTS.epic + CARD_RARITY_WEIGHTS.rare) return "rare";
  return "common";
}
// Infinite mode scales card EFFECT, never grants flat stats.
function infiniteScale() {
  if (!infiniteMode) return 1;
  return Math.min(INF_CARD_SCALE_CAP, 1 + Math.floor(currentWave / 10) * INF_CARD_SCALE_PER_10);
}

function rollCards(wave) {
  const n = cardOptionCount();
  const have = new Set(runDeck.map(c => c.id));
  const out = [];

  // fusion offer, if prerequisites are met
  const fus = availableFusions();
  if (fus.length && Math.random() < (isSpecialWave(wave) ? FUSION_OFFER_CHANCE * 1.7 : FUSION_OFFER_CHANCE)) {
    const f = fus[Math.floor(Math.random() * fus.length)];
    out.push({ ...f, rarity: "fusion", kind: "mod", arch: null, isFusion: true });
  }

  // bias toward archetypes already held, so builds converge instead of scattering
  const held = heldArchetypes();
  const heldKeys = Object.keys(held);
  let pool = CARD_LIBRARY.filter(c => !have.has(c.id));
  const biased = heldKeys.length ? pool.filter(c => held[c.arch]) : [];

  let gotRare = false;
  while (out.length < n && pool.length) {
    const want = rollRarity();
    let src = (biased.length && Math.random() < 0.55) ? biased : pool;
    let cands = src.filter(c => c.rarity === want);
    if (!cands.length) cands = src.length ? src : pool;
    if (!cands.length) break;
    const pick = cands[Math.floor(Math.random() * cands.length)];
    if (pick.rarity !== "common") gotRare = true;
    out.push(pick);
    pool = pool.filter(c => c.id !== pick.id);
    const bi = biased.indexOf(pick); if (bi >= 0) biased.splice(bi, 1);
  }
  pityCounter = gotRare ? 0 : pityCounter + 1;
  return out;
}

function cardEffectScale(card) {
  return (CARD_RARITY_SCALE[card.rarity] || 1) * infiniteScale();
}

// ── applying a card ───────────────────────────────────────────
function applyCard(card) {
  if (!card) return;
  runCards.push(card.name);
  if (card.kind === "ship") {
    if (!ownedShips.includes(card.value)) ownedShips.push(card.value);
    setPlayerShip(card.value); currentShipName = card.value;
    return;
  }
  if (card.kind === "weapon") {
    if (runWeapons.length < WEAPON_INV_CAP) runWeapons.push(card.value);
    playerLoadout.weaponType = card.value;
    setPlayerShip(currentShipName);
    return;
  }
  if (card.kind === "heal") {
    if (card.value === "hull") player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.4);
    return;
  }
  // mods stack; magnitude scales with rarity and (in infinite) with depth
  runDeck.push(card);
  runMods[card.mod] = (runMods[card.mod] || 0) + cardEffectScale(card);
  if (typeof onCardApplied === "function") onCardApplied(card);
}

// Cap enforcement: taking a 9th card means giving one up. That single rule is
// what turns "is this good?" into "is this better than what I would lose?".
function needsDiscard() { return runDeck.length > CARD_CAP; }
function discardCard(idx) {
  const c = runDeck[idx];
  if (!c) return;
  runDeck.splice(idx, 1);
  if (c.mod) { runMods[c.mod] -= cardEffectScale(c); if (runMods[c.mod] <= 0.001) delete runMods[c.mod]; }
}
function modLevel(k) { return runMods[k] || 0; }

// ── card UI ───────────────────────────────────────────────────
function showCardScreen(wave) {
  const cards = rollCards(wave);
  if (!cards.length) { cardPending = false; return; }
  cardPending = true;
  let el = document.getElementById("cardOverlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "cardOverlay";
    el.style.cssText = "position:fixed;inset:0;background:rgba(0,8,16,0.94);z-index:1200;display:flex;" +
      "flex-direction:column;align-items:center;justify-content:center;padding:14px;overflow-y:auto";
    document.body.appendChild(el);
  }
  const special = isSpecialWave(wave);
  const met = special && nextCondition && conditionMet(nextCondition);
  const RC = { common:"#8899aa", rare:"#3399ff", epic:"#cc66ff", fusion:"#ffcc44" };

  let html = '<div style="font:bold 19px monospace;color:#0af">' + (special ? "SPECIAL SALVAGE" : "SALVAGE") + '</div>' +
    '<div style="font:11px monospace;color:#888;margin-bottom:10px">Wave ' + wave +
    ' &middot; deck ' + runDeck.length + '/' + CARD_CAP + (infiniteMode ? ' &middot; scale ' + infiniteScale().toFixed(2) + 'x' : '') + '</div>';
  if (special) {
    html += '<div style="font:11px monospace;color:' + (met ? "#4f9" : "#f66") + ';margin-bottom:10px">' +
      (met ? "&#10003; " : "&#10007; ") + (nextCondition ? nextCondition.label : "") + '</div>';
  }
  html += '<div style="display:flex;flex-wrap:wrap;gap:9px;justify-content:center;max-width:780px">';
  cards.forEach((c, i2) => {
    const col = RC[c.rarity] || "#889";
    const a = c.arch && ARCHETYPES[c.arch];
    html += '<div data-card="' + i2 + '" style="cursor:pointer;width:184px;padding:11px;border-radius:9px;' +
      'border:2px solid ' + col + ';background:rgba(255,255,255,0.04)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">' +
      '<span style="font:bold 12px monospace;color:' + col + '">' + c.name + '</span>' +
      '<span style="font:9px monospace;color:' + col + ';opacity:.8">' + (c.rarity||"").toUpperCase() + '</span></div>' +
      (a ? '<div style="font:9px monospace;color:' + a.color + ';margin-bottom:5px">' + a.name.toUpperCase() +
           (c.role ? ' &middot; ' + c.role : '') + '</div>' : '') +
      '<div style="font:11px monospace;color:#9ab;line-height:1.45">' + c.desc + '</div></div>';
  });
  html += '<div data-card="skip" style="cursor:pointer;width:184px;padding:11px;border-radius:9px;' +
    'border:2px dashed #444;background:rgba(255,255,255,0.02)">' +
    '<div style="font:bold 12px monospace;color:#ccc;margin-bottom:5px">Keep what I have</div>' +
    '<div style="font:11px monospace;color:#888;line-height:1.45">+' + Math.round(CARD_SKIP_BONUS*100) +
    '% credits from this wave.</div></div></div>';

  // show what you are building toward
  const fus = availableFusions();
  if (fus.length) {
    html += '<div style="margin-top:12px;font:10px monospace;color:#ffcc44">Fusion available: ' +
      fus.map(f => f.name).join(", ") + '</div>';
  } else {
    const held = Object.keys(heldArchetypes());
    const near = CARD_FUSIONS.filter(f => f.req.some(a => held.includes(a)));
    if (near.length) html += '<div style="margin-top:12px;font:10px monospace;color:#665">Locked: ' +
      near.slice(0,3).map(f => f.name + ' (needs ' + f.req.filter(a=>!held.includes(a)).map(a=>ARCHETYPES[a].name).join("+") + ')').join(" &middot; ") + '</div>';
  }

  const nextSpecial = Math.ceil((wave + 1) / CARD_SPECIAL_EVERY) * CARD_SPECIAL_EVERY;
  pickNextCondition();
  html += '<div style="margin-top:12px;font:11px monospace;color:#7a8;text-align:center;max-width:520px">' +
    'Next special (wave ' + nextSpecial + '): <span style="color:#ffcc55">' + nextCondition.label + '</span></div>';
  el.innerHTML = html;
  el.style.display = "flex";

  el.querySelectorAll("[data-card]").forEach(node => {
    node.onclick = () => {
      const k = node.getAttribute("data-card");
      if (k === "skip") {
        const bonus = Math.round((window.waveCreditsEarned || 0) * CARD_SKIP_BONUS);
        money += bonus; window.recordCreditsEarned?.(bonus);
        runCards.push("(skipped)");
      } else {
        applyCard(cards[parseInt(k, 10)]);
      }
      if (needsDiscard()) { showDiscardScreen(el); return; }
      el.style.display = "none"; cardPending = false; resetConditionProgress();
    };
  });
}

function showDiscardScreen(el) {
  const RC = { common:"#8899aa", rare:"#3399ff", epic:"#cc66ff", fusion:"#ffcc44" };
  let html = '<div style="font:bold 18px monospace;color:#f95">DECK FULL</div>' +
    '<div style="font:11px monospace;color:#888;margin-bottom:12px">Hold ' + CARD_CAP +
    '. Give one up.</div><div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:780px">';
  runDeck.forEach((c, i) => {
    const col = RC[c.rarity] || "#889";
    const a = c.arch && ARCHETYPES[c.arch];
    html += '<div data-drop="' + i + '" style="cursor:pointer;width:170px;padding:9px;border-radius:8px;' +
      'border:2px solid ' + col + ';background:rgba(255,255,255,0.03)">' +
      '<div style="font:bold 11px monospace;color:' + col + '">' + c.name + '</div>' +
      (a ? '<div style="font:9px monospace;color:' + a.color + '">' + a.name.toUpperCase() + '</div>' : '') +
      '<div style="font:10px monospace;color:#9ab;margin-top:4px;line-height:1.4">' + c.desc + '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
  el.querySelectorAll("[data-drop]").forEach(n => {
    n.onclick = () => {
      discardCard(parseInt(n.getAttribute("data-drop"), 10));
      el.style.display = "none"; cardPending = false; resetConditionProgress();
    };
  });
}

// ── death screen ──────────────────────────────────────────────
function showDeathReport(info) {
  let el = document.getElementById("deathReport");
  if (!el) {
    el = document.createElement("div");
    el.id = "deathReport";
    el.style.cssText = "position:fixed;inset:0;background:rgba(10,0,0,0.93);z-index:1250;display:flex;" +
      "flex-direction:column;align-items:center;justify-content:center;padding:20px";
    document.body.appendChild(el);
  }
  const faceDown = [];
  if (player.shieldFaces) for (const f of ["front", "back", "left", "right"])
    if (player.shieldFaces[f] <= 0) faceDown.push(f);
  const heat = Math.round(player.heat || 0);
  const rows = [
    ["Wave reached", String(currentWave)],
    ["Hull", currentShipName],
    ["Killed by", info && info.killer ? info.killer : "unknown"],
    ["Shield faces down", faceDown.length ? faceDown.join(", ") : "none"],
    ["Weapon heat", heat + (heat >= HEAT_REDLINE_START ? " (redline)" : "")],
    ["Ammo", (player.magMax > 0 ? player.mag + "/" + player.magMax : "n/a")],
    ["Cards taken", runCards.length ? runCards.join(", ") : "none"],
  ];
  const carry = carryoverFor();
  let html = '<div style="font:bold 24px monospace;color:#f55;margin-bottom:6px">HULL LOST</div>' +
    '<div style="font:12px monospace;color:#888;margin-bottom:16px">This is what got you.</div>' +
    '<div style="display:flex;flex-direction:column;gap:6px;min-width:280px;max-width:460px">';
  for (const [k, v] of rows) {
    html += '<div style="display:flex;justify-content:space-between;gap:14px;font:12px monospace;' +
      'border-bottom:1px solid #311;padding-bottom:4px">' +
      '<span style="color:#977">' + k + '</span><span style="color:#eee;text-align:right">' + v + '</span></div>';
  }
  html += '</div><div style="margin-top:16px;font:12px monospace;color:#7a8">Carried to base: ' +
    carry.toLocaleString() + ' credits</div>' +
    '<button id="dr_close" style="margin-top:20px;padding:10px 30px;font:bold 14px monospace;' +
    'background:rgba(255,80,80,0.14);border:2px solid #f55;color:#f77;border-radius:8px;cursor:pointer">Continue</button>';
  el.innerHTML = html;
  el.style.display = "flex";
  el.querySelector("#dr_close").onclick = () => {
    el.style.display = "none";
    applyCarryover();
    runCards = []; runMods = {};
  };
}

function resetRunState(){
  runDeck = []; runWeapons = []; runMods = {}; runCards = []; pityCounter = 0;
}

function carryoverFor() {
  if (currentWave < CARRYOVER_MIN_WAVE) return 0;
  return Math.min(CARRYOVER_CAP, Math.round((window.runCreditsEarned || money || 0) * CARRYOVER_FRAC));
}
function applyCarryover() {
  const c = carryoverFor();
  if (c > 0) { money += c; if (typeof saveGame === "function") saveGame(); }
}

// ── base panel ────────────────────────────────────────────────
function renderBasePanel() {
  const container = document.getElementById("baseBody");
  if (!container) return;
  let html = '<div style="font:11px monospace;color:#888;margin-bottom:12px;line-height:1.6">' +
    'The base grants <b style="color:#ccc">information and options</b>, never raw power. ' +
    'A run is won by flying well, not by farming.</div>';
  for (const [k, b] of Object.entries(BASE_BUILDINGS)) {
    const lv = baseLevel(k), cost = baseUpgradeCost(k), maxed = lv >= b.max;
    html += '<div style="padding:10px 12px;margin-bottom:8px;border-radius:8px;border:2px solid #234;' +
      'background:rgba(0,120,200,0.06)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<span style="font:bold 13px monospace;color:#0af">' + b.name + '</span>' +
      '<span style="font:11px monospace;color:#8ab">Lv ' + lv + ' / ' + b.max + '</span></div>' +
      '<div style="font:11px monospace;color:#89a;margin:5px 0 8px;line-height:1.5">' + b.desc + '</div>' +
      (maxed
        ? '<div style="font:11px monospace;color:#4f9">MAX</div>'
        : '<button data-base="' + k + '" style="padding:6px 14px;font:bold 11px monospace;' +
          'background:' + (money >= cost ? 'rgba(0,170,255,0.16)' : 'rgba(90,90,90,0.14)') + ';' +
          'border:2px solid ' + (money >= cost ? '#0af' : '#555') + ';color:' + (money >= cost ? '#0af' : '#777') + ';' +
          'border-radius:6px;cursor:pointer">Upgrade &mdash; ' + cost.toLocaleString() + '</button>') +
      '</div>';
  }
  container.innerHTML = html;
  container.querySelectorAll("[data-base]").forEach(n => {
    n.onclick = () => buyBaseUpgrade(n.getAttribute("data-base"));
  });
}
function openBasePanel() {
  let el = document.getElementById("basePanel");
  if (!el) {
    el = document.createElement("div");
    el.id = "basePanel"; el.className = "menu";
    el.style.cssText = "display:none;min-width:420px";
    el.innerHTML = '<h2>Base</h2><div id="baseBody"></div>' +
      '<button onclick="document.getElementById(\'basePanel\').style.display=\'none\';' +
      'document.getElementById(\'topMenu\').style.display=\'block\'">&larr; Back</button>';
    document.body.appendChild(el);
  }
  document.getElementById("topMenu").style.display = "none";
  el.style.display = "block";
  renderBasePanel();
}
