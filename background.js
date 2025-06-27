/**
 * Background service worker for Cursor Usage Tracker
 * Handles API requests and data caching
 */

// Store usage data in memory for quick access
let cachedUsageData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * Fetch usage data from Cursor API
 * @returns {Promise<Object>} Usage data response
 */
async function fetchUsageData() {
  const now = Date.now();
  
  // Return cached data if still fresh
  if (cachedUsageData && (now - lastFetchTime < CACHE_DURATION)) {
    return cachedUsageData;
  }

  try {
    // Find a cursor.com tab to execute the fetch
    const tabs = await chrome.tabs.query({ url: "*://www.cursor.com/*" });
    
    if (tabs.length === 0) {
      throw new Error('Please open cursor.com in a tab and log in first');
    }
    
    // Use the first cursor.com tab found
    const cursorTab = tabs[0];
    
    // Execute fetch in the context of the cursor.com tab
    const results = await chrome.scripting.executeScript({
      target: { tabId: cursorTab.id },
      func: async () => {
        console.log('Fetching usage data from cursor.com...');
        
        // Use the correct POST request with JSON body like the website does
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        console.log('Fetching for month:', currentMonth, 'year:', currentYear);
        
        const requestBody = {
          month: currentMonth,
          year: currentYear,
          includeUsageEvents: true,
        };
        
        console.log('Request body:', requestBody);
        
        const response = await fetch('https://www.cursor.com/api/dashboard/get-monthly-invoice', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': navigator.userAgent,
            'Referer': 'https://www.cursor.com/dashboard?tab=usage',
            'Origin': 'https://www.cursor.com',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin'
          },
          body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Raw API response:', data);
        console.log('Has usageEvents:', !!data.usageEvents);
        console.log('UsageEvents length:', data.usageEvents?.length || 0);
        
        return data;
      }
    });

    const data = results[0]?.result;
    console.log('Background: Received data from script:', data);
    console.log('Background: Data has usageEvents:', !!data?.usageEvents);
    console.log('Background: UsageEvents count:', data?.usageEvents?.length || 0);
    
    if (data) {
      cachedUsageData = data;
      lastFetchTime = now;
      
      // Store in chrome storage for persistence
      await chrome.storage.local.set({ 
        usageData: data, 
        lastFetch: now 
      });
    }
    
    return data;
  } catch (error) {
    console.error('Failed to fetch usage data:', error);
    
    // Try to get cached data from storage
    const stored = await chrome.storage.local.get(['usageData', 'lastFetch']);
    if (stored.usageData) {
      cachedUsageData = stored.usageData;
      lastFetchTime = stored.lastFetch;
      return stored.usageData;
    }
    
    throw error;
  }
}

/**
 * Handle extension icon click - check if on cursor.com
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.includes('cursor.com')) {
    // If on cursor.com, open dashboard in new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL('dashboard.html')
    });
  } else {
    // If not on cursor.com, navigate to cursor.com first
    chrome.tabs.create({
      url: 'https://www.cursor.com'
    });
  }
});

/**
 * Message handler for communication with dashboard
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchUsageData') {
    // Fetch data from any available cursor.com tab
    fetchUsageData()
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: error.message || 'Failed to fetch data' 
        });
      });
    
    // Return true to indicate async response
    return true;
  }
  
  if (request.action === 'clearCache') {
    cachedUsageData = null;
    lastFetchTime = 0;
    chrome.storage.local.clear();
    sendResponse({ success: true });
  }
  
  if (request.action === 'loginStatus') {
    // Store login status for potential use
    chrome.storage.local.set({ 
      isLoggedIn: request.isLoggedIn,
      lastChecked: Date.now() 
    });
    console.log('Login status updated:', request.isLoggedIn);
  }
}); 