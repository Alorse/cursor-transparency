/**
 * Content script for Cursor Usage Tracker
 * Runs on cursor.com pages to facilitate API access
 */

// Check if user is logged in by looking for authentication indicators
function checkLoginStatus() {
  // Look for common authentication indicators on cursor.com
  const authIndicators = [
    'button[data-testid="user-menu"]',
    '.user-avatar',
    '[data-testid="dashboard"]',
    '.dashboard-container'
  ];
  
  return authIndicators.some(selector => document.querySelector(selector));
}

// Notify background script of login status
function notifyLoginStatus() {
  const isLoggedIn = checkLoginStatus();
  
  chrome.runtime.sendMessage({
    action: 'loginStatus',
    isLoggedIn: isLoggedIn,
    url: window.location.href
  });
}

// Check login status when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', notifyLoginStatus);
} else {
  notifyLoginStatus();
}

// Monitor for changes that might indicate login state changes
const observer = new MutationObserver((mutations) => {
  let shouldCheck = false;
  
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      shouldCheck = true;
    }
  });
  
  if (shouldCheck) {
    // Debounce the check to avoid excessive calls
    clearTimeout(window.loginCheckTimeout);
    window.loginCheckTimeout = setTimeout(notifyLoginStatus, 1000);
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Clean up observer when page unloads
window.addEventListener('beforeunload', () => {
  observer.disconnect();
}); 