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
    
    // Overview Panel
    overviewPanel: 'overviewPanel',
    totalCost: 'totalCost',
    totalRequests: 'totalRequests',
    detailedBreakdownPanel: 'detailedBreakdownPanel',

    // Timeline
    usageTimeline: 'usageTimeline',
    sortOrder: 'sortOrder',
    
    // Models
    toggleBtns: '.toggle-btn', // This is a class selector
    modelBreakdown: 'modelBreakdown',
    
    // Analytics
    exportCsv: 'exportCsv',
    exportJson: 'exportJson',
    analyticsTable: 'analyticsTable',
    modelFilter: 'modelFilter',
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

  dom.lastUpdated = document.getElementById('lastUpdated');
  dom.resultsCount = document.getElementById('resultsCount');
  dom.timeRange = document.getElementById('timeRange');

  // Overview Panel
  dom.overviewPanel = document.getElementById('overviewPanel');
  dom.totalCost = document.getElementById('totalCost');
  dom.totalRequests = document.getElementById('totalRequests');
  dom.detailedBreakdownPanel = document.getElementById('detailedBreakdownPanel');

  // Timeline
  dom.usageTimeline = document.getElementById('usageTimeline');
  dom.sortOrder = document.getElementById('sortOrder');
} 