// Read-only REST controller for the "games" resource.
//
// No login/session system exists yet (see psnAuth.js — that's Sony token
// exchange, not a site session), so per-user endpoints take :userId
// straight from the URL instead of a logged-in session. Swap that for
// req.user.id once real auth exists — every function below already takes
// userId as a plain argument, so the change is contained to the routes.
//
// Plain SQL via db/index.js, same pattern as every other module — see
// pstrophies-architecture.md.

const db = require("../../../db");

// GET /api/games?search=  — the whole catalog (every game any member has
// ever synced), not scoped to a user. Useful for "does this game exist in
// our DB yet" lookups and, later, search-to-wishlist.
function listGames(req, res) {
  const { search } = req.query;
  let sql = "SELECT id, title, platform, cover_image_url, np_communication_id, np_title_id FROM games";
  const args = [];
  if (search) {
    sql += " WHERE title LIKE ? COLLATE NOCASE";
    args.push(`%${search}%`);
  }
  sql += " ORDER BY title COLLATE NOCASE ASC";
  res.json(db.prepare(sql).all(...args));
}

// GET /api/games/:gameId — a single game, no user-specific data.
function getGame(req, res) {
  const { gameId } = req.params;
  const game = db.prepare("SELECT * FROM games WHERE id = ?").get(gameId);
  if (!game) return res.status(404).json({ error: "Game not found" });
  res.json(game);
}

// GET /api/users/:userId/games?platinum=true&search=
// A user's trophy library: every game they have trophy_progress for,
// left-joined with library_entries (still null for everyone until
// librarySync.js exists — that's fine, the shape is ready for it).
function listGamesForUser(req, res) {
  const { userId } = req.params;
  const { platinum, search } = req.query;

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  let sql = `
    SELECT
      g.id, g.title, g.platform, g.cover_image_url,
      g.np_communication_id, g.np_title_id,
      tp.platinum_earned, tp.bronze, tp.silver, tp.gold, tp.platinum,
      tp.completion_pct, tp.last_trophy_at, tp.last_synced_at,
      le.source AS library_source
    FROM trophy_progress tp
    JOIN games g ON g.id = tp.game_id
    LEFT JOIN library_entries le ON le.game_id = g.id AND le.user_id = tp.user_id
    WHERE tp.user_id = ?
  `;
  const args = [userId];

  if (platinum === "true") sql += " AND tp.platinum_earned = 1";
  else if (platinum === "false") sql += " AND tp.platinum_earned = 0";

  if (search) {
    sql += " AND g.title LIKE ? COLLATE NOCASE";
    args.push(`%${search}%`);
  }

  sql += " ORDER BY g.title COLLATE NOCASE ASC";

  res.json(db.prepare(sql).all(...args));
}

// GET /api/users/:userId/games/:gameId
// One game from this user's point of view: trophy progress, library
// status, and their own wishlist note if they'd wishlisted it before
// getting it — all optional (left joins), since a user can view a game's
// page before having any personal data on it yet.
function getGameForUser(req, res) {
  const { userId, gameId } = req.params;

  const game = db.prepare(`
    SELECT
      g.id, g.title, g.platform, g.cover_image_url,
      g.np_communication_id, g.np_title_id,
      tp.platinum_earned, tp.bronze, tp.silver, tp.gold, tp.platinum,
      tp.completion_pct, tp.last_trophy_at, tp.last_synced_at,
      le.source AS library_source,
      we.note AS wishlist_note, we.priority AS wishlist_priority
    FROM games g
    LEFT JOIN trophy_progress tp ON tp.game_id = g.id AND tp.user_id = ?
    LEFT JOIN library_entries le ON le.game_id = g.id AND le.user_id = ?
    LEFT JOIN wishlist_entries we ON we.game_id = g.id AND we.user_id = ?
    WHERE g.id = ?
  `).get(userId, userId, userId, gameId);

  if (!game) return res.status(404).json({ error: "Game not found" });
  res.json(game);
}

module.exports = { listGames, getGame, listGamesForUser, getGameForUser };
