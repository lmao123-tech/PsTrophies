const express = require("express");
const {syncTrophies} = require("../controllers/sync.controller");
// const {syncLibrary} = require("../controllers/sync.controller");
const router = express.Router();

router.post("/sync/:userId/trophies", syncTrophies);
// router.post("/sync/:userId/library", syncLibrary);

module.exports = router;