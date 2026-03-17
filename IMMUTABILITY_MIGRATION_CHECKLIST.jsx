# Phase 12.3.4: Import Migration Checklist

## Overview

Migrate all backend code to use the wrapped `base44` client:

```typescript
// OLD (bypasses enforcement)
import { base44 } from '@/api/base44Client';

// NEW (enforced at SDK layer)
import { base44 } from '@/components/sdkWrappers/base44ClientWrapper';
```

---

## Safe Rollout Order

### Stage 1: High-Risk Functions (snapshot writes)

These functions directly mutate snapshots and must be hardened first.

**Priority 1 (Highest Risk)**
- [ ] `functions/phase12_4_catalogRestoreFlow.js` — Restore operations
- [ ] `functions/savePricingSnapshot.js` — Creates/updates pricing snapshots
- [ ] `functions/recognizeJobRevenue.js` — Revenue recognition (updates snapshots)
- [ ] `functions/applyDirectMappingPricing.js` — Pricing engine snapshots

**Priority 2 (Medium Risk)**
- [ ] `functions/computeDeterministicPricing.js`
- [ ] `functions/computeProfitIntelligence.js`
- [ ] `functions/recognizeJobRevenue.js`
- [ ] `functions/runRollupsInternal.js`

**Priority 3 (Lower Risk — reads mostly)**
- [ ] `functions/phase12_3_snapshotImmutabilityGuard.js`
- [ ] `functions/getMonitoringMetrics.js`
- [ ] `functions/getMonitoringAlerts.js`

---

### Stage 2: Services Layer

Services used by backend functions.

- [ ] `components/services/ownerDashboardService.ts`
- [ ] `components/services/reportingService.ts`
- [ ] `components/services/jobCost/computeCurrentPricing.ts`
- [ ] `components/services/kpi/*` (all KPI computation)
- [ ] `components/services/financial/breakevenEngine.ts`
- [ ] `components/services/financial/overheadEngine.ts`

---

### Stage 3: UI Code (lower priority — usually reads only)

UI components can stay on raw base44 if they only **read**.
Only migrate if they perform writes.

- [ ] Pages that write (`pages/EditJob.js`, etc.)
- [ ] Admin panels that mutate data

---

## Migration Verification

After migrating each function:

1. **Search for raw import**
   ```bash
   grep 'from.*@/api/base44Client' functions/myFunction.js
   ```
   Should return: **(empty)**

2. **Check CI gate passes**
   ```bash
   bash scripts/ci_immutability_gate.sh
   ```
   Should return: `✅ Immutability gate passed`

3. **Test the function**
   - Run its happy path (reads should work)
   - If it writes snapshots, verify error messages now include `IMMUTABILITY_VIOLATION`

---

## Template (Copy-Paste for Migration)

### Before

```typescript
// ❌ DO NOT USE
import { base44 } from '@/api/base44Client';

export async function myBackendFunction(req: Request) {
  const client = createClientFromRequest(req);
  const jobs = await client.entities.CRMJob.list();
  // ... writes happen here ...
}
```

### After

```typescript
// ✅ CORRECT
import { base44 } from '@/components/sdkWrappers/base44ClientWrapper';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export async function myBackendFunction(req: Request) {
  const client = createClientFromRequest(req);
  // client will use wrapped base44 internally...
  
  // OR use wrapped client directly
  const jobs = await base44.entities.CRMJob.list(); // works, enforced
  // ... writes happen here, now enforced ...
}
```

---

## Rollout Phases

### ✅ Phase A: Deploy wrapper (complete)
- Wrapper created and exported
- `assertSnapshotImmutability()` marked async
- CI gate script ready

### 🔄 Phase B: Migrate high-risk functions (start here)
- Update Priority 1 functions
- Run proof test after each batch
- Confirm CI gate passes

### 🔮 Phase C: Services + remaining functions
- Migrate services layer
- Verify no regressions
- Full integration test

### 🚀 Phase D: Hardening complete
- All backend imports routed through wrapper
- CI gate active in CI/CD
- ENFORCE_MODE = true (already set)
- Proof test runs on every commit

---

## Proof Test Command

After migrations, run:

```bash
base44 functions.invoke('phase12_3_5_immutabilityProofTest', { mode: 'run_all' })
```

Expected output:

```json
{
  "status": "ok",
  "results": {
    "test_1_direct_update_throws": { "status": "PASS", "message": "..." },
    "test_2_restore_exception": { "status": "SKIPPED", "reason": "..." },
    "test_3_non_immutable_works": { "status": "PASS", "message": "..." },
    "test_4_service_role_enforced": { "status": "PASS", "message": "..." }
  }
}
```

All should be `PASS` (or `SKIPPED` if DB is empty).

---

## Gotchas

### Gotcha 1: Deno functions still use `createClientFromRequest()`

The wrapper doesn't replace `createClientFromRequest()`. Functions still do:

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req); // Raw client from request
  // ...
});
```

This is fine — the wrapper is for *importing* the canonical wrapped client for use in services/utilities, not for request-scoped clients.

**If you want request-scoped clients enforced too**, you'd need a Deno middleware layer (more invasive).

### Gotcha 2: Batch operations

If code uses `bulkUpdate()`, the wrapper intercepts it:

```typescript
// This is now enforced (will throw if batch updates immutable snapshots)
await base44.entities.ProposalPricingSnapshot.bulkUpdate([
  { id: '1', data: { ... } },
  { id: '2', data: { ... } }
]);
```

---

## Status

- [x] Wrapper created and exported
- [ ] Priority 1 functions migrated
- [ ] Services migrated
- [ ] CI gate deployed
- [ ] Proof test passing
- [ ] Remaining functions migrated

**Current target:** Complete Priority 1 by end of this phase.