import { useState } from 'react';
import EntryForm from '../components/common/EntryForm.jsx';
import { INCOME_CATEGORIES } from '../utils/categories.js';
import { createEntry } from '../services/entriesService.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function AddIncomePage() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(entry) {
    setSubmitting(true);
    setError('');
    try {
      await createEntry(user.uid, { ...entry, source: 'manual' });
      return true;
    } catch (err) {
      setError(err?.message ?? 'Could not save income. Please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return <EntryForm type="income" categories={INCOME_CATEGORIES} onSubmit={handleSubmit} submitting={submitting} error={error} />;
}
