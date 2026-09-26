// Read-only REST controller for the "friends" resource.
//
// There's no Friendship table (see pstrophies-architecture.md — deferred
// on purpose: a small closed, invite-only group is treated as mutually
// visible by default). So "userId's friends" is simply every other
// PsTrophies member, gated by each member's own visibility_settings —
// not a per-pair relationship. Add a real friendship table later only if
// that stops being true (e.g. the group grows past "everyone knows
// everyone").

const db = require("../../../db");

// GET /api/users/:userId/friends
// Light identity + visibility flags only — no per-friend stats here, to
// keep a list endpoint cheap as the member count grows. Use the detail
// endpoint below for one friend's actual numbers.
function listFriendsForUser(req, res) {
  const { userId } = req.params;

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const friends = db.prepare(`
    SELECT
      u.id, u.online_id, u.display_name, u.avatar_url, u.last_synced_at,
      COALESCE(vs.library_visible, 1) AS library_visible,
      COALESCE(vs.wishlist_visible, 1) AS wishlist_visible,
      COALESCE(vs.trophies_visible, 1) AS trophies_visible
    FROM users u
    LEFT JOIN visibility_settings vs ON vs.user_id = u.id
    WHERE u.id != ?
    ORDER BY u.online_id COLLATE NOCASE ASC
  `).all(userId);

  res.json(friends);
}

// GET /api/users/:userId/friends/:friendId
// One friend's profile + trophy stats — trophy counts are only included
// if that friend has trophies_visible on (defaults to visible, matching
// db/init.sql's column default).
function getFriendSummary(req, res) {
  const { userId, friendId } = req.params;

  if (userId === friendId) {
    return res.status(400).json({ error: "Use /api/users/:userId for your own profile, not /friends" });
  }

  const friend = db.prepare(`
    SELECT
      u.id, u.online_id, u.display_name, u.avatar_url, u.last_synced_at,
      COALESCE(vs.library_visible, 1) AS library_visible,
      COALESCE(vs.wishlist_visible, 1) AS wishlist_visible,
      COALESCE(vs.trophies_visible, 1) AS trophies_visible
    FROM users u
    LEFT JOIN visibility_settings vs ON vs.user_id = u.id
    WHERE u.id = ?
  `).get(friendId);

  if (!friend) return res.status(404).json({ error: "User not found" });

  const summary = {
    id: friend.id,
    online_id: friend.online_id,
    display_name: friend.display_name,
    avatar_url: friend.avatar_url,
    last_synced_at: friend.last_synced_at,
    library_visible: !!friend.library_visible,
    wishlist_visible: !!friend.wishlist_visible,
    trophies_visible: !!friend.trophies_visible,
  };

  if (friend.trophies_visible) {
    summary.game_count = db
      .prepare("SELECT COUNT(*) AS c FROM trophy_progress WHERE user_id = ?")
      .get(friendId).c;
    summary.platinum_count = db
      .prepare("SELECT COUNT(*) AS c FROM trophy_progress WHERE user_id = ? AND platinum_earned = 1")
      .get(friendId).c;
  }

  res.json(summary);
}

module.exports = { listFriendsForUser, getFriendSummary };
