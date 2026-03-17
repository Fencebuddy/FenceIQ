import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PHASE 3: MaterialCatalog Uniqueness Enforcement & Collision Resolution
 * 
 * Goals:
 * 1. Find all canonical_key collisions
 * 2. Resolve collisions (deactivate/rename)
 * 3. Enforce unique constraint on canonical_key
 * 4. Normalize finish tokens
 * 5. Verification report
 * 
 * Mode: ADMIN-ONLY (safety critical)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only protection
    if (!user || user.role !== 'admin') {
      return Response.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Fetch ALL MaterialCatalog records (paginated)
    const allRecords = [];
    let skip = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const batch = await base44.entities.MaterialCatalog.list(undefined, limit, skip);
      if (batch.length === 0) {
        hasMore = false;
      } else {
        allRecords.push(...batch);
        skip += batch.length;
        if (batch.length < limit) {
          hasMore = false;
        }
      }
    }

    console.log(`Fetched ${allRecords.length} total MaterialCatalog records`);

    // ═══════════════════════════════════════════════════════════════
    // PART 1: IDENTIFY COLLISIONS
    // ═══════════════════════════════════════════════════════════════
    const canonicalKeyMap = {};
    allRecords.forEach((record) => {
      const key = record.canonical_key;
      if (!canonicalKeyMap[key]) {
        canonicalKeyMap[key] = [];
      }
      canonicalKeyMap[key].push(record);
    });

    const collisions = {};
    Object.entries(canonicalKeyMap).forEach(([key, records]) => {
      if (records.length > 1) {
        collisions[key] = records;
      }
    });

    const collisionCount = Object.keys(collisions).length;
    console.log(`Found ${collisionCount} collisions`);

    // ═══════════════════════════════════════════════════════════════
    // PART 2: RESOLVE COLLISIONS
    // ═══════════════════════════════════════════════════════════════
    const updates = [];
    const collisionReport = {};

    for (const [canonicalKey, records] of Object.entries(collisions)) {
      console.log(`\n🔍 Collision: "${canonicalKey}" (${records.length} records)`);

      // Sort by criteria: prefer active=true, then by created_date (earliest), then completeness
      const sorted = [...records].sort((a, b) => {
        // Prefer active=true
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        // Prefer earliest created_date
        if (a.created_date < b.created_date) return -1;
        if (a.created_date > b.created_date) return 1;
        return 0;
      });

      const keeper = sorted[0];
      const deactivatees = sorted.slice(1);

      console.log(`  → Keeping: ${keeper.id} (${keeper.crm_name}, active=${keeper.active})`);

      collisionReport[canonicalKey] = {
        kept: {
          id: keeper.id,
          crm_name: keeper.crm_name,
          active: keeper.active,
          created_date: keeper.created_date
        },
        deactivated: deactivatees.map((r) => ({
          id: r.id,
          crm_name: r.crm_name,
          active: r.active,
          created_date: r.created_date
        }))
      };

      // Mark deactivatees as inactive and add notes
      for (const record of deactivatees) {
        const newNotes = `DUPLICATE — deactivated for canonical_key uniqueness. Kept: ${keeper.id}`;
        updates.push({
          id: record.id,
          updates: {
            active: false,
            notes: newNotes
          }
        });
        console.log(`  → Deactivating: ${record.id}`);
      }
    }

    // Apply collision fixes
    for (const { id, updates: updateData } of updates) {
      await base44.entities.MaterialCatalog.update(id, updateData);
    }

    console.log(`\n✅ Applied ${updates.length} deactivations`);

    // ═══════════════════════════════════════════════════════════════
    // PART 3: NORMALIZE FINISH TOKENS (OPTIONAL)
    // ═══════════════════════════════════════════════════════════════
    const finishNormalizations = [
      { from: 'galvanized', to: 'galv' },
      { from: 'black_vinyl', to: 'black' },
    ];

    let finishUpdatesCount = 0;

    for (const normalization of finishNormalizations) {
      const recordsToUpdate = allRecords.filter(
        (r) => r.finish === normalization.from
      );

      for (const record of recordsToUpdate) {
        await base44.entities.MaterialCatalog.update(record.id, {
          finish: normalization.to
        });
        finishUpdatesCount++;
      }

      console.log(`Normalized finish: "${normalization.from}" → "${normalization.to}" (${recordsToUpdate.length} records)`);
    }

    // ═══════════════════════════════════════════════════════════════
    // PART 4: VERIFY NO COLLISIONS REMAIN
    // ═══════════════════════════════════════════════════════════════
    const verifyRecords = [];
    let verifySkip = 0;
    let verifyHasMore = true;

    while (verifyHasMore) {
      const batch = await base44.entities.MaterialCatalog.list(undefined, limit, verifySkip);
      if (batch.length === 0) {
        verifyHasMore = false;
      } else {
        verifyRecords.push(...batch);
        verifySkip += batch.length;
        if (batch.length < limit) {
          verifyHasMore = false;
        }
      }
    }

    // Check for collisions in updated data
    const verifyMap = {};
    const activeCollisions = {};

    verifyRecords.forEach((record) => {
      const key = record.canonical_key;
      if (!verifyMap[key]) {
        verifyMap[key] = [];
      }
      verifyMap[key].push(record);

      // Also check for active=true collisions (stricter)
      if (record.active) {
        if (!activeCollisions[key]) {
          activeCollisions[key] = [];
        }
        activeCollisions[key].push(record);
      }
    });

    const remainingCollisions = Object.entries(verifyMap)
      .filter(([_, records]) => records.length > 1)
      .reduce((acc, [key, records]) => {
        acc[key] = records;
        return acc;
      }, {});

    const activeOnlyCollisions = Object.entries(activeCollisions)
      .filter(([_, records]) => records.length > 1)
      .reduce((acc, [key, records]) => {
        acc[key] = records;
        return acc;
      }, {});

    // ═══════════════════════════════════════════════════════════════
    // PART 5: GENERATE REPORT
    // ═══════════════════════════════════════════════════════════════

    // Count by material_type
    const materialTypeCount = {};
    verifyRecords.forEach((r) => {
      materialTypeCount[r.material_type] = (materialTypeCount[r.material_type] || 0) + 1;
    });

    // Count by active
    const activeCount = verifyRecords.filter((r) => r.active).length;
    const inactiveCount = verifyRecords.length - activeCount;

    const remainingCollisionsCount = Object.keys(remainingCollisions).length;
    const activeOnlyCollisionsCount = Object.keys(activeOnlyCollisions).length;

    const report = {
      status: 'complete',
      timestamp: new Date().toISOString(),
      phase: 'Phase 3 - MaterialCatalog Constraint Enforcement',

      // PART 1 Results
      collisions_found_initial: collisionCount,
      collision_details: collisionReport,

      // PART 2 Results
      deactivations_applied: updates.length,

      // PART 4 Verification
      collisions_remaining_all: remainingCollisionsCount,
      collisions_remaining_active_only: activeOnlyCollisionsCount,
      collision_details_remaining: remainingCollisionsCount === 0 ? 'NONE' : remainingCollisions,

      // PART 5 Final counts
      total_records: verifyRecords.length,
      active_records: activeCount,
      inactive_records: inactiveCount,
      by_material_type: materialTypeCount,

      // Finish normalization
      finish_normalizations_applied: finishUpdatesCount,

      // Recommendations
      recommendations: [
        activeOnlyCollisionsCount === 0
          ? '✅ PASS: No active canonical_key collisions detected'
          : '❌ FAIL: Active canonical_key collisions still exist',
        remainingCollisionsCount === 0
          ? '✅ PASS: No canonical_key collisions at all (including inactive)'
          : '⚠️  INFO: Inactive records share canonical_keys (acceptable if all but one are inactive)',
        'Ready for Phase 3 CompanySkuMap reseed when collision status is PASS'
      ]
    };

    return Response.json(report, { status: 200 });
  } catch (error) {
    console.error('Constraint enforcement error:', error);
    return Response.json(
      {
        error: 'Constraint enforcement failed',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
});