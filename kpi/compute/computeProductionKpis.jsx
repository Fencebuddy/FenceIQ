import { safeMean } from '../safeMath';

export function computeProductionKpis(productionRows) {
    const wipJobs = productionRows.filter(r => !r.completedAt);
    const completedJobs = productionRows.filter(r => r.completedAt);
    
    const avgDaysInStage = safeMean(wipJobs.map(r => r.daysInStage));
    
    const staleJobs = wipJobs.filter(r => r.daysInStage > 14);
    
    return {
        wipCount: wipJobs.length,
        completedCount: completedJobs.length,
        avgDaysInStage,
        staleCount: staleJobs.length,
        cards: [
            { label: 'WIP Jobs', value: wipJobs.length, format: 'number' },
            { label: 'Completed', value: completedJobs.length, format: 'number' },
            { label: 'Avg Days in Stage', value: avgDaysInStage, format: 'number' },
            { label: 'Stale Jobs (>14d)', value: staleJobs.length, format: 'number' }
        ]
    };
}