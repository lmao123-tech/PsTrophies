const express = require("express");
const {
  listGames,
  getGame,
  listGamesForUser,
  getGameForUser,
} = require("../controllers/games.controller");

const router = express.Router();

router.get("/games", listGames);
router.get("/games/:gameId", getGame);
router.get("/users/:userId/games", listGamesForUser);
router.get("/users/:userId/games/:gameId", getGameForUser);

module.exports = router;
