/**
 * crmJobNamePlaceholderForensics.js — Read-only audit of placeholder customer names
 * Identifies CRMJobs needing real name backfill and shows available sources
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
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
    const needsAttention = jobArray.filter((j) => isPlaceholder(j.customerName));

    const rows = [];
    let jobFoundCount = 0;
    let contactFoundCount = 0;
    let accountFoundCount = 0;
    let resolvableFromJobCount = 0;
    let resolvableFromContactCount = 0;
    let resolvableFromAccountCount = 0;

    for (const crmJob of needsAttention) {
      const row = {
        crmJobId: crmJob.id,
        jobNumber: crmJob.jobNumber,
        currentCustomerName: crmJob.customerName,
        externalJobId: crmJob.externalJobId || null,
        jobFound: false,
        jobNameCandidates: {},
        contactFound: false,
        contactNameCandidates: {},
        accountFound: false,
        accountNameCandidates: {}
      };

      // Try Job
      if (crmJob.externalJobId) {
        try {
          const job = await base44.entities.Job.read(crmJob.externalJobId);
          if (job) {
            row.jobFound = true;
            jobFoundCount++;

            row.jobNameCandidates = {
              customerName: job.customerName || null,
              firstName: job.firstName || null,
              lastName: job.lastName || null,
              fullName: job.fullName || null,
              name: job.name || null,
              primaryContactName: job.primaryContactName || null,
              email: job.customerEmail || null,
              phone: job.customerPhone || null
            };

            const names = [
              job.customerName,
              job.fullName,
              job.name,
              job.firstName && job.lastName ? `${job.firstName} ${job.lastName}` : null,
              job.primaryContactName,
              job.customerEmail,
              job.customerPhone
            ].filter(Boolean);

            if (names.length > 0) {
              resolvableFromJobCount++;
            }
          }
        } catch {}
      }

      // Try Contact
      if (crmJob.primaryContactId) {
        try {
          const contact = await base44.entities.CRMContact.read(crmJob.primaryContactId);
          if (contact) {
            row.contactFound = true;
            contactFoundCount++;

            row.contactNameCandidates = {
              fullName: contact.fullName || null,
              name: contact.name || null,
              firstName: contact.firstName || null,
              lastName: contact.lastName || null,
              email: contact.email || null,
              phone: contact.phone || null
            };

            const names = [
              contact.fullName,
              contact.name,
              contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : null,
              contact.email,
              contact.phone
            ].filter(Boolean);

            if (names.length > 0 && resolvableFromJobCount === 0) {
              resolvableFromContactCount++;
            }
          }
        } catch {}
      }

      // Try Account
      if (crmJob.accountId) {
        try {
          const account = await base44.entities.CRMAccount.read(crmJob.accountId);
          if (account) {
            row.accountFound = true;
            accountFoundCount++;

            row.accountNameCandidates = {
              name: account.name || null,
              customerName: account.customerName || null
            };

            const names = [account.name, account.customerName].filter(Boolean);
            if (names.length > 0 && resolvableFromJobCount === 0 && resolvableFromContactCount === 0) {
              resolvableFromAccountCount++;
            }
          }
        } catch {}
      }

      rows.push(row);
    }

    return Response.json({
      success: true,
      context: { tenantId, companyKey, mode },
      scanned: jobArray.length,
      needsAttention: needsAttention.length,
      rows,
      stats: {
        jobFoundCount,
        contactFoundCount,
        accountFoundCount,
        resolvableFromJobCount,
        resolvableFromContactCount,
        resolvableFromAccountCount,
        totalResolvable: resolvableFromJobCount + resolvableFromContactCount + resolvableFromAccountCount
      }
    });
  } catch (e) {
    return Response.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
});