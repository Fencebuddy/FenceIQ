import { safeDivide, safePct, safeMean } from '../safeMath';

export function computeMarginKpis(signedDeals) {
    const dealsWithCost = signedDeals.filter(d => d.integrityStatus !== 'MISSING_COST');
    
    const totalRevenue = dealsWithCost.reduce((sum, d) => sum + d.agreedSubtotal, 0);
    const totalNetProfit = dealsWithCost.reduce((sum, d) => sum + d.netProfit, 0);
    
    const netMarginPct = safePct(totalNetProfit, totalRevenue);
    const avgProfitPerDeal = safeMean(dealsWithCost.map(d => d.netProfit));
    
    const lowMarginDeals = dealsWithCost.filter(d => d.netMarginPct < 20);
    
    return {
        totalNetProfit,
        netMarginPct,
        avgProfitPerDeal,
        lowMarginCount: lowMarginDeals.length,
        cards: [
            { label: 'Net Profit', value: totalNetProfit, format: 'currency' },
            { label: 'Net Margin', value: netMarginPct, format: 'percentage' },
            { label: 'Avg Profit/Deal', value: avgProfitPerDeal, format: 'currency' },
            { label: 'Low Margin Deals', value: lowMarginDeals.length, format: 'number' }
        ]
    };
}