import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { acceptTerms } from './services/termsGateService';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

export default function TermsAcceptanceModal({ open, currentVersion, userId }) {
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);

    const result = await acceptTerms(userId, currentVersion);

    if (result.success) {
      // Invalidate user cache to refetch with new acceptance data
      await queryClient.invalidateQueries(['currentUser']);
      toast.success('Terms accepted successfully');
    } else {
      setError(result.error || 'Failed to accept terms. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} modal>
      <DialogContent 
        className="max-w-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Fence Buddy IQ – Terms of Service
          </DialogTitle>
          <DialogDescription className="text-base text-slate-600 mt-2">
            To continue using Fence Buddy IQ, you must review and accept our Terms of Service and Privacy Policy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Legal Documents Links */}
          <div className="space-y-3">
            <p className="text-sm text-slate-700 font-medium">
              Please review the following documents:
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="/legal/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Terms of Service
              </a>
              <a
                href="/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Privacy Policy
              </a>
            </div>
          </div>

          {/* Acceptance Checkbox */}
          <div className="border-t pt-4">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <Checkbox
                id="terms-accept"
                checked={accepted}
                onCheckedChange={setAccepted}
                disabled={submitting}
                className="mt-0.5"
              />
              <label
                htmlFor="terms-accept"
                className="text-sm text-slate-700 cursor-pointer select-none"
              >
                I have read and agree to be legally bound by the Fence Buddy IQ Terms of Service and Privacy Policy.
              </label>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Accept Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleAccept}
              disabled={!accepted || submitting}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Accept & Continue'
              )}
            </Button>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Version {currentVersion}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}