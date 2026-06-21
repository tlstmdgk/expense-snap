import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { functions, db } from './firebase.js';
import { nanoid } from 'nanoid';

const CLAIMANT_SESSION_KEY = 'expense-tracker:claimantSessionId';

/**
 * Each anonymous claimant gets a stable random id stored in localStorage,
 * scoped to their browser. This lets them un-claim their own picks without
 * touching anyone else's — see spec section 4.4 design note on anonymity.
 * This is a soft protection appropriate for a demo, NOT real auth.
 */
export function getOrCreateClaimantSessionId() {
  let id = localStorage.getItem(CLAIMANT_SESSION_KEY);
  if (!id) {
    id = nanoid();
    localStorage.setItem(CLAIMANT_SESSION_KEY, id);
  }
  return id;
}

/** Owner-side: create a shareable split link (spec section 6.2). */
export async function createSplit(receiptId, taxTipSplitMethod = 'even') {
  const createSplitFn = httpsCallable(functions, 'createSplit');
  const result = await createSplitFn({ receiptId, taxTipSplitMethod });
  return result.data; // { splitId, shareToken, shareUrl }
}

/** Public: fetch split state by token (spec section 6.3). */
export async function fetchSplitByToken(shareToken) {
  const getSplitFn = httpsCallable(functions, 'getSplitByToken');
  const result = await getSplitFn({ shareToken });
  return result.data; // { split, receipt } or throws on expired/not-found
}

/** Public: subscribe to live claim updates for the owner's watch view (spec 5.1) or claimant view (spec 5.2). */
export function subscribeSplitUpdates(splitId, onUpdate) {
  return onSnapshot(doc(db, 'splits', splitId), (snapshot) => {
    if (snapshot.exists()) {
      onUpdate({ id: snapshot.id, ...snapshot.data() });
    }
  });
}

/** Public: claim an item (spec section 6.4). */
export async function claimItem(shareToken, { itemId, claimantName }) {
  const claimItemFn = httpsCallable(functions, 'claimItem');
  const claimantSessionId = getOrCreateClaimantSessionId();
  const result = await claimItemFn({ shareToken, itemId, claimantName, claimantSessionId });
  return result.data;
}

/** Public: un-claim an item, only allowed for the original claimant's session (spec section 6.5). */
export async function unclaimItem(shareToken, { itemId }) {
  const unclaimItemFn = httpsCallable(functions, 'unclaimItem');
  const claimantSessionId = getOrCreateClaimantSessionId();
  const result = await unclaimItemFn({ shareToken, itemId, claimantSessionId });
  return result.data;
}

/** Owner-only: close the split and freeze claim state (spec section 6.6). */
export async function closeSplit(shareToken) {
  const closeSplitFn = httpsCallable(functions, 'closeSplit');
  const result = await closeSplitFn({ shareToken });
  return result.data;
}
