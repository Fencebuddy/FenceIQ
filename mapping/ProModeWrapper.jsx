import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ProModeToggle from './ProModeToggle';
import ProModeControls from './ProModeControls';
import { useProMode } from './useProMode';

/**
 * PRO MODE WRAPPER
 * Wraps FenceCanvas with Pro Mode UI controls
 */
export default function ProModeWrapper({ 
  children,
  fenceLines,
  setFenceLines,
  gates,
  setGates,
  doubleGates,
  setDoubleGates,
  trees,
  setTrees,
  houses,
  setHouses,
  pools,
  setPools,
  garages,
  setGarages,
  dogs,
  setDogs,
  annotations,
  setAnnotations,
  selectedItem,
  setSelectedItem,
  selectedItems,
  setSelectedItems
}) {
  // Fetch company settings
  const { data: companySettings } = useQuery({
    queryKey: ['companySettings'],
    queryFn: async () => {
      const settings = await base44.entities.CompanySettings.list();
      return settings[0];
    },
    staleTime: 5 * 60 * 1000,
  });
  
  // Pro Mode hook
  const {
    isProMode,
    setIsProMode,
    proModeAvailable,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    handleDelete
  } = useProMode(companySettings);
  
  // Get current map state
  const getMapState = useCallback(() => ({
    fenceLines,
    gates,
    doubleGates,
    trees,
    houses,
    pools,
    garages,
    dogs,
    annotations
  }), [fenceLines, gates, doubleGates, trees, houses, pools, garages, dogs, annotations]);
  
  // Set map state
  const setMapState = useCallback((newState) => {
    if (newState.fenceLines !== undefined) setFenceLines(newState.fenceLines);
    if (newState.gates !== undefined) setGates(newState.gates);
    if (newState.doubleGates !== undefined) setDoubleGates(newState.doubleGates);
    if (newState.trees !== undefined) setTrees(newState.trees);
    if (newState.houses !== undefined) setHouses(newState.houses);
    if (newState.pools !== undefined) setPools(newState.pools);
    if (newState.garages !== undefined) setGarages(newState.garages);
    if (newState.dogs !== undefined) setDogs(newState.dogs);
    if (newState.annotations !== undefined) setAnnotations(newState.annotations);
  }, [setFenceLines, setGates, setDoubleGates, setTrees, setHouses, setPools, setGarages, setDogs, setAnnotations]);
  
  // Handle delete action
  const onDeletePressed = useCallback(() => {
    const itemsToDelete = selectedItems.length > 0 ? selectedItems : 
                          selectedItem ? [selectedItem] : [];
    
    if (itemsToDelete.length === 0) return;
    
    handleDelete(itemsToDelete, getMapState, setMapState);
    
    // Clear selection
    setSelectedItem(null);
    setSelectedItems([]);
  }, [selectedItems, selectedItem, handleDelete, getMapState, setMapState, setSelectedItem, setSelectedItems]);
  
  // Delete key handler
  useEffect(() => {
    if (!isProMode) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeletePressed();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProMode, onDeletePressed]);
  
  // Calculate selected count
  const selectedCount = selectedItems.length > 0 ? selectedItems.length : 
                        selectedItem ? 1 : 0;
  
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Pro Mode Toggle */}
      <ProModeToggle
        isProMode={isProMode}
        onToggle={setIsProMode}
        proModeAvailable={proModeAvailable}
      />
      
      {/* Map Canvas */}
      {children}
      
      {/* Pro Mode Controls */}
      {isProMode && (
        <ProModeControls
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          selectedCount={selectedCount}
          onDelete={onDeletePressed}
        />
      )}
    </div>
  );
}