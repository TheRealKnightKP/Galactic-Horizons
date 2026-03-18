// ============================================================
// universe_menu.js — Phase 0.3: Universe Menu UI
// World creation, selection, deletion
// Depends on: universe_data.js, universe_saves.js
// ============================================================

// ── ENTER UNIVERSE MENU ───────────────────────────────────────
// Called when player clicks "Universe" from top menu.
// Shows list of existing worlds + create new button.

async function enterUniverseMenu() {
  // Universe requires a real account (saves are tied to account)
  if (typeof currentAccount === "undefined" || !currentAccount || currentAccount.username === "guest") {
    alert("Universe Mode requires a logged-in account. Guest players cannot access Universe Mode because saves are tied to your account.");
    return;
  }
  document.getElementById("topMenu").style.display = "none";
  document.getElementById("universeMenu").style.display = "block";
  await refreshUniverseWorldList();
}

async function refreshUniverseWorldList() {
  const body = document.getElementById("universeMenuBody");
  body.innerHTML = '<p style="color:#666">Loading worlds...</p>';

  try {
    const worlds = await listWorlds();

    let html = '';

    // Create new world button
    html += '<div style="margin-bottom:16px">';
    html += '<button onclick="showCreateWorldUI()" style="background:rgba(0,170,255,0.15);border:2px solid #0af;color:#0af;font:bold 15px monospace;padding:12px 28px;border-radius:8px;cursor:pointer;width:100%">+ Create New World</button>';
    html += '</div>';

    if (worlds.length === 0) {
      html += '<p style="color:#666;text-align:center">No worlds yet. Create one to begin your journey.</p>';
    } else {
      html += '<div style="max-height:340px;overflow-y:auto">';
      for (const w of worlds) {
        const playHours = Math.floor(w.playTime / 3600);
        const playMins = Math.floor((w.playTime % 3600) / 60);
        const playStr = playHours > 0 ? playHours + "h " + playMins + "m" : playMins + "m";
        const lastPlayed = w.lastPlayedAt ? new Date(w.lastPlayedAt).toLocaleDateString() : "Never";
        const factionLabel = w.playerFaction && w.playerFaction !== "none" ? w.playerFaction.charAt(0).toUpperCase() + w.playerFaction.slice(1) : "Unaligned";
        const factionColor = w.playerFaction === "warden" ? "#4488ff" : w.playerFaction === "harvester" ? "#ff8800" : w.playerFaction === "eldritch" ? "#cc0033" : "#888";

        html += '<div style="background:rgba(255,255,255,0.04);border:1px solid #333;border-radius:8px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">';
        html += '<div style="flex:1">';
        html += '<div style="color:#fff;font:bold 16px monospace">' + escapeHTML(w.name) + '</div>';
        html += '<div style="color:#888;font:12px monospace;margin-top:4px">';
        html += 'System: ' + escapeHTML(w.playerSystem || "solara") + ' | ';
        html += '<span style="color:' + factionColor + '">' + factionLabel + '</span> | ';
        html += escapeHTML(w.playerCredits.toLocaleString()) + ' SC | ';
        html += playStr + ' played | Last: ' + lastPlayed;
        html += '</div>';
        html += '</div>';
        html += '<div style="display:flex;gap:6px">';
        html += '<button onclick="loadAndPlayWorld(\'' + w.worldId + '\')" style="background:rgba(0,255,100,0.15);border:1px solid #0f0;color:#0f0;font:bold 12px monospace;padding:8px 16px;border-radius:6px;cursor:pointer">PLAY</button>';
        html += '<button onclick="confirmDeleteWorld(\'' + w.worldId + '\',\'' + escapeHTML(w.name) + '\')" style="background:rgba(255,50,50,0.10);border:1px solid #f44;color:#f44;font:bold 12px monospace;padding:8px 12px;border-radius:6px;cursor:pointer">✕</button>';
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    body.innerHTML = html;
  } catch (e) {
    console.error("Failed to load worlds:", e);
    body.innerHTML = '<p style="color:#f44">Error loading worlds. Try refreshing.</p>';
  }
}

// ── CREATE WORLD UI ───────────────────────────────────────────
function showCreateWorldUI() {
  const body = document.getElementById("universeMenuBody");
  let html = '';
  html += '<div style="background:rgba(0,170,255,0.05);border:1px solid #0af;border-radius:8px;padding:16px;margin-bottom:12px">';
  html += '<div style="color:#0af;font:bold 16px monospace;margin-bottom:12px">Create New World</div>';

  // World name input
  html += '<div style="margin-bottom:12px">';
  html += '<label style="color:#aaa;font:12px monospace;display:block;margin-bottom:4px">World Name</label>';
  html += '<input id="newWorldName" type="text" maxlength="30" placeholder="My Universe" style="width:100%;box-sizing:border-box;background:#111;border:1px solid #444;color:#fff;font:14px monospace;padding:8px;border-radius:4px">';
  html += '</div>';

  // Seed input (optional)
  html += '<div style="margin-bottom:16px">';
  html += '<label style="color:#aaa;font:12px monospace;display:block;margin-bottom:4px">Seed (optional — leave blank for random)</label>';
  html += '<input id="newWorldSeed" type="text" maxlength="20" placeholder="Random" style="width:100%;box-sizing:border-box;background:#111;border:1px solid #444;color:#fff;font:14px monospace;padding:8px;border-radius:4px">';
  html += '</div>';

  // Buttons
  html += '<div style="display:flex;gap:8px">';
  html += '<button onclick="doCreateWorld()" style="flex:1;background:rgba(0,255,100,0.15);border:1px solid #0f0;color:#0f0;font:bold 14px monospace;padding:10px;border-radius:6px;cursor:pointer">Create & Play</button>';
  html += '<button onclick="refreshUniverseWorldList()" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid #666;color:#aaa;font:bold 14px monospace;padding:10px;border-radius:6px;cursor:pointer">Cancel</button>';
  html += '</div>';

  html += '</div>';
  body.innerHTML = html;

  // Focus the name input
  setTimeout(() => {
    const input = document.getElementById("newWorldName");
    if (input) input.focus();
  }, 50);
}

async function doCreateWorld() {
  const nameInput = document.getElementById("newWorldName");
  const seedInput = document.getElementById("newWorldSeed");
  const worldName = (nameInput?.value || "").trim() || "New World";
  const seedStr = (seedInput?.value || "").trim();

  // Create the world
  const world = await createNewWorld(worldName);

  // If player entered a custom seed, override the random one
  if (seedStr) {
    // Convert string to a number seed
    let customSeed = 0;
    for (let i = 0; i < seedStr.length; i++) {
      customSeed = (customSeed * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    world.masterSeed = customSeed;
    await saveWorld(world);
  }

  // Enter the game with this world
  startUniverseMode(world);
}

// ── LOAD AND PLAY ─────────────────────────────────────────────
async function loadAndPlayWorld(worldId) {
  const world = await loadWorld(worldId);
  if (!world) {
    alert("Failed to load world. It may have been deleted.");
    await refreshUniverseWorldList();
    return;
  }
  startUniverseMode(world);
}

// ── DELETE WORLD ──────────────────────────────────────────────
async function confirmDeleteWorld(worldId, worldName) {
  if (!confirm('Delete world "' + worldName + '"? This cannot be undone.')) return;
  await deleteWorld(worldId);
  await refreshUniverseWorldList();
}

// ── START UNIVERSE MODE ───────────────────────────────────────
// Transitions from menu into the Universe game.
// Sets up the world state, regenerates from seed, hands off to universe.js
// For now (Phase 0.3), this is a placeholder — actual gameplay comes in Phase 0.5

function startUniverseMode(world) {
  setCurrentWorld(world);
  startPlayTimeTracking();

  // Regenerate universe from seed
  const universe = regenerateUniverse(world);
  if (!universe) {
    alert("Failed to generate universe. Try creating a new world.");
    return;
  }

  // Store regenerated state for gameplay
  window._activeUniverse = universe;

  // Hide menus
  document.getElementById("universeMenu").style.display = "none";
  document.getElementById("topMenu").style.display = "none";

  // If universe.js is loaded, launch real gameplay. Otherwise show placeholder.
  if (typeof enterUniverse === "function") {
    enterUniverse(world);
  } else {
    showUniversePlaceholder(world, universe);
  }
}

function showUniversePlaceholder(world, universe) {
  // Temporary — replaced by actual gameplay in Phase 0.5
  const systemCount = Object.keys(universe.systems).length;
  let totalQuadrants = 0;
  for (const sys of Object.values(universe.systems)) {
    for (const area of Object.values(sys.areas)) {
      totalQuadrants += area.quadrants.length;
    }
  }

  const body = document.getElementById("universeMenuBody");
  document.getElementById("universeMenu").style.display = "block";

  let html = '';
  html += '<div style="background:rgba(0,255,100,0.05);border:1px solid #0f0;border-radius:8px;padding:16px;text-align:center">';
  html += '<div style="color:#0f0;font:bold 20px monospace;margin-bottom:8px">✓ World Loaded</div>';
  html += '<div style="color:#fff;font:bold 16px monospace;margin-bottom:12px">"' + escapeHTML(world.name) + '"</div>';
  html += '<div style="color:#aaa;font:12px monospace;line-height:1.8">';
  html += 'Seed: ' + world.masterSeed + '<br>';
  html += 'Systems: ' + systemCount + '<br>';
  html += 'Total Quadrants: ' + totalQuadrants + '<br>';
  html += 'Credits: ' + world.player.credits.toLocaleString() + ' SC<br>';
  html += 'Ship: ' + (world.player.ownedShips[0]?.key || "None") + '<br>';
  html += 'Location: ' + (world.player.currentSystemId || "Unknown") + '<br>';
  html += '</div>';
  html += '<div style="color:#888;font:11px monospace;margin-top:12px">Universe gameplay coming in Phase 0.5</div>';
  html += '<br>';
  html += '<button onclick="exitUniverseToMenu()" style="background:rgba(255,255,255,0.08);border:1px solid #888;color:#aaa;font:bold 13px monospace;padding:8px 20px;border-radius:6px;cursor:pointer">← Back to Worlds</button>';
  html += '</div>';
  body.innerHTML = html;
}

async function exitUniverseToMenu() {
  // Save before exiting
  await autoSaveUniverse();
  stopPlayTimeTracking();
  setCurrentWorld(null);
  window._activeUniverse = null;
  // Show universe menu (world select)
  document.getElementById("universeMenu").style.display = "block";
  await refreshUniverseWorldList();
}

// ── MENU NAVIGATION FUNCTIONS ─────────────────────────────────
// These are called from index.html buttons and need to be globally accessible.

function enterArenaMenu() {
  document.getElementById("topMenu").style.display = "none";
  document.getElementById("arenaMenu").style.display = "block";
}

function backToTopMenu() {
  // Hide all sub-menus
  document.getElementById("arenaMenu").style.display = "none";
  document.getElementById("universeMenu").style.display = "none";
  document.getElementById("accountPanel").style.display = "none";
  document.getElementById("shopMenu").style.display = "none";
  document.getElementById("loadoutMenu").style.display = "none";
  // Show top menu
  document.getElementById("topMenu").style.display = "block";
}

function openAccountPanel() {
  document.getElementById("topMenu").style.display = "none";
  document.getElementById("accountPanel").style.display = "block";

  const body = document.getElementById("accountBody");
  if (!body) return;

  // Render account section
  if (typeof renderShopAccount === "function") {
    renderShopAccount(body);
  } else {
    const username = typeof currentUsername !== "undefined" ? currentUsername : "Not logged in";
    body.innerHTML = '<div style="color:#fff;font:14px monospace;margin-bottom:12px">Logged in as: <span style="color:#0af">' + escapeHTML(username) + '</span></div>';
  }

  // Append admin panel below account if user is admin
  const isAdmin = (typeof currentAccount !== "undefined") && currentAccount?.isAdmin;
  if (isAdmin && typeof renderAdminPanel === "function") {
    const adminDiv = document.createElement("div");
    adminDiv.style.cssText = "margin-top:20px;padding-top:16px;border-top:1px solid #333";
    body.appendChild(adminDiv);
    renderAdminPanel(adminDiv);
  }
}

function closeAccountPanel() {
  document.getElementById("accountPanel").style.display = "none";
  document.getElementById("topMenu").style.display = "block";
}

// ── SHOP / LOADOUT OVERRIDES ──────────────────────────────────
// Shop and Loadout need to return to Arena menu instead of mainMenu

function openShopFromMenu() {
  shopOpenedFromMenu = true;
  state = "shop";
  document.getElementById("arenaMenu").style.display = "none";
  showShop();
}

function openLoadout() {
  document.getElementById("arenaMenu").style.display = "none";
  document.getElementById("loadoutMenu").style.display = "block";
  if (typeof _loadoutTab !== "undefined") _loadoutTab = "ship";
  if (typeof ensureAllySlots === "function") ensureAllySlots();
  if (typeof renderLoadout === "function") renderLoadout();
}

function closeLoadout() {
  document.getElementById("loadoutMenu").style.display = "none";
  document.getElementById("arenaMenu").style.display = "block";
}

// ── UTILITY ───────────────────────────────────────────────────
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ── LOGIN FLOW INTEGRATION ────────────────────────────────────
// After login succeeds, show topMenu instead of old mainMenu.
// This overrides the existing login success handler.
// The actual login UI (buildLoginUI) is in saves.js — we just
// need to redirect where it goes after success.

function onLoginSuccess() {
  // Hide login, show top-level menu
  const loginEl = document.getElementById("loginMenu");
  if (loginEl) loginEl.style.display = "none";
  document.getElementById("topMenu").style.display = "block";
}

// Hook: called from game.js or saves.js after successful login
// Existing code calls: document.getElementById("mainMenu").style.display = "block"
// We override that to show topMenu instead.
// This is handled by making sure game.js references topMenu after login.
