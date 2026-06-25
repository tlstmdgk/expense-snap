# Project Specification: Expense Tracker & Receipt Splitter

## 0. Document Purpose

This is a build specification for an online expense tracker with receipt OCR and bill-splitting via shareable links. It is written to be read by an LLM coding assistant (e.g. Claude Code) and used as the source of truth for implementation. It defines scope, architecture, data models, API contracts, and page-by-page UI requirements. Where a decision was made for simplicity (demo-scale project), that tradeoff is called out explicitly so it can be revisited later.

**Project type:** Small-scale demo / portfolio project. Not built for production traffic, billing, or multi-tenant security hardening — but should follow real-world patterns so it reads well in a portfolio/resume context.

---

## 1. Project Overview

A web app that lets a user:
1. Track personal income and expenses (manual entry).
2. Upload a photo of a receipt and have it auto-parsed (OCR) into line items.
3. Split a receipt's items among multiple people via a temporary shareable link — similar in spirit to a When2Meet link — where each invited person opens the link, claims which item(s) are theirs (no login required), and the totals reconcile automatically.
4. View spending history and category analytics (charts).

### 1.1 Core User Flows

- **Flow A — Manual tracking:** User logs in → adds an expense or income entry manually → it appears in Expense History → contributes to Analytics.
- **Flow B — Receipt upload + OCR:** User uploads a receipt image → backend OCR extracts merchant, date, line items, tax, tip, total → user reviews/corrects parsed data → saves as an expense entry (or proceeds to Flow C).
- **Flow C — Split a receipt:** From a parsed receipt, user assigns items to "people" (placeholders), generates a shareable link, sends it to friends → each friend opens the link, enters their name, and claims the item(s) that are theirs → link shows live running totals per person → link expires after a set window (e.g. 7 days) or once the owner closes it.

---

## 2. Tech Stack

### 2.1 Frontend
- **React** (Vite recommended over CRA for a fresh build — faster dev server, simpler config)
- **React Router** for tabs/pages
- **Node.js** as the JS runtime for tooling/dev server (no separate Node backend required if using Firebase/Supabase — see §2.2)
- **Charting library:** Recharts (simplest integration with React, good defaults for pie/bar/line)
- **Styling:** Tailwind CSS (fast to build a clean demo UI; swap for CSS modules if preferred)
- **State/data fetching:** React Query (TanStack Query) for server state; React Context or Zustand for light client state (e.g. current receipt-being-split draft)

### 2.2 Backend — Recommendation: Firebase

You've already used Supabase, so this spec defaults to **Firebase** to give you a second platform's experience on your resume. The two are architecturally parallel, so if you change your mind, the data model below maps cleanly (see §2.3).

| Need | Firebase service |
|---|---|
| Auth (email/password, Google sign-in) | Firebase Authentication |
| Database | Cloud Firestore (NoSQL, document-based) |
| Server-side logic (OCR call, link token generation/validation, split totals calc) | Cloud Functions for Firebase (Node.js) |
| Hosting (optional, for frontend) | Firebase Hosting |

**Firebase Storage is intentionally not used.** Per the storage-cost design goal (see §2.4), receipt images are never persisted — only the OCR'd text and parsed structured data are stored. The image exists only as an in-memory buffer for the duration of a single Cloud Function invocation, then it's discarded. There is no `receipts/{userId}/...` Storage bucket in this version of the app.

**Why Firebase fits a demo-scale app well:**
- Generous free tier (Spark plan) covers this project's scale entirely.
- Firestore's document model maps naturally onto "receipts with nested line items" without needing migrations.
- Cloud Functions give you a clean place to call Google Cloud Vision API using the *same* Google Cloud project/credentials — Firebase and Google Cloud are the same underlying platform, so OCR integration is native, not a bolt-on.
- No server to provision/manage — keeps this "demo, not infra."

#### 2.2.1 Alternative: Supabase
If you decide to use Supabase instead (e.g. to keep one less ecosystem in your toolbox), the mapping is:

| Firebase | Supabase equivalent |
|---|---|
| Firebase Auth | Supabase Auth |
| Firestore | Supabase Postgres (use Row Level Security policies) |
| Cloud Functions | Supabase Edge Functions (Deno) |

The data model in §4 is written with field names that work for either a document store or relational tables — collections map to tables, documents map to rows.

### 2.3 OCR: Google Cloud Vision API
- Use the **Document Text Detection** (`DOCUMENT_TEXT_DETECTION`) feature of Google Cloud Vision API, not plain `TEXT_DETECTION` — it's tuned for dense structured documents like receipts and gives better line/paragraph grouping.
- Call Vision API from a Cloud Function (server-side), never directly from the client, so the API key/service account credentials are never exposed in frontend code.
- **Image transport (no-storage design):** Since the image is never written to Storage (see §2.4), it cannot be referenced by a `gs://` URI the way a stored file would be. Instead, the client sends the image as a base64-encoded string directly in the Cloud Function's request payload. Vision API's `documentTextDetection` accepts inline image content (`{ image: { content: base64String } }`) just as readily as a GCS URI — this is a fully supported, equally first-class input mode, not a workaround.
  - **Practical limit:** Firebase Callable Functions cap request payloads around 10MB. A base64-encoded phone photo is usually well under that (compress/resize client-side before upload if you want headroom — e.g. via `canvas` downscaling — though this is an optional polish step, not required for the demo to function).
- Vision API returns raw text + bounding boxes. You will need a **parsing layer** (regex + heuristics, see §6) to turn raw OCR text into structured `{merchant, date, items[], tax, tip, total}` — Vision API does not do this for you.
- Google Cloud free tier: first 1,000 units/month free, which is more than sufficient for a demo.

### 2.4 Design Goal: No Persisted Receipt Images

This version of the app explicitly avoids storing receipt images, to avoid Storage costs at any scale. The tradeoff:

| | With stored images (previous version) | Text-only (this version) |
|---|---|---|
| Storage cost | Grows with # of receipts × image size | Effectively zero — text is tiny |
| "View original receipt" | Real photo, pixel-perfect | Reconstructed text card (see §5.3.1) — loses visual layout/handwriting/logos |
| OCR re-run on a bad parse | Possible (image still exists) | Not possible — if the parse is wrong and uncorrected, the source image is gone forever. This makes the review/correction step in §5.1 more important, not less: it's the *only* chance to fix OCR mistakes. |

This is a deliberate, stated tradeoff appropriate for a demo/portfolio project, not an oversight. If a future version needs "re-OCR this receipt" as a feature, that requires reintroducing image storage for at least a short retention window — call this out explicitly if asked to add that feature later, since it conflicts with this design goal.

---

## 3. Information Architecture (Frontend Tabs)

Primary navigation is a persistent tab bar (top or sidebar) with four tabs, plus a header showing current balance summary:

1. **Upload Receipt** — image upload + OCR review + item-splitting UI
2. **Expense History** — searchable/filterable list/table of all past entries (manual + receipt-derived)
3. **Add Expense** — manual expense entry form
4. **Add Income** — manual income entry form
5. *(Implicit 5th view, not a tab)* **Analytics** — could live as a sub-tab of Expense History, or its own top-level tab. Recommend making it a **5th top-level tab** called "Analytics" since it's a distinct enough use case from the history list itself.
6. *(Implicit, accessed via link only, no nav tab)* **Split Claim Page** — the public page a claimant lands on via the shareable link. Not part of the authenticated app shell.

---

## 4. Data Model

Using Firestore-style collections (translate to Postgres tables 1:1 if using Supabase: each collection → table, each field → column, sub-objects → JSONB columns).

### 4.1 `users`
```
users/{userId}
  - email: string
  - displayName: string
  - createdAt: timestamp
  - currency: string (default "USD")
```
Managed mostly by Firebase Auth itself; this collection holds app-specific profile extras only.

### 4.2 `entries` (unified expense + income log)
```
entries/{entryId}
  - userId: string (owner, indexed)
  - type: "expense" | "income"
  - amount: number (positive; sign is implied by type)
  - currency: string
  - category: string  (e.g. "Food", "Transport", "Rent", "Salary", "Other")
  - name: string        (e.g. "Trader Joe's run", "Freelance payment")
  - description: string (optional, free text)
  - date: timestamp     (date of the transaction, not creation date)
  - createdAt: timestamp
  - source: "manual" | "receipt"
  - receiptId: string | null   (set if source == "receipt", FK to receipts/{receiptId})
```

**Design note:** Expenses and income are stored in one collection with a `type` discriminator rather than two collections. This makes the Expense History view and Analytics queries simpler (one query, filter client-side or via a Firestore `where` clause) at the cost of a slightly more generic schema. For a demo-scale app this tradeoff favors simplicity.

**No `imageUrl` field.** Per the no-stored-images design goal (§2.4), there is never a receipt image to link to. Entries derived from a receipt are visually represented by a reconstructed text card, not a photo — see §5.3.1.

### 4.3 `receipts`
```
receipts/{receiptId}
  - userId: string (owner)
  - merchant: string
  - purchaseDate: timestamp
  - rawOcrText: string       (full text blob from Vision API, kept for debugging/reparsing)
  - items: array of {
      itemId: string
      label: string
      price: number
      quantity: number
    }
  - tax: number
  - tip: number
  - total: number
  - createdAt: timestamp
  - status: "pending_review" | "confirmed"
```

**No `imageUrl` field; no Storage reference of any kind.** The uploaded image is processed entirely in-memory inside the `parseReceipt` Cloud Function (base64 in the request → Vision API call → discard) and never written to disk or to Firebase Storage. `rawOcrText` is the only artifact retained from the original image — it exists specifically so a botched parse can be manually re-corrected against the *text*, since (per §2.4) there is no image to fall back on for a true re-OCR.

### 4.4 `splits`
A split is the bill-splitting session tied to a single receipt, accessed via a shareable link.

```
splits/{splitId}
  - receiptId: string (FK to receipts/{receiptId})
  - ownerId: string (FK to users/{userId})
  - shareToken: string (random URL-safe token, unique, indexed — this IS the link slug)
  - createdAt: timestamp
  - expiresAt: timestamp        (e.g. createdAt + 7 days)
  - status: "open" | "closed" | "expired"
  - itemAssignments: array of {
      itemId: string            (matches receipts.items[].itemId)
      claimedBy: string | null  (display name entered by claimant, NOT a userId — claimants are anonymous)
      claimantSessionId: string | null (random id set client-side per claimant, used so a claimant can un-claim their own picks without affecting others)
    }
  - taxTipSplitMethod: "even" | "proportional"
     // even: tax+tip divided equally across everyone who claimed >=1 item
     // proportional: tax+tip divided proportionally to each person's subtotal
```

**Design note on anonymity:** Per your requirement, claimants don't log in. `claimedBy` is just a free-text name. To prevent one claimant from accidentally (or maliciously) un-claiming someone else's items, each claimant's browser generates a random `claimantSessionId` (stored in `localStorage`) the first time they interact with the link; un-claim actions are only allowed if `claimantSessionId` matches. This is a soft protection appropriate for a demo, not real auth — call this out in the README as a known limitation.

---

## 5. Page-by-Page Specification

### 5.1 Upload Receipt page

**Purpose:** Upload an image, trigger OCR, review/correct the parse, optionally kick off a split. The original image is never stored — see §2.4. It exists client-side until upload, travels to the backend once as part of the OCR call, and is discarded server-side immediately after that call returns. After this page's review step is complete, **only text and structured data persist** — there is no source image left to re-check against.

**Layout:**
- Drag-and-drop / file-picker upload zone (accepts .jpg, .png, .heic → convert HEIC client-side if needed, or reject with a clear message).
- On file selection: read the file client-side and convert to base64 (no upload-to-Storage step — see §2.3 on image transport). Show a loading state while the base64 payload is sent to the `parseReceipt` Cloud Function and OCR runs.
- While the image is still in memory client-side (i.e. during this same page load, before/while OCR is processing), display a preview of the photo so the user has something to visually check their line-item corrections against. **This preview is the only time in the entire app the actual photo is visible** — once the user navigates away or the parse is saved, the image is gone for good, by design.
- **Review panel** once OCR returns:
  - Editable fields: Merchant name, Date, Tax, Tip, Total (all pre-filled from OCR, user can correct).
  - Editable line-items table: each row = `{label, price, quantity}`, with add-row / delete-row controls (OCR will sometimes miss or mis-split a line).
  - A live-computed "Sum of items + tax + tip" vs "OCR total" reconciliation check — flag a warning if they don't match within a cent, since OCR misreads are common.
  - **This review step carries more weight than it would in an image-retaining version of the app**: because the source photo is discarded once the user moves on, this is the only opportunity to fix a bad OCR read. Consider a slightly more prominent "double-check this before saving — the original photo won't be kept" notice near the save button.
- **"Save as Expense" button** — commits the receipt as a single `entries` record (amount = total, category = user-selected, source = "receipt"). At this point the in-memory image reference (e.g. a local object URL) should be released/cleared client-side too.
- **"Split this receipt" button** — proceeds to the splitting UI below without necessarily saving yet (or saves first, then opens split UI — implementation's choice, but split should always be tied to a saved receipt for data integrity).

**Splitting sub-section** (appears after "Split this receipt" is clicked):
- List of parsed items, each with a quantity-aware row.
- For the **owner's own pre-assignment** (optional convenience, not required): owner can pre-tag which items are "definitely mine" before sharing, so the link only needs splitting on the remainder. Simpler v1: skip pre-assignment, every item starts unclaimed and the owner participates via the link like everyone else.
- Choice of tax/tip split method: even vs proportional (radio buttons).
- **"Generate Share Link" button** → calls backend to create a `splits` document and returns a URL like:
  `https://yourapp.com/split/{shareToken}`
- Display the link with a copy-to-clipboard button, and an expiration note ("This link expires in 7 days").
- Live view of claim status updates here too (owner can watch claims come in in real time via Firestore's `onSnapshot` listener) so the owner doesn't have to leave the page.
- The claim page (§5.2) also has no image to show — it renders the same text-based receipt-card style described in §5.3.1, so the visual language is consistent between "my history" and "the link I sent a friend."

### 5.2 Split Claim Page (public, link-accessed, no login)

Route: `/split/:shareToken` — outside the authenticated app shell.

**Layout:**
- Header: merchant name, date, total.
- Prompt: "Enter your name to claim your items" (text input, no account creation).
- List of line items, each showing: label, price, quantity, and **who has claimed it so far** (could be multiple people splitting one item — see note below).
- Claimant checks the box next to item(s) that are theirs. Multiple claimants can share a single item (e.g. a shared appetizer) — in that case the item's price is split evenly among however many people checked it, unless you want to scope this out for v1 and keep it 1-item-1-claimant for simplicity (recommend stating this as a v1 simplification).
- Running total for the claimant displayed live ("Your total so far: $14.32, including a share of tax/tip").
- "Confirm my split" button — locks in that claimant's selections (still editable until the owner closes the link, but confirming gives the claimant a clear "done" state, e.g. show a checkmark).
- If link is expired/closed: show a friendly "this link is no longer active" state instead of the claim UI.

### 5.3 Expense History page

- Table/list view, sortable by date/amount, filterable by type (expense/income), category, and date range.
- Each row: date, name, category, amount (color-coded: red for expense, green for income), source tag (manual vs. receipt-derived — see §5.3.1 for what "viewing" a receipt-derived entry shows now that no image is stored).
- Search bar (filter by name/description substring).
- Pagination or infinite scroll (Firestore queries with `startAfter` cursors).
- Click a row → expand/detail view. For receipt-derived entries, this opens the receipt card described in §5.3.1 rather than an image.
- Edit/delete actions per row.

#### 5.3.1 Receipt Card (replaces the image thumbnail/gallery)

Since no receipt image is ever stored (§2.4), "view the receipt" can't mean "view the photo" anymore. Instead, each receipt-derived entry renders as a **stylized text receipt card** — visually evoking a paper receipt (narrow proportions, monospace or receipt-style font, a torn/perforated edge motif, subtle off-white background) but composed entirely from the structured `receipts/{receiptId}` data, not an image.

**Card contents, top to bottom (mimicking real receipt layout):**
```
┌─────────────────────────┐
│      MERCHANT NAME       │
│      <purchase date>     │
│  - - - - - - - - - - -   │
│  Bananas (x2)      1.98  │
│  Almond Milk        3.49 │
│  Bread              2.99 │
│  - - - - - - - - - - -   │
│  Tax                0.42 │
│  Total              8.88 │
└─────────────────────────┘
```
- Rendered from `receipts.items[]`, `receipts.tax`, `receipts.tip`, `receipts.total` — i.e. the same structured fields the review UI in §5.1 already produced and the user already corrected, so this card is guaranteed consistent with what the user confirmed (not a re-parse of `rawOcrText`).
- This card is the surface used in **three places**, so build it as one shared component:
  1. **Expense History detail/expand view** for a receipt-derived entry (this section).
  2. **A dedicated "Receipt Gallery" view** — if Expense History filters to receipt-derived entries only, render them as a responsive grid of these cards instead of (or in addition to) table rows, so the experience still feels like flipping through a stack of receipts, just rendered in text instead of photographed. This is the most direct replacement for "look at my pile of receipt photos."
  3. **Split Claim Page (§5.2)** and **Upload Receipt's split sub-section (§5.1)** — both already render the items list; reusing the same card component here keeps visual language consistent across the app rather than having a second bespoke "receipt-looking" component.
- `rawOcrText` is **not** displayed on this card by default (it's noisy — full unstructured OCR output). Optionally surface it behind a small "view raw scan text" toggle for debugging/curiosity, but the structured card is the primary view.

### 5.3.2 Receipt Gallery view

Optional but recommended given the explicit ask for "close to an actual receipt image gallery, but text." Add a gallery/grid display mode toggle on the Expense History page (or as its own small section) that shows only `source: "receipt"` entries as a responsive grid of the Receipt Card component from §5.3.1, most recent first. This is the spiritual replacement for what would have been a photo gallery of receipt images — same browsing feel, zero stored images.

### 5.4 Add Expense page (manual entry)

Form fields:
- Amount (number, required)
- Name (text, required)
- Category (dropdown, predefined list + "Other")
- Date (date picker, defaults to today)
- Description (optional, free text)
- Submit → creates an `entries` doc with `type: "expense"`, `source: "manual"`.

### 5.5 Add Income page (manual entry)

Same shape as Add Expense, with `type: "income"` and an income-relevant category list (Salary, Freelance, Gift, Refund, Other).

### 5.6 Analytics page

- **Spending by category** — pie or donut chart (Recharts `PieChart`), filterable by date range.
- **Spending over time** — line or bar chart, monthly or weekly buckets, expenses vs. income overlaid for a quick net view.
- **Top merchants/categories** — simple ranked list alongside the charts.
- Date range selector (this month, last 3 months, year to date, custom range) drives all charts on the page.
- All chart data computed client-side from a single query of the user's `entries` (fine at demo scale — no need for backend aggregation jobs).

---

## 6. Backend / API Surface

Whether implemented as Firebase Cloud Functions or Supabase Edge Functions, these are the server-side operations needed (i.e. things that must NOT run purely client-side, either for security — API keys — or for data-integrity reasons — generating unique tokens):

### 6.1 `POST /ocr/parseReceipt`
- **Input:** `{ imageBase64: string, mimeType: string }` — the receipt image, base64-encoded, sent directly in the request body. There is no Storage upload step before this call (see §2.3, §2.4) — the client reads the selected file, encodes it, and sends it straight to this function.
- **Action:** Calls Google Cloud Vision API `DOCUMENT_TEXT_DETECTION` using inline image content (not a GCS URI, since the image was never written to Storage), runs the raw text through a parsing routine to extract merchant/date/items/tax/tip/total, returns structured JSON. The decoded image buffer exists only for the duration of this function call and is never written to disk, Storage, or any other persistent location — it is discarded (goes out of scope / garbage collected) as soon as the function returns.
- **Output:** `{ merchant, purchaseDate, items: [{label, price, quantity}], tax, tip, total, rawOcrText }` — notably, no `imageUrl` in the response, since none was created.
- **Parsing approach (heuristic, since Vision API gives text not structure):**
  1. Split OCR text into lines.
  2. Merchant = first non-empty line (commonly the store name) — flag for user correction since this is the least reliable heuristic.
  3. Date = regex match against common date formats (`MM/DD/YYYY`, `DD-MM-YY`, etc.) anywhere in the text.
  4. Line items = lines matching a pattern of `<text> ... <price>` where price matches `\$?\d+\.\d{2}`; quantity defaults to 1 unless a leading `\d+\s*x` or `\d+\s*@` pattern is found.
  5. Tax/Tip/Total = lines whose label text fuzzy-matches "tax", "tip"/"gratuity", "total"/"amount due" respectively, taking the trailing price on that line.
  6. This is inherently imperfect — hence the mandatory review/edit UI in §5.1 before saving. **This matters more here than in an image-retaining design**: once the user leaves the review step, there is no stored image to re-OCR against if a mistake is discovered later (see §2.4).

### 6.2 `POST /splits/create`
- **Input:** `receiptId`, `taxTipSplitMethod`.
- **Action:** Generates a cryptographically random `shareToken` (e.g. `crypto.randomUUID()` or nanoid), creates a `splits` document with `status: "open"` and a 7-day `expiresAt`.
- **Output:** `{ splitId, shareToken, shareUrl }`

### 6.3 `GET /splits/:shareToken`
- **Action:** Public, unauthenticated. Looks up split by token, checks `expiresAt`/`status`, returns the receipt + current claim state, or a 410-style "expired" response.

### 6.4 `POST /splits/:shareToken/claim`
- **Input:** `itemId`, `claimantName`, `claimantSessionId`.
- **Action:** Adds/updates the claim entry for that item. Validates the split is still `open` and not expired.

### 6.5 `POST /splits/:shareToken/unclaim`
- **Input:** `itemId`, `claimantSessionId`.
- **Action:** Removes a claim — only if the requesting `claimantSessionId` matches the one on record for that item.

### 6.6 `POST /splits/:shareToken/close`
- **Auth required** (owner only). Marks the split `closed`, freezing the claim state — optionally also auto-creates `entries` records for the owner's own remaining share.

---

## 7. Security Notes (demo-scale, but worth stating explicitly)

- All Cloud Functions that touch Google Cloud Vision must run server-side with the service account — never ship a Vision API key to the client.
- **No Firebase Storage security rules are needed** in this version — there is no Storage bucket usage at all (§2.4), so this entire surface area is simply absent rather than needing to be locked down. If a future iteration reintroduces stored images (e.g. for a "re-OCR" feature), Storage rules will need to be added at that point — don't assume they exist just because they existed in an earlier version of this project.
- Firestore Security Rules (or Supabase RLS policies) must ensure:
  - A user can only read/write their own `entries` and `receipts`.
  - The `splits` collection's read access for a given doc is gated by knowing the `shareToken` (i.e. structure the query/rule around token lookup, not open collection reads) but write access to claim/unclaim should be allowed for unauthenticated requests *scoped to that one split document only*.
  - Only the `ownerId` can call `close` or `create` for a given receipt's split.
- Rate-limit (or at least note as a future improvement) the public claim endpoint to prevent abuse, since it's intentionally unauthenticated.
- **Image payload handling:** since the receipt image now travels as base64 in the `parseReceipt` request body rather than as a Storage reference, make sure no logging statement in that Cloud Function accidentally logs the full request payload (`request.data`) — that would write image bytes into Cloud Functions logs, defeating the purpose of not storing them. Log individual fields (e.g. `mimeType`, image size in bytes) instead of the whole payload.
- This is explicitly a **demo project** — call out in the README that the anonymous-claim model trades some security for usability, which is acceptable for the stated use case (splitting a dinner bill with friends) but would need hardening (e.g. magic-link auth per claimant) for a production version.

---

## 8. Suggested Build Order

1. Scaffold React app (Vite) + set up Firebase project (Auth, Firestore, Functions — no Storage needed, see §2.4).
2. Auth flow (sign up / log in) + basic app shell with the 5 tabs.
3. Manual Add Expense / Add Income forms → wire to `entries` collection.
4. Expense History page reading from `entries`.
5. Analytics page (Recharts) reading from `entries`.
6. Receipt upload: client-side base64 encode → Cloud Function calling Google Cloud Vision with inline image content → parsing heuristics → review/correction UI → save structured data only (no image persisted).
7. Receipt Card component (§5.3.1) + Receipt Gallery view (§5.3.2).
8. Splits: create-link flow, public claim page (rendering the same Receipt Card), real-time claim updates, close-link flow.
9. Polish: loading states, empty states, error states, expired-link state.

---

## 9. Out of Scope (v1)

- Multi-currency conversion.
- Recurring transactions / budgets / alerts.
- Multi-item-per-claimant proportional splitting beyond the simple even/proportional tax-tip toggle.
- Real payment processing/settlement between split participants (this app tracks *who owes what*, it does not move money).
- Mobile app (web-responsive only).
