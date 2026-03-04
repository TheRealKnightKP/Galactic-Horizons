const CACHE = "galactic-horizons-v1.0.10";
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
-V1 - Release (3/3/2026)
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
*/
