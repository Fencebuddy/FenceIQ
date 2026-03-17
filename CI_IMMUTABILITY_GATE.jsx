# Phase 12.3.4: CI Gate — Immutability Wrapper Enforcement

## Purpose

Prevent code from bypassing immutability enforcement by importing raw `base44` directly.

**Rule:** No backend code (functions/, components/services/) may import raw `base44` except in the canonical wrapper (`components/sdkWrappers/base44ClientWrapper.ts`).

---

## Implementation

### Grep-based CI gate (add to your CI pipeline)

```bash
#!/bin/bash

# Fail if any backend file imports raw "base44" (except wrapper + test helper)
VIOLATIONS=$(grep -r 'from.*["\047]@/api/base44Client["\047]' \
  functions/ \
  components/services/ \
  components/sdkWrappers/\
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  | grep -v 'base44ClientWrapper.ts' \
  | grep -v 'phase12_3_5_immutabilityProofTest' \
  | wc -l)

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "❌ IMMUTABILITY GATE FAILED: Raw base44 imports detected"
  grep -r 'from.*["\047]@/api/base44Client["\047]' \
    functions/ \
    components/services/ \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    | grep -v 'base44ClientWrapper.ts' \
    | grep -v 'phase12_3_5_immutabilityProofTest'
  exit 1
fi

echo "✅ Immutability gate passed: All base44 imports properly routed through wrapper"
```

### Usage in GitHub Actions

```yaml
- name: Immutability CI Gate
  run: |
    bash scripts/ci_immutability_gate.sh
  if: github.event_name == 'pull_request'
```

---

## Exceptions

Only these files may import raw `base44`:

1. **`components/sdkWrappers/base44ClientWrapper.ts`** — the canonical wrapper
2. **Test harness files** — `phase12_3_5_immutabilityProofTest.js` (proof test only)
3. **Frontend code that only reads** — UI components in `pages/`, `components/` (excluding services)

---

## Migration Pattern

When migrating a backend function to use the wrapped client:

### Before

```typescript
import { base44 } from '@/api/base44Client';

async function myFunction(req) {
  const jobs = await base44.entities.CRMJob.list();
  await base44.asServiceRole.entities.ProposalPricingSnapshot.update(id, data); // ❌ BYPASSES WRAPPER
}
```

### After

```typescript
import { base44 } from '@/components/sdkWrappers/base44ClientWrapper';

async function myFunction(req) {
  const jobs = await base44.entities.CRMJob.list();
  await base44.asServiceRole.entities.ProposalPricingSnapshot.update(id, data); // ✅ ENFORCED
}
```

The code doesn't change — just the import path. The wrapper intercepts all snapshot mutations.

---

## Status

- [x] Wrapper created
- [x] Async `assertSnapshotImmutability()` added to authority
- [ ] Backend functions migrated (start with high-risk: pricing, snapshot writes)
- [ ] CI gate deployed
- [ ] Proof test passes

---

## Testing the Gate

```bash
# Should PASS
grep -r 'from.*base44' functions/phase12_* | grep -v 'immutabilityProofTest'
# (should find 0 raw imports)

# Should FAIL if any backend function imports raw base44
echo 'import base44 from "@/api/base44Client"' >> functions/testViolation.js
bash scripts/ci_immutability_gate.sh
# Should error: "Raw base44 imports detected"
``