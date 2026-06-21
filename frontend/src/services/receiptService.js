import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { storage, functions, db } from './firebase.js';

const RECEIPTS_COLLECTION = 'receipts';

/**
 * Uploads a receipt image to Firebase Storage and returns its download URL.
 * Storage path convention: receipts/{userId}/{timestamp}_{filename}
 */
export async function uploadReceiptImage(userId, file) {
  const path = `receipts/${userId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  const imageUrl = await getDownloadURL(snapshot.ref);
  return { path, imageUrl };
}

/**
 * Calls the `parseReceipt` Cloud Function (spec section 6.1), which runs
 * Google Cloud Vision DOCUMENT_TEXT_DETECTION server-side and applies the
 * heuristic parsing described in spec 6.1 to return structured fields.
 *
 * IMPORTANT: the Vision API call must never happen client-side — this is
 * why it's a Cloud Function call (httpsCallable) rather than a direct
 * fetch to Google Cloud from the browser. See spec section 7 (Security Notes).
 */
export async function parseReceiptImage(storagePath) {
  const parseReceipt = httpsCallable(functions, 'parseReceipt');
  const result = await parseReceipt({ storagePath });
  return result.data; // { merchant, purchaseDate, items, tax, tip, total, rawOcrText }
}

/**
 * Persists a confirmed/edited receipt to Firestore (spec section 4.3).
 * Called after the user reviews/corrects the OCR output in the UI.
 */
export async function saveReceipt(userId, receiptData) {
  const docRef = await addDoc(collection(db, RECEIPTS_COLLECTION), {
    userId,
    imageUrl: receiptData.imageUrl,
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
