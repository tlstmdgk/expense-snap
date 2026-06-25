import { httpsCallable } from 'firebase/functions';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { functions, db } from './firebase.js';

const RECEIPTS_COLLECTION = 'receipts';

/**
 * NO-STORAGE DESIGN (spec section 2.4): this app never uploads receipt
 * images to Firebase Storage. Instead, the image is read client-side and
 * converted to a base64 string, which travels directly in the
 * `parseReceipt` Cloud Function's request payload (spec section 6.1).
 * There is no Storage path, no download URL, and no `firebase/storage`
 * import anywhere in this file on purpose.
 */

/**
 * Reads a File object and resolves to its base64-encoded content (without
 * the "data:image/...;base64," prefix) plus its MIME type, ready to send
 * to the parseReceipt Cloud Function.
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result; // "data:image/jpeg;base64,<...>"
      const base64 = dataUrl.split(',')[1];
      resolve({ imageBase64: base64, mimeType: file.type });
    };
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Builds a local, in-memory preview URL for the image so the UI can show
 * it during the review step (spec section 5.1) — this is the ONLY place
 * in the app the photo is ever visible, and only for the current browser
 * session. Caller is responsible for calling URL.revokeObjectURL(url)
 * when the preview is no longer needed (e.g. on save or on navigating
 * away), to release the in-memory reference promptly.
 */
export function createLocalPreviewUrl(file) {
  return URL.createObjectURL(file);
}

/**
 * Calls the `parseReceipt` Cloud Function (spec section 6.1), which runs
 * Google Cloud Vision DOCUMENT_TEXT_DETECTION server-side on the inline
 * base64 image content and applies the heuristic parsing in
 * receiptParser.js to return structured fields.
 *
 * IMPORTANT: the Vision API call must never happen client-side — this is
 * why it's a Cloud Function call (httpsCallable) rather than a direct
 * fetch to Google Cloud from the browser. See spec section 7 (Security Notes).
 *
 * The image is sent once, used once, and discarded server-side — see the
 * comment block in firebase/functions/src/parseReceipt.js for exactly
 * where/how it's released.
 */
export async function parseReceiptImage(file) {
  const { imageBase64, mimeType } = await fileToBase64(file);
  const parseReceipt = httpsCallable(functions, 'parseReceipt');
  const result = await parseReceipt({ imageBase64, mimeType });
  return result.data; // { merchant, purchaseDate, items, tax, tip, total, rawOcrText }
}

/**
 * Persists a confirmed/edited receipt to Firestore (spec section 4.3).
 * Called after the user reviews/corrects the OCR output in the UI.
 * Note there is no `imageUrl` field — nothing image-related is saved here
 * or anywhere else in this app (spec section 2.4).
 */
export async function saveReceipt(userId, receiptData) {
  const docRef = await addDoc(collection(db, RECEIPTS_COLLECTION), {
    userId,
    merchant: receiptData.merchant,
    purchaseDate: Timestamp.fromDate(new Date(receiptData.purchaseDate)),
    rawOcrText: receiptData.rawOcrText ?? '',
    items: receiptData.items, // [{ itemId, label, price, quantity }]
    tax: receiptData.tax ?? 0,
    tip: receiptData.tip ?? 0,
    total: receiptData.total,
    createdAt: serverTimestamp(),
    status: 'confirmed',
  });
  return docRef.id;
}

export async function updateReceipt(receiptId, updates) {
  return updateDoc(doc(db, RECEIPTS_COLLECTION, receiptId), updates);
}

/**
 * Fetches a single receipt's full structured data (merchant, items, tax,
 * tip, total) — used to render the Receipt Card (spec 5.3.1) for a given
 * receipt-derived entry, since `entries` only stores a `receiptId`
 * reference, not the full item breakdown.
 */
export async function fetchReceipt(receiptId) {
  const snap = await getDoc(doc(db, RECEIPTS_COLLECTION, receiptId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Fetches all receipts owned by a user, most recent first — used by the
 * Receipt Gallery view (spec 5.3.2) to render a grid of Receipt Cards.
 */
export async function fetchReceiptsForUser(userId) {
  const q = query(collection(db, RECEIPTS_COLLECTION), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
