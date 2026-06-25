const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const vision = require('@google-cloud/vision');
const { db } = require('./admin');
const { parseReceiptText } = require('./receiptParser');

/**
 * Vision API client. Authenticates automatically via the Cloud Function's
 * runtime service account when deployed — no API key is embedded here.
 * This is exactly the security boundary described in spec section 7:
 * "All Cloud Functions that touch Google Cloud Vision must run server-side
 * with the service account — never ship a Vision API key to the client."
 */
const visionClient = new vision.ImageAnnotatorClient();

// Callable Functions cap request payloads around 10MB (spec section 2.3).
// Reject clearly-oversized payloads early with a friendly error rather
// than letting the platform reject the whole request opaquely.
const MAX_BASE64_LENGTH = 9 * 1024 * 1024; // ~9MB of base64 text, leaving headroom

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic']);
const DAILY_UPLOAD_LIMIT = 2;

function getUtcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function reserveReceiptUpload(uid) {
  const dayKey = getUtcDayKey();
  const usageRef = db.collection('receiptUploadUsage').doc(uid).collection('days').doc(dayKey);

  return db.runTransaction(async (transaction) => {
    const usageSnap = await transaction.get(usageRef);
    const currentCount = usageSnap.exists ? usageSnap.data().count ?? 0 : 0;

    if (currentCount >= DAILY_UPLOAD_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        `Receipt upload limit reached. You can upload ${DAILY_UPLOAD_LIMIT} receipts per day.`
      );
    }

    const usageUpdate = {
      count: FieldValue.increment(1),
      dayKey,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!usageSnap.exists || !usageSnap.data().createdAt) {
      usageUpdate.createdAt = FieldValue.serverTimestamp();
    }

    transaction.set(usageRef, usageUpdate, { merge: true });

    return currentCount + 1;
  });
}

/**
 * parseReceipt — spec section 6.1.
 *
 * NO-STORAGE DESIGN (spec section 2.4): this app never writes receipt
 * images to Firebase Storage or any other persistent location. The image
 * is sent here as inline base64 content, decoded into an in-memory buffer
 * for the single Vision API call below, and then discarded — there is no
 * `bucket.upload(...)`, no `gs://` URI, no file path anywhere in this
 * function. Once this function returns, the only thing that persists is
 * whatever the frontend later saves to Firestore (text + structured data
 * via receiptService.js -> saveReceipt()), never the image itself.
 *
 * Input:  { imageBase64: string, mimeType: string }
 * Output: { merchant, purchaseDate, items, tax, tip, total, rawOcrText }
 *
 * Uses DOCUMENT_TEXT_DETECTION rather than plain TEXT_DETECTION, per spec
 * 2.3 — it's tuned for dense structured documents like receipts.
 */
exports.parseReceipt = onCall({ region: 'us-central1' }, async (request) => {
  const { imageBase64, mimeType } = request.data;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in to upload a receipt.');
  }
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new HttpsError('invalid-argument', 'imageBase64 is required.');
  }
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new HttpsError('invalid-argument', 'mimeType must be one of image/jpeg, image/png, image/heic.');
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    throw new HttpsError(
      'invalid-argument',
      'Image is too large. Try a smaller photo or compress it before uploading.'
    );
  }

  // SECURITY/PRIVACY NOTE (spec section 7): never log `request.data` or
  // `imageBase64` directly — that would write image bytes into Cloud
  // Functions logs, defeating the entire point of not storing the image.
  // Only log small scalar metadata.
  logger.info('parseReceipt invoked', {
    uid: request.auth.uid,
    mimeType,
    approxSizeBytes: Math.floor((imageBase64.length * 3) / 4),
  });

  const uploadsUsedToday = await reserveReceiptUpload(request.auth.uid);
  logger.info('parseReceipt quota reserved', {
    uid: request.auth.uid,
    uploadsUsedToday,
    dailyUploadLimit: DAILY_UPLOAD_LIMIT,
  });

  let result;
  try {
    // Inline image content, per spec 2.3 — Vision API treats this as a
    // fully first-class input mode, equivalent to passing a GCS URI.
    [result] = await visionClient.documentTextDetection({
      image: { content: imageBase64 },
    });
  } catch (err) {
    throw new HttpsError('internal', `Vision API call failed: ${err.message}`);
  }
  // `result` (and the decoded image buffer Vision's client library builds
  // internally from `imageBase64`) goes out of scope here and is garbage
  // collected once this function returns — nothing about the image is
  // written anywhere. `imageBase64` itself is never referenced again below.

  const rawOcrText = result.fullTextAnnotation?.text ?? '';

  if (!rawOcrText) {
    throw new HttpsError('not-found', 'No text could be read from this image. Try a clearer photo.');
  }

  return parseReceiptText(rawOcrText);
});
