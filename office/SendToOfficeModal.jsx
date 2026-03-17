import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { XCircle, AlertCircle, Loader2 } from "lucide-react";

export function BlockedModal({ isOpen, onClose, issues, onAutoFix, isFixing }) {
  const blockerIssues = issues.filter(i => i.severity === 'BLOCKER');
  const autoFixableIssues = blockerIssues.filter(i => i.autoFixable);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <XCircle className="w-5 h-5" />
            Fix Required Before Sending
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {blockerIssues.map((issue, idx) => (
            <Alert key={idx} className="border-red-500 bg-red-50">
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium text-red-900">{issue.message}</p>
                  <p className="text-sm text-red-700">
                    <strong>Fix:</strong> {issue.suggestedFix}
                  </p>
                  {issue.location && (
                    <p className="text-xs text-red-600">
                      <strong>Location:</strong> {issue.location}
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Back to Job
          </Button>
          {autoFixableIssues.length > 0 && (
            <Button 
              onClick={onAutoFix}
              disabled={isFixing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isFixing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fixing...
                </>
              ) : (
                `Auto-Fix All (${autoFixableIssues.length})`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmModal({ isOpen, onClose, issues, onConfirm, isSending }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const criticalIssues = issues.filter(i => i.severity === 'CRITICAL');
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-700">
            <AlertCircle className="w-5 h-5" />
            Confirm to Proceed
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {criticalIssues.map((issue, idx) => (
            <Alert key={idx} className="border-orange-500 bg-orange-50">
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium text-orange-900">{issue.message}</p>
                  <p className="text-sm text-orange-700">
                    <strong>Note:</strong> {issue.suggestedFix}
                  </p>
                  {issue.location && (
                    <p className="text-xs text-orange-600">
                      <strong>Location:</strong> {issue.location}
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          ))}
          
          <div className="flex items-start gap-2 p-4 bg-slate-50 rounded-lg border">
            <Checkbox 
              id="acknowledge"
              checked={acknowledged}
              onCheckedChange={setAcknowledged}
            />
            <label 
              htmlFor="acknowledge" 
              className="text-sm cursor-pointer leading-tight"
            >
              I acknowledge these warnings and confirm the job is ready to send to office.
            </label>
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Back to Job
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={!acknowledged || isSending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Confirm & Send'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}