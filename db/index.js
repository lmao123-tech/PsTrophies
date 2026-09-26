// The whole "ORM" — open the SQLite file, run init.sql (idempotent:
// CREATE TABLE IF NOT EXISTS), export the connection. Every other module
// (src/auth, src/sync, src/social, src/api/routes) requires this and calls
// db.prepare(sql).run(...)/.get(...)/.all(...) directly — plain SQL, no
// generated client, nothing else to keep in sync.
//
// Uses node:sqlite (built into Node 22.5+, no npm dependency). All calls
// are synchronous — that's fine here, SQLite reads/writes are fast and
// this app's scale doesn't need async I/O for the DB.

const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "dev.db");
const INIT_SQL_PATH = path.join(__dirname, "init.sql");

const db = new DatabaseSync(DB_PATH);
db.exec(fs.readFileSync(INIT_SQL_PATH, "utf8"));

module.exports = db;
