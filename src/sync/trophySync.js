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

const {
    getUserTitles
} = require("psn-api")
const db = require("../../db");
const crypto = require("crypto");
const {refreshAccessToken} = require("../auth/psnAuth");
const {normalizeTitle} = require("../utils/normalizeTitle")


const PAGE_SIZE = 100; // psn-api's default page size for getUserTitles

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// getUserTitles only ever returns one page (PAGE_SIZE titles) per call.
// nextOffset tells us whether there's more — present + numeric means keep
// going, undefined/null means we've hit the end. A small delay between
// pages is just being polite to an undocumented API we don't want to hammer
// (see the ban-risk discussion in sony-psn-api-research.md).
async function fetchAllTrophyTitles(authorization) {
    const all = [];
    let offset = 0;

    for (; ;) {
        const page = await getUserTitles(authorization, "me", {limit: PAGE_SIZE, offset});
        all.push(...page.trophyTitles);
        console.log(`  page at offset ${offset}: ${page.trophyTitles.length} titles (running total ${all.length})`);

        if (page.nextOffset === undefined || page.nextOffset === null || page.trophyTitles.length === 0) {
            break;
        }
        offset = page.nextOffset;
        await sleep(300);
    }

    return all;
}

function upsertGame(title) {
    const normalizedTitle = normalizeTitle(title.trophyTitleName)
    const byCommunicationId = db
        .prepare("SELECT id FROM games WHERE np_communication_id = ?")
        .get(title.npCommunicationId);
    if (byCommunicationId) return byCommunicationId.id;

    // Only matches an "unclaimed" row (np_communication_id IS NULL) — i.e. one
    // librarySync.js created from purchase data alone. A row that already has
    // its own npCommunicationId is a distinct, real trophy list and must never
    // be merged into by title/platform alone (see: Fall Guys' legacy + relaunch
    // trophy lists, which share a title+platform but are genuinely different).
    const byTitleAndPlatform = db
        .prepare("SELECT id FROM games WHERE normalized_title = ? AND platform = ? AND np_communication_id IS NULL")
        .get(normalizedTitle, title.trophyTitlePlatform);

    if (byTitleAndPlatform) {
        db.prepare("UPDATE games SET np_communication_id = ? WHERE id = ?").run(title.npCommunicationId, byTitleAndPlatform.id);
        return byTitleAndPlatform.id;
    }

    const id = crypto.randomUUID();
    db.prepare("INSERT INTO games (id, np_communication_id, title, normalized_title, platform, cover_image_url) VALUES(?,?,?,?,?,?)").run(id,title.npCommunicationId,title.trophyTitleName,normalizedTitle,title.trophyTitlePlatform ?? null ,title.trophyTitleIconUrl ?? null);
    return id;
}

function upsertTrophyProgress(userId, gameId, t) {
    const earned = t.earnedTrophies ?? {};
    const platinumEarned = (earned.platinum ?? 0) > 0 ? 1 : 0;
    const bronze = earned.bronze ?? 0;
    const silver = earned.silver ?? 0;
    const gold = earned.gold ?? 0;
    const platinum = earned.platinum ?? 0;
    const completionPct = t.progress ?? 0;

    const existing = db
        .prepare("SELECT id FROM trophy_progress WHERE user_id = ? AND game_id = ?")
        .get(userId, gameId);

    if (existing) {
        db.prepare(`UPDATE trophy_progress
                    SET platinum_earned = ?,
                        bronze          = ?,
                        silver          = ?,
                        gold            = ?,
                        platinum        = ?,
                        completion_pct  = ?,
                        last_synced_at  = datetime('now')
                    WHERE id = ?`).run(platinumEarned, bronze, silver, gold, platinum, completionPct, existing.id);
        return existing.id;
    }

    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO trophy_progress
                (id, user_id, game_id, platinum_earned, bronze, silver, gold, platinum, completion_pct)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                        ?)`).run(id, userId, gameId, platinumEarned, bronze, silver, gold, platinum, completionPct);
    return id;
}

function logSync(userId, status, errorMessage) {
    db.prepare(`INSERT INTO sync_logs (id, user_id, sync_type, status, finished_at, error_message)
                VALUES (?, ?, 'trophies', ?, datetime('now'),
                        ?)`).run(crypto.randomUUID(), userId, status, errorMessage);
}

async function syncTrophiesForUser(userId) {
    try {
        const {accessToken} = await refreshAccessToken(userId);
        const trophyTitles = await fetchAllTrophyTitles({accessToken});
        for (const title of trophyTitles) {
            const gameId = upsertGame(title);
            upsertTrophyProgress(userId, gameId, title);
        }
        logSync(userId, "ok", null);
        return {userId, titlesSynced: trophyTitles.length};
    } catch (err) {
        logSync(userId, "error", String(err.message || err));
        throw err;
    }
}

module.exports = {
    syncTrophiesForUser
};
