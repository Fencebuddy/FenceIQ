import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PHASE 5 — APPOINTMENT TRUTH MIGRATION
 * 
 * Builds canonical appointment truth set V2 from CalendarEvent (primary) with intelligent
 * fallback to CRMJob appointment history when coverage is insufficient.
 * 
 * Truth set includes:
 * - Appointment scheduled (scheduled timestamp + status)
 * - Appointment ran (completed timestamp + duration)
 * - Appointment canceled (canceled timestamp + reason)
 * - Coverage metrics and fallback audit trail
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const companies = await base44.entities.CompanySettings.filter({});
    const companyId = companies[0]?.id;

    if (!companyId) {
      return Response.json({ error: 'No company found' }, { status: 400 });
    }

    // === PHASE 5A: BUILD CALENDAR EVENT TRUTH SET ===
    const calendarTruthSet = await buildCalendarEventTruthSet(base44, companyId);

    // === PHASE 5B: ASSESS COVERAGE & DETERMINE FALLBACK NEED ===
    const coverageAssessment = assessCoverage(calendarTruthSet);

    // === PHASE 5C: BUILD FALLBACK TRUTH SET (if needed) ===
    let fallbackTruthSet = null;
    if (coverageAssessment.needsFallback) {
      fallbackTruthSet = await buildCrmJobFallbackTruthSet(base44, companyId, calendarTruthSet);
    }

    // === PHASE 5D: MERGE & SYNTHESIZE ===
    const appointmentTruthSetV2 = mergeTruthSets(
      calendarTruthSet,
      fallbackTruthSet,
      coverageAssessment
    );

    // === SYNTHESIS ===
    const synthesis = {
      status: 'COMPLETE',
      timestamp: new Date().toISOString(),
      appointmentTruthV2: appointmentTruthSetV2,
      coverage: coverageAssessment,
      fallbackApplied: coverageAssessment.needsFallback,
      fallbackMetrics: fallbackTruthSet?.metrics,
      recommendations: [
        'CalendarEvent is now primary appointment truth source.',
        coverageAssessment.needsFallback 
          ? `${fallbackTruthSet.metrics.jobsCoveredByFallback} jobs recovered via CRMJob fallback.`
          : 'Full coverage achieved from CalendarEvent alone.',
        'Phase 6: Live KPI dashboard with real appointment history.',
        'Consider enabling calendarWriteEnabled in CompanySettings for future appointments.'
      ]
    };

    return Response.json(synthesis);
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});

// ============================================================
// PHASE 5A: BUILD CALENDAR EVENT TRUTH SET
// ============================================================
async function buildCalendarEventTruthSet(base44, companyId) {
  const result = {
    source: 'CalendarEvent',
    totalJobs: 0,
    appointmentsTruthSet: [],
    metrics: {
      jobsWithScheduledAppt: 0,
      jobsWithRanAppt: 0,
      jobsWithCanceledAppt: 0,
      totalAppointments: 0,
      avgDurationMinutes: 0
    },
    errors: []
  };

  try {
    const crmJobs = await base44.entities.CRMJob.filter({ companyId });
    const calendarEvents = await base44.entities.CalendarEvent.filter({ companyId });

    result.totalJobs = crmJobs.length;

    const durations = [];

    for (const job of crmJobs) {
      const jobEvents = calendarEvents.filter(e => e.crmJobId === job.id);

      if (jobEvents.length === 0) continue;

      for (const event of jobEvents) {
        // Only type=appointment events count for truth set
        if (event.type !== 'appointment') continue;

        const appointmentRecord = {
          jobId: job.id,
          jobNumber: job.jobNumber,
          eventId: event.id,
          eventTitle: event.title,
          status: event.status, // scheduled, completed, cancelled
          scheduledAt: event.startAt,
          endAt: event.endAt,
          actualCompletionAt: event.status === 'completed' ? event.endAt : null,
          durationMinutes: calculateDuration(event.startAt, event.endAt),
          assignedRepUserId: event.assignedToUserId,
          notes: event.notes
        };

        // Categorize by status
        if (event.status === 'scheduled') {
          result.metrics.jobsWithScheduledAppt++;
        } else if (event.status === 'completed') {
          result.metrics.jobsWithRanAppt++;
          durations.push(appointmentRecord.durationMinutes);
        } else if (event.status === 'cancelled') {
          result.metrics.jobsWithCanceledAppt++;
        }

        result.appointmentsTruthSet.push(appointmentRecord);
        result.metrics.totalAppointments++;
      }
    }

    // Calculate average duration
    if (durations.length > 0) {
      result.metrics.avgDurationMinutes = Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length
      );
    }

    // Log truth set creation
    await base44.entities.AutoFixLog.create({
      companyId,
      operationType: 'build_appointment_truth_v2',
      confidence: 'VERIFIED',
      reasoning: `Built CalendarEvent-sourced appointment truth set: ${result.metrics.totalAppointments} appointments across ${result.totalJobs} jobs`,
      reversible: false,
      appliedAt: new Date().toISOString()
    });

  } catch (error) {
    result.errors.push(error.message);
  }

  return result;
}

// ============================================================
// PHASE 5B: ASSESS COVERAGE & DETERMINE FALLBACK NEED
// ============================================================
function assessCoverage(calendarTruthSet) {
  const coverageThreshold = 0.85; // 85% coverage threshold

  const coveragePct = calendarTruthSet.totalJobs > 0
    ? (calendarTruthSet.metrics.jobsWithRanAppt + calendarTruthSet.metrics.jobsWithScheduledAppt) / 
      calendarTruthSet.totalJobs
    : 0;

  return {
    totalJobsScanned: calendarTruthSet.totalJobs,
    appointmentsFromCalendar: calendarTruthSet.metrics.totalAppointments,
    jobsWithAppointments: calendarTruthSet.metrics.jobsWithScheduledAppt + 
                          calendarTruthSet.metrics.jobsWithRanAppt + 
                          calendarTruthSet.metrics.jobsWithCanceledAppt,
    coveragePct: Math.round(coveragePct * 10000) / 100, // Two decimal places
    coverageThreshold: coverageThreshold * 100,
    needsFallback: coveragePct < coverageThreshold,
    assessment: coveragePct >= coverageThreshold 
      ? 'SUFFICIENT' 
      : 'INSUFFICIENT - Fallback recommended'
  };
}

// ============================================================
// PHASE 5C: BUILD CRM JOB FALLBACK TRUTH SET
// ============================================================
async function buildCrmJobFallbackTruthSet(base44, companyId, calendarTruthSet) {
  const result = {
    source: 'CRMJob.appointmentStatus (Fallback)',
    totalJobsScanned: 0,
    appointmentsTruthSet: [],
    metrics: {
      jobsCoveredByFallback: 0,
      appointmentsFromFallback: 0
    },
    errors: []
  };

  try {
    const crmJobs = await base44.entities.CRMJob.filter({ companyId });
    const calendarJobIds = new Set(calendarTruthSet.appointmentsTruthSet.map(a => a.jobId));

    result.totalJobsScanned = crmJobs.length;

    for (const job of crmJobs) {
      // Skip jobs already covered by calendar
      if (calendarJobIds.has(job.id)) continue;

      // Check if job has appointment data in CRM
      if (!job.appointmentDateTime || !job.appointmentStatus) continue;

      result.metrics.jobsCoveredByFallback++;

      const appointmentRecord = {
        jobId: job.id,
        jobNumber: job.jobNumber,
        eventId: null, // No calendar event
        source: 'fallback',
        status: mapCrmStatusToCalendarStatus(job.appointmentStatus),
        scheduledAt: job.appointmentDateTime,
        endAt: null, // Not tracked in CRM
        actualCompletionAt: job.appointmentStatus === 'completed' ? job.appointmentDateTime : null,
        durationMinutes: null, // Not available
        assignedRepUserId: job.assignedRepUserId,
        notes: `Recovered from CRMJob.appointmentStatus (${job.appointmentStatus})`
      };

      result.appointmentsTruthSet.push(appointmentRecord);
      result.metrics.appointmentsFromFallback++;
    }

    // Log fallback truth set creation
    if (result.metrics.jobsCoveredByFallback > 0) {
      await base44.entities.AutoFixLog.create({
        companyId,
        operationType: 'build_appointment_truth_fallback',
        confidence: 'MEDIUM',
        reasoning: `Fallback truth set recovered ${result.metrics.appointmentsFromFallback} appointments from CRMJob for ${result.metrics.jobsCoveredByFallback} jobs not in CalendarEvent`,
        reversible: false,
        appliedAt: new Date().toISOString()
      });
    }

  } catch (error) {
    result.errors.push(error.message);
  }

  return result;
}

// ============================================================
// PHASE 5D: MERGE & SYNTHESIZE TRUTH SETS
// ============================================================
function mergeTruthSets(calendarTruthSet, fallbackTruthSet, coverageAssessment) {
  const merged = {
    version: 'appointmentTruthV2',
    totalAppointments: calendarTruthSet.appointmentsTruthSet.length,
    appointmentRecords: [...calendarTruthSet.appointmentsTruthSet]
  };

  if (fallbackTruthSet && fallbackTruthSet.appointmentsTruthSet.length > 0) {
    merged.appointmentRecords.push(...fallbackTruthSet.appointmentsTruthSet);
    merged.totalAppointments += fallbackTruthSet.appointmentsTruthSet.length;
  }

  // Sort by scheduled timestamp
  merged.appointmentRecords.sort((a, b) => 
    new Date(a.scheduledAt) - new Date(b.scheduledAt)
  );

  // Summary by status
  merged.summary = {
    scheduled: merged.appointmentRecords.filter(a => a.status === 'scheduled').length,
    completed: merged.appointmentRecords.filter(a => a.status === 'completed').length,
    cancelled: merged.appointmentRecords.filter(a => a.status === 'cancelled').length,
    fromCalendar: calendarTruthSet.appointmentsTruthSet.length,
    fromFallback: fallbackTruthSet?.appointmentsTruthSet.length || 0
  };

  return merged;
}

// ============================================================
// HELPERS
// ============================================================

function calculateDuration(startAt, endAt) {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt);
  const end = new Date(endAt);
  return Math.round((end - start) / (1000 * 60)); // Minutes
}

function mapCrmStatusToCalendarStatus(crmStatus) {
  const mapping = {
    'scheduled': 'scheduled',
    'rescheduled': 'scheduled',
    'completed': 'completed',
    'cancelled': 'cancelled'
  };
  return mapping[crmStatus] || crmStatus;
}