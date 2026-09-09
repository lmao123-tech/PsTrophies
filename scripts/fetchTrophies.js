// One-off proof-of-concept: prove we can pull real data from Sony's
// (undocumented) PSN API for OUR OWN account and store it in our own DB.
// This is step 1 of "Phased build plan" in pstrophies-architecture.md
// ("prove the Sony fetch works") — not wired into src/server.js/routes yet,
// just a script you run by hand.
//
// Setup (one time):
//   1. Get your NPSSO — it's a session credential, treat it like a
//      password. Never commit it, never paste it anywhere but your own
//      .env. See .env.example for the exact steps to obtain one.
//   2. Put it in .env as PSN_NPSSO="...".
//
// Run:
//   npm run poc:fetch
//
// What it does:
//   NPSSO -> access/refresh tokens (via the psn-api package) -> fetch your
//   own profile + trophyTitles -> upsert into users/games/trophy_progress
//   via db/index.js (plain SQL, no ORM). Logs one row to sync_logs either
//   way so failures are visible in the DB too, not just the console.

require("dotenv").config();
const crypto = require("crypto");
const {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getProfileFromUserName,
  getUserTitles,
} = require("psn-api");
const db = require("../db");

async function main() {
  const npsso = process.env.PSN_NPSSO;
  if (!npsso) {
    console.error(
      "Missing PSN_NPSSO in .env. See .env.example for how to get one " +
        "(log into playstation.com, then visit " +
        "https://ca.account.sony.com/api/v1/ssocookie, copy the npsso value)."
    );
    process.exit(1);
  }

  console.log("Exchanging NPSSO for access/refresh tokens...");
  const accessCode = await exchangeNpssoForAccessCode(npsso);
  const authorization = await exchangeAccessCodeForAuthTokens(accessCode);
  console.log(
    `Got tokens. Access token expires in ${authorization.expiresIn}s, ` +
      `refresh token in ${authorization.refreshTokenExpiresIn}s.`
  );

  console.log("Fetching own profile...");
  const profileResponse = await getProfileFromUserName(authorization, "me");
  const profile = profileResponse.profile ?? profileResponse;
  const { onlineId, accountId, avatarUrls } = profile;
  const avatarUrl = Array.isArray(avatarUrls) ? avatarUrls[0]?.avatarUrl : undefined;
  console.log(`Logged in as ${onlineId} (accountId ${accountId})`);

  let userId;
  try {
    userId = upsertUser({ accountId, onlineId, avatarUrl });

    console.log("Fetching trophy titles...");
    const { trophyTitles } = await getUserTitles(authorization, "me");
    console.log(`Got ${trophyTitles.length} titles. Storing...`);

    for (const t of trophyTitles) {
      const gameId = upsertGame(t);
      upsertTrophyProgress(userId, gameId, t);
    }

    logSync(userId, "ok", null);
    console.log(`Done. Stored trophy progress for ${trophyTitles.length} games (${onlineId}).`);
  } catch (err) {
    if (userId) logSync(userId, "error", String(err.message || err));
    throw err;
  }
}

function upsertUser({ accountId, onlineId, avatarUrl }) {
  const existing = db.prepare("SELECT id FROM users WHERE psn_account_id = ?").get(accountId);
  if (existing) {
    db.prepare(
      "UPDATE users SET online_id = ?, avatar_url = ?, last_synced_at = datetime('now') WHERE id = ?"
    ).run(onlineId, avatarUrl ?? null, existing.id);
    return existing.id;
  }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, psn_account_id, online_id, avatar_url, last_synced_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(id, accountId, onlineId, avatarUrl ?? null);
  return id;
}

function upsertGame(t) {
  const existing = db
    .prepare("SELECT id FROM games WHERE np_communication_id = ?")
    .get(t.npCommunicationId);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO games (id, np_communication_id, title, platform, cover_image_url)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, t.npCommunicationId, t.trophyTitleName, t.trophyTitlePlatform ?? null, t.trophyTitleIconUrl ?? null);
  return id;
}

function upsertTrophyProgress(userId, gameId, t) {
  const earned = t.earnedTrophies ?? {};
  const platinumEarned = (earned.platinum ?? 0) > 0 ? 1 : 0;
  const bronze = earned.bronze ?? 0;
  const silver = earned.silver ?? 0;
  const gold = earned.gold ?? 0;
  const platinum = earned.platinum ?? 0;
  const completionPct = t.progress ?? 0;

  const existing = db
    .prepare("SELECT id FROM trophy_progress WHERE user_id = ? AND game_id = ?")
    .get(userId, gameId);

  if (existing) {
    db.prepare(
      `UPDATE trophy_progress
       SET platinum_earned = ?, bronze = ?, silver = ?, gold = ?, platinum = ?,
           completion_pct = ?, last_synced_at = datetime('now')
       WHERE id = ?`
    ).run(platinumEarned, bronze, silver, gold, platinum, completionPct, existing.id);
    return existing.id;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO trophy_progress
       (id, user_id, game_id, platinum_earned, bronze, silver, gold, platinum, completion_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, gameId, platinumEarned, bronze, silver, gold, platinum, completionPct);
  return id;
}

function logSync(userId, status, errorMessage) {
  db.prepare(
    `INSERT INTO sync_logs (id, user_id, sync_type, status, finished_at, error_message)
     VALUES (?, ?, 'trophies', ?, datetime('now'), ?)`
  ).run(crypto.randomUUID(), userId, status, errorMessage);
}

main().catch((err) => {
  console.error("Fetch failed:", err.message || err);
  process.exit(1);
});
