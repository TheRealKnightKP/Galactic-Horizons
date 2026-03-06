const CACHE = "galactic-horizons-v1.4.7";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./shop.js",
  "./game.js",
  "./manifest.json",
  "./assets/Galactic_Horizons_SIcon.png",
  "./assets/Galactic_Horizons_Icon.png",
  "./assets/Starlight.png",
  "./assets/Nemesis.png",
  "./assets/Mustang.png",
  "./assets/Cutlass.png",
  "./assets/Freelancer.png",
  "./assets/Hornet.png",
  "./assets/Constellation.png",
  "./assets/HammerHead.png",
  "./assets/StarlancerTAC.png",
  "./assets/Polaris.png",
  "./assets/Kraken.png",
  "./assets/Idris.jpg",
  "./assets/Gladius.png",
  "./assets/Corsair.png",
  "./assets/Merlin.png",
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
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
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
*/
