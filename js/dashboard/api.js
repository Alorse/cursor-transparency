/**
 * @file Handles all communication with the Chrome extension's background script.
 * @module api
 */

/**
 * Checks if a tab with cursor.com is open.
 * @returns {Promise<boolean>} A promise that resolves to true if connected, false otherwise.
 */
export async function checkConnection() {
  try {
    const tabs = await chrome.tabs.query({ url: "*://cursor.com/*" });
    return tabs.length > 0;
  } catch (error) {
    console.error('Connection check failed:', error);
    return false;
  }
}

/**
 * Fetches user analytics data from the background script.
 * @param {boolean} forceRefresh - If true, clears the cache before fetching.
 * @returns {Promise<object>} A promise that resolves with the user analytics data.
 */
export async function fetchAnalyticsData(forceRefresh = false) {
  if (forceRefresh) {
    await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'clearCache' }, resolve);
    });
  }

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const params = {
    teamId: 0,
    userId: 0,
    startDate: String(thirtyDaysAgo),
    endDate: String(now),
    page: 1,
    pageSize: 1000,
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timed out. Please make sure you have cursor.com open in a tab and are logged in.'));
    }, 10000);

    chrome.runtime.sendMessage({ action: 'fetchUserAnalytics', params }, (response) => {
      clearTimeout(timeout);
      if (response && response.success) {
        resolve(response.data);
      } else {
        reject(new Error(response?.error || 'Failed to fetch analytics data'));
      }
    });
  });
} 