/**
 * upsertCrmJob.js — Centralized CRMJob write enforcing customerName invariant
 * Single approved code path for all CRMJob create/update operations
 * Ensures multi-tenant safety, deterministic naming, and idempotency
 */

import { computeCustomerName, safeText, isPlaceholderCustomerName } from "../_shared/computeCustomerName.js";

export async function upsertCrmJob({ base44, tenantId, patch, mode = "unknown" }) {
  if (!base44) throw new Error("base44 SDK required");
  if (!tenantId) throw new Error("tenantId (canonical CompanySettings.id) required");
  if (!patch || typeof patch !== "object") throw new Error("patch object required");

  // Multi-tenant invariant: force patch.companyId to match tenantId
  const normalized = { ...patch };
  
  // CRITICAL: Enforce canonical scope
  const incomingCompanyId = patch.companyId;
  normalized.companyId = tenantId;
  
  if (incomingCompanyId && incomingCompanyId !== tenantId) {
    console.warn("[CRMJOB_SCOPE] overwriting companyId to tenantId", {
      incoming: incomingCompanyId,
      tenantId,
      mode
    });
  }

  // Enforce deterministic customerName (never null/empty/placeholder after this)
  const incomingCustomerName = patch.customerName;
  
  // Sanitize incoming customerName: drop if it's a placeholder
  const sanitizationNeeded = incomingCustomerName && isPlaceholderCustomerName(incomingCustomerName);
  const sanitizedPatch = sanitizationNeeded ? { ...patch, customerName: null } : patch;
  
  if (!safeText(normalized.customerName)) {
    // Attempt to backfill from linked entities
    let candidateName = computeCustomerName(sanitizedPatch);
    
    // Try linked CRMContact first
    if (candidateName === "Unknown Customer" && patch.primaryContactId) {
      try {
        const contact = await base44.asServiceRole.entities.CRMContact.read(patch.primaryContactId);
        const firstName = safeText(contact?.firstName);
        const lastName = safeText(contact?.lastName);
        if (firstName || lastName) {
          candidateName = [firstName, lastName].filter(Boolean).join(" ");
        } else if (safeText(contact?.email)) {
          candidateName = safeText(contact.email);
        }
      } catch {}
    }

    // Try linked CRMAccount
    if (candidateName === "Unknown Customer" && patch.accountId) {
      try {
        const account = await base44.asServiceRole.entities.CRMAccount.read(patch.accountId);
        if (safeText(account?.name)) {
          candidateName = safeText(account.name);
        }
      } catch {}
    }

    // Try linked Job
    if (candidateName === "Unknown Customer" && patch.externalJobId) {
      try {
        const job = await base44.asServiceRole.entities.Job.read(patch.externalJobId);
        if (safeText(job?.customerName)) {
          candidateName = safeText(job.customerName);
        }
      } catch {}
    }

    // STRICT ENFORCEMENT: Manual/legacy paths cannot proceed without identity
    const isManualOrLegacy = patch.createdFrom === 'manual' || 
                             patch.createdFrom === 'ui_create' ||
                             patch.source === 'legacy_sync';
    
    if (candidateName === "Unknown Customer" && isManualOrLegacy) {
      throw new Error("CRMJOB_IDENTITY_REQUIRED: Manual/legacy job creation requires customerName");
    }

    normalized.customerName = candidateName;

    // Determine nameStatus based on computed name
    if (candidateName === "Unknown Customer") {
      normalized.nameStatus = "NEEDS_REPAIR";
    } else {
      normalized.nameStatus = "RESOLVED";
    }
    normalized.nameLastUpdatedAt = new Date().toISOString();

    // Log upstream callers with missing customerName for observability
    const { jobNumber, externalJobId, externalAppointmentId, createdFrom, source } = patch;
    console.warn("[CRMJOB_INVARIANT] missing customerName input", {
      jobNumber: jobNumber || null,
      externalJobId: externalJobId || null,
      externalAppointmentId: externalAppointmentId || null,
      createdFrom: createdFrom || null,
      source: source || null,
      computed: normalized.customerName,
      nameStatus: normalized.nameStatus,
      incomingCompanyId: incomingCompanyId || null,
      tenantId,
      mode
    });
  }

  // Phase 2 guard: auto-write installStageUpdatedAt when installStage is being set
  // Prevents daysInStage from being 0 in production KPIs due to missing timestamp
  if (normalized.installStage && !normalized.installStageUpdatedAt) {
    normalized.installStageUpdatedAt = new Date().toISOString();
  }

  // Idempotency: search for existing record before create
  // Match order: (1) externalAppointmentId, (2) externalJobId, (3) jobNumber
  // Requires at least ONE identifier to exist; otherwise fail loudly
  const hasIdentifier = !!(normalized.externalAppointmentId || normalized.externalJobId || normalized.jobNumber);
  if (!hasIdentifier) {
    return {
      success: false,
      error: {
        code: "NO_IDEMPOTENCY_KEY",
        message: "Cannot create CRMJob without externalAppointmentId, externalJobId, or jobNumber",
        details: { patch: normalized }
      }
    };
  }

  let existing = null;

  if (normalized.externalAppointmentId) {
    const byAppId = await base44.asServiceRole.entities.CRMJob.filter({
      companyId: tenantId,
      externalAppointmentId: normalized.externalAppointmentId
    });
    if (Array.isArray(byAppId) && byAppId.length > 0) {
      existing = byAppId[0]; // first match
    }
  }

  if (!existing && normalized.externalJobId) {
    const byJobId = await base44.asServiceRole.entities.CRMJob.filter({
      companyId: tenantId,
      externalJobId: normalized.externalJobId
    });
    if (Array.isArray(byJobId) && byJobId.length > 0) {
      existing = byJobId[0];
    }
  }

  if (!existing && normalized.jobNumber) {
    const byJobNum = await base44.asServiceRole.entities.CRMJob.filter({
      companyId: tenantId,
      jobNumber: normalized.jobNumber
    });
    if (Array.isArray(byJobNum) && byJobNum.length > 0) {
      existing = byJobNum[0];
    }
  }

  let crmJob;
  let action;

  if (existing) {
    // Update: preserve existing fields + apply patch
    crmJob = await base44.asServiceRole.entities.CRMJob.update(existing.id, normalized);
    action = "updated";
  } else {
    // Create: new record with normalized patch
    crmJob = await base44.asServiceRole.entities.CRMJob.create(normalized);
    action = "created";
  }

  return {
    success: true,
    crmJob,
    action,
    mode
  };
}