/**
 * LIVE TAKEOFF STORE V2 - VARIANT AWARE
 * Stores takeoffs per-variant (a, b, c)
 * Enables instant variant comparison without snapshot dependency
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const TakeoffStoreContext = createContext(null);

const STORAGE_PREFIX = 'takeoff_v2_';

export function TakeoffStoreProviderV2({ children }) {
  const [takeoffs, setTakeoffs] = useState({});

  // Load from localStorage on mount
  useEffect(() => {
    const stored = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(STORAGE_PREFIX)) {
        const jobId = key.replace(STORAGE_PREFIX, '');
        try {
          const data = JSON.parse(localStorage.getItem(key));
          stored[jobId] = data;
        } catch (e) {
          console.warn('[TakeoffStoreV2] Failed to load from localStorage:', key);
        }
      }
    }
    setTakeoffs(stored);
  }, []);

  /**
   * Set takeoff for a specific variant
   * @param {string} jobId
   * @param {string} variantKey - 'a', 'b', 'c'
   * @param {Array} lineItems
   * @param {Object} metadata
   */
  const setTakeoff = (jobId, variantKey, lineItems, metadata = {}) => {
    const data = {
      jobId,
      variantKey,
      lineItems,
      lastComputedAt: new Date().toISOString(),
      ...metadata
    };

    setTakeoffs(prev => {
      const jobData = prev[jobId] || {};
      return {
        ...prev,
        [jobId]: {
          ...jobData,
          [variantKey]: data
        }
      };
    });

    // Persist to localStorage (entire job record)
    try {
      const fullRecord = takeoffs[jobId] || {};
      fullRecord[variantKey] = data;
      localStorage.setItem(STORAGE_PREFIX + jobId, JSON.stringify(fullRecord));
    } catch (e) {
      console.warn('[TakeoffStoreV2] Failed to persist to localStorage:', e);
    }

    console.log(`[TakeoffStoreV2] Set takeoff for job:${jobId} variant:${variantKey}`);
  };

  /**
   * Get takeoff for specific variant
   * @param {string} jobId
   * @param {string} variantKey - 'a', 'b', 'c'
   * @returns {Object} Takeoff data or null
   */
  const getTakeoff = (jobId, variantKey) => {
    return takeoffs[jobId]?.[variantKey] || null;
  };

  /**
   * Get all variants for a job
   * @param {string} jobId
   * @returns {Object} { a: {...}, b: {...}, c: {...} } or empty
   */
  const getAllVariants = (jobId) => {
    return takeoffs[jobId] || {};
  };

  /**
   * Clear specific variant
   * @param {string} jobId
   * @param {string} variantKey
   */
  const clearVariant = (jobId, variantKey) => {
    setTakeoffs(prev => {
      const jobData = prev[jobId] || {};
      const updated = { ...jobData };
      delete updated[variantKey];
      
      if (Object.keys(updated).length === 0) {
        const next = { ...prev };
        delete next[jobId];
        return next;
      }
      
      return { ...prev, [jobId]: updated };
    });

    // Persist update
    try {
      const fullRecord = takeoffs[jobId] || {};
      delete fullRecord[variantKey];
      
      if (Object.keys(fullRecord).length === 0) {
        localStorage.removeItem(STORAGE_PREFIX + jobId);
      } else {
        localStorage.setItem(STORAGE_PREFIX + jobId, JSON.stringify(fullRecord));
      }
    } catch (e) {
      console.warn('[TakeoffStoreV2] Failed to persist clear:', e);
    }
  };

  /**
   * Clear all variants for a job
   * @param {string} jobId
   */
  const clearAllVariants = (jobId) => {
    setTakeoffs(prev => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });

    try {
      localStorage.removeItem(STORAGE_PREFIX + jobId);
    } catch (e) {
      console.warn('[TakeoffStoreV2] Failed to clear job:', e);
    }
  };

  return (
    <TakeoffStoreContext.Provider value={{
      setTakeoff,
      getTakeoff,
      getAllVariants,
      clearVariant,
      clearAllVariants
    }}>
      {children}
    </TakeoffStoreContext.Provider>
  );
}

export function useTakeoffStoreV2() {
  const context = useContext(TakeoffStoreContext);
  if (!context) {
    throw new Error('useTakeoffStoreV2 must be used within TakeoffStoreProviderV2');
  }
  return context;
}