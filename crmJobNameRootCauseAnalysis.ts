import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * DIAGNOSTIC: CRMJob customerName Root Cause Analysis
 * Phase 1: Pull real data + resolve fallbacks
 * Returns evidence table for root cause determination
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Use service role for diagnostic read
    const allCrmJobs = await base44.asServiceRole.entities.CRMJob.list();
    const crmJobsSample = allCrmJobs.slice(0, 25);

    console.log(`[DIAGNOSTIC] Fetched ${crmJobsSample.length} CRMJob records`);

    // PHASE 1b: Count missing customerName
    const missingCustomerName = crmJobsSample.filter(j => !j.customerName);
    const missingExternalJobId = crmJobsSample.filter(j => !j.externalJobId);
    const missingBoth = crmJobsSample.filter(j => !j.customerName && !j.externalJobId);

    console.log(`[DIAGNOSTIC] Missing customerName: ${missingCustomerName.length}`);
    console.log(`[DIAGNOSTIC] Missing externalJobId: ${missingExternalJobId.length}`);
    console.log(`[DIAGNOSTIC] Missing BOTH: ${missingBoth.length}`);

    // PHASE 1c: For 10 most recent missing-name jobs, resolve fallbacks
    const fallbackResults = [];
    for (const crmJob of missingCustomerName.slice(0, 10)) {
      const result = {
        crmJobId: crmJob.id,
        crmJobNumber: crmJob.jobNumber,
        crmCustomerName: crmJob.customerName || null,
        crmExternalJobId: crmJob.externalJobId || null,
        crmPrimaryContactId: crmJob.primaryContactId || null,
        crmAccountId: crmJob.accountId || null,
        fallbacks: {}
      };

      // A) If externalJobId exists, resolve Job
      if (crmJob.externalJobId) {
        try {
          const job = await base44.entities.Job.read(crmJob.externalJobId);
          result.fallbacks.job = {
            id: job.id,
            customerName: job.customerName || null
          };
        } catch (e) {
          result.fallbacks.job = { error: e.message };
        }
      }

      // B) If primaryContactId exists, resolve Contact
      if (crmJob.primaryContactId) {
        try {
          const contact = await base44.entities.CRMContact.read(crmJob.primaryContactId);
          result.fallbacks.contact = {
            id: contact.id,
            firstName: contact.firstName || null,
            lastName: contact.lastName || null,
            fullName: contact.fullName || null,
            name: contact.name || null,
            email: contact.email || null
          };
        } catch (e) {
          result.fallbacks.contact = { error: e.message };
        }
      }

      // C) If accountId exists, resolve Account
      if (crmJob.accountId) {
        try {
          const account = await base44.entities.CRMAccount.read(crmJob.accountId);
          result.fallbacks.account = {
            id: account.id,
            name: account.name || null
          };
        } catch (e) {
          result.fallbacks.account = { error: e.message };
        }
      }

      fallbackResults.push(result);
    }

    console.log(`[DIAGNOSTIC] Resolved ${fallbackResults.length} fallback paths`);

    // PHASE 1d: Identify canonical source
    let canonicalSource = 'UNKNOWN';
    let sourceEvidence = {};

    if (fallbackResults.length > 0) {
      // Check which source has most complete data
      const hasJobCustomerName = fallbackResults.filter(r => r.fallbacks.job?.customerName).length;
      const hasContactName = fallbackResults.filter(r => 
        r.fallbacks.contact?.fullName || r.fallbacks.contact?.firstName
      ).length;
      const hasAccountName = fallbackResults.filter(r => r.fallbacks.account?.name).length;

      sourceEvidence = {
        job_customerName_count: hasJobCustomerName,
        contact_name_count: hasContactName,
        account_name_count: hasAccountName
      };

      if (hasContactName >= hasJobCustomerName && hasContactName >= hasAccountName) {
        canonicalSource = 'DERIVE_FROM_CRMCONTACT';
      } else if (hasJobCustomerName >= hasAccountName) {
        canonicalSource = 'MIRROR_FROM_JOB_ENTITY';
      } else if (hasAccountName > 0) {
        canonicalSource = 'DERIVE_FROM_CRMACCOUNT';
      } else {
        canonicalSource = 'BUILDERPRIME_PAYLOAD_MISSING';
      }
    }

    return Response.json({
      success: true,
      sampleStats: {
        totalSampled: crmJobsSample.length,
        missingCustomerNameCount: missingCustomerName.length,
        missingExternalJobIdCount: missingExternalJobId.length,
        missingBothCount: missingBoth.length
      },
      sample: crmJobsSample.map(j => ({
        id: j.id,
        companyId: j.companyId,
        jobNumber: j.jobNumber,
        customerName: j.customerName || null,
        externalJobId: j.externalJobId || null,
        primaryContactId: j.primaryContactId || null,
        accountId: j.accountId || null,
        createdAt: j.created_date,
        updatedAt: j.updated_date
      })),
      fallbackResolutions: fallbackResults,
      canonicalSource,
      sourceEvidence
    });
  } catch (error) {
    console.error('[DIAGNOSTIC] Analysis failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});