/**
 * calendarRangeCompute.js — Compute visible date range for calendar views
 * Helper utility for CalendarShell to emit onRangeChange
 */

/**
 * Compute ISO 8601 date range for current view mode
 * @param {Date} currentDate - The anchor date for the view
 * @param {string} viewMode - 'Day' | 'Week' | 'Month'
 * @returns {{ rangeStartISO: string, rangeEndISO: string }}
 */
export function computeVisibleRange(currentDate, viewMode) {
  let rangeStart, rangeEnd;

  if (viewMode === 'Day') {
    // [00:00 today, 00:00 tomorrow)
    rangeStart = new Date(currentDate);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
  } else if (viewMode === 'Week') {
    // [start of week 00:00, start+7 days 00:00)
    const day = currentDate.getDay();
    const diff = currentDate.getDate() - day;
    rangeStart = new Date(currentDate.setDate(diff));
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 7);
  } else {
    // Month: [first of month 00:00, first of next month 00:00)
    rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    rangeEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  }

  return {
    rangeStartISO: rangeStart.toISOString(),
    rangeEndISO: rangeEnd.toISOString(),
  };
}