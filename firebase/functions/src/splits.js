const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { nanoid } = require('nanoid');
const { db } = require('./admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');

const SPLIT_EXPIRY_DAYS = 7;

/**
 * createSplit — spec section 6.2.
 * Auth required (must own the receipt). Generates a random shareToken
 * (this IS the link slug, per spec section 4.4) and creates a `splits`
 * doc with a 7-day expiry and one itemAssignment slot per receipt item.
 */
exports.createSplit = onCall({ region: 'us-central1' }, async (request) => {
  const { receiptId, taxTipSplitMethod = 'even' } = request.data;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in to create a split.');
  }
  if (!receiptId) {
    throw new HttpsError('invalid-argument', 'receiptId is required.');
  }
  if (!['even', 'proportional'].includes(taxTipSplitMethod)) {
    throw new HttpsError('invalid-argument', 'taxTipSplitMethod must be "even" or "proportional".');
  }

  const receiptRef = db.collection('receipts').doc(receiptId);
  const receiptSnap = await receiptRef.get();

  if (!receiptSnap.exists) {
    throw new HttpsError('not-found', 'Receipt not found.');
  }

  const receipt = receiptSnap.data();
  if (receipt.userId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'You do not own this receipt.');
  }

  const shareToken = nanoid(12);
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + SPLIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const splitRef = db.collection('splits').doc();
  await splitRef.set({
    receiptId,
    ownerId: request.auth.uid,
    shareToken,
    createdAt: now,
    expiresAt,
    status: 'open',
    itemAssignments: (receipt.items || []).map((item) => ({
      itemId: item.itemId,
      claimedBy: null,
      claimantSessionId: null,
    })),
    taxTipSplitMethod,
  });

  // baseUrl should match wherever the frontend is hosted/deployed.
  const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

  return {
    splitId: splitRef.id,
    shareToken,
    shareUrl: `${baseUrl}/split/${shareToken}`,
  };
});

async function findSplitByToken(shareToken) {
  const snapshot = await db.collection('splits').where('shareToken', '==', shareToken).limit(1).get();
  if (snapshot.empty) {
    throw new HttpsError('not-found', 'Split not found.');
  }
  return { ref: snapshot.docs[0].ref, data: snapshot.docs[0].data(), id: snapshot.docs[0].id };
}

function checkNotExpired(splitData) {
  const now = Timestamp.now();
  if (splitData.status === 'closed') {
    throw new HttpsError('failed-precondition', 'This split has been closed by its owner.');
  }
  if (splitData.expiresAt && splitData.expiresAt.toMillis() < now.toMillis()) {
    throw new HttpsError('failed-precondition', 'This split link has expired.');
  }
}

/**
 * getSplitByToken — spec section 6.3. Public, unauthenticated.
 * Returns the split + its parent receipt so the claim page (spec 5.2)
 * has everything it needs in one call.
 */
exports.getSplitByToken = onCall({ region: 'us-central1' }, async (request) => {
  const { shareToken } = request.data;
  if (!shareToken) {
    throw new HttpsError('invalid-argument', 'shareToken is required.');
  }

  const { data: split, id: splitId } = await findSplitByToken(shareToken);

  // Auto-mark expired splits rather than just erroring, so repeated
  // visits to a stale link consistently show the "expired" state.
  const now = Timestamp.now();
  if (split.status === 'open' && split.expiresAt && split.expiresAt.toMillis() < now.toMillis()) {
    await db.collection('splits').doc(splitId).update({ status: 'expired' });
    split.status = 'expired';
  }

  const receiptSnap = await db.collection('receipts').doc(split.receiptId).get();
  if (!receiptSnap.exists) {
    throw new HttpsError('not-found', 'The receipt for this split no longer exists.');
  }

  return {
    split: { id: splitId, ...split },
    receipt: { id: receiptSnap.id, ...receiptSnap.data() },
  };
});

/**
 * claimItem — spec section 6.4. Public, unauthenticated.
 * claimantSessionId is a random id the claimant's browser generated and
 * persisted in localStorage (see services/splitService.js) — it's a soft
 * protection, not real auth, documented as a known limitation in spec 7.
 */
exports.claimItem = onCall({ region: 'us-central1' }, async (request) => {
  const { shareToken, itemId, claimantName, claimantSessionId } = request.data;

  if (!shareToken || !itemId || !claimantName || !claimantSessionId) {
    throw new HttpsError('invalid-argument', 'shareToken, itemId, claimantName, and claimantSessionId are required.');
  }

  const { ref, data: split } = await findSplitByToken(shareToken);
  checkNotExpired(split);

  const assignments = split.itemAssignments || [];
  const targetIndex = assignments.findIndex((a) => a.itemId === itemId);
  if (targetIndex === -1) {
    throw new HttpsError('not-found', 'Item not found on this receipt.');
  }
  if (assignments[targetIndex].claimedBy) {
    throw new HttpsError('already-exists', 'This item has already been claimed.');
  }

  assignments[targetIndex] = { itemId, claimedBy: claimantName, claimantSessionId };

  await ref.update({ itemAssignments: assignments });
  return { success: true };
});

/**
 * unclaimItem — spec section 6.5. Public, unauthenticated.
 * Only succeeds if claimantSessionId matches the one on record for that
 * item, so one claimant cannot un-claim someone else's picks.
 */
exports.unclaimItem = onCall({ region: 'us-central1' }, async (request) => {
  const { shareToken, itemId, claimantSessionId } = request.data;

  if (!shareToken || !itemId || !claimantSessionId) {
    throw new HttpsError('invalid-argument', 'shareToken, itemId, and claimantSessionId are required.');
  }

  const { ref, data: split } = await findSplitByToken(shareToken);
  checkNotExpired(split);

  const assignments = split.itemAssignments || [];
  const targetIndex = assignments.findIndex((a) => a.itemId === itemId);
  if (targetIndex === -1) {
    throw new HttpsError('not-found', 'Item not found on this receipt.');
  }
  if (assignments[targetIndex].claimantSessionId !== claimantSessionId) {
    throw new HttpsError('permission-denied', 'You can only un-claim items you claimed yourself.');
  }

  assignments[targetIndex] = { itemId, claimedBy: null, claimantSessionId: null };

  await ref.update({ itemAssignments: assignments });
  return { success: true };
});

/**
 * closeSplit — spec section 6.6. Owner-only.
 * Freezes the claim state. Optionally creates an `entries` record for the
 * owner's own remaining (unclaimed) share — left as a clearly marked
 * extension point below since the exact UX (which category? which date?)
 * is a product decision better made in the frontend review step.
 */
exports.closeSplit = onCall({ region: 'us-central1' }, async (request) => {
  const { shareToken } = request.data;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in to close a split.');
  }
  if (!shareToken) {
    throw new HttpsError('invalid-argument', 'shareToken is required.');
  }

  const { ref, data: split } = await findSplitByToken(shareToken);

  if (split.ownerId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Only the split owner can close it.');
  }

  await ref.update({ status: 'closed', closedAt: FieldValue.serverTimestamp() });

  // TODO (extension point): create an `entries` doc for the owner's
  // unclaimed remainder here, or leave that to a frontend confirmation
  // step that calls entriesService.createEntry() after closeSplit() resolves.

  return { success: true };
});
