import React from 'react';
import { X, MapPin, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

export default function EventDrawer({ event, onClose, jobData }) {
  if (!event) return null;
  
  const handleNavigate = (pageName, params) => {
    const url = createPageUrl(pageName, params);
    window.location.href = url;
  };
  
  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const hasJobId = event.jobId && event.jobId !== undefined;
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-end">
      <div
        className="bg-white w-full md:w-96 h-auto md:h-full md:max-h-[600px] rounded-t-xl md:rounded-l-xl shadow-lg overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{event.title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Event Details */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-500 uppercase">Start</p>
                <p className="text-sm text-slate-900">{formatDate(event.startAt)}</p>
              </div>
            </div>
            
            {event.endAt && (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase">End</p>
                  <p className="text-sm text-slate-900">{formatDate(event.endAt)}</p>
                </div>
              </div>
            )}
            
            {event.type && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Type</p>
                <p className="text-sm text-slate-900 capitalize">{event.type}</p>
              </div>
            )}
            
            {event.status && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Status</p>
                <p className="text-sm text-slate-900 capitalize">{event.status}</p>
              </div>
            )}
            
            {event.meta?.jobNumber && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Job Number</p>
                <p className="text-sm text-slate-900 font-mono">{event.meta.jobNumber}</p>
              </div>
            )}
          </div>
          
          {/* Navigation Buttons */}
          <div className="flex flex-col gap-2 pt-4 border-t border-slate-200">
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              disabled={!hasJobId}
              onClick={() => hasJobId && handleNavigate('JobDetail', { jobId: event.jobId })}
            >
              <ExternalLink className="w-4 h-4" />
              View Job
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              disabled={!hasJobId}
              onClick={() => hasJobId && handleNavigate('PricingIntelligence', { jobId: event.jobId })}
            >
              <ExternalLink className="w-4 h-4" />
              Pricing
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              disabled={!hasJobId}
              onClick={() => hasJobId && handleNavigate('Proposal', { jobId: event.jobId })}
            >
              <ExternalLink className="w-4 h-4" />
              Proposal
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}