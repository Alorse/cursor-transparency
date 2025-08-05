/**
 * Background service worker for Cursor Usage Tracker
 * Handles API requests and data caching
 */

// Store usage data in memory for quick access
let cachedUsageData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache
const API_BASE_URL = 'https://cursor.com/api';

/**
 * Helper to execute a fetch in the context of a cursor.com tab
 * @param {string} endpoint - API endpoint (relative to API_BASE_URL)
 * @param {object} body - POST body
 * @returns {Promise<any>} - API response JSON
 */
async function fetchFromCursorApi(endpoint, body) {
  let tabs = await chrome.tabs.query({ url: "*://www.cursor.com/*" });
  if (!tabs || tabs.length === 0) {
    tabs = await chrome.tabs.query({ url: "*://cursor.com/*" });
  }
  if (tabs.length === 0) {
    throw new Error("Please open cursor.com in a tab and log in first");
  }
  const cursorTab = tabs[0];
  try {
    await chrome.tabs.get(cursorTab.id);
  } catch (tabError) {
    throw new Error("Cursor.com tab is not accessible. Please refresh the tab and try again.");
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: cursorTab.id },
    func: async (url, body) => {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    },
    args: [API_BASE_URL + endpoint, body]
  });
  return results[0]?.result;
}

/**
 * Fetch usage data from Cursor API
 * @returns {Promise<Object>} Usage data response
 */
async function fetchUsageData() {
  const now = Date.now();
  if (cachedUsageData && now - lastFetchTime < CACHE_DURATION) {
    return cachedUsageData;
  }
  try {
    // Use helper for API call
    const nowDate = new Date();
    const currentMonth = nowDate.getMonth();
    const currentYear = nowDate.getFullYear();
    const requestBody = {
      month: currentMonth,
      year: currentYear,
      includeUsageEvents: true,
    };
    const data = await fetchFromCursorApi('/dashboard/get-monthly-invoice', requestBody);
    if (data) {
      cachedUsageData = data;
      lastFetchTime = now;
      await chrome.storage.local.set({ usageData: data, lastFetch: now });
    }
    return data;
  } catch (error) {
    console.error("Failed to fetch usage data:", error);
    const stored = await chrome.storage.local.get(["usageData", "lastFetch"]);
    if (stored.usageData) {
      cachedUsageData = stored.usageData;
      lastFetchTime = stored.lastFetch;
      return stored.usageData;
    }
    throw error;
  }
}

/**
 * Fetch user analytics from Cursor API
 * @returns {Promise<Object>} Analytics data response
 */
async function fetchUserAnalytics({ teamId = 0, userId = 0, startDate, endDate }) {
  const events = await fetchFromCursorApi('/dashboard/get-filtered-usage-events', { teamId, userId, startDate, endDate });
  return events;
}

/**
 * Handle extension icon click - check if on cursor.com
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.includes("cursor.com")) {
    // If on cursor.com, open dashboard in new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL("dashboard.html"),
    });
  } else {
    // If not on cursor.com, navigate to cursor.com first
    chrome.tabs.create({
      url: "https://cursor.com",
    });
  }
});

/**
 * Message handler for communication with dashboard
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchUsageData") {
    // Fetch data from any available cursor.com tab
    fetchUsageData()
      .then((data) => {
        sendResponse({ success: true, data });
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message || "Failed to fetch data",
        });
      });

    // Return true to indicate async response
    return true;
  }

  if (request.action === "clearCache") {
    cachedUsageData = null;
    lastFetchTime = 0;
    chrome.storage.local.clear();
    sendResponse({ success: true });
  }

  if (request.action === "loginStatus") {
    // Store login status for potential use
    chrome.storage.local.set({
      isLoggedIn: request.isLoggedIn,
      lastChecked: Date.now(),
    });
    console.log("Login status updated:", request.isLoggedIn);
  }

  if (request.action === "fetchUserAnalytics") {
    fetchUserAnalytics(request.params)
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, error: error.message || "Failed to fetch analytics" }));
    return true;
  }
});
