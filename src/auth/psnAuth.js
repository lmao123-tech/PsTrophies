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


const crypto = require("crypto");
const {
    exchangeNpssoForAccessCode,
    exchangeAccessCodeForAuthTokens,
    exchangeRefreshTokenForAuthTokens,
    getProfileFromUserName
} = require("psn-api"); // library of reverse engineered SONY api's

const db = require("../../db");

const ALGO = "aes-256-gcm" // crypto algorithm
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "hex") // always 32 bytes

// Send SONY the NPSSO token they give you on log in to get access code(temp value only used to get tokens), then send that to get access token (1 hour), and refresh token (60 days, 1 time use)
async function exchangeNpssoForTokens(npsso) {
    const accessCode = await exchangeNpssoForAccessCode(npsso);
    return exchangeAccessCodeForAuthTokens(accessCode);
}

// First-time (or re-)link of a PSN account: trade the NPSSO for real tokens,
// pull the profile so we know who this is, upsert the user row, then store
// the encrypted tokens for that user. Returns only what the HTTP layer is
// allowed to hand back to the browser — never raw tokens.
async function linkPSNAccount(npsso) {
    const accountTokens = await exchangeNpssoForTokens(npsso);

    const profileResponse = await getProfileFromUserName(accountTokens, "me");
    const profile = profileResponse.profile ?? profileResponse;
    const {onlineId, accountId, avatarUrls} = profile;
    const avatarUrl = Array.isArray(avatarUrls) ? avatarUrls[0]?.avatarUrl : undefined;

    const userId = upsertUser({accountId, onlineId, avatarUrl});
    storeTokens(userId, accountTokens);

    return {userId, onlineId};
}

function upsertUser({accountId, onlineId, avatarUrl}) {
    const existing = db.prepare("SELECT id FROM users WHERE psn_account_id = ?").get(accountId);
    if (existing) {
        db.prepare("UPDATE users SET online_id = ? , avatar_url = ?, last_synced_at = datetime('now') WHERE id = ?").run(onlineId, avatarUrl ?? null, existing.id);
        return existing.id;
    }

    const id = crypto.randomUUID();
    db.prepare("INSERT INTO users (id, psn_account_id, online_id, avatar_url, last_synced_at) VALUES (?, ?, ?, ?, datetime('now'))").run(id, accountId, onlineId, avatarUrl ?? null);
    return id;
}

// First-time token store for a user we just linked. Separate from
// refreshAccessToken because there's no existing psn_auth_tokens row yet to
// SELECT a refresh token out of — this is the INSERT that creates that row
// (or overwrites it, if the account is being re-linked).
function storeTokens(userId, tokens) {
    const accessTokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
    const refreshTokenExpiresAt = new Date(Date.now() + tokens.refreshTokenExpiresIn * 1000).toISOString();

    db.prepare(
        `INSERT INTO psn_auth_tokens (user_id, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, needs_reauth, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
         ON CONFLICT (user_id) DO UPDATE SET
           access_token = excluded.access_token,
           refresh_token = excluded.refresh_token,
           access_token_expires_at = excluded.access_token_expires_at,
           refresh_token_expires_at = excluded.refresh_token_expires_at,
           needs_reauth = 0,
           updated_at = datetime('now')`
    ).run(
        userId,
        encryptToken(tokens.accessToken),
        encryptToken(tokens.refreshToken),
        accessTokenExpiresAt,
        refreshTokenExpiresAt
    );
}

function encryptToken(plainText) {
    const iv = crypto.randomBytes(12);// 12 random bytes to put into AES
    const cipher = crypto.createCipheriv(ALGO, KEY, iv); //Configure the AES algorithm (if using a different algorithm a value specifying the bytes is required GCM spits 16 out by default)
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]); //Create cipher block transfer the plaintext to bytes via utf8 and encrypt it with the cipher
    const authTag = cipher.getAuthTag(); // get the AUTH tag (made using GHASH which is an absolute black box of math to me, so I will just take it)
    return Buffer.concat([iv, authTag, encrypted]).toString("base64"); // store the whole thing in the db as plaintext via base64
}

//exact reverse path of the encrypt function the iv bytes are stored and are used to produce the same cipher and reverse the XOR back into plaintext
function decryptToken(cipherText) {
    const data = Buffer.from(cipherText, "base64"); // get the stored output of encrypt and revert it back to bytes
    const iv = data.subarray(0, 12);// first 12 is the IV we used
    const authTag = data.subarray(12, 28); // get the bytes after the iv. (If you aren't me and reading this the iv attaches to the front so we just get the authTag excluding the iv the block GCM spits out is 16 bytes by default)
    const encrypted = data.subarray(28); // actual encrypted text (0-11 iv; 12-27 Tag; 28 onward is the ciphered text itself)
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv); // make the same cipher we used to encrypt the text
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"); //// see if the Tag matches if not its tampering throw and error else return decrypted token

}

// send the refresh token to sony to get new refresh and access token
async function refreshAccessToken(userId) {
    const row = db.prepare("SELECT refresh_token FROM psn_auth_tokens WHERE user_id = ?").get(userId);
    if (!row) throw new Error(`No stored tokens for user ${userId}`);

    const refreshToken = decryptToken(row.refresh_token);

    let tokens;
    try {
        tokens = await exchangeRefreshTokenForAuthTokens(refreshToken);
    } catch (err) {
        db.prepare(
            "UPDATE psn_auth_tokens SET needs_reauth = 1, updated_at = datetime('now') WHERE user_id = ?"
        ).run(userId);
        throw err;
    }

    const accessTokenExpireAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
    const refreshTokenExpiresAt = new Date(Date.now() + tokens.refreshTokenExpiresIn * 1000).toISOString();

    db.prepare(
        "UPDATE psn_auth_tokens SET access_token = ?, refresh_token= ?, access_token_expires_at = ?, refresh_token_expires_at = ?, needs_reauth = 0, updated_at = datetime('now') WHERE user_id = ? "
    ).run(
        encryptToken(tokens.accessToken), encryptToken(tokens.refreshToken),
        accessTokenExpireAt, refreshTokenExpiresAt, userId
    );

    return {accessToken: tokens.accessToken, expiresAt: accessTokenExpireAt}
}

module.exports = {exchangeNpssoForTokens, refreshAccessToken, encryptToken, decryptToken, linkPSNAccount}
