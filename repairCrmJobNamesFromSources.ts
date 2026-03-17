/**
 * repairCrmJobNamesFromSources.js — Backfill real customer names from Job/Contact/Account
 * Deterministic replacement of "Customer for X" placeholders
 */

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

async function resolveCompanyContext({ base44, req }) {
  const headerCompanyKey = req.headers.get("x-company-id");
  if (headerCompanyKey) {
    const matches = await base44.entities.CompanySettings.filter({
      companyId: headerCompanyKey
    });
    if (Array.isArray(matches) && matches.length === 1) {
      return { mode: "header", tenantId: matches[0].id, companyKey: matches[0].companyId };
    }
  }

  const primary = await base44.entities.CompanySettings.filter({ isPrimary: true });
  if (Array.isArray(primary) && primary.length === 1) {
    return { mode: "primary", tenantId: primary[0].id, companyKey: primary[0].companyId };
  }

  const all = await base44.entities.CompanySettings.list();
  if (Array.isArray(all) && all.length === 1) {
    return { mode: "single_record", tenantId: all[0].id, companyKey: all[0].companyId };
  }

  throw new Error("Company context resolution failed");
}

function safeText(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

function isPlaceholder(name) {
  return !safeText(name) || /^Customer for\s+/i.test(name);
}

function extractCandidateName(obj) {
  if (!obj) return null;

  // Priority order
  if (safeText(obj.customerName)) return obj.customerName;
  if (safeText(obj.fullName)) return obj.fullName;
  if (safeText(obj.name)) return obj.name;
  if (safeText(obj.firstName) && safeText(obj.lastName)) return `${obj.firstName} ${obj.lastName}`;
  if (safeText(obj.primaryContactName)) return obj.primaryContactName;
  if (safeText(obj.email)) return obj.email;
  if (safeText(obj.phone)) return obj.phone;

  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const dryRun = payload?.dryRun !== false;
    const limit = Math.min(200, Math.max(1, Number(payload?.limit) || 200));

    const ctx = await resolveCompanyContext({ base44, req });
    const { tenantId, companyKey, mode } = ctx;

    // Fetch recent CRMJobs
    const jobs = await base44.entities.CRMJob.filter(
      { companyId: tenantId },
      "-created_date",
      limit
    );
    const jobArray = Array.isArray(jobs) ? jobs : [];

    // Filter needsAttention
    const needsRepair = jobArray.filter((j) => isPlaceholder(j.customerName));

    const idsToUpdate = [];
    let updated = 0;
    let stillMissing = 0;

    for (const crmJob of needsRepair) {
      let resolvedName = null;
      let fromSource = null;

      // Try Job first
      if (!resolvedName && crmJob.externalJobId) {
        try {
          const job = await base44.entities.Job.read(crmJob.externalJobId);
          resolvedName = extractCandidateName(job);
          if (resolvedName) fromSource = "job";
        } catch {}
      }

      // Try Contact
      if (!resolvedName && crmJob.primaryContactId) {
        try {
          const contact = await base44.entities.CRMContact.read(crmJob.primaryContactId);
          resolvedName = extractCandidateName(contact);
          if (resolvedName) fromSource = "contact";
        } catch {}
      }

      // Try Account
      if (!resolvedName && crmJob.accountId) {
        try {
          const account = await base44.entities.CRMAccount.read(crmJob.accountId);
          resolvedName = extractCandidateName(account);
          if (resolvedName) fromSource = "account";
        } catch {}
      }

      // Fallback
      if (!resolvedName) {
        resolvedName = "Unknown Customer";
        fromSource = "fallback";
        stillMissing++;
      }

      idsToUpdate.push({
        id: crmJob.id,
        jobNumber: crmJob.jobNumber,
        fromSource,
        newCustomerName: resolvedName
      });

      // Apply update if not dry run
      if (!dryRun && resolvedName !== crmJob.customerName) {
        await base44.asServiceRole.entities.CRMJob.update(crmJob.id, {
          customerName: resolvedName
        });
        updated++;
      }
    }

    return Response.json({
      success: true,
      context: { tenantId, companyKey, mode },
      summary: {
        scanned: jobArray.length,
        needsRepair: needsRepair.length,
        updated,
        stillMissing,
        dryRun
      },
      idsToUpdate: dryRun ? idsToUpdate : []
    });
  } catch (e) {
    return Response.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
});