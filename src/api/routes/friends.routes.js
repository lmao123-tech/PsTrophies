const express = require("express");
const { listFriendsForUser, getFriendSummary } = require("../controllers/friends.controller");

const router = express.Router();

router.get("/users/:userId/friends", listFriendsForUser);
router.get("/users/:userId/friends/:friendId", getFriendSummary);

module.exports = router;
