/**
 * Receipt Card — spec section 5.3.1.
 *
 * Replaces the "view receipt image" thumbnail from the storage-backed
 * version of this app. Since no receipt photo is ever saved (spec
 * section 2.4), this component reconstructs the *look* of a paper
 * receipt entirely from structured text data (receipts/{receiptId}).
 *
 * Design notes (so this doesn't get "fixed" back into a generic card):
 *  - Monospace type for the itemized body — real receipt printers are
 *    dot-matrix/monospace, and this is what makes it read as "receipt"
 *    rather than "card with a list."
 *  - Cream paper background + charcoal ink + a single muted red accent
 *    used ONLY on the total, like a rubber ink stamp — not a generic
 *    blue/green app accent color.
 *  - A torn/zigzag bottom edge (clip-path) is the one signature visual
 *    flourish. Don't add more decoration around it — let this be the
 *    one bold element and keep everything else quiet, per design
 *    principles in the frontend-design skill.
 *
 * Used in THREE places per spec 5.3.1 — keep this component generic
 * enough to serve all three without special-casing:
 *   1. Expense History detail/expand view for a receipt-derived entry
 *   2. Receipt Gallery grid (spec 5.3.2)
 *   3. Split Claim Page (5.2) / Upload Receipt's split sub-section (5.1)
 */
export default function ReceiptCard({ receipt, compact = false }) {
  const { merchant, purchaseDate, items = [], tax = 0, tip = 0, total = 0 } = receipt;

  const dateLabel = purchaseDate
    ? new Date(purchaseDate?.toDate ? purchaseDate.toDate() : purchaseDate).toLocaleDateString()
    : '';

  return (
    <div
      className="relative mx-auto w-full max-w-xs"
      style={{ fontFamily: "'JetBrains Mono', ui-monospace, 'Courier New', monospace" }}
    >
      <div
        className="px-5 pt-6"
        style={{
          backgroundColor: '#FAF7F0',
          color: '#2B2B28',
          paddingBottom: '28px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-wide">{merchant || 'Unknown Merchant'}</p>
          {dateLabel && <p className="mt-0.5 text-[11px]" style={{ color: '#8A8680' }}>{dateLabel}</p>}
        </div>

        <Divider />

        {/* Line items */}
        <div className="space-y-1">
          {items.length === 0 && (
            <p className="text-center text-[11px]" style={{ color: '#8A8680' }}>
              No items recorded
            </p>
          )}
          {items.map((item) => (
            <div key={item.itemId} className="flex justify-between gap-2 text-[12px] leading-snug">
              <span className="truncate">
                {item.label}
                {item.quantity > 1 ? ` x${item.quantity}` : ''}
              </span>
              <span className="shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <Divider />

        {/* Tax / tip */}
        <div className="space-y-1 text-[12px]">
          <div className="flex justify-between">
            <span style={{ color: '#8A8680' }}>Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          {tip > 0 && (
            <div className="flex justify-between">
              <span style={{ color: '#8A8680' }}>Tip</span>
              <span>${tip.toFixed(2)}</span>
            </div>
          )}
        </div>

        <Divider />

        {/* Total — the one accent moment */}
        <div className="flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span style={{ color: '#B5443C' }}>${total.toFixed(2)}</span>
        </div>

        {!compact && (
          <p className="mt-4 text-center text-[10px] uppercase tracking-widest" style={{ color: '#8A8680' }}>
            * Scanned receipt, no photo stored *
          </p>
        )}
      </div>

      {/* Torn-paper bottom edge — the signature element */}
      <div
        aria-hidden="true"
        className="h-3 w-full"
        style={{
          backgroundColor: '#FAF7F0',
          clipPath:
            'polygon(0% 0%, 4% 100%, 8% 0%, 12% 100%, 16% 0%, 20% 100%, 24% 0%, 28% 100%, 32% 0%, 36% 100%, 40% 0%, 44% 100%, 48% 0%, 52% 100%, 56% 0%, 60% 100%, 64% 0%, 68% 100%, 72% 0%, 76% 100%, 80% 0%, 84% 100%, 88% 0%, 92% 100%, 96% 0%, 100% 100%, 100% 0%)',
        }}
      />
    </div>
  );
}

function Divider() {
  return (
    <div
      className="my-2"
      style={{
        borderTop: '1px dashed #C9C4B8',
      }}
    />
  );
}
