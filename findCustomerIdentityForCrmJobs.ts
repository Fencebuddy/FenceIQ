import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function safeText(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

async function resolveCompanyContext({ base44, req }) {
  const headerCompanyKey = req.headers.get("x-company-id");
  if (headerCompanyKey) {
    const matches = await base44.entities.CompanySettings.filter({ companyId: headerCompanyKey });
    if (Array.isArray(matches) && matches.length === 1) {
      return { mode: "header", tenantId: matches[0].id, companyKey: matches[0].companyId ?? null };
    }
    if (Array.isArray(matches) && matches.length > 1) {
      throw new Error("MULTI_TENANT_AMBIGUOUS_HEADER");
    }
    throw new Error("COMPANY_NOT_FOUND_FOR_HEADER");
  }

  const primary = await base44.entities.CompanySettings.filter({ isPrimary: true });
  if (Array.isArray(primary) && primary.length === 1) {
    return { mode: "primary", tenantId: primary[0].id, companyKey: primary[0].companyId ?? null };
  }
  if (Array.isArray(primary) && primary.length > 1) {
    throw new Error("MULTI_PRIMARY_COMPANY_SETTINGS");
  }

  const all = await base44.entities.CompanySettings.list();
  if (!Array.isArray(all) || all.length === 0) {
    throw new Error("COMPANY_SETTINGS_MISSING");
  }
  if (all.length === 1) {
    return { mode: "single_record", tenantId: all[0].id, companyKey: all[0].companyId ?? null };
  }

  throw new Error("MULTI_TENANT_CONTEXT_REQUIRED");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const __echo = payload?.__echo === true;
    const limit = Number.isFinite(Number(payload?.limit)) ? Math.max(1, Math.min(1000, Number(payload.limit))) : 200;

    if (__echo) {
      return Response.json({
        success: true,
        echo: { route: "findCustomerIdentityForCrmJobs", parsed: { __echo, limit } }
      });
    }

    const ctx = await resolveCompanyContext({ base44, req });
    const { tenantId, companyKey } = ctx;

    const jobsAll = await base44.entities.CRMJob.filter({ companyId: tenantId });
    const jobs = jobsAll
      .slice()
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
      .slice(0, limit);

    const needsIdentity = jobs.filter((j) => !safeText(j.customerName));

    const results = [];
    for (const j of needsIdentity) {
      const sources = {};

      if (j.externalJobId) {
        try {
          const linkedJob = await base44.entities.Job.read(j.externalJobId);
          sources.linkedJob = safeText(linkedJob?.customerName) || null;
        } catch {}
      }

      if (j.primaryContactId) {
        try {
          const contact = await base44.entities.CRMContact.read(j.primaryContactId);
          const firstName = safeText(contact?.firstName);
          const lastName = safeText(contact?.lastName);
          sources.contact = firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || safeText(contact?.email) || null);
        } catch {}
      }

      if (j.accountId) {
        try {
          const account = await base44.entities.CRMAccount.read(j.accountId);
          sources.account = safeText(account?.name) || null;
        } catch {}
      }

      const bestCandidate = Object.values(sources).find(Boolean) || null;

      results.push({
        jobId: j.id,
        jobNumber: j.jobNumber || null,
        currentName: j.customerName || null,
        candidateSources: sources,
        bestCandidate
      });
    }

    return Response.json({
      success: true,
      context: ctx,
      summary: { scanned: jobs.length, needsIdentity: needsIdentity.length, resolved: results.length },
      results
    });
  } catch (e) {
    console.error("[findCustomerIdentityForCrmJobs] error", e);
    return Response.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
});