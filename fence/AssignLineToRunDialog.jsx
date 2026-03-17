import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export default function AssignLineToRunDialog({ isOpen, onClose, fenceLine, runs, onAssign, onCreateRun }) {
  const [selectedRunId, setSelectedRunId] = useState(fenceLine?.assignedRunId || null);
  const [isSaving, setIsSaving] = useState(false);

  if (!fenceLine) return null;

  const handleSave = async () => {
    if (!selectedRunId) return;
    setIsSaving(true);
    try {
      await onAssign(selectedRunId);
    } catch (error) {
      console.error('Assignment failed:', error);
    }
    setIsSaving(false);
  };

  const currentlyAssignedRun = runs.find(r => r.id === fenceLine.assignedRunId);
  const rawLength = fenceLine.manualLengthFt || fenceLine.length || 0;
  const lineLength = Math.round(rawLength * 2) / 2; // Round to nearest 0.5 ft

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Fence Line to Run</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-600 mb-1">Fence Line Length</div>
            <div className="text-2xl font-bold text-slate-900">{lineLength.toFixed(1)} ft</div>
          </div>

          {currentlyAssignedRun && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="text-xs text-emerald-600 mb-1">Currently Assigned To:</div>
              <div className="font-semibold text-emerald-900">{currentlyAssignedRun.runLabel}</div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Assign to Run:</label>
            <Select value={selectedRunId || ''} onValueChange={setSelectedRunId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a run..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-slate-500 italic">Unassign</span>
                </SelectItem>
                {runs.map(run => (
                  <SelectItem key={run.id} value={run.id}>
                    <div className="flex items-center gap-2">
                      <span>{run.runLabel}</span>
                      <Badge variant="outline" className="text-[9px]">
                        {run.lengthLF} LF
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {runs.length === 0 && (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-800 mb-2">No runs available. Create one to assign this fence line.</p>
              </div>
            )}
            
            <Button
              variant="outline"
              onClick={() => {
                if (onCreateRun) {
                  onCreateRun();
                }
              }}
              className="w-full mt-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Run
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedRunId || isSaving} className="bg-emerald-600 hover:bg-emerald-700">
            {isSaving ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}