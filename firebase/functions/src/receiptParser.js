const { nanoid } = require('nanoid');

/**
 * Heuristic parser turning Google Cloud Vision's raw OCR text into the
 * structured shape the frontend review UI expects. See spec section 6.1
 * for the rationale — Vision API gives text + bounding boxes, not
 * structured fields, so this layer is inherently approximate and the
 * frontend always shows an editable review step before saving (spec 5.1).
 *
 * Exported separately from index.js so it can be unit tested without
 * spinning up a Cloud Function / calling the real Vision API.
 */

const PRICE_REGEX = /\$?\s?(\d+\.\d{2})\s*$/;
const QUANTITY_PREFIX_REGEX = /^(\d+)\s*(?:x|@)\s*/i;
const DATE_REGEXES = [
  /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/, // MM/DD/YYYY or DD-MM-YY etc.
  /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, // YYYY-MM-DD
];

function extractDate(lines) {
  for (const line of lines) {
    for (const regex of DATE_REGEXES) {
      const match = line.match(regex);
      if (match) {
        const parsed = new Date(match[0]);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().slice(0, 10);
        }
      }
    }
  }
  return new Date().toISOString().slice(0, 10); // fall back to today; user corrects in review UI
}

function extractMerchant(lines) {
  // Heuristic: first non-empty line is commonly the store name.
  // Flagged in spec 6.1 as the least reliable heuristic — expect frequent correction.
  const firstLine = lines.find((line) => line.trim().length > 0);
  return firstLine ? firstLine.trim() : 'Unknown Merchant';
}

function matchesLabel(line, keywords) {
  const lower = line.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function extractTrailingPrice(line) {
  const match = line.match(PRICE_REGEX);
  return match ? parseFloat(match[1]) : null;
}

function extractSummaryFields(lines) {
  let tax = 0;
  let tip = 0;
  let total = 0;

  for (const line of lines) {
    const price = extractTrailingPrice(line);
    if (price === null) continue;

    if (matchesLabel(line, ['tax'])) {
      tax = price;
    } else if (matchesLabel(line, ['tip', 'gratuity'])) {
      tip = price;
    } else if (matchesLabel(line, ['total', 'amount due', 'balance due'])) {
      // "Subtotal" lines also contain "total" — explicitly exclude them
      // so we don't overwrite the real total with the subtotal.
      if (!matchesLabel(line, ['subtotal'])) {
        total = price;
      }
    }
  }

  return { tax, tip, total };
}

const SUMMARY_LINE_KEYWORDS = ['tax', 'tip', 'gratuity', 'total', 'subtotal', 'amount due', 'balance due', 'change', 'cash', 'card'];

function extractLineItems(lines) {
  const items = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip lines that are clearly summary rows (tax/tip/total/etc.) rather
    // than purchased items, so they don't get double-counted as items.
    if (matchesLabel(trimmed, SUMMARY_LINE_KEYWORDS)) continue;

    const price = extractTrailingPrice(trimmed);
    if (price === null) continue; // no trailing price -> not an item line

    let quantity = 1;
    let label = trimmed.replace(PRICE_REGEX, '').trim();

    const qtyMatch = label.match(QUANTITY_PREFIX_REGEX);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10);
      label = label.replace(QUANTITY_PREFIX_REGEX, '').trim();
    }

    if (!label) continue;

    items.push({
      itemId: nanoid(8),
      label,
      price,
      quantity,
    });
  }

  return items;
}

/**
 * @param {string} rawOcrText - full text blob returned by Vision API's
 *   DOCUMENT_TEXT_DETECTION (fullTextAnnotation.text).
 * @returns {{merchant: string, purchaseDate: string, items: Array, tax: number, tip: number, total: number, rawOcrText: string}}
 */
function parseReceiptText(rawOcrText) {
  const lines = rawOcrText.split('\n').map((l) => l.trim()).filter(Boolean);

  const merchant = extractMerchant(lines);
  const purchaseDate = extractDate(lines);
  const items = extractLineItems(lines);
  const { tax, tip, total } = extractSummaryFields(lines);

  // If no explicit "total" line was found, fall back to sum(items) + tax + tip
  // so the review UI always has a starting number to reconcile against.
  const itemsSum = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const finalTotal = total > 0 ? total : Math.round((itemsSum + tax + tip) * 100) / 100;

  return {
    merchant,
    purchaseDate,
    items,
    tax,
    tip,
    total: finalTotal,
    rawOcrText,
  };
}

module.exports = { parseReceiptText };
