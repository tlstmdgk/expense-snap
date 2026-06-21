import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

const ENTRIES_COLLECTION = 'entries';

/**
 * Data access layer for entries/{entryId} — see spec section 4.2.
 * type: "expense" | "income"; source: "manual" | "receipt".
 */

export async function createEntry(userId, entry) {
  return addDoc(collection(db, ENTRIES_COLLECTION), {
    userId,
    type: entry.type, // "expense" | "income"
    amount: entry.amount,
    currency: entry.currency ?? 'USD',
    category: entry.category,
    name: entry.name,
    description: entry.description ?? '',
    date: Timestamp.fromDate(new Date(entry.date)),
    createdAt: serverTimestamp(),
    source: entry.source ?? 'manual',
    receiptId: entry.receiptId ?? null,
    imageUrl: entry.imageUrl ?? null,
  });
}

export async function updateEntry(entryId, updates) {
  return updateDoc(doc(db, ENTRIES_COLLECTION, entryId), updates);
}

export async function deleteEntry(entryId) {
  return deleteDoc(doc(db, ENTRIES_COLLECTION, entryId));
}

/**
 * Fetches a page of entries for the Expense History view (spec 5.3).
 * Filters: type, category, date range. Pagination via Firestore cursor.
 */
export async function fetchEntries(userId, { type, category, startDate, endDate, pageSize = 25, cursor } = {}) {
  const constraints = [where('userId', '==', userId)];

  if (type) constraints.push(where('type', '==', type));
  if (category) constraints.push(where('category', '==', category));
  if (startDate) constraints.push(where('date', '>=', Timestamp.fromDate(new Date(startDate))));
  if (endDate) constraints.push(where('date', '<=', Timestamp.fromDate(new Date(endDate))));

  constraints.push(orderBy('date', 'desc'));
  constraints.push(limit(pageSize));
  if (cursor) constraints.push(startAfter(cursor));

  const q = query(collection(db, ENTRIES_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  return {
    entries: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
  };
}

/**
 * Fetches all entries within a date range for Analytics (spec 5.6).
 * At demo scale this single client-side query + aggregation is fine —
 * no backend aggregation job needed (see spec section 5.6).
 */
export async function fetchEntriesForAnalytics(userId, { startDate, endDate } = {}) {
  const constraints = [where('userId', '==', userId)];
  if (startDate) constraints.push(where('date', '>=', Timestamp.fromDate(new Date(startDate))));
  if (endDate) constraints.push(where('date', '<=', Timestamp.fromDate(new Date(endDate))));
  constraints.push(orderBy('date', 'asc'));

  const q = query(collection(db, ENTRIES_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
