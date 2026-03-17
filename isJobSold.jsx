/**
 * isJobSold.js — Sold status checking utilities
 * Sync path for objects (no race conditions)
 * Async path for string IDs (fallback)
 */

/**
 * Check if job is Sold (synchronous, no async)
 * Use this when you already have the job object
 * @param {Object} job - Job object
 * @returns {boolean} true if job.status === 'Sold'
 */
export function isJobSoldSync(job) {
  return (job?.status || '').trim().toLowerCase() === 'sold';
}

/**
 * Check if job is Sold (handles both object and ID)
 * @param {Object|string} jobOrId - Job object or job ID
 * @param {Function} getJobById - Optional getter function for ID path
 * @returns {Promise<boolean>} true if job.status === 'Sold'
 */
export async function isJobSold(jobOrId, getJobById = null) {
  if (!jobOrId) return false;
  
  // Object path: sync, no async
  if (typeof jobOrId === 'object') {
    return isJobSoldSync(jobOrId);
  }
  
  // String ID path: fetch async
  if (typeof jobOrId === 'string' && getJobById) {
    const fetched = await getJobById(jobOrId);
    return isJobSoldSync(fetched);
  }
  
  return false;
}