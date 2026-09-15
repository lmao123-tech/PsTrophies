function normalizeTitle(rawTitle) {
    return rawTitle
        .replace(/[™®©]/g,"")
        .replace(/\s+/g," ")
        .trim()
        .toLowerCase();
}

module.exports = { normalizeTitle };