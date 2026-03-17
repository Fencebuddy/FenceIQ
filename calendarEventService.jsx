/**
 * calendarEventService.js — CalendarEvent service with Phase 3 write support + dedupe
 * Phase 2: Read-only queries
 * Phase 3: Create/update/delete (gated by calendarWriteEnabled)
 * Scheduling: Job→CalendarEvent mapping, dedupe precheck
 */

import { base44 } from '@/api/base44Client';
import toast from 'react-hot-toast';
import { logCalendarMutation } from './calendarAuditService';

/**
 * List CalendarEvents within a date range for a company
 * @param {string} companyId - Company identifier
 * @param {string} rangeStartISO - ISO 8601 start (inclusive)
 * @param {string} rangeEndISO - ISO 8601 end (exclusive)
 * @returns {Promise<Array>} Array of CalendarEvent records, or [] on error
 */
export async function listByCompanyRange({ companyId, rangeStartISO, rangeEndISO }) {
  if (!companyId || !rangeStartISO || !rangeEndISO) {
    return [];
  }

  try {
    // Query CalendarEvent with company filter
    const records = await base44.entities.CalendarEvent.filter({
      companyId
    });

    if (!Array.isArray(records)) {
      return [];
    }

    // Client-side overlap filter (safe for 500 max)
    const rangeStart = new Date(rangeStartISO);
    const rangeEnd = new Date(rangeEndISO);

    return records.filter((event) => {
      if (!event.startAt || !event.endAt) return false;

      const eventStart = new Date(event.startAt);
      const eventEnd = new Date(event.endAt);

      // Overlap check: eventStart < rangeEnd AND eventEnd >= rangeStart
      return eventStart < rangeEnd && eventEnd >= rangeStart;
    }).slice(0, 500);
  } catch (error) {
    // Silently handle entity not found, network errors, etc.
    console.warn('[calendarEventService] listByCompanyRange error:', error.message);
    return [];
  }
}

/**
 * Create a new CalendarEvent (Phase 3 write)
 * MUST ONLY be called when calendarWriteEnabled === true
 * @param {Object} data - CalendarEvent data
 * @returns {Promise<Object|null>} Created record or null on error
 */
export async function createCalendarEvent(data) {
  if (!data?.companyId) {
    console.error('[calendarEventService] createCalendarEvent: missing companyId');
    throw new Error('Company ID is required');
  }

  try {
    const now = new Date().toISOString();
    const userId = await base44.auth.me().then(u => u?.id).catch(() => 'system');

    const payload = {
      companyId: data.companyId,
      type: data.type,
      title: data.title,
      startAt: data.startAt,
      endAt: data.endAt,
      status: data.status || 'scheduled',
      createdAt: now,
      createdBy: userId,
      // Optional fields
      ...(data.jobId && { jobId: data.jobId }),
      ...(data.crmJobId && { crmJobId: data.crmJobId }),
      ...(data.assignedToUserId && { assignedToUserId: data.assignedToUserId }),
      ...(data.crewId && { crewId: data.crewId }),
      ...(data.notes && { notes: data.notes }),
    };

    const created = await base44.entities.CalendarEvent.create(payload);
    
    // Log mutation for audit trail
    logCalendarMutation({
      action: 'create',
      eventId: created.id,
      companyId: data.companyId,
      changes: payload,
      userId,
    }).catch(() => {}); // Fire and forget
    
    return created;
  } catch (error) {
    console.error('[calendarEventService] createCalendarEvent error:', error.message);
    throw error;
  }
}

/**
 * Update a CalendarEvent (Phase 3 write)
 * MUST ONLY be called when calendarWriteEnabled === true
 * @param {string} id - CalendarEvent ID
 * @param {Object} patch - Partial update (only safe fields allowed)
 * @returns {Promise<Object|null>} Updated record or null on error
 */
export async function updateCalendarEvent(id, patch) {
  if (!id) {
    console.error('[calendarEventService] updateCalendarEvent: missing id');
    throw new Error('Calendar event ID is required');
  }

  try {
    // Whitelist allowed fields for safety
    const allowedKeys = ['title', 'type', 'startAt', 'endAt', 'status', 'assignedToUserId', 'crewId', 'notes', 'jobId', 'crmJobId'];
    const safePatch = {};

    Object.keys(patch || {}).forEach((key) => {
      if (allowedKeys.includes(key)) {
        safePatch[key] = patch[key];
      }
    });

    if (Object.keys(safePatch).length === 0) {
      console.warn('[calendarEventService] updateCalendarEvent: no safe fields to update');
      return null;
    }

    const updated = await base44.entities.CalendarEvent.update(id, safePatch);

    // Log mutation for audit trail
    logCalendarMutation({
     action: 'update',
     eventId: id,
     companyId: updated?.companyId,
     changes: safePatch,
    }).catch(() => {}); // Fire and forget

    return updated;
    } catch (error) {
    console.error('[calendarEventService] updateCalendarEvent error:', error.message);
    throw error;
    }
    }

/**
 * Delete a CalendarEvent (Phase 3 write)
 * MUST ONLY be called when calendarWriteEnabled === true
 * @param {string} id - CalendarEvent ID
 * @returns {Promise<void>}
 */
export async function deleteCalendarEvent(id) {
  if (!id) {
    console.error('[calendarEventService] deleteCalendarEvent: missing id');
    throw new Error('Calendar event ID is required');
  }

  try {
    await base44.entities.CalendarEvent.delete(id);
    
    // Log mutation for audit trail
    logCalendarMutation({
      action: 'delete',
      eventId: id,
    }).catch(() => {}); // Fire and forget
  } catch (error) {
    console.error('[calendarEventService] deleteCalendarEvent error:', error.message);
    throw error;
  }
}

/**
 * Find active CalendarEvents for a job (READ-ONLY dedupe check)
 * Used to prevent duplicate appointment/install scheduling
 * @param {Object} params
 * @param {string} params.companyId - Company identifier
 * @param {string} params.jobId - Job identifier
 * @param {string} params.type - Event type (appointment/install)
 * @returns {Promise<Array>} Active events of that type for the job
 */
export async function findActiveByJobAndType({ companyId, jobId, type }) {
  if (!companyId || !jobId || !type) {
    return [];
  }

  try {
    const records = await base44.entities.CalendarEvent.filter({
      companyId,
      jobId,
      type,
    });

    if (!Array.isArray(records)) {
      return [];
    }

    // Filter out cancelled events
    return records.filter((event) => event.status !== 'cancelled').slice(0, 50);
  } catch (error) {
    console.warn('[calendarEventService] findActiveByJobAndType error:', error.message);
    return [];
  }
}