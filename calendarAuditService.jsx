/**
 * calendarAuditService.js — Audit logging for CalendarEvent mutations
 * Tracks who changed what when for compliance & debugging
 */

import { base44 } from '@/api/base44Client';

/**
 * Log a calendar event mutation
 * @param {Object} params
 * @param {string} params.action - 'create' | 'update' | 'delete'
 * @param {string} params.eventId - CalendarEvent ID
 * @param {string} params.companyId - Company ID
 * @param {Object} params.changes - Fields changed (for updates)
 * @param {string} params.userId - User who made the change
 * @returns {Promise<void>}
 */
export async function logCalendarMutation({
  action,
  eventId,
  companyId,
  changes = null,
  userId = null,
}) {
  try {
    const user = userId || (await base44.auth.me().then(u => u?.id).catch(() => 'system'));

    const logEntry = {
      action, // 'create', 'update', 'delete'
      eventId,
      companyId,
      userId: user,
      timestamp: new Date().toISOString(),
      changes: action === 'update' ? changes : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    };

    // Log to console for debugging (can integrate with external logging later)
    console.log('[CalendarAudit]', logEntry);

    // Future: Send to external logging service (e.g., Datadog, Sentry, etc.)
    // await externalLogger.log(logEntry);
  } catch (error) {
    console.error('[calendarAuditService] logCalendarMutation error:', error.message);
    // Don't throw - audit logging should never break core functionality
  }
}