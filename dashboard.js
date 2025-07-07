/**
 * Dashboard JavaScript for Cursor Usage Tracker
 * Full-page dashboard with enhanced analytics and export features
 */

// Global state
let allUsageData = null;
let currentFilter = 'all';
let customDateRange = null;
let currentSort = 'newest';
let modelBreakdownView = 'cost';

// New: Analytics state
let userAnalyticsData = null;
let analyticsCurrentPage = 1;
const analyticsPageSize = 100;

// DOM elements
const elements = {
  // States
  loadingState: document.getElementById('loadingState'),
  errorState: document.getElementById('errorState'),
  mainContent: document.getElementById('mainContent'),
  errorMessage: document.getElementById('errorMessage'),
  
  // Actions
  refreshBtn: document.getElementById('refreshBtn'),
  retryBtn: document.getElementById('retryBtn'),
  openCursorBtn: document.getElementById('openCursorBtn'),
  
  // Display elements
  lastUpdated: document.getElementById('lastUpdated'),
  resultsCount: document.getElementById('resultsCount'),
  timeRange: document.getElementById('timeRange'),
  connectionStatus: document.getElementById('connectionStatus'),
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  
  // Stats
  totalCost: document.getElementById('totalCost'),
  totalInputTokens: document.getElementById('totalInputTokens'),
  totalCacheReadTokens: document.getElementById('totalCacheReadTokens'),
  totalRequests: document.getElementById('totalRequests'),
  inputTokensDetail: document.getElementById('inputTokensDetail'),
  cacheTokensDetail: document.getElementById('cacheTokensDetail'),
  requestsDetail: document.getElementById('requestsDetail'),
  
  // Filters
  filterBtns: document.querySelectorAll('.filter-btn'),
  dateFrom: document.getElementById('dateFrom'),
  dateTo: document.getElementById('dateTo'),
  applyCustomRange: document.getElementById('applyCustomRange'),
  
  // Timeline
  sortOrder: document.getElementById('sortOrder'),
  usageTimeline: document.getElementById('usageTimeline'),
  
  // Models
  toggleBtns: document.querySelectorAll('.toggle-btn'),
  modelBreakdown: document.getElementById('modelBreakdown'),
  
  // Analytics
  exportCsv: document.getElementById('exportCsv'),
  exportJson: document.getElementById('exportJson'),
  analyticsTable: document.getElementById('analyticsTable')
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
 * Initialize the dashboard
 */
async function initialize() {
  setupEventListeners();
  
  // Ensure the correct filter button is active
  elements.filterBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.filter === currentFilter) {
      btn.classList.add('active');
    }
  });
  
  await checkConnectionStatus();
  
  // Add a small delay on initial load to ensure extension is fully ready
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await fetchAndDisplayData();
  // Fetch user analytics (once)
  await fetchAndStoreUserAnalytics();
  // Render analytics panel for the first time
  updateUserAnalyticsPanel();
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Action buttons
  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', async () => {
      await fetchAndDisplayData(true);
    });
  }
  
  if (elements.retryBtn) {
    elements.retryBtn.addEventListener('click', async () => {
      await fetchAndDisplayData();
    });
  }
  
  if (elements.openCursorBtn) {
    elements.openCursorBtn.addEventListener('click', () => {
      window.open('https://www.cursor.com', '_blank');
    });
  }
  
  // Custom date range (only if elements exist - they're in popup, not dashboard)
  if (elements.applyCustomRange && elements.dateFrom && elements.dateTo) {
    elements.applyCustomRange.addEventListener('click', () => {
      const fromDate = elements.dateFrom.value;
      const toDate = elements.dateTo.value;
      
      if (fromDate && toDate) {
        customDateRange = {
          from: new Date(fromDate).getTime(),
          to: new Date(toDate).getTime()
        };
        
        elements.filterBtns.forEach(b => b.classList.remove('active'));
        
        if (allUsageData) {
          displayData();
        }
      }
    });
  }
  
  // Sort order
  if (elements.sortOrder) {
    elements.sortOrder.addEventListener('change', (e) => {
      currentSort = e.target.value;
      if (allUsageData) {
        displayData();
      }
    });
  }
  
  // Model breakdown toggle
  if (elements.toggleBtns && elements.toggleBtns.length > 0) {
    elements.toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.toggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        modelBreakdownView = btn.dataset.view;
        
        if (allUsageData) {
          displayData();
        }
      });
    });
  }
  
  // Export buttons
  if (elements.exportCsv) {
    elements.exportCsv.addEventListener('click', () => {
      if (allUsageData) {
        exportData('csv');
      }
    });
  }
  
  if (elements.exportJson) {
    elements.exportJson.addEventListener('click', () => {
      if (allUsageData) {
        exportData('json');
      }
    });
  }

  // New: Add event listener for timeRangeDropdown
  const timeRangeDropdown = document.getElementById('timeRangeDropdown');
  if (timeRangeDropdown) {
    timeRangeDropdown.addEventListener('change', (event) => {
      currentFilter = event.target.value;
      customDateRange = null;
      analyticsCurrentPage = 1; // Reset page on filter change
      if (allUsageData) {
        displayData();
      }
    });
  }
}

/**
 * Check if cursor.com tab is available
 */
async function checkConnectionStatus() {
  try {
    const tabs = await chrome.tabs.query({ url: "*://www.cursor.com/*" });
    
    if (tabs.length > 0) {
      updateConnectionStatus(true, 'Connected to Cursor.com');
    } else {
      updateConnectionStatus(false, 'No Cursor.com tab found');
    }
  } catch (error) {
    updateConnectionStatus(false, 'Connection check failed');
  }
}

/**
 * Update connection status display
 */
function updateConnectionStatus(connected, message) {
  if (elements.statusIndicator && elements.statusText) {
    if (connected) {
      elements.statusIndicator.className = 'status-indicator connected';
      elements.statusText.textContent = message;
    } else {
      elements.statusIndicator.className = 'status-indicator disconnected';
      elements.statusText.textContent = message;
    }
  }
}

/**
 * Fetch usage data from background script
 */
async function fetchAndDisplayData(forceRefresh = false) {
  showLoadingState();
  
  try {
    // Check connection status first
    await checkConnectionStatus();
    
    if (forceRefresh) {
      await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'clearCache' }, resolve);
      });
    }
    
    // Add timeout to prevent hanging on initial load
    const response = await Promise.race([
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'fetchUsageData' }, resolve);
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timed out. Please make sure you have cursor.com open in a tab and are logged in.'));
        }, 10000); // 10 second timeout
      })
    ]);
    
    if (response && response.success) {
      allUsageData = response.data;
      console.log('Loaded usage data:', allUsageData);
      console.log('Usage events count:', allUsageData?.usageEvents?.length || 0);
      displayData();
      showMainContent();
      updateLastUpdated();
      updateConnectionStatus(true, 'Data loaded successfully');
    } else {
      throw new Error(response?.error || 'Failed to fetch data');
    }
  } catch (error) {
    console.error('Error fetching usage data:', error);
    await checkConnectionStatus(); // Update status on error
    showErrorState(error.message);
  }
}

/**
 * Display the fetched data with current filters applied
 */
function displayData() {
  console.log('displayData called with:', allUsageData);
  
  if (!allUsageData || !allUsageData.usageEvents) {
    console.log('No usage data or usageEvents found');
    showErrorState('No usage data available');
    return;
  }
  
  console.log('Total events:', allUsageData.usageEvents.length);
  const filteredEvents = filterEvents(allUsageData.usageEvents).filter(isValidEvent);
  console.log('Filtered events:', filteredEvents.length);
  console.log('Current filter:', currentFilter);
  
  const stats = calculateStats(filteredEvents);
  console.log('Calculated stats:', stats);
  
  updateStatsDisplay(stats);
  updateTimeline(filteredEvents);
  updateModelBreakdown(filteredEvents);
  updateAnalyticsTable(filteredEvents);
  updateResultsInfo(filteredEvents.length);
  // Update analytics panel on every filter change
  updateUserAnalyticsPanel();
}

/**
 * Filter events based on current settings
 */
function filterEvents(events) {
  const now = Date.now();
  let startTime = 0;
  let endTime = now;
  
  // Check if we have future timestamps (like from your data)
  const maxEventTime = Math.max(...events.map(e => parseInt(e.timestamp)));
  const hasFutureTimestamps = maxEventTime > now;
  console.log('Max event timestamp:', maxEventTime, 'Current time:', now, 'Has future timestamps:', hasFutureTimestamps);
  
  if (currentFilter === 'all') {
    console.log('Showing all events');
    return events;
  }
  
  // If we have future timestamps, use the latest event time as "now"
  const referenceTime = hasFutureTimestamps ? maxEventTime : now;
  console.log('Using reference time:', referenceTime, new Date(referenceTime));
  
  if (customDateRange) {
    startTime = customDateRange.from;
    endTime = customDateRange.to;
  } else {
    switch (currentFilter) {
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
    }
  }
  
  console.log('Filter range:', new Date(startTime), 'to', new Date(endTime));
  
  const filtered = events.filter(event => {
    const eventTime = parseInt(event.timestamp);
    const inRange = eventTime >= startTime && eventTime <= endTime;
    return inRange;
  });
  
  console.log('Filtered', events.length, 'events to', filtered.length, 'events');
  if (filtered.length === 0 && events.length > 0) {
    console.log('No events found in range', new Date(startTime), 'to', new Date(endTime));
    console.log('Sample event timestamps:', events.slice(0, 3).map(e => ({ 
      timestamp: e.timestamp, 
      date: new Date(parseInt(e.timestamp)) 
    })));
  }
  return filtered;
}

/**
 * Calculate comprehensive statistics
 */
function calculateStats(events) {
  const statsBySubscription = {};
  
  events.forEach(event => {
    const subscriptionProductId = event.subscriptionProductId || 'unknown';
    if (!statsBySubscription[subscriptionProductId]) {
      statsBySubscription[subscriptionProductId] = {
        totalCents: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheWriteTokens: 0,
        totalRequests: 0,
        averageCostPerRequest: 0,
        tokensPerRequest: 0
      };
    }
    const stats = statsBySubscription[subscriptionProductId];
    stats.totalCents += event.priceCents || 0;
    stats.totalRequests += 1;
    
    const details = getModelDetails(event.details);
    const tokenUsage = details?.tokenUsage;
    if (tokenUsage) {
      stats.totalInputTokens += tokenUsage.inputTokens || 0;
      stats.totalOutputTokens += tokenUsage.outputTokens || 0;
      stats.totalCacheReadTokens += tokenUsage.cacheReadTokens || 0;
      stats.totalCacheWriteTokens += tokenUsage.cacheWriteTokens || 0;
    }
  });
  
  // Calculate averages for each subscription
  Object.values(statsBySubscription).forEach(stats => {
    if (stats.totalRequests > 0) {
      stats.averageCostPerRequest = stats.totalCents / stats.totalRequests;
      stats.tokensPerRequest = (stats.totalInputTokens + stats.totalOutputTokens) / stats.totalRequests;
    }
  });
  
  // Aggregate stats for display
  const aggregatedStats = {
    totalCents: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    totalRequests: 0,
    averageCostPerRequest: 0,
    tokensPerRequest: 0,
    bySubscription: statsBySubscription
  };
  
  Object.values(statsBySubscription).forEach(stats => {
    aggregatedStats.totalCents += stats.totalCents;
    aggregatedStats.totalInputTokens += stats.totalInputTokens;
    aggregatedStats.totalOutputTokens += stats.totalOutputTokens;
    aggregatedStats.totalCacheReadTokens += stats.totalCacheReadTokens;
    aggregatedStats.totalCacheWriteTokens += stats.totalCacheWriteTokens;
    aggregatedStats.totalRequests += stats.totalRequests;
  });
  
  if (aggregatedStats.totalRequests > 0) {
    aggregatedStats.averageCostPerRequest = aggregatedStats.totalCents / aggregatedStats.totalRequests;
    aggregatedStats.tokensPerRequest = (aggregatedStats.totalInputTokens + aggregatedStats.totalOutputTokens) / aggregatedStats.totalRequests;
  }
  
  return aggregatedStats;
}

/**
 * Update statistics display
 */
function updateStatsDisplay(stats) {
  elements.totalCost.textContent = `$${(stats.totalCents / 100).toFixed(2)}`;
  elements.totalInputTokens.textContent = formatNumber(stats.totalInputTokens);
  elements.totalCacheReadTokens.textContent = formatNumber(stats.totalCacheReadTokens);
  elements.totalRequests.textContent = formatNumber(stats.totalRequests);
  
  // Update detail labels
  elements.inputTokensDetail.textContent = `+${formatNumber(stats.totalOutputTokens)} output`;
  elements.cacheTokensDetail.textContent = `+${formatNumber(stats.totalCacheWriteTokens)} write`;
  elements.requestsDetail.textContent = `~${formatNumber(Math.round(stats.tokensPerRequest))} tokens/req`;
}

/**
 * Update timeline display
 */
function updateTimeline(events) {
  console.log('updateTimeline called with', events.length, 'events');
  
  if (events.length === 0) {
    console.log('No events to display in timeline');
    elements.usageTimeline.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>No usage events found for the selected time period</p>
      </div>
    `;
    return;
  }
  
  // Sort events
  const sortedEvents = [...events].sort((a, b) => {
    switch (currentSort) {
      case 'newest':
        return parseInt(b.timestamp) - parseInt(a.timestamp);
      case 'oldest':
        return parseInt(a.timestamp) - parseInt(b.timestamp);
      case 'cost-high':
        return (b.priceCents || 0) - (a.priceCents || 0);
      case 'cost-low':
        return (a.priceCents || 0) - (b.priceCents || 0);
      default:
        return parseInt(b.timestamp) - parseInt(a.timestamp);
    }
  });
  
  // Limit to first 50 events for performance
  const displayEvents = sortedEvents.slice(0, 50);
  
  elements.usageTimeline.innerHTML = displayEvents.map(event => {
    const details = getModelDetails(event.details);
    const tokenUsage = details?.tokenUsage || {};
    let modelIntent = details?.modelIntent || 'Unknown Model';
    if (modelIntent === 'default') modelIntent = 'Auto';
    const subscriptionProductId = event.subscriptionProductId;
    if (subscriptionProductId && subscriptionProductId !== 'pro-legacy') {
      modelIntent += ` [${subscriptionProductId}]`;
    }
    const timestamp = new Date(parseInt(event.timestamp));
    const cost = event.priceCents || 0;
    const isErrored = event?.status === 'errored';
    if (isErrored) modelIntent += ' [Errored, Not Charged]';
    return `
      <div class="timeline-event${isErrored ? ' errored-bg' : ''}">
        <div class="event-header">
          <span class="event-model">${modelIntent}</span>
          <span class="event-time">${formatTimestamp(timestamp)}</span>
          <span class="event-cost">$${(cost / 100).toFixed(3)}</span>
        </div>
        ${tokenUsage ? `
          <div class="event-details">
            <div class="event-detail">
              <strong>${formatNumber(tokenUsage.inputTokens || 0)}</strong> input tokens
            </div>
            <div class="event-detail">
              <strong>${formatNumber(tokenUsage.outputTokens || 0)}</strong> output tokens
            </div>
            <div class="event-detail">
              <strong>${formatNumber(tokenUsage.cacheReadTokens || 0)}</strong> cache read
            </div>
            <div class="event-detail">
              <strong>${formatNumber(tokenUsage.cacheWriteTokens || 0)}</strong> cache write
            </div>
          </div>
        ` : '<div class="event-details"><div class="event-detail">No token data available</div></div>'}
      </div>
    `;
  }).join('');
  
  if (sortedEvents.length > 50) {
    elements.usageTimeline.innerHTML += `
      <div class="timeline-event" style="text-align: center; opacity: 0.7;">
        <p>Showing first 50 of ${sortedEvents.length} events</p>
      </div>
    `;
  }
}

/**
 * Update model breakdown
 */
function updateModelBreakdown(events) {
  const modelStats = {};
  
  events.forEach(event => {
    const details = getModelDetails(event.details);
    const tokenUsage = details?.tokenUsage || {};
    let modelIntent = details?.modelIntent || 'Unknown Model';
    if (modelIntent === 'default') modelIntent = 'Auto';
    const subscriptionProductId = event.subscriptionProductId;
    if (subscriptionProductId && subscriptionProductId !== 'pro-legacy') {
      modelIntent += ` [${subscriptionProductId}]`;
    }
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
  
  // Sort by selected view
  const sortedModels = Object.entries(modelStats).sort(([,a], [,b]) => {
    if (modelBreakdownView === 'cost') {
      return b.totalCents - a.totalCents;
    } else {
      return b.requests - a.requests;
    }
  });
  
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
        <span class="event-cost">$${(stats.totalCents / 100).toFixed(2)}</span>
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
 * Update analytics table
 */
function updateAnalyticsTable(events) {
  const tbody = elements.analyticsTable.querySelector('tbody');
  
  if (events.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: #a0aec0;">
          No usage events found for the selected time period
        </td>
      </tr>
    `;
    updatePaginationControls(0, 0, 0);
    return;
  }
  
  // Sort by timestamp (newest first)
  const sortedEvents = [...events]
    .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));

  // Pagination logic
  const totalPages = Math.ceil(sortedEvents.length / analyticsPageSize);
  if (analyticsCurrentPage > totalPages) analyticsCurrentPage = totalPages || 1;
  
  const startIndex = (analyticsCurrentPage - 1) * analyticsPageSize;
  const endIndex = startIndex + analyticsPageSize;
  const paginatedEvents = sortedEvents.slice(startIndex, endIndex);
  
  tbody.innerHTML = paginatedEvents.map(event => {
    const details = getModelDetails(event.details);
    const tokenUsage = details?.tokenUsage;
    let modelIntent = details?.modelIntent || 'Unknown';
    if (modelIntent === 'default') modelIntent = 'Auto';
    const subscriptionProductId = event.subscriptionProductId;
    if (subscriptionProductId && subscriptionProductId !== 'pro-legacy') {
      modelIntent += ` [${subscriptionProductId}]`;
    }
    const timestamp = new Date(parseInt(event.timestamp));
    const cost = event.priceCents || 0;
    const isErrored = event?.status === 'errored';
    if (isErrored) modelIntent += ' [Errored, Not Charged]';
    return `
      <tr${isErrored ? ' class="errored-bg"' : ''}>
        <td>${timestamp.toLocaleString()}</td>
        <td>${modelIntent}</td>
        <td>${(cost / 100).toFixed(3)}</td>
        <td>${formatNumber(tokenUsage?.inputTokens || 0)}</td>
        <td>${formatNumber(tokenUsage?.outputTokens || 0)}</td>
        <td>${formatNumber(tokenUsage?.cacheReadTokens || 0)}</td>
        <td>${formatNumber(tokenUsage?.cacheWriteTokens || 0)}</td>
      </tr>
    `;
  }).join('');

  updatePaginationControls(sortedEvents.length, analyticsCurrentPage, totalPages);
}

/**
 * Update pagination controls
 */
function updatePaginationControls(totalItems, currentPage, totalPages) {
  const paginationContainer = document.getElementById('paginationContainer');
  if (!paginationContainer) return;
  
  const startIndex = (currentPage - 1) * analyticsPageSize + 1;
  const endIndex = Math.min(startIndex + analyticsPageSize - 1, totalItems);
  
  if (totalPages <= 1) {
    paginationContainer.innerHTML = `
    <div class="pagination-info">
      Showing ${startIndex}-${endIndex} of ${totalItems} results
    </div>`;
    return;
  }

  paginationContainer.innerHTML = `
    <div class="pagination-info">
      Showing ${startIndex}-${endIndex} of ${totalItems} results
    </div>
    <div class="pagination-buttons">
      <button id="prevPageBtn" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
      <span>Page ${currentPage} of ${totalPages}</span>
      <button id="nextPageBtn" class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    </div>
  `;

  // Add event listeners
  document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (analyticsCurrentPage > 1) {
      analyticsCurrentPage--;
      displayData();
    }
  });

  document.getElementById('nextPageBtn').addEventListener('click', () => {
    if (analyticsCurrentPage < totalPages) {
      analyticsCurrentPage++;
      displayData();
    }
  });
}

/**
 * Update results information
 */
function updateResultsInfo(count) {
  elements.resultsCount.textContent = `${count} event${count !== 1 ? 's' : ''}`;
  
  // Update time range description
  let timeRangeText = 'All time';
  if (customDateRange) {
    const fromDate = new Date(customDateRange.from).toLocaleDateString();
    const toDate = new Date(customDateRange.to).toLocaleDateString();
    timeRangeText = `${fromDate} - ${toDate}`;
  } else if (currentFilter !== 'all') {
    const filterLabels = {
      today: 'Today',
      yesterday: 'Yesterday',
      last4hours: 'Last 4 hours',
      last24hours: 'Last 24 hours',
      last7days: 'Last 7 days'
    };
    timeRangeText = filterLabels[currentFilter] || 'All time';
  }
  elements.timeRange.textContent = timeRangeText;
}

/**
 * Export data in specified format
 */
function exportData(format) {
  const filteredEvents = filterEvents(allUsageData.usageEvents).filter(isValidEvent);
  
  if (format === 'csv') {
    const csv = convertToCSV(filteredEvents);
    downloadFile(csv, 'cursor-usage.csv', 'text/csv');
  } else if (format === 'json') {
    const json = JSON.stringify(filteredEvents, null, 2);
    downloadFile(json, 'cursor-usage.json', 'application/json');
  }
}

/**
 * Convert events to CSV format
 */
function convertToCSV(events) {
  const headers = ['Timestamp', 'Model', 'Cost', 'Input Tokens', 'Output Tokens', 'Cache Read Tokens', 'Cache Write Tokens'];
  const rows = events.map(event => {
    const details = getModelDetails(event.details);
    const tokenUsage = details?.tokenUsage;
    let modelIntent = details?.modelIntent || 'Unknown';
    if (modelIntent === 'default') modelIntent = 'Auto';
    const subscriptionProductId = event.subscriptionProductId;
    if (subscriptionProductId && subscriptionProductId !== 'pro-legacy') {
      modelIntent += ` - [${subscriptionProductId}]`;
    }
    const timestamp = new Date(parseInt(event.timestamp)).toISOString();
    const cost = (event.priceCents || 0) / 100;
    
    return [
      timestamp,
      modelIntent,
      cost,
      tokenUsage?.inputTokens || 0,
      tokenUsage?.outputTokens || 0,
      tokenUsage?.cacheReadTokens || 0,
      tokenUsage?.cacheWriteTokens || 0
    ].map(field => `"${field}"`).join(',');
  });
  
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Download file
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
 * Update last updated timestamp
 */
function updateLastUpdated() {
  const now = new Date();
  elements.lastUpdated.textContent = `Last updated: ${now.toLocaleString()}`;
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
 * Format number with commas
 */
function formatNumber(num) {
  return new Intl.NumberFormat().format(num || 0);
}

/**
 * Format timestamp for display
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
 * Determina si un evento es válido para mostrar
 */
function isValidEvent(event) {
  const details = getModelDetails(event.details);
  const isEmptyDetails = !details || Object.keys(details).length === 0;
  return !(isEmptyDetails && (event.priceCents === 0));
}

// Fetch user analytics from background
async function fetchAndStoreUserAnalytics() {
  // Use the same time range as the current filter for initial fetch
  // But fetch for a wide range to allow local filtering
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const params = {
    teamId: 0,
    userId: 0,
    startDate: String(thirtyDaysAgo),
    endDate: String(now)
  };
  try {
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'fetchUserAnalytics', params }, resolve);
    });
    if (response.success) {
      userAnalyticsData = response.data;
    } else {
      userAnalyticsData = null;
      console.error('Failed to fetch user analytics:', response.error);
    }
  } catch (e) {
    userAnalyticsData = null;
    console.error('Error fetching user analytics:', e);
  }
}

// Helper: get current filter's date range
function getCurrentDateRange() {
  const now = Date.now();
  let startTime = 0;
  let endTime = now;
  // Check for future timestamps
  if (allUsageData && allUsageData.usageEvents) {
    const maxEventTime = Math.max(...allUsageData.usageEvents.map(e => parseInt(e.timestamp)));
    if (maxEventTime > now) endTime = maxEventTime;
  }
  if (customDateRange) {
    startTime = customDateRange.from;
    endTime = customDateRange.to;
  } else {
    switch (currentFilter) {
      case 'today':
        const todayStart = new Date(endTime);
        todayStart.setHours(0, 0, 0, 0);
        startTime = todayStart.getTime();
        break;
      case 'yesterday':
        const yesterdayStart = new Date(endTime);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        yesterdayStart.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterdayStart);
        yesterdayEnd.setHours(23, 59, 59, 999);
        startTime = yesterdayStart.getTime();
        endTime = yesterdayEnd.getTime();
        break;
      case 'last4hours':
        startTime = endTime - (4 * 60 * 60 * 1000);
        break;
      case 'last24hours':
        startTime = endTime - (24 * 60 * 60 * 1000);
        break;
      case 'last7days':
        startTime = endTime - (7 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        startTime = 0;
        break;
    }
  }
  return { startTime, endTime };
}

// Update the analytics panel
function updateUserAnalyticsPanel() {
  const panel = document.getElementById('userAnalyticsPanel');
  if (!panel) return;
  if (!userAnalyticsData || !userAnalyticsData.dailyMetrics) {
    panel.innerHTML = '<div style="color:#a0aec0;">No analytics data available</div>';
    return;
  }
  // Get current filter's date range
  const { startTime, endTime } = getCurrentDateRange();
  // Filter dailyMetrics by date
  const filtered = userAnalyticsData.dailyMetrics.filter(day => {
    const dayTime = parseInt(day.date);
    return dayTime >= startTime && dayTime <= endTime;
  });
  // Sum the fields
  const sums = filtered.reduce((acc, day) => {
    acc.linesAdded += day.linesAdded || 0;
    acc.linesDeleted += day.linesDeleted || 0;
    acc.totalTabsShown += day.totalTabsShown || 0;
    acc.totalTabsAccepted += day.totalTabsAccepted || 0;
    return acc;
  }, { linesAdded: 0, linesDeleted: 0, totalTabsShown: 0, totalTabsAccepted: 0 });
  // Render stat cards (vertical, no grid)
  panel.innerHTML = `
    <div class="stat-card">
      <div class="model-stats">
        <div class="model-stat">
          <span class="stat-value-small">${formatNumber(sums.linesAdded)}</span> Lines Added
        </div>
        <div class="model-stat">
          <span class="stat-value-small">${formatNumber(sums.linesDeleted)}</span> Lines Deleted
        </div>
        <div class="model-stat">
          <span class="stat-value-small">${formatNumber(sums.totalTabsShown)}</span> Tabs Shown
        </div>
        <div class="model-stat">
          <span class="stat-value-small">${formatNumber(sums.totalTabsAccepted)}</span> Tabs Accepted
        </div>
      </div>
    </div>
  `;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize); 