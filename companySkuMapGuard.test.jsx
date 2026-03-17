/**
 * UNIT TEST: CompanySkuMap Write Guard
 * Tests that foreign keys + status constraints are enforced
 */

import { base44 } from '@/api/base44Client';

describe('CompanySkuMap Write Guard', () => {
  
  describe('Foreign Key Constraints', () => {
    test('rejects materialCatalogId pointing to inactive item', async () => {
      // Create an active item
      const activeItem = await base44.asServiceRole.entities.MaterialCatalog.create({
        crm_name: 'Active Item',
        canonical_key: 'test_active_sku',
        category: 'panel',
        material_type: 'vinyl',
        unit: 'each',
        cost: 45.00,
        active: true
      });

      // Create an inactive item
      const inactiveItem = await base44.asServiceRole.entities.MaterialCatalog.create({
        crm_name: 'Inactive Item',
        canonical_key: 'test_inactive_sku',
        category: 'panel',
        material_type: 'vinyl',
        unit: 'each',
        cost: 50.00,
        active: false
      });

      // Try to map to inactive item — should fail
      try {
        await base44.asServiceRole.entities.CompanySkuMap.create({
          companyId: 'TestCo123',
          uck: 'vinyl_panel_6x8_white',
          materialCatalogId: inactiveItem.id,
          materialType: 'vinyl',
          displayName: 'Test Mapping to Inactive',
          status: 'mapped'
        });
        fail('Expected mapping to inactive item to be rejected');
      } catch (error) {
        expect(error.message).toContain('inactive');
      }
    });

    test('rejects non-existent materialCatalogId', async () => {
      try {
        await base44.asServiceRole.entities.CompanySkuMap.create({
          companyId: 'TestCo123',
          uck: 'vinyl_panel_6x8_white',
          materialCatalogId: 'non_existent_id_xyz',
          materialType: 'vinyl',
          displayName: 'Bad Mapping',
          status: 'mapped'
        });
        fail('Expected non-existent materialCatalogId to be rejected');
      } catch (error) {
        expect(error.message).toContain('not found');
      }
    });

    test('accepts materialCatalogId pointing to active item', async () => {
      const activeItem = await base44.asServiceRole.entities.MaterialCatalog.create({
        crm_name: 'Active Mapping Target',
        canonical_key: 'test_mapping_target',
        category: 'panel',
        material_type: 'vinyl',
        unit: 'each',
        cost: 45.00,
        active: true
      });

      expect(async () => {
        await base44.asServiceRole.entities.CompanySkuMap.create({
          companyId: 'TestCo123',
          uck: 'vinyl_panel_6x8_white',
          materialCatalogId: activeItem.id,
          materialType: 'vinyl',
          displayName: 'Valid Mapping',
          status: 'mapped'
        });
      }).not.toThrow();
    });
  });

  describe('UCK Validation', () => {
    test('rejects UCK that does not exist in MaterialCatalog', async () => {
      // Create a catalog item
      const catalogItem = await base44.asServiceRole.entities.MaterialCatalog.create({
        crm_name: 'Catalog Item',
        canonical_key: 'vinyl_panel_6x8',
        category: 'panel',
        material_type: 'vinyl',
        unit: 'each',
        cost: 45.00,
        active: true
      });

      // Try to create CompanySkuMap with UCK that doesn't match any canonical_key
      try {
        await base44.asServiceRole.entities.CompanySkuMap.create({
          companyId: 'TestCo123',
          uck: 'non_existent_uck_xyz',
          materialCatalogId: catalogItem.id,
          materialType: 'vinyl',
          displayName: 'Bad UCK Mapping',
          status: 'mapped'
        });
        fail('Expected non-existent UCK to be rejected');
      } catch (error) {
        expect(error.message).toContain('uck');
      }
    });

    test('rejects UCK with invalid format', async () => {
      const catalogItem = await base44.asServiceRole.entities.MaterialCatalog.create({
        crm_name: 'Catalog Item',
        canonical_key: 'vinyl_panel_6x8',
        category: 'panel',
        material_type: 'vinyl',
        unit: 'each',
        cost: 45.00,
        active: true
      });

      const invalidUcks = [
        'UPPERCASE_UCK',        // uppercase
        'uck-with-hyphens',     // hyphens
        'uck.with.dots',        // dots
        'uck with spaces'       // spaces
      ];

      for (const uck of invalidUcks) {
        try {
          await base44.asServiceRole.entities.CompanySkuMap.create({
            companyId: 'TestCo123',
            uck,
            materialCatalogId: catalogItem.id,
            materialType: 'vinyl',
            displayName: 'Invalid UCK',
            status: 'mapped'
          });
          fail(`Expected invalid UCK "${uck}" to be rejected`);
        } catch (error) {
          expect(error.message).toContain('format');
        }
      }
    });
  });

  describe('Status Field Validation', () => {
    test('rejects invalid status values', async () => {
      const catalogItem = await base44.asServiceRole.entities.MaterialCatalog.create({
        crm_name: 'Catalog Item',
        canonical_key: 'vinyl_panel_status_test',
        category: 'panel',
        material_type: 'vinyl',
        unit: 'each',
        cost: 45.00,
        active: true
      });

      const invalidStatuses = ['active', 'pending', 'invalid', 'MAPPED'];

      for (const status of invalidStatuses) {
        try {
          await base44.asServiceRole.entities.CompanySkuMap.create({
            companyId: 'TestCo123',
            uck: 'vinyl_panel_status_test',
            materialCatalogId: catalogItem.id,
            materialType: 'vinyl',
            displayName: 'Invalid Status',
            status
          });
          fail(`Expected status "${status}" to be rejected`);
        } catch (error) {
          expect(error.message).toContain('status');
        }
      }
    });

    test('accepts valid status values', async () => {
      const catalogItem = await base44.asServiceRole.entities.MaterialCatalog.create({
        crm_name: 'Catalog Item',
        canonical_key: 'vinyl_panel_status_valid',
        category: 'panel',
        material_type: 'vinyl',
        unit: 'each',
        cost: 45.00,
        active: true
      });

      const validStatuses = ['mapped', 'unmapped', 'deprecated'];

      for (const status of validStatuses) {
        expect(async () => {
          await base44.asServiceRole.entities.CompanySkuMap.create({
            companyId: 'TestCo123',
            uck: 'vinyl_panel_status_valid',
            materialCatalogId: catalogItem.id,
            materialType: 'vinyl',
            displayName: `Mapping with ${status}`,
            status
          });
        }).not.toThrow();
      }
    });
  });

  describe('CompanyId Validation', () => {
    test('rejects empty companyId', async () => {
      const catalogItem = await base44.asServiceRole.entities.MaterialCatalog.create({
        crm_name: 'Catalog Item',
        canonical_key: 'vinyl_panel_companyid_test',
        category: 'panel',
        material_type: 'vinyl',
        unit: 'each',
        cost: 45.00,
        active: true
      });

      try {
        await base44.asServiceRole.entities.CompanySkuMap.create({
          companyId: '',
          uck: 'vinyl_panel_companyid_test',
          materialCatalogId: catalogItem.id,
          materialType: 'vinyl',
          displayName: 'Bad Company ID',
          status: 'mapped'
        });
        fail('Expected empty companyId to be rejected');
      } catch (error) {
        expect(error.message).toContain('companyId');
      }
    });

    test('accepts valid companyId', async () => {
      const catalogItem = await base44.asServiceRole.entities.MaterialCatalog.create({
        crm_name: 'Catalog Item',
        canonical_key: 'vinyl_panel_good_companyid',
        category: 'panel',
        material_type: 'vinyl',
        unit: 'each',
        cost: 45.00,
        active: true
      });

      expect(async () => {
        await base44.asServiceRole.entities.CompanySkuMap.create({
          companyId: 'PrivacyFenceCo49319',
          uck: 'vinyl_panel_good_companyid',
          materialCatalogId: catalogItem.id,
          materialType: 'vinyl',
          displayName: 'Good Company ID',
          status: 'mapped'
        });
      }).not.toThrow();
    });
  });
});