import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Phase 12.1: Schedule Probe Check
 * 
 * Validates that critical automations are actually running on schedule.
 * Fires CRITICAL alert if any automation has gone stale (not run within 2x expected interval).
 * 
 * This is a deadman detector that *proves* monitoring is alive (not just coded).
 */

const AUTOMATIONS_TO_MONITOR = [
  { name: 'evaluateAlertRules', expectedIntervalMinutes: 5 },
  { name: 'runRollupsInternal', expectedIntervalMinutes: 60 },
  { name: 'phase11_rollout', expectedIntervalMinutes: 1440 } // daily
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const probeResults = [];

    for (const automation of AUTOMATIONS_TO_MONITOR) {
      try {
        // Fetch latest proof record
        const proofs = await base44.asServiceRole.entities.AutomationScheduleProof
          .filter({ automationName: automation.name }, '-lastSeenAt', 1)
          .catch(() => []);

        const proof = proofs?.[0];

        if (!proof) {
          // Never seen — automation likely not running
          probeResults.push({
            automationName: automation.name,
            status: 'NEVER_SEEN',
            severity: 'CRITICAL',
            actionRequired: true
          });

          // Fire alert
          await base44.asServiceRole.entities.AlertEvent?.create?.({
            rule: 'SCHEDULE_PROBE_AUTOMATION_MISSING',
            severity: 'CRITICAL',
            title: `Automation never recorded: ${automation.name}`,
            description: `${automation.name} has no execution records. Automation may not be scheduled.`,
            metric: 'schedule_probe',
            value: 0,
            threshold: 1,
            tags: { automationName: automation.name, environment: 'production' },
            timestamp: now.toISOString(),
            firedAt: now.toISOString()
          }).catch(() => null);

          continue;
        }

        // Check staleness
        const lastSeenTime = new Date(proof.lastSeenAt);
        const ageMinutes = (now.getTime() - lastSeenTime.getTime()) / 60000;
        const maxAgeMinutes = automation.expectedIntervalMinutes * 2;

        let status = 'healthy';
        let severity = null;

        if (ageMinutes > maxAgeMinutes) {
          status = 'STALE';
          severity = 'CRITICAL';
        } else if (ageMinutes > automation.expectedIntervalMinutes * 1.5) {
          status = 'SLOW';
          severity = 'WARNING';
        }

        probeResults.push({
          automationName: automation.name,
          status,
          lastSeenAt: proof.lastSeenAt,
          ageMinutes: Math.round(ageMinutes),
          maxAgeMinutes,
          severity,
          actionRequired: severity !== null
        });

        // Fire alert if stale
        if (status === 'STALE') {
          await base44.asServiceRole.entities.AlertEvent?.create?.({
            rule: 'SCHEDULE_PROBE_STALE',
            severity: 'CRITICAL',
            title: `Automation stale: ${automation.name}`,
            description: `${automation.name} has not run for ${Math.round(ageMinutes)}min (threshold ${maxAgeMinutes}min)`,
            metric: 'schedule_probe_age_minutes',
            value: ageMinutes,
            threshold: maxAgeMinutes,
            tags: { automationName: automation.name, environment: 'production' },
            timestamp: now.toISOString(),
            firedAt: now.toISOString()
          }).catch(() => null);
        }

      } catch (error) {
        probeResults.push({
          automationName: automation.name,
          status: 'ERROR',
          error: error.message
        });
      }
    }

    // Update proof records' status field based on age
    for (const proof of (await base44.asServiceRole.entities.AutomationScheduleProof.filter({})).catch(() => [])) {
      const lastSeenTime = new Date(proof.lastSeenAt);
      const ageMinutes = (now.getTime() - lastSeenTime.getTime()) / 60000;
      const automation = AUTOMATIONS_TO_MONITOR.find(a => a.name === proof.automationName);
      
      if (automation) {
        const newStatus = ageMinutes > automation.expectedIntervalMinutes * 2
          ? 'stale'
          : 'healthy';

        if (proof.status !== newStatus) {
          await base44.asServiceRole.entities.AutomationScheduleProof
            .update(proof.id, { status: newStatus })
            .catch(() => null);
        }
      }
    }

    return Response.json({
      status: 'ok',
      probeResults,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('[ScheduleProbe] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});