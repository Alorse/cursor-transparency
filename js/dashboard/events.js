/**
 * @file Sets up all event listeners for the dashboard.
 * @module events
 */

import { dom, state } from './state.js';

let fetchData = () => {};
let renderData = () => {};

/**
 * Sets up all event listeners.
 * @param {function} fetchDataCallback - The function to call to fetch new data.
 * @param {function} renderDataCallback - The function to call to re-render the display.
 */
export function setupEventListeners(fetchDataCallback, renderDataCallback) {
  fetchData = fetchDataCallback;
  renderData = renderDataCallback;

  if (dom.refreshBtn) {
    dom.refreshBtn.addEventListener('click', () => fetchData(true));
  }

  if (dom.retryBtn) {
    dom.retryBtn.addEventListener('click', () => fetchData());
  }

  if (dom.openCursorBtn) {
    dom.openCursorBtn.addEventListener('click', () => {
      window.open('https://www.cursor.com', '_blank');
    });
  }

  if (dom.applyCustomRange && dom.dateFrom && dom.dateTo) {
    dom.applyCustomRange.addEventListener('click', handleCustomDateRange);
  }

  if (dom.sortOrder) {
    dom.sortOrder.addEventListener('change', handleSortChange);
  }

  if (dom.modelBreakdownSort) {
    dom.modelBreakdownSort.addEventListener('change', handleModelBreakdownSortChange);
  }



  if (dom.timeRangeDropdown) {
    dom.timeRangeDropdown.addEventListener('change', handleTimeRangeChange);
  }

  if (dom.modelFilter) {
    dom.modelFilter.addEventListener('change', handleModelFilterChange);
  }

  // Event delegation for pagination
  if (dom.paginationContainer) {
    dom.paginationContainer.addEventListener('click', handlePaginationClick);
  }
}

function handleCustomDateRange() {
  const fromDate = dom.dateFrom.value;
  const toDate = dom.dateTo.value;
  if (fromDate && toDate) {
    state.customDateRange = {
      from: new Date(fromDate).getTime(),
      to: new Date(toDate).getTime(),
    };
    dom.filterBtns.forEach(b => b.classList.remove('active'));
    if (state.userAnalyticsData) renderData();
  }
}

function handleSortChange(e) {
  state.currentSort = e.target.value;
  if (state.userAnalyticsData) renderData();
}

function handleModelBreakdownSortChange(e) {
  state.modelBreakdownView = e.target.value;
  if (state.userAnalyticsData) renderData();
}

function handleTimeRangeChange(e) {
  state.currentFilter = e.target.value;
  state.customDateRange = null;
  state.analyticsCurrentPage = 1; // Reset page on filter change
  if (state.userAnalyticsData) {
    renderData();
  }
}

function handleModelFilterChange(e) {
    state.selectedModel = e.target.value;
    state.analyticsCurrentPage = 1; // Reset page on filter change
    if (state.userAnalyticsData) renderData();
}

function handlePaginationClick(e) {
  const target = e.target.closest('.pagination-btn');
  if (!target || target.disabled) return;

  if (target.id === 'prevPageBtn') {
    state.analyticsCurrentPage--;
    renderData();
  } else if (target.id === 'nextPageBtn') {
    state.analyticsCurrentPage++;
    renderData();
  }
} 