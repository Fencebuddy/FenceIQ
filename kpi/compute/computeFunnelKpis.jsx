import { safePct } from '../safeMath';

export function computeFunnelKpis(appointments, signedDeals) {
    const apptsSet = appointments.filter(a => a.status === 'SET').length;
    const apptsRan = appointments.filter(a => a.status === 'RAN').length;
    const apptsCanceled = appointments.filter(a => a.status === 'CANCELED').length;
    
    const signed = signedDeals.length;
    
    const runRate = safePct(apptsRan, apptsSet);
    const closeRate = safePct(signed, apptsRan);
    
    return {
        apptsSet,
        apptsRan,
        apptsCanceled,
        signed,
        runRate,
        closeRate,
        cards: [
            { label: 'Appts Set', value: apptsSet, format: 'number' },
            { label: 'Demos Ran', value: apptsRan, format: 'number' },
            { label: 'Run Rate', value: runRate, format: 'percentage' },
            { label: 'Close Rate', value: closeRate, format: 'percentage' }
        ]
    };
}