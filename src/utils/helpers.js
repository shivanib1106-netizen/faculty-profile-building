/**
 * Shared display helpers. None of these functions calculate official scores.
 */

export const getPercentageClass = (value) => {
  const numeric = Math.max(0, Math.min(100, Number(value) || 0));
  const rounded = Math.round(numeric / 5) * 5;
  return `p-width-${rounded}`;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? String(dateStr) : date.toLocaleDateString();
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

export const formatMonthYear = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

export const initialsOf = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';
