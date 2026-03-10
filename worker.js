// worker.js — Arena Evolution Leaderboard
// Deploy to Cloudflare Workers. Needs a KV namespace bound as LEADERBOARD.
//
// Deploy steps:
//   1. npm install -g wrangler
//   2. wrangler login
//   3. wrangler kv:namespace create LEADERBOARD
//      → copy the id into wrangler.toml
//   4. wrangler deploy
//
// wrangler.toml:
// -------------------------------------------------------
// name = "arena-evolution"
// main = "worker.js"
// compatibility_date = "2024-01-01"
//
// [[kv_namespaces]]
// binding = "LEADERBOARD"
// id = "<paste-id-here>"
// -------------------------------------------------------

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const VALID_CATS = ["kills", "money", "accuracy", "waves", "wardenCost"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // POST /submit — { username, entries: { kills, money, accuracy, waves, wardenCost } }
    if (request.method === "POST" && url.pathname === "/submit") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
      const { username, entries } = body;
      if (!username || typeof entries !== "object") return json({ error: "missing fields" }, 400);

      // Load existing entry for this user, update if better
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
        existing.username = username; // preserve display name casing
        await env.LEADERBOARD.put(userKey, JSON.stringify(existing));
      }
      return json({ ok: true });
    }

    // GET /top?cat=kills&n=10
    if (request.method === "GET" && url.pathname === "/top") {
      const cat = url.searchParams.get("cat");
      const n   = Math.min(50, parseInt(url.searchParams.get("n") || "10"));
      if (!VALID_CATS.includes(cat)) return json({ error: "invalid category" }, 400);

      // List all user keys and fetch their values
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
