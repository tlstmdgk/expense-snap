import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

const TABS = [
  { to: '/upload', label: 'Upload Receipt' },
  { to: '/history', label: 'Expense Tracker' },
  { to: '/receipts', label: 'Receipt Gallery' },
  { to: '/analytics', label: 'Analytics' },
];

/**
 * Persistent tab bar shell per spec section 3 (Information Architecture).
 * Renders the 5 top-level tabs; the active page renders via <Outlet />.
 */
export default function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/assets/cats.png" alt="" className="h-10 w-12 object-contain" />
            <span className="font-brand text-xl font-semibold text-gray-800">ExpenseSnap</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user?.email}</span>
            <button
              onClick={logout}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
            >
              Log out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-mist-500 text-slate-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
