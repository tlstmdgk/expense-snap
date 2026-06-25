import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchSplitByToken,
  subscribeSplitUpdates,
  claimItem,
  unclaimItem,
  getOrCreateClaimantSessionId,
} from '../services/splitService.js';
import ReceiptCard from '../components/receipt/ReceiptCard.jsx';

/**
 * Spec section 5.2 — public, link-accessed, NO LOGIN. Route: /split/:shareToken.
 * Claimant enters a name (no account), checks items that are theirs, sees a
 * live running total. v1 simplification: 1 item = 1 claimant (no shared-item
 * splitting among multiple claimants) — see spec 5.2 note.
 */
export default function SplitClaimPage() {
  const { shareToken } = useParams();
  const [loadState, setLoadState] = useState('loading'); // loading | ready | expired | error
  const [receipt, setReceipt] = useState(null);
  const [split, setSplit] = useState(null);
  const [claimantName, setClaimantName] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const mySessionId = getOrCreateClaimantSessionId();

  useEffect(() => {
    let unsubscribe;

    async function load() {
      try {
        const result = await fetchSplitByToken(shareToken);
        setReceipt(result.receipt);
        setSplit(result.split);
        setLoadState('ready');

        unsubscribe = subscribeSplitUpdates(result.split.id, setSplit);
      } catch (err) {
        setLoadState(err.code === 'expired' ? 'expired' : 'error');
      }
    }

    load();
    return () => unsubscribe?.();
  }, [shareToken]);

  async function handleToggleItem(itemId, isCurrentlyMine) {
    if (!claimantName.trim()) return;
    if (isCurrentlyMine) {
      await unclaimItem(shareToken, { itemId });
    } else {
      await claimItem(shareToken, { itemId, claimantName: claimantName.trim() });
    }
  }

  if (loadState === 'loading') {
    return <CenteredMessage>Loading...</CenteredMessage>;
  }

  if (loadState === 'expired') {
    return <CenteredMessage>This link is no longer active.</CenteredMessage>;
  }

  if (loadState === 'error') {
    return <CenteredMessage>We couldn't find this split. The link may be incorrect.</CenteredMessage>;
  }

  const assignments = split.itemAssignments ?? [];
  const myItems = assignments.filter((a) => a.claimantSessionId === mySessionId);
  const myItemIds = new Set(myItems.map((a) => a.itemId));

  const mySubtotal = receipt.items
    .filter((item) => myItemIds.has(item.itemId))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  const claimedSubtotal = receipt.items
    .filter((item) => assignments.find((a) => a.itemId === item.itemId)?.claimedBy)
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  const myShareOfTaxTip =
    claimedSubtotal > 0 ? ((receipt.tax + receipt.tip) * mySubtotal) / claimedSubtotal : 0;

  const myTotal = mySubtotal + (myItemIds.size > 0 ? myShareOfTaxTip : 0);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-md space-y-6">
        {/* Shared Receipt Card (spec 5.3.1) — same component used in the
            Expense History detail view and Receipt Gallery, so the claim
            page's visual language matches the rest of the app even
            though no photo exists anywhere in this flow. */}
        <ReceiptCard receipt={receipt} compact />

        {split.status !== 'open' ? (
          <CenteredMessage>This link is no longer active.</CenteredMessage>
        ) : (
          <>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700">Your name</label>
              <input
                type="text"
                value={claimantName}
                onChange={(e) => setClaimantName(e.target.value)}
                placeholder="Enter your name to claim items"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
            </div>

            <div className="space-y-2 rounded-lg border bg-white p-4 shadow-sm">
              {receipt.items.map((item) => {
                const assignment = assignments.find((a) => a.itemId === item.itemId);
                const isMine = assignment?.claimantSessionId === mySessionId;
                const isTakenByOther = assignment?.claimedBy && !isMine;

                return (
                  <label
                    key={item.itemId}
                    className={`flex items-center justify-between rounded-md px-2 py-2 text-sm ${
                      isTakenByOther ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isMine}
                        disabled={isTakenByOther || !claimantName.trim()}
                        onChange={() => handleToggleItem(item.itemId, isMine)}
                      />
                      {item.label} {item.quantity > 1 ? `(x${item.quantity})` : ''}
                    </span>
                    <span className="text-gray-600">
                      ${(item.price * item.quantity).toFixed(2)}
                      {assignment?.claimedBy && (
                        <span className="ml-2 text-xs text-gray-400">— {assignment.claimedBy}</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-600">
                Your total so far: <span className="font-semibold text-gray-900">${myTotal.toFixed(2)}</span>{' '}
                <span className="text-xs text-gray-400">(includes your share of tax/tip)</span>
              </p>
              <button
                onClick={() => setConfirmed(true)}
                disabled={myItemIds.size === 0}
                className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {confirmed ? '✓ Confirmed' : 'Confirm my split'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CenteredMessage({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-center text-gray-500">
      {children}
    </div>
  );
}
