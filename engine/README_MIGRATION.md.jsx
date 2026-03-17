# FENCEBUDDY V2 ENGINE — MIGRATION GUIDE

## 🚨 CRITICAL: DO NOT DELETE V1 CODE UNTIL PARITY PASSES

## **PHASE STATUS TRACKER**

### ✅ Phase 0 — Contracts (COMPLETE)
- [x] Version constants (`versions.js`)
- [x] Checksum utilities (`checksums.js`)
- [x] Diagnostics logging (`diagnosticsService.js`)
- [x] Contract validators (`contracts/*.js`)
- [x] Entities created (DiagnosticsLog, UnitConversionMap, MapScaleConfig)

### 🟡 Phase 1 — Resolver (IN PROGRESS)
**V1 Files to Replace:**
- `components/materials/universalResolver.js` (line 29 in JobCost, PricePresentation)
- `components/materials/SavannahAuditResolver.js` (line 28 in JobCost, line 15 in PricePresentation)

**Replacement:**
- `components/engine/ResolverEngine.js` (created)

**Wiring Status:**
- [ ] JobCost.js → use `EngineAdapter.resolveTakeoff()`
- [ ] PricePresentation.js → use adapter
- [ ] GoodBetterBestTiles.js → use adapter

### 🔴 Phase 2 — Pricing (CRITICAL PATH)
**V1 Files to Replace:**
- `components/pricing/computePricing.js` (used in 4 files)
- `components/pricing/simplePricingEngine.js`
- `components/services/jobCost/computeCurrentPricing.js`

**Replacement:**
- `components/engine/PricingEngineV1Locked.js` (created)

**Wiring Status:**
- [ ] JobCost.js line 507, 530 → use `EngineAdapter.computePricing()`
- [ ] PricePresentation.js line 336, 660 → use adapter
- [ ] GoodBetterBestTiles.js line 98 → use adapter

### 🔵 Phase 3 — Snapshots
**V1 Files to Replace:**
- `components/pricing/snapshotService.js`
- `components/pricing/simplePricingEngine.js`

**Replacement:**
- `components/engine/SnapshotOrchestratorV2.js` (created)

**Wiring Status:**
- [ ] Replace all `getOrCreateTakeoffSnapshot` calls
- [ ] Replace all `calculateCurrentPricing` calls

### 🟢 Phase 4 — Geometry
**V1 Files to Replace:**
- `components/fence/postLayoutEngine.js` (used in JobDetail, JobCost)

**Replacement:**
- `components/engine/GeometryEngine.js` (created)

**Wiring Status:**
- [ ] JobDetail.js line 42, 728, 920
- [ ] JobCost.js line 32

### ⚪ Phase 5 — Takeoff (LAST)
**V1 Files to Replace:**
- `components/materials/canonicalTakeoffEngine.js` (2000+ lines, used in 7 files)

**Replacement:**
- `components/engine/TakeoffEngine.js` (created)

**Wiring Status:**
- [ ] JobDetail.js lines 39, 862, 932, 965
- [ ] JobCost.js line 16, 732
- [ ] All variant comparison code

---

## **CUTOVER PROCEDURE**

### Step 1: Enable PARALLEL Mode
```js
import { setPricingPhase } from '@/components/engine/EngineAdapterV2';
setPricingPhase('PARALLEL'); // Runs both V1 and V2, logs diffs
```

### Step 2: Monitor Diagnostics
Check `DiagnosticsLog` entity for:
- Geometry checksum mismatches
- Takeoff hash mismatches  
- Pricing deviation > $1
- Unit authority blocks
- Color authority blocks

### Step 3: Fix Violations
Address all BLOCKING diagnostics before V2 cutover.

### Step 4: Cutover to V2
```js
setPricingPhase('V2');
setResolverPhase('V2');
setTakeoffPhase('V2');
setGeometryPhase('V2');
```

### Step 5: Verify Parity
Run acceptance tests (see main prompt Section 6).

### Step 6: Delete V1 Code
Only after all tests pass:
1. Delete `components/pricing/computePricing.js`
2. Delete `components/materials/canonicalTakeoffEngine.js`
3. Delete `components/materials/universalResolver.js`
4. Delete `components/pricing/snapshotService.js`
5. Remove all V1 imports from pages

---

## **CURRENT INTEGRATION POINTS**

### JobCost.js
- Line 16: `import { buildTakeoff }` ← Phase 5
- Line 20: `import { computePricing }` ← Phase 2
- Line 29: `import { resolveLineItemsWithMappings }` ← Phase 1

### PricePresentation.js
- Line 17: `import { computePricing }` ← Phase 2
- Line 16: `import { resolveLineItemsWithMappings }` ← Phase 1
- Line 15: `import { resolveSavannahLineItems }` ← Phase 1

### JobDetail.js
- Line 39: `import { buildTakeoff }` ← Phase 5
- Line 42: `import { generatePostLayout }` ← Phase 4
- Line 58: `import { generateMapStateHash }` ← Phase 3

### GoodBetterBestTiles.js
- Line 6: `import { computePricing }` ← Phase 2
- Line 8: `import { resolveLineItemsWithMappings }` ← Phase 1

---

## **BLOCKED UNTIL COMPLETE**

Cannot delete V1 code until:
- [ ] All pages wire to EngineAdapter
- [ ] PARALLEL mode runs without errors
- [ ] Parity tests pass
- [ ] MapScaleConfig backfilled for all jobs
- [ ] Unit conversions seeded
- [ ] Production sign-off

---

## **EMERGENCY ROLLBACK**

If V2 breaks production:
```js
setPricingPhase('V1');
setResolverPhase('V1');
setTakeoffPhase('V1');
setGeometryPhase('V1');
```

V1 code remains intact until full V2 verification.