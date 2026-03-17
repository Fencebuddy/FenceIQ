import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CheckCircle2, Circle } from 'lucide-react';

const STEPS = [
  { key: 'job-card', label: 'Job Card', route: 'NewJob' },
  { key: 'job-edit', label: 'Job Edit', route: 'EditJob' },
  { key: 'job-cost', label: 'Job Cost', route: 'JobCost' },
  { key: 'present-price', label: 'Present Price', route: 'PricePresentation' },
  { key: 'proposal', label: 'Proposal', route: 'Proposal' },
  { key: 'signature', label: 'Signature', route: 'Signature' }
];

export default function StepFlow({ currentPage, jobId }) {
  const navigate = useNavigate();
  const pageToStep = {
    'NewJob': 0,
    'EditJob': 1,
    'JobDetail': 1,
    'JobCost': 2,
    'PricePresentation': 3,
    'Proposal': 4,
    'Signature': 5
  };
  const activeIndex = pageToStep[currentPage] ?? -1;

  const handleStepClick = (index) => {
    // Only allow clicking previous steps
    if (index >= activeIndex || !jobId) return;
    
    const step = STEPS[index];
    const url = jobId ? createPageUrl(`${step.route}?jobId=${jobId}`) : createPageUrl(step.route);
    navigate(url);
  };

  // Don't show on Jobs list page - render null but after all hooks
  if (activeIndex === -1) {
    return null;
  }

  return (
    <>
      {/* Desktop - Full Step Flow */}
      <div className="hidden lg:flex items-center gap-3">
        {STEPS.map((step, index) => {
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;
          const isFuture = index > activeIndex;

          return (
            <React.Fragment key={step.key}>
              <button
                onClick={() => handleStepClick(index)}
                disabled={isFuture || !jobId}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-blue-100 text-blue-700 font-semibold' 
                    : isPast 
                    ? 'text-emerald-600 hover:bg-emerald-50 cursor-pointer' 
                    : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                {isPast ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Circle className={`w-4 h-4 ${isActive ? 'fill-blue-700' : ''}`} />
                )}
                <span className="text-sm whitespace-nowrap">{step.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div className="w-8 h-px bg-slate-300" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile - Current Step Only */}
      <div className="lg:hidden flex items-center gap-2">
        <div className="flex items-center gap-1">
          {STEPS.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full ${
                index === activeIndex 
                  ? 'bg-blue-600 w-6' 
                  : index < activeIndex 
                  ? 'bg-emerald-500' 
                  : 'bg-slate-300'
              }`}
            />
          ))}
        </div>
        <span className="text-sm font-semibold text-slate-700 ml-2">
          {STEPS[activeIndex]?.label}
        </span>
      </div>
    </>
  );
}