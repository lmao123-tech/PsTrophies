const {syncTrophiesForUser} = require("../../sync/trophySync")
const {syncLibraryForUser} = require("../../sync/librarySync");

async function syncTrophies(req, res) {
    const {userId} = req.params;
    if (!userId) return res.status(400).json({error: "Invalid user id"});
    try {
        const result = await syncTrophiesForUser(userId);
        res.status(200).json(result);
    } catch (err) {
        res.status(401).json({error: "Cannot get newest trophies from Sony, list is possibly outdated"});
    }
}

async function syncLibrary(req, res) {
    const {userId} = req.params;
    if (!userId) return res.status(400).json({error: "Invalid user id"});
    try {
        const result = await syncLibraryForUser(userId);
        res.status(200).json(result);
    } catch (err) {
        res.status(401).json({error: "Cannot fetch library from Sony, library is possibly outdated"})
    }
}

module.exports = {syncTrophies, syncLibrary}