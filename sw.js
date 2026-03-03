const CACHE = "galactic-horizons-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./shop.js",
  "./game.js",
  "./manifest.json",
  "./assets/Galactic_Horizons_Icon.png",
  "./assets/Galactic_Horizons_SIcon.png",
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
  e.waitUntil(clients.claim());
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
