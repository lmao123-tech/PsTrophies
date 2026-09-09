// Mock/dev seed data. Safe to re-run (INSERT OR IGNORE + upsert-by-hand
// throughout) — this is what you run after wiping/recreating db/dev.db so
// there's something realistic to poke at without needing real PSN auth
// wired up yet.
//
// Run with: npm run db:seed

const crypto = require("crypto");
const db = require("./index");

function upsertUser({ psnAccountId, onlineId, displayName }) {
  const existing = db.prepare("SELECT id FROM users WHERE psn_account_id = ?").get(psnAccountId);
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO users (id, psn_account_id, online_id, display_name) VALUES (?, ?, ?, ?)"
  ).run(id, psnAccountId, onlineId, displayName);
  db.prepare("INSERT INTO visibility_settings (user_id) VALUES (?)").run(id);
  return id;
}

function upsertGame({ npCommunicationId, title, platform }) {
  const existing = db.prepare("SELECT id FROM games WHERE np_communication_id = ?").get(npCommunicationId);
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO games (id, np_communication_id, title, platform) VALUES (?, ?, ?, ?)"
  ).run(id, npCommunicationId, title, platform);
  return id;
}

function upsertLibraryEntry(userId, gameId, source) {
  db.prepare(
    `INSERT INTO library_entries (id, user_id, game_id, source)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, game_id) DO UPDATE SET source = excluded.source`
  ).run(crypto.randomUUID(), userId, gameId, source);
}

function upsertTrophyProgress(userId, gameId, stats) {
  db.prepare(
    `INSERT INTO trophy_progress (id, user_id, game_id, platinum_earned, bronze, silver, gold, platinum, completion_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, game_id) DO UPDATE SET
       platinum_earned = excluded.platinum_earned,
       bronze = excluded.bronze, silver = excluded.silver,
       gold = excluded.gold, platinum = excluded.platinum,
       completion_pct = excluded.completion_pct`
  ).run(
    crypto.randomUUID(), userId, gameId,
    stats.platinumEarned ? 1 : 0, stats.bronze, stats.silver, stats.gold, stats.platinum, stats.completionPct
  );
}

function upsertWishlistEntry(userId, gameId, note, priority) {
  db.prepare(
    `INSERT INTO wishlist_entries (id, user_id, game_id, note, priority)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, game_id) DO UPDATE SET note = excluded.note, priority = excluded.priority`
  ).run(crypto.randomUUID(), userId, gameId, note, priority);
}

const me = upsertUser({ psnAccountId: "mock-psn-account-me", onlineId: "kalojan_mock", displayName: "Kalojan (mock)" });
const friend = upsertUser({ psnAccountId: "mock-psn-account-friend", onlineId: "friend_mock", displayName: "Friend (mock)" });

const bloodborne = upsertGame({ npCommunicationId: "NPWR10788_00", title: "Bloodborne", platform: "PS4" });
const eldenRing = upsertGame({ npCommunicationId: "NPWR20188_00", title: "Elden Ring", platform: "PS5" });
const astroBot = upsertGame({ npCommunicationId: "NPWR23073_00", title: "Astro Bot", platform: "PS5" });

// Friend owns Elden Ring; I don't — this is the case src/social/matcher.js
// is meant to surface.
upsertLibraryEntry(friend, eldenRing, "purchase");
upsertLibraryEntry(me, bloodborne, "purchase");
upsertTrophyProgress(me, bloodborne, { platinumEarned: true, bronze: 12, silver: 5, gold: 3, platinum: 1, completionPct: 100 });

// I want Elden Ring — the matcher should say "friend already owns this."
upsertWishlistEntry(me, eldenRing, "Ask friend before buying — check if they still have it installed.", 1);
upsertWishlistEntry(me, astroBot, null, 0);

console.log("Seed complete:", { me: "kalojan_mock", friend: "friend_mock" });
