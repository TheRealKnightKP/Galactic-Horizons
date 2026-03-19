const CACHE = "galactic-horizons-v1.8.33";
const ASSETS = [
  "./index.html",
  "./style.css",
  "./data.js",
  "./shop.js",
  "./game.js",
  "./manifest.json",
  "./saves.js",
  "./challenges.js",
  "./universe.js",
  "./universe_data.js",
  "./universe_saves.js",
  "./universe_menu.js",
  "./assets/Galactic_Horizons_SIcon.png",
  "./assets/Galactic_Horizons_Icon.png",
  "./assets/Starlight.png",
  "./assets/Nemesis.png",
  "./assets/Bulwark.png",
  "./assets/Comet.png",
  "./assets/Corsair.png",
  "./assets/Dominion.png",
  "./assets/EnemyBulwark.png",
  "./assets/EnemyDominion.png",
  "./assets/EnemyPrometheus.png",
  "./assets/EnemyMedic.png",
  "./assets/Prometheus.png",
  "./assets/Dreadnaught1.png",
  "./assets/Dreadnaught2.png",
  "./assets/Dreadnaught3.png",
  "./assets/EldritchComet1.png",
  "./assets/EldritchComet2.png",
  "./assets/EldritchComet3.png",
  "./assets/EldritchVengeance1.png",
  "./assets/EldritchVengeance2.png",
  "./assets/EldritchVengeance3.png",
  "./assets/Galactic_Horizons_AllyRaptor.png",
  "./assets/Galactic_Horizons_Falcon.png",
  "./assets/Galactic_Horizons_Marauder.png",
  "./assets/Galactic_Horizons_Raptor.png",
  "./assets/Galactic_Horizons_Raptor_Enemy.png",
  "./assets/Galactic_Horizons_Rougue.png",
  "./assets/Galactic_Horizons_Rougue_Enemy.png",
  "./assets/Galactic_Horizons_Supernova.png",
  "./assets/Galactic_Horizons_Vengeance.png",
  "./assets/Galactic_Horizons_Wasp.png",
  "./assets/Galactic_Horizons_Sprite.png",
  "./assets/Leviathan.png",
  "./assets/Medic.png",
  "./assets/Tempest.png",
  "./assets/EldritchStation.png",
  "./assets/HarvesterStation.png",
  "./assets/CivilianStation.png",
  "./assets/WardenStation.png",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(
        ASSETS.map(url => c.add(url).catch(err => console.warn("Failed to cache:", url, err)))
      );
    })
  );
  self.skipWaiting();
});
 
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  clients.claim();
});
 
self.addEventListener("fetch", e => {
  // Skip cross-origin requests (API calls to Cloudflare worker) — let browser handle CORS normally
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => new Response("Offline", { status: 503 })))
  );
});



/*
Versions:
-V1 - Release (3/3/2026) [D,M,Y]
-V1.0.1 - QOL updates and sizes changed.
-V1.0.2 - Fixed sizes
-V1.0.3 - Fixed sizes again
-V1.0.4 - Tried fixing sizes and added Version counter in menu HUD
-V1.0.5 - Final Size fixes hopefully
-V1.0.6 - Seeing if version changing works
-V1.0.7 - Trying to fix version changing
-V1.0.8 - Still trying to fix version changing + Audio errors
-V1.0.9 - Fixing install issues
-V1.0.10 - Final fixings for a lot of stuff hopefully 
-V1.1.0 - "The framing Rework" Rework of hitboxes and frames for identification
-V1.2.0 - "The ally update" Formation system, per ship upgrades, and others... (4/3/2026)
-V1.2.1 - Fixing shop issues and ai movement wobble.
-V1.2.2 - Swapped missile and boost buttons and added the formation button in mobile.
-V1.2.3 - Trying to fix mobile update issues
-V1.2.4 - Fixed ally speeds and ally slots
-V1.2.5 - Fixed ally tab on shop
-V1.3.0 - "The Combat Rework Pt1" Added ship specials, Formation bonuses, and command ping. (5/3/2026)
-V1.4.0 - "The Combat Rework Pt2" Fixed ship specials and buttons on mobile, added directional armor and shields, added different cluster kinds, added new enemy archetypes, added reinforcements, added medic ally, added mobile aim assist and button fade. Basically part 2 of the V1.3.0
-V1.4.1 - "The ghost update" Nothing cuz i messed up the numbering of Versions.
-V1.4.2 - Fixed comma in data.js preventing waves mode.
-V1.4.3 - Forgot to change the number displayed on index.html so i had to make a new version. 
-V1.4.4 - Added Shadow Comet boss wave 12, fixed shield faces, added Vengeance secret ship.
-V1.4.5 - Fixed shields and other stuff 
-V1.4.6 - Changed aim assist on mobile
-V1.4.7 - Removed aim assist because it was attrociously bugged
-V1.4.8 - Atrocious bug persisted so tried removing again.
-V1.4.9 - Trying to fix "Favicon" error, whatever the hell that is
-V1.4.10 - Major fixes: Shadow Comet rework, shield face direction fix, distortion stun fix, pack hunter rework, dodge for all ships, enemy healer, weapon/missile/turret upgrades, new weapon buy UI, inventory tab, wave confirmation, ally full upgrades, enemy turret side penalty, Bulwark/Leviathan turret in SC wave, railgun wave clear fix, medic ally fix. (6/3/2026)
-V1.4.11 - Fixed money, nukes, missile choosing, ship upgrade prices, removed shop when entering waves.
-V1.4.12 - Fixed syntax error in shop.js
-V1.4.13 - reverted changes in 1.4.11 because it broke everything.
-V1.4.14 - Fixed money, nukes, missile choosing, ship upgrade prices, removed shop when entering waves, for real this time.
-V1.4.15 - Fixed missile equipping, upgrade prices, pack huners.
-V1.4.16 - Fixed missile equipping again, removed pack hunters. (7/3/2026)
-V1.4.17 - Fixed missile restock and added option to cycle missile types
-V1.4.18 - Fixed missile cycle
-V1.4.19 - Fixing missile cycle again
-V1.5.0 - Arena Evolution part 1 update: Extra waves to wave 30, Shadow Vengeance bossfight, Retribution, Dreadnaught hp phases, Anti wobble.
-V1.5.1 - Fixed Waves 20-30, Shadow Vengeance bossfight fixed. (3/8/2026)
-V1.5.2 - Fixed swarm wave and shadow vengeance not spawning bugs.
-V1.5.3 - Fixed weapon buying and Prometheus ability.
-V1.5.4 - Fixed Prometheus ability, reinforcements, and shields
-V1.5.5 - Added some extra ally stuff and fixed retribution gaining.
-V1.5.6 - Fixed Ally tab on shop
-V1.5.7 - Arena Evolution part 2 update: Capital ship gameplay
-V1.5.8 - Fixed Capital deployments and fixed Prometheus gun (9/3/2026)
-V1.5.9 - Fixed capital deployments again
-V1.5.10 - Fixing ally issues 
-V1.5.11 - Fixed ally and capship issues
-V1.5.12 - Reworked ally slots
-V1.5.13 - Forgot index changing Version num
-V1.5.14 - Arena Evolution part 3 update: Enemy capital ship ai
-V1.5.15 - Fixed ally slots
-V1.6.0 - Arena Finale Update.
-V1.6.1 - pushing leaderboard stuff
-V1.6.2 - Fixing a lot of stuff (10/3/2026)
-V1.6.3 - Pushing leaderboard live
-V1.6.4 - Removing special weapons from store
-V1.6.5 - Fixing special weapons in store
-V1.6.6 - Adding command center tab
-V1.6.7 - SIXSEVEN WOOO (Made starter money 0)
-V1.6.8 - Trying to fix mobile not updating
-V1.6.9 - Trying to fix account stuff.
-V1.6.10 - Arena Finale Update part 2.
-V1.6.11 - Fixed some stuff
-V1.6.12 - Fixed bespoke weapon stuff
-V1.6.13 - Fixing saves and Dominion boost
-V1.6.14 - Fixing ghost accounts
-V1.6.15 - Fixed screen resolution and rendering problems and improved background
-V1.6.16 - Fixed error in game.js
-V1.6.17 - Fixing?
-V1.6.18 - fixing resolution
-V1.6.19 - Fixing money
-V1.6.20 - Fixing everythig about accounts again
-V1.6.21 - Fixing some save stuff and menu stuff idk
-V1.7.0 - The Assets update: Adding the original assets for all ships. (15/3/2026)
-V1.7.1 - Fixing assets
-V1.7.2 - Fixig asset quality and size and Dominion orentaition
-V1.7.3 - Fixed sw.js asset cache list to match actual asset filenames
-V1.7.4 - Added Prometheus, EnemyBulwark, EnemyPrometheus, EnemyDominion, Sprite assets
-V1.7.5 - All original assets complete: EnemyMedic, Dreadnaught (animated), EldritchComet (animated), EldritchVengeance (animated)
-V1.8.0 - Universe Mode foundation: Menu restructure (Account/Arena/Universe top level), universe_data.js (data schema), universe_saves.js (seed-based save system), universe_menu.js (world creation/select/delete). No gameplay yet — Phase 0.5 next. (16/3/2026)
-V1.8.1 - Moved Account/Admin from Command Center to top-level Account panel. Stripped all emojis from game UI.
-V1.8.2 - Added the first vertical slice playable form of Universe
-V1.8.3 - Added universe.js to sw.js
-V1.8.4 - Fixed menu, movement, and other stuff on universe mode
-V1.8.5 - Ghost update
-V1.8.6 - added parallax dots and cam fixes
-V1.8.7 - Map fixes and others
-V1.8.8 - Fixed some stuff
-V1.8.9 - Fixes and more fixes
-V1.8.10 - Fixes mc.fixface from fixlandia
-V1.8.11 - Fixes of not being able to buy/sell
-V1.8.12 - Vertical slice for adding missions, wormhole jumping, more ships.
-V1.8.13 - Jump fixes, mission fixes, ship shop
-V1.8.14 - Fixes to travel and mobile
-V1.8.15 - Fixing map markers and mobile map
-V1.8.16 - Fixing some missions, markers, and exiting
-V1.8.17 - Wreckage updates and hud updates
-V1.8.18 - Wreckage and exit fixes
-V1.8.19 - Fixed saves and other stuff that broke the game
-V1.8.20 - Fixed some other other stuff
-V.8.21 - Fixed more stuff
-V1.8.22 - Is it finally fixed?
-V1.8.23 - Fixing world stuff
-V1.8.24 - More fixes
-V1.8.25 - Combat mission fixes
-V1.8.26 - Combat mission fixes 2 electric bogaloo
-V1.8.27 - Fixed some stuff and added station assets
-V1.8.28 - Fixed exploration missions and added warden stations
-V1.8.29 - Fixed mobile loading for stations (No, i didnt)
-V1.8.30 - Fixed mobile loading for stations for real now
-V1.8.31 - Fixing img loading everywhere again
-V1.8.32 - Theres no V1.8.32 in ba sing se
-V1.8.33 - Updated sw.js to correctly include the station images
*/
