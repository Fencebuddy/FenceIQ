/**
 * AUTOMATED MATERIAL SWITCH TESTS
 * In-app test suite for validating material switching logic
 */

import { buildTakeoff } from "@/components/materials/canonicalTakeoffEngine";

export async function runMaterialSwitchTests(job, runs, gates, fenceLines, updateJobMutation, queryClient) {
  const results = [];
  
  // Helper to check if takeoff contains specific items
  const hasItem = (takeoff, searchTerm) => {
    return takeoff.lineItems?.some(item => 
      item.materialDescription?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const hasNoItem = (takeoff, searchTerm) => {
    return !hasItem(takeoff, searchTerm);
  };

  try {
    // TEST 1: VINYL baseline
    console.log("TEST 1: VINYL baseline");
    let testTakeoff = buildTakeoff({ ...job, materialType: 'Vinyl' }, fenceLines, runs, gates);
    
    const test1Pass = 
      testTakeoff.materialType === 'Vinyl' &&
      hasItem(testTakeoff, 'vinyl') &&
      hasNoItem(testTakeoff, 'tension band') &&
      hasNoItem(testTakeoff, 'rail end');
    
    results.push({
      name: "TEST 1: Vinyl Baseline",
      passed: test1Pass,
      message: test1Pass ? "✓ Vinyl items present, no chain link items" : "✗ Failed"
    });

    // TEST 2: CHAIN LINK
    console.log("TEST 2: CHAIN LINK");
    testTakeoff = buildTakeoff({ ...job, materialType: 'Chain Link' }, fenceLines, runs, gates);
    
    const test2Pass = 
      testTakeoff.materialType === 'Chain Link' &&
      hasItem(testTakeoff, 'fabric') &&
      hasItem(testTakeoff, 'tension band') &&
      hasNoItem(testTakeoff, 'vinyl panel');
    
    results.push({
      name: "TEST 2: Chain Link Switch",
      passed: test2Pass,
      message: test2Pass ? "✓ Chain link items present, no vinyl items" : "✗ Failed"
    });

    // TEST 3: WOOD
    console.log("TEST 3: WOOD");
    testTakeoff = buildTakeoff({ ...job, materialType: 'Wood' }, fenceLines, runs, gates);
    
    const test3Pass = 
      testTakeoff.materialType === 'Wood' &&
      hasItem(testTakeoff, 'post') &&
      hasNoItem(testTakeoff, 'vinyl panel') &&
      hasNoItem(testTakeoff, 'fabric');
    
    results.push({
      name: "TEST 3: Wood Switch",
      passed: test3Pass,
      message: test3Pass ? "✓ Wood items present, no vinyl/chain link items" : "✗ Failed"
    });

    // TEST 4: ALUMINUM
    console.log("TEST 4: ALUMINUM");
    testTakeoff = buildTakeoff({ ...job, materialType: 'Aluminum' }, fenceLines, runs, gates);
    
    const test4Pass = 
      testTakeoff.materialType === 'Aluminum' &&
      hasItem(testTakeoff, 'aluminum') &&
      hasItem(testTakeoff, 'concrete') &&
      hasNoItem(testTakeoff, 'vinyl panel');
    
    results.push({
      name: "TEST 4: Aluminum Switch",
      passed: test4Pass,
      message: test4Pass ? "✓ Aluminum items + concrete present" : "✗ Failed"
    });

    // TEST 5: Gate coverage
    console.log("TEST 5: Gate Coverage");
    if (gates.length > 0) {
      const vinylGateTakeoff = buildTakeoff({ ...job, materialType: 'Vinyl' }, fenceLines, runs, gates);
      const chainGateTakeoff = buildTakeoff({ ...job, materialType: 'Chain Link' }, fenceLines, runs, gates);
      
      const test5Pass = 
        hasItem(vinylGateTakeoff, 'gate') &&
        hasItem(chainGateTakeoff, 'gate');
      
      results.push({
        name: "TEST 5: Gate Coverage",
        passed: test5Pass,
        message: test5Pass ? "✓ Gates present in all materials" : "✗ Gates missing"
      });
    } else {
      results.push({
        name: "TEST 5: Gate Coverage",
        passed: true,
        message: "⊘ No gates to test"
      });
    }

    // TEST 6: Concrete logic
    console.log("TEST 6: Concrete Logic");
    const woodTakeoff = buildTakeoff({ ...job, materialType: 'Wood' }, fenceLines, runs, gates);
    const aluminumTakeoff = buildTakeoff({ ...job, materialType: 'Aluminum' }, fenceLines, runs, gates);
    
    const woodConcrete = woodTakeoff.lineItems?.find(i => i.materialDescription?.toLowerCase().includes('concrete'));
    const aluminumConcrete = aluminumTakeoff.lineItems?.find(i => i.materialDescription?.toLowerCase().includes('concrete'));
    
    const test6Pass = 
      (gates.length === 0 ? !woodConcrete : !!woodConcrete) && // Wood: concrete only if gates exist
      !!aluminumConcrete; // Aluminum: always has concrete
    
    results.push({
      name: "TEST 6: Concrete Logic",
      passed: test6Pass,
      message: test6Pass ? "✓ Wood (gate posts only) & Aluminum (all posts) correct" : "✗ Concrete logic incorrect"
    });

  } catch (error) {
    console.error("Test suite failed:", error);
    results.push({
      name: "ERROR",
      passed: false,
      message: `Test suite crashed: ${error.message}`
    });
  }

  return results;
}