/**
 * @file Manages all UI updates for the dashboard.
 * @module ui
 */

import { dom, state, constants } from './state.js';
import { formatNumber, formatTimestamp } from './utils.js';

/**
 * Shows the loading state and hides other content.
 */
export function showLoadingState() {
  dom.loadingState.classList.remove('hidden');
  dom.errorState.classList.add('hidden');
  dom.mainContent.classList.add('hidden');
}

/**
 * Shows the error state with a specific message.
 * @param {string} message - The error message to display.
 */
export function showErrorState(message) {
  dom.errorMessage.textContent = message;
  dom.loadingState.classList.add('hidden');
  dom.errorState.classList.remove('hidden');
  dom.mainContent.classList.add('hidden');
}

/**
 * Shows the main content of the dashboard.
 */
export function showMainContent() {
  dom.loadingState.classList.add('hidden');
  dom.errorState.classList.add('hidden');
  dom.mainContent.classList.remove('hidden');
}

/**
 * Updates the connection status indicator.
 * @param {boolean} connected - Whether the extension is connected to Cursor.com.
 * @param {string} message - The message to display.
 */
export function updateConnectionStatus(connected, message) {
  if (dom.statusIndicator && dom.statusText) {
    dom.statusIndicator.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
    dom.statusText.textContent = message;
  }
}

/**
 * Updates the "Last Updated" timestamp.
 */
export function updateLastUpdated() {
  const now = new Date();
  dom.lastUpdated.textContent = `Last updated: ${now.toLocaleString()}`;
}

/**
 * Updates the information about the number of results and the time range.
 * @param {number} count - The number of events being displayed.
 */
export function updateResultsInfo(count) {
  dom.resultsCount.textContent = `${count} event${count !== 1 ? 's' : ''}`;
  let timeRangeText = 'All time';
  if (state.customDateRange) {
    const fromDate = new Date(state.customDateRange.from).toLocaleDateString();
    const toDate = new Date(state.customDateRange.to).toLocaleDateString();
    timeRangeText = `${fromDate} - ${toDate}`;
  } else if (state.currentFilter !== 'all') {
    const filterLabels = {
      today: 'Today',
      yesterday: 'Yesterday',
      currentMonth: 'Current Month',
      last4hours: 'Last 4 hours',
      last24hours: 'Last 24 hours',
      last7days: 'Last 7 days',
    };
    timeRangeText = filterLabels[state.currentFilter] || 'All time';
  }
  dom.timeRange.textContent = timeRangeText;
}

/**
 * Renders the entire overview panel, including KPI cards and detailed breakdown.
 * @param {object} stats - The calculated statistics.
 */
export function updateOverviewPanel(stats) {
  // Update KPI cards
  dom.totalCost.textContent = `$${(stats.totalCents / 100).toFixed(2)}`;
  dom.totalRequests.textContent = formatNumber(stats.totalRequests);
  
  // Show/hide and update Based Costs card
  if (stats.totalBasedCents > 0) {
    dom.basedCostCard.style.display = 'flex';
    dom.totalBasedCost.textContent = `$${(stats.totalBasedCents / 100).toFixed(2)}`;
    // Remove two-cards class when we have 3 cards
    dom.overviewPanel.classList.remove('two-cards');
  } else {
    dom.basedCostCard.style.display = 'none';
    // Add two-cards class when we only have 2 cards
    dom.overviewPanel.classList.add('two-cards');
  }

  // Prepare data for detailed breakdown
  const userAnalytics = {
    linesAdded: 0,
    linesDeleted: 0,
    tabsShown: 0,
    tabsAccepted: 0,
  };

  if (state.userAnalyticsData && state.userAnalyticsData.dailyMetrics) {
    const { startTime, endTime } = getCurrentDateRange();
    const filtered = state.userAnalyticsData.dailyMetrics.filter(day => {
      const dayTime = parseInt(day.date);
      return dayTime >= startTime && dayTime <= endTime;
    });

    filtered.forEach(day => {
      userAnalytics.linesAdded += day.linesAdded || 0;
      userAnalytics.linesDeleted += day.linesDeleted || 0;
      userAnalytics.tabsShown += day.totalTabsShown || 0;
      userAnalytics.tabsAccepted += day.totalTabsAccepted || 0;
    });
  }

  // Render detailed breakdown panel
  dom.detailedBreakdownPanel.innerHTML = `
    <div class="breakdown-group">
      <h3 class="breakdown-group-title">User Activity</h3>
      <div class="breakdown-grid">
        <div class="breakdown-item">
          <span class="breakdown-value">${formatNumber(userAnalytics.linesAdded)}</span>
          <span class="breakdown-label">Lines Added</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-value">${formatNumber(userAnalytics.linesDeleted)}</span>
          <span class="breakdown-label">Lines Deleted</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-value">${formatNumber(userAnalytics.tabsShown)}</span>
          <span class="breakdown-label">Tabs Shown</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-value">${formatNumber(userAnalytics.tabsAccepted)}</span>
          <span class="breakdown-label">Tabs Accepted</span>
        </div>
      </div>
    </div>
    <div class="breakdown-group">
      <h3 class="breakdown-group-title">Token Usage</h3>
      <div class="breakdown-grid">
        <div class="breakdown-item">
          <span class="breakdown-value">${formatNumber(stats.totalInputTokens)}</span>
          <span class="breakdown-label">Input Tokens</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-value">${formatNumber(stats.totalOutputTokens)}</span>
          <span class="breakdown-label">Output Tokens</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-value">${formatNumber(stats.totalCacheReadTokens)}</span>
          <span class="breakdown-label">Cache Read</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-value">${formatNumber(stats.totalCacheWriteTokens)}</span>
          <span class="breakdown-label">Cache Write</span>
        </div>
      </div>
    </div>`;
}



/**
 * Renders the model usage breakdown.
 * @param {Array<object>} events - The usage events.
 */
export function updateModelBreakdown(events) {
  const modelStats = {};

  if (!events || events.length === 0) {
    dom.modelBreakdown.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🤖</div>
        <p>No model usage data available for the selected time period</p>
      </div>`;
    return;
  }

  events.forEach(event => {
    const tokenUsage = event?.tokenUsage || {};
    let modelIntent = event?.model || 'Unknown Model';
    if (modelIntent === 'default') modelIntent = 'Auto';
    
    // Separate costs based on kind
    const isUsageBased = event.kind == 'USAGE_EVENT_KIND_USAGE_BASED';
    const cost = tokenUsage.totalCents || 0;

    if (!modelStats[modelIntent]) {
      modelStats[modelIntent] = {
        requests: 0,
        totalCents: 0,
        totalBasedCents: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
      };
    }

    modelStats[modelIntent].requests++;
    
    if (isUsageBased) {
      modelStats[modelIntent].totalBasedCents += cost;
    } else {
      modelStats[modelIntent].totalCents += cost;
    }

    if (tokenUsage) {
      modelStats[modelIntent].totalInputTokens += tokenUsage.inputTokens || 0;
      modelStats[modelIntent].totalOutputTokens += tokenUsage.outputTokens || 0;
      modelStats[modelIntent].totalCacheReadTokens += tokenUsage.cacheReadTokens || 0;
    }
  });



  const sortedModels = Object.entries(modelStats).sort(([, a], [, b]) => {
    if (state.modelBreakdownView === 'cost') {
      return b.totalCents - a.totalCents;
    }
    return b.requests - a.requests;
  });

  if (sortedModels.length === 0) {
    dom.modelBreakdown.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🤖</div>
        <p>No model usage data available</p>
      </div>`;
    return;
  }

  dom.modelBreakdown.innerHTML = sortedModels.map(([model, stats]) => {
    const costDisplay = stats.totalBasedCents > 0 ? 
      `$${(stats.totalCents / 100).toFixed(2)} + $${(stats.totalBasedCents / 100).toFixed(2)} (Based)` :
      `$${(stats.totalCents / 100).toFixed(2)}`;
    
    return `
    <div class="model-item">
      <div class="model-header">
        <span class="model-name">${model}</span>
        <span class="event-cost">${costDisplay}</span>
      </div>
      <div class="model-stats">
        <div class="model-stat"><strong>${stats.requests}</strong> requests</div>
        <div class="model-stat"><strong>${formatNumber(stats.totalInputTokens)}</strong> input tokens</div>
        <div class="model-stat"><strong>${formatNumber(stats.totalOutputTokens)}</strong> output tokens</div>
        <div class="model-stat"><strong>${formatNumber(stats.totalCacheReadTokens)}</strong> cache read tokens</div>
      </div>
    </div>`;
  }).join('');
}

/**
 * Populates the model filter dropdown with available models.
 * @param {Array<object>} events - The usage events.
 */
export function updateModelFilter(events) {
    const modelIntents = new Set();
    events.forEach(event => {
        let modelIntent = event?.model || 'Unknown Model';
        if (modelIntent === 'default') modelIntent = 'Auto';
        if (modelIntent !== 'Unknown Model')
          modelIntents.add(modelIntent);
    });

    const sortedModels = Array.from(modelIntents).sort();
    const currentSelection = dom.modelFilter.value;

    dom.modelFilter.innerHTML = '<option value="all">All Models</option>';
    sortedModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        dom.modelFilter.appendChild(option);
    });

    dom.modelFilter.value = currentSelection;
}

/**
 * Renders the detailed analytics table with pagination.
 * @param {Array<object>} events - The usage events.
 */
export function updateAnalyticsTable(events) {
  const tbody = dom.analyticsTable.querySelector('tbody');

  if (events.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #a0aec0;">
          No usage events found for the selected time period
        </td>
      </tr>`;
    updatePaginationControls(0, 0, 0);
    return;
  }

  // Filter by model if a specific model is selected
  const modelFilteredEvents = state.selectedModel === 'all'
    ? events
    : events.filter(event => {
        let modelIntent = event?.model || 'Unknown Model';
        if (modelIntent === 'default') modelIntent = 'Auto';
        return modelIntent === state.selectedModel;
    });

  // Sort by the selected sort order
  const sortedEvents = [...modelFilteredEvents].sort((a, b) => {
    switch (state.currentSort) {
      case 'newest': return parseInt(b.timestamp) - parseInt(a.timestamp);
      case 'oldest': return parseInt(a.timestamp) - parseInt(b.timestamp);
      case 'cost-high': return (b.tokenUsage?.totalCents || 0) - (a.tokenUsage?.totalCents || 0);
      case 'cost-low': return (a.tokenUsage?.totalCents || 0) - (b.tokenUsage?.totalCents || 0);
      default: return parseInt(b.timestamp) - parseInt(a.timestamp);
    }
  });
  const totalPages = Math.ceil(sortedEvents.length / constants.ANALYTICS_PAGE_SIZE);
  if (state.analyticsCurrentPage > totalPages) state.analyticsCurrentPage = totalPages || 1;

  const startIndex = (state.analyticsCurrentPage - 1) * constants.ANALYTICS_PAGE_SIZE;
  const paginatedEvents = sortedEvents.slice(startIndex, startIndex + constants.ANALYTICS_PAGE_SIZE);

  tbody.innerHTML = paginatedEvents.map(event => {
    const tokenUsage = event?.tokenUsage;
    let modelIntent = event?.model || 'Unknown';
    if (modelIntent === 'default') modelIntent = 'Auto';
    const subscriptionProductId = event.model;
    const timestamp = new Date(parseInt(event.timestamp));
    const isErrored = event?.status === 'errored';
    if (isErrored) modelIntent += ' [Errored, Not Charged]';
    const isApiKey = subscriptionProductId === 'api-key';
    
    // Calculate costs based on kind
    const isUsageBased = event.kind == 'USAGE_EVENT_KIND_USAGE_BASED';
    const cost = tokenUsage?.totalCents || 0;
    const costDisplay = isUsageBased ? 
      `${(cost / 100).toFixed(3)} (Based)` : 
      `${(cost / 100).toFixed(3)}`;
    
    // Calculate total tokens
    const inputTokens = tokenUsage?.inputTokens || 0;
    const outputTokens = tokenUsage?.outputTokens || 0;
    const cacheReadTokens = tokenUsage?.cacheReadTokens || 0;
    const cacheWriteTokens = tokenUsage?.cacheWriteTokens || 0;
    const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
    
    return `
      <tr${isErrored ? ' class="errored-bg"' : ''}>
        <td>${timestamp.toLocaleString()}</td>
        <td>${modelIntent}</td>
        <td>${isApiKey ? '-' : costDisplay}</td>
        <td>${isApiKey ? '-' : formatNumber(inputTokens)}</td>
        <td>${isApiKey ? '-' : formatNumber(outputTokens)}</td>
        <td>${isApiKey ? '-' : formatNumber(cacheReadTokens)}</td>
        <td>${isApiKey ? '-' : formatNumber(cacheWriteTokens)}</td>
        <td>${isApiKey ? '-' : formatNumber(totalTokens)}</td>
      </tr>`;
  }).join('');

  updatePaginationControls(sortedEvents.length, state.analyticsCurrentPage, totalPages);
}

/**
 * Updates the pagination controls for the analytics table.
 * @param {number} totalItems - The total number of items.
 * @param {number} currentPage - The current page number.
 * @param {number} totalPages - The total number of pages.
 */
function updatePaginationControls(totalItems, currentPage, totalPages) {
  if (!dom.paginationContainer) return;

  const startIndex = (currentPage - 1) * constants.ANALYTICS_PAGE_SIZE + 1;
  const endIndex = Math.min(startIndex + constants.ANALYTICS_PAGE_SIZE - 1, totalItems);

  if (totalPages <= 1) {
    dom.paginationContainer.innerHTML = `<div class="pagination-info">Showing ${startIndex}-${endIndex} of ${totalItems} results</div>`;
    return;
  }

  dom.paginationContainer.innerHTML = `
    <div class="pagination-info">Showing ${startIndex}-${endIndex} of ${totalItems} results</div>
    <div class="pagination-buttons">
      <button id="prevPageBtn" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
      <span>Page ${currentPage} of ${totalPages}</span>
      <button id="nextPageBtn" class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    </div>`;

  // Use event delegation on the container to avoid multiple listeners
  dom.paginationContainer.onclick = (e) => {
    const target = e.target;
    
    if (target.id === 'prevPageBtn' && !target.disabled) {
      e.preventDefault();
      e.stopPropagation();
      if (state.analyticsCurrentPage > 1) {
        state.analyticsCurrentPage--;
        if (window.displayData) {
          window.displayData();
        }
      }
    } else if (target.id === 'nextPageBtn' && !target.disabled) {
      e.preventDefault();
      e.stopPropagation();
      if (state.analyticsCurrentPage < totalPages) {
        state.analyticsCurrentPage++;
        if (window.displayData) {
          window.displayData();
        }
      }
    }
  };
}

/**
 * Gets the date range for the current filter.
 * @returns {{startTime: number, endTime: number}}
 */
function getCurrentDateRange() {
  const now = Date.now();
  let startTime = 0;
  let endTime = now;

  if (state.userAnalyticsData && state.userAnalyticsData.usageEventsDisplay) {
    const maxEventTime = Math.max(...state.userAnalyticsData.usageEventsDisplay.map(e => parseInt(e.timestamp)));
    if (maxEventTime > now) endTime = maxEventTime;
  }

  if (state.customDateRange) {
    startTime = state.customDateRange.from;
    endTime = state.customDateRange.to;
  } else {
    switch (state.currentFilter) {
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
      case 'last4hours': startTime = endTime - (4 * 60 * 60 * 1000); break;
      case 'last24hours': startTime = endTime - (24 * 60 * 60 * 1000); break;
      case 'currentMonth':
        const currentMonthStart = new Date(endTime);
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);
        startTime = currentMonthStart.getTime();
        break;
      case 'last7days': startTime = endTime - (7 * 24 * 60 * 60 * 1000); break;
      case 'all':
      default: startTime = 0; break;
    }
  }
  return { startTime, endTime };
} 