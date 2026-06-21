import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEntries, deleteEntry } from '../services/entriesService.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ALL_CATEGORIES } from '../utils/categories.js';

/**
 * Spec section 5.3 — sortable/filterable table, search, pagination,
 * color-coded amounts, receipt thumbnail link, edit/delete actions.
 *
 * NOTE: edit-in-place and the row detail/expand view are stubbed as TODOs
 * below — wire up to updateEntry() from entriesService and a modal/drawer
 * component as a follow-up; the data layer already supports it.
 */
export default function ExpenseHistoryPage() {
  const { user } = useAuth();
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['entries', user.uid, typeFilter, categoryFilter],
    queryFn: () =>
      fetchEntries(user.uid, {
        type: typeFilter || undefined,
        category: categoryFilter || undefined,
      }),
  });

  const entries = (data?.entries ?? []).filter((entry) =>
    search ? entry.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  async function handleDelete(entryId) {
    if (!confirm('Delete this entry?')) return;
    await deleteEntry(entryId);
    refetch();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Expense History</h2>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
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
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No entries yet.
                </td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t">
                <td className="px-4 py-2 text-gray-600">
                  {entry.date?.toDate ? entry.date.toDate().toLocaleDateString() : ''}
                </td>
                <td className="px-4 py-2 text-gray-800">{entry.name}</td>
                <td className="px-4 py-2 text-gray-600">{entry.category}</td>
                <td className="px-4 py-2 text-gray-500">
                  {entry.source === 'receipt' ? (
                    <a
                      href={entry.imageUrl ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Receipt
                    </a>
                  ) : (
                    'Manual'
                  )}
                </td>
                <td
                  className={`px-4 py-2 text-right font-medium ${
                    entry.type === 'expense' ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {entry.type === 'expense' ? '-' : '+'}${entry.amount?.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => handleDelete(entry.id)} className="text-xs text-gray-400 hover:text-red-600">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
