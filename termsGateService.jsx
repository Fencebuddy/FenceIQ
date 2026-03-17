/**
 * Terms Gate Service
 * Handles Terms of Service acceptance logic and audit trail
 */

import { base44 } from '@/api/base44Client';

/**
 * Fetch company settings (first row if multiple exist)
 */
export async function getCompanySettings() {
  try {
    const settings = await base44.entities.CompanySettings.list();
    if (!settings || settings.length === 0) {
      return null;
    }
    return settings[0];
  } catch (error) {
    console.error('[TermsGate] Failed to fetch CompanySettings:', error);
    return null;
  }
}

/**
 * Get current terms version from settings or default
 */
export function getCurrentTermsVersion(settings) {
  if (!settings) return '2026.01';
  return settings.termsCurrentVersion || '2026.01';
}

/**
 * Check if user needs to accept terms
 */
export function needsAcceptance(user, currentVersion) {
  if (!user) return false;
  if (!user.termsAcceptedVersion) return true;
  return user.termsAcceptedVersion !== currentVersion;
}

/**
 * Record terms acceptance for user
 */
export async function acceptTerms(userId, currentVersion) {
  try {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    
    // Update user with acceptance data
    await base44.auth.updateMe({
      termsAcceptedVersion: currentVersion,
      termsAcceptedAt: new Date().toISOString(),
      termsAcceptedUserAgent: userAgent,
      termsAcceptedIp: null // IP capture not implemented client-side
    });

    return { success: true };
  } catch (error) {
    console.error('[TermsGate] Failed to accept terms:', error);
    return { success: false, error: error.message };
  }
}