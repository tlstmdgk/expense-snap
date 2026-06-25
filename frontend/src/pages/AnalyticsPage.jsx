import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { fetchEntriesForAnalytics } from '../services/entriesService.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

const RANGE_OPTIONS = [
  { label: 'This month', value: 'month' },
  { label: 'Last 3 months', value: '3months' },
  { label: 'Year to date', value: 'ytd' },
];

function getDateRange(rangeKey) {
  const now = new Date();
  const start = new Date(now);
  if (rangeKey === 'month') start.setDate(1);
  if (rangeKey === '3months') start.setMonth(start.getMonth() - 3);
  if (rangeKey === 'ytd') {
    start.setMonth(0);
    start.setDate(1);
  }
  return { startDate: start.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) };
}

/**
 * Spec section 5.6 — category breakdown (pie), spending-over-time (bar),
 * top categories list, date range selector. All aggregation happens
 * client-side from a single entries query, per the spec's stated design
 * tradeoff for demo scale (no backend aggregation jobs).
 */
export default function AnalyticsPage() {
  const { user } = useAuth();
  const [range, setRange] = useState('month');
  const { startDate, endDate } = getDateRange(range);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['analytics-entries', user.uid, range],
    queryFn: () => fetchEntriesForAnalytics(user.uid, { startDate, endDate }),
  });

  const categoryData = useMemo(() => {
    const totals = {};
    entries
      .filter((e) => e.type === 'expense')
      .forEach((e) => {
        totals[e.category] = (totals[e.category] ?? 0) + e.amount;
      });
    return Object.entries(totals).map(([category, value]) => ({ name: category, value }));
  }, [entries]);

  const timeSeriesData = useMemo(() => {
    const buckets = {};
    entries.forEach((e) => {
      const date = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets[key]) buckets[key] = { month: key, expense: 0, income: 0 };
      buckets[key][e.type] += e.amount;
    });
    return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
  }, [entries]);

  const topCategories = useMemo(
    () => [...categoryData].sort((a, b) => b.value - a.value).slice(0, 5),
    [categoryData]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Analytics</h2>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-300 focus:outline-none"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-gray-400">Loading...</p>}

      {!isLoading && entries.length === 0 && (
        <p className="text-gray-400">No data yet for this range — add some entries first.</p>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-medium text-gray-600">Spending by Category</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-medium text-gray-600">Income vs Expense Over Time</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="expense" fill="#ef4444" name="Expense" />
                <Bar dataKey="income" fill="#22c55e" name="Income" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm md:col-span-2">
            <h3 className="mb-2 text-sm font-medium text-gray-600">Top Categories</h3>
            <ul className="divide-y">
              {topCategories.map((c, i) => (
                <li key={c.name} className="flex justify-between py-2 text-sm">
                  <span className="text-gray-700">
                    {i + 1}. {c.name}
                  </span>
                  <span className="font-medium text-gray-900">${c.value.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
