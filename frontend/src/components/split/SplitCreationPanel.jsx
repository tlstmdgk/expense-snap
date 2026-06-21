import { useEffect, useState } from 'react';
import { createSplit, subscribeSplitUpdates } from '../../services/splitService.js';

/**
 * Spec section 5.1 "Splitting sub-section" — tax/tip method choice,
 * generate-link button, copyable link with expiration note, and a live
 * view of claims coming in via Firestore onSnapshot so the owner doesn't
 * have to leave the page (spec explicitly calls this out).
 */
export default function SplitCreationPanel({ receiptId }) {
  const [taxTipMethod, setTaxTipMethod] = useState('even');
  const [splitInfo, setSplitInfo] = useState(null); // { splitId, shareToken, shareUrl }
  const [liveSplit, setLiveSplit] = useState(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!splitInfo?.splitId) return;
    const unsubscribe = subscribeSplitUpdates(splitInfo.splitId, setLiveSplit);
    return unsubscribe;
  }, [splitInfo?.splitId]);

  async function handleGenerateLink() {
    setCreating(true);
    try {
      const result = await createSplit(receiptId, taxTipMethod);
      setSplitInfo(result);
    } finally {
      setCreating(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(splitInfo.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const claimedCount = liveSplit?.itemAssignments?.filter((a) => a.claimedBy).length ?? 0;
  const totalCount = liveSplit?.itemAssignments?.length ?? 0;

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-medium text-gray-700">Split this receipt</h3>

      {!splitInfo && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tax &amp; tip split method</label>
            <div className="mt-1 flex gap-4 text-sm text-gray-600">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={taxTipMethod === 'even'}
                  onChange={() => setTaxTipMethod('even')}
                />
                Split evenly
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={taxTipMethod === 'proportional'}
                  onChange={() => setTaxTipMethod('proportional')}
                />
                Proportional to subtotal
              </label>
            </div>
          </div>
          <button
            onClick={handleGenerateLink}
            disabled={creating}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Generating...' : 'Generate Share Link'}
          </button>
        </>
      )}

      {splitInfo && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
            <code className="flex-1 truncate text-sm text-gray-700">{splitInfo.shareUrl}</code>
            <button onClick={handleCopy} className="text-sm font-medium text-blue-600 hover:underline">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-400">This link expires in 7 days.</p>

          <div>
            <p className="text-sm text-gray-600">
              {claimedCount} / {totalCount} items claimed so far:
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {liveSplit?.itemAssignments?.map((a) => (
                <li key={a.itemId} className="flex justify-between text-gray-600">
                  <span>{a.itemId}</span>
                  <span>{a.claimedBy ?? 'unclaimed'}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
