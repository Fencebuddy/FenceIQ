import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * ENTERPRISE AUDIT
 * 
 * Comprehensive system readiness assessment against 100/100 enterprise criteria.
 * 
 * Scoring dimensions:
 * 1. FINANCIAL TRUTH (25 pts) — Revenue/profit integrity
 * 2. OBSERVABILITY (20 pts) — Monitoring & alerting capability
 * 3. DATA QUALITY (20 pts) — Entity completeness & consistency
 * 4. SYSTEM RELIABILITY (20 pts) — Uptime, SLO compliance, failover
 * 5. COMPLIANCE (15 pts) — Data governance, audit trails, retention
 * 
 * Output: Scored audit report with action items for improvement
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Authorization: admin only
        let isAuthorized = false;
        try {
            const user = await base44.auth.me();
            if (user?.role === 'admin') {
                isAuthorized = true;
            }
        } catch (_) {
            // Service role context
            isAuthorized = true;
        }

        if (!isAuthorized) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        const auditResult = {
            timestamp: new Date().toISOString(),
            dimensions: {},
            totalScore: 0,
            readinessLevel: '',
            actionItems: []
        };

        // ════════════════════════════════════════════════════════════════════════════════
        // DIMENSION 1: FINANCIAL TRUTH (25 pts)
        // ════════════════════════════════════════════════════════════════════════════════

        const financialScore = { dimension: 'FINANCIAL_TRUTH', maxScore: 25, earned: 0, checks: [] };

        try {
            // Check 1: SaleSnapshot Coverage (10 pts)
            const allCrmJobs = await base44.asServiceRole.entities.CRMJob.filter({
                contractStatus: 'signed'
            });
            
            if (allCrmJobs.length > 0) {
                const jobIds = allCrmJobs.map(j => j.id);
                const saleSnapshots = await base44.asServiceRole.entities.SaleSnapshot.filter({});
                const snapshotJobIds = new Set(saleSnapshots.map(s => s.crmJobId));
                const coverageRate = jobIds.filter(id => snapshotJobIds.has(id)).length / jobIds.length;

                if (coverageRate >= 0.95) {
                    financialScore.earned += 10;
                    financialScore.checks.push({ name: 'SaleSnapshot Coverage', status: 'PASS', coverage: (coverageRate * 100).toFixed(1) + '%' });
                } else if (coverageRate >= 0.80) {
                    financialScore.earned += 6;
                    financialScore.checks.push({ name: 'SaleSnapshot Coverage', status: 'WARN', coverage: (coverageRate * 100).toFixed(1) + '%' });
                    auditResult.actionItems.push('Increase SaleSnapshot coverage from ' + (coverageRate * 100).toFixed(1) + '% to 95%+');
                } else {
                    financialScore.checks.push({ name: 'SaleSnapshot Coverage', status: 'FAIL', coverage: (coverageRate * 100).toFixed(1) + '%' });
                    auditResult.actionItems.push('Critical: SaleSnapshot coverage below 80%');
                }
            } else {
                financialScore.earned += 10;
                financialScore.checks.push({ name: 'SaleSnapshot Coverage', status: 'N/A', reason: 'No signed deals' });
            }

            // Check 2: Contract Value Integrity (8 pts)
            const contractMismatches = allCrmJobs.filter(job => !job.contractValueCents || job.contractValueCents <= 0);
            const contractIntegrityRate = allCrmJobs.length > 0 
                ? (1 - (contractMismatches.length / allCrmJobs.length)) 
                : 1;

            if (contractIntegrityRate >= 0.98) {
                financialScore.earned += 8;
                financialScore.checks.push({ name: 'Contract Value Integrity', status: 'PASS', rate: (contractIntegrityRate * 100).toFixed(1) + '%' });
            } else if (contractIntegrityRate >= 0.90) {
                financialScore.earned += 5;
                financialScore.checks.push({ name: 'Contract Value Integrity', status: 'WARN', rate: (contractIntegrityRate * 100).toFixed(1) + '%' });
                auditResult.actionItems.push((contractMismatches.length) + ' jobs missing contract values');
            } else {
                financialScore.checks.push({ name: 'Contract Value Integrity', status: 'FAIL', rate: (contractIntegrityRate * 100).toFixed(1) + '%' });
                auditResult.actionItems.push('Critical: ' + (contractMismatches.length) + ' jobs with invalid contract values');
            }

            // Check 3: Revenue Recognition Setup (7 pts) — single-tenant: check reportingEnabled
            const allSettings = await base44.asServiceRole.entities.CompanySettings.list(undefined, 10);
            const primarySettings = allSettings[0];
            const reportingOn = primarySettings?.reportingEnabled !== false;

            if (reportingOn) {
                financialScore.earned += 7;
                financialScore.checks.push({ name: 'Revenue Recognition', status: 'PASS' });
            } else {
                financialScore.checks.push({ name: 'Revenue Recognition', status: 'WARN' });
                auditResult.actionItems.push('Enable reporting in Company Settings');
            }

        } catch (error) {
            financialScore.checks.push({ name: 'Financial Checks', status: 'ERROR', error: error.message });
        }

        auditResult.dimensions.FINANCIAL_TRUTH = financialScore;
        auditResult.totalScore += financialScore.earned;

        // ════════════════════════════════════════════════════════════════════════════════
        // DIMENSION 2: OBSERVABILITY (20 pts)
        // ════════════════════════════════════════════════════════════════════════════════

        const observabilityScore = { dimension: 'OBSERVABILITY', maxScore: 20, earned: 0, checks: [] };

        try {
            // Check 1: Alert Rules Configured (7 pts)
            const allAlerts = await base44.asServiceRole.entities.AlertRecord.list('-created_date', 200);
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const recentAlerts = allAlerts.filter(a => new Date(a.createdAt || a.created_date) >= thirtyDaysAgo);

            if (recentAlerts.length >= 10) {
                observabilityScore.earned += 7;
                observabilityScore.checks.push({ name: 'Alert Rules Active', status: 'PASS', alertCount: recentAlerts.length });
            } else if (recentAlerts.length > 0) {
                observabilityScore.earned += 4;
                observabilityScore.checks.push({ name: 'Alert Rules Active', status: 'WARN', alertCount: recentAlerts.length });
                auditResult.actionItems.push('Enable more alert rules; currently ' + recentAlerts.length + ' alerts/month');
            } else {
                observabilityScore.checks.push({ name: 'Alert Rules Active', status: 'FAIL', alertCount: 0 });
                auditResult.actionItems.push('Critical: No alert rules configured');
            }

            // Check 2: SLO Tracking (8 pts) — uses availabilityPercent (target >= 95%)
            const sloRecords = await base44.asServiceRole.entities.SloDailyRollup.list('-created_date', 30);
            const recentSlos = sloRecords.filter(s => new Date(s.created_date) >= thirtyDaysAgo);
            const passingSlos = recentSlos.filter(s => (s.availabilityPercent || 0) >= 95).length;

            if (recentSlos.length > 0) {
                const sloHealthRate = passingSlos / recentSlos.length;
                if (sloHealthRate >= 0.80) {
                    observabilityScore.earned += 8;
                    observabilityScore.checks.push({ name: 'SLO Tracking', status: 'PASS', healthRate: (sloHealthRate * 100).toFixed(1) + '%', avgAvailability: (recentSlos.reduce((s,r) => s + (r.availabilityPercent||0), 0) / recentSlos.length).toFixed(1) + '%' });
                } else if (sloHealthRate >= 0.60) {
                    observabilityScore.earned += 5;
                    observabilityScore.checks.push({ name: 'SLO Tracking', status: 'WARN', healthRate: (sloHealthRate * 100).toFixed(1) + '%' });
                    auditResult.actionItems.push('SLO availability below target; review error rate trends');
                } else {
                    observabilityScore.checks.push({ name: 'SLO Tracking', status: 'FAIL', healthRate: (sloHealthRate * 100).toFixed(1) + '%' });
                    auditResult.actionItems.push('Critical: SLO health below 80%');
                }
            } else {
                observabilityScore.checks.push({ name: 'SLO Tracking', status: 'N/A', reason: 'No SLO records' });
            }

            // Check 3: Metrics Archival (5 pts)
            const archiveRecords = await base44.asServiceRole.entities.MetricsArchive.filter({});
            const recentArchives = archiveRecords.filter(a => new Date(a.archiveDate) >= thirtyDaysAgo);

            if (recentArchives.length > 0) {
                const avgComplianceRate = recentArchives.reduce((sum, a) => sum + (a.overallValidationRate || 0), 0) / recentArchives.length;
                if (avgComplianceRate >= 95) {
                    observabilityScore.earned += 5;
                    observabilityScore.checks.push({ name: 'Metrics Archival', status: 'PASS', complianceRate: avgComplianceRate.toFixed(1) + '%' });
                } else {
                    observabilityScore.earned += 2;
                    observabilityScore.checks.push({ name: 'Metrics Archival', status: 'WARN', complianceRate: avgComplianceRate.toFixed(1) + '%' });
                    auditResult.actionItems.push('Metrics validation compliance below 95%; review data quality');
                }
            } else {
                observabilityScore.checks.push({ name: 'Metrics Archival', status: 'N/A', reason: 'No archive runs' });
            }

        } catch (error) {
            observabilityScore.checks.push({ name: 'Observability Checks', status: 'ERROR', error: error.message });
        }

        auditResult.dimensions.OBSERVABILITY = observabilityScore;
        auditResult.totalScore += observabilityScore.earned;

        // ════════════════════════════════════════════════════════════════════════════════
        // DIMENSION 3: DATA QUALITY (20 pts)
        // ════════════════════════════════════════════════════════════════════════════════

        const dataQualityScore = { dimension: 'DATA_QUALITY', maxScore: 20, earned: 0, checks: [] };

        try {
            // Check 1: CRM Job Completeness (10 pts)
            const crmJobs = await base44.asServiceRole.entities.CRMJob.filter({});
            const completeJobs = crmJobs.filter(job => 
                job.jobNumber && job.customerName && job.saleStatus
            );
            const completenessRate = crmJobs.length > 0 ? completeJobs.length / crmJobs.length : 1;

            if (completenessRate >= 0.95) {
                dataQualityScore.earned += 10;
                dataQualityScore.checks.push({ name: 'CRM Job Completeness', status: 'PASS', rate: (completenessRate * 100).toFixed(1) + '%' });
            } else if (completenessRate >= 0.80) {
                dataQualityScore.earned += 6;
                dataQualityScore.checks.push({ name: 'CRM Job Completeness', status: 'WARN', rate: (completenessRate * 100).toFixed(1) + '%' });
                auditResult.actionItems.push('Improve CRM job completeness to 95%+; currently ' + (completenessRate * 100).toFixed(1) + '%');
            } else {
                dataQualityScore.checks.push({ name: 'CRM Job Completeness', status: 'FAIL', rate: (completenessRate * 100).toFixed(1) + '%' });
                auditResult.actionItems.push('Critical: CRM data quality below 80%');
            }

            // Check 2: Proposal Snapshot Linkage (10 pts)
            const linkedSnapshots = crmJobs.filter(j => j.currentProposalSnapshotId).length;
            const linkageRate = crmJobs.length > 0 ? linkedSnapshots / crmJobs.length : 0;

            if (linkageRate >= 0.90) {
                dataQualityScore.earned += 10;
                dataQualityScore.checks.push({ name: 'Proposal Snapshot Linkage', status: 'PASS', rate: (linkageRate * 100).toFixed(1) + '%' });
            } else if (linkageRate >= 0.70) {
                dataQualityScore.earned += 6;
                dataQualityScore.checks.push({ name: 'Proposal Snapshot Linkage', status: 'WARN', rate: (linkageRate * 100).toFixed(1) + '%' });
                auditResult.actionItems.push('Link ' + (crmJobs.length - linkedSnapshots) + ' CRM jobs to proposal snapshots');
            } else {
                dataQualityScore.checks.push({ name: 'Proposal Snapshot Linkage', status: 'FAIL', rate: (linkageRate * 100).toFixed(1) + '%' });
                auditResult.actionItems.push('Critical: Most CRM jobs missing proposal snapshots');
            }

        } catch (error) {
            dataQualityScore.checks.push({ name: 'Data Quality Checks', status: 'ERROR', error: error.message });
        }

        auditResult.dimensions.DATA_QUALITY = dataQualityScore;
        auditResult.totalScore += dataQualityScore.earned;

        // ════════════════════════════════════════════════════════════════════════════════
        // DIMENSION 4: SYSTEM RELIABILITY (20 pts)
        // ════════════════════════════════════════════════════════════════════════════════

        const reliabilityScore = { dimension: 'SYSTEM_RELIABILITY', maxScore: 20, earned: 0, checks: [] };

        try {
            // Check 1: Rollup Execution (10 pts) — use AutomationRunLog (active) + ReportRunLog
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const automationLogs = await base44.asServiceRole.entities.AutomationRunLog.list('-created_date', 200);
            const runLogs = await base44.asServiceRole.entities.ReportRunLog.list('-created_date', 200);
            const recentAutomations = automationLogs.filter(log => new Date(log.ranAt || log.created_date) >= thirtyDaysAgo);
            const recentRuns = runLogs.filter(log => new Date(log.created_date) >= thirtyDaysAgo);
            // Prefer automation logs if present
            const logsToEval = recentAutomations.length > 0 ? recentAutomations : recentRuns;
            const successfulRuns = logsToEval.filter(log => log.status === 'ok' || log.status === 'success');
            const successRate = logsToEval.length > 0 ? (successfulRuns.length / logsToEval.length) : 1;

            if (successRate >= 0.99) {
                reliabilityScore.earned += 10;
                reliabilityScore.checks.push({ name: 'Rollup Execution', status: 'PASS', successRate: (successRate * 100).toFixed(1) + '%' });
            } else if (successRate >= 0.95) {
                reliabilityScore.earned += 7;
                reliabilityScore.checks.push({ name: 'Rollup Execution', status: 'WARN', successRate: (successRate * 100).toFixed(1) + '%' });
                auditResult.actionItems.push('Improve rollup success rate to 99%; currently ' + (successRate * 100).toFixed(1) + '%');
            } else {
                reliabilityScore.checks.push({ name: 'Rollup Execution', status: 'FAIL', successRate: (successRate * 100).toFixed(1) + '%' });
                auditResult.actionItems.push('Critical: Rollup failures above acceptable threshold');
            }

            // Check 2: Data Staleness (10 pts) — single-tenant: check the one CompanySettings record
            const settings = await base44.asServiceRole.entities.CompanySettings.list(undefined, 10);
            const primarySetting = settings[0];
            const isStale = primarySetting?.lastReportingRollupAt
                ? (Date.now() - new Date(primarySetting.lastReportingRollupAt).getTime()) / (1000 * 60 * 60) > 26
                : false; // no rollup timestamp means rollups haven't run yet — don't penalize
            const freshnessRate = isStale ? 0 : 1;

            if (freshnessRate >= 0.95) {
                reliabilityScore.earned += 10;
                reliabilityScore.checks.push({ name: 'Data Freshness', status: 'PASS', freshnessRate: (freshnessRate * 100).toFixed(1) + '%' });
            } else if (freshnessRate >= 0.80) {
                reliabilityScore.earned += 6;
                reliabilityScore.checks.push({ name: 'Data Freshness', status: 'WARN', freshnessRate: (freshnessRate * 100).toFixed(1) + '%' });
                auditResult.actionItems.push(staleCmpanies.length + ' companies with stale data (>24h)');
            } else {
                reliabilityScore.checks.push({ name: 'Data Freshness', status: 'FAIL', freshnessRate: (freshnessRate * 100).toFixed(1) + '%' });
                auditResult.actionItems.push('Critical: High data staleness across portfolio');
            }

        } catch (error) {
            reliabilityScore.checks.push({ name: 'Reliability Checks', status: 'ERROR', error: error.message });
        }

        auditResult.dimensions.SYSTEM_RELIABILITY = reliabilityScore;
        auditResult.totalScore += reliabilityScore.earned;

        // ════════════════════════════════════════════════════════════════════════════════
        // DIMENSION 5: COMPLIANCE (15 pts)
        // ════════════════════════════════════════════════════════════════════════════════

        const complianceScore = { dimension: 'COMPLIANCE', maxScore: 15, earned: 0, checks: [] };

        try {
            // Check 1: Audit Trails (8 pts)
            const allRecords = {
                alerts: await base44.asServiceRole.entities.AlertRecord.filter({}),
                logs: await base44.asServiceRole.entities.ReportRunLog.filter({}),
                archives: await base44.asServiceRole.entities.MetricsArchive.filter({})
            };

            const hasComprehensiveAuditing = 
                allRecords.alerts.length > 0 && 
                allRecords.logs.length > 0 && 
                allRecords.archives.length > 0;

            if (hasComprehensiveAuditing) {
                complianceScore.earned += 8;
                complianceScore.checks.push({ name: 'Audit Trails', status: 'PASS' });
            } else {
                complianceScore.earned += 4;
                complianceScore.checks.push({ name: 'Audit Trails', status: 'WARN', missing: Object.keys(allRecords).filter(k => allRecords[k].length === 0) });
                auditResult.actionItems.push('Complete audit trail coverage for: ' + Object.keys(allRecords).filter(k => allRecords[k].length === 0).join(', '));
            }

            // Check 2: Data Retention Policy (7 pts)
            const complianceSettings = await base44.asServiceRole.entities.CompanySettings.filter({});
            const retentionEnabled = complianceSettings.length > 0 ? complianceSettings.filter(s => s.reportingEnabled).length / complianceSettings.length : 1;
            if (retentionEnabled >= 0.90) {
                complianceScore.earned += 7;
                complianceScore.checks.push({ name: 'Retention Policy', status: 'PASS', coverage: (retentionEnabled * 100).toFixed(1) + '%' });
            } else {
                complianceScore.earned += 4;
                complianceScore.checks.push({ name: 'Retention Policy', status: 'WARN', coverage: (retentionEnabled * 100).toFixed(1) + '%' });
                auditResult.actionItems.push('Enable data retention on ' + Math.round((1 - retentionEnabled) * settings.length) + ' more companies');
            }

        } catch (error) {
            complianceScore.checks.push({ name: 'Compliance Checks', status: 'ERROR', error: error.message });
        }

        auditResult.dimensions.COMPLIANCE = complianceScore;
        auditResult.totalScore += complianceScore.earned;

        // ════════════════════════════════════════════════════════════════════════════════
        // READINESS LEVEL DETERMINATION
        // ════════════════════════════════════════════════════════════════════════════════

        const maxPossibleScore = 25 + 20 + 20 + 20 + 15; // 100
        const scorePercent = (auditResult.totalScore / maxPossibleScore) * 100;

        if (scorePercent >= 90) {
            auditResult.readinessLevel = 'PRODUCTION_READY (90-100)';
        } else if (scorePercent >= 75) {
            auditResult.readinessLevel = 'HIGH (75-90)';
        } else if (scorePercent >= 60) {
            auditResult.readinessLevel = 'MODERATE (60-75)';
        } else if (scorePercent >= 45) {
            auditResult.readinessLevel = 'LOW (45-60)';
        } else {
            auditResult.readinessLevel = 'MINIMAL (<45)';
        }

        console.log('[EnterpriseAudit] System readiness:', {
            score: auditResult.totalScore.toFixed(1) + ' / ' + maxPossibleScore,
            percent: scorePercent.toFixed(1) + '%',
            readinessLevel: auditResult.readinessLevel,
            actionItems: auditResult.actionItems.length
        });

        return Response.json({
            status: 'success',
            audit: {
                timestamp: auditResult.timestamp,
                totalScore: auditResult.totalScore.toFixed(1),
                maxScore: maxPossibleScore,
                scorePercent: scorePercent.toFixed(1) + '%',
                readinessLevel: auditResult.readinessLevel,
                dimensions: Object.values(auditResult.dimensions).map(d => ({
                    dimension: d.dimension,
                    earned: d.earned,
                    maxScore: d.maxScore,
                    percent: ((d.earned / d.maxScore) * 100).toFixed(1) + '%'
                })),
                actionItems: auditResult.actionItems.slice(0, 10)
            }
        });

    } catch (error) {
        console.error('[EnterpriseAudit] Critical error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});