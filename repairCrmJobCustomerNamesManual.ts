import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

/**
 * _diagnostic/repairCrmJobCustomerNamesManual
 * READ-ONLY diagnostic scanner for customer name issues.
 * 
 * Payload:
 *  - __echo?: boolean (verify deployment + routing)
 *  - limit?: number (default 50)
 *  - debugScan?: boolean (default true, always read-only)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const { __echo = false, limit = 50, debugScan = true } = payload;

    // Echo branch to verify deployment + payload routing
    if (__echo) {
      return Response.json({
        success: true,
        echo: {
          route: "_diagnostic/repairCrmJobCustomerNamesManual",
          receivedPayloadKeys: Object.keys(payload || {}),
          limit,
          debugScan
        }
      });
    }

    // Resolve tenant context (single company or primary only)
    const companies = await base44.entities.CompanySettings.list();
    let tenantId, companyKey, mode;

    if (companies.length === 1) {
      tenantId = companies[0].id;
      companyKey = companies[0].companyId;
      mode = "single";
    } else if (companies.length > 1) {
      const primary = companies.find(c => c.isPrimary);
      if (primary) {
        tenantId = primary.id;
        companyKey = primary.companyId;
        mode = "primary";
      } else {
        return Response.json({ 
          success: false, 
          error: "Multi-tenant context ambiguous. Set isPrimary or use header." 
        }, { status: 400 });
      }
    } else {
      return Response.json({ success: false, error: "No company context available" }, { status: 400 });
    }

    // Fetch jobs scoped by tenantId (read-only, no writes)
    const jobs = await base44.entities.CRMJob.filter({ companyId: tenantId });
    const max = Math.max(1, Math.min(Number(limit) || 50, 200));
    const slice = Array.isArray(jobs) ? jobs.slice(0, max) : [];

    // Diagnostic stats
    const createdFroms = new Set();
    const sources = new Set();
    let missingCustomerNameCount = 0;
    const samples = [];

    for (const job of slice) {
      const raw = (job?.customerName ?? "").toString().trim();
      if (!raw || raw === "Unknown Customer") {
        missingCustomerNameCount++;
      }

      if (job.createdFrom) createdFroms.add(job.createdFrom);
      if (job.source) sources.add(job.source);

      samples.push({
        id: job.id,
        jobNumber: job.jobNumber || null,
        customerName: job.customerName || null,
        createdFrom: job.createdFrom || null,
        source: job.source || null,
        companyId: job.companyId || null
      });
    }

    return Response.json({
      success: true,
      context: { tenantId, companyKey, mode },
      debug: {
        sampleCount: slice.length,
        missingCustomerNameCount,
        distinct_createdFrom: Array.from(createdFroms),
        distinct_source: Array.from(sources),
        samples
      }
    });
  } catch (e) {
    console.error("[_diagnostic/repairCrmJobCustomerNamesManual] error", e);
    return Response.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
});