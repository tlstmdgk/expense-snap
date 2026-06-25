import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell.jsx';
import RequireAuth from './routes/RequireAuth.jsx';

import LoginPage from './pages/LoginPage.jsx';
import UploadReceiptPage from './pages/UploadReceiptPage.jsx';
import ExpenseHistoryPage from './pages/ExpenseHistoryPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import SplitClaimPage from './pages/SplitClaimPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ReceiptGallery from './components/receipt/ReceiptGallery.jsx';

/**
 * Route structure mirrors spec section 3 (Information Architecture).
 *
 * Authenticated app shell (tab bar): upload, history, add-expense,
 * add-income, analytics.
 *
 * Public, unauthenticated route: /split/:shareToken — this is intentionally
 * OUTSIDE the AppShell/RequireAuth boundary, since claimants never log in
 * (spec section 5.2 / section 4.4 design note on anonymity).
 */
export default function App() {
  return (
    <Routes>
      {/* Public split-claim page — no auth, no app shell */}
      <Route path="/split/:shareToken" element={<SplitClaimPage />} />

      <Route path="/login" element={<LoginPage />} />

      {/* Authenticated app shell */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/upload" replace />} />
        <Route path="upload" element={<UploadReceiptPage />} />
        <Route path="history" element={<ExpenseHistoryPage />} />
        <Route path="receipts" element={<ReceiptGallery />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="add-expense" element={<Navigate to="/history" replace />} />
        <Route path="add-income" element={<Navigate to="/history" replace />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
