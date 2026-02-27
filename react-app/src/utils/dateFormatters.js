/**
 * Date formatting utilities for the tournament application
 */

/**
 * Format a date range for display (e.g., "15 Jan - 17 Jan, 2024")
 * @param {string|Date} start - Start date
 * @param {string|Date} end - End date (optional)
 * @returns {string} Formatted date range
 */
export function formatDateRange(start, end) {
  if (!start) return '';

  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;

  const startStr = startDate.toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'short'
  });

  if (!endDate || startDate.getTime() === endDate.getTime()) {
    return `${startStr}, ${startDate.getFullYear()}`;
  }

  const endStr = endDate.toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return `${startStr} - ${endStr}`;
}

/**
 * Format a single date for display
 * @param {string|Date} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date
 */
export function formatDate(date, options = {}) {
  if (!date) return '';

  const defaultOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options
  };

  return new Date(date).toLocaleDateString('pt-PT', defaultOptions);
}

/**
 * Format a date for compact display (e.g., "15/01/2024")
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDateCompact(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-PT');
}

/**
 * Get relative date text (e.g., "Hoje", "Amanhã", "Em 3 dias")
 * @param {string|Date} date - Date to compare
 * @returns {string} Relative date text
 */
export function getRelativeDate(date) {
  if (!date) return '';

  const target = new Date(date);
  const today = new Date();

  // Reset time portion for comparison
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanha';
  if (diffDays === -1) return 'Ontem';
  if (diffDays > 0 && diffDays <= 7) return `Em ${diffDays} dias`;
  if (diffDays < 0 && diffDays >= -7) return `Ha ${Math.abs(diffDays)} dias`;

  return formatDateCompact(date);
}
