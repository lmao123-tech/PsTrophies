// Top-level entry point / route wiring. Everything else lives under
// src/api (routes + controllers), src/auth, src/sync, src/catalog,
// src/social — see README.md + the architecture doc for scope per module.

require("dotenv").config();
const express = require("express");
const db = require("../db"); // opens db/dev.db and runs db/init.sql (idempotent)
const apiRoutes = require("./api/routes");

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  // Touches the DB too, not just the HTTP layer — proves the whole chain
  // (server boot -> SQLite file opened -> tables exist) actually works.
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  res.json({ status: "ok", users: count });
});

app.use("/api", apiRoutes);

// Mount more route modules under src/api/routes/index.js as they're built
// (wishlist, visibility settings, auth) — not here.

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`PsTrophies listening on :${PORT}`);
  });
}

module.exports = app;
