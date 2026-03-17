/**
 * UNIT TEST: MaterialCatalog Write Guard
 * Tests that write operations enforce canonical key uniqueness + validity
 */

import { base44 } from '@/api/base44Client';

describe('MaterialCatalog Write Guard', () => {
  
  describe('Canonical Key Uniqueness', () => {
    test('rejects duplicate canonical_key in same material_type', async () => {
      const testKey = 'vinyl_panel_6x8_white_test';
      
      // First write should succeed
      const item1 = {
        crm_name: 'Vinyl Panel 6x8 White Test #1',
        canonical_key: testKey,
        category: 'panel',
        material_type: 'vinyl',
        unit: 'each',
        cost: 45.00
      };

      // Second write with same key should fail
      const item2 = {
        crm_name: 'Vinyl Panel 6x8 White Test #2',
        canonical_key: testKey,
        category: 'panel',
        material_type: 'vinyl',
        unit: 'each',
        cost: 50.00
      };

      // Simulate write attempt
      try {
        await base44.asServiceRole.entities.MaterialCatalog.create(item1);
        await base44.asServiceRole.entities.MaterialCatalog.create(item2);
        
        // If both succeed, assertion fails
        fail('Expected duplicate canonical_key to be rejected');
      } catch (error) {
        expect(error.message).toContain('unique');
      }
    });

    test('accepts same canonical_key in different material_type', async () => {
      const testKey = 'panel_6x8_white';
      
      const vinylItem = {
        crm_name: 'Vinyl Panel 6x8',
        canonical_key: testKey,
        category: 'panel',
        material_type: 'vinyl',
        unit: 'each',
        cost: 45.00
      };

      const woodItem = {
        crm_name: 'Wood Panel 6x8',
        canonical_key: testKey,
        category: 'panel',
        material_type: 'wood',
        unit: 'each',
        cost: 55.00
      };

      // Both should succeed (different material_type)
      expect(async () => {
        await base44.asServiceRole.entities.MaterialCatalog.create(vinylItem);
        await base44.asServiceRole.entities.MaterialCatalog.create(woodItem);
      }).not.toThrow();
    });

    test('rejects case variations of same key', async () => {
      const key1 = 'vinyl_panel_6x8';
      const key2 = 'VINYL_PANEL_6X8'; // Should normalize to same
      
      try {
        await base44.asServiceRole.entities.MaterialCatalog.create({
          crm_name: 'Item 1',
          canonical_key: key1,
          category: 'panel',
          material_type: 'vinyl',
          unit: 'each',
          cost: 45.00
        });

        await base44.asServiceRole.entities.MaterialCatalog.create({
          crm_name: 'Item 2',
          canonical_key: key2,
          category: 'panel',
          material_type: 'vinyl',
          unit: 'each',
          cost: 50.00
        });

        fail('Expected case-normalized keys to be treated as duplicates');
      } catch (error) {
        expect(error.message).toContain('unique');
      }
    });

    test('rejects whitespace variations as duplicates', async () => {
      const key1 = 'vinyl_panel_6x8';
      const key2 = '  vinyl_panel_6x8  '; // Trailing spaces
      
      try {
        await base44.asServiceRole.entities.MaterialCatalog.create({
          crm_name: 'Item 1',
          canonical_key: key1,
          category: 'panel',
          material_type: 'vinyl',
          unit: 'each',
          cost: 45.00
        });

        await base44.asServiceRole.entities.MaterialCatalog.create({
          crm_name: 'Item 2',
          canonical_key: key2,
          category: 'panel',
          material_type: 'vinyl',
          unit: 'each',
          cost: 50.00
        });

        fail('Expected whitespace-normalized keys to be treated as duplicates');
      } catch (error) {
        expect(error.message).toContain('unique');
      }
    });
  });

  describe('Canonical Key Validation', () => {
    test('rejects invalid canonical_key format', async () => {
      const invalidKeys = [
        'vinyl.panel.6x8',      // dots
        'vinyl-panel-6x8',      // hyphens
        'VINYL_PANEL_6X8',      // uppercase
        'vinyl panel 6x8',      // spaces
        'vinyl@panel#6x8'       // special chars
      ];

      for (const key of invalidKeys) {
        try {
          await base44.asServiceRole.entities.MaterialCatalog.create({
            crm_name: 'Test Item',
            canonical_key: key,
            category: 'panel',
            material_type: 'vinyl',
            unit: 'each',
            cost: 45.00
          });
          fail(`Expected key "${key}" to be rejected`);
        } catch (error) {
          expect(error.message).toContain('canonical');
        }
      }
    });

    test('rejects forbidden tokens in canonical_key', async () => {
      const forbiddenKeys = [
        'vinyl_panel_galvanized',
        'chainlink_black_vinyl_coated',
        'post_vinyl_coated_6x6'
      ];

      for (const key of forbiddenKeys) {
        try {
          await base44.asServiceRole.entities.MaterialCatalog.create({
            crm_name: 'Test Item',
            canonical_key: key,
            category: 'panel',
            material_type: 'vinyl',
            unit: 'each',
            cost: 45.00
          });
          fail(`Expected key with forbidden token to be rejected`);
        } catch (error) {
          expect(error.message).toContain('forbidden');
        }
      }
    });

    test('accepts valid canonical_key formats', async () => {
      const validKeys = [
        'vinyl_panel_6x8_white',
        'chainlink_fabric_6ft_galv',
        'wood_post_4x4',
        'aluminum_rail_top_21'
      ];

      for (const key of validKeys) {
        expect(async () => {
          await base44.asServiceRole.entities.MaterialCatalog.create({
            crm_name: 'Test Item',
            canonical_key: key,
            category: 'panel',
            material_type: 'vinyl',
            unit: 'each',
            cost: 45.00
          });
        }).not.toThrow();
      }
    });
  });

  describe('Write Protection — Cost Validation', () => {
    test('rejects zero cost', async () => {
      try {
        await base44.asServiceRole.entities.MaterialCatalog.create({
          crm_name: 'Free Item',
          canonical_key: 'test_item',
          category: 'panel',
          material_type: 'vinyl',
          unit: 'each',
          cost: 0
        });
        fail('Expected zero cost to be rejected');
      } catch (error) {
        expect(error.message).toContain('cost');
      }
    });

    test('rejects negative cost', async () => {
      try {
        await base44.asServiceRole.entities.MaterialCatalog.create({
          crm_name: 'Negative Cost Item',
          canonical_key: 'test_item',
          category: 'panel',
          material_type: 'vinyl',
          unit: 'each',
          cost: -10.00
        });
        fail('Expected negative cost to be rejected');
      } catch (error) {
        expect(error.message).toContain('cost');
      }
    });
  });
});