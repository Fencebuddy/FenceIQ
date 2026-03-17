/**
 * crmJobWriteHoleAudit.js — Read-only forensic audit
 * Verifies invariant enforcement by checking for missing customerNames in recent CRMJobs
 * Resolves tenantId using the standard context ladder (header → primary → single-record)
 */

import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

async function resolveCompanyContext({ base44, req }) {
  // Tier 1: header selector (future multi-tenant)
  const headerCompanyKey = req.headers.get("x-company-id");
  if (headerCompanyKey) {
    const matches = await base44.entities.CompanySettings.filter({
      companyId: headerCompanyKey
    });
    if (Array.isArray(matches) && matches.length === 1) {
      return {
        mode: "header",
        tenantId: matches[0].id,
        companyKey: matches[0].companyId ?? null
      };
    }
    if (Array.isArray(matches) && matches.length > 1) {
      throw new Error(
        "MULTI_TENANT_AMBIGUOUS_HEADER: multiple CompanySettings match x-company-id"
      );
    }
    throw new Error(
      "COMPANY_NOT_FOUND_FOR_HEADER: x-company-id provided but no CompanySettings match"
    );
  }

  // Tier 2: primary company
  const primary = await base44.entities.CompanySettings.filter({
    isPrimary: true
  });
  if (Array.isArray(primary) && primary.length === 1) {
    return {
      mode: "primary",
      tenantId: primary[0].id,
      companyKey: primary[0].companyId ?? null
    };
  }
  if (Array.isArray(primary) && primary.length > 1) {
    throw new Error(
      "MULTI_PRIMARY_COMPANY_SETTINGS: more than one CompanySettings has isPrimary=true"
    );
  }

  // Tier 3: single-record invariant
  const all = await base44.entities.CompanySettings.list();
  if (!Array.isArray(all) || all.length === 0) {
    throw new Error("COMPANY_SETTINGS_MISSING: no CompanySettings records exist");
  }
  if (all.length === 1) {
    return {
      mode: "single_record",
      tenantId: all[0].id,
      companyKey: all[0].companyId ?? null
    };
  }

  // Tier 4: ambiguous multi-tenant
  throw new Error(
    "MULTI_TENANT_CONTEXT_REQUIRED: multiple CompanySettings exist; set isPrimary or pass x-company-id"
  );
}

function safeText(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ctx = await resolveCompanyContext({ base44, req });
    const { tenantId, companyKey, mode } = ctx;

    // Fetch up to 100 recent CRMJobs for this tenant (sorted by created_date desc)
    const jobs = await base44.entities.CRMJob.filter(
      { companyId: tenantId },
      "-created_date",
      100
    );

    const jobArray = Array.isArray(jobs) ? jobs : [];

    // Analysis
    const totalCount = jobArray.length;
    const missingCustomerNameCount = jobArray.filter(
      (j) => !safeText(j.customerName)
    ).length;

    // Distinct values
    const distinct = (arr) => Array.from(new Set(arr.filter(Boolean)));
    const createdFroms = distinct(jobArray.map((j) => j.createdFrom));
    const sources = distinct(jobArray.map((j) => j.source));

    // Recent jobs (newest 10 for invariant check)
    const newestJobs = jobArray.slice(0, 10);
    const newestMissingCount = newestJobs.filter(
      (j) => !safeText(j.customerName)
    ).length;

    // Sample rows (first 25)
    const samples = jobArray.slice(0, 25).map((j) => ({
      id: j.id,
      jobNumber: j.jobNumber ?? null,
      customerName: j.customerName ?? null,
      createdFrom: j.createdFrom ?? null,
      source: j.source ?? null,
      externalCRM: j.externalCRM ?? null,
      externalJobId: j.externalJobId ?? null,
      externalAppointmentId: j.externalAppointmentId ?? null,
      companyId: j.companyId ?? null,
      created_date: j.created_date ?? null
    }));

    // Verdict: invariant is likely closed if no missing names in newest 10 jobs
    const invariantLikelyClosed = newestMissingCount === 0;

    return Response.json({
      success: true,
      context: { tenantId, companyKey, mode },
      audit: {
        totalCount,
        missingCustomerNameCount,
        missingPercentage:
          totalCount > 0
            ? ((missingCustomerNameCount / totalCount) * 100).toFixed(2)
            : 0,
        distinct_createdFrom: createdFroms,
        distinct_source: sources,
        newestJobsAnalysis: {
          count: newestJobs.length,
          missingInNewest: newestMissingCount
        },
        invariantLikelyClosed,
        samples
      }
    });
  } catch (e) {
    return Response.json(
      { success: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
});