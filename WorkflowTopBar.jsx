import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ClipboardList, Check, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useWorkflowSession } from './useWorkflowSession';

const workflowSteps = [
  { id: 'job-card', label: 'Job Card', page: 'JobDetail', shortLabel: 'Card' },
  { id: 'job-edit', label: 'Job Edit', page: 'EditJob', shortLabel: 'Edit' },
  { id: 'job-cost', label: 'Pricing', page: 'PricingIntelligence', shortLabel: 'Price' },
  { id: 'present-price', label: 'Present Price', page: 'Present', shortLabel: 'Present' },
  { id: 'proposal', label: 'Proposal', page: 'Proposal', shortLabel: 'Proposal' },
  { id: 'signature', label: 'Signature', page: 'Signature', shortLabel: 'Sign' }
];

export default function WorkflowTopBar({ 
  jobId, 
  currentStep, 
  job,
  onAction,
  pricingStatus
}) {
  const navigate = useNavigate();

  // Authoritative unlock state from session hook
  const session = useWorkflowSession(jobId, job);
  const isStepUnlocked = (stepId) => session.isStepUnlocked(stepId);
  
  const isStepCompleted = (stepId) => {
    const currentIndex = workflowSteps.findIndex(s => s.id === currentStep);
    const stepIndex = workflowSteps.findIndex(s => s.id === stepId);
    return stepIndex < currentIndex;
  };
  
  const handleStepClick = (step) => {
    if (!isStepUnlocked(step.id)) {
      toast.error(`Complete previous steps to unlock ${step.label}`);
      return;
    }
    
    if (!jobId && step.id !== 'job-card') {
      toast.error('No job selected');
      return;
    }
    
    base44.analytics.track({
      eventName: "workflow_step_clicked",
      properties: { 
        job_id: jobId,
        from_step: currentStep,
        to_step: step.id,
        step_label: step.label
      }
    });
    
    const url = step.id === 'job-card' 
      ? createPageUrl(`${step.page}?jobId=${jobId}`)
      : createPageUrl(`${step.page}?jobId=${jobId}`);
    
    navigate(url);
  };
  
  const handleBack = () => {
    const currentIndex = workflowSteps.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      const prevStep = workflowSteps[currentIndex - 1];
      handleStepClick(prevStep);
    }
  };
  
  const handlePrimaryAction = () => {
    if (onAction) {
      onAction();
    }
  };
  
  // Determine primary action button based on current step
  const getPrimaryAction = () => {
    switch (currentStep) {
      case 'job-card':
        return { label: 'Open Job Edit', onClick: () => navigate(createPageUrl(`EditJob?jobId=${jobId}`)) };
      case 'job-edit':
        return { label: 'Go to Pricing', onClick: () => navigate(createPageUrl(`PricingIntelligence?jobId=${jobId}`)) };
      case 'job-cost':
        return { label: 'Present Price', onClick: () => navigate(createPageUrl(`Present?jobId=${jobId}`)) };
      case 'present-price':
        return { 
          label: 'Sign Proposal', 
          onClick: handlePrimaryAction,
          disabled: pricingStatus === 'INCOMPLETE'
        };
      case 'proposal':
        return { label: 'Continue to Signature', onClick: () => navigate(createPageUrl(`Signature?jobId=${jobId}`)) };
      case 'signature':
        return null;
      default:
        return null;
    }
  };
  
  const primaryAction = getPrimaryAction();
  
  return (
    <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
      <div className="max-w-full mx-auto px-2 py-1">
        <div className="flex items-center justify-between gap-2">
          {/* Left: All Jobs only */}
          <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl('Jobs'))} className="h-6 px-2 text-xs">
            <ClipboardList className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Jobs</span>
          </Button>
          
          {/* Center: Stepper */}
          <div className="flex items-center gap-0.5 overflow-x-auto">
            {workflowSteps.map((step, index) => {
               const isUnlocked = isStepUnlocked(step.id);
               const isCompleted = isStepCompleted(step.id);
               const isCurrent = step.id === currentStep;
               return (
                 <div key={step.id} className="flex items-center gap-0.5">
                   <button
                     onClick={() => handleStepClick(step)}
                     disabled={!isUnlocked}
                     className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-all
                       ${isCurrent ? 'bg-blue-600 text-white' : ''}
                       ${isCompleted ? 'bg-emerald-50 text-emerald-700' : ''}
                       ${!isUnlocked && !isCurrent ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}
                       ${isUnlocked && !isCurrent && !isCompleted ? 'bg-slate-50 text-slate-600 hover:bg-slate-100' : ''}
                     `}
                   >
                     {isCompleted && <Check className="w-2.5 h-2.5" />}
                     {!isUnlocked && !isCompleted && <Lock className="w-2.5 h-2.5" />}
                     <span className="hidden sm:inline">{step.shortLabel}</span>
                     <span className="sm:hidden">{step.shortLabel}</span>
                   </button>
                   {index < workflowSteps.length - 1 && <div className="w-2 h-px bg-slate-200" />}
                 </div>
               );
             })}
          </div>
          
          {/* Right: Primary Action */}
          <div className="flex items-center">
            {primaryAction && (
              <Button onClick={primaryAction.onClick} disabled={primaryAction.disabled}
                className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50" size="sm">
                {primaryAction.label}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}