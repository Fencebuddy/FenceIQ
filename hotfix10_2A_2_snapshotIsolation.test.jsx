/**
 * HOTFIX 10.2A-2 — ProposalPricingSnapshot Cross-Tenant Collision Prevention Tests
 *
 * Verifies:
 * 1. No full-table ProposalPricingSnapshot.list() call occurs
 * 2. Map keys are always prefixed with companyId
 * 3. Two-tenant collision cannot override values
 * 4. SNAPSHOT_MISMATCH guard fires when fetched id != requested id
 * 5. JOB_ID_COLLISION guard fires and removes key when two snapshots share job_id
 */

// ─── Minimal mock harness ─────────────────────────────────────────────────────

function buildMockBase44({ crmJobs = [], snapshots = [], alertCapture = [] }) {
    return {
        entities: {
            CRMJob: {
                filter: async ({ companyId }) => crmJobs.filter(j => j.companyId === companyId)
            },
            ProposalPricingSnapshot: {
                // Replaces the full-table list() — this should NEVER be called
                list: () => {
                    throw new Error('HOTFIX VIOLATION: ProposalPricingSnapshot.list() called without company scope');
                },
                filter: async ({ id }) => snapshots.filter(s => s.id === id)
            },
            AlertEvent: {
                create: async (payload) => { alertCapture.push(payload); return payload; }
            }
        }
    };
}

// ─── Inline the critical path of getSignedDealsTruthSet for unit testing ─────

async function buildProposalSnapMap({ companyId, crmJobs, base44 }) {
    const snapshotIdSet = new Set();
    for (const job of crmJobs) {
        if (job.currentProposalSnapshotId) snapshotIdSet.add(job.currentProposalSnapshotId);
    }

    const snapshotFetchResults = await Promise.all(
        Array.from(snapshotIdSet).map(sid =>
            base44.entities.ProposalPricingSnapshot.filter({ id: sid })
                .then(rows => rows[0] || null)
                .catch(() => null)
        )
    );

    const fetchedSnapshots = snapshotFetchResults.filter(Boolean);
    const proposalSnapMap = new Map();
    const jobIdKeyCount = new Map();
    const alerts = [];

    for (const pps of fetchedSnapshots) {
        if (!snapshotIdSet.has(pps.id)) {
            alerts.push({ rule: 'SNAPSHOT_MISMATCH', id: pps.id });
            await base44.entities.AlertEvent.create({ rule: 'SNAPSHOT_MISMATCH', companyId, fetchedId: pps.id });
            continue;
        }

        proposalSnapMap.set(pps.id, pps);

        if (pps.job_id) {
            const scopedJobKey = `${companyId}:${pps.job_id}`;
            if (jobIdKeyCount.has(scopedJobKey)) {
                const existingId = jobIdKeyCount.get(scopedJobKey);
                alerts.push({ rule: 'JOB_ID_COLLISION', job_id: pps.job_id, ids: [existingId, pps.id] });
                await base44.entities.AlertEvent.create({ rule: 'JOB_ID_COLLISION', companyId, job_id: pps.job_id });
                proposalSnapMap.delete(scopedJobKey);
                jobIdKeyCount.set(scopedJobKey, '__COLLISION__');
            } else {
                jobIdKeyCount.set(scopedJobKey, pps.id);
                proposalSnapMap.set(scopedJobKey, pps);
            }
        }
    }

    return { proposalSnapMap, fetchedSnapshots, snapshotIdSet, alerts };
}

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`✅ PASS: ${name}`);
        passed++;
    } catch (e) {
        console.error(`❌ FAIL: ${name} — ${e.message}`);
        failed++;
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

await test('T1: ProposalPricingSnapshot.list() is NEVER called', async () => {
    const alerts = [];
    const mock = buildMockBase44({
        crmJobs: [{ companyId: 'co-A', currentProposalSnapshotId: 'snap-1' }],
        snapshots: [{ id: 'snap-1', agreed_subtotal: 10000, direct_cost: 4000, job_id: 'job-1' }],
        alertCapture: alerts
    });

    // Calling list() would throw — our code must not call it
    let listCalled = false;
    const origList = mock.entities.ProposalPricingSnapshot.list;
    mock.entities.ProposalPricingSnapshot.list = () => { listCalled = true; return []; };

    await buildProposalSnapMap({
        companyId: 'co-A',
        crmJobs: mock.entities.CRMJob.filter ? await mock.entities.CRMJob.filter({ companyId: 'co-A' }) : [],
        base44: mock
    });

    assert(!listCalled, 'ProposalPricingSnapshot.list() was called — HOTFIX VIOLATION');
});

await test('T2: Only snapshots referenced by company CRMJobs are fetched', async () => {
    const snapshots = [
        { id: 'snap-A1', agreed_subtotal: 5000, direct_cost: 2000, job_id: 'job-1' },
        { id: 'snap-B1', agreed_subtotal: 9000, direct_cost: 4000, job_id: 'job-99' }, // belongs to other tenant
    ];
    const crmJobs = [{ companyId: 'co-A', currentProposalSnapshotId: 'snap-A1' }];
    const mock = buildMockBase44({ crmJobs, snapshots, alertCapture: [] });

    const { fetchedSnapshots, snapshotIdSet } = await buildProposalSnapMap({
        companyId: 'co-A',
        crmJobs,
        base44: mock
    });

    assert(snapshotIdSet.size === 1, `Expected 1 id in set, got ${snapshotIdSet.size}`);
    assert(fetchedSnapshots.length === 1, `Expected 1 fetched snapshot, got ${fetchedSnapshots.length}`);
    assert(fetchedSnapshots[0].id === 'snap-A1', 'Wrong snapshot fetched');
});

await test('T3: Map keys with job_id are always prefixed with companyId', async () => {
    const snapshots = [{ id: 'snap-1', agreed_subtotal: 8000, direct_cost: 3000, job_id: 'shared-job-id' }];
    const crmJobs = [{ companyId: 'co-A', currentProposalSnapshotId: 'snap-1' }];
    const mock = buildMockBase44({ crmJobs, snapshots, alertCapture: [] });

    const { proposalSnapMap } = await buildProposalSnapMap({ companyId: 'co-A', crmJobs, base44: mock });

    assert(proposalSnapMap.has('co-A:shared-job-id'), 'Expected scoped key co-A:shared-job-id');
    assert(!proposalSnapMap.has('shared-job-id'), 'Bare job_id key must NOT exist — cross-tenant risk');
});

await test('T4: Two-tenant scenario — same job_id cannot cause value override', async () => {
    const sharedJobId = 'job-X';

    // Tenant A's snapshot
    const snapshotsA = [{ id: 'snap-A', agreed_subtotal: 10000, direct_cost: 4000, job_id: sharedJobId }];
    const crmJobsA = [{ companyId: 'co-A', currentProposalSnapshotId: 'snap-A' }];
    const mockA = buildMockBase44({ crmJobs: crmJobsA, snapshots: snapshotsA, alertCapture: [] });

    // Tenant B's snapshot
    const snapshotsB = [{ id: 'snap-B', agreed_subtotal: 99999, direct_cost: 1, job_id: sharedJobId }];
    const crmJobsB = [{ companyId: 'co-B', currentProposalSnapshotId: 'snap-B' }];
    const mockB = buildMockBase44({ crmJobs: crmJobsB, snapshots: snapshotsB, alertCapture: [] });

    const { proposalSnapMap: mapA } = await buildProposalSnapMap({ companyId: 'co-A', crmJobs: crmJobsA, base44: mockA });
    const { proposalSnapMap: mapB } = await buildProposalSnapMap({ companyId: 'co-B', crmJobs: crmJobsB, base44: mockB });

    const snapA = mapA.get('co-A:' + sharedJobId);
    const snapB = mapB.get('co-B:' + sharedJobId);

    assert(snapA?.id === 'snap-A', 'Tenant A got wrong snapshot');
    assert(snapB?.id === 'snap-B', 'Tenant B got wrong snapshot');
    assert(snapA?.agreed_subtotal !== snapB?.agreed_subtotal, 'Values collided — CROSS-TENANT LEAK');
});

await test('T5: SNAPSHOT_MISMATCH alert fires when fetched id not in requested set', async () => {
    const alerts = [];
    // Simulate a snapshot that returns with a different id (tampered / wrong row)
    const badSnapshots = [{ id: 'WRONG-ID', agreed_subtotal: 5000, direct_cost: 2000 }];
    const crmJobs = [{ companyId: 'co-A', currentProposalSnapshotId: 'snap-expected' }];

    const mock = {
        entities: {
            ProposalPricingSnapshot: {
                filter: async () => badSnapshots // returns wrong id
            },
            AlertEvent: { create: async (p) => { alerts.push(p); } }
        }
    };

    const { proposalSnapMap, alerts: inlineAlerts } = await buildProposalSnapMap({ companyId: 'co-A', crmJobs, base44: mock });

    // The mismatched snapshot must NOT be in the map
    assert(!proposalSnapMap.has('WRONG-ID'), 'Mismatched snapshot must be excluded from map');
    assert(inlineAlerts.some(a => a.rule === 'SNAPSHOT_MISMATCH'), 'SNAPSHOT_MISMATCH alert not fired');
});

await test('T6: JOB_ID_COLLISION alert fires + key removed when two snapshots share job_id', async () => {
    const alerts = [];
    const sharedJobId = 'collision-job';
    const snapshots = [
        { id: 'snap-1', agreed_subtotal: 5000, direct_cost: 2000, job_id: sharedJobId },
        { id: 'snap-2', agreed_subtotal: 7000, direct_cost: 3000, job_id: sharedJobId }
    ];
    const crmJobs = [
        { companyId: 'co-A', currentProposalSnapshotId: 'snap-1' },
        { companyId: 'co-A', currentProposalSnapshotId: 'snap-2' }
    ];
    const mock = buildMockBase44({ crmJobs, snapshots, alertCapture: alerts });

    const { proposalSnapMap, alerts: inlineAlerts } = await buildProposalSnapMap({ companyId: 'co-A', crmJobs, base44: mock });

    assert(!proposalSnapMap.has(`co-A:${sharedJobId}`), 'Collision key must be removed from map');
    assert(inlineAlerts.some(a => a.rule === 'JOB_ID_COLLISION'), 'JOB_ID_COLLISION alert not fired');
});

await test('T7: Row count reporting — before=full table size, after=scoped fetch size', async () => {
    // Before: list() would return ALL snapshots across all tenants
    // After: we only fetch snapshotIdSet.size snapshots
    const allTenantsSnapshots = Array.from({ length: 500 }, (_, i) => ({
        id: `snap-${i}`,
        agreed_subtotal: 1000,
        direct_cost: 400,
        job_id: `job-${i}`
    }));

    // Only this company has 3 relevant snapshots
    const companyCrmJobs = [
        { companyId: 'co-A', currentProposalSnapshotId: 'snap-10' },
        { companyId: 'co-A', currentProposalSnapshotId: 'snap-20' },
        { companyId: 'co-A', currentProposalSnapshotId: 'snap-30' }
    ];
    const mock = buildMockBase44({ crmJobs: companyCrmJobs, snapshots: allTenantsSnapshots, alertCapture: [] });

    const { fetchedSnapshots, snapshotIdSet } = await buildProposalSnapMap({
        companyId: 'co-A',
        crmJobs: companyCrmJobs,
        base44: mock
    });

    const beforeCount = allTenantsSnapshots.length; // what list() would have returned
    const afterCount = fetchedSnapshots.length;      // what scoped fetch returns

    console.log(`    Before (full table): ${beforeCount} rows`);
    console.log(`    After  (scoped):     ${afterCount} rows`);
    console.log(`    Reduction:           ${beforeCount - afterCount} rows eliminated from dashboard load`);

    assert(afterCount === 3, `Expected 3 scoped snapshots, got ${afterCount}`);
    assert(afterCount < beforeCount, 'Scoped load must fetch fewer rows than full table');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log(`HOTFIX 10.2A-2 Isolation Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

export { passed, failed };