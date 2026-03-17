import { useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Plus, Edit2 } from 'lucide-react';

const SIGNAL_WEIGHTS = {
  SOLD_JOB: 10, REFERRAL: 6, APPT_SET: 4, REVIEW: 3, LEAD_CREATED: 2,
  DOOR_KNOCK: 1, DIRECT_MAIL_DROP: 1, NO_SHOW: 0, LOST_JOB: -3, CANCELED: -2
};

function computeScore(signals, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const filtered = signals.filter(s => s.occurredAt >= cutoffStr);
  let score = 0;
  const breakdown = {};

  for (const sig of filtered) {
    const w = SIGNAL_WEIGHTS[sig.signalType] ?? 0;
    const contribution = w * (sig.value ?? 1);
    score += contribution;
    if (!breakdown[sig.signalType]) breakdown[sig.signalType] = 0;
    breakdown[sig.signalType]++;
  }

  return { score: Math.round(score * 10) / 10, breakdown, count: filtered.length };
}

function TrendArrow({ score7, score30 }) {
  const trend = score7 - (score30 / 4); // compare 7d rate vs 30d avg rate
  if (trend > 1) return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend < -1) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

function ScoreBadge({ score }) {
  if (score >= 20) return <span className="font-bold text-green-600">{score}</span>;
  if (score >= 8) return <span className="font-bold text-amber-600">{score}</span>;
  if (score > 0) return <span className="font-bold text-blue-600">{score}</span>;
  if (score < 0) return <span className="font-bold text-red-500">{score}</span>;
  return <span className="text-slate-400">0</span>;
}

function TopSignals({ breakdown }) {
  const entries = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (entries.length === 0) return <span className="text-slate-400 text-xs">No signals</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([type, count]) => (
        <Badge key={type} variant="secondary" className="text-xs">
          {type.replace(/_/g, ' ')} ×{count}
        </Badge>
      ))}
    </div>
  );
}

export default function ZoneScoreTable({ zones, signals, onAddSignal, onEditZone }) {
  const rows = useMemo(() => {
    return zones.map(zone => {
      const zoneSignals = signals.filter(s => s.zoneId === zone.id);
      const s7 = computeScore(zoneSignals, 7);
      const s30 = computeScore(zoneSignals, 30);
      return { zone, s7, s30, totalSignals: zoneSignals.length };
    }).sort((a, b) => b.s30.score - a.s30.score);
  }, [zones, signals]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg mb-2">No zones yet</p>
        <p className="text-sm">Create your first neighborhood zone to start tracking temperature</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
            <th className="text-left py-3 px-4">Zone</th>
            <th className="text-center py-3 px-4">7d Score</th>
            <th className="text-center py-3 px-4">30d Score</th>
            <th className="text-center py-3 px-4">Trend</th>
            <th className="text-left py-3 px-4">Top Signals (30d)</th>
            <th className="text-right py-3 px-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ zone, s7, s30 }) => (
            <tr key={zone.id} className="hover:bg-slate-50 transition-colors">
              <td className="py-3 px-4">
                <div className="font-semibold text-slate-800">{zone.name}</div>
                {(zone.city || zone.zipCodes?.length > 0) && (
                  <div className="text-xs text-slate-400 mt-0.5">
                    {zone.city && <span>{zone.city}</span>}
                    {zone.zipCodes?.length > 0 && <span className="ml-1">({zone.zipCodes.slice(0, 3).join(', ')}{zone.zipCodes.length > 3 ? '…' : ''})</span>}
                  </div>
                )}
              </td>
              <td className="py-3 px-4 text-center text-lg">
                <ScoreBadge score={s7.score} />
              </td>
              <td className="py-3 px-4 text-center text-lg">
                <ScoreBadge score={s30.score} />
              </td>
              <td className="py-3 px-4 text-center">
                <div className="flex justify-center">
                  <TrendArrow score7={s7.score} score30={s30.score} />
                </div>
              </td>
              <td className="py-3 px-4">
                <TopSignals breakdown={s30.breakdown} />
              </td>
              <td className="py-3 px-4">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => onEditZone(zone)}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onAddSignal(zone.id)} className="text-[#006FBA] border-[#006FBA]">
                    <Plus className="w-3 h-3 mr-1" />Signal
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}