import { safePct } from '../safeMath';

export function computePricingDisciplineKpis(signedDeals, pricingDisciplineRows) {
    const signedCount = signedDeals.length;
    const eligibleCount = pricingDisciplineRows.length;
    const overriddenCount = pricingDisciplineRows.filter(r => r.isOverride).length;
    
    const modelCoveragePct = safePct(eligibleCount, signedCount);
    const overrideRatePct = safePct(overriddenCount, eligibleCount);
    
    return {
        modelCoveragePct,
        overrideRatePct,
        eligibleCount,
        overriddenCount,
        cards: [
            { label: 'Model Coverage', value: modelCoveragePct, format: 'percentage' },
            { label: 'Override Rate', value: overrideRatePct, format: 'percentage' },
            { label: 'Eligible Jobs', value: eligibleCount, format: 'number' },
            { label: 'Overridden', value: overriddenCount, format: 'number' }
        ]
    };
}