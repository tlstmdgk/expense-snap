/**
 * Editable line-items table used in the OCR review step (spec 5.1).
 * Each row: label, price, quantity. Supports add/delete rows since OCR
 * commonly mis-splits or misses lines.
 */
export default function ReceiptItemsTable({ items, onChange }) {
  function updateItem(itemId, field, value) {
    onChange(items.map((item) => (item.itemId === itemId ? { ...item, [field]: value } : item)));
  }

  function addRow() {
    onChange([
      ...items,
      { itemId: crypto.randomUUID(), label: '', price: 0, quantity: 1 },
    ]);
  }

  function deleteRow(itemId) {
    onChange(items.filter((item) => item.itemId !== itemId));
  }

  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr>
            <th className="py-1">Item</th>
            <th className="py-1 w-20">Qty</th>
            <th className="py-1 w-24">Price</th>
            <th className="py-1 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.itemId} className="border-t">
              <td className="py-1 pr-2">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem(item.itemId, 'label', e.target.value)}
                  className="w-full rounded border border-gray-200 px-2 py-1"
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.itemId, 'quantity', parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded border border-gray-200 px-2 py-1"
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  type="number"
                  step="0.01"
                  value={item.price}
                  onChange={(e) => updateItem(item.itemId, 'price', parseFloat(e.target.value) || 0)}
                  className="w-full rounded border border-gray-200 px-2 py-1"
                />
              </td>
              <td className="py-1 text-right">
                <button onClick={() => deleteRow(item.itemId)} className="text-xs text-gray-400 hover:text-red-600">
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={addRow} className="text-sm text-blue-600 hover:underline">
        + Add item
      </button>
    </div>
  );
}
