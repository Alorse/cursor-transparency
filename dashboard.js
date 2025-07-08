/**
 * @file This is the main script for the Cursor Usage Dashboard. It initializes the application,
 * fetches data, and coordinates the various modules to display the dashboard.
 * @author Your Name
 * @see {@link https://www.cursor.com|Cursor}
 */

import { state } from './js/dashboard/state.js';
import { initDOM } from './js/dashboard/dom.js';
import { setupEventListeners } from './js/dashboard/events.js';
import { checkConnection, fetchUsageData, fetchUserAnalytics } from './js/dashboard/api.js';
import { 
  showLoadingState, 
  showErrorState, 
  showMainContent, 
  updateConnectionStatus, 
  updateLastUpdated,
  updateOverviewPanel,
  updateTimeline,
  updateModelBreakdown,
  updateAnalyticsTable,
  updateModelFilter,
  updateResultsInfo,
} from './js/dashboard/ui.js';
import { getModelDetails, isValidEvent } from './js/dashboard/utils.js';

/**
 * Initializes the dashboard by setting up event listeners, fetching initial data,
 * and rendering the UI.
 */
async function initialize() {
  initDOM();
  setupEventListeners(fetchAndDisplayData, displayData);
  
  const isConnected = await checkConnection();
  updateConnectionStatus(isConnected, isConnected ? 'Connected to Cursor.com' : 'No Cursor.com tab found');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await fetchAndDisplayData();
}

/**
 * Fetches data from the API and updates the display.
 * @param {boolean} forceRefresh - Whether to force a refresh of the data cache.
 */
async function fetchAndDisplayData(forceRefresh = false) {
  showLoadingState();
  try {
    const isConnected = await checkConnection();
    updateConnectionStatus(isConnected, isConnected ? 'Connected to Cursor.com' : 'Data loaded successfully');

    if (!isConnected) {
      showErrorState('No connection to Cursor.com. Please open a tab with cursor.com.');
      return;
    }

    // Fetch both datasets in parallel
    const usageDataPromise = fetchUsageData(forceRefresh);
    const userAnalyticsPromise = fetchUserAnalytics();
    
    const [usageData, userAnalyticsData] = await Promise.all([usageDataPromise, userAnalyticsPromise]);
    
    state.allUsageData = usageData;
    state.userAnalyticsData = userAnalyticsData;

    displayData();
    showMainContent();
    updateLastUpdated();
  } catch (error) {
    console.error('Error fetching usage data:', error);
    const isConnected = await checkConnection();
    updateConnectionStatus(isConnected, isConnected ? 'Connected to Cursor.com' : 'No Cursor.com tab found');
    showErrorState(error.message);
  }
}

/**
 * Filters and displays the data based on the current settings.
 */
function displayData() {
  if (!state.allUsageData || !state.allUsageData.usageEvents) {
    showErrorState('No usage data available');
    return;
  }
  
  const filteredEvents = filterEvents(state.allUsageData.usageEvents).filter(isValidEvent);
  const stats = calculateStats(filteredEvents);
  
  updateOverviewPanel(stats);
  updateTimeline(filteredEvents);
  updateModelBreakdown(filteredEvents);
  updateAnalyticsTable(filteredEvents);
  updateModelFilter(state.allUsageData.usageEvents);
  updateResultsInfo(filteredEvents.length);
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
 * Calculates statistics from a set of events.
 * @param {Array<object>} events - The events to analyze.
 * @returns {object} The calculated statistics.
 */
function calculateStats(events) {
  const stats = {
    totalCents: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    totalRequests: 0,
    averageCostPerRequest: 0,
    tokensPerRequest: 0,
    bySubscription: {},
  };

  events.forEach(event => {
    const subscriptionProductId = event.subscriptionProductId || 'unknown';
    if (!stats.bySubscription[subscriptionProductId]) {
      stats.bySubscription[subscriptionProductId] = {
        totalCents: 0, totalInputTokens: 0, totalOutputTokens: 0,
        totalCacheReadTokens: 0, totalCacheWriteTokens: 0, totalRequests: 0,
      };
    }
    const subStats = stats.bySubscription[subscriptionProductId];
    subStats.totalCents += event.priceCents || 0;
    subStats.totalRequests += 1;
    
    const details = getModelDetails(event.details);
    const tokenUsage = details?.tokenUsage;
    if (tokenUsage) {
      subStats.totalInputTokens += tokenUsage.inputTokens || 0;
      subStats.totalOutputTokens += tokenUsage.outputTokens || 0;
      subStats.totalCacheReadTokens += tokenUsage.cacheReadTokens || 0;
      subStats.totalCacheWriteTokens += tokenUsage.cacheWriteTokens || 0;
    }
  });

  Object.values(stats.bySubscription).forEach(subStats => {
    stats.totalCents += subStats.totalCents;
    stats.totalInputTokens += subStats.totalInputTokens;
    stats.totalOutputTokens += subStats.totalOutputTokens;
    stats.totalCacheReadTokens += subStats.totalCacheReadTokens;
    stats.totalCacheWriteTokens += subStats.totalCacheWriteTokens;
    stats.totalRequests += subStats.totalRequests;
  });

  if (stats.totalRequests > 0) {
    stats.averageCostPerRequest = stats.totalCents / stats.totalRequests;
    stats.tokensPerRequest = (stats.totalInputTokens + stats.totalOutputTokens) / stats.totalRequests;
  }
  
  return stats;
}

/**
 * Sets up the interactive animated logo.
 */
function setupAnimatedLogo() {
  const animatedLogo = document.getElementById('animatedLogo');
  if (animatedLogo) {
    const video = animatedLogo.querySelector('video');
    if (video) {
      animatedLogo.addEventListener('mouseenter', () => {
        video.play();
      });
      animatedLogo.addEventListener('mouseleave', () => {
        video.pause();
        video.currentTime = 0;
      });
    }
  }
}

// Initialize the application when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
  initialize();
  setupAnimatedLogo();
}); 