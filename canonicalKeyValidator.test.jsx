/**
 * UNIT TEST: Canonical Key Validator
 * Tests validateCanonicalKey() against strict rules
 */

import { validateCanonicalKey } from '@/components/canonicalKeyEngine/validators';

describe('validateCanonicalKey', () => {
  
  describe('Valid Keys', () => {
    test('accepts lowercase a-z with underscores', () => {
      expect(() => validateCanonicalKey('vinyl_panel_6x8')).not.toThrow();
    });

    test('accepts numeric segments', () => {
      expect(() => validateCanonicalKey('vinyl_panel_6_8')).not.toThrow();
    });

    test('accepts dimension patterns', () => {
      expect(() => validateCanonicalKey('chainlink_panel_6ft_galv')).not.toThrow();
    });

    test('accepts hardware items', () => {
      expect(() => validateCanonicalKey('post_bracket_aluminum_2x2')).not.toThrow();
    });

    test('accepts color variants (lowercase only)', () => {
      expect(() => validateCanonicalKey('vinyl_panel_white_5x5')).not.toThrow();
    });

    test('accepts material type prefixes', () => {
      const validKeys = [
        'vinyl_post_5x5',
        'chainlink_fabric_6ft_galv',
        'wood_picket_6ft',
        'aluminum_rail_top_21ft'
      ];
      validKeys.forEach(key => {
        expect(() => validateCanonicalKey(key)).not.toThrow();
      });
    });
  });

  describe('Invalid Keys — Rejected', () => {
    test('rejects dots', () => {
      expect(() => validateCanonicalKey('vinyl.panel.6x8')).toThrow();
    });

    test('rejects hyphens', () => {
      expect(() => validateCanonicalKey('vinyl-panel-6x8')).toThrow();
    });

    test('rejects uppercase letters', () => {
      expect(() => validateCanonicalKey('Vinyl_Panel_6x8')).toThrow();
      expect(() => validateCanonicalKey('VINYL_PANEL_6X8')).toThrow();
    });

    test('rejects spaces', () => {
      expect(() => validateCanonicalKey('vinyl panel 6x8')).toThrow();
    });

    test('rejects special characters', () => {
      expect(() => validateCanonicalKey('vinyl@panel#6x8')).toThrow();
      expect(() => validateCanonicalKey('vinyl$panel%6x8')).toThrow();
    });

    test('rejects forbidden tokens', () => {
      expect(() => validateCanonicalKey('vinyl_panel_galvanized')).toThrow();
      expect(() => validateCanonicalKey('chainlink_fabric_black_vinyl_coated')).toThrow();
      expect(() => validateCanonicalKey('post_bracket_vinyl_coated')).toThrow();
    });

    test('rejects empty string', () => {
      expect(() => validateCanonicalKey('')).toThrow();
    });

    test('rejects null/undefined', () => {
      expect(() => validateCanonicalKey(null)).toThrow();
      expect(() => validateCanonicalKey(undefined)).toThrow();
    });

    test('rejects leading/trailing underscores', () => {
      expect(() => validateCanonicalKey('_vinyl_panel_6x8')).toThrow();
      expect(() => validateCanonicalKey('vinyl_panel_6x8_')).toThrow();
    });

    test('rejects double underscores', () => {
      expect(() => validateCanonicalKey('vinyl__panel__6x8')).toThrow();
    });
  });

  describe('Normalization', () => {
    test('normalizes whitespace', () => {
      expect(() => validateCanonicalKey('  vinyl_panel_6x8  ')).not.toThrow();
    });

    test('converts to lowercase', () => {
      expect(() => validateCanonicalKey('VINYL_PANEL_6X8')).toThrow(); // Strict: no auto-lowercase in validator
    });
  });

  describe('Edge Cases', () => {
    test('accepts long keys (no length limit)', () => {
      const longKey = 'vinyl_panel_' + 'a'.repeat(100) + '_6x8';
      expect(() => validateCanonicalKey(longKey)).not.toThrow();
    });

    test('accepts numeric-heavy keys', () => {
      expect(() => validateCanonicalKey('vinyl_panel_6_8_white_2024')).not.toThrow();
    });

    test('rejects keys with only underscores', () => {
      expect(() => validateCanonicalKey('___')).toThrow();
    });
  });
});