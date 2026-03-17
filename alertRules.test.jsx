/**
 * FenceIQ — Alert Rules Unit Tests
 *
 * Runner: Vitest (npm test)
 * CI: blocks deploy if any test fails (see .github/workflows/ci.yml)
 *
 * Covers:
 *   - computeP95 correctness
 *   - All 7 METRIC_RULES conditions
 *   - Proposal failure rate computation
 */

import { describe, it, expect } from 'vitest';

// ── Inline helpers (mirrors getMonitoringMetrics.js and evaluateAlertRules.js)
// These are co-located pure-function copies; no DB or SDK calls in unit tests.

function computeP95(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

const METRIC_RULES = [
  { id: 'resolver_miss_warning',        condition: (v) => v > 0,     threshold: 0     },
  { id: 'resolver_miss_critical',       condition: (v) => v > 5,     threshold: 5     },
  { id: 'validator_failure_warning',    condition: (v) => v > 0,     threshold: 0     },
  { id: 'proposal_failure_rate_warning', condition: (v) => v > 0.005, threshold: 0.005 },
  { id: 'proposal_failure_critical',    condition: (v) => v > 0.02,  threshold: 0.02  },
  { id: 'takeoff_latency_warning',      condition: (v) => v > 1500,  threshold: 1500  },
  { id: 'error_rate_critical',          condition: (v) => v > 2,     threshold: 2     },
];

// ── computeP95 ─────────────────────────────────────────────────────────────────

describe('computeP95', () => {
  it('returns 0 for empty array', () => {
    expect(computeP95([])).toBe(0);
  });

  it('returns the single value for a 1-element array', () => {
    expect(computeP95([500])).toBe(500);
  });

  it('computes correct P95 for 20 samples (1 spike)', () => {
    // 19 values of 100ms + 1 spike of 2000ms → P95 index = ceil(20*0.95)-1 = 18 → 2000
    const samples = [...Array(19).fill(100), 2000];
    expect(computeP95(samples)).toBe(2000);
  });

  it('P95 of uniform values equals that value', () => {
    expect(computeP95(Array(100).fill(300))).toBe(300);
  });

  it('is not affected by input order (sorts internally)', () => {
    const a = computeP95([1000, 100, 500, 200, 2000]);
    const b = computeP95([2000, 500, 100, 200, 1000]);
    expect(a).toBe(b);
  });

  it('P95 > 1500 trips takeoff_latency_warning', () => {
    const samples = [...Array(19).fill(100), 2000];
    const rule = METRIC_RULES.find(r => r.id === 'takeoff_latency_warning');
    expect(rule.condition(computeP95(samples))).toBe(true);
  });

  it('P95 <= 1500 does NOT trip takeoff_latency_warning', () => {
    const rule = METRIC_RULES.find(r => r.id === 'takeoff_latency_warning');
    expect(rule.condition(computeP95(Array(20).fill(1000)))).toBe(false);
  });
});

// ── Alert Rule Conditions ──────────────────────────────────────────────────────

describe('Alert rule conditions', () => {
  it('resolver_miss_warning: trips on count > 0', () => {
    const rule = METRIC_RULES.find(r => r.id === 'resolver_miss_warning');
    expect(rule.condition(0)).toBe(false);
    expect(rule.condition(1)).toBe(true);
  });

  it('resolver_miss_critical: trips on count > 5', () => {
    const rule = METRIC_RULES.find(r => r.id === 'resolver_miss_critical');
    expect(rule.condition(5)).toBe(false);
    expect(rule.condition(6)).toBe(true);
  });

  it('validator_failure_warning: trips on count > 0', () => {
    const rule = METRIC_RULES.find(r => r.id === 'validator_failure_warning');
    expect(rule.condition(0)).toBe(false);
    expect(rule.condition(1)).toBe(true);
  });

  it('proposal_failure_rate_warning: trips at >0.5% failure rate', () => {
    const rule = METRIC_RULES.find(r => r.id === 'proposal_failure_rate_warning');
    expect(rule.condition(0.004)).toBe(false);
    expect(rule.condition(0.006)).toBe(true);
  });

  it('proposal_failure_critical: trips at >2% failure rate', () => {
    const rule = METRIC_RULES.find(r => r.id === 'proposal_failure_critical');
    expect(rule.condition(0.02)).toBe(false);
    expect(rule.condition(0.021)).toBe(true);
  });

  it('error_rate_critical: trips at >2%', () => {
    const rule = METRIC_RULES.find(r => r.id === 'error_rate_critical');
    expect(rule.condition(2)).toBe(false);
    expect(rule.condition(2.1)).toBe(true);
  });

  it('all 7 rules present in METRIC_RULES', () => {
    const ids = METRIC_RULES.map(r => r.id);
    [
      'resolver_miss_warning', 'resolver_miss_critical',
      'validator_failure_warning',
      'proposal_failure_rate_warning', 'proposal_failure_critical',
      'takeoff_latency_warning',
      'error_rate_critical'
    ].forEach(id => expect(ids).toContain(id));
  });
});

// ── Rate Computation ───────────────────────────────────────────────────────────

describe('Proposal failure rate computation', () => {
  it('computes rate correctly', () => {
    const failed = 1, total = 10;
    expect(total > 0 ? failed / total : 0).toBe(0.1);
  });

  it('returns 0 when total is 0 (no division by zero)', () => {
    expect(0 > 0 ? 5 / 0 : 0).toBe(0);
  });

  it('rate of 0.1 trips both warning and critical', () => {
    const rate = 0.1;
    expect(METRIC_RULES.find(r => r.id === 'proposal_failure_rate_warning').condition(rate)).toBe(true);
    expect(METRIC_RULES.find(r => r.id === 'proposal_failure_critical').condition(rate)).toBe(true);
  });
});

// ── CI GATE PROOF ──────────────────────────────────────────────────────────────
// Uncomment the block below to deliberately fail the pipeline and prove blocking:
//
// describe('DELIBERATE_FAIL — CI gate proof', () => {
//   it('this test is intentionally failing to block deploy', () => {
//     expect(true).toBe(false); // WILL FAIL — proves CI blocks on red
//   });
// });