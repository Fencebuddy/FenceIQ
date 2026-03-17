# Calendar Scheduling Wiring — Phase 3 Implementation

## Overview

Phase 3 enables scheduling of Jobs into CalendarEvents with two primary flows:

1. **Manual Scheduling**: User selects a Job and creates an appointment/install event
2. **Quick Schedule**: From EventDrawer, user creates an event directly for the displayed job

All scheduling is **feature-flagged** by `CompanySettings.calendarWriteEnabled`.

## Architecture

### Read-Only Job Lookup

**File**: `components/services/jobLookupService.js`

Exports:
- `searchJobs({ companyId, q, limit })` — Search jobs by customer name or address
  - Returns: array of job summaries with id, customerName, address fields, status
  - Fallback: fetches recent jobs (max 200) then filters locally if needed
- `getJobById(jobId)` — Get single job details
- `isJobSold(job)` — Check if `job.status === 'Sold'`

**Key**: All functions are READ-ONLY. Zero writes to Job entity.

### CalendarEvent Write Service

**File**: `components/services/calendarEventService.js`

Existing functions (Phase 2):
- `listByCompanyRange()` — List events in date range
- `createCalendarEvent(payload)` — Create new event
- `updateCalendarEvent(id, patch)` — Update event (whitelist-only fields)
- `deleteCalendarEvent(id)` — Delete event

**New Phase 3 helper**:
- `findActiveByJobAndType({ companyId, jobId, type })` — Read-only dedupe check
  - Returns array of active (non-cancelled) events for job+type combo
  - Used to prevent duplicate appointment/install scheduling

### Create Event Modal

**File**: `components/calendar/CreateEventModal.jsx`

Features:
- Job selector with search (uses jobLookupService)
- Event type selector (appointment/install/followup/service)
- **Sold gating**: Install option disabled unless `selectedJob.status === 'Sold'`
- Title auto-fill: `${customerName} — ${eventType}`
- Start/end datetime pickers
- Status, notes, optional assignedToUserId/crewId
- **Dedupe precheck**: Before create, checks for existing active event of same type+job
  - If found: shows error toast, prevents duplicate
  - If missing: creates new CalendarEvent

**Feature gating**:
- Modal renders ONLY if `writeEnabled === true`

### Event Drawer Quick Schedule

**File**: `components/calendar/EventDrawerEdit.jsx`

When displaying a calendar event linked to a Job:
- Shows customer summary (name, address, phone, email)
- Deep-link buttons (JobDetail, Pricing, Proposal)
- **If `writeEnabled === true`**:
  - "Schedule Appointment" button — opens CreateEventModal pre-filled with:
    - selectedJob = current job
    - type = appointment
    - title auto-filled
  - "Schedule Production" button — visible ONLY if `job.status === 'Sold'`
    - Opens CreateEventModal pre-filled with type=install

**Legacy event rule**:
- If event source is NOT 'calendarEvent' (e.g., legacy CRMJob), no quick schedule buttons

## Sold Gating Rule

**Purpose**: Ensure production/install scheduling only happens for jobs that are contractually sold.

**Implementation**:
1. When user selects a Job in CreateEventModal, check `isJobSold(selectedJob)`
2. If scheduling type=install and job is NOT sold:
   - Disable install option in dropdown
   - Show label: "Install (Requires Sold Job)"
   - If user tries to submit: validation error "Install scheduling requires a Sold job"
3. If job IS sold: install option enabled normally

**Constraint**: Do NOT modify Job.status or any workflow logic. Only READ job.status.

## Dedupe Behavior

**Purpose**: Prevent accidental duplicate appointment/install scheduling.

**Flow**:
1. User fills form (job + type + times)
2. Before creating: call `findActiveByJobAndType({ companyId, jobId, type })`
3. If existing active event found:
   - Error toast: "An active {type} is already scheduled for this job. Open it instead."
   - Do NOT create
   - User can dismiss modal and select the existing event instead
4. If no existing event: proceed with create

**Note**: This is a UX safety net. Cancelled events are excluded (don't block new creates).

## CalendarEvent Payload

When creating a scheduled event:

```javascript
{
  companyId: "string",      // Required
  jobId: "string",          // Required (job being scheduled)
  type: "appointment" | "install" | "followup" | "service",
  title: "string",          // Auto-filled or user-edited
  startAt: "ISO8601",       // Required
  endAt: "ISO8601",         // Required
  status: "scheduled" | "completed" | "cancelled", // Default: scheduled
  notes: "string",          // Optional
  assignedToUserId: "string", // Optional
  crewId: "string",         // Optional
}
```

**Auto-populated on create**:
- createdAt = now (ISO)
- createdBy = current user id or 'system'

## Feature Flag

**Setting**: `CompanySettings.calendarWriteEnabled`

Behavior:
- If `true`: Full write UI available (create, edit, delete buttons)
- If `false` or undefined: ZERO write UI rendered, ZERO reachable mutation paths

**When disabled**:
- Calendar page still loads and displays events
- EventDrawer shows read-only view
- No "Schedule" buttons visible
- No CreateEventModal rendered
- grep `createCalendarEvent|updateCalendarEvent|deleteCalendarEvent` in calendar code should return ZERO results in execution paths

## No Writes to Job/CRMJob

**Hard constraint**: Scheduling does NOT modify Job or CRMJob entities.

- Job.status remains unchanged; used READ-ONLY for sold gating
- No automation or webhooks to update job status on scheduling
- No cascade updates or backfills
- All scheduling happens strictly in CalendarEvent entity

## Testing Verification

### Scenario: Schedule Appointment for Any Job
1. Open calendar, click "New" (if writeEnabled=true)
2. Search and select a job (any status)
3. Type = appointment
4. Fill times and save
5. **Result**: CalendarEvent created, type=appointment, linked to job

### Scenario: Schedule Production (Install) for Sold Job
1. Open calendar, click "New"
2. Search and select a job with status=Sold
3. Type dropdown shows: "Installation (Production)" enabled
4. Fill times and save
5. **Result**: CalendarEvent created, type=install, linked to sold job

### Scenario: Block Production for Unsold Job
1. Open calendar, click "New"
2. Search and select a job with status != Sold
3. Type dropdown shows: "Installation (Requires Sold Job)" disabled
4. Try to force submit: validation error
5. **Result**: No event created, error toast shown

### Scenario: Dedupe Prevention
1. Job already has an active appointment scheduled
2. Open "New" modal, select same job, type=appointment
3. Before save: dedupe check finds existing appointment
4. **Result**: Error toast "An active appointment is already scheduled..."

### Scenario: Feature Flag Disabled
1. Set `CompanySettings.calendarWriteEnabled = false`
2. Open calendar page
3. **Result**: No "New" button, no schedule buttons in drawer, no mutations reachable

## Grep Validation

Verify zero forbidden writes:

```bash
# Check: No Job writes in calendar code
grep -r "Job.*\.create\|Job.*\.update" pages/Calendar.jsx components/calendar/ components/services/calendarEventService.js
# Expected: ZERO matches

# Check: No CRMJob writes
grep -r "CRMJob.*\.create\|CRMJob.*\.update" pages/Calendar.jsx components/calendar/
# Expected: ZERO matches

# Check: Only CalendarEvent writes
grep -r "base44.entities.*\.create\|\.update\|\.delete" components/services/calendarEventService.js
# Expected: Only CalendarEvent.{create,update,delete}

# Check: jobLookupService is read-only
grep -r "create\|update\|delete" components/services/jobLookupService.js
# Expected: ZERO entity mutation calls
```

## Summary

Phase 3 scheduling:
- ✅ Read-only job lookup + search
- ✅ Create appointment/install events linked to jobs
- ✅ Sold gating: install only for sold jobs
- ✅ Dedupe precheck: prevent duplicate scheduling
- ✅ Quick schedule from EventDrawer
- ✅ Feature-flagged by calendarWriteEnabled
- ✅ Zero writes to Job/CRMJob
- ✅ CalendarEvent-only mutations
- ✅ No changes to Create→Sold workflow spine