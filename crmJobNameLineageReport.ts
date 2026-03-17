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
        echo: { route: "_diagnostic/crmJobNameLineageReport", parsed: { __echo, limit } }
      });
    }

    const ctx = await resolveCompanyContext({ base44, req });
    const { tenantId, companyKey } = ctx;

    const jobsAll = await base44.entities.CRMJob.filter({ companyId: tenantId });
    const jobs = jobsAll
      .slice()
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
      .slice(0, limit);

    const lineage = [];
    const summary = {
      OK: 0,
      DISCONNECTED_HAS_SOURCE: 0,
      MISSING_DATA_NO_SOURCE: 0,
      BROKEN_LINK: 0
    };

    for (const job of jobs) {
      const crmNamePresent = !!safeText(job.customerName) && job.customerName !== "Unknown Customer";
      const hasContactId = !!job.primaryContactId;
      const hasAccountId = !!job.accountId;
      const hasExternalJobId = !!job.externalJobId;

      let candidateContactName = null;
      let candidateAccountName = null;
      let candidateJobName = null;
      let contactLinkStatus = null;
      let accountLinkStatus = null;
      let jobLinkStatus = null;

      // Attempt to read CRMContact
      if (hasContactId) {
        try {
          const contact = await base44.asServiceRole.entities.CRMContact.read(job.primaryContactId);
          const firstName = safeText(contact?.firstName);
          const lastName = safeText(contact?.lastName);
          candidateContactName = [firstName, lastName].filter(Boolean).join(" ") || safeText(contact?.email) || null;
          contactLinkStatus = "OK";
        } catch (e) {
          contactLinkStatus = "BROKEN";
        }
      }

      // Attempt to read CRMAccount
      if (hasAccountId) {
        try {
          const account = await base44.asServiceRole.entities.CRMAccount.read(job.accountId);
          candidateAccountName = safeText(account?.name) || null;
          accountLinkStatus = "OK";
        } catch (e) {
          accountLinkStatus = "BROKEN";
        }
      }

      // Attempt to read Job
      if (hasExternalJobId) {
        try {
          const linkedJob = await base44.asServiceRole.entities.Job.read(job.externalJobId);
          candidateJobName = safeText(linkedJob?.customerName) || null;
          jobLinkStatus = "OK";
        } catch (e) {
          jobLinkStatus = "BROKEN";
        }
      } else if (job.jobNumber) {
        // Fallback: search by jobNumber
        try {
          const matches = await base44.asServiceRole.entities.Job.filter({ companyId: tenantId, jobNumber: job.jobNumber });
          if (matches.length > 0) {
            candidateJobName = safeText(matches[0]?.customerName) || null;
            jobLinkStatus = "FALLBACK_OK";
          }
        } catch {}
      }

      const hasCandidates = !!(candidateContactName || candidateAccountName || candidateJobName);
      const hasBrokenLinks = contactLinkStatus === "BROKEN" || accountLinkStatus === "BROKEN" || jobLinkStatus === "BROKEN";

      let classification;
      if (crmNamePresent) {
        classification = "OK";
      } else if (hasBrokenLinks) {
        classification = "BROKEN_LINK";
      } else if (hasCandidates) {
        classification = "DISCONNECTED_HAS_SOURCE";
      } else {
        classification = "MISSING_DATA_NO_SOURCE";
      }

      summary[classification]++;

      lineage.push({
        crmJobId: job.id,
        jobNumber: job.jobNumber || null,
        crmNamePresent,
        currentName: job.customerName || null,
        nameStatus: job.nameStatus || null,
        linkage: {
          hasContactId,
          hasAccountId,
          hasExternalJobId,
          contactLinkStatus,
          accountLinkStatus,
          jobLinkStatus
        },
        candidates: {
          contactName: candidateContactName,
          accountName: candidateAccountName,
          jobName: candidateJobName
        },
        classification
      });
    }

    // Sample 5 per classification
    const samples = {};
    for (const cls of Object.keys(summary)) {
      samples[cls] = lineage.filter(l => l.classification === cls).slice(0, 5);
    }

    return Response.json({
      success: true,
      context: ctx,
      summary: {
        scanned: jobs.length,
        ...summary
      },
      samples,
      fullLineage: lineage.length <= 50 ? lineage : null // Include full if <= 50
    });
  } catch (e) {
    console.error("[_diagnostic/crmJobNameLineageReport] error", e);
    return Response.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
});