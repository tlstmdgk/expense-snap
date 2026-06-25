import { useEffect, useRef, useState } from 'react';
import { createLocalPreviewUrl, parseReceiptImage, saveReceipt } from '../services/receiptService.js';
import { createEntry } from '../services/entriesService.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { EXPENSE_CATEGORIES } from '../utils/categories.js';
import ReceiptItemsTable from '../components/receipt/ReceiptItemsTable.jsx';
import ReconciliationCheck from '../components/receipt/ReconciliationCheck.jsx';
import SplitCreationPanel from '../components/split/SplitCreationPanel.jsx';

const STEPS = {
  UPLOAD: 'upload',
  PROCESSING: 'processing',
  REVIEW: 'review',
  SAVED: 'saved',
};


export default function UploadReceiptPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [error, setError] = useState('');

  const [previewUrl, setPreviewUrl] = useState(null);
  const previewUrlRef = useRef(null);

  const [merchant, setMerchant] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [items, setItems] = useState([]);
  const [tax, setTax] = useState(0);
  const [tip, setTip] = useState(0);
  const [total, setTotal] = useState(0);
  const [rawOcrText, setRawOcrText] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);

  const [savedReceiptId, setSavedReceiptId] = useState(null);

  // Belt-and-suspenders cleanup: revoke the preview URL on unmount too,
  // in case the user navigates away mid-review without clicking Save/Reset.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  function setPreview(url) {
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }

  function releasePreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setStep(STEPS.PROCESSING);

    // Local-only preview for the review step (see component doc comment
    // above) — this never touches the network.
    setPreview(createLocalPreviewUrl(file));

    try {
      const parsed = await parseReceiptImage(file);
      setMerchant(parsed.merchant ?? '');
      setPurchaseDate(parsed.purchaseDate ?? new Date().toISOString().slice(0, 10));
      setItems(parsed.items ?? []);
      setTax(parsed.tax ?? 0);
      setTip(parsed.tip ?? 0);
      setTotal(parsed.total ?? 0);
      setRawOcrText(parsed.rawOcrText ?? '');
      setStep(STEPS.REVIEW);
    } catch (err) {
      if (err.code === 'functions/resource-exhausted') {
        setError('You have reached today\'s receipt upload limit. You can upload 2 receipts per day.');
      } else {
        setError(`Couldn't process that receipt: ${err.message}. You can still enter it manually below.`);
      }
      setItems([]);
      setStep(STEPS.REVIEW);
    }
  }

  async function handleSaveReceipt() {
    const receiptId = await saveReceipt(user.uid, {
      merchant,
      purchaseDate,
      items,
      tax,
      tip,
      total,
      rawOcrText,
    });
    setSavedReceiptId(receiptId);

    await createEntry(user.uid, {
      type: 'expense',
      amount: total,
      category,
      name: merchant || 'Receipt',
      date: purchaseDate,
      source: 'receipt',
      receiptId,
    });

    // The receipt is now saved as text/structured data only. Release the
    // local image preview immediately — by design, nothing visual
    // persists past this point (spec section 2.4).
    releasePreview();
    setStep(STEPS.SAVED);
  }

  function handleReset() {
    releasePreview();
    setStep(STEPS.UPLOAD);
    setMerchant('');
    setPurchaseDate('');
    setItems([]);
    setTax(0);
    setTip(0);
    setTotal(0);
    setRawOcrText('');
    setSavedReceiptId(null);
    setError('');
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Upload Receipt</h2>

      {step === STEPS.UPLOAD && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-10 text-center">
          <input
            type="file"
            accept="image/jpeg,image/png,image/heic"
            onChange={handleFileSelected}
            className="mx-auto text-sm text-gray-600"
          />
          <p className="mt-2 text-xs text-gray-400">JPG or PNG. HEIC will be converted automatically.</p>
          <p className="mt-1 text-xs text-gray-400">
            Your receipt photo is never stored — only the scanned text and amounts are saved.
          </p>
        </div>
      )}

      {step === STEPS.PROCESSING && (
        <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
          Reading your receipt...
        </div>
      )}

      {step === STEPS.REVIEW && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            {previewUrl && (
              <>
                <img
                  src={previewUrl}
                  alt="Uploaded receipt (preview only, not saved)"
                  className="max-h-80 w-full rounded-lg border object-contain"
                />
                <p className="text-xs text-gray-400">
                  This photo is shown only so you can double-check the parsed details. It won't be saved —
                  double check everything below before continuing, since you won't be able to come back to the
                  original photo afterward.
                </p>
              </>
            )}
            {error && <p className="text-sm text-amber-600">{error}</p>}
          </div>

          <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500">Merchant</label>
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Date</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
            </div>

            <ReceiptItemsTable items={items} onChange={setItems} />

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500">Tax</label>
                <input
                  type="number"
                  step="0.01"
                  value={tax}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Tip</label>
                <input
                  type="number"
                  step="0.01"
                  value={tip}
                  onChange={(e) => setTip(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Total</label>
                <input
                  type="number"
                  step="0.01"
                  value={total}
                  onChange={(e) => setTotal(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
            </div>

            <ReconciliationCheck items={items} tax={tax} tip={tip} total={total} />

            <div>
              <label className="block text-xs font-medium text-gray-500">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSaveReceipt}
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save as Expense
            </button>
          </div>
        </div>
      )}

      {step === STEPS.SAVED && (
        <div className="space-y-6">
          <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
            Receipt saved to your Expense History.
          </div>

          <SplitCreationPanel receiptId={savedReceiptId} />

          <button onClick={handleReset} className="text-sm text-blue-600 hover:underline">
            Upload another receipt
          </button>
        </div>
      )}
    </div>
  );
}
