/**
 * @file Manages the global state of the dashboard.
 * @module state
 */

export const state = {
  allUsageData: null,
  currentFilter: 'all',
  customDateRange: null,
  currentSort: 'newest',
  modelBreakdownView: 'cost',
  selectedModel: 'all',
  userAnalyticsData: null,
  analyticsCurrentPage: 1,
};

export const dom = {};

export const constants = {
  ANALYTICS_PAGE_SIZE: 50,
  TIMELINE_EVENT_LIMIT: 20,
}; 