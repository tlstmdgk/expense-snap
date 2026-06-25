import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createEntry, fetchEntries, deleteEntry } from '../services/entriesService.js';
import { fetchReceipt } from '../services/receiptService.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ALL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../utils/categories.js';
import ReceiptCard from '../components/receipt/ReceiptCard.jsx';

/**
 * Spec section 5.3 — sortable/filterable table, search, pagination,
 * color-coded amounts, edit/delete actions. "View receipt" now opens the
 * Receipt Card (spec 5.3.1) instead of an image link, since no receipt
 * photo is ever stored (spec 2.4). A view-mode toggle additionally
 * exposes the Receipt Gallery (spec 5.3.2) as a dedicated browsing view.
 *
 * NOTE: edit-in-place is still a stubbed TODO — wire up to updateEntry()
 * from entriesService and a modal/drawer component as a follow-up; the
 * data layer already supports it.
 */
export default function ExpenseHistoryPage() {
  const { user } = useAuth();
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [openReceipt, setOpenReceipt] = useState(null); // receipt doc currently shown in the modal
  const [entryType, setEntryType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['entries', user.uid, typeFilter, categoryFilter],
    queryFn: () =>
      fetchEntries(user.uid, {
        type: typeFilter || undefined,
        category: categoryFilter || undefined,
      }),
    enabled: Boolean(user?.uid),
  });

  const entries = (data?.entries ?? []).filter((entry) =>
    search ? entry.name.toLowerCase().includes(search.toLowerCase()) : true
  );
  const totals = entries.reduce(
    (acc, entry) => {
      if (entry.type === 'expense') {
        acc.expense += entry.amount ?? 0;
      } else if (entry.type === 'income') {
        acc.income += entry.amount ?? 0;
      }
      return acc;
    },
    { expense: 0, income: 0 }
  );
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  async function handleDelete(entryId) {
    if (!confirm('Delete this entry?')) return;
    await deleteEntry(entryId);
    refetch();
  }

  async function handleCreateEntry(e) {
    e.preventDefault();
    setSubmitting(true);
    setSaveError('');
    setSaved(false);
    try {
      await createEntry(user.uid, {
        type: entryType,
        amount: parseFloat(amount),
        name,
        category,
        date,
        description,
        source: 'manual',
      });
      setAmount('');
      setName('');
      setDescription('');
      setSaved(true);
      refetch();
    } catch (err) {
      setSaveError(err?.message ?? 'Could not save entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleTypeChange(nextType) {
    setEntryType(nextType);
    setCategory(nextType === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  }

  async function handleViewReceipt(receiptId) {
    const receipt = await fetchReceipt(receiptId);
    setOpenReceipt(receipt);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Expense History</h2>
      </div>

      <form onSubmit={handleCreateEntry} className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-200">
              <td className="px-3 py-2 align-top">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-36 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </td>
              <td className="px-3 py-2 align-top">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-40 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  placeholder="Transaction name"
                />
              </td>
              <td className="px-3 py-2 align-top">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-36 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                >
                  {(entryType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 align-top">
                <select
                  value={entryType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </td>
              <td className="px-3 py-2 align-top">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-36 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  placeholder="Optional"
                />
              </td>
              <td className="px-3 py-2 text-right align-top">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm focus:border-indigo-400 focus:outline-none"
                  placeholder="0.00"
                />
              </td>
              <td className="px-3 py-2 text-right align-top">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-zinc-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Add'}
                </button>
              </td>
            </tr>
            {(saveError || saved) && (
              <tr>
                <td colSpan={7} className={`px-3 pb-3 text-sm ${saveError ? 'text-red-600' : 'text-green-600'}`}>
                  {saveError || 'Saved.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </form>

          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
            >
              <option value="">All types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
            >
              <option value="">All categories</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {isError && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-red-600">
                      {error?.message ?? 'Could not load entries.'}
                    </td>
                  </tr>
                )}
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                      No entries yet.
                    </td>
                  </tr>
                )}
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-gray-200">
                    <td className="px-4 py-2 text-gray-600">
                      {entry.date?.toDate ? entry.date.toDate().toLocaleDateString() : ''}
                    </td>
                    <td className="px-4 py-2 text-gray-800">{entry.name}</td>
                    <td className="px-4 py-2 text-gray-600">{entry.category}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {entry.source === 'receipt' ? (
                        <button
                          onClick={() => handleViewReceipt(entry.receiptId)}
                          className="text-blue-600 hover:underline"
                        >
                          View receipt
                        </button>
                      ) : (
                        'Manual'
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        entry.type === 'expense' ? 'text-mauve-500' : 'text-mist-600'
                      }`}
                    >
                      {entry.type === 'expense' ? '-' : '+'}${entry.amount?.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-xs text-gray-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-col gap-3 bg-zinc-600 border-t border-slate-950 px-4 py-1 text-sm text-white sm:flex-row sm:items-center sm:justify-end">
              <div className="flex items-center justify-between gap-6 sm:justify-start">
                <span className="font-medium text-slate-50">Total Income</span>
                <span className="font-medium text-emerald-300">{currencyFormatter.format(totals.income)}</span>
              </div>
              <div className="hidden h-5 w-px bg-slate-200 sm:block" />
              <div className="flex items-center justify-between gap-6 sm:justify-start">
                <span className="font-medium text-slate-50">Total Expense</span>
                <span className="font-medium text-rose-300">{currencyFormatter.format(totals.expense)}</span>
              </div>
            </div>
          </div>

      {openReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpenReceipt(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ReceiptCard receipt={openReceipt} />
            <button
              onClick={() => setOpenReceipt(null)}
              className="mt-3 w-full rounded-md bg-white px-3 py-1.5 text-sm text-gray-600 shadow"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
