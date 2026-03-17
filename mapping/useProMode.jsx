import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { getCommandStack } from './commandStack';
import { DeleteObjectsCommand } from './mapCommands';

/**
 * PRO MODE HOOK
 * Manages Pro Mode state and command stack
 */
export function useProMode(companySettings) {
  const [isProMode, setIsProMode] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  const commandStack = getCommandStack();
  
  // Check if Pro Mode is available
  const proModeAvailable = companySettings?.mappingSettings?.proModeEnabled === true;
  
  // Update undo/redo state
  useEffect(() => {
    const updateCommandState = () => {
      setCanUndo(commandStack.canUndo());
      setCanRedo(commandStack.canRedo());
    };
    
    // Poll for command stack changes
    const interval = setInterval(updateCommandState, 100);
    
    return () => clearInterval(interval);
  }, []);
  
  // Handle undo
  const handleUndo = useCallback(() => {
    if (commandStack.undo()) {
      setCanUndo(commandStack.canUndo());
      setCanRedo(commandStack.canRedo());
    }
  }, []);
  
  // Handle redo
  const handleRedo = useCallback(() => {
    if (commandStack.redo()) {
      setCanUndo(commandStack.canUndo());
      setCanRedo(commandStack.canRedo());
    }
  }, []);
  
  // Handle delete
  const handleDelete = useCallback((selectedItems, getStateFn, setStateFn) => {
    if (selectedItems.length === 0) return;
    
    const command = new DeleteObjectsCommand(selectedItems, getStateFn, setStateFn);
    commandStack.execute(command);
    setCanUndo(commandStack.canUndo());
    setCanRedo(commandStack.canRedo());
  }, []);
  
  // Keyboard shortcuts
  useEffect(() => {
    if (!isProMode) return;
    
    const handleKeyDown = (e) => {
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      
      // Redo: Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y
      if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) || 
          (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProMode, handleUndo, handleRedo]);
  
  return {
    isProMode,
    setIsProMode,
    proModeAvailable,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    handleDelete,
    commandStack
  };
}