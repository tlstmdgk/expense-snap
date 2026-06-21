// Spec section 5.4 / 5.5 — predefined category lists.

export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Rent',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Health',
  'Other',
];

export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Gift', 'Refund', 'Other'];

export const ALL_CATEGORIES = Array.from(new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]));
