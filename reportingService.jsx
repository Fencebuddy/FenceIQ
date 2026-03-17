import { base44 } from '@/api/base44Client';
import {
    getSignedDealsTruthSet,
    computeWonKpis,
    getProposalCloseSet,
    computeCloseRate
} from './ownerDashboardService';

/**
 * Reporting Service
 * Backend-safe rollup computation with snapshot-truth integrity
 */

/**
 * Compute KPIs for a date range (reuses snapshot-truth logic)
 */
export async function computeKpisForRange({ companyId, dateStart, dateEnd, repUserId, fenceCategory, source }) {
    const filters = {
        companyId,
        dateStart,
        dateEnd,
        repUserId,
        fenceCategory,
        source
    };
    
    // Get signed deals truth set
    const signedRows = await getSignedDealsTruthSet(filters);
    const wonKpis = computeWonKpis(signedRows);
    
    // Get proposal close set
    const proposalRows = await getProposalCloseSet(filters);
    const closeKpis = computeCloseRate(proposalRows);
    
    return {
        signedCount: wonKpis.signedCount,
        wonRevenue: wonKpis.wonRevenue,
        netProfitAmount: signedRows.reduce((sum, row) => sum + (row.netProfitAmount || 0), 0),
        netMarginPercentWeighted: wonKpis.netMarginPercentWeighted,
        avgTicket: wonKpis.avgTicket,
        proposalsSentCount: closeKpis.proposalsSentCount,
        proposalsSignedCount: closeKpis.proposalsSignedCount,
        closeRatePercent: closeKpis.closeRatePercent
    };
}

/**
 * Upsert daily rollup for a specific date
 */
export async function upsertDailyRollup({ companyId, rollupDate, repUserId, fenceCategory, source }) {
    // Convert rollupDate (YYYY-MM-DD) to dateStart/dateEnd boundaries
    const dateStart = new Date(rollupDate);
    dateStart.setHours(0, 0, 0, 0);
    
    const dateEnd = new Date(rollupDate);
    dateEnd.setHours(23, 59, 59, 999);
    
    // Compute KPIs for the day
    const kpis = await computeKpisForRange({
        companyId,
        dateStart: dateStart.toISOString(),
        dateEnd: dateEnd.toISOString(),
        repUserId,
        fenceCategory,
        source
    });
    
    // Build unique key query
    const query = {
        companyId,
        rollupDate
    };
    
    if (repUserId) query.repUserId = repUserId;
    else query.repUserId = null;
    
    if (fenceCategory) query.fenceCategory = fenceCategory;
    else query.fenceCategory = null;
    
    if (source) query.source = source;
    else query.source = null;
    
    // Check if exists
    const existing = await base44.entities.ReportRollupDaily.filter(query);
    
    const data = {
        companyId,
        rollupDate,
        repUserId: repUserId || null,
        fenceCategory: fenceCategory || null,
        source: source || null,
        ...kpis
    };
    
    if (existing.length > 0) {
        await base44.entities.ReportRollupDaily.update(existing[0].id, data);
        return { action: 'updated', rollupId: existing[0].id };
    } else {
        const created = await base44.entities.ReportRollupDaily.create(data);
        return { action: 'created', rollupId: created.id };
    }
}

/**
 * Upsert weekly rollup
 */
export async function upsertWeeklyRollup({ companyId, weekStartDate, repUserId, fenceCategory, source, weekStartsOn = 'mon' }) {
    // Compute week range
    const startDate = new Date(weekStartDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    
    // Compute KPIs for the week
    const kpis = await computeKpisForRange({
        companyId,
        dateStart: startDate.toISOString(),
        dateEnd: endDate.toISOString(),
        repUserId,
        fenceCategory,
        source
    });
    
    // Build unique key query
    const query = {
        companyId,
        weekStartDate
    };
    
    if (repUserId) query.repUserId = repUserId;
    else query.repUserId = null;
    
    if (fenceCategory) query.fenceCategory = fenceCategory;
    else query.fenceCategory = null;
    
    if (source) query.source = source;
    else query.source = null;
    
    // Check if exists
    const existing = await base44.entities.ReportRollupWeekly.filter(query);
    
    const data = {
        companyId,
        weekStartDate,
        repUserId: repUserId || null,
        fenceCategory: fenceCategory || null,
        source: source || null,
        ...kpis
    };
    
    if (existing.length > 0) {
        await base44.entities.ReportRollupWeekly.update(existing[0].id, data);
        return { action: 'updated', rollupId: existing[0].id };
    } else {
        const created = await base44.entities.ReportRollupWeekly.create(data);
        return { action: 'created', rollupId: created.id };
    }
}

/**
 * Run daily rollups for a company
 */
export async function runDailyRollupForCompany({ companyId, daysBack = 1 }) {
    const results = [];
    
    // Get users for per-rep rollups
    const users = await base44.entities.User.list();
    
    // For each day in range
    for (let i = 0; i < daysBack; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const rollupDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Upsert "All reps/all categories/all sources"
        const allResult = await upsertDailyRollup({
            companyId,
            rollupDate,
            repUserId: null,
            fenceCategory: null,
            source: null
        });
        results.push({ rollupDate, scope: 'all', ...allResult });
        
        // Upsert per-rep "All categories/all sources"
        for (const user of users) {
            const repResult = await upsertDailyRollup({
                companyId,
                rollupDate,
                repUserId: user.id,
                fenceCategory: null,
                source: null
            });
            results.push({ rollupDate, scope: `rep:${user.id}`, ...repResult });
        }
    }
    
    return results;
}

/**
 * Run weekly rollups for a company
 */
export async function runWeeklyRollupForCompany({ companyId, weeksBack = 8, weekStartsOn = 'mon' }) {
    const results = [];
    
    // Get users for per-rep rollups
    const users = await base44.entities.User.list();
    
    // Compute week start dates
    for (let i = 0; i < weeksBack; i++) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const targetDay = weekStartsOn === 'mon' ? 1 : 0;
        const daysToSubtract = (dayOfWeek - targetDay + 7) % 7 + (i * 7);
        
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - daysToSubtract);
        weekStart.setHours(0, 0, 0, 0);
        
        const weekStartDate = weekStart.toISOString().split('T')[0];
        
        // Upsert "All reps/all"
        const allResult = await upsertWeeklyRollup({
            companyId,
            weekStartDate,
            repUserId: null,
            fenceCategory: null,
            source: null,
            weekStartsOn
        });
        results.push({ weekStartDate, scope: 'all', ...allResult });
        
        // Upsert per-rep "All"
        for (const user of users) {
            const repResult = await upsertWeeklyRollup({
                companyId,
                weekStartDate,
                repUserId: user.id,
                fenceCategory: null,
                source: null,
                weekStartsOn
            });
            results.push({ weekStartDate, scope: `rep:${user.id}`, ...repResult });
        }
    }
    
    return results;
}