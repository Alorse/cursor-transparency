/**
 * @file Contains the logic for exporting data to CSV and JSON.
 * @module export
 */

import { state } from './state.js';
import { getModelDetails, isValidEvent } from './utils.js';

/**
 * Exports the filtered data in the specified format.
 * @param {string} format - The format to export ('csv' or 'json').
 */
export function exportData(format) {
  const filteredEvents = filterEvents(state.allUsageData.usageEvents).filter(isValidEvent);

  if (format === 'csv') {
    const csv = convertToCSV(filteredEvents);
    downloadFile(csv, 'cursor-usage.csv', 'text/csv');
  } else if (format === 'json') {
    const json = JSON.stringify(filteredEvents, null, 2);
    downloadFile(json, 'cursor-usage.json', 'application/json');
  }
}

/**
 * Converts an array of events to a CSV string.
 * @param {Array<object>} events - The events to convert.
 * @returns {string} The CSV formatted string.
 */
function convertToCSV(events) {
  const headers = ['Timestamp', 'Model', 'Cost', 'Input Tokens', 'Output Tokens', 'Cache Read Tokens', 'Cache Write Tokens'];
  const rows = events.map(event => {
    const details = getModelDetails(event);
    const tokenUsage = details?.tokenUsage;
    let modelIntent = details?.model || 'Unknown';
    if (modelIntent === 'default') modelIntent = 'Auto';
    const timestamp = new Date(parseInt(event.timestamp)).toISOString();
    const cost = (event.requestsCosts || 0) / 100;

    return [
      timestamp,
      modelIntent,
      cost,
      tokenUsage?.inputTokens || 0,
      tokenUsage?.outputTokens || 0,
      tokenUsage?.cacheReadTokens || 0,
      tokenUsage?.cacheWriteTokens || 0
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Triggers a file download in the browser.
 * @param {string} content - The content of the file.
 * @param {string} filename - The name of the file.
 * @param {string} contentType - The MIME type of the file.
 */
function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Filters events based on the current filter settings.
 * @param {Array<object>} events - The events to filter.
 * @returns {Array<object>} The filtered events.
 */
function filterEvents(events) {
  const now = Date.now();
  let startTime = 0;
  let endTime = now;

  const maxEventTime = Math.max(...events.map(e => parseInt(e.timestamp)));
  const hasFutureTimestamps = maxEventTime > now;

  const referenceTime = hasFutureTimestamps ? maxEventTime : now;

  if (state.customDateRange) {
    startTime = state.customDateRange.from;
    endTime = state.customDateRange.to;
  } else {
    switch (state.currentFilter) {
      case 'today':
        const todayStart = new Date(referenceTime);
        todayStart.setHours(0, 0, 0, 0);
        startTime = todayStart.getTime();
        endTime = referenceTime;
        break;
      case 'yesterday':
        const yesterdayStart = new Date(referenceTime);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        yesterdayStart.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterdayStart);
        yesterdayEnd.setHours(23, 59, 59, 999);
        startTime = yesterdayStart.getTime();
        endTime = yesterdayEnd.getTime();
        break;
      case 'last4hours':
        startTime = referenceTime - (4 * 60 * 60 * 1000);
        endTime = referenceTime;
        break;
      case 'last24hours':
        startTime = referenceTime - (24 * 60 * 60 * 1000);
        endTime = referenceTime;
        break;
      case 'last7days':
        startTime = referenceTime - (7 * 24 * 60 * 60 * 1000);
        endTime = referenceTime;
        break;
      case 'all':
        return events;
    }
  }
  return events.filter(event => {
    const eventTime = parseInt(event.timestamp);
    return eventTime >= startTime && eventTime <= endTime;
  });
} 