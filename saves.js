// saves.js — Arena Evolution V1.6.0
// Local save/load, account system, leaderboard (Cloudflare Workers)

const SAVE_VERSION    = "1.6.0";
const LEADERBOARD_URL = "https://galactic-horizons.workers.dev"; // set after deploy
const ADMIN_USER      = "TheRealKnightAdmin";
const ADMIN_PASS      = "650392026";
const ADMIN_SAVE = {
  username: ADMIN_USER,
  money: 50000000,
  ownedShips: ["Starlight","Falcon","Rouge","Marauder","Wasp","Supernova","Comet","Vengeance",
               "Retribution","Bulwark","Tempest","Nemesis","Prometheus","Leviathan","Dominion"],
  weaponInventory: (() => {
    const inv = {};
    Object.keys(typeof WEAPON_DEFS !== "undefined" ? WEAPON_DEFS : {}).forEach(k => {
      // Give 100 of each size 1-10
      for (let s = 1; s <= 10; s++) inv[`${k}_s${s}`] = 100;
    });
    return inv;
  })(),
  allyInventory: { Sprite:100, Raptor:100, Rouge:100, Wasp:100, Supernova:100, Medic:100,
                   AllyTempest:100, AllyBulwark:100, AllyNemesis:100, CometAlly:100, VenganceAlly:100 },
  isAdmin: true,
  unlockedChallengeIds: [], // populated at login
  unlockedThrusterShapes: Object.keys(typeof THRUSTER_SHAPES !== "undefined" ? THRUSTER_SHAPES : {}),
  unlockedThrusterColors: ["#8084ff","#ff2200","#ffcc00","#00ffcc","#ffffff","#8800ff","#44ff44","#ff44cc"],
  unlockedTitles: ["Veteran","Ace","Ghost","Dreadnought","Fleet Architect","Ghost Pilot","Warden Legend"],
  equippedTitle: "Warden Legend",
};

// ============================================================
// ACCOUNT STATE
// ============================================================
let currentAccount = null; // { username, isAdmin }

function getAccountKey(username) { return `ae_save_${username.toLowerCase()}`; }

function getAllAccounts() {
  try {
    return JSON.parse(localStorage.getItem("ae_accounts") || "[]");
  } catch { return []; }
}
function saveAccountList(list) {
  localStorage.setItem("ae_accounts", JSON.stringify(list));
}

// ============================================================
// SAVE / LOAD
// ============================================================
function buildSaveData() {
  // Collect everything from the running game
  const save = {
    version: SAVE_VERSION,
    username: currentAccount?.username || "guest",
    savedAt: Date.now(),
    money: typeof money !== "undefined" ? money : 0,
    ownedShips: typeof ownedShips !== "undefined" ? [...ownedShips] : ["Starlight"],
    weaponInventory: typeof weaponInventory !== "undefined" ? { ...weaponInventory } : {},
    allyInventory: typeof allyInventory !== "undefined" ? { ...allyInventory } : {},
    allyPurchaseCount: typeof allyPurchaseCount !== "undefined" ? { ...allyPurchaseCount } : {},
    shipUpgrades: typeof shipUpgrades !== "undefined" ? JSON.parse(JSON.stringify(shipUpgrades)) : {},
    playerLoadout: typeof playerLoadout !== "undefined" ? JSON.parse(JSON.stringify(playerLoadout)) : {},
    challengeProgress: typeof challengeProgress !== "undefined" ? JSON.parse(JSON.stringify(challengeProgress)) : {},
    masterData: typeof masterData !== "undefined" ? JSON.parse(JSON.stringify(masterData)) : {},
    personalRecords: typeof personalRecords !== "undefined" ? JSON.parse(JSON.stringify(personalRecords)) : {},
    unlockedChallengeIds: typeof unlockedChallengeIds !== "undefined" ? [...unlockedChallengeIds] : [],
    unlockedThrusterShapes: typeof unlockedThrusterShapes !== "undefined" ? [...unlockedThrusterShapes] : ["classic"],
    unlockedThrusterColors: typeof unlockedThrusterColors !== "undefined" ? [...unlockedThrusterColors] : [THRUSTER_DEFAULT_COLOR],
    unlockedTitles: typeof unlockedTitles !== "undefined" ? [...unlockedTitles] : [],
    equippedTitle: typeof equippedTitle !== "undefined" ? equippedTitle : "",
    thrusterSettings: typeof thrusterSettings !== "undefined" ? JSON.parse(JSON.stringify(thrusterSettings)) : {},
  };
  return save;
}

function applySaveData(save) {
  if (!save || save.version !== SAVE_VERSION) {
    console.warn("Save version mismatch or no save — starting fresh.");
    return false;
  }
  if (typeof money            !== "undefined") money            = save.money ?? 5000;
  if (typeof ownedShips       !== "undefined") ownedShips       = save.ownedShips ?? ["Starlight"];
  if (typeof weaponInventory  !== "undefined") weaponInventory  = save.weaponInventory ?? {};
  if (typeof allyInventory    !== "undefined") allyInventory    = save.allyInventory ?? {};
  if (typeof allyPurchaseCount!== "undefined") allyPurchaseCount= save.allyPurchaseCount ?? {};
  if (typeof shipUpgrades     !== "undefined") shipUpgrades     = save.shipUpgrades ?? {};
  if (typeof playerLoadout    !== "undefined") Object.assign(playerLoadout, save.playerLoadout ?? {});
  if (typeof challengeProgress!== "undefined") challengeProgress= save.challengeProgress ?? {};
  if (typeof masterData       !== "undefined") masterData       = save.masterData ?? {};
  if (typeof personalRecords  !== "undefined") Object.assign(personalRecords, save.personalRecords ?? {});
  if (typeof unlockedChallengeIds !== "undefined") unlockedChallengeIds = save.unlockedChallengeIds ?? [];
  if (typeof unlockedThrusterShapes !== "undefined") unlockedThrusterShapes = save.unlockedThrusterShapes ?? ["classic"];
  if (typeof unlockedThrusterColors !== "undefined") unlockedThrusterColors = save.unlockedThrusterColors ?? [THRUSTER_DEFAULT_COLOR];
  if (typeof unlockedTitles   !== "undefined") unlockedTitles   = save.unlockedTitles ?? [];
  if (typeof equippedTitle    !== "undefined") equippedTitle    = save.equippedTitle ?? "";
  if (typeof thrusterSettings !== "undefined") thrusterSettings = save.thrusterSettings ?? {};
  return true;
}

function saveGame() {
  if (!currentAccount) return;
  const key = getAccountKey(currentAccount.username);
  const data = buildSaveData();
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Save failed:", e);
    showNotification?.("⚠ Save failed — storage full?", "#ff4400");
  }
}

function loadGame(username) {
  const key = getAccountKey(username);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// ============================================================
// ACCOUNT LOGIN / REGISTER
// ============================================================
function loginAccount(username, password) {
  // Admin shortcut
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    currentAccount = { username: ADMIN_USER, isAdmin: true };
    // Apply admin save (always fresh for testing)
    const adminSave = { ...ADMIN_SAVE, version: SAVE_VERSION };
    // Give all challenge IDs
    if (typeof FIXED_CHALLENGES !== "undefined") {
      adminSave.unlockedChallengeIds = FIXED_CHALLENGES.map(c => c.id);
    }
    adminSave.challengeProgress = {};
    adminSave.masterData = {};
    adminSave.personalRecords = {};
    applySaveData(adminSave);
    saveGame();
    return { ok: true, isAdmin: true };
  }

  // Load existing account
  const accounts = getAllAccounts();
  const acct = accounts.find(a => a.username.toLowerCase() === username.toLowerCase());
  if (!acct) return { ok: false, error: "Account not found" };
  if (acct.passwordHash !== hashPassword(password)) return { ok: false, error: "Wrong password" };

  currentAccount = { username: acct.username, isAdmin: false };
  const save = loadGame(acct.username);
  if (save) applySaveData(save);
  else {
    // Fresh account — seed defaults
    if (typeof ownedShips !== "undefined" && (!ownedShips || ownedShips.length === 0)) {
      ownedShips = ["Starlight"];
    }
  }
  return { ok: true };
}

function registerAccount(username, password) {
  if (!username || username.length < 3 || username.length > 20)
    return { ok: false, error: "Username must be 3–20 characters" };
  if (!password || password.length < 6)
    return { ok: false, error: "Password must be at least 6 characters" };
  if (username === ADMIN_USER)
    return { ok: false, error: "Username reserved" };

  const accounts = getAllAccounts();
  if (accounts.find(a => a.username.toLowerCase() === username.toLowerCase()))
    return { ok: false, error: "Username already taken" };

  accounts.push({ username, passwordHash: hashPassword(password) });
  saveAccountList(accounts);
  return loginAccount(username, password);
}

function logoutAccount() {
  if (currentAccount) saveGame();
  currentAccount = null;
}

// Simple hash — not cryptographic, just obfuscates password in localStorage
function hashPassword(pw) {
  let h = 0x811c9dc5;
  for (let i = 0; i < pw.length; i++) {
    h ^= pw.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}

// ============================================================
// AUTO-SAVE (call at end of each wave and on shop close)
// ============================================================
let _autoSaveTimer = 0;
function tickAutoSave() {
  _autoSaveTimer++;
  if (_autoSaveTimer >= 1800) { // every 30s at 60fps
    _autoSaveTimer = 0;
    if (currentAccount) saveGame();
  }
}

// ============================================================
// LEADERBOARD
// ============================================================
const LB_CATEGORIES = [
  { id: "kills",      label: "Most Kills",           stat: () => personalRecords.totalKills },
  { id: "money",      label: "Most Credits",         stat: () => typeof money !== "undefined" ? money : 0 },
  { id: "accuracy",   label: "Best Accuracy",        stat: () => parseFloat((personalRecords.accuracy||0).toFixed(1)) },
  { id: "waves",      label: "Most Waves Survived",  stat: () => personalRecords.maxWave },
  { id: "wardenCost", label: "Most $ Wasted on Wardens", stat: () => personalRecords.wardenCost },
];

async function submitLeaderboard() {
  if (!currentAccount || !navigator.onLine) return;
  const entries = {};
  LB_CATEGORIES.forEach(c => { entries[c.id] = c.stat(); });
  try {
    await fetch(`${LEADERBOARD_URL}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentAccount.username, entries }),
    });
  } catch { /* offline — silent fail */ }
}

async function fetchLeaderboard(category) {
  try {
    const res = await fetch(`${LEADERBOARD_URL}/top?cat=${category}&n=10`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ============================================================
// LOGIN UI
// ============================================================
function buildLoginUI() {
  const existing = document.getElementById("loginOverlay");
  if (existing) { existing.style.display = "flex"; return; }

  const overlay = document.createElement("div");
  overlay.id = "loginOverlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:10000;display:flex;align-items:center;justify-content:center;font-family:monospace";

  overlay.innerHTML = `
    <div style="background:#0a0e1a;border:1px solid #0af;border-radius:12px;padding:32px;width:320px;color:#ccc">
      <div style="color:#0af;font:bold 18px monospace;margin-bottom:20px;text-align:center">⚔ WARDEN ARENA</div>
      <div id="loginError" style="color:#f44;font:11px monospace;min-height:16px;margin-bottom:8px;text-align:center"></div>
      <div id="loginMode" style="display:flex;gap:8px;margin-bottom:16px">
        <button onclick="loginSetMode('login')" id="btnModeLogin" style="flex:1;background:#0a0e1a;border:1px solid #0af;color:#0af;padding:6px;font:11px monospace;cursor:pointer">Login</button>
        <button onclick="loginSetMode('register')" id="btnModeReg" style="flex:1;background:#0a0e1a;border:1px solid #333;color:#666;padding:6px;font:11px monospace;cursor:pointer">Register</button>
      </div>
      <input id="loginUser" type="text" placeholder="Username" maxlength="20" autocomplete="username"
        style="width:100%;box-sizing:border-box;background:#111;border:1px solid #333;color:#eee;padding:8px;font:13px monospace;margin-bottom:10px;border-radius:4px">
      <input id="loginPass" type="password" placeholder="Password" autocomplete="current-password"
        style="width:100%;box-sizing:border-box;background:#111;border:1px solid #333;color:#eee;padding:8px;font:13px monospace;margin-bottom:16px;border-radius:4px">
      <button onclick="loginSubmit()" style="width:100%;padding:10px;background:#0af;color:#000;font:bold 13px monospace;border:none;cursor:pointer;border-radius:4px">LOGIN</button>
      <div style="text-align:center;margin-top:12px">
        <a onclick="loginGuest()" style="color:#555;font:11px monospace;cursor:pointer;text-decoration:underline">Play as guest (no save)</a>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Enter key submits; focus username field immediately
  overlay.querySelectorAll("input").forEach(inp =>
    inp.addEventListener("keydown", e => { if (e.key === "Enter") loginSubmit(); }));
  // Slight delay so the browser registers the element before focusing
  setTimeout(() => document.getElementById("loginUser")?.focus(), 50);
}

let _loginMode = "login";
function loginSetMode(mode) {
  _loginMode = mode;
  const btnL = document.getElementById("btnModeLogin");
  const btnR = document.getElementById("btnModeReg");
  const btn  = document.querySelector("#loginOverlay button:last-of-type");
  if (btnL) { btnL.style.borderColor = mode==="login"?"#0af":"#333"; btnL.style.color = mode==="login"?"#0af":"#666"; }
  if (btnR) { btnR.style.borderColor = mode==="register"?"#0af":"#333"; btnR.style.color = mode==="register"?"#0af":"#666"; }
  if (btn)  btn.textContent = mode === "login" ? "LOGIN" : "CREATE ACCOUNT";
}

function loginSubmit() {
  const user = (document.getElementById("loginUser")?.value || "").trim();
  const pass = (document.getElementById("loginPass")?.value || "");
  const errEl = document.getElementById("loginError");
  const result = _loginMode === "login" ? loginAccount(user, pass) : registerAccount(user, pass);
  if (result.ok) {
    document.getElementById("loginOverlay")?.remove();
    if (typeof renderHUD === "function") renderHUD?.();
    showNotification?.(`Welcome, ${currentAccount.username}${result.isAdmin?" (ADMIN)":""}!`, "#0af");
    submitLeaderboard();
  } else {
    if (errEl) errEl.textContent = result.error;
  }
}

function loginGuest() {
  currentAccount = { username: "guest", isAdmin: false };
  const overlay = document.getElementById("loginOverlay");
  if (overlay) overlay.remove();
  showNotification?.("Playing as guest — progress won't be saved. Log in from the Shop to save.", "#888");
}

// Call this to show the login UI from the shop/menu
function showLoginFromMenu() {
  buildLoginUI();
}
