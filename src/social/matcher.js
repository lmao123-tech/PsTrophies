// Responsibility: for a given user's wishlist, cross-reference against
// visible friends' library_entries rows to answer "does a friend already
// own this?" — computed entirely against our own DB, never a live Sony
// lookup (see architecture doc's "Library / who owns what" section for why
// — there's no native PSN feature for this, so we don't depend on one).
//
// Respects each candidate friend's visibility_settings.library_visible.
// See db/seed.js's mock data + the sample query in that file's commit
// history for exactly the join shape this needs.
//
// Expected export:
//   findFriendOwnersForWishlist(userId) -> [{ wishlistEntryId, gameId, ownedByUserIds: [...] }]

module.exports = {
  // findFriendOwnersForWishlist,
};
