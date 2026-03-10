// challenges.js — Arena Evolution V1.6.0
// Challenge tracking, ship mastery, personal records, daily system

// ============================================================
// GLOBAL STATE
// ============================================================
let unlockedChallengeIds  = []; // IDs of completed fixed challenges
let challengeProgress     = {}; // { challengeId: { progress, completed } }
let unlockedThrusterShapes= ["classic"];
let unlockedThrusterColors= [THRUSTER_DEFAULT_COLOR];
let unlockedTitles        = [];
let equippedTitle         = "";
let thrusterSettings      = {}; // { shipName: { color, shape } }

// ── Session stats (reset each session/wave) ──
let _sessionStats = {};
let _waveStats    = {};

// ── Career stats (persistent via personal records) ──
let personalRecords = {
  maxWave: 0, totalKills: 0, shotsFired: 0, shotsHit: 0, shotsMissed: 0,
  accuracy: 0, bossesKilled: 0, deaths: 0, alliesFallen: 0, wardenCost: 0,
  // Extended career counters used by challenges:
  ballisticShotsFired: 0, ballisticKills: 0, distortionStunKills: 0,
  corrosionKills: 0, staggerKills: 0, chainHits3: 0, voidAOEKills: 0,
  railgunHits: 0, railgunCrits: 0, boostFrames: 0, boostKills: 0,
  hitlessWaves: 0, hitlessWaves20plus: 0, dreadnaughtKills: 0,
  totalCreditsEarned: 0, winsNoMissiles: 0, highAccuracyWaves: 0,
  distortionBypasses: 0, shieldFacesDestroyed: 0, allyShipsOwned: 0,
};

// ── Ship mastery state ──
let masterData = {}; // { shipName: { xp, tokens, spent: {weaponDamage,fireRate,maxHp,maxShields,speed,dodgeChance}, stats: {...} } }

// ── Daily challenge state ──
let _dailyChallenges  = []; // 3 challenges drawn for today
let _dailyCompleted   = {}; // { challengeId: bool }
let _dailyDateKey     = ""; // YYYY-MM-DD

// ============================================================
// MASTER DATA HELPERS
// ============================================================
function getMastery(ship) {
  if (!masterData[ship]) {
    masterData[ship] = {
      xp: 0, tokens: 0,
      spent: { weaponDamage:0, fireRate:0, maxHp:0, maxShields:0, speed:0, dodgeChance:0 },
      stats: { kills:0, shotsFired:0, shotsHit:0, boostFrames:0, neardDeaths:0, damageDealt:0, wavesPlayed:0, sessionKills:0 },
    };
  }
  return masterData[ship];
}

function addMasteryXP(ship, xp) {
  const m = getMastery(ship);
  const oldLevel = masteryXpToLevel(m.xp);
  m.xp += xp;
  const newLevel = masteryXpToLevel(m.xp);
  if (newLevel > oldLevel) {
    const tokensEarned = MASTERY_TOKEN_LEVELS.filter(l => l > oldLevel && l <= newLevel).length;
    if (tokensEarned > 0) {
      m.tokens += tokensEarned;
      showNotification?.(`🏆 ${ship} reached level ${newLevel}!${tokensEarned>0?` +${tokensEarned} token`:""}`, "#ffcc00");
    }
    // Check spiral thruster shape unlock (reach level 100)
    if (newLevel >= 100) checkChallengeCondition("masteryLevel", { level: newLevel });
  }
}

function getMasteryBonus(ship) {
  const m = getMastery(ship);
  const s = m.spent;
  return {
    weaponDamageMult: 1 + s.weaponDamage * MASTERY_TOKEN_UPGRADES.weaponDamage.pctPerToken,
    fireRateMult:     1 + s.fireRate     * MASTERY_TOKEN_UPGRADES.fireRate.pctPerToken,
    maxHpMult:        1 + s.maxHp        * MASTERY_TOKEN_UPGRADES.maxHp.pctPerToken,
    maxShieldsMult:   1 + s.maxShields   * MASTERY_TOKEN_UPGRADES.maxShields.pctPerToken,
    speedMult:        1 + s.speed        * MASTERY_TOKEN_UPGRADES.speed.pctPerToken,
    dodgeBonus:       s.dodgeChance      * MASTERY_TOKEN_UPGRADES.dodgeChance.pctPerToken,
  };
}

function spendMasteryToken(ship, stat) {
  const m = getMastery(ship);
  if (m.tokens <= 0) return false;
  const maxT = MASTERY_TOKEN_UPGRADES[stat]?.maxTokens || 10;
  if ((m.spent[stat] || 0) >= maxT) return false;
  m.tokens--;
  m.spent[stat] = (m.spent[stat] || 0) + 1;
  // Reapply player stats if this is the current ship
  if (typeof currentShipName !== "undefined" && currentShipName === ship) {
    if (typeof setPlayerShip === "function") setPlayerShip(ship);
  }
  saveGame?.();
  return true;
}

// ============================================================
// PERSONAL RECORDS TRACKING
// ============================================================
function recordKill(enemy) {
  personalRecords.totalKills++;
  const m = getMastery(typeof currentShipName !== "undefined" ? currentShipName : "Starlight");
  m.stats.kills++;
  m.stats.sessionKills++;
  addMasteryXP(currentShipName, 10);

  // Warden cost: enemy score * 3
  const score = (typeof ENEMIES !== "undefined" && ENEMIES[enemy?.type]?.score) || 0;
  personalRecords.wardenCost += score * 3;

  // Boss check
  const eSize = (typeof ENEMIES !== "undefined" && ENEMIES[enemy?.type]?.size) || 0;
  if (eSize >= 6 || enemy?.isShadowComet || enemy?.isShadowVengance) {
    personalRecords.bossesKilled++;
    _sessionStats.capitalKills = (_sessionStats.capitalKills || 0) + 1;
    if (enemy?.type === "Dreadnaught") personalRecords.dreadnaughtKills++;
  }

  // Session / wave stats
  _sessionStats.kills = (_sessionStats.kills || 0) + 1;
  _waveStats.kills    = (_waveStats.kills || 0) + 1;
  updateAccuracy();
}

function recordShotFired(cat) {
  personalRecords.shotsFired++;
  _sessionStats.shotsFired = (_sessionStats.shotsFired || 0) + 1;
  _waveStats.shotsFired    = (_waveStats.shotsFired || 0) + 1;
  getMastery(currentShipName).stats.shotsFired++;

  if (cat === "ballistic" || cat === "lc_ballistic") {
    personalRecords.ballisticShotsFired++;
    personalRecords.wardenCost += WARDEN_COSTS.bulletBallistic;
  }
  updateAccuracy();
}

function recordShotHit(cat, wasChain3) {
  personalRecords.shotsHit++;
  _sessionStats.shotsHit   = (_sessionStats.shotsHit || 0) + 1;
  _waveStats.shotsHit       = (_waveStats.shotsHit || 0) + 1;
  getMastery(currentShipName).stats.shotsHit++;
  if (wasChain3) personalRecords.chainHits3++;
  updateAccuracy();
}

function recordMissileFired() {
  personalRecords.wardenCost += WARDEN_COSTS.bulletMissile;
  _sessionStats.missilesFired = (_sessionStats.missilesFired || 0) + 1;
}

function recordAllyDeath(allyShipName) {
  personalRecords.alliesFallen++;
  const allyDef = (typeof ALLY_SHIP_DEFS !== "undefined") ? ALLY_SHIP_DEFS[allyShipName] : null;
  if (allyDef && allyDef.price && allyDef.price < 999990) {
    personalRecords.wardenCost += allyDef.price;
  }
}

function recordPlayerDeath() {
  personalRecords.deaths++;
  personalRecords.wardenCost += (typeof SHIPS !== "undefined" && SHIPS[currentShipName]?.price) || 0;
  getMastery(currentShipName).stats.neardDeaths++;
  addMasteryXP(currentShipName, 20); // near-death XP
  checkChallengeCondition("careerStat", { stat:"deaths", value: personalRecords.deaths });
}

function recordNearDeath() {
  // hp hit 0 but ship survived
  getMastery(currentShipName).stats.neardDeaths++;
  addMasteryXP(currentShipName, 100);
}

function recordBoostFrame() {
  personalRecords.boostFrames++;
  getMastery(currentShipName).stats.boostFrames++;
  addMasteryXP(currentShipName, 0.05);
  checkChallengeCondition("careerStat", { stat:"boostFrames", value: personalRecords.boostFrames });
}

function recordCreditsEarned(amount) {
  personalRecords.totalCreditsEarned += amount;
  checkChallengeCondition("careerStat", { stat:"totalCreditsEarned", value: personalRecords.totalCreditsEarned });
}

function updateAccuracy() {
  const fired = personalRecords.shotsFired;
  const hit   = personalRecords.shotsHit;
  personalRecords.shotsMissed = Math.max(0, fired - hit);
  personalRecords.accuracy    = fired > 0 ? (hit / fired) * 100 : 0;
}

// ── Wave end accounting ──
function recordWaveEnd(waveNum, hitless, allAlliesAlive, noMissiles, hullHitless) {
  if (typeof infiniteMode !== "undefined" && infiniteMode) {
    personalRecords.maxWave = Math.max(personalRecords.maxWave, waveNum);
    checkChallengeCondition("waveReach", { wave: waveNum, infinite: true });
  }
  if (hitless) {
    personalRecords.hitlessWaves++;
    if (waveNum >= 20) personalRecords.hitlessWaves20plus++;
  }
  const sessionAcc = _waveStats.shotsHit > 0 && (_waveStats.shotsHit / Math.max(1, _waveStats.shotsFired)) >= 0.8;
  if (sessionAcc && (_waveStats.shotsFired || 0) >= 10) personalRecords.highAccuracyWaves++;
  if (noMissiles) personalRecords.winsNoMissiles++;

  // ally count
  personalRecords.allyShipsOwned = Object.keys(typeof allyInventory !== "undefined" ? allyInventory : {})
    .filter(k => (allyInventory[k]||0) > 0).length;

  const mastery = getMastery(currentShipName);
  mastery.stats.wavesPlayed++;
  addMasteryXP(currentShipName, 50);

  // wave stat checks
  if (allAlliesAlive) _waveStats.allAlliesSurvived = 1;
  if (noMissiles)     _waveStats.noMissileWave      = 1;
  if (hullHitless)    _waveStats.hullHitlessWave    = 1;
  if (sessionAcc)     _waveStats.waveAccuracy80     = 1;

  // Mastery XP from kill-based play style direction
  const s = mastery.stats;
  if (s.boostFrames > 200) addMasteryXP(currentShipName, 10); // boost-heavy → speed token direction
  if (s.neardDeaths > 0)   addMasteryXP(currentShipName, 30); // tanky → hp/shield direction

  tickChallenges(waveNum);
  _waveStats = {}; // reset per-wave stats
  saveGame?.();
  submitLeaderboard?.();
}

function recordSessionEnd() {
  _sessionStats = {};
}

// ============================================================
// CHALLENGE ENGINE
// ============================================================
function initChallenges() {
  const today = new Date().toISOString().slice(0, 10);
  if (_dailyDateKey !== today) {
    _dailyDateKey = today;
    _dailyChallenges = drawDailyChallenges(today);
    _dailyCompleted  = {};
  }
}

function drawDailyChallenges(dateKey) {
  // Seed RNG with date
  let seed = 0;
  for (let i = 0; i < dateKey.length; i++) seed = (seed * 31 + dateKey.charCodeAt(i)) >>> 0;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
  const pool = [...DAILY_CHALLENGE_POOL];
  const chosen = [];
  while (chosen.length < 3 && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  return chosen;
}

function checkChallengeCondition(type, data) {
  // Fixed challenges
  FIXED_CHALLENGES.forEach(ch => {
    if (unlockedChallengeIds.includes(ch.id)) return;
    if (isChallengeConditionMet(ch, type, data)) {
      completeChallenge(ch);
    }
  });

  // Daily challenges
  _dailyChallenges.forEach(ch => {
    if (_dailyCompleted[ch.id]) return;
    if (isChallengeConditionMet(ch, type, data)) {
      completeDailyChallenge(ch);
    }
  });
}

function isChallengeConditionMet(ch, type, data) {
  const c = ch.condition;
  // Type must match
  if (c.type === "careerStat" && type === "careerStat") {
    return personalRecords[c.stat] >= c.value;
  }
  if (c.type === "sessionStat" && type === "sessionStat") {
    return (_sessionStats[c.stat] || 0) >= c.value;
  }
  if (c.type === "waveStat" && type === "waveStat") {
    return (_waveStats[c.stat] || 0) >= c.value;
  }
  if (c.type === "shipKills" && type === "shipKills") {
    if (c.ship !== data.ship) return false;
    return (getMastery(c.ship).stats.kills || 0) >= c.kills;
  }
  if (c.type === "sessionKills" && type === "sessionKills") {
    if (c.ship && c.ship !== (typeof currentShipName !== "undefined" ? currentShipName : "")) return false;
    return (_sessionStats.kills || 0) >= c.kills;
  }
  if (c.type === "waveReach" && type === "waveReach") {
    if (c.infinite && !(typeof infiniteMode !== "undefined" && infiniteMode)) return false;
    if (c.ship && c.ship !== (typeof currentShipName !== "undefined" ? currentShipName : "")) return false;
    return data.wave >= c.wave;
  }
  if (c.type === "sessionWaves" && type === "sessionWaves") {
    return (_sessionStats.wavesPlayed || 0) >= c.waves;
  }
  if (c.type === "surviveWaves" && type === "waveReach") {
    if (c.ship && c.ship !== (typeof currentShipName !== "undefined" ? currentShipName : "")) return false;
    if (c.noShipDeath && personalRecords.deaths > 0) return false;
    return data.wave >= c.waves;
  }
  if (c.type === "shadowBoss" && type === "shadowBoss") {
    if (c.boss !== data.boss) return false;
    if (c.hitless && !data.hitless) return false;
    if (c.requireFullUpgrade) {
      const ups = (typeof shipUpgrades !== "undefined" && shipUpgrades[c.requireFullUpgrade]) || {};
      const fullyUpgraded = ups.shieldTier >= 3 && ups.armorTier >= 3 && ups.engineTier >= 3;
      if (!fullyUpgraded) return false;
    }
    return true;
  }
  if (c.type === "masteryLevel" && type === "masteryLevel") {
    return data.level >= c.level;
  }
  if (c.type === "multi" && type === "multi") {
    return c.ids.every(id => unlockedChallengeIds.includes(id));
  }
  return false;
}

function completeChallenge(ch) {
  unlockedChallengeIds.push(ch.id);
  grantChallengeReward(ch.reward, ch.title);
  showNotification?.(`🏆 Challenge: ${ch.title}`, "#ffcc00");
  // Re-check multi-condition challenges that might depend on this
  FIXED_CHALLENGES.filter(c => c.condition.type === "multi").forEach(c => {
    if (!unlockedChallengeIds.includes(c.id)) checkChallengeCondition("multi", {});
  });
  saveGame?.();
}

function completeDailyChallenge(ch) {
  _dailyCompleted[ch.id] = true;
  grantChallengeReward(ch.reward, ch.title);
  showNotification?.(`📅 Daily: ${ch.title}`, "#44ffcc");
  saveGame?.();
}

function grantChallengeReward(reward, title) {
  switch (reward.type) {
    case "credits":
      if (typeof money !== "undefined") {
        money += reward.value;
        recordCreditsEarned(reward.value);
      }
      break;
    case "ship":
      if (typeof ownedShips !== "undefined" && !ownedShips.includes(reward.value)) {
        ownedShips.push(reward.value);
        showNotification?.(`🚀 Ship unlocked: ${reward.value}!`, "#00ffcc");
      }
      break;
    case "weapon":
      // Add size-specific weapon to weaponInventory
      if (typeof weaponInventory !== "undefined") {
        weaponInventory[reward.value] = (weaponInventory[reward.value] || 0) + 1;
      }
      break;
    case "title":
      if (!unlockedTitles.includes(reward.value)) {
        unlockedTitles.push(reward.value);
        showNotification?.(`🎖 Title unlocked: ${reward.value}!`, "#cc88ff");
      }
      break;
    case "thrusterShape":
      if (!unlockedThrusterShapes.includes(reward.value)) {
        unlockedThrusterShapes.push(reward.value);
        showNotification?.(`💫 Thruster shape: ${THRUSTER_SHAPES[reward.value]?.name}!`, "#8084ff");
      }
      break;
    case "thrusterColor":
      if (!unlockedThrusterColors.includes(reward.value)) {
        unlockedThrusterColors.push(reward.value);
        showNotification?.(`🎨 Thruster color unlocked!`, "#8084ff");
      }
      break;
  }
}

// ── Per-frame tickle from game loop ──
function tickChallenges(waveNum) {
  // Trigger wave-based challenge checks
  if (waveNum) {
    checkChallengeCondition("waveReach", { wave: waveNum });
    checkChallengeCondition("sessionWaves", {});
    checkChallengeCondition("waveStat", {});
    checkChallengeCondition("sessionKills", { kills: _sessionStats.kills||0 });
    checkChallengeCondition("sessionStat", {});
    checkChallengeCondition("careerStat", {});
    checkChallengeCondition("shipKills", { ship: currentShipName });
  }
}

// ── Session tracking ──
function tickSessionWave() {
  _sessionStats.wavesPlayed = (_sessionStats.wavesPlayed || 0) + 1;
}

// ============================================================
// THRUSTER SETTINGS
// ============================================================
function getThrusterColor(ship) {
  return thrusterSettings[ship]?.color || THRUSTER_DEFAULT_COLOR;
}
function getThrusterShape(ship) {
  return thrusterSettings[ship]?.shape || "classic";
}
function setThrusterColor(ship, color) {
  if (!thrusterSettings[ship]) thrusterSettings[ship] = {};
  thrusterSettings[ship].color = color;
  saveGame?.();
}
function setThrusterShape(ship, shape) {
  if (!thrusterSettings[ship]) thrusterSettings[ship] = {};
  thrusterSettings[ship].shape = shape;
  saveGame?.();
}
