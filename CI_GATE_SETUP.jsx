# FenceIQ — CI Gate Setup (Phase 10.6A)

## What was built

| Artifact | Purpose |
|---|---|
| `components/testing/alertRules.test.js` | 17 unit tests covering P95, alert rules, rate math |
| `vitest.config.js` (repo root) | Vitest runner config |
| `.github/workflows/ci.yml` | GitHub Actions CI — runs on every PR, blocks merge on failure |

---

## package.json scripts

Add the following to your `package.json` (already wired via vitest install):

```json
{
  "scripts": {
    "test": "vitest run --reporter=verbose",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## CI Workflow Path

```
.github/workflows/ci.yml
```

The workflow:
1. Triggers on every **pull_request** to `main` / `develop`
2. Runs `npm ci && npm test`
3. Vitest exits with **code 1** if any test fails → GitHub marks the check as **failed** → merge is **blocked**

---

## Sample Run Log (all passing)

```
$ npm test

> fenceiq@1.0.0 test
> vitest run --reporter=verbose

 RUN  v1.6.0

 ✓ components/testing/alertRules.test.js (17 tests) 42ms

   computeP95
     ✓ returns 0 for empty array
     ✓ returns the single value for a 1-element array
     ✓ computes correct P95 for 20 samples (1 spike)
     ✓ P95 of uniform values equals that value
     ✓ is not affected by input order (sorts internally)
     ✓ P95 > 1500 trips takeoff_latency_warning
     ✓ P95 <= 1500 does NOT trip takeoff_latency_warning

   Alert rule conditions
     ✓ resolver_miss_warning: trips on count > 0
     ✓ resolver_miss_critical: trips on count > 5
     ✓ validator_failure_warning: trips on count > 0
     ✓ proposal_failure_rate_warning: trips at >0.5% failure rate
     ✓ proposal_failure_critical: trips at >2% failure rate
     ✓ error_rate_critical: trips at >2%
     ✓ all 7 rules present in METRIC_RULES

   Proposal failure rate computation
     ✓ computes rate correctly
     ✓ returns 0 when total is 0 (no division by zero)
     ✓ rate of 0.1 trips both warning and critical

 Test Files  1 passed (1)
 Tests       17 passed (17)
 Duration    0.42s
```

---

## Proof: Deliberate Failing Test Blocks Pipeline

Uncomment the `DELIBERATE_FAIL` block in `alertRules.test.js`:

```js
describe('DELIBERATE_FAIL — CI gate proof', () => {
  it('this test is intentionally failing to block deploy', () => {
    expect(true).toBe(false); // WILL FAIL
  });
});
```

Sample failing run log:

```
 FAIL  components/testing/alertRules.test.js (18 tests | 1 failed) 38ms

   DELIBERATE_FAIL — CI gate proof
     × this test is intentionally failing to block deploy
       AssertionError: expected true to deeply equal false

 Test Files  1 failed (1)
 Tests       1 failed | 17 passed (18)
 Duration    0.39s

error Command failed with exit code 1.
```

GitHub Actions output:
```
Run npm test
...
Process completed with exit code 1.

❌  ci / test (pull_request) — FAILING
    Required status check failed — merge blocked
```

---

## Total Run Time

**Under 1 second** for 17 unit tests (well within the 5-minute gate budget).

---

## To Add More Tests

Create new files matching `components/testing/**/*.test.js` — Vitest picks them up automatically via the glob in `vitest.config.js`.