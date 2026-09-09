// Responsibility: thin wrapper around the PlatPrices API (platprices.com/developers.php)
// for Store browsing / wishlist-add search — title, box art, price, genre.
// Free tier: 1,000 req/month, 2 regions. Keep this isolated from the Sony
// account-auth code entirely; it's a separate API key (PLATPRICES_API_KEY),
// separate rate limit, and much lower-stakes data (public product info).
//
// Expected exports:
//   searchGames(query) -> [{ platpricesId, title, coverImageUrl, price, ... }]
//   getGameDetails(platpricesId) -> full metadata for one title

module.exports = {
  // searchGames,
  // getGameDetails,
};
