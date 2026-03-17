/**
 * EXECUTIVE DATA SERVICE
 * Service layer for Executive Intelligence Engine
 * Handles data fetching and state computation
 */

import { getExecutiveState } from '../intelligence/ExecutiveIntelligenceEngine';

export async function loadExecutiveState({ companyId, range }) {
  if (!companyId) {
    throw new Error('Company ID is required');
  }
  
  return await getExecutiveState({ companyId, range });
}