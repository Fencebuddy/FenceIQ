import React from 'react';
import { Button } from '@/components/ui/button';
import { Undo, Redo, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * PRO MODE CONTROLS
 * Undo/Redo and Delete buttons for Pro Mode
 */
export default function ProModeControls({ 
  canUndo, 
  canRedo, 
  onUndo, 
  onRedo,
  selectedCount,
  onDelete
}) {
  return (
    <div className="absolute bottom-4 right-4 z-10 bg-white rounded-lg shadow-lg border border-slate-200 p-2 flex gap-2 items-center">
      {/* Selection count */}
      {selectedCount > 0 && (
        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
          {selectedCount} selected
        </Badge>
      )}
      
      {/* Delete button */}
      {selectedCount > 0 && (
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          className="gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </Button>
      )}
      
      {/* Undo button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onUndo}
        disabled={!canUndo}
        className="gap-2"
      >
        <Undo className="w-4 h-4" />
        Undo
      </Button>
      
      {/* Redo button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onRedo}
        disabled={!canRedo}
        className="gap-2"
      >
        <Redo className="w-4 h-4" />
        Redo
      </Button>
    </div>
  );
}