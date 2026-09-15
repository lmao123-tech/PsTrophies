// Aggregates every route module under one router, mounted at /api in
// server.js. Add new resource route files here as they're built (wishlist,
// visibility settings, auth) — one file per resource, same pattern as
// games.routes.js/friends.routes.js.

const express = require("express");
const gamesRoutes = require("./games.routes");
const friendsRoutes = require("./friends.routes");
const authRoutes = require("./auth.routes");
const syncRoutes = require("./sync.routes");

const router = express.Router();
router.use(gamesRoutes);
router.use(friendsRoutes);
router.use(authRoutes);
router.use(syncRoutes);

module.exports = router;
