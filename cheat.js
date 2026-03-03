// cheat.js
// da cheat code for meteor
const KONAMI_CODE = [
  "ArrowUp","ArrowUp","ArrowDown","ArrowDown",
  "ArrowLeft","ArrowRight","ArrowLeft","ArrowRight",
  "KeyB","KeyA"
];
let cheatBuffer = [];

document.addEventListener("keydown", function(e) {
  cheatBuffer.push(e.code);
  if (cheatBuffer.length > KONAMI_CODE.length) {
    cheatBuffer.shift();
  }
  if (cheatBuffer.join(",") === KONAMI_CODE.join(",")) {
    setPlayerShip("Meteor");
    cheatBuffer = [];
    alert("🚀 CHEAT ACTIVATED: METEOR UNLOCKED!\nFast and deadly — but fragile!");
    updateHUD();
  }
});