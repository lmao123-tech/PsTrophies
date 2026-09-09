// Responsibility: NPSSO -> access/refresh token exchange, proactive token
// refresh, and encrypt/decrypt of stored tokens (the psn_auth_tokens table
// — see db/init.sql).
//
// Reference: sony-psn-api-research.md in the project docs — auth flow,
// token lifetimes (~60 day NPSSO/refresh, ~1hr access token), and why
// tokens must be treated as password-equivalent (encrypt at rest, never log).
//
// Not implemented here — this is the module boundary for the IDE-based
// implementation pass. Talk to the DB via `require("../../db")` and plain
// SQL (db.prepare(sql).run/get/all — see db/seed.js for examples of the
// pattern). Expected exports, to be filled in:
//
//   exchangeNpssoForTokens(npsso) -> { accessToken, refreshToken, expiresAt }
//   refreshAccessToken(userId) -> { accessToken, expiresAt } | throws if refresh token dead
//   encryptToken(plain) / decryptToken(cipher) -> uses TOKEN_ENCRYPTION_KEY from env

module.exports = {
  // exchangeNpssoForTokens,
  // refreshAccessToken,
  // encryptToken,
  // decryptToken,
};
