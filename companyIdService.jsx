/**
 * COMPANY ID RESOLUTION SERVICE
 * Single source of truth for deriving companyId across the app
 */

export function getActiveCompanyId({ job, companySettings }) {
  // Strongest signal: job is explicitly assigned to a company
  if (job?.companyId) {
    return job.companyId;
  }

  // Second: CompanySettings.companyId (if stored)
  if (companySettings?.companyId) {
    return companySettings.companyId;
  }

  // Third: CompanySettings.id (if that's what's used as identifier)
  if (companySettings?.id) {
    return companySettings.id;
  }

  // Missing company ID - return null for explicit error handling
  return null;
}

/**
 * Create structured error state when companyId is missing
 */
export function createMissingCompanyIdError() {
  return {
    pricingStatus: 'INCOMPLETE',
    blockedReasons: [
      {
        code: 'NO_COMPANY_ID',
        message: 'Company not configured for this job',
        actionHint: 'Ensure job is assigned to a company in Company Settings',
        severity: 'BLOCKING'
      }
    ],
    resolved_items: [],
    unresolved_items: [],
    status: 'INCOMPLETE'
  };
}