/**
 * Live reconciliation check described in spec 5.1: warns when
 * sum(items) + tax + tip doesn't match the OCR-reported total, since
 * OCR misreads are common and this is the cheapest signal to the user
 * that something needs correcting before saving.
 */
export default function ReconciliationCheck({ items, tax, tip, total }) {
  const itemsSum = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const computedTotal = itemsSum + (tax || 0) + (tip || 0);
  const diff = Math.round((computedTotal - total) * 100) / 100;
  const matches = Math.abs(diff) < 0.01;

  return (
    <div
      className={`rounded-md px-3 py-2 text-sm ${
        matches ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {matches ? (
        <>Items + tax + tip match the receipt total (${computedTotal.toFixed(2)}).</>
      ) : (
        <>
          Heads up: items + tax + tip (${computedTotal.toFixed(2)}) doesn't match the receipt total ($
          {total.toFixed(2)}). Difference: ${Math.abs(diff).toFixed(2)}. Double check the line items above.
        </>
      )}
    </div>
  );
}
