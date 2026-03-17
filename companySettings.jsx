import { base44 } from '@/api/base44Client';

/**
 * Company Settings Service
 * Provides centralized access to company configuration
 */

let cachedSettings = null;

/**
 * Get company settings (cached)
 * Returns default settings if none exist
 */
export async function getCompanySettings() {
  if (cachedSettings) {
    return cachedSettings;
  }

  try {
    const settings = await base44.entities.CompanySettings.list();
    
    if (settings && settings.length > 0) {
      cachedSettings = settings[0];
      return cachedSettings;
    }

    // Return defaults if no settings exist
    return getDefaultSettings();
  } catch (error) {
    console.warn('Failed to load company settings, using defaults:', error);
    return getDefaultSettings();
  }
}

/**
 * Clear cached settings (call after update)
 */
export function clearSettingsCache() {
  cachedSettings = null;
}

/**
 * Get default company settings
 */
export function getDefaultSettings() {
  return {
    companyName: 'Privacy Fence Company',
    phone: '(616) 555-FENCE',
    email: 'info@fencebuddy.com',
    city: 'Grand Rapids',
    state: 'MI',
    colorPrimaryHex: '#4db8ad',
    colorSecondaryHex: '#2c3e50',
    colorAccentHex: '#3da89d',
    colorInkHex: '#1e293b',
    colorBackgroundHex: '#f8fafc',
    targetGrossMarginPct: 45,
    targetNetMarginPct: 30,
    overheadPct: 14,
    commissionPct: 10,
    incentiveGrassRootsName: 'Grass Roots',
    incentiveGrassRootsPct: 5,
    incentiveEfficiencyName: 'Efficiency',
    incentiveEfficiencyPct: 5,
    discountCashPct: 2,
    discountFirstResponderPct: 3,
    laborModel: 'per_lf',
    laborRatesJson: {
      vinyl: { perLf: 10 },
      wood: { perLf: 12 },
      chainlink: { perLf: 8 },
      aluminum: { perLf: 15 },
      singleGate: { flat: 75 },
      doubleGate: { flat: 125 }
    }
  };
}

/**
 * Create or update company settings
 */
export async function saveCompanySettings(settingsData) {
  try {
    const existing = await base44.entities.CompanySettings.list();
    const user = await base44.auth.me();
    
    const dataWithUser = {
      ...settingsData,
      updatedBy: user?.email || 'system'
    };

    let result;
    if (existing && existing.length > 0) {
      result = await base44.entities.CompanySettings.update(existing[0].id, dataWithUser);
    } else {
      result = await base44.entities.CompanySettings.create(dataWithUser);
    }

    clearSettingsCache();
    return result;
  } catch (error) {
    console.error('Failed to save company settings:', error);
    throw error;
  }
}