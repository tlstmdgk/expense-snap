/**
 * Cloud Functions entry point. Each exported function corresponds to an
 * endpoint defined in spec section 6 (Backend / API Surface):
 *
 *   parseReceipt   -> spec 6.1  (OCR via Google Cloud Vision)
 *   createSplit    -> spec 6.2
 *   getSplitByToken-> spec 6.3
 *   claimItem      -> spec 6.4
 *   unclaimItem    -> spec 6.5
 *   closeSplit     -> spec 6.6
 *
 * Run locally with the Firebase emulator suite: `npm run serve` (from
 * /firebase), which expects this package's deps to be installed first
 * via `cd functions && npm install`.
 */

const { parseReceipt } = require('./src/parseReceipt');
const { createSplit, getSplitByToken, claimItem, unclaimItem, closeSplit } = require('./src/splits');

exports.parseReceipt = parseReceipt;
exports.createSplit = createSplit;
exports.getSplitByToken = getSplitByToken;
exports.claimItem = claimItem;
exports.unclaimItem = unclaimItem;
exports.closeSplit = closeSplit;
