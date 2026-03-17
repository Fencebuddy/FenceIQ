import { base44 } from '@/api/base44Client';

/**
 * Dashboard Goal Engine
 * Centralized goal computation for Owner Dashboard
 */

/**
 * Get or create default goal settings for a company
 */
export async function getOrCreateGoalSettings(companyId) {
    const existing = await base44.entities.DashboardGoalSettings.filter({ companyId });
    
    if (existing.length > 0) {
        return existing[0];
    }
    
    // Create default settings with business reality values
    const defaults = {
        companyId,
        dailyRevenueGoal: 18000,
        netProfitGoalPercent: 20,
        grossMarginGoalPercent: 45,
        closeRateGoalPercent: 30,
        jobsPerLeadDayGoal: 1,
        appointmentsPerLeadDayGoal: 1,
        demosPerLeadDayGoal: 1,
        salesRepCount: 1,
        runLeadsMon: true,
        runLeadsTue: true,
        runLeadsWed: true,
        runLeadsThu: true,
        runLeadsFri: true,
        runLeadsSatEveryOther: true,
        saturdayCadenceAnchorDate: '2026-01-04' // First Saturday of 2026
    };
    
    return await base44.entities.DashboardGoalSettings.create(defaults);
}

/**
 * Check if a Saturday is an active Saturday based on anchor date
 */
function isActiveSaturday(date, anchorDate) {
    const anchor = new Date(anchorDate);
    const current = new Date(date);
    
    // Reset to midnight for accurate comparison
    anchor.setHours(0, 0, 0, 0);
    current.setHours(0, 0, 0, 0);
    
    // Calculate weeks between
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksBetween = Math.floor((current - anchor) / msPerWeek);
    
    // Active on anchor week and every other week after
    return weeksBetween % 2 === 0;
}

/**
 * Check if a date is a lead day based on settings
 */
export function isLeadDay(date, settings) {
    const d = new Date(date);
    const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Sunday is never a lead day
    if (dayOfWeek === 0) return false;
    
    // Check Monday-Friday
    if (dayOfWeek === 1 && settings.runLeadsMon) return true;
    if (dayOfWeek === 2 && settings.runLeadsTue) return true;
    if (dayOfWeek === 3 && settings.runLeadsWed) return true;
    if (dayOfWeek === 4 && settings.runLeadsThu) return true;
    if (dayOfWeek === 5 && settings.runLeadsFri) return true;
    
    // Check Saturday (every other week)
    if (dayOfWeek === 6 && settings.runLeadsSatEveryOther) {
        return isActiveSaturday(d, settings.saturdayCadenceAnchorDate);
    }
    
    return false;
}

/**
 * Count lead days in a date range
 */
export function leadDaysInRange(startDate, endDate, settings) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let count = 0;
    const current = new Date(start);
    
    while (current <= end) {
        if (isLeadDay(current, settings)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    return count;
}

/**
 * Compute all goals for a date range
 */
export function computeGoalsForRange(startDate, endDate, settings) {
    const leadDays = leadDaysInRange(startDate, endDate, settings);
    
    // Company-level goals
    const revenueGoal = settings.dailyRevenueGoal * leadDays;
    const netProfitGoal = revenueGoal * (settings.netProfitGoalPercent / 100);
    const grossProfitGoal = revenueGoal * (settings.grossMarginGoalPercent / 100);
    const jobsGoal = leadDays * settings.jobsPerLeadDayGoal;
    const appointmentsGoal = leadDays * settings.appointmentsPerLeadDayGoal;
    const demosGoal = leadDays * settings.demosPerLeadDayGoal;
    
    // Per-rep goals
    const repCount = Math.max(1, settings.salesRepCount || 1);
    const revenueGoalPerRep = revenueGoal / repCount;
    const jobsGoalPerRep = jobsGoal / repCount;
    const appointmentsGoalPerRep = appointmentsGoal / repCount;
    const demosGoalPerRep = demosGoal / repCount;
    
    return {
        leadDays,
        company: {
            revenueGoal,
            netProfitGoal,
            grossProfitGoal,
            grossMarginGoalPercent: settings.grossMarginGoalPercent,
            netProfitGoalPercent: settings.netProfitGoalPercent,
            closeRateGoalPercent: settings.closeRateGoalPercent,
            jobsGoal,
            appointmentsGoal,
            demosGoal
        },
        perRep: {
            revenueGoalPerRep,
            jobsGoalPerRep,
            appointmentsGoalPerRep,
            demosGoalPerRep
        }
    };
}