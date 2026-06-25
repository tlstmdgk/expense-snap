import { useQuery } from '@tanstack/react-query';
import { fetchReceiptsForUser } from '../../services/receiptService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import ReceiptCard from '../receipt/ReceiptCard.jsx';

/**
 * Receipt Gallery — spec section 5.3.2.
 *
 * The direct replacement for what would have been a photo gallery of
 * receipt images in the storage-backed version of this app. Same
 * browsing feel (a grid of "receipts" to flip through), zero stored
 * images — each tile is a ReceiptCard rendered from structured text
 * data (spec 5.3.1).
 */
export default function ReceiptGallery() {
  const { user } = useAuth();

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['receipts', user.uid],
    queryFn: () => fetchReceiptsForUser(user.uid),
  });

  if (isLoading) {
    return <p className="text-center text-gray-400">Loading receipts...</p>;
  }

  if (receipts.length === 0) {
    return (
      <p className="text-center text-gray-400">
        No receipts yet — upload one from the Upload Receipt tab to see it here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {receipts.map((receipt) => (
        <ReceiptCard key={receipt.id} receipt={receipt} />
      ))}
    </div>
  );
}
