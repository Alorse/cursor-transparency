/**
 * @file Contains utility functions for the dashboard.
 * @module utils
 */

/**
 * Formats a number with commas for better readability.
 * @param {number} num - The number to format.
 * @returns {string} The formatted number.
 */
export function formatNumber(num) {
  return new Intl.NumberFormat().format(num || 0);
}

/**
 * Formats a timestamp into a user-friendly relative time string.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted timestamp.
 */
export function formatTimestamp(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  } else if (diffDays < 7) {
    return `${Math.floor(diffDays)}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Checks if a usage event is valid for display.
 * @param {object} event - The usage event.
 * @returns {boolean} True if the event is valid, false otherwise.
 */
export function isValidEvent(event) {
  const isEmptyDetails = !event || Object.keys(event).length === 0;
  return !(isEmptyDetails && (event.tokenUsage.totalCents === 0));
} 