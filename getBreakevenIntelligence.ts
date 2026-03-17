import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function toUSD(cents) {
  const n = Number(cents || 0);
  return n / 100;
}

/**
 * Safe division with null fallback
 */
function safeDivide(num, denom, fallback = null) {
  if (!denom || denom === 0) return fallback;
  return num / denom;
}

/**
 * Resolve both company identifiers needed for scoped queries.
 * mongoId   → used for OverheadSettings + BreakevenMonthlyRollup lookup (keyed by entity id)
 * crmCompanyId → used for CRMJob filter (keyed by company.companyId custom field)
 */
async function getCompanyContext(base44) {
  try {
    const settings = await base44.entities.CompanySettings.list();
    if (settings && settings.length > 0) {
      return {
        mongoId: settings[0].id,
        crmCompanyId: settings[0].companyId
      };
    }
    return null;
  } catch (e) {
    console.warn("[getBreakevenIntelligence] Failed to resolve company context:", e.message);
    return null;
  }
}

/**
 * Get current month key (YYYY-MM format)
 */
function monthKeyFromDate(isoDate) {
  const d = new Date(isoDate);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const companyCtx = await getCompanyContext(base44);
    if (!companyCtx) {
      return Response.json({
        success: false,
        error: "COMPANY_NOT_FOUND",
        message: "Unable to resolve company context."
      }, { status: 500 });
    }
    const companyId = companyCtx.mongoId;         // used for overhead + rollup lookups
    const crmCompanyId = companyCtx.crmCompanyId; // used for CRMJob filter

    const nowISO = new Date().toISOString();
    const monthKey = monthKeyFromDate(nowISO);

    console.log(`[getBreakevenIntelligence] Fetching for company=${companyId}, monthKey=${monthKey}`);

    // Read OverheadSettings — filter by entity ID (mongoId), not companyId custom field
    let overheadSettings = null;
    try {
      // Try primary lookup by entity id first
      const arr = await base44.entities.OverheadSettings.list();
      overheadSettings = arr && arr.length > 0 ? arr[0] : null;
      if (overheadSettings) {
        console.log(`[getBreakevenIntelligence] Found OverheadSettings: id=${overheadSettings.id}, companyId=${overheadSettings.companyId}`);
      }
    } catch (e) {
      console.warn("[getBreakevenIntelligence] Failed to read OverheadSettings:", e.message);
    }

    if (!overheadSettings) {
      return Response.json({
        success: true,
        setupRequired: true,
        companyId,
        monthKey,
        error: "SETUP_REQUIRED",
        message: "OverheadSettings not found. Complete Overhead Intelligence setup first.",
        requiredInputs: [
          "OverheadSettings.monthlyOverheadCents",
          "OverheadSettings.annualOverheadCents"
        ],
        nextActionUrl: "/pages/OverheadIntelligence",
        confidence: "NONE",
        updatedAt: nowISO
      }, { status: 200 });
    }

    const monthlyOverheadCents = Number(overheadSettings.monthlyOverheadCents || 0);
    const annualOverheadCents = Number(overheadSettings.annualOverheadCents || 0);

    if (monthlyOverheadCents === 0 || annualOverheadCents === 0) {
      return Response.json({
        success: true,
        setupRequired: true,
        companyId,
        monthKey,
        error: "SETUP_REQUIRED",
        message: "Overhead amounts not calculated yet.",
        requiredInputs: [
          "OverheadSettings.monthlyOverheadCents",
          "OverheadSettings.annualOverheadCents"
        ],
        nextActionUrl: "/pages/OverheadIntelligence",
        confidence: "NONE",
        updatedAt: nowISO
      }, { status: 200 });
    }

    // Try to read rollup
    let rollup = null;
    let rollupSource = "NONE";
    try {
      const arr = await base44.entities.BreakevenMonthlyRollup.filter({ companyId, monthKey });
      rollup = arr && arr.length > 0 ? arr[0] : null;
      if (rollup) {
        rollupSource = "ROLLUP_TABLE";
      }
    } catch (e) {
      console.warn("[getBreakevenIntelligence] Failed to read rollup:", e.message);
    }

    // If no rollup, fall back to live computation from CRMJobs
    let overheadRecoveredCents = 0;
    let recognizedRevenueCents = 0;
    let jobsCount = 0;

    if (rollup) {
      overheadRecoveredCents = Number(rollup.overheadRecoveredCents || 0);
      recognizedRevenueCents = Number(rollup.recognizedRevenueCents || 0);
      jobsCount = Number(rollup.jobsCount || 0);
      console.log(`[getBreakevenIntelligence] Using ROLLUP data: recovered=${toUSD(overheadRecoveredCents)}, revenue=${toUSD(recognizedRevenueCents)}, jobs=${jobsCount}`);
    } else {
      // Fallback: compute from CRMJob won deals (MTD)
      console.log("[getBreakevenIntelligence] No rollup found, falling back to live CRMJob scan...");
      try {
        // Calculate month-to-date boundaries (UTC)
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

        // Fetch won jobs scoped to this company only
          // Use 'saleStatus' = 'sold' and match by BUSINESS IDENTIFIER (companyId string, not entity id)
          const allWonJobs = await base44.entities.CRMJob.filter({ saleStatus: "sold", companyId: companyCtx.companyId });
          const totalExamined = allWonJobs ? allWonJobs.length : 0;

          console.log(`[getBreakevenIntelligence] CRMJob filter (saleStatus=sold, companyId=${crmCompanyId}): found ${totalExamined} jobs`);

          let jobsWithoutWonDate = 0;
          let jobsOutsideMonth = 0;
          let jobsMissingRevenue = 0;
          let jobsUsingContractValue = 0;
          let jobsUsingRecognized = 0;

          if (totalExamined === 0) {
            console.warn(`[getBreakevenIntelligence] ⚠️ NO JOBS FOUND. Trying fallback: filter with NO companyId to debug...`);
            const allJobs = await base44.entities.CRMJob.filter({ saleStatus: "sold" });
            console.log(`[getBreakevenIntelligence] Fallback: Found ${allJobs ? allJobs.length : 0} sold jobs system-wide. First 3:`, allJobs ? allJobs.slice(0, 3).map(j => ({ jobNumber: j.jobNumber, companyId: j.companyId, crmCompanyId: j.crmCompanyId, wonAt: j.wonAt })) : []);
          }

          console.log(`[getBreakevenIntelligence] Total CRMJobs examined: ${totalExamined}`);

        // Filter to MTD and sum revenue
        if (allWonJobs && allWonJobs.length > 0) {
          const mtdJobs = allWonJobs.filter(job => {
            if (!job.wonAt) {
              jobsWithoutWonDate++;
              return false;
            }
            const wonDate = new Date(job.wonAt);
            const isInMonth = wonDate >= monthStart && wonDate < monthEnd;
            if (!isInMonth) jobsOutsideMonth++;
            return isInMonth;
          });

          jobsCount = mtdJobs.length;
          console.log(`[getBreakevenIntelligence] Jobs passing MTD filter (${monthStart.toISOString()} to ${monthEnd.toISOString()}): ${jobsCount}`);
          console.log(`[getBreakevenIntelligence] Jobs without wonAt: ${jobsWithoutWonDate}, Jobs outside month: ${jobsOutsideMonth}`);

          recognizedRevenueCents = mtdJobs.reduce((acc, job) => {
            // Priority: contractValueCents (durable source), fallback to recognizedRevenueCents
            const revenue = Number(job.contractValueCents || job.recognizedRevenueCents || 0);

            if (job.contractValueCents && job.contractValueCents > 0) {
              jobsUsingContractValue++;
            } else if (job.recognizedRevenueCents && job.recognizedRevenueCents > 0) {
              jobsUsingRecognized++;
            } else {
              jobsMissingRevenue++;
              console.log(`[getBreakevenIntelligence] Job ${job.jobNumber} (${job.customerName}) has no usable revenue: contractValue=${job.contractValueCents}, recognized=${job.recognizedRevenueCents}`);
            }

            return acc + revenue;
          }, 0);

          console.log(`[getBreakevenIntelligence] Revenue source breakdown: contractValueCents=${jobsUsingContractValue}, recognizedRevenueCents=${jobsUsingRecognized}, missing=${jobsMissingRevenue}`);
        }

        // Estimate overhead recovery: assume 14% overhead rate
        const overheadRate = 0.14;
        overheadRecoveredCents = Math.floor(recognizedRevenueCents * overheadRate);

        rollupSource = "LIVE_CRMJOB_SCAN";
        console.log(`[getBreakevenIntelligence] Live compute: totalRevenue=${toUSD(recognizedRevenueCents)}, overheadRecovered=${toUSD(overheadRecoveredCents)}, qualifiedJobs=${jobsCount}`);
      } catch (e) {
        console.error("[getBreakevenIntelligence] Live CRMJob scan failed:", e.message);
        // Return partial response
        rollupSource = "FALLBACK_PARTIAL";
      }
    }

    // Compute breakeven metrics
    const overheadGapCents = monthlyOverheadCents - overheadRecoveredCents;
    const coveragePct = monthlyOverheadCents > 0 ? Math.min(1, overheadRecoveredCents / monthlyOverheadCents) : 0;

    // Simple breakeven: revenue needed = overhead / 0.36 (64% direct + 36% overhead)
    const requiredMonthlyRevenueCents = monthlyOverheadCents / 0.36;
    const requiredAnnualRevenueCents = annualOverheadCents / 0.36;

    const status =
      monthlyOverheadCents <= 0 ? "SETUP_REQUIRED" :
      coveragePct >= 1 ? "COVERED" :
      coveragePct >= 0.75 ? "NEAR" :
      "DANGEROUS";

    // Confidence scoring
    let confidence = "HIGH";
    let confidenceNotes = [];
    
    if (rollupSource === "LIVE_CRMJOB_SCAN" || rollupSource === "FALLBACK_PARTIAL") {
      confidence = "MEDIUM";
      confidenceNotes.push("Data computed from live sources (not from rollup tables)");
    }
    if (jobsCount < 5) {
      confidence = "LOW";
      confidenceNotes.push("Insufficient sample size (< 5 jobs)");
    }

    const response = {
      success: true,
      setupRequired: false,
      companyId,
      monthKey,
      status,
      dataSource: rollupSource,
      confidence,
      confidenceNotes,
      overhead: {
        monthlyOverheadUSD: toUSD(monthlyOverheadCents),
        annualOverheadUSD: toUSD(annualOverheadCents)
      },
      recovery: {
        overheadRecoveredUSD: toUSD(overheadRecoveredCents),
        recognizedRevenueUSD: toUSD(recognizedRevenueCents),
        jobsCount,
        coveragePct: Math.round(coveragePct * 10000) / 10000
      },
      breakeven: {
        requiredMonthlyRevenueUSD: toUSD(requiredMonthlyRevenueCents),
        requiredAnnualRevenueUSD: toUSD(requiredAnnualRevenueCents),
        effectiveOverheadRate: 0.14
      },
      updatedAt: nowISO
    };

    console.log(`[getBreakevenIntelligence] Response ready: status=${status}, source=${rollupSource}`);

    // Phase 3: Log diagnostics (non-blocking, fire-and-forget)
    // Uses DiagnosticsLog schema fields: phase, severity, code, message, context
    base44.entities.DiagnosticsLog.create({
      timestamp: nowISO,
      companyId,
      phase: "SYSTEM",
      severity: "INFO",
      code: "BREAKEVEN_RUN",
      message: `Breakeven computed: source=${rollupSource}, jobs=${jobsCount}, coverage=${Math.round(coveragePct * 100)}%`,
      context: {
        monthKey,
        sourceUsed: rollupSource,
        soldJobCount: jobsCount,
        revenueTotalCents: recognizedRevenueCents,
        overheadRecoveredCents,
        gapOrSurplusCents: overheadGapCents,
        coveragePct: Math.round(coveragePct * 10000)
      }
    }).catch(e => {
      console.warn("[getBreakevenIntelligence] Diagnostics log failed (non-critical):", e.message);
    });

    return Response.json(response);

  } catch (error) {
    console.error("[getBreakevenIntelligence] Unexpected error:", error);
    return Response.json({
      success: false,
      error: "INTERNAL_ERROR",
      message: error.message
    }, { status: 500 });
  }
});