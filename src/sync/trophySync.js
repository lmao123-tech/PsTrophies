// Responsibility: pull trophyTitles / trophySummary / earned-trophy detail
// for the logged-in ("self") user, upsert into the games + trophy_progress
// tables (see db/init.sql).
//
// Reference: sony-psn-api-research.md — endpoints, pagination caps (~800/req,
// max 5 titles per batch summary call), and the note that this is the
// best-documented part of the API (psn-api / psnawp both wrap it, worth
// leaning on one of those rather than re-implementing raw HTTP calls).
//
// Expected export:
//   syncTrophiesForUser(userId) -> writes a sync_logs row, returns summary

module.exports = {
  // syncTrophiesForUser,
};
