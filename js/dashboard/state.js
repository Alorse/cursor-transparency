/**
 * @file Manages the global state of the dashboard.
 * @module state
 */

export const state = {
  userAnalyticsData: null,
  currentFilter: 'all',
  customDateRange: null,
  currentSort: 'newest',
  modelBreakdownView: 'cost',
  selectedModel: 'all',
  analyticsCurrentPage: 1,
};

export const dom = {};

export const constants = {
  ANALYTICS_PAGE_SIZE: 50,
  TIMELINE_EVENT_LIMIT: 20,
}; 