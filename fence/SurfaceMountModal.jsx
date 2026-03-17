import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";

export default function SurfaceMountModal({ isOpen, onClose, onApplyToAll, onApplyToOne, isUpdating }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-600" />
            Surface Mount Posts?
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600 pt-2">
            Do you want to surface mount all posts or only this post?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> Surface mounting replaces in-ground installation with bracket/plate mounting.
              Materials and costs will update automatically.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isUpdating}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={onApplyToOne}
            disabled={isUpdating}
            className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
          >
            Only This Post
          </Button>
          <Button
            onClick={onApplyToAll}
            disabled={isUpdating}
            className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto"
          >
            All Posts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}