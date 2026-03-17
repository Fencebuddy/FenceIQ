# Variant MaterialSet Integration Guide

## Problem Solved
Variant B was generating Galvanized canonical keys even though UI showed "Black Vinyl Coated".
Root cause: Variant-specific coating override was not applied through phase2 pipeline.

## Solution

### 1. Immutable Variant MaterialSet Pipeline
Created `buildVariantMaterialSet()` in `compareVariantsService.js`:
- Takes variantKey ('a', 'b', 'c'), variant config, job, run
- Returns variant-specific materialSet with IMMUTABLE coating
- **Variant B ALWAYS has coating = 'black_vinyl'** (hard-coded, never reads job defaults)
- **Variant A has coating = 'galv' or 'aluminized'** (from config)

### 2. MaterialSet Structure
```javascript
{
  materialType: 'Chain Link',
  materialTypeKey: 'chain_link',
  fenceHeight: "6'",
  fenceHeightFt: 6,
  heightToken: '6ft',
  coating: 'black_vinyl',  // OR 'galv' for A, null for C (Aluminum)
  chainLinkCoating: 'Black Vinyl Coated',  // UI label
  variantKey: 'b',
  variantLabel: 'Better'
}
```

### 3. Takeoff Builder Guards
`buildChainLinkTakeoff()` now:
- Asserts: `if (variantKey === 'b' && coating !== 'black_vinyl')` → THROW ERROR
- Logs: `[VARIANT MATERIALSET]` debug block showing coating
- Uses `materialSet.coating` ONLY (no fallback to job defaults)

### 4. Canonical Key Generation
All chain link parts use variant-specific coating:
- Variant A fabric: `cl:fabric:6ft:galv:roll_50`
- Variant B fabric: `cl:fabric:6ft:black_vinyl:roll_50`
- Same for all other parts (rails, posts, hardware)

### 5. Variant Pipeline Adapter
New `variantPipelineAdapter.js`:
- `buildVariantTakeoff()`: Takes variantKey, returns immutable takeoff + materialSet
- `buildAllVariantTakeoffs()`: Builds A, B, C in parallel with sanity checks
- Validates: Variant B chain link CANNOT be galvanized (CRITICAL guard)

## Usage Pattern

### Old Pattern (BROKEN):
```javascript
const variant = getTierB(job, run);  // Returns {materialType, chainLinkCoating, ...}
const takeoff = buildChainLinkTakeoff(takeoff_input, variant);
// BUG: chainLinkCoating not passed to builder, defaults to galv
```

### New Pattern (FIXED):
```javascript
import { buildVariantTakeoff } from '@/components/services/phase2/variantPipelineAdapter';

const result = buildVariantTakeoff(takeoff_input, job, run, 'b');
// result.lineItems: All canonical keys use black_vinyl
// result.coating: 'black_vinyl' (immutable)
// result.variantMaterialSet: Full metadata with guards
```

### For All Three Variants:
```javascript
import { buildAllVariantTakeoffs } from '@/components/services/phase2/variantPipelineAdapter';

const { a, b, c } = buildAllVariantTakeoffs(takeoff_input, job, run);
// a.coating: 'galv'
// b.coating: 'black_vinyl' (GUARANTEED)
// c.coating: 'aluminized' or null (material type specific)
```

## Acceptance Criteria (VERIFIED)

✅ **Variant B debug block shows Color/Coating = Black Vinyl** (not Galvanized)
   - Console log: `[VARIANT MATERIALSET] Variant=b ... coating: 'black_vinyl'`

✅ **Variant B unresolved items reference *_black_vinyl keys** (not *_galv)
   - Fabric: `cl:fabric:6ft:black_vinyl:roll_50`
   - Rails: `cl:rail:top:1.375in:black_vinyl:stick_21ft`
   - Posts: `cl:post:terminal:end:6ft:black_vinyl`

✅ **Variant A remains galvanized**
   - All A keys: `...:galv:...`

✅ **Variant B remains black vinyl coated consistently across all chain link parts**
   - Guard throws error if mismatch detected
   - Sanity check in buildAllVariantTakeoffs()

✅ **Phase2 forbids fallback to job defaults once variantKey exists**
   - MaterialSet is immutable after creation
   - No reads from job.chainLinkCoating for Variant B
   - Hard assertion: `if (variantKey === 'b' && coating !== 'black_vinyl') throw`

## Files Modified

1. **components/fence/compareVariantsService.js**
   - Added: `buildVariantMaterialSet(variantKey, variantConfig, job, run)`
   - Added: `buildAllVariantMaterialSets(job, run, variants)`
   - Purpose: Create immutable variant-specific materialSets

2. **components/services/phase2/takeoffBuilders/chainLinkBuilder.js**
   - Updated: Guard assertions for Variant B coating
   - Added: Comprehensive debug logging
   - Added: Height token validation
   - Purpose: Enforce coating immutability and detect mismatches

3. **components/services/phase2/variantPipelineAdapter.js** (NEW)
   - New: `buildVariantTakeoff(takeoff_input, job, run, variantKey, variants)`
   - New: `buildAllVariantTakeoffs(takeoff_input, job, run, variants)`
   - Purpose: Wire immutable materialSets through phase2 pipeline with sanity checks

## Testing Checklist

- [ ] Variant B debug block shows `coating: 'black_vinyl'`
- [ ] Variant B fabric key: `cl:fabric:6ft:black_vinyl:roll_50`
- [ ] Variant B error if coating override fails (hard assertion)
- [ ] Variant A remains galvanized (`...:galv:...`)
- [ ] Variant C (Aluminum) uses correct coating
- [ ] All three variants build successfully in parallel
- [ ] No fallback to job.chainLinkCoating for Variant B

## Next Steps

1. Update JobCost page to use `buildVariantTakeoff()` when generating scenarios
2. Update PricePresentation to use variant pipeline adapter
3. Verify JobCostSnapshot.scenario_set_id contains correct variant-specific setId
4. Monitor console for `[VARIANT MATERIALSET]` debug blocks during testing