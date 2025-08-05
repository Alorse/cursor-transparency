/**
 * @file Manages all UI updates for the dashboard.
 * @module ui
 */

import { dom, state, constants } from './state.js';
import { formatNumber, formatTimestamp, getModelDetails } from './utils.js';

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
 * Renders the timeline of usage events.
 * @param {Array<object>} events - The events to display.
 */
export function updateTimeline(events) {
  if (events.length === 0) {
    dom.usageTimeline.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>No usage events found for the selected time period</p>
      </div>`;
    return;
  }

  const sortedEvents = [...events].sort((a, b) => {
    switch (state.currentSort) {
      case 'newest': return parseInt(b.timestamp) - parseInt(a.timestamp);
      case 'oldest': return parseInt(a.timestamp) - parseInt(b.timestamp);
      case 'cost-high': return (b.requestsCosts || 0) - (a.requestsCosts || 0);
      case 'cost-low': return (a.requestsCosts || 0) - (b.requestsCosts || 0);
      default: return parseInt(b.timestamp) - parseInt(a.timestamp);
    }
  });

  const displayEvents = sortedEvents.slice(0, constants.TIMELINE_EVENT_LIMIT);

  dom.usageTimeline.innerHTML = displayEvents.map(event => {
    const details = getModelDetails(event);
    const tokenUsage = details?.tokenUsage || {};
    let modelIntent = details?.model || '1111Unknown Model';
    if (modelIntent === 'default') modelIntent = 'Auto';
    const timestamp = new Date(parseInt(event.timestamp));
    const cost = event.requestsCosts || 0;
    const isErrored = event?.status === 'errored';
    if (isErrored) modelIntent += ' [Errored, Not Charged]';
    const isApiKey = false;

    return `
      <div class="timeline-event${isErrored ? ' errored-bg' : ''}">
        <div class="event-header">
          <span class="event-model">${modelIntent}</span>
          <span class="event-time">${formatTimestamp(timestamp)}</span>
          <span class="event-cost">${isApiKey ? '-' : `$${(cost / 100).toFixed(3)}`}</span>
        </div>
        ${tokenUsage ? `
          <div class="event-details">
            <div class="event-detail"><strong>${isApiKey ? '-' : formatNumber(tokenUsage.inputTokens || 0)}</strong> input tokens</div>
            <div class="event-detail"><strong>${isApiKey ? '-' : formatNumber(tokenUsage.outputTokens || 0)}</strong> output tokens</div>
            <div class="event-detail"><strong>${isApiKey ? '-' : formatNumber(tokenUsage.cacheReadTokens || 0)}</strong> cache read</div>
            <div class="event-detail"><strong>${isApiKey ? '-' : formatNumber(tokenUsage.cacheWriteTokens || 0)}</strong> cache write</div>
          </div>
        ` : '<div class="event-details"><div class="event-detail">No token data available</div></div>'}
      </div>`;
  }).join('');

  if (sortedEvents.length > constants.TIMELINE_EVENT_LIMIT) {
    dom.usageTimeline.innerHTML += `
      <div class="timeline-event" style="text-align: center; opacity: 0.7;">
        <p>Showing first ${constants.TIMELINE_EVENT_LIMIT} of ${sortedEvents.length} events</p>
      </div>`;
  }
}

/**
 * Renders the model usage breakdown.
 * @param {Array<object>} events - The usage events.
 */
export function updateModelBreakdown(events) {
  const modelStats = {};
  console.log('events', events);

  events.usageEvents.forEach(event => {
    const details = getModelDetails(event);
    const tokenUsage = details?.tokenUsage || {};
    let modelIntent = details?.model || 'Unknown Model';
    if (modelIntent === 'default') modelIntent = 'Auto';
    const cost = event.priceCents || 0;

    if (!modelStats[modelIntent]) {
      modelStats[modelIntent] = {
        requests: 0,
        totalCents: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
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

  // Overwrite the totalCents with the value of aggregations if available
  if (state.allUsageData && state.allUsageData.aggregations) {
    state.allUsageData.aggregations.forEach(agg => {
      const modelIntent = agg.modelIntent || 'Unknown Model';
      if (modelStats[modelIntent]) {
        // Overwrite the totalCents with the value of aggregations
        modelStats[modelIntent].totalCents = agg.totalCents || 0;
      }
    });
  }

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

  dom.modelBreakdown.innerHTML = sortedModels.map(([model, stats]) => `
    <div class="model-item">
      <div class="model-header">
        <span class="model-name">${model}</span>
        <span class="event-cost">$${(stats.totalCents / 100).toFixed(2)}</span>
      </div>
      <div class="model-stats">
        <div class="model-stat"><strong>${stats.requests}</strong> requests</div>
        <div class="model-stat"><strong>${formatNumber(stats.totalInputTokens)}</strong> input tokens</div>
        <div class="model-stat"><strong>${formatNumber(stats.totalOutputTokens)}</strong> output tokens</div>
        <div class="model-stat"><strong>${formatNumber(stats.totalCacheReadTokens)}</strong> cache read tokens</div>
      </div>
    </div>
  `).join('');
}

/**
 * Populates the model filter dropdown with available models.
 * @param {Array<object>} events - The usage events.
 */
export function updateModelFilter(events) {
    const modelIntents = new Set();
    events.forEach(event => {
        const details = getModelDetails(event);
        let modelIntent = details?.model || 'Unknown Model';
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
        const details = getModelDetails(event);
        let modelIntent = details?.model || 'Unknown Model';
        if (modelIntent === 'default') modelIntent = 'Auto';
        return modelIntent === state.selectedModel;
    });

  // Sort by timestamp (newest first)
  const sortedEvents = [...modelFilteredEvents].sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
  const totalPages = Math.ceil(sortedEvents.length / constants.ANALYTICS_PAGE_SIZE);
  if (state.analyticsCurrentPage > totalPages) state.analyticsCurrentPage = totalPages || 1;

  const startIndex = (state.analyticsCurrentPage - 1) * constants.ANALYTICS_PAGE_SIZE;
  const paginatedEvents = sortedEvents.slice(startIndex, startIndex + constants.ANALYTICS_PAGE_SIZE);

  tbody.innerHTML = paginatedEvents.map(event => {
    const details = getModelDetails(event);
    const tokenUsage = details?.tokenUsage;
    let modelIntent = details?.model || 'Unknown';
    if (modelIntent === 'default') modelIntent = 'Auto';
    const subscriptionProductId = event.model;
    const timestamp = new Date(parseInt(event.timestamp));
    const cost = event.requestsCosts || 0;
    const isErrored = event?.status === 'errored';
    if (isErrored) modelIntent += ' [Errored, Not Charged]';
    const isApiKey = subscriptionProductId === 'api-key';
    
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
        <td>${isApiKey ? '-' : (cost / 100).toFixed(3)}</td>
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

  // These event listeners are re-added here. A more robust solution might use event delegation.
  document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (state.analyticsCurrentPage > 1) {
      state.analyticsCurrentPage--;
      // This function now needs a way to trigger a re-render.
      // We'll handle this in the main script.
    }
  });

  document.getElementById('nextPageBtn').addEventListener('click', () => {
    if (state.analyticsCurrentPage < totalPages) {
      state.analyticsCurrentPage++;
      // This function now needs a way to trigger a re-render.
      // We'll handle this in the main script.
    }
  });
}

/**
 * Gets the date range for the current filter.
 * @returns {{startTime: number, endTime: number}}
 */
function getCurrentDateRange() {
  const now = Date.now();
  let startTime = 0;
  let endTime = now;

  if (state.allUsageData && state.allUsageData.usageEvents) {
    const maxEventTime = Math.max(...state.allUsageData.usageEvents.map(e => parseInt(e.timestamp)));
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
      case 'last7days': startTime = endTime - (7 * 24 * 60 * 60 * 1000); break;
      case 'all':
      default: startTime = 0; break;
    }
  }
  return { startTime, endTime };
} 