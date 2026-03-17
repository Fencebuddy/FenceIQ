# Calendar Phase 3 — Verification Checklist

## Manual Verification Steps (Part 1: Core Reads/Writes)

### 1. Feature Flags (calendarWriteEnabled)
- [ ] `CompanySettings.calendarEnabled = false`:
  - Calendar link hidden from navigation (Phase 1 behavior)
  - Direct URL access renders safely
  - Create/edit UI does NOT render

- [ ] `CompanySettings.calendarEnabled = true` AND `calendarWriteEnabled = false`:
  - Calendar page visible
  - No create button in header
  - No edit button in EventDrawer
  - No drag/drop on events
  - Console: verify zero mutation calls attempted

- [ ] `CompanySettings.calendarEnabled = true` AND `calendarWriteEnabled = true`:
  - Create button visible in calendar header ("New" button)
  - Create modal opens when clicked
  - EventDrawer shows "Edit" button for CalendarEvent-source events only
  - Legacy events show "read-only" label
  - Drag cursor changes for CalendarEvent events (grab icon)

### 2. Create Event Behavior
- [ ] Create modal appears with fields:
  - Type (appointment/install/followup/service)
  - Title
  - Start date/time
  - End date/time
  - Status (scheduled/completed/cancelled)
  - Notes (optional)

- [ ] On save:
  - CalendarEvent record created in database
  - Success toast shown
  - Modal closes
  - Calendar refreshes (query invalidated)

- [ ] Validation:
  - Title required
  - End time > start time enforced
  - Error toast on validation failure

### 3. Edit Event Behavior (CalendarEvent Source Only)
- [ ] Open EventDrawer for CalendarEvent event:
  - "Edit" button visible (Phase 3 enabled)
  - Click Edit to toggle inline edit mode
  - Fields become editable:
    - Title, type, startAt, endAt, status, notes

- [ ] Save edit:
  - PATCH sent to CalendarEvent.update (id + safe fields only)
  - No fields written except: title, type, startAt, endAt, status, notes, jobId, crmJobId, assignedToUserId, crewId
  - Success toast shown
  - Calendar refreshed
  - EventDrawer closes

- [ ] Delete button:
  - Visible in edit mode
  - Confirmation dialog before delete
  - CalendarEvent.delete called
  - Calendar refreshed

- [ ] Legacy event (source !== 'calendarEvent'):
  - Shows "read-only" warning banner
  - No "Edit" button
  - Cannot edit/delete

### 4. Read-Only Enforcement
- [ ] With `calendarWriteEnabled = false`:
  - No create/edit UI rendered
  - No drag/drop bindings
  - Verify with: `grep -r "createCalendarEvent\|updateCalendarEvent\|deleteCalendarEvent" pages/Calendar.jsx components/calendar/*.jsx`
    - Should return ZERO matches in execution paths (only in gated components)

- [ ] With `calendarWriteEnabled = true`:
  - Only CalendarEvent source events are editable/draggable
  - Legacy events remain 100% read-only
  - Deep-link buttons (JobDetail, Pricing, Proposal) still work for both sources

### 5. No Forbidden Writes
- [ ] Verify ZERO writes to non-CalendarEvent entities:
  ```bash
  grep -r "Job.*\.create\|Job.*\.update\|CRMJob.*\.create\|CRMJob.*\.update" \
    pages/Calendar.jsx components/calendar/ components/services/calendarEventService.js
  ```
  Should return **ZERO** matches.

- [ ] Verify CompanySettings never written in Phase 3:
  ```bash
  grep -r "CompanySettings.*\.create\|CompanySettings.*\.update" \
    pages/Calendar.jsx components/calendar/
  ```
  Should return **ZERO** matches.

### 6. No Breaking Changes to Create→Sold
- [ ] Create→Sold pages untouched:
  - NewJob, JobDetail, EditJob, PricingIntelligence, Present, Proposal, Signature
  - Verify no imports from calendar components
  - Verify no workflow changes

- [ ] Layout.js routing unchanged:
  - createPageUrl() still works for all pages
  - No new routes added
  - Navigation hierarchy unchanged

- [ ] Job/CRMJob schemas untouched:
  - No new fields added
  - No backfill logic
  - Read-only queries from calendar do not trigger side effects

### 7. Error Handling
- [ ] Network error creating event:
  - Error toast shown
  - Modal stays open
  - User can retry
  - No white-screen

- [ ] CalendarEvent entity missing/undeployed:
  - Create button still renders (if writeEnabled=true)
  - Error caught and toasted when user tries to create
  - Calendar continues to show legacy events fallback

- [ ] Invalid date range on edit:
  - Validation: endAt > startAt
  - Error toast: "End time must be after start time"
  - Modal remains open

## Test Scenarios

### Scenario A: Phase 3 Disabled
1. Set `companySettings.calendarWriteEnabled = false` (or omit field)
2. Open Calendar page
3. **Expected**: No create/edit buttons, no drag/drop, calendar read-only

### Scenario B: Create New Event
1. Set `calendarWriteEnabled = true`
2. Click "New" button in calendar header
3. Fill form and save
4. **Expected**: CalendarEvent record created, calendar refreshed, event appears

### Scenario C: Edit CalendarEvent
1. Open calendar event (must be CalendarEvent source)
2. Click "Edit" button in drawer
3. Change title and time
4. Click "Save"
5. **Expected**: CalendarEvent updated, drawer closes, calendar refreshed

### Scenario D: Legacy Event Read-Only
1. Open legacy CRMJob-derived event in drawer
2. **Expected**: "read-only" banner shown, no edit button visible

### Scenario E: Delete Event
1. In EventDrawer edit mode, click trash icon
2. Confirm delete dialog
3. **Expected**: CalendarEvent deleted, calendar refreshed, drawer closes

## Grep Validation

Run these to verify safety:

```bash
# Check for forbidden writes (should all return ZERO)
grep -r "Job.*create\|Job.*update\|CRMJob.*create" pages/Calendar.jsx components/calendar/ functions/

# Check calendarEventService writes only to CalendarEvent
grep -r "base44.entities.*create\|update\|delete" components/services/calendarEventService.js | grep -v CalendarEvent

# Check for CompanySettings writes
grep -r "CompanySettings.*create\|CompanySettings.*update" pages/Calendar.jsx components/calendar/

# Check EventDrawer imports (should not import from workflow pages)
grep -r "NewJob\|JobDetail\|EditJob\|Pricing\|Proposal\|Signature" components/calendar/EventDrawerEdit.jsx
```

All should return **ZERO** matches (or only legitimate references).

## Manual Verification Steps (Part 2: Scheduling Wiring)

### 8. Job Search (Read-Only)
- [ ] Open CreateEventModal and click job search
- [ ] Type customer name: results appear (service jobLookupService)
- [ ] Type address: results appear
- [ ] Results show: customerName, address_full, status
- [ ] Select a job: modal fills with job data
- [ ] Verify ZERO Job entity mutations (grep Job.create/update in jobLookupService.js → ZERO)

### 9. Schedule Appointment (Any Job)
- [ ] Select any job (any status)
- [ ] Type = appointment
- [ ] Title auto-fills: "${customerName} — Appointment"
- [ ] Edit title, set times, save
- [ ] Expected: CalendarEvent created with type=appointment, jobId linked

### 10. Schedule Production (Sold Job Only)
- [ ] Select a job with status=Sold
- [ ] Type dropdown shows: "Installation (Production)"
- [ ] Click it, fill times, save
- [ ] Expected: CalendarEvent created with type=install

### 11. Block Production (Unsold Job)
- [ ] Select a job with status != Sold (e.g., Draft, Sent to Office)
- [ ] Type dropdown shows: "Installation (Requires Sold Job)" **disabled**
- [ ] Try to force submit: validation error "Install scheduling requires a Sold job"
- [ ] Expected: No event created

### 12. Dedupe Prevention
- [ ] Create an appointment for Job A
- [ ] Open CreateEventModal again
- [ ] Select Job A, type = appointment
- [ ] On submit: toast "An active appointment is already scheduled for this job"
- [ ] Expected: No duplicate created

### 13. Quick Schedule from EventDrawer
- [ ] Open EventDrawer for a calendar event with jobId
- [ ] Customer info displays: name, address, phone, email
- [ ] Deep-link buttons work: JobDetail, Pricing, Proposal
- [ ] If writeEnabled=true:
  - [ ] "Schedule Appointment" button visible
  - [ ] Click → CreateEventModal opens with:
    - [ ] Job pre-selected
    - [ ] Type = appointment
    - [ ] Title auto-filled
- [ ] If job is Sold:
  - [ ] "Schedule Production" button visible (green)
  - [ ] Click → CreateEventModal opens with type=install
- [ ] If job is NOT Sold:
  - [ ] "Schedule Production" button hidden or disabled
  - [ ] Message: "Production scheduling available once job is Sold"

### 14. Legacy Event Read-Only
- [ ] Open EventDrawer for legacy (CRMJob) event
- [ ] No "Schedule Appointment" or "Schedule Production" buttons
- [ ] Only navigation buttons (JobDetail, Pricing, Proposal)

### 15. Feature Flag Disabled
- [ ] Set CompanySettings.calendarWriteEnabled = false
- [ ] Open calendar
- [ ] No "New" button in header
- [ ] No schedule buttons in EventDrawer
- [ ] grep for mutation calls: ZERO reachable paths

## Grep Validation (Comprehensive)

```bash
# Part 1: Zero Job/CRMJob writes
grep -r "base44.entities.Job.*\.create\|base44.entities.Job.*\.update" pages/Calendar.jsx components/calendar/ components/services/calendarEventService.js
# Expected: ZERO

grep -r "base44.entities.CRMJob.*\.create\|base44.entities.CRMJob.*\.update" pages/Calendar.jsx components/calendar/
# Expected: ZERO

# Part 2: jobLookupService is read-only
grep -r "\.create\|\.update\|\.delete" components/services/jobLookupService.js
# Expected: ZERO entity mutation calls

# Part 3: Only CalendarEvent writes exist
grep -r "base44.entities.*\.create\|\.update\|\.delete" components/services/calendarEventService.js components/calendar/
# Expected: Only CalendarEvent.create, CalendarEvent.update, CalendarEvent.delete

# Part 4: Confirm Sold gating logic
grep -r "status.*===.*Sold\|isJobSold" components/calendar/CreateEventModal.jsx components/calendar/EventDrawerEdit.jsx
# Expected: Multiple matches for sold checks (validation)

# Part 5: Confirm dedupe logic exists
grep -r "findActiveByJobAndType" components/calendar/CreateEventModal.jsx
# Expected: Exactly 1 match (dedupe check before create)

# Part 6: Verify CreateEventModal is gated
grep -r "writeEnabled" pages/Calendar.jsx
# Expected: Checks before rendering CreateEventModal

# Part 7: Verify no Create→Sold page imports
grep -r "NewJob\|EditJob\|JobDetail\|Pricing\|Present\|Proposal\|Signature" components/calendar/
# Expected: ZERO matches (calendar is isolated)
```

## Summary

Phase 3 implementation (Complete):
- ✅ Write mode ONLY when `calendarWriteEnabled === true`
- ✅ ONLY CalendarEvent entity writes (create, update, delete)
- ✅ CalendarEvent-specific edits + delete
- ✅ Legacy events remain read-only forever
- ✅ Job search (read-only) for scheduling
- ✅ Sold gating: install requires Job.status === 'Sold'
- ✅ Dedupe precheck: prevent duplicate appointment/install
- ✅ Quick schedule from EventDrawer
- ✅ Zero writes to Job, CRMJob, or other forbidden entities
- ✅ Zero changes to Create→Sold pages, Layout routing, or routing utilities
- ✅ Error handling with toasts, no crashes
- ✅ Feature-flagged by CompanySettings.calendarWriteEnabled