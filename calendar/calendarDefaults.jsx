/**
 * calendarDefaults.js — Business day + time slot helpers for calendar
 * Generates smart default start/end times for event creation
 */

/**
 * Get the next business day (skip weekends)
 * @param {Date} baseDate - Start search from this date (default: today)
 * @returns {Date} Next business day at 00:00 local
 */
export function getNextBusinessDay(baseDate = new Date()) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);

  // Skip weekends (0 = Sun, 6 = Sat)
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Add minutes to a date
 * @param {Date} date - Base date
 * @param {number} minutes - Minutes to add
 * @returns {Date} New date with minutes added
 */
export function addMinutes(date, minutes) {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * Get default start time for a calendar event
 * @param {Object} params
 * @param {string} params.type - Event type (appointment, install, followup, service)
 * @param {Date} params.selectedDate - Preferred day (optional, uses next business day if not provided)
 * @returns {Object} { startAt: datetime-local string, endAt: datetime-local string }
 */
export function getDefaultEventTimes({ type = 'appointment', selectedDate = null }) {
  let baseDate = selectedDate ? new Date(selectedDate) : new Date();
  let startDate = getNextBusinessDay(baseDate);

  // Set hour based on event type
  const startHour = type === 'install' ? 8 : 10; // Install at 8 AM, others at 10 AM
  startDate.setHours(startHour, 0, 0, 0);

  // Calculate duration based on type
  const durationMinutes = type === 'install' ? 240 : 60; // Install = 4 hrs, appointment = 1 hr
  const endDate = addMinutes(startDate, durationMinutes);

  // Convert to ISO string and truncate to datetime-local format (YYYY-MM-DDTHH:MM)
  const formatDateTimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return {
    startAt: formatDateTimeLocal(startDate),
    endAt: formatDateTimeLocal(endDate),
  };
}

/**
 * Validate date strings for datetime-local inputs
 * @param {string} startAt - Start datetime (YYYY-MM-DDTHH:MM)
 * @param {string} endAt - End datetime (YYYY-MM-DDTHH:MM)
 * @returns {Object} { valid: boolean, error: string|null }
 */
export function validateEventDates(startAt, endAt) {
  if (!startAt || !endAt) {
    return { valid: false, error: 'Start and end times are required.' };
  }

  const startMs = Date.parse(startAt);
  const endMs = Date.parse(endAt);

  if (isNaN(startMs)) {
    return { valid: false, error: 'Invalid start time format.' };
  }

  if (isNaN(endMs)) {
    return { valid: false, error: 'Invalid end time format.' };
  }

  if (endMs <= startMs) {
    return { valid: false, error: 'End time must be after start time.' };
  }

  return { valid: true, error: null };
}