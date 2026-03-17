# FENCEBUDDY V2 ENGINE — ARCHITECTURE

## 🚨 NON-NEGOTIABLE CONTRACTS

### DO NOT BREAK THESE RULES:

1. **VERSIONING LAW (0.1)**: Every breaking change MUST increment version constant
2. **PRICING GATES (0.2)**: No pricing without validated inputs
3. **COLOR AUTHORITY (0.3)**: Color/coating from variant config only
4. **UNIT AUTHORITY (0.4)**: No implicit conversions
5. **POST REBUILD TRIGGERS (0.5)**: Deterministic rebuild only
6. **RUN VS LINE (0.6)**: Lines are geometry, Runs are config
7. **VARIANT ISOLATION (0.7)**: No cross-variant contamination
8. **RETAIL ANCHOR (0.8)**: Computed once, frozen per takeoff_hash
9. **GRID IMMUTABILITY (0.9)**: MapScaleConfig immutable per job
10. **ERROR VISIBILITY (0.10)**: No silent failures

## 📁 File Structure

```
components/engine/
├── versions.js              # Version constants + compatibility checker
├── checksums.js             # Deterministic hashing (geometry, takeoff, pricing)
├── GeometryEngine.js        # Geometry computation + validation
├── TakeoffEngine.js         # UCK generation from geometry
├── ResolverEngine.js        # UCK → Catalog mapping with unit authority
├── PricingEngineV1Locked.js # Locked pricing formulas (v1.0)
├── ProposalBuilder.js       # Proposal snapshot generation
├── SnapshotService.js       # Snapshot CRUD + invalidation
├── EngineAdapter.js         # Main adapter interface (V1/V2/SHADOW)
├── diagnosticsService.js    # Error logging + surfacing
├── DiagnosticsPanel.js      # UI: Error visibility panel
├── UnresolvedItemsPanel.js  # UI: Unresolved items with fixes
├── ParityTester.js          # UI: V1/V2 comparison tool
├── EngineModeToggle.js      # UI: Switch V1/V2/SHADOW
└── README.md                # This file
```

## 🔄 Data Flow

```
Map Edit → Geometry Engine → Takeoff Engine → Resolver Engine → Pricing Engine → Proposal Builder
    ↓              ↓                ↓                 ↓                 ↓              ↓
geometry_checksum  takeoff_hash     resolution     pricing_breakdown  ProposalSnapshot
    ↓              ↓                ↓                 ↓
TakeoffSnapshot invalidated    JobCostSnapshot invalidated
```

## 🧪 Testing Strategy

1. **Unit Tests**: Each engine independently
2. **Integration Tests**: Full pipeline V1 vs V2
3. **Shadow Mode**: Production comparison without risk
4. **Parity Report**: Automated diff detection

## 🚀 Cutover Checklist

- [ ] All contracts implemented
- [ ] Diagnostics panel shows all errors
- [ ] Shadow mode parity tests pass
- [ ] Retail anchor reuse working
- [ ] Unit conversions data-driven
- [ ] Version incompatibility errors surface
- [ ] MapScaleConfig backfilled for legacy jobs
- [ ] Post rebuild triggers logged
- [ ] No silent failures remain
- [ ] Delete V1 legacy code only after sign-off

## 🔒 Locked Formulas

**PRICING_VERSION = "v1.0"** — DO NOT MODIFY

See `PricingEngineV1Locked.js` for exact formulas.

## 📊 Entities Added

- `DiagnosticsLog` — Error/warning logging with deep links
- `UnitConversionMap` — Data-driven unit conversions
- `MapScaleConfig` — Immutable map scale per job

## 🎯 Acceptance Tests

See SECTION 6 in master prompt for full test suite.