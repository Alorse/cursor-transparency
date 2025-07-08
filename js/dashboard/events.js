/**
 * @file Sets up all event listeners for the dashboard.
 * @module events
 */

import { dom, state } from './state.js';
import { exportData } from './export.js';

let refreshData = () => {};

/**
 * Sets up all event listeners.
 * @param {function} displayDataCallback - The function to call to refresh the data display.
 */
export function setupEventListeners(displayDataCallback) {
  refreshData = displayDataCallback;

  if (dom.refreshBtn) {
    dom.refreshBtn.addEventListener('click', () => refreshData(true));
  }

  if (dom.retryBtn) {
    dom.retryBtn.addEventListener('click', () => refreshData());
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

  if (dom.toggleBtns && dom.toggleBtns.length) {
    dom.toggleBtns.forEach(btn => {
      btn.addEventListener('click', handleModelViewToggle);
    });
  }

  if (dom.exportCsv) {
    dom.exportCsv.addEventListener('click', () => exportData('csv'));
  }

  if (dom.exportJson) {
    dom.exportJson.addEventListener('click', () => exportData('json'));
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
    if (state.allUsageData) refreshData();
  }
}

function handleSortChange(e) {
  state.currentSort = e.target.value;
  if (state.allUsageData) refreshData();
}

function handleModelViewToggle(e) {
  dom.toggleBtns.forEach(b => b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  state.modelBreakdownView = e.currentTarget.dataset.view;
  if (state.allUsageData) refreshData();
}

function handleTimeRangeChange(e) {
  state.currentFilter = e.target.value;
  state.customDateRange = null;
  state.analyticsCurrentPage = 1; // Reset page on filter change
  if (state.allUsageData) refreshData();
}

function handleModelFilterChange(e) {
    state.selectedModel = e.target.value;
    state.analyticsCurrentPage = 1; // Reset page on filter change
    if (state.allUsageData) refreshData();
}

function handlePaginationClick(e) {
  const target = e.target.closest('.pagination-btn');
  if (!target) return;

  if (target.id === 'prevPageBtn') {
    if (state.analyticsCurrentPage > 1) {
      state.analyticsCurrentPage--;
      refreshData();
    }
  } else if (target.id === 'nextPageBtn') {
    const totalPages = Math.ceil(
      (state.allUsageData?.usageEvents?.length || 0) / 100
    );
    if (state.analyticsCurrentPage < totalPages) {
      state.analyticsCurrentPage++;
      refreshData();
    }
  }
} 