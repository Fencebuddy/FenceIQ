/**
 * LIVE TAKEOFF STORE
 * Single source of truth for computed takeoff materials
 * Enables instant Job Cost navigation without snapshot dependency
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const TakeoffStoreContext = createContext(null);

const STORAGE_PREFIX = 'takeoff_live_';

export function TakeoffStoreProvider({ children }) {
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
          console.warn('[TakeoffStore] Failed to load from localStorage:', key);
        }
      }
    }
    setTakeoffs(stored);
  }, []);

  const setTakeoff = (jobId, lineItems, metadata = {}) => {
    const data = {
      jobId,
      lineItems,
      lastComputedAt: new Date().toISOString(),
      ...metadata
    };

    // Update state
    setTakeoffs(prev => ({ ...prev, [jobId]: data }));

    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_PREFIX + jobId, JSON.stringify(data));
    } catch (e) {
      console.warn('[TakeoffStore] Failed to persist to localStorage:', e);
    }

    console.log('[TakeoffStore] Set takeoff for job:', jobId, 'lineItems:', lineItems.length);
  };

  const getTakeoff = (jobId) => {
    return takeoffs[jobId] || null;
  };

  const clearTakeoff = (jobId) => {
    setTakeoffs(prev => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });

    try {
      localStorage.removeItem(STORAGE_PREFIX + jobId);
    } catch (e) {
      console.warn('[TakeoffStore] Failed to clear localStorage:', e);
    }
  };

  return (
    <TakeoffStoreContext.Provider value={{ setTakeoff, getTakeoff, clearTakeoff }}>
      {children}
    </TakeoffStoreContext.Provider>
  );
}

export function useTakeoffStore() {
  const context = useContext(TakeoffStoreContext);
  if (!context) {
    throw new Error('useTakeoffStore must be used within TakeoffStoreProvider');
  }
  return context;
}