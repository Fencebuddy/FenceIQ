# FENCEBUDDY V2 — NON-NEGOTIABLE CONTRACTS

## 🔒 HARD FAILS — NO EXCEPTIONS

These contracts are **authoritative**. Any violation must **BLOCK** downstream execution and surface **explicit errors** in the UI. No silent fallbacks. No "best guesses."

---

## **CONTRACT 1: PRICING EXECUTION GATES**

### Requirements
Pricing **MUST NOT** execute unless **ALL** are true:
- `geometry_checksum` exists
- `takeoff_hash` exists
- `resolveTakeoff.status === 'COMPLETE'`
- `unresolved_items.length === 0`
- Unit authority is not `BLOCKED`
- Retail anchor is valid OR being computed

### If Blocked
- `status = 'BLOCKED'`
- `blockedReasons[]` returned
- UI **MUST** display reasons with actionable fixes

### Validator
`components/engine/contracts/validatePricingGates.js`

---

## **CONTRACT 2: COLOR AUTHORITY (LOCKED ORDER)**

### Precedence Chain
1. **FenceVariant config** (materialType, fenceSystem, height, color, coating) — **PRIMARY**
2. **UCK attributes** (requiredPartsList output)
3. **MaterialCatalog** finish/color (informational only)
4. **CompanySkuMap** override (only if explicitly implemented)

### Rule
If a required part depends on color/coating, its UCK **MUST** encode it. If not encoded → V2 bug → surface error.

### Validator
`components/engine/contracts/validateColorAuthority.js`

---

## **CONTRACT 3: UNIT AUTHORITY (LOCKED)**

### Rules
- **Takeoff** declares `qty + unit` (demand)
- **Catalog** declares `unit` (supply)
- **Resolver** must:
  - Match units → OK
  - Apply explicit conversion (documented factor) → OK
  - Otherwise → **BLOCK** with `UNIT_MISMATCH`

### No Silent Conversion
Examples:
- `takeoff: each` vs `catalog: roll` → **BLOCK** unless conversion defined
- `takeoff: lf` vs `catalog: stick (10ft)` → **BLOCK** unless conversion defined

### Validator
`components/engine/contracts/validateUnitAuthority.js`

---

## **CONTRACT 4: POST REBUILD TRIGGERS**

### Geometry MUST rebuild when:
- Fence line start/end changes
- `manualLengthFt` changes
- Gate moves, snaps, unsnaps
- Line ↔ run assignment changes
- DXF/PDF import completes

### Geometry MUST NOT rebuild on:
- Pricing changes
- Catalog mapping
- Proposal display toggles

### Logging Required
Each rebuild must log:
- `trigger_type`
- `variantId`
- `previous_checksum`
- `new_checksum`

---

## **CONTRACT 5: RUN VS LINE OWNERSHIP**

### Rules
- **FenceLine** owns geometry
- **Run** is configuration/ownership reference only
- `FenceLine.assignedRunId` is the **ONLY** allowed binding
- Runs **NEVER** own geometry

---

## **CONTRACT 6: VARIANT ISOLATION LAW**

### Variants A/B/C MUST NEVER share:
- Gates
- Posts
- Takeoff items
- Resolved mappings
- Retail anchors

### Allowed to share:
- Job record
- Company settings
- MaterialCatalog
- CompanySkuMap

### Validator
`components/engine/contracts/validateVariantIsolation.js`

---

## **CONTRACT 7: RETAIL ANCHOR STORAGE**

### Rules
- Retail anchor computed **ONCE** per:
  - `variantKey + takeoff_hash + pricing_version`
- Stored in `JobCostSnapshot.retail_anchor`
- Invalidated automatically when `takeoff_hash` changes
- Historical anchors are **immutable**

### Implementation
See `SnapshotOrchestratorV2.js` → `getOrCreateJobCostSnapshot()`

---

## **CONTRACT 8: GRID IMMUTABILITY (CONTRACTUAL)**

### Locked Values
- Canvas: `2000px × 1500px`
- Grid: `40px = 10ft`
- `pixelsPerFoot = 10` (**ONLY** value allowed)

### Rule
If any engine sees a different scale → **FAIL** with `GRID_CONTRACT_BROKEN`

### Validator
`components/engine/contracts/validateGridContract.js`

---

## **CONTRACT 9: ERROR VISIBILITY**

### No Silent Fallbacks
Every blocked state **MUST** return:
- `status`
- `blockedReasons[]`
- `actionHints[]`
- `deepLink` (to fix page)

### UI Requirements
- Show blocking errors prominently
- Provide "Fix Now" buttons
- Log to DiagnosticsLog entity

---

## **CONTRACT 10: VERSIONING LAW**

### Rule
Pricing algorithm = `pricing_version: "v1.0"`

**ANY** formula change requires `v2.x` with migration rules.

### No Inline Tweaks Allowed
Must increment version and document breaking change.

---

## **ACCEPTANCE TESTS**

Before deleting V1 code:
- [ ] Geometry checksum stability (same map → same checksum)
- [ ] Takeoff hash stability (same config → same hash)
- [ ] Retail anchor immutability (reused on identical takeoff)
- [ ] Variant isolation (A/B/C no cross-contamination)
- [ ] Unit mismatch blocks pricing
- [ ] Color mismatch surfaces error
- [ ] Grid contract enforced
- [ ] No page imports banned V1 modules
- [ ] PARALLEL mode shows < $1 deviation
- [ ] All diagnostics resolved

---

## **EMERGENCY ROLLBACK**

If V2 breaks production:
```js
import { setPricingPhase, setResolverPhase, setTakeoffPhase, setGeometryPhase } from '@/components/engine/EngineAdapterV2';

// Instant rollback to V1
setPricingPhase('V1');
setResolverPhase('V1');
setTakeoffPhase('V1');
setGeometryPhase('V1');
```

V1 code remains **intact** until full V2 verification complete.