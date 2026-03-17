import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: normalize string values
function normalizeName(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Parse payload once at top
    let payload = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const debugScan = payload?.debugScan === true;
    const dryRun = payload?.dryRun === true;
    const limitRaw = payload?.limit;
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(200, Number(limitRaw))) : 50;

    // Auth gate: require authenticated admin user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'FORBIDDEN', message: 'Admin only' }, { status: 403 });
    }

    // Resolve company context locally (no getCompanyContext call)
    const headerCompanyId = req.headers.get('x-company-id');
    let tenantId, companyKey, company;
    let allCompanies = [];

    if (headerCompanyId) {
      // 1) Try header
      const results = await base44.entities.CompanySettings.filter({ companyId: headerCompanyId });
      if (results.length > 0) {
        company = results[0];
        tenantId = company.id;
        companyKey = company.companyId;
      }
    }

    if (!company) {
      // 2) Try single company
      allCompanies = await base44.entities.CompanySettings.list();
      if (allCompanies.length === 1) {
        company = allCompanies[0];
        tenantId = company.id;
        companyKey = company.companyId;
      } else if (allCompanies.length > 1) {
        // 3) Try primary
        const primary = allCompanies.find(c => c.isPrimary);
        if (primary) {
          company = primary;
          tenantId = company.id;
          companyKey = company.companyId;
        } else {
          return Response.json({ error: 'MULTI_TENANT_CONTEXT_REQUIRED' }, { status: 400 });
        }
      } else {
        return Response.json({ error: 'Company context unavailable' }, { status: 400 });
      }
    }

    // debugScan, dryRun, limit already parsed above (do not re-parse)

    // Dual-scope query: fetch all recent jobs (no BuilderPrime filter for diagnostic)
    let jobsByTenant = [];
    let jobsByKey = [];

    try {
      jobsByTenant = await base44.entities.CRMJob.filter({
        companyId: tenantId
      }, '-created_date', 200);
    } catch (e) {
      console.warn('Tenant scope query failed:', e.message);
    }

    if (companyKey && companyKey !== tenantId) {
      try {
        jobsByKey = await base44.entities.CRMJob.filter({
          companyId: companyKey
        }, '-created_date', 200);
      } catch (e) {
        console.warn('Key scope query failed:', e.message);
      }
    }

    // Merge by id (tenant wins if duplicate)
    const mergedMap = new Map();
    for (const job of jobsByKey) mergedMap.set(job.id, job);
    for (const job of jobsByTenant) mergedMap.set(job.id, job);
    let allJobs = Array.from(mergedMap.values());

    // HARD EARLY RETURN: debugScan branch
    if (debugScan) {
      allJobs = allJobs.slice(0, limit);

      // Build diagnostic stats
      const externalCRMs = new Set();
      const createdFroms = new Set();
      const externalAppointmentIdPresent = { true: 0, false: 0 };
      const externalCustomerIdPresent = { true: 0, false: 0 };
      let missingCustomerNameCount = 0;
      const samples = [];

      for (const job of allJobs) {
        if (job.externalCRM) externalCRMs.add(job.externalCRM);
        if (job.createdFrom) createdFroms.add(job.createdFrom);
        
        const hasAppId = !!job.externalAppointmentId;
        externalAppointmentIdPresent[hasAppId ? 'true' : 'false']++;
        
        const hasCustomerId = !!job.externalCustomerId;
        externalCustomerIdPresent[hasCustomerId ? 'true' : 'false']++;
        
        if (!job.customerName || job.customerName.trim() === '') {
          missingCustomerNameCount++;
        }

        samples.push({
          id: job.id,
          jobNumber: job.jobNumber,
          customerName: job.customerName || null,
          externalCRM: job.externalCRM || null,
          createdFrom: job.createdFrom || null,
          externalAppointmentId: job.externalAppointmentId || null,
          externalCustomerId: job.externalCustomerId || null,
          companyId: job.companyId || null
        });
      }

      return Response.json({
        success: true,
        context: {
          tenantId,
          companyKey,
          mode: headerCompanyId ? 'header' : (allCompanies.length === 1 ? 'single' : 'primary')
        },
        debug: {
          sampleCount: allJobs.length,
          distinct_externalCRM: Array.from(externalCRMs),
          distinct_createdFrom: Array.from(createdFroms),
          distinct_externalAppointmentId_present: externalAppointmentIdPresent,
          distinct_externalCustomerId_present: externalCustomerIdPresent,
          missingCustomerNameCount,
          samples
        }
      });
    }

    // Normal repair mode: filter to BuilderPrime jobs only
    allJobs = allJobs.filter(job => job.externalCRM === 'builder_prime');

    // Identify jobs that need repair
    const jobsToRepair = allJobs.filter(job => 
      !job.customerName || 
      job.customerName.trim() === '' || 
      job.customerName === 'Unknown Customer'
    );

    let scanned = allJobs.length;
    let updated = 0;
    let stillMissing = 0;
    const idsToUpdate = [];

    for (const job of jobsToRepair) {
      let newCustomerName = null;

      // Rule 1: Prefer current name if already valid
      if (normalizeName(job.customerName)) {
        newCustomerName = job.customerName;
      }

      // Rule 2: Try to recover from Contact
      if (!newCustomerName && job.primaryContactId) {
        try {
          const contact = await base44.entities.CRMContact.read(job.primaryContactId);
          if (contact) {
            const contactName = normalizeName(
              [contact.firstName, contact.lastName].filter(Boolean).join(' ')
            );
            if (contactName) {
              newCustomerName = contactName;
            }
          }
        } catch (e) {
          // Contact not found, continue
        }
      }

      // Rule 3: Try to recover from Account
      if (!newCustomerName && job.accountId) {
        try {
          const account = await base44.entities.CRMAccount.read(job.accountId);
          if (account) {
            const accountName = normalizeName(account.name);
            if (accountName) {
              newCustomerName = accountName;
            }
          }
        } catch (e) {
          // Account not found, continue
        }
      }

      // Rule 4: Fallback for BuilderPrime jobs
      if (!newCustomerName && (job.externalCustomerId || job.externalAppointmentId)) {
        newCustomerName = 'Unknown Customer';
      }

      // Update if name changed and is valid
      if (newCustomerName && newCustomerName !== job.customerName) {
        idsToUpdate.push(job.id);
        if (!dryRun) {
          await base44.entities.CRMJob.update(job.id, { customerName: newCustomerName });
        }
        updated++;
      } else if (!newCustomerName || newCustomerName === 'Unknown Customer') {
        stillMissing++;
      }
    }

    const mode = headerCompanyId ? 'header' : (allCompanies.length === 1 ? 'single' : 'primary');

    return Response.json({
      success: true,
      context: {
        tenantId,
        companyKey,
        mode
      },
      summary: {
        scanned,
        needsRepair: jobsToRepair.length,
        updated,
        stillMissing,
        dryRun
      },
      ...(dryRun && { idsToUpdate })
    });
  } catch (error) {
    console.error('Repair function failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});