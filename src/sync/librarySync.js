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


const {getPurchasedGames} = require("psn-api");
const db = require("../../db");
const crypto = require("crypto");
const {refreshAccessToken} = require("../auth/psnAuth");
const {normalizeTitle} = require("../utils/normalizeTitle");
const e = require("express");

const PAGE_SIZE = 100;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllPurchasedGames(authorization) {
    const all = [];
    let start = 0;

    for (; ;) {
        const game = await getPurchasedGames(authorization, {start, size: PAGE_SIZE});
        const games = game.data.purchasedTitlesRetrieve.games
        all.push(...games)
        console.log(` page at start ${start}: ${games.length} games (running total) ${all.length}`);

        if (games.length < PAGE_SIZE) break;
        start += PAGE_SIZE;
        await sleep(300);
    }
    return all;

}

function upsertGameFromLibrary(game) {
    const normalizedTitle = normalizeTitle(game.name);

    const byTitleId = db.prepare("SELECT id FROM games WHERE np_title_id = ?").get(game.titleId);
    if (byTitleId) return byTitleId.id;

    const byTitleAndPlatform = db.prepare("SELECT id FROM games WHERE normalized_title = ? AND platform = ? AND np_title_id IS NULL ").get(normalizedTitle, game.platform);
    if (byTitleAndPlatform) {
        db.prepare("UPDATE games SET np_title_id = ? WHERE id = ?").run(game.titleId, byTitleAndPlatform.id);
        return byTitleAndPlatform.id;
    }

    const id = crypto.randomUUID();
    db.prepare("INSERT INTO games (id, np_title_id, title, normalized_title, platform, cover_image_url) VALUES(?,?,?,?,?,?) ").run(id, game.titleId, game.name, normalizedTitle, game.platform ?? null, game.image?.url ?? null);
    return id;
}

function upsertLibraryEntry(userId, gameId, game) {
    const exists = db.prepare("SELECT game_id FROM library_entries WHERE user_id = ? AND game_id =?").get(userId, gameId);
    if (exists) {
        db.prepare("UPDATE library_entries SET last_confirmed_at = datetime('now') WHERE user_id =? AND game_id = ?").run(userId, gameId);
        return {userId, gameId};
    }

    const source = game.membership === "PS_PLUS" ? "ps_plus" : "purchase";
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO library_entries (id,user_id,game_id,source,last_confirmed_at) VALUES(?,?,?,?,datetime('now'))").run(id, userId, gameId, source);
    return id;


}

function logSync(userId, status, errorMessage) {
    db.prepare(`INSERT INTO sync_logs (id, user_id, sync_type, status, finished_at, error_message)
                VALUES (?, ?, 'library', ?, datetime('now'),
                        ?)`).run(crypto.randomUUID(), userId, status, errorMessage);
}

async function syncLibraryForUser(userId) {
    try {
        const {accessToken} = await refreshAccessToken(userId);
        const purchasedGames = await fetchAllPurchasedGames({accessToken});
        for (const g of purchasedGames) {
            const gameId = upsertGameFromLibrary(g);
            upsertLibraryEntry(userId, gameId, g);
        }
        logSync(userId, "ok", null);
        return {userId, gamesSynced: purchasedGames.length};
    } catch (err) {
        logSync(userId, "error", String(err.message || err));
        throw err;
    }
}

module.exports = {syncLibraryForUser};
