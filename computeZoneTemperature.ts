import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SIGNAL_WEIGHTS = {
  SOLD_JOB: 10,
  REFERRAL: 6,
  APPT_SET: 4,
  REVIEW: 3,
  LEAD_CREATED: 2,
  DOOR_KNOCK: 1,
  DIRECT_MAIL_DROP: 1,
  NO_SHOW: 0,
  LOST_JOB: -3,
  CANCELED: -2
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { companyId, dateStart, dateEnd } = body;

  if (!companyId) return Response.json({ error: 'companyId required' }, { status: 400 });

  // Fetch all active zones for company
  const zones = await base44.asServiceRole.entities.NeighborhoodZone.filter({ companyId, active: true });

  const start = dateStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = dateEnd || new Date().toISOString().slice(0, 10);

  // Fetch all signals in date range for this company
  const allSignals = await base44.asServiceRole.entities.ZoneSignal.filter({ companyId });

  // Filter by date range
  const signals = allSignals.filter(s => s.occurredAt >= start && s.occurredAt <= end);

  const results = [];

  for (const zone of zones) {
    const zoneSignals = signals.filter(s => s.zoneId === zone.id);

    // Build breakdown
    const breakdown = {};
    let score = 0;

    for (const signal of zoneSignals) {
      const weight = SIGNAL_WEIGHTS[signal.signalType] ?? 0;
      const contribution = weight * (signal.value ?? 1);
      score += contribution;

      if (!breakdown[signal.signalType]) {
        breakdown[signal.signalType] = { count: 0, weightedTotal: 0, weight };
      }
      breakdown[signal.signalType].count += 1;
      breakdown[signal.signalType].weightedTotal += contribution;
    }

    const dateBucket = end;
    const now = new Date().toISOString();

    // Upsert ZoneTemperature row (delete existing for same bucket, then create)
    const existing = await base44.asServiceRole.entities.ZoneTemperature.filter({ companyId, zoneId: zone.id, dateBucket });
    for (const ex of existing) {
      await base44.asServiceRole.entities.ZoneTemperature.delete(ex.id);
    }

    const tempRow = await base44.asServiceRole.entities.ZoneTemperature.create({
      companyId,
      zoneId: zone.id,
      dateBucket,
      score: Math.round(score * 10) / 10,
      breakdown,
      updatedAt: now
    });

    results.push({
      zoneId: zone.id,
      zoneName: zone.name,
      score: tempRow.score,
      signalCount: zoneSignals.length,
      breakdown,
      dateBucket
    });
  }

  return Response.json({
    success: true,
    dateRange: { start, end },
    weights: SIGNAL_WEIGHTS,
    zones: results
  });
});