# ─────────────────────────────────────────────────────────────────────────────
# FenceIQ CI Gate — Phase 10.6A
# File: .github/workflows/ci.yml   (copy this file to that path in your repo)
#
# Triggers:  every PR against main or develop
# Gate:      npm test must exit 0 — any failing test blocks merge
# SLA:       total job < 5 minutes
# ─────────────────────────────────────────────────────────────────────────────

name: CI — Test Gate

on:
  pull_request:
    branches:
      - main
      - develop
  push:
    branches:
      - main           # also run on direct pushes for branch protection

jobs:
  test:
    name: Unit Tests (Vitest)
    runs-on: ubuntu-latest
    timeout-minutes: 5          # hard-kill if something hangs

    steps:
      # 1. Checkout
      - name: Checkout repository
        uses: actions/checkout@v4

      # 2. Node setup — match the engine version used locally
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # 3. Clean install (uses package-lock.json for reproducibility)
      - name: Install dependencies
        run: npm ci

      # 4. Run tests — vitest exits 1 on any failure → step fails → job fails → merge blocked
      - name: Run tests
        run: npm test
        # No `continue-on-error` — failures must propagate

      # 5. Upload test results artifact (optional, aids debugging in GitHub UI)
      - name: Upload test results
        if: always()           # upload even on failure so you can inspect logs
        uses: actions/upload-artifact@v4
        with:
          name: vitest-results
          path: |
            vitest-output.txt
          retention-days: 7
        continue-on-error: true  # artifact upload failure should not mask test failure

# ─────────────────────────────────────────────────────────────────────────────
# Branch Protection setup (do in GitHub → Settings → Branches):
#   Required status checks: "CI — Test Gate / Unit Tests (Vitest)"
#   ☑ Require branches to be up to date before merging
#   ☑ Do not allow bypassing the above settings
# ─────────────────────────────────────────────────────────────────────────────