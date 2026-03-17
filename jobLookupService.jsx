/**
 * jobLookupService.js — Read-only Job search for calendar scheduling
 * Phase 3: Lookup jobs for appointment/production scheduling
 */

import { base44 } from '@/api/base44Client';

/**
 * Search jobs by customer name or address
 * Fallback: fetch recent jobs then local filter if backend search unavailable
 * @param {Object} params
 * @param {string} params.companyId - Company identifier
 * @param {string} params.q - Search query (customer name or address)
 * @param {number} params.limit - Max results (default 20)
 * @returns {Promise<Array>} Array of job summaries
 */
export async function searchJobs({ companyId, q, limit = 20 }) {
  if (!companyId) {
    console.error('[jobLookupService] searchJobs: missing companyId');
    return [];
  }

  try {
    // Attempt server-side filter (may support partial search)
    // If not, fetch recent jobs and filter locally
    const query = q?.toLowerCase().trim() || '';

    // Fetch recent jobs scoped to company (limit to 200 for local filter)
    const allJobs = await base44.entities.Job.filter(
      { companyId },
      '-created_date', // Most recent first
      200
    );

    if (!Array.isArray(allJobs)) {
      return [];
    }

    // Local filter on customerName and address fields
    const filtered = allJobs
      .filter((job) => {
        if (!query) return true; // No query = return all
        const nameMatch = job.customerName?.toLowerCase().includes(query);
        const addressMatch = [job.addressLine1, job.city, job.state]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
        return nameMatch || addressMatch;
      })
      .slice(0, limit)
      .map((job) => ({
        id: job.id,
        customerName: job.customerName,
        customerPhone: job.customerPhone,
        customerEmail: job.customerEmail,
        addressLine1: job.addressLine1,
        city: job.city,
        state: job.state,
        zip: job.zip,
        address_full: job.address_full,
        status: job.status,
        jobNumber: job.jobNumber,
      }));

    return filtered;
  } catch (error) {
    console.warn('[jobLookupService] searchJobs error:', error.message);
    return [];
  }
}

/**
 * Get a single job by ID
 * @param {string} jobId - Job identifier
 * @returns {Promise<Object|null>} Job summary or null
 */
export async function getJobById(jobId) {
  if (!jobId) return null;

  try {
    const job = await base44.entities.Job.read(jobId);
    if (!job) return null;

    return {
      id: job.id,
      customerName: job.customerName,
      customerPhone: job.customerPhone,
      customerEmail: job.customerEmail,
      addressLine1: job.addressLine1,
      city: job.city,
      state: job.state,
      zip: job.zip,
      address_full: job.address_full,
      status: job.status,
      jobNumber: job.jobNumber,
    };
  } catch (error) {
    console.warn('[jobLookupService] getJobById error:', error.message);
    return null;
  }
}

/**
 * Sync check if job is Sold
 * @param {Object} job - Job object
 * @returns {boolean} true if job.status === 'Sold'
 */
export function isJobSoldSync(job) {
  return (job?.status || '').trim().toLowerCase() === 'sold';
}

/**
 * Async check if job is Sold (handles object or ID)
 * @param {Object|string} jobOrId - Job object or job ID
 * @returns {Promise<boolean>} true if job.status === 'Sold'
 */
export async function isJobSold(jobOrId) {
  if (!jobOrId) return false;

  // Object path: use sync check
  if (typeof jobOrId === 'object') {
    return isJobSoldSync(jobOrId);
  }

  // String ID path: fetch and check
  if (typeof jobOrId === 'string') {
    const fetched = await getJobById(jobOrId);
    return isJobSoldSync(fetched);
  }

  return false;
}