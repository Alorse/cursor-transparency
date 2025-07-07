/**
 * @file Centralizes all DOM element selections.
 * @module dom
 */

import { dom } from './state.js';

/**
 * Initializes the DOM elements and stores them in the dom state object.
 */
export function initDOM() {
  const elementIds = {
    // States
    loadingState: 'loadingState',
    errorState: 'errorState',
    mainContent: 'mainContent',
    errorMessage: 'errorMessage',
    
    // Actions
    refreshBtn: 'refreshBtn',
    retryBtn: 'retryBtn',
    openCursorBtn: 'openCursorBtn',
    
    // Display elements
    lastUpdated: 'lastUpdated',
    resultsCount: 'resultsCount',
    timeRange: 'timeRange',
    connectionStatus: 'connectionStatus',
    statusIndicator: 'statusIndicator',
    statusText: 'statusText',
    
    // Stats
    totalCost: 'totalCost',
    totalInputTokens: 'totalInputTokens',
    totalCacheReadTokens: 'totalCacheReadTokens',
    totalRequests: 'totalRequests',
    inputTokensDetail: 'inputTokensDetail',
    cacheTokensDetail: 'cacheTokensDetail',
    requestsDetail: 'requestsDetail',
    
    // Filters
    filterBtns: '.filter-btn', // This is a class selector
    dateFrom: 'dateFrom',
    dateTo: 'dateTo',
    applyCustomRange: 'applyCustomRange',
    timeRangeDropdown: 'timeRangeDropdown',
    
    // Timeline
    sortOrder: 'sortOrder',
    usageTimeline: 'usageTimeline',
    
    // Models
    toggleBtns: '.toggle-btn', // This is a class selector
    modelBreakdown: 'modelBreakdown',
    
    // Analytics
    exportCsv: 'exportCsv',
    exportJson: 'exportJson',
    analyticsTable: 'analyticsTable',
    paginationContainer: 'paginationContainer',
    userAnalyticsPanel: 'userAnalyticsPanel',
  };

  for (const key in elementIds) {
    if (elementIds[key].startsWith('.')) {
      dom[key] = document.querySelectorAll(elementIds[key]);
    } else {
      dom[key] = document.getElementById(elementIds[key]);
    }
  }
} 