// Responsibility: pull the user's TRUE owned-games list (independent of
// trophies) and upsert into the games + library_entries tables (see
// db/init.sql).
//
// Reference: sony-psn-api-research.md — this is the `getPurchasedGameList`
// GraphQL operation at web.np.playstation.com/api/graphql/v1/op. Not wrapped
// by psn-api/psnawp; reference the GOG Galaxy PSN plugin's source
// (github.com/FriendsOfGalaxy/galaxy-integration-psn) for the exact request
// shape. MUST paginate explicitly via `start`/`size` variables — omitting
// them silently caps results at ~50 games (see that project's issue #29).
//
// Expected export:
//   syncLibraryForUser(userId) -> writes a sync_logs row, returns summary

module.exports = {
  // syncLibraryForUser,
};
