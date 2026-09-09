// Top-level entry point. Deliberately minimal — this is the "top-level"
// wiring; the actual logic behind each route/service lives in the stub
// files under src/auth, src/sync, src/catalog, src/social and gets filled
// in during implementation (see README.md + the architecture doc for scope
// per module).

require("dotenv").config();
const express = require("express");
const db = require("../db"); // opens db/dev.db and runs db/init.sql (idempotent)

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  // Touches the DB too, not just the HTTP layer — proves the whole chain
  // (server boot -> SQLite file opened -> tables exist) actually works.
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  res.json({ status: "ok", users: count });
});

// Mount route modules here as they're implemented, e.g.:
// app.use("/api/auth", require("./api/routes/auth"));
// app.use("/api/library", require("./api/routes/library"));
// app.use("/api/wishlist", require("./api/routes/wishlist"));
// app.use("/api/social", require("./api/routes/social"));

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`PsTrophies listening on :${PORT}`);
  });
}

module.exports = app;
