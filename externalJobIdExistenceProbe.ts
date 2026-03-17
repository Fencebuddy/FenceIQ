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
        echo: { route: "_diagnostic/externalJobIdExistenceProbe", parsed: { __echo, limit } }
      });
    }

    const ctx = await resolveCompanyContext({ base44, req });
    const { tenantId, companyKey } = ctx;

    const jobsAll = await base44.entities.CRMJob.filter({ companyId: tenantId });
    const jobs = jobsAll
      .slice()
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
      .slice(0, limit);

    const probeResults = [];
    const summary = {
      scanned: jobs.length,
      hasExternalJobId: 0,
      normalReadOk: 0,
      serviceReadOk: 0,
      serviceOk_normalFail: 0,
      bothFail: 0
    };

    for (const job of jobs) {
      if (!job.externalJobId) continue;

      summary.hasExternalJobId++;

      let normalOk = false;
      let serviceOk = false;
      let serviceCustomerName = null;

      // Try normal read
      try {
        const normalJob = await base44.entities.Job.read(job.externalJobId);
        normalOk = true;
      } catch {}

      // Try service role read
      try {
        const serviceJob = await base44.asServiceRole.entities.Job.read(job.externalJobId);
        serviceOk = true;
        serviceCustomerName = safeText(serviceJob?.customerName);
      } catch {}

      // Classify
      if (normalOk) summary.normalReadOk++;
      if (serviceOk) summary.serviceReadOk++;
      if (serviceOk && !normalOk) summary.serviceOk_normalFail++;
      if (!serviceOk && !normalOk) summary.bothFail++;

      probeResults.push({
        crmJobId: job.id,
        jobNumber: job.jobNumber || null,
        externalJobId: job.externalJobId,
        normalOk,
        serviceOk,
        serviceCustomerName
      });
    }

    // Return first 25 samples
    const samples = probeResults.slice(0, 25);

    return Response.json({
      success: true,
      context: ctx,
      summary,
      samples,
      fullResults: probeResults.length <= 25 ? probeResults : null
    });
  } catch (e) {
    console.error("[_diagnostic/externalJobIdExistenceProbe] error", e);
    return Response.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
});