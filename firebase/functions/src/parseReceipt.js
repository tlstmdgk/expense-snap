const { onCall, HttpsError } = require('firebase-functions/v2/https');
const vision = require('@google-cloud/vision');
const { storage } = require('./admin');
const { parseReceiptText } = require('./receiptParser');

/**
 * Vision API client. Authenticates automatically via the Cloud Function's
 * runtime service account when deployed — no API key is embedded here.
 * This is exactly the security boundary described in spec section 7:
 * "All Cloud Functions that touch Google Cloud Vision must run server-side
 * with the service account — never ship a Vision API key to the client."
 */
const visionClient = new vision.ImageAnnotatorClient();

/**
 * parseReceipt — spec section 6.1.
 *
 * Input:  { storagePath: string }  — path of the already-uploaded receipt
 *         image in Firebase Storage (uploaded client-side first via
 *         services/receiptService.js -> uploadReceiptImage()).
 * Output: { merchant, purchaseDate, items, tax, tip, total, rawOcrText }
 *
 * Uses DOCUMENT_TEXT_DETECTION rather than plain TEXT_DETECTION, per spec
 * 2.3 — it's tuned for dense structured documents like receipts.
 */
exports.parseReceipt = onCall({ region: 'us-central1' }, async (request) => {
  const { storagePath } = request.data;

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in to upload a receipt.');
  }
  if (!storagePath) {
    throw new HttpsError('invalid-argument', 'storagePath is required.');
  }

  const bucket = storage.bucket();
  const gcsUri = `gs://${bucket.name}/${storagePath}`;

  let result;
  try {
    [result] = await visionClient.documentTextDetection(gcsUri);
  } catch (err) {
    throw new HttpsError('internal', `Vision API call failed: ${err.message}`);
  }

  const rawOcrText = result.fullTextAnnotation?.text ?? '';

  if (!rawOcrText) {
    throw new HttpsError('not-found', 'No text could be read from this image. Try a clearer photo.');
  }

  return parseReceiptText(rawOcrText);
});
