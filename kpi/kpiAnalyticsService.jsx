/**
 * KPI ANALYTICS SERVICE
 * Master orchestrator for all KPI computations
 */

import { getCached, setCached, buildCacheKey } from './cache';
import { getSignedDealsTruthSet, getAppointmentsTruthSet, getPricingDisciplineTruthSet, getProductionTruthSet } from './truthSetService';
import { computeRevenueKpis } from './compute/computeRevenueKpis';
import { computeMarginKpis } from './compute/computeMarginKpis';
import { computePricingDisciplineKpis } from './compute/computePricingDisciplineKpis';
import { computeFunnelKpis } from './compute/computeFunnelKpis';
import { computeProductionKpis } from './compute/computeProductionKpis';
import { computeDataIntegrityKpis } from './compute/computeDataIntegrityKpis';

/**
 * Get complete KPI dashboard packet
 */
export async function getKpiDashboard({ companyId, range, filters, groupBy, forceRefresh }) {
    // Check cache
    const cacheKey = buildCacheKey(companyId, range, filters, groupBy);
    
    if (!forceRefresh) {
        const cached = getCached(cacheKey);
        if (cached) {
            return { ...cached, cache: { hit: true, key: cacheKey } };
        }
    }
    
    console.log('[KPI Analytics] Computing dashboard:', { companyId, range, filters });
    
    // Load truth sets
    const signedDeals = await getSignedDealsTruthSet({
        companyId,
        dateStart: range.start,
        dateEnd: range.end,
        ...filters
    });
    
    const appointments = await getAppointmentsTruthSet({
        companyId,
        dateStart: range.start,
        dateEnd: range.end,
        repId: filters.repId
    });
    
    const pricingDiscipline = await getPricingDisciplineTruthSet({
        companyId,
        dateStart: range.start,
        dateEnd: range.end,
        repId: filters.repId
    });
    
    const production = await getProductionTruthSet({
        companyId,
        dateStart: range.start,
        dateEnd: range.end,
        crewId: filters.crewId
    });
    
    // Compute KPI sections
    const revenueKpis = computeRevenueKpis(signedDeals, appointments);
    const marginKpis = computeMarginKpis(signedDeals);
    const pricingKpis = computePricingDisciplineKpis(signedDeals, pricingDiscipline);
    const funnelKpis = computeFunnelKpis(appointments, signedDeals);
    const productionKpis = computeProductionKpis(production);
    const integrityKpis = computeDataIntegrityKpis(signedDeals);
    
    // Build dashboard packet
    const dashboard = {
        summary: {
            signedRevenue: revenueKpis.totalRevenue,
            netProfit: marginKpis.totalNetProfit,
            netMarginPct: marginKpis.netMarginPct,
            profitPerApptRan: revenueKpis.profitPerApptRan,
            overrideRatePct: pricingKpis.overrideRatePct,
            modelCoveragePct: pricingKpis.modelCoveragePct
        },
        sections: {
            revenue: revenueKpis,
            margin: marginKpis,
            pricingDiscipline: pricingKpis,
            funnel: funnelKpis,
            production: productionKpis,
            dataIntegrity: integrityKpis
        },
        integrity: integrityKpis.summary,
        cache: { hit: false, key: cacheKey }
    };
    
    // Cache result
    setCached(cacheKey, dashboard);
    
    return dashboard;
}