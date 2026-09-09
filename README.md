# PsTrophies

A website to take notes about Playstation games, access your library and wishlist games. All in one — trophy grind notes, wishlist, and more.

Self-hosted, invite-only, for a closed friend group. See the project docs (in the Claude project, not this repo) for the full story:

- `sony-psn-api-research.md` — what Sony actually exposes, auth flow, and the legal read (household-exemption scope, Sony ToS risk).
- `pstrophies-architecture.md` — the architecture and data model this scaffold implements.

## What's here vs. what's not

This is a **top-level scaffold**, not a working app yet. Folder structure, `package.json`, the DB schema (plain SQL, `db/init.sql`), and one route (`/health`) are wired up; the actual logic behind each module is left as documented stubs (see the comment block at the top of each file under `src/`) for the implementation pass. Each stub says what it's responsible for and points back to the relevant section of the architecture doc.

## Local dev

No database server, no ORM — SQLite via Node's built-in `node:sqlite` module (needs Node 22.13+; nothing extra to install). `db/init.sql` has the schema (`CREATE TABLE IF NOT EXISTS` throughout — idempotent), `db/index.js` opens the file and runs it, every other module just does `db.prepare(sql).run/get/all(...)`. As simple as this gets.

```bash
cp .env.example .env        # fill in TOKEN_ENCRYPTION_KEY and PLATPRICES_API_KEY (DATABASE_PATH is already set)
npm install
npm run db:seed             # creates db/dev.db (running init.sql) and loads mock data
npm run dev                 # starts the server with nodemon
curl localhost:3000/health  # {"status":"ok","users":2}
```

`db/dev.db` is gitignored — it's disposable, delete it and re-run `npm run db:seed` anytime for a clean slate.

### Schema workflow

Edit `db/init.sql` directly — it's plain `CREATE TABLE IF NOT EXISTS` statements, so a brand-new table just needs a new block; an existing table's column change needs the file re-run against a fresh `db/dev.db` (delete it, `db:seed` again) since `IF NOT EXISTS` won't alter an existing table. That's a fine tradeoff for the mock-data phase — nothing in `db/dev.db` is worth preserving yet. Once real data exists that shouldn't be thrown away casually, add real `ALTER TABLE` statements (or a lightweight migration runner) instead of relying on delete-and-recreate — not needed yet.

### SQLite now, Postgres later (maybe)

SQLite is genuinely fine for a small closed friend group — it's a single file with a write-lock, not a real bottleneck at this scale. If this ever needs real concurrent multi-user load, moving to Postgres means swapping `db/index.js` for a real client (e.g. `pg`) and rewriting `db/init.sql`'s SQLite-specific bits (`datetime('now')`, `TEXT` for booleans-as-0/1, etc.) into Postgres syntax — a bounded, one-time job, not a redesign. Not a decision to make now.

## Proof of concept: fetch your own PSN data

`scripts/fetchTrophies.js` is the current focus — a standalone script (not a
route yet) that proves the actual Sony-fetch mechanic works: exchanges an
NPSSO for real tokens, pulls your own trophy titles, and stores them in
`db/dev.db` via `db/index.js`. Nothing here goes through the Express app.

```bash
# 1. Get your own NPSSO (see the comment in .env.example) and put it in .env
#    as PSN_NPSSO="...". It's a session credential — treat it like a
#    password: local .env only, never committed, never pasted anywhere else.
npm run poc:fetch
```

On success it prints your onlineId and how many titles it stored, and logs a
row to `sync_logs`. Uses the `psn-api` package for the NPSSO -> token
exchange and the trophy calls (undocumented API, but this is the same path
`psn-api`/`psnawp` are built and tested against with their own accounts).

## Testing

`npm test` runs Jest (there's one smoke test right now). **Do not call real Sony endpoints from automated tests** — they're undocumented, and hitting them repeatedly adds request volume for no benefit (see the ban-risk discussion in `sony-psn-api-research.md`). Mock `psnAuth`/`trophySync`/`librarySync`'s outbound HTTP calls with `nock` if/when tests are added for those. Real-account testing (does the actual sync work end to end) is manual, local, against your own dev PSN account — no CI right now; we're still proving the core mechanic works before automating anything around it.

## Build order

See "Phased build plan" in `pstrophies-architecture.md`. Short version: auth + self-sync first, then wishlist + catalog search, then friend-matching, then frontend design/wiring.
