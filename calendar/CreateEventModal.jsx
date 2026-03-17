import React, { useState, useEffect } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createCalendarEvent, findActiveByJobAndType } from '@/components/services/calendarEventService';
import { searchJobs, getJobById, isJobSoldSync } from '@/components/services/jobLookupService';
import { getDefaultEventTimes, validateEventDates } from '@/components/calendar/calendarDefaults';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const EVENT_TYPE_LABELS = {
  appointment: 'Appointment',
  install: 'Installation (Production)',
  followup: 'Follow-up',
  service: 'Service',
};

const generateDefaultTitle = (job, type) => {
  if (!job) return '';
  const typeLabel = {
    appointment: 'Appointment',
    install: 'Install',
    followup: 'Follow-up',
    service: 'Service',
  }[type] || type;
  return `${job.customerName} — ${typeLabel}`;
};

// Removed in favor of getDefaultEventTimes() from calendarDefaults

export default function CreateEventModal({ isOpen, onClose, companyId, onSuccess, prefilledJob = null, prefilledType = null, onOpenEvent = null }) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedJob, setSelectedJob] = useState(prefilledJob || null);
  const [jobSoldStatus, setJobSoldStatus] = useState(null);

  const defaultDateTime = getDefaultEventTimes({ type: prefilledType || 'appointment' });

  const [formData, setFormData] = useState({
    type: prefilledType || (prefilledJob ? 'appointment' : 'appointment'),
    title: prefilledJob ? generateDefaultTitle(prefilledJob, prefilledType || 'appointment') : '',
    startAt: defaultDateTime.startAt,
    endAt: defaultDateTime.endAt,
    status: 'scheduled',
    notes: '',
  });

  // Auto-update title when job or type changes
  useEffect(() => {
    if (selectedJob) {
      const newTitle = generateDefaultTitle(selectedJob, formData.type);
      setFormData((prev) => ({ ...prev, title: newTitle }));
    }
  }, [selectedJob, formData.type]);

  // Check if selected job is sold (sync, no async race)
  useEffect(() => {
    if (selectedJob) {
      setJobSoldStatus(isJobSoldSync(selectedJob));
    }
  }, [selectedJob]);

  // Search jobs on input change
  useEffect(() => {
    if (!jobSearch.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchJobs({ companyId, q: jobSearch, limit: 10 })
      .then((results) => {
        setSearchResults(results);
      })
      .finally(() => setIsSearching(false));
  }, [jobSearch, companyId]);

  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setJobSearch('');
    setSearchResults([]);
  };

  const handleClearJob = () => {
    setSelectedJob(null);
    setJobSearch('');
    setSearchResults([]);
    setJobSoldStatus(null);
  };

  const handleTypeChange = (newType) => {
    // Check dedupe before type change
    if (newType === 'install' && selectedJob && !jobSoldStatus) {
      toast.error('Install scheduling is available once the job is Sold.');
      return;
    }
    setFormData((prev) => ({ ...prev, type: newType }));
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Double-submit protection: guard against rapid clicks
    if (isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);

    try {
      // Require job linkage for appointment/install
      if (['appointment', 'install'].includes(formData.type) && !selectedJob) {
        toast.error('Select a customer/job to schedule an appointment or install.');
        setIsSubmitting(false);
        return;
      }

      // Validate dates (strong validation, no invalid date crashes)
      const dateValidation = validateEventDates(formData.startAt, formData.endAt);
      if (!dateValidation.valid) {
        toast.error(dateValidation.error);
        setIsSubmitting(false);
        return;
      }

      // Convert to ISO format
      const startAt = new Date(formData.startAt).toISOString();
      const endAt = new Date(formData.endAt).toISOString();

      // Check sold gate for install events (submit-time enforcement)
      if (formData.type === 'install') {
        const isSold = isJobSoldSync(selectedJob);
        if (!isSold) {
          toast.error('Install scheduling is available when the job is Sold.');
          setIsSubmitting(false);
          return;
        }
      }

      // Dedupe check: prevent duplicate active events for this job+type
      if (selectedJob) {
        const existing = await findActiveByJobAndType({
          companyId,
          jobId: selectedJob.id,
          type: formData.type,
        });

        if (existing.length > 0) {
          // DEDUPE UX: Open existing event instead of creating
          if (onOpenEvent) {
            onOpenEvent(existing[0]);
            onClose();
            setIsSubmitting(false);
            return;
          }

          toast.error(
            `An active ${formData.type} is already scheduled for this job.`
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Create event
      await createCalendarEvent({
        companyId,
        jobId: selectedJob?.id,
        type: formData.type,
        title: formData.title,
        startAt,
        endAt,
        status: formData.status,
        notes: formData.notes || undefined,
      });

      // Track analytics
      base44.analytics.track({
        eventName: 'calendar_event_created',
        properties: {
          event_type: formData.type,
          has_job: !!selectedJob?.id,
          job_id: selectedJob?.id || null,
        },
      }).catch(() => {}); // Fire and forget

      toast.success('Event created');
      queryClient.invalidateQueries({ queryKey: ['calendarEvents', companyId] });
      onClose();
      onSuccess?.();
    } catch (error) {
      toast.error(error.message || 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const canScheduleInstall = selectedJob && jobSoldStatus === true;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Schedule Event
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Job Selector */}
          <div>
            <Label htmlFor="job-search">Select Job *</Label>
            {!selectedJob ? (
              <div className="mt-2 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="job-search"
                    placeholder="Search by customer name or address..."
                    value={jobSearch}
                    onChange={(e) => setJobSearch(e.target.value)}
                    className="pl-10"
                    disabled={isSubmitting}
                  />
                </div>
                {isSearching && (
                  <p className="text-xs text-slate-500 text-center py-2">Searching...</p>
                )}
                {searchResults.length > 0 && (
                  <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => handleSelectJob(job)}
                        disabled={isSubmitting}
                        className="w-full text-left p-3 hover:bg-slate-50 border-b last:border-b-0 transition-colors"
                      >
                        <p className="font-semibold text-sm text-slate-900">{job.customerName}</p>
                        <p className="text-xs text-slate-500">
                          {[job.addressLine1, job.city, job.state].filter(Boolean).join(', ')}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Status: <span className="font-mono">{job.status}</span>
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {jobSearch && !isSearching && searchResults.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-2">No jobs found</p>
                )}
              </div>
            ) : (
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="font-semibold text-sm text-slate-900">{selectedJob.customerName}</p>
                <p className="text-xs text-slate-600">
                  {[selectedJob.addressLine1, selectedJob.city, selectedJob.state]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Phone: {selectedJob.customerPhone || 'N/A'}
                </p>
                <p className="text-xs text-slate-500">Email: {selectedJob.customerEmail || 'N/A'}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearJob}
                  disabled={isSubmitting}
                  className="w-full mt-3"
                >
                  Change Job
                </Button>
              </div>
            )}
          </div>

          {selectedJob && (
            <>
              <div>
                <Label htmlFor="type">Event Type *</Label>
                <Select value={formData.type} onValueChange={handleTypeChange}>
                  <SelectTrigger id="type" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem
                      value="install"
                      disabled={!canScheduleInstall}
                      title={!canScheduleInstall ? 'Available when job is Sold' : ''}
                    >
                      {EVENT_TYPE_LABELS.install}
                      {!canScheduleInstall && ' (Requires Sold Job)'}
                    </SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  required
                  className="mt-2"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <Label htmlFor="startAt">Start Date/Time *</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  value={formData.startAt}
                  onChange={(e) => handleChange('startAt', e.target.value)}
                  required
                  className="mt-2"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <Label htmlFor="endAt">End Date/Time *</Label>
                <Input
                  id="endAt"
                  type="datetime-local"
                  value={formData.endAt}
                  onChange={(e) => handleChange('endAt', e.target.value)}
                  required
                  className="mt-2"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                  <SelectTrigger id="status" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Add notes..."
                  className="mt-2"
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

          {selectedJob && (
            <div className="flex gap-2 pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.title}
                className="flex-1 bg-[#006FBA] hover:bg-[#005EA5]"
              >
                {isSubmitting ? 'Creating...' : 'Create'}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}