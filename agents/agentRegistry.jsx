/**
 * AGENT REGISTRY
 * Single source of truth for all FenceIQ agents
 * Maps agentKeys to implementations and trigger bindings
 */

import { materialLinkGuardianAgent } from './materialLinkGuardianAgent';

export const AGENT_REGISTRY = {
  materialLinkGuardian: {
    key: 'materialLinkGuardian',
    name: 'Material Link Guardian',
    description: 'Keeps MaterialCatalog ↔ SelectionSets ↔ UCK line items permanently linked',
    implementation: materialLinkGuardianAgent,
    triggers: {
      entities: ['SelectionSet', 'MaterialCatalog'],
      events: ['create', 'update'],
      scheduled: { frequency: 'daily', hour: 2 }
    }
  },
  
  // Future agents will be registered here:
  // selectionSetDrift: { ... },
  // canonicalGrammarEnforcer: { ... },
  // configDriftGuardian: { ... },
  // recomputeStormDetector: { ... },
  // marginIntelligence: { ... },
  // dataQualitySentinel: { ... }
};

export function getAgent(agentKey) {
  const agent = AGENT_REGISTRY[agentKey];
  if (!agent) {
    throw new Error(`Unknown agent: ${agentKey}`);
  }
  return agent;
}

export function listAgents() {
  return Object.values(AGENT_REGISTRY);
}