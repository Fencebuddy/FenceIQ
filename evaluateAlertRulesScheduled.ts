import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * PHASE 6a: Alert Rules Auto-Evaluation
 * 
 * Daily evaluation of KPI thresholds against metric floors.
 * 
 * Rules evaluated (from AlertRules constants):
 * - NET_MARGIN_FLOOR: Min acceptable net margin % (default: 20%)
 * - CLOSE_RATE_FLOOR: Min acceptable close rate % (default: 25%)
 * - PRICING_INTEGRITY_FLOOR: Min % of jobs at model price (default: 70%)
 * - AVG_TICKET_VARIANCE: Allowed variance from goal (default: ±20%)
 * 
 * Trigger: Daily 09:00 UTC (after rollup completes)
 * Output: AlertRecord written when metric breaches floor
 */

const ALERT_RULES = {
    NET_MARGIN_FLOOR: {
        name: 'net_margin_floor',
        threshold: 20,
        operator: 'min',
        description: 'Net margin below 20%'
    },
    CLOSE_RATE_FLOOR: {
        name: 'close_rate_floor',
        threshold: 25,
        operator: 'min',
        description: 'Close rate below 25%'
    },
    PRICING_INTEGRITY_FLOOR: {
        name: 'pricing_integrity_floor',
        threshold: 70,
        operator: 'min',
        description: 'Less than 70% of jobs at model price'
    },
    AVG_TICKET_VARIANCE: {
        name: 'avg_ticket_variance',
        threshold: 20,
        operator: 'variance',
        description: 'Average ticket outside ±20% of goal'
    }
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Authorization: admin or platform automation
        let isAuthorized = false;
        try {
            const user = await base44.auth.me();
            if (user?.role === 'admin') {
                isAuthorized = true;
            }
        } catch (_) {
            // Platform scheduler context — allow
            isAuthorized = true;
        }

        if (!isAuthorized) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get all companies with reporting enabled
        const allSettings = await base44.asServiceRole.entities.CompanySettings.filter({
            reportingEnabled: true
        });

        const alertResults = [];

        for (const company of allSettings) {
            const companyId = company.companyId || company.id;

            try {
                // Fetch yesterday's rollup (company-level, no rep filter)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const rollupDate = yesterday.toISOString().split('T')[0];

                const rollups = await base44.asServiceRole.entities.ReportRollupDaily.filter({
                    companyId,
                    rollupDate,
                    repUserId: null // Company-level only
                });

                if (rollups.length === 0) {
                    // No data for yesterday, skip
                    continue;
                }

                const rollup = rollups[0];

                // Evaluate each rule
                const triggeredAlerts = [];

                // Rule 1: NET_MARGIN_FLOOR
                if (rollup.netMarginPercentWeighted !== undefined && rollup.netMarginPercentWeighted !== null) {
                    const margin = rollup.netMarginPercentWeighted;
                    const rule = ALERT_RULES.NET_MARGIN_FLOOR;

                    if (margin < rule.threshold) {
                        triggeredAlerts.push({
                            rule: rule.name,
                            severity: 'WARNING',
                            metric: 'net_margin_percent',
                            value: margin,
                            threshold: rule.threshold,
                            description: `${rule.description}: ${margin.toFixed(1)}% < ${rule.threshold}%`
                        });
                    }
                }

                // Rule 2: CLOSE_RATE_FLOOR
                if (rollup.closeRatePercent !== undefined && rollup.closeRatePercent !== null) {
                    const closeRate = rollup.closeRatePercent;
                    const rule = ALERT_RULES.CLOSE_RATE_FLOOR;

                    if (closeRate < rule.threshold) {
                        triggeredAlerts.push({
                            rule: rule.name,
                            severity: 'WARNING',
                            metric: 'close_rate_percent',
                            value: closeRate,
                            threshold: rule.threshold,
                            description: `${rule.description}: ${closeRate.toFixed(1)}% < ${rule.threshold}%`
                        });
                    }
                }

                // Rule 3: PRICING_INTEGRITY_FLOOR
                // This would require pricing discipline data from a pricing snapshot
                // For now, we'll skip until that data is consistently available
                // TODO: Add when pricing integrity KPI is available

                // Rule 4: AVG_TICKET_VARIANCE
                if (rollup.avgTicket !== undefined && rollup.avgTicket !== null && company.goalAvgTicket) {
                    const avgTicket = rollup.avgTicket;
                    const goalTicket = company.goalAvgTicket;
                    const variance = Math.abs((avgTicket - goalTicket) / goalTicket) * 100;
                    const rule = ALERT_RULES.AVG_TICKET_VARIANCE;

                    if (variance > rule.threshold) {
                        triggeredAlerts.push({
                            rule: rule.name,
                            severity: 'INFO',
                            metric: 'avg_ticket_variance',
                            value: variance,
                            threshold: rule.threshold,
                            description: `${rule.description}: ${variance.toFixed(1)}% variance from goal ($${goalTicket.toFixed(0)})`
                        });
                    }
                }

                // Write alerts for triggered rules
                for (const alert of triggeredAlerts) {
                    await base44.asServiceRole.entities.AlertRecord.create({
                        companyId,
                        alertType: 'margin_insight',
                        severity: alert.severity === 'WARNING' ? 'WARN' : alert.severity,
                        title: `KPI Alert: ${alert.rule}`,
                        message: alert.description,
                        detailsJson: { metric: alert.metric, value: alert.value, threshold: alert.threshold, rollupDate, source: 'daily_evaluation' },
                        createdAt: new Date().toISOString()
                    });
                }

                alertResults.push({
                    companyId,
                    companyName: company.companyName,
                    rollupDate,
                    rulesEvaluated: Object.keys(ALERT_RULES).length,
                    alertsTriggered: triggeredAlerts.length,
                    alerts: triggeredAlerts
                });

                console.log('[AlertRules] Company evaluation:', {
                    companyId,
                    rollupDate,
                    alertsTriggered: triggeredAlerts.length
                });

            } catch (error) {
                console.error('[AlertRules] Error evaluating company:', {
                    companyId,
                    error: error.message
                });

                alertResults.push({
                    companyId,
                    companyName: company.companyName,
                    status: 'error',
                    error: error.message
                });
            }
        }

        const totalAlertsTriggered = alertResults.reduce((sum, r) => sum + (r.alertsTriggered || 0), 0);

        return Response.json({
            status: 'success',
            companiesEvaluated: alertResults.length,
            totalAlertsTriggered,
            results: alertResults
        });

    } catch (error) {
        console.error('[AlertRules] Critical error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});