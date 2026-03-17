import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function safeText(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

function isPlaceholderCustomerName(v) {
  const s = safeText(v);
  if (!s) return false;
  if (/^customer\s+for\s+j-/i.test(s)) return true;
  return false;
}

function computeCustomerNameFromJobLike(obj) {
  const direct = safeText(obj?.customerName);
  if (direct) return direct;

  const first = safeText(obj?.firstName);
  const last = safeText(obj?.lastName);
  const full = safeText([first, last].filter(Boolean).join(" "));
  if (full) return full;

  const email = safeText(obj?.email);
  if (email) return email;

  const phone = safeText(obj?.phone);
  if (phone) return phone;

  return null;
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
    const dryRun = payload?.dryRun !== false;
    const limit = Number.isFinite(Number(payload?.limit)) ? Math.max(1, Math.min(1000, Number(payload.limit))) : 200;

    if (__echo) {
      return Response.json({
        success: true,
        echo: { route: "_repair/repairCrmJobNames_NoFabrication", parsed: { __echo, dryRun, limit } }
      });
    }

    const ctx = await resolveCompanyContext({ base44, req });
    const { tenantId, companyKey } = ctx;

    const jobsAll = await base44.entities.CRMJob.filter({ companyId: tenantId });
    const jobs = jobsAll
      .slice()
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
      .slice(0, limit);

    // Detect jobs that need repair: missing, "Unknown Customer", or placeholder pattern
    const needsRepair = jobs.filter((j) => {
      const name = safeText(j.customerName);
      return !name || name === "Unknown Customer" || isPlaceholderCustomerName(name);
    });
    let updated = 0;
    let stillMissing = 0;
    const idsToUpdate = [];

    for (const j of needsRepair) {
      let candidate = null;

      if (!candidate && j.primaryContactId) {
        try {
          const c = await base44.entities.CRMContact.read(j.primaryContactId);
          candidate = computeCustomerNameFromJobLike(c);
        } catch {}
      }
      if (!candidate && j.accountId) {
        try {
          const a = await base44.entities.CRMAccount.read(j.accountId);
          candidate = computeCustomerNameFromJobLike(a) || safeText(a?.name);
        } catch {}
      }
      if (!candidate && j.externalJobId) {
        try {
          const job = await base44.entities.Job.read(j.externalJobId);
          candidate = computeCustomerNameFromJobLike(job);
        } catch {}
      }

      if (!candidate) {
        candidate = "Unknown Customer";
      }

      if (candidate) {
        idsToUpdate.push({ id: j.id, customerName: candidate });
        if (!dryRun) {
          await base44.asServiceRole.entities.CRMJob.update(j.id, {
            customerName: candidate,
            nameStatus: candidate === "Unknown Customer" ? "NEEDS_REPAIR" : "RESOLVED",
            nameLastUpdatedAt: new Date().toISOString()
          });
        }
        updated += dryRun ? 0 : 1;
      } else {
        stillMissing += 1;
      }
    }

    return Response.json({
      success: true,
      context: ctx,
      summary: {
        scanned: jobs.length,
        needsRepair: needsRepair.length,
        updated,
        stillMissing,
        dryRun
      },
      idsToUpdate: dryRun ? idsToUpdate : []
    });
  } catch (e) {
    console.error("[_repair/repairCrmJobNames_NoFabrication] error", e);
    return Response.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
});