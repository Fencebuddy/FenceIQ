import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

/**
 * BREAKEVEN ROLLUP EXECUTOR
 *
 * Purpose: Run breakeven monthly rollup calculations for all companies.
 * 
 * Executes directly (not delegating) to work within service-role constraints.
 * Single source of truth for rollup data remains BreakevenMonthlyRollup entity.
 */

function monthKeyFromDate(isoDate) {
  const d = new Date(isoDate);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function resolveOverheadRateForCompany(base44, rollupCompanyId, hardFallback = 0.14) {
  try {
    const settings = await base44.entities.OverheadSettings.filter({ companyId: rollupCompanyId });
    if (settings && settings.length === 1) {
      const s = settings[0];
      const override = s.manualOverridePct != null ? Number(s.manualOverridePct) : null;
      if (override != null && isFinite(override) && override > 0) {
        const rate = override > 1 ? override / 100 : override;
        console.log(`[breakevenRollupInternal] overheadRate resolved: manualOverridePct=${override} → ${rate}`);
        return rate;
      }
      const computed = s.computedOverheadPct != null ? Number(s.computedOverheadPct) : null;
      if (computed != null && isFinite(computed) && computed > 0) {
        const rate = computed > 1 ? computed / 100 : computed;
        console.log(`[breakevenRollupInternal] overheadRate resolved: computedOverheadPct=${computed} → ${rate}`);
        return rate;
      }
    } else if (settings && settings.length > 1) {
      console.error(`[breakevenRollupInternal] OVERHEAD_SETTINGS_DUPLICATE for companyId=${rollupCompanyId} — using hardFallback`);
    }
  } catch (e) {
    console.error(`[breakevenRollupInternal] Error reading OverheadSettings for ${rollupCompanyId}: ${e.message}`);
  }
  console.warn(`[breakevenRollupInternal] overheadRate hardFallback=${hardFallback} for companyId=${rollupCompanyId}`);
  return hardFallback;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log("[breakevenRollupInternal] Starting breakeven monthly rollup...");

    // Fetch all companies
    const companies = await base44.asServiceRole.entities.CompanySettings.list();
    if (!companies || companies.length === 0) {
      return Response.json({
        success: true,
        companiesProcessed: 0,
        monthsProcessed: 0,
        rollupsCreated: 0,
        rollupsUpdated: 0,
        errors: []
      });
    }

    let totalCompaniesProcessed = 0;
    let totalMonthsProcessed = 0;
    let totalRollupsCreated = 0;
    let totalRollupsUpdated = 0;
    const errors = [];

    // For each company, scan CRM jobs and populate rollups
    for (const company of companies) {
      const rollupCompanyId = company.id;
      const crmCompanyId = company.companyId;
      console.log(`[breakevenRollupInternal] Processing company: rollupKey=${rollupCompanyId}, crmKey=${crmCompanyId}`);

      try {
        const allWonJobs = await base44.asServiceRole.entities.CRMJob.filter({ status: "won", companyId: crmCompanyId });
        if (!allWonJobs || allWonJobs.length === 0) {
          console.log(`[breakevenRollupInternal] No won jobs for crmKey=${crmCompanyId}`);
          continue;
        }

        // Group by monthKey
        const monthGroups = {};
        allWonJobs.forEach(job => {
          if (!job.wonAt) return;
          const monthKey = monthKeyFromDate(job.wonAt);
          if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = [];
          }
          monthGroups[monthKey].push(job);
        });

        // Process each month group
        for (const [monthKey, jobs] of Object.entries(monthGroups)) {
          console.log(`[breakevenRollupInternal] Processing ${rollupCompanyId}/${monthKey}: ${jobs.length} jobs`);

          // Compute metrics
          const jobsCount = jobs.length;
          const recognizedRevenueCents = jobs.reduce((acc, job) => {
            const revenue = Number(job.contractValueCents || job.recognizedRevenueCents || 0);
            return acc + revenue;
          }, 0);

          const overheadRate = await resolveOverheadRateForCompany(base44, rollupCompanyId);
          const overheadRecoveredCents = Math.floor(recognizedRevenueCents * overheadRate);

          try {
            const existing = await base44.asServiceRole.entities.BreakevenMonthlyRollup.filter({
              companyId: rollupCompanyId,
              monthKey
            });

            if (existing && existing.length > 0) {
              const rollupId = existing[0].id;
              await base44.asServiceRole.entities.BreakevenMonthlyRollup.update(rollupId, {
                jobsCount,
                recognizedRevenueCents,
                overheadRecoveredCents,
                lastComputedAt: new Date().toISOString()
              });
              totalRollupsUpdated++;
              console.log(`[breakevenRollupInternal] Updated rollup: ${rollupCompanyId}/${monthKey}`);
            } else {
              await base44.asServiceRole.entities.BreakevenMonthlyRollup.create({
                companyId: rollupCompanyId,
                monthKey,
                jobsCount,
                recognizedRevenueCents,
                overheadRecoveredCents,
                lastComputedAt: new Date().toISOString()
              });
              totalRollupsCreated++;
              console.log(`[breakevenRollupInternal] Created rollup: ${rollupCompanyId}/${monthKey}`);
            }
            totalMonthsProcessed++;
          } catch (e) {
            const msg = `Failed to upsert rollup ${rollupCompanyId}/${monthKey}: ${e.message}`;
            console.error(`[breakevenRollupInternal] ${msg}`);
            errors.push(msg);
          }
        }

        totalCompaniesProcessed++;
      } catch (e) {
        const msg = `Failed processing company ${rollupCompanyId}: ${e.message}`;
        console.error(`[breakevenRollupInternal] ${msg}`);
        errors.push(msg);
      }
    }

    console.log(`[breakevenRollupInternal] Complete: ${totalCompaniesProcessed} companies, ${totalMonthsProcessed} months, ${totalRollupsCreated} created, ${totalRollupsUpdated} updated`);

    return Response.json({
      success: true,
      companiesProcessed: totalCompaniesProcessed,
      monthsProcessed: totalMonthsProcessed,
      rollupsCreated: totalRollupsCreated,
      rollupsUpdated: totalRollupsUpdated,
      errors
    });

  } catch (error) {
    const errorMsg = error?.message || String(error);
    console.error("[breakevenRollupInternal] Unexpected error:", errorMsg);
    return Response.json({
      success: false,
      error: "INTERNAL_ERROR",
      message: errorMsg
    }, { status: 500 });
  }
});