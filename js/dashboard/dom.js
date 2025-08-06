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
    // Connection Status
    statusIndicator: 'statusIndicator',
    statusText: 'statusText',

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
    timeRangeDropdown: 'timeRangeDropdown',
    
    // Overview Panel
    overviewPanel: 'overviewPanel',
    totalCost: 'totalCost',
    totalBasedCost: 'totalBasedCost',
    basedCostCard: 'basedCostCard',
    totalRequests: 'totalRequests',
    detailedBreakdownPanel: 'detailedBreakdownPanel',

    // Timeline
    usageTimeline: 'usageTimeline',
    sortOrder: 'sortOrder',
    
    // Models
    modelBreakdownSort: 'modelBreakdownSort',
    modelBreakdown: 'modelBreakdown',
    
    // Analytics

    analyticsTable: 'analyticsTable',
    modelFilter: 'modelFilter',
    paginationContainer: 'paginationContainer',
    userAnalyticsPanel: 'userAnalyticsPanel',
  };

  for (const key in elementIds) {
    if (Object.prototype.hasOwnProperty.call(elementIds, key)) {
      const selector = elementIds[key];
      if (selector.startsWith('.')) {
        dom[key] = document.querySelectorAll(selector);
      } else {
        dom[key] = document.getElementById(selector);
      }
    }
  }
} 