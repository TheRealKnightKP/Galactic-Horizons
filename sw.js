const CACHE = "galactic-horizons-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./shop.js",
  "./cheat.js",
  "./game.js",
  "./manifest.json",
  "./Galactic_Horizons_Icon.png",
  "./Starlight.png",
  "./Nemesis.png",
  "./Mustang.png",
  "./Cutlass.png",
  "./Freelancer.png",
  "./Hornet.png",
  "./Constellation.png",
  "./Hammerhead.png",
  "./StarlancerTAC.png",
  "./Polaris.png",
  "./Kraken.png",
  "./Idris.png",
  "./Meteor.png",
  "./Gladius.png",
  "./Corsair.png",
  "./Merlin.png",
  "./VanduulKingship.png"
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
