/**
 * PHASE 12.3C: CI Gate — Enforce guarded client factory usage
 *
 * Fails if any function uses `createClientFromRequest` directly
 * (except in the canonical base44GuardFactory module).
 */

import fs from 'fs';
import path from 'path';

const CANONICAL_FACTORY = 'functions/_shared/base44GuardFactory.js';

function scanForRawImports(dirPath, results = []) {
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    // Skip node_modules, hidden dirs, factory itself
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (fullPath === CANONICAL_FACTORY) continue;

    if (entry.isDirectory()) {
      scanForRawImports(fullPath, results);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Check for direct createClientFromRequest usage
      if (content.includes('createClientFromRequest(')) {
        // Verify it's not just in a comment or string
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (
            line.includes('createClientFromRequest(') &&
            !line.trim().startsWith('//') &&
            !line.includes('createGuardedClientFromRequest')
          ) {
            results.push({
              file: fullPath,
              line: i + 1,
              violation: 'Direct createClientFromRequest usage found'
            });
          }
        }
      }
    }
  }

  return results;
}

// Run CI gate
const violations = scanForRawImports('functions');
const additionalViolations = scanForRawImports('pages');

violations.push(...additionalViolations);

if (violations.length > 0) {
  console.error(
    '\n❌ CI GATE FAILED: Direct createClientFromRequest() usage detected\n' +
    'All functions must use createGuardedClientFromRequest() from functions/_shared/base44GuardFactory.js\n'
  );

  violations.forEach((v) => {
    console.error(`  ${v.file}:${v.line} - ${v.violation}`);
  });

  process.exit(1);
} else {
  console.log('✅ CI GATE PASSED: All client creation uses guarded factory');
  process.exit(0);
}