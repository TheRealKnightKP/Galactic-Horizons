// worker.js — Galactic Horizons Backend
// KV bindings: LEADERBOARD (for scores + accounts)
// Endpoints:
//   POST /register   { username, passwordHash }
//   POST /login      { username, passwordHash }
//   POST /delete     { username, passwordHash }
//   POST /submit     { username, entries: { kills, money, accuracy, waves, wardenCost } }
//   GET  /top?cat=X&n=10

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const VALID_CATS = ["kills", "money", "accuracy", "waves", "wardenCost"];
const ADMIN_USER = "therealknightadmin";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // POST /register
    if (request.method === "POST" && url.pathname === "/register") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
      const { username, passwordHash } = body;
      if (!username || !passwordHash) return json({ error: "missing fields" }, 400);
      const key = `acct:${username.toLowerCase()}`;
      if (username.toLowerCase() === ADMIN_USER) return json({ error: "Username reserved" }, 400);
      const existing = await env.LEADERBOARD.get(key);
      if (existing) return json({ error: "Username already taken" }, 409);
      await env.LEADERBOARD.put(key, JSON.stringify({ username, passwordHash, createdAt: Date.now() }));
      return json({ ok: true, username });
    }

    // POST /login
    if (request.method === "POST" && url.pathname === "/login") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
      const { username, passwordHash } = body;
      if (!username || !passwordHash) return json({ error: "missing fields" }, 400);
      const key = `acct:${username.toLowerCase()}`;
      const raw = await env.LEADERBOARD.get(key);
      if (!raw) return json({ error: "Account not found" }, 404);
      const acct = JSON.parse(raw);
      if (acct.passwordHash !== passwordHash) return json({ error: "Wrong password" }, 401);
      return json({ ok: true, username: acct.username });
    }

    // POST /delete
    if (request.method === "POST" && url.pathname === "/delete") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
      const { username, passwordHash } = body;
      if (!username || !passwordHash) return json({ error: "missing fields" }, 400);
      if (username.toLowerCase() === ADMIN_USER) return json({ error: "Cannot delete admin" }, 403);
      const key = `acct:${username.toLowerCase()}`;
      const raw = await env.LEADERBOARD.get(key);
      if (!raw) return json({ error: "Account not found" }, 404);
      const acct = JSON.parse(raw);
      if (acct.passwordHash !== passwordHash) return json({ error: "Wrong password" }, 401);
      await env.LEADERBOARD.delete(key);
      await env.LEADERBOARD.delete(`user:${username.toLowerCase()}`);
      return json({ ok: true });
    }

    // POST /submit
    if (request.method === "POST" && url.pathname === "/submit") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
      const { username, passwordHash, entries } = body;
      if (!username || typeof entries !== "object") return json({ error: "missing fields" }, 400);
      // Verify account owns this username (skip for admin)
      if (username.toLowerCase() !== ADMIN_USER && passwordHash) {
        const acct = await env.LEADERBOARD.get(`acct:${username.toLowerCase()}`, "json");
        if (!acct || acct.passwordHash !== passwordHash) return json({ error: "Auth failed" }, 401);
      }
      const userKey = `user:${username.toLowerCase()}`;
      const existing = await env.LEADERBOARD.get(userKey, "json") || {};
      let updated = false;
      for (const cat of VALID_CATS) {
        const val = parseFloat(entries[cat]);
        if (!isNaN(val) && (existing[cat] === undefined || val > existing[cat])) {
          existing[cat] = val;
          updated = true;
        }
      }
      if (updated) {
        existing.username = username;
        await env.LEADERBOARD.put(userKey, JSON.stringify(existing));
      }
      return json({ ok: true });
    }

    // GET /top?cat=kills&n=10
    if (request.method === "GET" && url.pathname === "/top") {
      const cat = url.searchParams.get("cat");
      const n   = Math.min(50, parseInt(url.searchParams.get("n") || "10"));
      if (!VALID_CATS.includes(cat)) return json({ error: "invalid category" }, 400);
      const list = await env.LEADERBOARD.list({ prefix: "user:" });
      const entries = await Promise.all(
        list.keys.map(k => env.LEADERBOARD.get(k.name, "json"))
      );
      const valid = entries
        .filter(e => e && e[cat] !== undefined)
        .sort((a, b) => (b[cat] || 0) - (a[cat] || 0))
        .slice(0, n)
        .map((e, i) => ({ rank: i + 1, username: e.username, value: e[cat] }));
      return json(valid);
    }

    return json({ error: "not found" }, 404);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
