import { safeDivide, safePct, safeMean } from '../safeMath';

export function computeRevenueKpis(signedDeals, appointments) {
    const totalRevenue = signedDeals.reduce((sum, deal) => sum + (deal.agreedSubtotal || 0), 0);
    const dealCount = signedDeals.length;
    const avgTicket = safeMean(signedDeals.map(d => d.agreedSubtotal));
    
    const apptsRan = appointments.filter(a => a.status === 'RAN').length;
    const profitPerApptRan = safeDivide(totalRevenue, apptsRan);
    
    return {
        totalRevenue,
        dealCount,
        avgTicket,
        profitPerApptRan,
        cards: [
            { label: 'Signed Revenue', value: totalRevenue, format: 'currency' },
            { label: 'Deals Closed', value: dealCount, format: 'number' },
            { label: 'Avg Ticket', value: avgTicket, format: 'currency' },
            { label: 'Rev per Demo', value: profitPerApptRan, format: 'currency' }
        ]
    };
}