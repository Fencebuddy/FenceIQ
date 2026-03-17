/**
 * EventMapper.js - Strict date validation & event extraction from CRMJob records
 * READ-ONLY: Extracts calendar events from existing data without modification
 */

/**
 * Validates date value strictly
 * - Must parse successfully
 * - Year must be 2000-2100
 * - No epoch (Jan 1 1970)
 * - No null/empty strings
 */
export const isValidDate = (value) => {
  if (!value || typeof value !== 'string') return false;
  
  const timestamp = Date.parse(value);
  if (isNaN(timestamp)) return false;
  
  const date = new Date(timestamp);
  const year = date.getFullYear();
  
  // Reject epoch
  if (timestamp === 0 || year === 1970) return false;
  
  // Accept only 2000-2100
  return year >= 2000 && year <= 2100;
};

/**
 * Extracts appointment events from CRMJob
 * Priority: appointmentDateTime (explicit field)
 */
export const extractAppointmentEvent = (crmJob) => {
  if (!crmJob?.id) return null;
  
  // Primary field: appointmentDateTime
  if (isValidDate(crmJob.appointmentDateTime)) {
    const startAt = new Date(crmJob.appointmentDateTime);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // 1 hour default
    
    return {
      id: `appt-${crmJob.id}`,
      title: crmJob.customerName || `Appointment #${crmJob.jobNumber}`,
      startAt,
      endAt,
      type: 'appointment',
      jobId: crmJob.externalJobId,
      crmJobId: crmJob.id,
      status: crmJob.appointmentStatus || 'scheduled',
      meta: {
        jobNumber: crmJob.jobNumber,
        stage: crmJob.stage,
      },
    };
  }
  
  return null;
};

/**
 * Extracts production/install events from CRMJob
 * Priority: installScheduledAt, then installCompletedAt
 */
export const extractProductionEvent = (crmJob) => {
  if (!crmJob?.id) return null;
  
  let startAt = null;
  let endAt = null;
  let status = null;
  
  // Primary: scheduled install
  if (isValidDate(crmJob.installScheduledAt)) {
    startAt = new Date(crmJob.installScheduledAt);
    status = 'scheduled';
  }
  // Fallback: completed install
  else if (isValidDate(crmJob.installCompletedAt)) {
    startAt = new Date(crmJob.installCompletedAt);
    status = 'completed';
  }
  
  if (!startAt) return null;
  
  // End time: add 3 hours (typical installation duration)
  endAt = new Date(startAt.getTime() + 3 * 60 * 60 * 1000);
  
  return {
    id: `prod-${crmJob.id}`,
    title: crmJob.customerName || `Install #${crmJob.jobNumber}`,
    startAt,
    endAt,
    type: 'production',
    jobId: crmJob.externalJobId,
    crmJobId: crmJob.id,
    status,
    installStage: crmJob.installStage,
    meta: {
      jobNumber: crmJob.jobNumber,
      stage: crmJob.stage,
      installStage: crmJob.installStage,
    },
  };
};

/**
 * Maps array of CRMJob records to calendar events by tab
 */
export const mapCRMJobsToEvents = (crmJobs = []) => {
  const appointments = [];
  const production = [];
  
  crmJobs.forEach((job) => {
    const apptEvent = extractAppointmentEvent(job);
    if (apptEvent) appointments.push(apptEvent);
    
    const prodEvent = extractProductionEvent(job);
    if (prodEvent) production.push(prodEvent);
  });
  
  return { appointments, production };
};

/**
 * Groups events by date for list/day view
 */
export const groupEventsByDate = (events = []) => {
  const grouped = {};
  
  events.forEach((event) => {
    const dateKey = event.startAt.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(event);
  });
  
  return grouped;
};