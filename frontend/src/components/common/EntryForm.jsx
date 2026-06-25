import { useState } from 'react';

/**
 * Shared form for manual expense/income entry — spec sections 5.4 and 5.5
 * describe identical field shapes with different category lists and a
 * different `type` value, so one component serves both pages.
 */
export default function EntryForm({ type, categories, onSubmit, submitting, error }) {
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccess(false);
    const saved = await onSubmit({
      type,
      amount: parseFloat(amount),
      name,
      category,
      date,
      description,
    });
    if (saved === false) return;
    setAmount('');
    setName('');
    setDescription('');
    setSuccess(true);
  }

  const accent = type === 'expense' ? 'text-red-600' : 'text-green-600';
  const buttonColor = type === 'expense' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700';

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 rounded-lg border bg-white p-6 shadow-sm">
      <h2 className={`text-lg font-semibold ${accent}`}>
        Add {type === 'expense' ? 'Expense' : 'Income'}
      </h2>

      <div>
        <label className="block text-sm font-medium text-gray-700">Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          placeholder="0.00"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          placeholder={type === 'expense' ? "Trader Joe's run" : 'Freelance payment'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Date</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        />
      </div>

      {success && <p className="text-sm text-green-600">Saved.</p>}
      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className={`w-full rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${buttonColor}`}
      >
        {submitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
