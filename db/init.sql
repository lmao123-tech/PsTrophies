-- Plain SQL, run on every startup ("CREATE TABLE IF NOT EXISTS" — idempotent,
-- safe to re-run). See pstrophies-architecture.md for the narrative version
-- of every table (why each field exists, sync strategy, etc). snake_case
-- columns since this is now hand-written SQL, not a generated client.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  psn_account_id  TEXT NOT NULL UNIQUE,
  online_id       TEXT NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_synced_at  TEXT
);

-- 1:1 with users. access_token/refresh_token are ENCRYPTED at the
-- application layer (see src/auth/psnAuth.js) — never store them plain.
CREATE TABLE IF NOT EXISTS psn_auth_tokens (
  user_id                   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token              TEXT NOT NULL,
  refresh_token             TEXT NOT NULL,
  access_token_expires_at   TEXT NOT NULL,
  refresh_token_expires_at  TEXT NOT NULL,
  needs_reauth              INTEGER NOT NULL DEFAULT 0,
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Canonical game row. Reconciliation note: Sony's trophy API keys games by
-- npCommunicationId, the library/purchase API keys by npTitleId, and
-- PlatPrices has its own catalog id — three ID systems that don't share a
-- key. Matched by normalized_title+platform at sync time (see
-- src/utils/normalizeTitle.js); all three IDs kept nullable on one row.
CREATE TABLE IF NOT EXISTS games
(
    id                  TEXT PRIMARY KEY,
    np_communication_id TEXT UNIQUE,
    np_title_id         TEXT UNIQUE,
    platprices_id       TEXT UNIQUE,
    title               TEXT NOT NULL,
    normalized_title    TEXT NOT NULL,
    platform            TEXT,
    cover_image_url     TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);


CREATE UNIQUE INDEX IF NOT EXISTS idx_games_unclaimed_title_platform
    ON games (normalized_title, platform)
    WHERE np_communication_id IS NULL;

-- A user owns a game (from getPurchasedGameList).
CREATE TABLE IF NOT EXISTS library_entries (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id            TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  source             TEXT NOT NULL DEFAULT 'unknown' CHECK (source IN ('purchase', 'ps_plus', 'unknown')),
  first_seen_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_confirmed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, game_id)
);

-- A user's trophy state for a game (from trophyTitles/earned-trophy calls).
-- Independent of library_entries — a game can have one without the other
-- (owned-but-unplayed) or both.
CREATE TABLE IF NOT EXISTS trophy_progress (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id          TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  platinum_earned  INTEGER NOT NULL DEFAULT 0,
  bronze           INTEGER NOT NULL DEFAULT 0,
  silver           INTEGER NOT NULL DEFAULT 0,
  gold             INTEGER NOT NULL DEFAULT 0,
  platinum         INTEGER NOT NULL DEFAULT 0,
  completion_pct   REAL NOT NULL DEFAULT 0,
  last_trophy_at   TEXT,
  last_synced_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, game_id)
);

-- PsTrophies-native, not pulled from PSN.
CREATE TABLE IF NOT EXISTS wishlist_entries (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id   TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  note      TEXT,
  priority  INTEGER NOT NULL DEFAULT 0,
  added_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, game_id)
);

-- PsTrophies' own privacy layer, independent of Sony's. 1:1 with users.
CREATE TABLE IF NOT EXISTS visibility_settings (
  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  library_visible  INTEGER NOT NULL DEFAULT 1,
  wishlist_visible INTEGER NOT NULL DEFAULT 1,
  trophies_visible INTEGER NOT NULL DEFAULT 1
);

-- Operational visibility into an inherently flaky (undocumented) upstream.
CREATE TABLE IF NOT EXISTS sync_logs (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sync_type      TEXT NOT NULL CHECK (sync_type IN ('trophies', 'library')),
  status         TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  started_at     TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at    TEXT,
  error_message  TEXT
);
