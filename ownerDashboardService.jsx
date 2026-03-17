import { base44 } from '@/api/base44Client';
import { isSoldForReporting } from './jobStatusService';

/**
 * Owner Dashboard Service
 * REWRITTEN: Simplified pricing logic to use ProposalPricingSnapshot.direct_cost as PRIMARY truth
 */

/**
 * Get owner goals from CompanySettings
 */
export async function getOwnerGoals(companyId) {
    const settings = await base44.entities.CompanySettings.filter({ id: companyId });
    if (!settings.length) {
        return {
            goalNetMarginPercent: 25,
            goalCloseRatePercent: 30,
            goalAvgTicket: 18000,
            staleProposalDays: 3
        };
    }
    
    const s = settings[0];
    return {
        goalNetMarginPercent: s.goalNetMarginPercent ?? 25,
        goalCloseRatePercent: s.goalCloseRatePercent ?? 30,
        goalAvgTicket: s.goalAvgTicket ?? 18000,
        staleProposalDays: s.staleProposalDays ?? 3
    };
}

/**
 * Get signed deals truth set (SIMPLIFIED: ProposalPricingSnapshot is primary truth)
 */
export async function getSignedDealsTruthSet({ companyId, dateStart, dateEnd, repUserId, fenceCategory, source }) {
    // Query ALL CRMJobs in company
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    
    console.log('[OwnerDashboard] Total CRMJobs:', allJobs.length);
    console.log('[OwnerDashboard] Date range:', { dateStart, dateEnd });
    
    // CRITICAL: Batch-load ALL ProposalPricingSnapshots upfront
    const allProposalSnapshots = await base44.entities.ProposalPricingSnapshot.list();
    
    console.log('[OwnerDashboard] Batch loaded:', {
        proposalSnapshots: allProposalSnapshots.length
    });

    // CRITICAL DIAGNOSTIC: Check if direct_cost exists
    const snapshotsWithDirectCost = allProposalSnapshots.filter(s => s.direct_cost && s.direct_cost > 0);
    const snapshotsWithRevenue = allProposalSnapshots.filter(s => s.agreed_subtotal && s.agreed_subtotal > 0);

    console.log('[OwnerDashboard] ⚠️ ProposalPricingSnapshot diagnostic:', {
        total: allProposalSnapshots.length,
        withRevenue: snapshotsWithRevenue.length,
        withDirectCost: snapshotsWithDirectCost.length,
        missingDirectCost: snapshotsWithRevenue.length - snapshotsWithDirectCost.length
    });

    if (snapshotsWithRevenue.length > 0 && snapshotsWithDirectCost.length === 0) {
        console.error('[OwnerDashboard] 🚨 CRITICAL: ProposalPricingSnapshot has NO direct_cost data!');
    }
    
    // Build lookup maps for O(1) access
    // CRITICAL: Index ProposalPricingSnapshot by BOTH id AND job_id
    const proposalSnapMap = new Map();
    allProposalSnapshots.forEach(pps => {
        // Index by snapshot ID (for currentProposalSnapshotId lookup)
        proposalSnapMap.set(pps.id, pps);
        // Index by job_id (for externalJobId lookup)
        if (pps.job_id) {
            proposalSnapMap.set(pps.job_id, pps);
        }
    });
    
    const truthRows = [];
    
    for (const crmJob of allJobs) {
         // MASTER RULE: Must pass isSoldForReporting check
                 const isSold = isSoldForReporting(crmJob);
                 if (!isSold) {
                     continue;
                 }

                 // Date filter: use wonAt if available (when sold), else saleStatusUpdatedAt, else created_date
                 const dateToCheck = crmJob.wonAt || crmJob.saleStatusUpdatedAt || crmJob.created_date;
                 const jobDate = new Date(dateToCheck);
                 const start = new Date(dateStart);
                 const end = new Date(dateEnd);

                 // Add 1 day to end to include jobs from today
                 end.setDate(end.getDate() + 1);

                 if (jobDate < start || jobDate > end) {
                     continue;
                 }
        
        // Apply optional filters
        if (repUserId && crmJob.assignedRepUserId !== repUserId) continue;
        if (fenceCategory && crmJob.fenceCategory !== fenceCategory) continue;
        if (source && crmJob.source !== source) continue;
        
        // Get pricing from ProposalPricingSnapshot
        let totalPrice = 0;
        let netProfitAmount = 0;
        let netProfitPercent = 0;
        let directCost = 0;
        let modelSellPrice = null;
        let presentedSellPrice = null;
        let overrideApplied = false;
        let overheadPercent = 0.14;
        let commissionPercent = 0.10;

        // PRIMARY PATH: Use currentProposalSnapshotId (most common)
        let proposalPricingSnapshot = null;
        
        if (crmJob.currentProposalSnapshotId) {
            proposalPricingSnapshot = proposalSnapMap.get(crmJob.currentProposalSnapshotId);
        }
        
        // FALLBACK: Try externalJobId (job_id index)
        if (!proposalPricingSnapshot && crmJob.externalJobId) {
            proposalPricingSnapshot = proposalSnapMap.get(crmJob.externalJobId);
        }

        if (proposalPricingSnapshot) {
            const agreedSubtotal = proposalPricingSnapshot.agreed_subtotal || 0;
            totalPrice = agreedSubtotal;
            modelSellPrice = proposalPricingSnapshot.model_sell_price;
            presentedSellPrice = proposalPricingSnapshot.presented_sell_price;
            overrideApplied = proposalPricingSnapshot.override_applied || false;
            overheadPercent = proposalPricingSnapshot.overhead_percent || 0.14;
            commissionPercent = proposalPricingSnapshot.commission_percent || 0.10;

            // CRITICAL: Use direct_cost from ProposalPricingSnapshot
            directCost = proposalPricingSnapshot.direct_cost || 0;
            
            if (directCost > 0) {
                const overhead = agreedSubtotal * overheadPercent;
                const commission = agreedSubtotal * commissionPercent;
                netProfitAmount = agreedSubtotal - directCost - overhead - commission;
                netProfitPercent = agreedSubtotal > 0 ? (netProfitAmount / agreedSubtotal) * 100 : 0;
                
                console.log('[OwnerDashboard] ✅ SUCCESS:', {
                    jobNumber: crmJob.jobNumber,
                    agreedSubtotal,
                    directCost,
                    overhead,
                    commission,
                    netProfitAmount,
                    netProfitPercent
                });
            } else {
                // ESTIMATE: Use 44% rule if no direct_cost
                const overhead = agreedSubtotal * overheadPercent;
                const commission = agreedSubtotal * commissionPercent;
                directCost = agreedSubtotal * 0.44;
                netProfitAmount = agreedSubtotal - directCost - overhead - commission;
                netProfitPercent = agreedSubtotal > 0 ? (netProfitAmount / agreedSubtotal) * 100 : 0;
                
                console.warn('[OwnerDashboard] ESTIMATE (no direct_cost):', {
                    jobNumber: crmJob.jobNumber,
                    directCost
                });
            }
        } else {
            console.warn('[OwnerDashboard] ❌ SKIP - No ProposalPricingSnapshot:', {
                jobNumber: crmJob.jobNumber,
                currentProposalSnapshotId: crmJob.currentProposalSnapshotId,
                externalJobId: crmJob.externalJobId
            });
            continue;
        }
        
        truthRows.push({
            jobId: crmJob.id,
            jobNumber: crmJob.jobNumber,
            repUserId: crmJob.assignedRepUserId,
            fenceCategory: crmJob.fenceCategory,
            source: crmJob.source,
            signedAt: crmJob.wonAt || crmJob.created_date,
            pricingSnapshotId: crmJob.currentProposalSnapshotId,
            totalPrice,
            sellPriceSubtotal: totalPrice,
            netProfitAmount,
            netProfitPercent,
            directCost,
            discountPercent: 0,
            // Upsell tracking
            modelSellPrice,
            presentedSellPrice,
            overrideApplied,
            overheadPercent,
            commissionPercent
        });
    }
    
    console.log('[OwnerDashboard] ========================================');
    console.log('[OwnerDashboard] FINAL SUMMARY:');
    console.log('[OwnerDashboard] Total jobs checked:', allJobs.length);
    console.log('[OwnerDashboard] Final truth rows (revenue/profit):', truthRows.length);
    console.log('[OwnerDashboard] ========================================');
    return truthRows;
}

/**
 * Compute won KPIs from truth rows
 */
export function computeWonKpis(truthRows) {
    const signedCount = truthRows.length;
    const wonRevenue = truthRows.reduce((sum, row) => sum + (row.totalPrice || 0), 0);
    const avgTicket = signedCount > 0 ? wonRevenue / signedCount : 0;
    
    const totalNetProfit = truthRows.reduce((sum, row) => sum + (row.netProfitAmount || 0), 0);
    const totalDirectCost = truthRows.reduce((sum, row) => sum + (row.directCost || 0), 0);
    const totalRevenue = truthRows.reduce((sum, row) => sum + (row.totalPrice || 0), 0);
    
    const netMarginPercentWeighted = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
    const grossMarginPercentWeighted = totalRevenue > 0 ? ((totalRevenue - totalDirectCost) / totalRevenue) * 100 : 0;
    
    // Upsell metrics (Model vs Presented Price)
    // CRITICAL: Only count jobs with VALID (non-zero) model prices
    const jobsWithModel = truthRows.filter(r => {
        const model = r.modelSellPrice;
        return model !== undefined && model !== null && model > 0;
    });
    
    // CORRECTED: atModel = within penny tolerance, override = anything else
    const jobsWithOverride = jobsWithModel.filter(r => {
        const model = r.modelSellPrice || 0;
        const presented = r.presentedSellPrice || 0;
        const atModel = Math.abs(presented - model) < 0.01;
        return !atModel; // Override if NOT at model
    });
    
    // Separate positive and negative overrides
    const positiveOverrides = jobsWithOverride.filter(r => {
        const delta = (r.presentedSellPrice || 0) - (r.modelSellPrice || 0);
        return delta > 0.01; // Positive upsell only
    });

    const negativeOverrides = jobsWithOverride.filter(r => {
        const delta = (r.presentedSellPrice || 0) - (r.modelSellPrice || 0);
        return delta < -0.01; // Downsell only
    });

    // Upsell delta (positive only - when presented > model)
    const totalUpsellDelta = positiveOverrides.reduce((sum, row) => {
        const delta = (row.presentedSellPrice || 0) - (row.modelSellPrice || 0);
        return sum + delta;
    }, 0);

    // Downsell delta (negative - when presented < model)
    const totalDownsellDelta = negativeOverrides.reduce((sum, row) => {
        const delta = (row.modelSellPrice || 0) - (row.presentedSellPrice || 0);
        return sum + delta;
    }, 0);
    
    // Net upside calculation
    const totalUpsellNetUpside = jobsWithOverride.reduce((sum, row) => {
        const modelSell = row.modelSellPrice || 0;
        const presentedSell = row.presentedSellPrice || 0;
        const directCost = row.directCost || 0;
        const overheadRate = row.overheadPercent || 0.14;
        const commissionRate = row.commissionPercent || 0.10;
        
        // Model net
        const modelOverhead = modelSell * overheadRate;
        const modelCommission = modelSell * commissionRate;
        const modelNet = modelSell - directCost - modelOverhead - modelCommission;
        
        // Actual net (presented price)
        const actualOverhead = presentedSell * overheadRate;
        const actualCommission = presentedSell * commissionRate;
        const actualNet = presentedSell - directCost - actualOverhead - actualCommission;
        
        // Upside = additional net profit captured
        const netUpside = Math.max(0, actualNet - modelNet);
        return sum + netUpside;
    }, 0);
    
    const overrideRate = jobsWithModel.length > 0 
        ? (jobsWithOverride.length / jobsWithModel.length) * 100 
        : 0;

    // CRITICAL: Avg Upsell = average of POSITIVE deltas only (exclude downsells)
    const avgUpsellPerOverride = positiveOverrides.length > 0
        ? totalUpsellDelta / positiveOverrides.length
        : 0;
    
    return {
        signedCount,
        wonRevenue,
        avgTicket,
        netMarginPercentWeighted,
        grossMarginPercentWeighted,
        // Upsell metrics
        totalUpsellDelta,
        totalDownsellDelta,
        totalUpsellNetUpside,
        overrideRate,
        avgUpsellPerOverride,
        jobsWithModelCount: jobsWithModel.length,
        jobsWithOverrideCount: jobsWithOverride.length,
        positiveOverrideCount: positiveOverrides.length,
        negativeOverrideCount: negativeOverrides.length
    };
}

/**
 * Get appointments count (for dashboard KPI)
 * Counts ALL jobs in date range, not just appointment syncs
 */
export async function getAppointmentsCount({ companyId, dateStart, dateEnd, repUserId }) {
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    
    const filteredJobs = allJobs.filter(job => {
        // Use created_date for date filtering
        const jobDate = new Date(job.created_date);
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        
        if (jobDate < start || jobDate > end) return false;
        
        // Exclude cancelled jobs
        if (job.stage === 'cancelled' || job.appointmentStatus === 'cancelled') return false;
        
        if (repUserId && job.assignedRepUserId !== repUserId) return false;
        
        return true;
    });
    
    return filteredJobs.length;
}

/**
 * Get demos/close rate set (counts all appointments except cancelled/no show)
 */
export async function getProposalCloseSet({ companyId, dateStart, dateEnd, repUserId, fenceCategory, source }) {
    // Query ALL CRMJobs in date range (appointments = demos)
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    
    // Batch-load legacy jobs for exclusion checks
    const externalJobIds = allJobs.map(j => j.externalJobId).filter(Boolean);
    const allLegacyJobs = externalJobIds.length > 0 ? await base44.entities.Job.list() : [];
    const legacyJobMap = new Map();
    allLegacyJobs.forEach(lj => legacyJobMap.set(lj.id, lj));

    const proposalRows = [];

    for (const crmJob of allJobs) {
        // Date filter: use created_date for appointment date
        const jobDate = new Date(crmJob.created_date);
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        end.setDate(end.getDate() + 1);

        if (jobDate < start || jobDate > end) continue;

        // Apply optional filters
        if (repUserId && crmJob.assignedRepUserId !== repUserId) continue;
        if (fenceCategory && crmJob.fenceCategory !== fenceCategory) continue;
        if (source && crmJob.source !== source) continue;

        // CRITICAL: Exclude cancelled and no-show appointments (never had a demo)
        if (crmJob.appointmentStatus === 'cancelled') {
            continue;
        }

        // Check legacy Job status for additional exclusions (use lookup map)
        if (crmJob.externalJobId) {
            const legacyJob = legacyJobMap.get(crmJob.externalJobId);

            // Exclude Cancelled and No Show from close rate
            if (legacyJob?.status === 'Cancelled' || legacyJob?.status === 'No Show') {
                continue;
            }
        }

        // This is a valid demo - check if it's signed
        const isSigned = isSoldForReporting(crmJob);

        // Determine status for close rate
        let status = 'demo_no_sale';
        if (isSigned) {
            status = 'signed';
        } else if (crmJob.lossType === 'demo_no_sale') {
            status = 'demo_no_sale';
        } else if (crmJob.lossType === 'sale_lost') {
            status = 'sale_lost';
        }

        proposalRows.push({
            jobId: crmJob.id,
            jobNumber: crmJob.jobNumber,
            repUserId: crmJob.assignedRepUserId,
            status,
            sentAt: crmJob.created_date,
            viewCount: 0,
            totalPrice: 0
        });
    }

    return proposalRows;
}

/**
 * Compute close rate from demos (all appointments except cancelled/no show)
 */
export function computeCloseRate(proposalRows) {
    // Denominator: ALL demos (all appointments that weren't cancelled/no show)
    const demosRunCount = proposalRows.length;
    
    // Numerator: signed demos only
    const signedProposals = proposalRows.filter(p => p.status === 'signed');
    const proposalsSignedCount = signedProposals.length;
    
    const closeRatePercent = demosRunCount > 0 
        ? (proposalsSignedCount / demosRunCount) * 100 
        : 0;
    
    return {
        proposalsSentCount: demosRunCount, // Renamed for backward compatibility (really demos run)
        proposalsSignedCount,
        closeRatePercent
    };
}

/**
 * Get KPI details for drawer
 */
export async function getKpiDetails({ companyId, kpiKey, dateStart, dateEnd, repUserId }) {
    const allJobs = await base44.entities.CRMJob.filter({ companyId });
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    end.setDate(end.getDate() + 1);

    if (kpiKey === 'appointments') {
        const appointments = allJobs.filter(job => {
            const jobDate = new Date(job.created_date);
            if (jobDate < start || jobDate > end) return false;
            if (repUserId && job.assignedRepUserId !== repUserId) return false;
            if (job.stage === 'cancelled' || job.appointmentStatus === 'cancelled') return false;
            return true;
        });

        const cancelled = allJobs.filter(job => {
            const jobDate = new Date(job.created_date);
            return jobDate >= start && jobDate <= end && 
                   (job.stage === 'cancelled' || job.appointmentStatus === 'cancelled');
        });

        return {
            totalAppointments: appointments.length,
            scheduledCount: appointments.filter(j => j.appointmentStatus === 'scheduled').length,
            completedCount: appointments.filter(j => j.appointmentStatus === 'completed').length,
            rescheduledCount: appointments.filter(j => j.appointmentStatus === 'rescheduled').length,
            cancelledCount: cancelled.length,
            upcomingList: appointments
                .filter(j => j.appointmentDateTime && new Date(j.appointmentDateTime) > new Date())
                .sort((a, b) => new Date(a.appointmentDateTime) - new Date(b.appointmentDateTime))
                .slice(0, 5)
                .map(j => ({
                    customerName: j.customerName || 'N/A',
                    appointmentTime: j.appointmentDateTime ? new Date(j.appointmentDateTime).toLocaleDateString() : 'N/A',
                    repName: j.assignedRepName || 'Unassigned'
                }))
        };
    }

    if (kpiKey === 'demos') {
        // Batch-load legacy jobs for exclusion checks
        const externalJobIds = allJobs.map(j => j.externalJobId).filter(Boolean);
        const allLegacyJobs = externalJobIds.length > 0 ? await base44.entities.Job.list() : [];
        const legacyJobMap = new Map();
        allLegacyJobs.forEach(lj => legacyJobMap.set(lj.id, lj));

        const demosRun = allJobs.filter(job => {
            const jobDate = new Date(job.created_date);
            if (jobDate < start || jobDate > end) return false;
            if (repUserId && job.assignedRepUserId !== repUserId) return false;
            
            // Exclude cancelled appointments
            if (job.appointmentStatus === 'cancelled') return false;
            
            // Exclude legacy cancelled/no-show
            if (job.externalJobId) {
                const legacyJob = legacyJobMap.get(job.externalJobId);
                if (legacyJob?.status === 'Cancelled' || legacyJob?.status === 'No Show') return false;
            }
            
            return true;
        });

        const wonCount = demosRun.filter(j => isSoldForReporting(j)).length;
        const demoToSalePercent = demosRun.length > 0 ? (wonCount / demosRun.length) * 100 : 0;

        const noShows = allJobs.filter(job => {
            const jobDate = new Date(job.created_date);
            if (jobDate < start || jobDate > end) return false;
            if (job.externalJobId) {
                const legacyJob = legacyJobMap.get(job.externalJobId);
                return legacyJob?.status === 'No Show';
            }
            return false;
        });

        const cancelled = allJobs.filter(job => {
            const jobDate = new Date(job.created_date);
            if (jobDate < start || jobDate > end) return false;
            return job.appointmentStatus === 'cancelled';
        });

        return {
            demosRunCount: demosRun.length,
            noShowCount: noShows.length,
            cancelledCount: cancelled.length,
            demoToSalePercent,
            recentDemos: demosRun
                .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                .slice(0, 5)
                .map(j => ({
                    jobNumber: j.jobNumber,
                    customerName: j.customerName || 'N/A',
                    sold: isSoldForReporting(j)
                }))
        };
    }

    if (kpiKey === 'sold' || kpiKey === 'revenue' || kpiKey === 'margin') {
        const signedRows = await getSignedDealsTruthSet({ 
            companyId, 
            dateStart, 
            dateEnd, 
            repUserId 
        });

        const voidedJobs = allJobs.filter(j => j.saleVoidedAt);

        const signedCount = signedRows.filter(r => {
            const job = allJobs.find(j => j.id === r.jobId);
            return job && job.saleStatus === 'sold' && !job.installStatus && !job.paymentStatus;
        }).length;

        const installedCount = signedRows.filter(r => {
            const job = allJobs.find(j => j.id === r.jobId);
            return job && job.installStatus === 'installed';
        }).length;

        const paidOnlyCount = signedRows.filter(r => {
            const job = allJobs.find(j => j.id === r.jobId);
            return job && job.paymentStatus === 'payment_received' && !job.installStatus;
        }).length;

        const topJobsByRevenue = signedRows
            .sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0))
            .slice(0, 5)
            .map(r => {
                const job = allJobs.find(j => j.id === r.jobId);
                return {
                    jobNumber: r.jobNumber,
                    customerName: job?.customerName || 'N/A',
                    totalPrice: r.totalPrice || 0
                };
            });

        if (kpiKey === 'sold') {
            return {
                jobsSoldCount: signedRows.length,
                signedCount,
                installedCount,
                paidOnlyCount,
                voidedCount: voidedJobs.length,
                topJobsByRevenue
            };
        }

        const totalRevenue = signedRows.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
        const totalNetProfit = signedRows.reduce((sum, r) => sum + (r.netProfitAmount || 0), 0);
        const avgTicket = signedRows.length > 0 ? totalRevenue / signedRows.length : 0;

        if (kpiKey === 'revenue') {
            return {
                totalRevenue,
                avgTicket,
                jobsCount: signedRows.length,
                goalRevenue: 0,
                percentToGoal: 0,
                topJobsByRevenue
            };
        }

        if (kpiKey === 'margin') {
            const netMarginPercent = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
            
            const worstMarginJobs = signedRows
                .map(r => {
                    const job = allJobs.find(j => j.id === r.jobId);
                    const marginPercent = r.totalPrice > 0 ? (r.netProfitAmount / r.totalPrice) * 100 : 0;
                    return {
                        jobNumber: r.jobNumber,
                        customerName: job?.customerName || 'N/A',
                        totalPrice: r.totalPrice || 0,
                        netProfitAmount: r.netProfitAmount || 0,
                        marginPercent
                    };
                })
                .sort((a, b) => a.marginPercent - b.marginPercent)
                .slice(0, 3);

            return {
                totalRevenue,
                totalNetProfit,
                netMarginPercent,
                jobsCount: signedRows.length,
                worstMarginJobs,
                fallbackSourceCount: 0
            };
        }
    }

    if (kpiKey === 'close_rate') {
        // Match main dashboard logic - use created_date and exclude cancelled/no-show
        const externalJobIds = allJobs.map(j => j.externalJobId).filter(Boolean);
        const allLegacyJobs = externalJobIds.length > 0 ? await base44.entities.Job.list() : [];
        const legacyJobMap = new Map();
        allLegacyJobs.forEach(lj => legacyJobMap.set(lj.id, lj));

        const demosRun = allJobs.filter(job => {
            const jobDate = new Date(job.created_date);
            if (jobDate < start || jobDate > end) return false;
            if (repUserId && job.assignedRepUserId !== repUserId) return false;
            
            // Exclude cancelled appointments
            if (job.appointmentStatus === 'cancelled') return false;
            
            // Exclude legacy cancelled/no-show
            if (job.externalJobId) {
                const legacyJob = legacyJobMap.get(job.externalJobId);
                if (legacyJob?.status === 'Cancelled' || legacyJob?.status === 'No Show') return false;
            }
            
            return true;
        });

        const wonJobs = demosRun.filter(j => isSoldForReporting(j));
        const wonCount = wonJobs.length;
        const closeRatePercent = demosRun.length > 0 ? (wonCount / demosRun.length) * 100 : 0;

        const lostDemoJobs = demosRun.filter(job => {
            return job.lossType === 'demo_no_sale' && !isSoldForReporting(job);
        });

        const lostAfterDemoJobs = demosRun.filter(job => {
            return job.lossType === 'sale_lost' && !isSoldForReporting(job);
        });

        const recentLosses = [...lostDemoJobs, ...lostAfterDemoJobs]
            .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
            .slice(0, 5)
            .map(j => ({
                jobNumber: j.jobNumber,
                customerName: j.customerName || 'N/A',
                lossStage: j.lossType === 'demo_no_sale' ? 'Demo' : 'After Demo',
                lossReason: j.lossReason || 'No reason provided'
            }));

        return {
            closeRatePercent,
            demosRunCount: demosRun.length,
            wonCount,
            lostDemoCount: lostDemoJobs.length,
            lostAfterDemoCount: lostAfterDemoJobs.length,
            recentLosses
        };
    }

    if (kpiKey === 'upsell') {
        const signedRows = await getSignedDealsTruthSet({ 
            companyId, 
            dateStart, 
            dateEnd, 
            repUserId 
        });

        const jobsWithOverride = signedRows.filter(r => {
            if (r.modelSellPrice === undefined || r.modelSellPrice === null) return false;
            const model = r.modelSellPrice || 0;
            const presented = r.presentedSellPrice || 0;
            const atModel = Math.abs(presented - model) < 0.01;
            return !atModel;
        });

        const positiveOverrides = jobsWithOverride.filter(r => {
            const delta = (r.presentedSellPrice || 0) - (r.modelSellPrice || 0);
            return delta > 0.01;
        });

        const totalUpsellDelta = positiveOverrides.reduce((sum, r) => {
            return sum + ((r.presentedSellPrice || 0) - (r.modelSellPrice || 0));
        }, 0);

        const avgUpsellPerOverride = positiveOverrides.length > 0 
            ? totalUpsellDelta / positiveOverrides.length 
            : 0;

        const topUpsellJobs = positiveOverrides
            .map(r => {
                const job = allJobs.find(j => j.id === r.jobId);
                return {
                    jobNumber: r.jobNumber,
                    customerName: job?.customerName || 'N/A',
                    modelPrice: r.modelSellPrice || 0,
                    presentedPrice: r.presentedSellPrice || 0,
                    upsellDelta: (r.presentedSellPrice || 0) - (r.modelSellPrice || 0)
                };
            })
            .sort((a, b) => b.upsellDelta - a.upsellDelta)
            .slice(0, 5);

        return {
            totalUpsellDelta,
            jobsWithOverrideCount: jobsWithOverride.length,
            positiveOverrideCount: positiveOverrides.length,
            avgUpsellPerOverride,
            topUpsellJobs
        };
    }

    if (kpiKey === 'upsell_upside') {
        const signedRows = await getSignedDealsTruthSet({ 
            companyId, 
            dateStart, 
            dateEnd, 
            repUserId 
        });

        const jobsWithOverride = signedRows.filter(r => {
            if (r.modelSellPrice === undefined || r.modelSellPrice === null) return false;
            const model = r.modelSellPrice || 0;
            const presented = r.presentedSellPrice || 0;
            const atModel = Math.abs(presented - model) < 0.01;
            return !atModel;
        });

        const totalUpsellNetUpside = jobsWithOverride.reduce((sum, row) => {
            const modelSell = row.modelSellPrice || 0;
            const presentedSell = row.presentedSellPrice || 0;
            const directCost = row.directCost || 0;
            const overheadRate = row.overheadPercent || 0.14;
            const commissionRate = row.commissionPercent || 0.10;
            
            const modelOverhead = modelSell * overheadRate;
            const modelCommission = modelSell * commissionRate;
            const modelNet = modelSell - directCost - modelOverhead - modelCommission;
            
            const actualOverhead = presentedSell * overheadRate;
            const actualCommission = presentedSell * commissionRate;
            const actualNet = presentedSell - directCost - actualOverhead - actualCommission;
            
            const netUpside = Math.max(0, actualNet - modelNet);
            return sum + netUpside;
        }, 0);

        const avgNetUpsidePerOverride = jobsWithOverride.length > 0 
            ? totalUpsellNetUpside / jobsWithOverride.length 
            : 0;

        const topNetUpsideJobs = jobsWithOverride
            .map(r => {
                const job = allJobs.find(j => j.id === r.jobId);
                const modelSell = r.modelSellPrice || 0;
                const presentedSell = r.presentedSellPrice || 0;
                const directCost = r.directCost || 0;
                const overheadRate = r.overheadPercent || 0.14;
                const commissionRate = r.commissionPercent || 0.10;
                
                const modelOverhead = modelSell * overheadRate;
                const modelCommission = modelSell * commissionRate;
                const modelNet = modelSell - directCost - modelOverhead - modelCommission;
                
                const actualOverhead = presentedSell * overheadRate;
                const actualCommission = presentedSell * commissionRate;
                const actualNet = presentedSell - directCost - actualOverhead - actualCommission;
                
                const netUpside = Math.max(0, actualNet - modelNet);

                return {
                    jobNumber: r.jobNumber,
                    customerName: job?.customerName || 'N/A',
                    netUpside
                };
            })
            .sort((a, b) => b.netUpside - a.netUpside)
            .slice(0, 5);

        return {
            totalUpsellNetUpside,
            jobsWithOverrideCount: jobsWithOverride.length,
            avgNetUpsidePerOverride,
            topNetUpsideJobs
        };
    }

    if (kpiKey === 'price_integrity') {
        const signedRows = await getSignedDealsTruthSet({ 
            companyId, 
            dateStart, 
            dateEnd, 
            repUserId 
        });

        const jobsWithModel = signedRows.filter(r => r.modelSellPrice !== undefined && r.modelSellPrice !== null);
        
        const jobsAtModel = jobsWithModel.filter(r => {
            const model = r.modelSellPrice || 0;
            const presented = r.presentedSellPrice || 0;
            const atModel = Math.abs(presented - model) < 0.01;
            return atModel;
        });

        const jobsWithOverride = jobsWithModel.filter(r => {
            const model = r.modelSellPrice || 0;
            const presented = r.presentedSellPrice || 0;
            const atModel = Math.abs(presented - model) < 0.01;
            return !atModel;
        });

        const priceIntegrityPercent = jobsWithModel.length > 0 
            ? (jobsAtModel.length / jobsWithModel.length) * 100 
            : 0;

        const atModelJobs = jobsAtModel
            .sort((a, b) => new Date(b.signedAt) - new Date(a.signedAt))
            .slice(0, 5)
            .map(r => {
                const job = allJobs.find(j => j.id === r.jobId);
                return {
                    jobNumber: r.jobNumber,
                    customerName: job?.customerName || 'N/A',
                    soldPrice: r.presentedSellPrice || 0
                };
            });

        return {
            priceIntegrityPercent,
            jobsAtModelCount: jobsAtModel.length,
            totalJobsCount: jobsWithModel.length,
            jobsWithOverrideCount: jobsWithOverride.length,
            atModelJobs
        };
    }

    if (kpiKey === 'override_rate') {
        const signedRows = await getSignedDealsTruthSet({ 
            companyId, 
            dateStart, 
            dateEnd, 
            repUserId 
        });

        const jobsWithModel = signedRows.filter(r => r.modelSellPrice !== undefined && r.modelSellPrice !== null);
        
        const jobsWithOverride = jobsWithModel.filter(r => {
            const model = r.modelSellPrice || 0;
            const presented = r.presentedSellPrice || 0;
            const atModel = Math.abs(presented - model) < 0.01;
            return !atModel;
        });

        const positiveOverrides = jobsWithOverride.filter(r => {
            const delta = (r.presentedSellPrice || 0) - (r.modelSellPrice || 0);
            return delta > 0.01;
        });

        const negativeOverrides = jobsWithOverride.filter(r => {
            const delta = (r.presentedSellPrice || 0) - (r.modelSellPrice || 0);
            return delta < -0.01;
        });

        const overrideRate = jobsWithModel.length > 0 
            ? (jobsWithOverride.length / jobsWithModel.length) * 100 
            : 0;

        const recentOverrides = jobsWithOverride
            .sort((a, b) => new Date(b.signedAt) - new Date(a.signedAt))
            .slice(0, 5)
            .map(r => {
                const job = allJobs.find(j => j.id === r.jobId);
                const delta = (r.presentedSellPrice || 0) - (r.modelSellPrice || 0);
                return {
                    jobNumber: r.jobNumber,
                    customerName: job?.customerName || 'N/A',
                    modelPrice: r.modelSellPrice || 0,
                    presentedPrice: r.presentedSellPrice || 0,
                    delta
                };
            });

        return {
            overrideRate,
            jobsWithOverrideCount: jobsWithOverride.length,
            totalJobsCount: jobsWithModel.length,
            positiveOverrideCount: positiveOverrides.length,
            negativeOverrideCount: negativeOverrides.length,
            recentOverrides
        };
    }

    if (kpiKey === 'avg_upsell') {
        const signedRows = await getSignedDealsTruthSet({ 
            companyId, 
            dateStart, 
            dateEnd, 
            repUserId 
        });

        const jobsWithModel = signedRows.filter(r => r.modelSellPrice !== undefined && r.modelSellPrice !== null);
        
        const positiveOverrides = jobsWithModel.filter(r => {
            const delta = (r.presentedSellPrice || 0) - (r.modelSellPrice || 0);
            return delta > 0.01;
        });

        const totalUpsellDelta = positiveOverrides.reduce((sum, r) => {
            return sum + ((r.presentedSellPrice || 0) - (r.modelSellPrice || 0));
        }, 0);

        const avgUpsellPerOverride = positiveOverrides.length > 0 
            ? totalUpsellDelta / positiveOverrides.length 
            : 0;

        const topUpsellJobs = positiveOverrides
            .sort((a, b) => {
                const deltaA = (a.presentedSellPrice || 0) - (a.modelSellPrice || 0);
                const deltaB = (b.presentedSellPrice || 0) - (b.modelSellPrice || 0);
                return deltaB - deltaA;
            })
            .slice(0, 5)
            .map(r => {
                const job = allJobs.find(j => j.id === r.jobId);
                return {
                    jobNumber: r.jobNumber,
                    customerName: job?.customerName || 'N/A',
                    modelPrice: r.modelSellPrice || 0,
                    presentedPrice: r.presentedSellPrice || 0,
                    upsellDelta: (r.presentedSellPrice || 0) - (r.modelSellPrice || 0)
                };
            });

        return {
            avgUpsellPerOverride,
            positiveOverrideCount: positiveOverrides.length,
            totalUpsellDelta,
            topUpsellJobs
        };
    }

    if (kpiKey === 'net_reliability') {
        const signedRows = await getSignedDealsTruthSet({ 
            companyId, 
            dateStart, 
            dateEnd, 
            repUserId 
        });

        const totalRevenue = signedRows.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
        const totalNetProfit = signedRows.reduce((sum, r) => sum + (r.netProfitAmount || 0), 0);
        const netMarginPercent = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

        const reliabilityScore = netMarginPercent >= 30 ? 'HIGH' : netMarginPercent >= 20 ? 'MED' : 'LOW';

        const jobsAbove30 = signedRows.filter(r => {
            const margin = r.totalPrice > 0 ? (r.netProfitAmount / r.totalPrice) * 100 : 0;
            return margin >= 30;
        });

        const jobsAbove20 = signedRows.filter(r => {
            const margin = r.totalPrice > 0 ? (r.netProfitAmount / r.totalPrice) * 100 : 0;
            return margin >= 20 && margin < 30;
        });

        const jobsBelow20 = signedRows.filter(r => {
            const margin = r.totalPrice > 0 ? (r.netProfitAmount / r.totalPrice) * 100 : 0;
            return margin < 20;
        });

        const marginDistribution = signedRows
            .map(r => {
                const job = allJobs.find(j => j.id === r.jobId);
                const marginPercent = r.totalPrice > 0 ? (r.netProfitAmount / r.totalPrice) * 100 : 0;
                return {
                    jobNumber: r.jobNumber,
                    customerName: job?.customerName || 'N/A',
                    marginPercent
                };
            })
            .sort((a, b) => a.marginPercent - b.marginPercent)
            .slice(0, 5);

        return {
            netMarginPercent,
            reliabilityScore,
            jobsAbove30Count: jobsAbove30.length,
            jobsAbove20Count: jobsAbove20.length,
            jobsBelow20Count: jobsBelow20.length,
            totalJobsCount: signedRows.length,
            marginDistribution
        };
    }

    return {};
}

/**
 * Get rep scoreboard
 */
export async function getRepScoreboard({ companyId, dateStart, dateEnd, fenceCategory, source }) {
    // Get signed truth set
    const signedRows = await getSignedDealsTruthSet({ 
        companyId, 
        dateStart, 
        dateEnd, 
        fenceCategory, 
        source 
    });
    
    // Get proposal close set
    const proposalRows = await getProposalCloseSet({ 
        companyId, 
        dateStart, 
        dateEnd, 
        fenceCategory, 
        source 
    });
    
    // Group by repUserId
    const repMap = new Map();
    
    // Aggregate signed deals
    for (const row of signedRows) {
        const repId = row.repUserId || 'unassigned';
        if (!repMap.has(repId)) {
            repMap.set(repId, {
                repUserId: repId,
                wonRevenue: 0,
                signedCount: 0,
                netProfitAmount: 0,
                proposalsSentCount: 0,
                proposalsSignedCount: 0
            });
        }
        
        const rep = repMap.get(repId);
        rep.wonRevenue += row.totalPrice || 0;
        rep.signedCount += 1;
        rep.netProfitAmount += row.netProfitAmount || 0;
    }
    
    // Aggregate proposals
    for (const row of proposalRows) {
        const repId = row.repUserId || 'unassigned';
        if (!repMap.has(repId)) {
            repMap.set(repId, {
                repUserId: repId,
                wonRevenue: 0,
                signedCount: 0,
                netProfitAmount: 0,
                proposalsSentCount: 0,
                proposalsSignedCount: 0
            });
        }
        
        const rep = repMap.get(repId);
        const validStatuses = ['sent', 'viewed', 'signed'];
        if (validStatuses.includes(row.status)) {
            rep.proposalsSentCount += 1;
        }
        if (row.status === 'signed') {
            rep.proposalsSignedCount += 1;
        }
    }
    
    // Load user display names
    const repUserIds = Array.from(repMap.keys()).filter(id => id !== 'unassigned');
    const users = repUserIds.length > 0 
        ? await base44.entities.User.filter({}) 
        : [];
    const userMap = new Map(users.map(u => [u.id, u.full_name || u.email]));
    
    // Aggregate upsell metrics per rep
    const repUpsellMap = new Map();
    for (const row of signedRows) {
        const repId = row.repUserId || 'unassigned';
        if (!repUpsellMap.has(repId)) {
            repUpsellMap.set(repId, {
                totalUpsellDelta: 0,
                totalUpsellNetUpside: 0,
                overrideCount: 0,
                positiveOverrideCount: 0,
                modelCount: 0
            });
        }
        
        const upsell = repUpsellMap.get(repId);
        
        if (row.modelSellPrice !== undefined && row.modelSellPrice !== null) {
            upsell.modelCount += 1;

            // CORRECTED: atModel = within penny tolerance, override = anything else
            const model = row.modelSellPrice || 0;
            const presented = row.presentedSellPrice || 0;
            const atModel = Math.abs(presented - model) < 0.01;
            const isOverride = !atModel;

            if (isOverride) {
                upsell.overrideCount += 1;

                // Track positive overrides for Avg Upsell
                const delta = (row.presentedSellPrice || 0) - (row.modelSellPrice || 0);
                if (delta > 0.01) {
                    upsell.positiveOverrideCount = (upsell.positiveOverrideCount || 0) + 1;
                    upsell.totalUpsellDelta += delta;
                }
                
                // Net upside
                const modelSell = row.modelSellPrice || 0;
                const presentedSell = row.presentedSellPrice || 0;
                const directCost = row.directCost || 0;
                const overheadRate = row.overheadPercent || 0.14;
                const commissionRate = row.commissionPercent || 0.10;
                
                const modelOverhead = modelSell * overheadRate;
                const modelCommission = modelSell * commissionRate;
                const modelNet = modelSell - directCost - modelOverhead - modelCommission;
                
                const actualOverhead = presentedSell * overheadRate;
                const actualCommission = presentedSell * commissionRate;
                const actualNet = presentedSell - directCost - actualOverhead - actualCommission;
                
                const netUpside = Math.max(0, actualNet - modelNet);
                upsell.totalUpsellNetUpside += netUpside;
            }
        }
    }
    
    // Compute final metrics
    const scoreboard = Array.from(repMap.values()).map(rep => {
        const upsellData = repUpsellMap.get(rep.repUserId) || {
            totalUpsellDelta: 0,
            totalUpsellNetUpside: 0,
            overrideCount: 0,
            positiveOverrideCount: 0,
            modelCount: 0
        };

        return {
            repUserId: rep.repUserId,
            repName: rep.repUserId === 'unassigned' 
                ? 'Unassigned' 
                : userMap.get(rep.repUserId) || 'Unknown',
            wonRevenue: rep.wonRevenue,
            signedCount: rep.signedCount,
            avgTicket: rep.signedCount > 0 ? rep.wonRevenue / rep.signedCount : 0,
            netMarginPercent: rep.wonRevenue > 0 
                ? (rep.netProfitAmount / rep.wonRevenue) * 100 
                : 0,
            proposalsSentCount: rep.proposalsSentCount,
            closeRatePercent: rep.proposalsSentCount > 0 
                ? (rep.proposalsSignedCount / rep.proposalsSentCount) * 100 
                : 0,
            // Upsell metrics
            totalUpsellDelta: upsellData.totalUpsellDelta,
            totalUpsellNetUpside: upsellData.totalUpsellNetUpside,
            overrideRate: upsellData.modelCount > 0 
                ? (upsellData.overrideCount / upsellData.modelCount) * 100 
                : 0,
            // CRITICAL: Avg Upsell = average of POSITIVE deltas only
            avgUpsellPerOverride: upsellData.positiveOverrideCount > 0
                ? upsellData.totalUpsellDelta / upsellData.positiveOverrideCount
                : 0
        };
    });
    
    // Sort by net margin desc, then close rate desc, then avg ticket desc
    scoreboard.sort((a, b) => {
        if (Math.abs(a.netMarginPercent - b.netMarginPercent) > 0.01) {
            return b.netMarginPercent - a.netMarginPercent;
        }
        if (Math.abs(a.closeRatePercent - b.closeRatePercent) > 0.01) {
            return b.closeRatePercent - a.closeRatePercent;
        }
        return b.avgTicket - a.avgTicket;
    });
    
    return scoreboard;
}