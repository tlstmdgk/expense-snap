const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

const db = getFirestore();

// NOTE: no getStorage() here on purpose. Per spec section 2.4, this app
// never persists receipt images — Firebase Storage is not used anywhere
// in this backend. If a future feature needs it (e.g. re-OCR support),
// add it back deliberately rather than out of habit.
module.exports = { db };
