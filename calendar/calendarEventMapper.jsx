/**
 * calendarEventMapper.js — Convert CalendarEvent records to UI event objects
 * Phase 2: New data source mapper with fallback support
 */

/**
 * Validates CalendarEvent record has required fields
 */
const isValidCalendarEvent = (event) => {
  return (
    event?.id &&
    event.type &&
    event.title &&
    event.startAt &&
    event.endAt &&
    ['appointment', 'install', 'followup', 'service'].includes(event.type) &&
    ['scheduled', 'completed', 'cancelled'].includes(event.status || 'scheduled')
  );
};

/**
 * Convert single CalendarEvent to UI event object
 */
export const mapCalendarEventToUIEvent = (calendarEvent) => {
  if (!isValidCalendarEvent(calendarEvent)) {
    return null;
  }

  const startAt = new Date(calendarEvent.startAt);
  const endAt = new Date(calendarEvent.endAt);

  // Clamp: endAt must be >= startAt
  if (endAt < startAt) {
    endAt.setTime(startAt.getTime() + 60 * 60 * 1000); // Default 1 hour
  }

  return {
    id: calendarEvent.id,
    title: calendarEvent.title,
    startAt,
    endAt,
    type: calendarEvent.type,
    status: calendarEvent.status,
    jobId: calendarEvent.jobId,
    crmJobId: calendarEvent.crmJobId,
    assignedToUserId: calendarEvent.assignedToUserId,
    crewId: calendarEvent.crewId,
    notes: calendarEvent.notes,
    source: 'calendarEvent',
    meta: {
      type: calendarEvent.type,
      status: calendarEvent.status,
    },
  };
};

/**
 * Map array of CalendarEvent records to UI events
 */
export const mapCalendarEventsToUIEvents = (calendarEvents = []) => {
  return calendarEvents
    .map(mapCalendarEventToUIEvent)
    .filter((event) => event !== null);
};

/**
 * Split UI events by tab (appointments vs production)
 * - Production: type === 'install'
 * - Appointments: appointment/followup/service
 */
export const splitUIEventsByTab = (uiEvents = []) => {
  const appointments = [];
  const production = [];

  uiEvents.forEach((event) => {
    if (event.type === 'install') {
      production.push(event);
    } else if (['appointment', 'followup', 'service'].includes(event.type)) {
      appointments.push(event);
    }
  });

  return { appointments, production };
};