const express = require("express");
const {linkPsn} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/auth/psn", linkPsn);

module.exports = router;