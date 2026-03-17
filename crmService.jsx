/**
 * CRM Service
 * 
 * Job-centric CRM helper functions for:
 * - Creating/linking CRMJob records
 * - Emitting activity events
 * - Managing stage transitions
 * 
 * CRITICAL: All functions check CompanySettings.crmEnabled
 * If false, functions return early without creating CRM records
 */

import { base44 } from '@/api/base44Client';

/**
 * Check if CRM is enabled for the company
 */
async function isCRMEnabled() {
    try {
        const settings = await base44.entities.CompanySettings.filter({});
        return settings.length > 0 && settings[0].crmEnabled === true;
    } catch (e) {
        console.warn('[CRM] Failed to check CRM status:', e);
        return false;
    }
}

/**
 * Get or create CRMJob for an existing Job entity
 * 
 * @param {string} externalJobId - The existing Job.id
 * @param {string} companyId - CompanySettings ID
 * @param {object} defaults - Default values for CRMJob creation
 * @returns {Promise<object|null>} CRMJob or null if CRM disabled
 */
export async function getOrCreateCRMJobForExternalJob(externalJobId, companyId, defaults = {}) {
    const enabled = await isCRMEnabled();
    if (!enabled) {
        console.log('[CRM] CRM disabled, skipping CRMJob creation');
        return null;
    }

    try {
        // Check if CRMJob already exists
        const existing = await base44.entities.CRMJob.filter({
            companyId,
            externalJobId
        });

        if (existing.length > 0) {
            console.log('[CRM] Found existing CRMJob:', existing[0].id);
            return existing[0];
        }

        // Fetch the external Job to get details
        const jobs = await base44.entities.Job.filter({ id: externalJobId });
        if (jobs.length === 0) {
            console.warn('[CRM] External job not found:', externalJobId);
            return null;
        }
        const job = jobs[0];

        // Create new CRMJob
        const crmJob = await base44.entities.CRMJob.create({
            companyId,
            externalJobId,
            jobNumber: job.jobNumber || defaults.jobNumber || `FB-${Date.now()}`,
            stage: 'new',
            status: 'open',
            lastActivityAt: new Date().toISOString(),
            fenceCategory: mapMaterialTypeToCategory(job.materialType),
            ...defaults
        });

        console.log('[CRM] Created CRMJob:', crmJob.id);

        // Emit job_created event
        await emitEvent(crmJob.id, 'job_created', null, {
            externalJobId,
            jobNumber: crmJob.jobNumber
        });

        return crmJob;
    } catch (error) {
        console.error('[CRM] Failed to get/create CRMJob:', error);
        return null;
    }
}

/**
 * Emit CRM activity event
 * 
 * @param {string} crmJobId - CRMJob ID
 * @param {string} type - Event type
 * @param {string|null} actorUserId - User ID who triggered event
 * @param {object} metadata - Event metadata
 * @returns {Promise<object|null>} Created event or null
 */
export async function emitEvent(crmJobId, type, actorUserId, metadata = {}) {
    const enabled = await isCRMEnabled();
    if (!enabled) {
        return null;
    }

    try {
        // Get CRMJob to get companyId
        const crmJobs = await base44.entities.CRMJob.filter({ id: crmJobId });
        if (crmJobs.length === 0) {
            console.warn('[CRM] CRMJob not found for event:', crmJobId);
            return null;
        }
        const crmJob = crmJobs[0];

        const occurredAt = new Date().toISOString();

        // Create event
        const event = await base44.entities.CRMActivityEvent.create({
            companyId: crmJob.companyId,
            jobId: crmJobId,
            type,
            actorUserId,
            occurredAt,
            metadata
        });

        // Update lastActivityAt on CRMJob
        await base44.entities.CRMJob.update(crmJobId, {
            lastActivityAt: occurredAt
        });

        console.log('[CRM] Emitted event:', type, 'for job:', crmJobId);
        return event;
    } catch (error) {
        console.error('[CRM] Failed to emit event:', error);
        return null;
    }
}

/**
 * Set stage on CRMJob and create history record
 * 
 * @param {string} crmJobId - CRMJob ID
 * @param {string} toStage - New stage
 * @param {string|null} actorUserId - User making the change
 * @param {string} note - Optional note
 * @returns {Promise<boolean>} Success
 */
export async function setStage(crmJobId, toStage, actorUserId, note = '') {
    const enabled = await isCRMEnabled();
    if (!enabled) {
        return false;
    }

    try {
        // Get current CRMJob
        const crmJobs = await base44.entities.CRMJob.filter({ id: crmJobId });
        if (crmJobs.length === 0) {
            console.warn('[CRM] CRMJob not found:', crmJobId);
            return false;
        }
        const crmJob = crmJobs[0];
        const fromStage = crmJob.stage;

        // No change
        if (fromStage === toStage) {
            console.log('[CRM] Stage unchanged:', toStage);
            return true;
        }

        const changedAt = new Date().toISOString();

        // Create history record
        await base44.entities.CRMJobStageHistory.create({
            companyId: crmJob.companyId,
            jobId: crmJobId,
            fromStage,
            toStage,
            changedByUserId: actorUserId,
            changedAt,
            note
        });

        // Update CRMJob stage
        await base44.entities.CRMJob.update(crmJobId, {
            stage: toStage,
            lastActivityAt: changedAt
        });

        console.log('[CRM] Stage changed:', fromStage, '->', toStage);

        // Emit corresponding event (if applicable)
        const eventType = mapStageToEventType(toStage);
        if (eventType) {
            await emitEvent(crmJobId, eventType, actorUserId, {
                fromStage,
                toStage
            });
        }

        return true;
    } catch (error) {
        console.error('[CRM] Failed to set stage:', error);
        return false;
    }
}

/**
 * Helper: Map materialType to fenceCategory
 */
function mapMaterialTypeToCategory(materialType) {
    if (!materialType) return null;
    const upper = materialType.toUpperCase();
    if (upper === 'CHAIN LINK') return 'chainlink';
    if (upper === 'VINYL') return 'vinyl';
    if (upper === 'WOOD') return 'wood';
    if (upper === 'ALUMINUM') return 'aluminum';
    return null;
}

/**
 * Helper: Map stage to event type
 */
function mapStageToEventType(stage) {
    const map = {
        'mapped': 'map_created',
        'takeoff_ready': 'takeoff_created',
        'job_cost_ready': 'job_cost_viewed',
        'presenting': 'present_price_viewed',
        'proposal_sent': 'proposal_sent',
        'signed': 'proposal_signed'
    };
    return map[stage] || null;
}

export default {
    getOrCreateCRMJobForExternalJob,
    emitEvent,
    setStage
};