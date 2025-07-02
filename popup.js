/**
 * Main JavaScript functionality for Cursor Usage Tracker popup
 * Handles data fetching, filtering, calculations, and UI updates
 */

// Global state
let allUsageData = null;
let currentFilter = 'all';
let customDateRange = null;

// DOM elements
const elements = {
  loadingState: document.getElementById('loadingState'),
  errorState: document.getElementById('errorState'),
  mainContent: document.getElementById('mainContent'),
  errorMessage: document.getElementById('errorMessage'),
  refreshBtn: document.getElementById('refreshBtn'),
  retryBtn: document.getElementById('retryBtn'),
  
  // Stats
  totalCost: document.getElementById('totalCost'),
  totalInputTokens: document.getElementById('totalInputTokens'),
  totalCacheReadTokens: document.getElementById('totalCacheReadTokens'),
  totalRequests: document.getElementById('totalRequests'),
  resultsCount: document.getElementById('resultsCount'),
  
  // Filters
  filterTabs: document.querySelectorAll('.filter-tab'),
  dateFrom: document.getElementById('dateFrom'),
  dateTo: document.getElementById('dateTo'),
  applyCustomRange: document.getElementById('applyCustomRange'),
  
  // Content areas
  usageList: document.getElementById('usageList'),
  modelBreakdown: document.getElementById('modelBreakdown')
};

/**
 * Get model details from event details
 * @param {Object} eventDetails - The event details object
 * @returns {Object} The nested details object
 */
function getModelDetails(eventDetails) {
  // Determine type from details object keys
  const validTypes = ['toolCallComposer', 'composer', 'fastApply', 'chat', 'cmdK'];
  let nestedDetails = {};
  
  // Find the type from the details object keys
  for (const validType of validTypes) {
    if (eventDetails[validType]) {
      nestedDetails = eventDetails[validType];
      break;
    }
  }

  return nestedDetails;
}

/**
 * Initialize the popup
 */
async function initialize() {
  setupEventListeners();
  await fetchAndDisplayData();
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Refresh button
  elements.refreshBtn.addEventListener('click', async () => {
    await fetchAndDisplayData(true);
  });
  
  // Retry button
  elements.retryBtn.addEventListener('click', async () => {
    await fetchAndDisplayData();
  });
  
  // Filter tabs
  elements.filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      elements.filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update filter
      currentFilter = tab.dataset.filter;
      customDateRange = null;
      
      // Refresh display
      if (allUsageData) {
        displayData();
      }
    });
  });
  
  // Custom date range
  elements.applyCustomRange.addEventListener('click', () => {
    const fromDate = elements.dateFrom.value;
    const toDate = elements.dateTo.value;
    
    if (fromDate && toDate) {
      customDateRange = {
        from: new Date(fromDate).getTime(),
        to: new Date(toDate).getTime()
      };
      
      // Update active tab to show custom range is active
      elements.filterTabs.forEach(t => t.classList.remove('active'));
      
      // Refresh display
      if (allUsageData) {
        displayData();
      }
    }
  });
}

/**
 * Fetch usage data from background script
 * @param {boolean} forceRefresh - Force refresh from API
 */
async function fetchAndDisplayData(forceRefresh = false) {
  showLoadingState();
  
  try {
    if (forceRefresh) {
      // Clear cache first
      await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'clearCache' }, resolve);
      });
    }
    
    // Fetch data
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'fetchUsageData' }, resolve);
    });
    
    if (response.success) {
      allUsageData = response.data;
      displayData();
      showMainContent();
    } else {
      throw new Error(response.error || 'Failed to fetch data');
    }
  } catch (error) {
    console.error('Error fetching usage data:', error);
    showErrorState(error.message);
  }
}

/**
 * Display the fetched data with current filters applied
 */
function displayData() {
  if (!allUsageData || !allUsageData.usageEvents) {
    showErrorState('No usage data available');
    return;
  }
  
  // Filter invalid events
  const filteredEvents = filterEvents(allUsageData.usageEvents).filter(isValidEvent);
  const stats = calculateStats(filteredEvents);
  
  updateStatsDisplay(stats);
  updateUsageList(filteredEvents);
  updateModelBreakdown(filteredEvents);
  updateResultsCount(filteredEvents.length);
}

/**
 * Filter events based on current filter settings
 * @param {Array} events - All usage events
 * @returns {Array} Filtered events
 */
function filterEvents(events) {
  const now = Date.now();
  let startTime = 0;
  let endTime = now;
  
  if (customDateRange) {
    startTime = customDateRange.from;
    endTime = customDateRange.to;
  } else {
    switch (currentFilter) {
      case 'today':
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        startTime = todayStart.getTime();
        break;
      case 'yesterday':
        const yesterdayStart = new Date();
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        yesterdayStart.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterdayStart);
        yesterdayEnd.setHours(23, 59, 59, 999);
        startTime = yesterdayStart.getTime();
        endTime = yesterdayEnd.getTime();
        break;
      case 'last4hours':
        startTime = now - (4 * 60 * 60 * 1000);
        break;
      case 'last24hours':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case 'last7days':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        return events;
    }
  }
  
  return events.filter(event => {
    const eventTime = parseInt(event.timestamp);
    return eventTime >= startTime && eventTime <= endTime;
  });
}

/**
 * Calculate statistics from filtered events
 * @param {Array} events - Filtered usage events
 * @returns {Object} Statistics object
 */
function calculateStats(events) {
  const stats = {
    totalCents: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    totalRequests: events.length
  };
  
  events.forEach(event => {
    // Add price
    stats.totalCents += event.priceCents || 0;
    
    // Add token usage if available
    const details = getModelDetails(event.details);
    const tokenUsage = details?.tokenUsage;
    if (tokenUsage) {
      stats.totalInputTokens += tokenUsage.inputTokens || 0;
      stats.totalOutputTokens += tokenUsage.outputTokens || 0;
      stats.totalCacheReadTokens += tokenUsage.cacheReadTokens || 0;
      stats.totalCacheWriteTokens += tokenUsage.cacheWriteTokens || 0;
    }
  });
  
  return stats;
}

/**
 * Update the statistics display
 * @param {Object} stats - Calculated statistics
 */
function updateStatsDisplay(stats) {
  elements.totalCost.textContent = `$${(stats.totalCents / 100).toFixed(2)}`;
  elements.totalInputTokens.textContent = formatNumber(stats.totalInputTokens);
  elements.totalCacheReadTokens.textContent = formatNumber(stats.totalCacheReadTokens);
  elements.totalRequests.textContent = formatNumber(stats.totalRequests);
}

/**
 * Update the usage list display
 * @param {Array} events - Filtered usage events
 */
function updateUsageList(events) {
  if (events.length === 0) {
    elements.usageList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>No usage events found for the selected time period</p>
      </div>
    `;
    return;
  }
  
  // Sort events by timestamp (newest first)
  const sortedEvents = [...events].sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
  
  elements.usageList.innerHTML = sortedEvents.map(event => {
    const details = getModelDetails(event.details);
    const tokenUsage = details?.tokenUsage;
    const modelIntent = details?.modelIntent || 'Unknown Model';
    const timestamp = new Date(parseInt(event.timestamp));
    const cost = event.priceCents || 0;
    
    return `
      <div class="usage-item">
        <div class="usage-header">
          <span class="usage-model">${modelIntent}</span>
          <span class="usage-time">${formatTimestamp(timestamp)}</span>
          <span class="usage-cost">$${(cost / 100).toFixed(3)}</span>
        </div>
        ${tokenUsage ? `
          <div class="usage-details">
            <div class="usage-detail">
              <strong>${formatNumber(tokenUsage.inputTokens || 0)}</strong> input
            </div>
            <div class="usage-detail">
              <strong>${formatNumber(tokenUsage.outputTokens || 0)}</strong> output
            </div>
            <div class="usage-detail">
              <strong>${formatNumber(tokenUsage.cacheReadTokens || 0)}</strong> cache read
            </div>
          </div>
        ` : '<div class="usage-details"><div class="usage-detail">No token data available</div></div>'}
      </div>
    `;
  }).join('');
}

/**
 * Update the model breakdown display
 * @param {Array} events - Filtered usage events
 */
function updateModelBreakdown(events) {
  const modelStats = {};
  
  events.forEach(event => {
    const details = getModelDetails(event.details);
    const modelIntent = details?.modelIntent || 'Unknown Model';
    const tokenUsage = details?.tokenUsage;
    const cost = event.priceCents || 0;
    
    if (!modelStats[modelIntent]) {
      modelStats[modelIntent] = {
        requests: 0,
        totalCents: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0
      };
    }
    
    modelStats[modelIntent].requests++;
    modelStats[modelIntent].totalCents += cost;
    
    if (tokenUsage) {
      modelStats[modelIntent].totalInputTokens += tokenUsage.inputTokens || 0;
      modelStats[modelIntent].totalOutputTokens += tokenUsage.outputTokens || 0;
      modelStats[modelIntent].totalCacheReadTokens += tokenUsage.cacheReadTokens || 0;
    }
  });
  
  // Sort by total cost (highest first)
  const sortedModels = Object.entries(modelStats)
    .sort(([,a], [,b]) => b.totalCents - a.totalCents);
  
  if (sortedModels.length === 0) {
    elements.modelBreakdown.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🤖</div>
        <p>No model usage data available</p>
      </div>
    `;
    return;
  }
  
  elements.modelBreakdown.innerHTML = sortedModels.map(([model, stats]) => `
    <div class="model-item">
      <div class="model-header">
        <span class="model-name">${model}</span>
        <span class="usage-cost">$${(stats.totalCents / 100).toFixed(2)}</span>
      </div>
      <div class="model-stats">
        <div class="model-stat">
          <strong>${stats.requests}</strong> requests
        </div>
        <div class="model-stat">
          <strong>${formatNumber(stats.totalInputTokens)}</strong> input tokens
        </div>
        <div class="model-stat">
          <strong>${formatNumber(stats.totalOutputTokens)}</strong> output tokens
        </div>
        <div class="model-stat">
          <strong>${formatNumber(stats.totalCacheReadTokens)}</strong> cache read tokens
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Update the results count display
 * @param {number} count - Number of filtered events
 */
function updateResultsCount(count) {
  elements.resultsCount.textContent = `${count} event${count !== 1 ? 's' : ''}`;
}

/**
 * Show loading state
 */
function showLoadingState() {
  elements.loadingState.classList.remove('hidden');
  elements.errorState.classList.add('hidden');
  elements.mainContent.classList.add('hidden');
}

/**
 * Show error state
 * @param {string} message - Error message to display
 */
function showErrorState(message) {
  elements.errorMessage.textContent = message;
  elements.loadingState.classList.add('hidden');
  elements.errorState.classList.remove('hidden');
  elements.mainContent.classList.add('hidden');
}

/**
 * Show main content
 */
function showMainContent() {
  elements.loadingState.classList.add('hidden');
  elements.errorState.classList.add('hidden');
  elements.mainContent.classList.remove('hidden');
}

/**
 * Format a number with commas for thousands
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  return new Intl.NumberFormat().format(num || 0);
}

/**
 * Format a timestamp for display
 * @param {Date} date - Date object to format
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(date) {
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
 * Check if an event is valid
 * @param {Object} event - The event object
 * @returns {boolean} True if the event is valid, false otherwise
 */
function isValidEvent(event) {
  const details = getModelDetails(event.details);
  const isEmptyDetails = !details || Object.keys(details).length === 0;
  return !(isEmptyDetails && (event.priceCents === 0));
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize); 