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
 * Extracts model details from a usage event.
 * @param {object} eventDetails - The details object from the event.
 * @returns {object} The nested details object.
 */
export function getModelDetails(eventDetails) {
  const validTypes = ['toolCallComposer', 'composer', 'fastApply', 'chat', 'cmdK'];
  let nestedDetails = {};

  for (const validType of validTypes) {
    if (eventDetails[validType]) {
      nestedDetails = eventDetails[validType];
      break;
    }
  }
  return nestedDetails;
}

/**
 * Checks if a usage event is valid for display.
 * @param {object} event - The usage event.
 * @returns {boolean} True if the event is valid, false otherwise.
 */
export function isValidEvent(event) {
  const details = getModelDetails(event.details);
  const isEmptyDetails = !details || Object.keys(details).length === 0;
  return !(isEmptyDetails && (event.priceCents === 0));
} 