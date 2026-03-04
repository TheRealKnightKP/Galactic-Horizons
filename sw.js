const CACHE = "galactic-horizons-v1.0.6";
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
  "./assets/Hammerhead.png",
  "./assets/StarlancerTAC.png",
  "./assets/Polaris.png",
  "./assets/Kraken.png",
  "./assets/Idris.png",
  "./assets/Meteor.png",
  "./assets/Gladius.png",
  "./assets/Corsair.png",
  "./assets/Merlin.png",
  "./assets/VanduulKingship.png",
  "./assets/sounds/shoot_laser.wav",
  "./assets/sounds/shoot_ballistic.wav",
  "./assets/sounds/shoot_railgun.wav",
  "./assets/sounds/hit_ballistic.wav",
  "./assets/sounds/hit_laser.wav",
  "./assets/sounds/hit_distortion.wav",
  "./assets/sounds/explode.wav"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
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
*/
