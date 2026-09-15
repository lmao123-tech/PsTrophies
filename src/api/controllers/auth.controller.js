const {linkPSNAccount} = require("../../auth/psnAuth");

async function linkPsn(req, res) {
    const {npsso} = req.body;
    if (!npsso) return res.status(400).json({error: "Npsso required."}); // error code to be determined

    try {
        const result = await linkPSNAccount(npsso);
        res.status(200).json(result);
    } catch (err) {
        res.status(401).json({error: "Could not link account"}); // TODO: Add more codes for cases like 500 or, Sony server returned 500 etc etc.

    }

}

module.exports = {linkPsn};