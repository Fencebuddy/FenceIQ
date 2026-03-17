/**
 * PHASE 8: TEST CONFIGURATION
 * Shared test utilities and constants
 */

export const TEST_CONFIG = {
  // Test database — use separate DB from production
  useTestDb: true,
  testDbName: 'fenceiq_test',

  // Timeouts
  unitTestTimeoutMs: 5000,
  integrationTestTimeoutMs: 30000,
  pipelineTimeoutMs: 600000, // 10 minutes total

  // Test data
  testCompanyId: 'TestCompany123',
  testCompanyIds: [
    'PrivacyFenceCo49319',
    'TestCompany123',
    'FenceIQDev'
  ],

  // Material types
  materialTypes: ['Vinyl', 'Wood', 'Chain Link', 'Aluminum'],

  // Fence heights
  fenceHeights: ['3\'', '4\'', '5\'', '6\'', '8\''],

  // Test scenarios
  testScenarios: {
    vinylNoGates: {
      materialType: 'Vinyl',
      fenceHeight: '6\'',
      style: 'Privacy',
      fenceColor: 'White',
      gates: 0,
      linearFeet: 100
    },
    chainLinkWithGate: {
      materialType: 'Chain Link',
      fenceHeight: '6\'',
      style: 'Standard',
      chainLinkCoating: 'Galvanized',
      gates: 1,
      linearFeet: 200
    }
  },

  // Canonical key patterns
  canonicalKeyPatterns: {
    valid: [
      'vinyl_panel_6x6_white',
      'chainlink_fabric_6ft_galv',
      'wood_post_4x4',
      'aluminum_rail_top_21',
      'hardware_bracket_corner',
      'vinyl_post_cap_5x5'
    ],
    invalid: [
      'vinyl.panel.6x6',      // dots
      'vinyl-panel-6x6',      // hyphens
      'VINYL_PANEL_6X6',      // uppercase
      'vinyl panel 6x6',      // spaces
      'vinyl_panel_galvanized', // forbidden token
      '_vinyl_panel_6x6',     // leading underscore
      'vinyl_panel_6x6_'      // trailing underscore
    ]
  },

  // Alert rules for monitoring
  alertRules: {
    resolverMissWarning: { metric: 'resolver_miss_total', threshold: 0, window: 300 },
    resolverMissCritical: { metric: 'resolver_miss_total', threshold: 5, window: 300 },
    validatorFailureWarning: { metric: 'validator_failure_total', threshold: 0, window: 300 },
    proposalFailureWarning: { metric: 'proposal_generation_failed_total', threshold: 0.005, window: 600 }
  }
};

/**
 * Generate a unique test ID
 */
export function generateTestId() {
  return `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Generate test job data
 */
export function generateTestJobData(overrides = {}) {
  return {
    customerName: `Test Customer ${generateTestId()}`,
    addressLine1: '123 Test Street',
    city: 'Testville',
    state: 'MI',
    zip: '49000',
    materialType: 'Vinyl',
    fenceHeight: '6\'',
    style: 'Privacy',
    totalLF: 0,
    ...overrides
  };
}

/**
 * Generate test run data
 */
export function generateTestRunData(jobId, overrides = {}) {
  return {
    jobId,
    runLabel: `Test Run ${generateTestId()}`,
    lengthLF: 100,
    materialType: 'Vinyl',
    fenceHeight: '6\'',
    style: 'Privacy',
    startType: 'Post',
    endType: 'Post',
    singleGateCount: 0,
    doubleGateCount: 0,
    ...overrides
  };
}

/**
 * Assert canonical key is valid
 */
export function assertCanonicalKeyValid(key) {
  const validPattern = /^[a-z0-9_]+$/;
  
  if (!validPattern.test(key)) {
    throw new Error(`Invalid canonical key format: "${key}"`);
  }

  if (key.startsWith('_') || key.endsWith('_')) {
    throw new Error(`Canonical key cannot start or end with underscore: "${key}"`);
  }

  if (key.includes('__')) {
    throw new Error(`Canonical key cannot contain double underscores: "${key}"`);
  }

  const forbiddenTokens = ['galvanized', 'black_vinyl', 'vinyl_coated'];
  for (const token of forbiddenTokens) {
    if (key.includes(token)) {
      throw new Error(`Canonical key contains forbidden token "${token}": "${key}"`);
    }
  }
}

/**
 * Cleanup test data after test completes
 */
export async function cleanupTestData(base44, testId) {
  try {
    // Delete test jobs (this will cascade to runs, gates, etc.)
    const testJobs = await base44.asServiceRole.entities.Job.filter(
      { customerName: { $regex: testId } },
      null,
      100
    );

    for (const job of testJobs) {
      await base44.asServiceRole.entities.Job.delete(job.id);
    }

    console.log(`[TestCleanup] Deleted ${testJobs.length} test jobs`);
  } catch (error) {
    console.warn('[TestCleanup] Error during cleanup:', error.message);
  }
}

/**
 * Test report generator
 */
export function generateTestReport(results) {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const totalTime = results.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0);

  return {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
      passRate: ((passed / results.length) * 100).toFixed(2) + '%',
      totalExecutionTimeMs: totalTime,
      avgTimePerTest: (totalTime / results.length).toFixed(0) + 'ms'
    },
    results
  };
}