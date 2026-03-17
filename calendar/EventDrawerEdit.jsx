import React, { useState, useEffect } from 'react';
import { X, MapPin, Clock, ExternalLink, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPageUrl } from '@/utils';
import { updateCalendarEvent, deleteCalendarEvent } from '@/components/services/calendarEventService';
import { getJobById, isJobSold } from '@/components/services/jobLookupService';
import CreateEventModal from './CreateEventModal';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function EventDrawer({ event, onClose, writeEnabled, companyId, jobData }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkedJob, setLinkedJob] = useState(null);
  const [jobSoldStatus, setJobSoldStatus] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState(null);

  const [editData, setEditData] = useState({
    title: event?.title || '',
    type: event?.type || 'appointment',
    startAt: event?.startAt ? new Date(event.startAt).toISOString().slice(0, 16) : '',
    endAt: event?.endAt ? new Date(event.endAt).toISOString().slice(0, 16) : '',
    status: event?.status || 'scheduled',
    notes: event?.notes || '',
  });

  // Load linked job data on mount
  useEffect(() => {
    if (event?.jobId) {
      getJobById(event.jobId)
        .then((job) => {
          setLinkedJob(job);
        })
        .catch((err) => console.warn('Failed to load job:', err));
    }
  }, [event?.jobId]);

  // Check sold status synchronously
  useEffect(() => {
    if (linkedJob) {
      const { isJobSoldSync } = require('@/components/services/jobLookupService');
      setJobSoldStatus(isJobSoldSync(linkedJob));
    }
  }, [linkedJob]);

  if (!event) return null;

  const isCalendarEventSource = event.source === 'calendarEvent';
  const isLegacy = event.source === 'legacy' || !isCalendarEventSource;
  const canEdit = writeEnabled && isCalendarEventSource;

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

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const startAt = new Date(editData.startAt).toISOString();
      const endAt = new Date(editData.endAt).toISOString();

      if (new Date(endAt) <= new Date(startAt)) {
        toast.error('End time must be after start time');
        setIsSubmitting(false);
        return;
      }

      await updateCalendarEvent(event.id, {
        title: editData.title,
        type: editData.type,
        startAt,
        endAt,
        status: editData.status,
        notes: editData.notes || undefined,
      });

      // Track analytics
      base44.analytics.track({
        eventName: 'calendar_event_updated',
        properties: {
          event_type: editData.type,
          event_id: event.id,
        },
      }).catch(() => {}); // Fire and forget

      toast.success('Event updated');
      queryClient.invalidateQueries({ queryKey: ['calendarEvents', companyId] });
      setIsEditing(false);
    } catch (error) {
      toast.error(error.message || 'Failed to update event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this event?')) return;
    setIsSubmitting(true);

    try {
      await deleteCalendarEvent(event.id);

      // Track analytics
      base44.analytics.track({
        eventName: 'calendar_event_deleted',
        properties: {
          event_type: event.type,
          event_id: event.id,
        },
      }).catch(() => {}); // Fire and forget

      toast.success('Event deleted');
      queryClient.invalidateQueries({ queryKey: ['calendarEvents', companyId] });
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to delete event');
    } finally {
      setIsSubmitting(false);
    }
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
          {isEditing ? (
            <Input
              value={editData.title}
              onChange={(e) => setEditData((prev) => ({ ...prev, title: e.target.value }))}
              className="flex-1 font-semibold text-lg"
              disabled={isSubmitting}
            />
          ) : (
            <h2 className="text-lg font-semibold text-slate-900">{event.title}</h2>
          )}
          <button
            onClick={onClose}
            disabled={isEditing || isSubmitting}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Legacy Event Warning */}
          {isLegacy && (
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-600">
                This event is read-only. Only calendar events can be edited here.
              </p>
            </div>
          )}

          {/* Event Details */}
          <div className="space-y-4">
            {isEditing ? (
              <>
                <div>
                  <Label className="text-xs font-semibold text-slate-500 uppercase">Type</Label>
                  <Select
                    value={editData.type}
                    onValueChange={(value) => setEditData((prev) => ({ ...prev, type: value }))}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="appointment">Appointment</SelectItem>
                      <SelectItem value="install">Install</SelectItem>
                      <SelectItem value="followup">Follow-up</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-start" className="text-xs font-semibold text-slate-500 uppercase">Start</Label>
                  <Input
                    id="edit-start"
                    type="datetime-local"
                    value={editData.startAt}
                    onChange={(e) => setEditData((prev) => ({ ...prev, startAt: e.target.value }))}
                    disabled={isSubmitting}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-end" className="text-xs font-semibold text-slate-500 uppercase">End</Label>
                  <Input
                    id="edit-end"
                    type="datetime-local"
                    value={editData.endAt}
                    onChange={(e) => setEditData((prev) => ({ ...prev, endAt: e.target.value }))}
                    disabled={isSubmitting}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-500 uppercase">Status</Label>
                  <Select
                    value={editData.status}
                    onValueChange={(value) => setEditData((prev) => ({ ...prev, status: value }))}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="mt-2">
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
                  <Label htmlFor="edit-notes" className="text-xs font-semibold text-slate-500 uppercase">Notes</Label>
                  <Input
                    id="edit-notes"
                    value={editData.notes}
                    onChange={(e) => setEditData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add notes..."
                    disabled={isSubmitting}
                    className="mt-2"
                  />
                </div>
              </>
            ) : (
              <>
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

                {event.notes && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Notes</p>
                    <p className="text-sm text-slate-900">{event.notes}</p>
                  </div>
                )}

                {event.meta?.jobNumber && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Job Number</p>
                    <p className="text-sm text-slate-900 font-mono">{event.meta.jobNumber}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Job Info + Copy Actions */}
          {linkedJob && !isEditing && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-xs font-semibold text-slate-500 uppercase">Customer</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{linkedJob.customerName}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {[linkedJob.addressLine1, linkedJob.city, linkedJob.state]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {linkedJob.customerPhone && (
                  <p className="text-xs text-slate-600 mt-2">📞 {linkedJob.customerPhone}</p>
                )}
                {linkedJob.customerEmail && (
                  <p className="text-xs text-slate-600">✉️ {linkedJob.customerEmail}</p>
                )}

                {/* Copy Buttons */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {linkedJob.address_full && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(linkedJob.address_full);
                        toast.success('Address copied');
                      }}
                      className="text-xs h-7"
                    >
                      Copy Address
                    </Button>
                  )}
                  {linkedJob.customerPhone && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(linkedJob.customerPhone);
                        toast.success('Phone copied');
                      }}
                      className="text-xs h-7"
                    >
                      Copy Phone
                    </Button>
                  )}
                  {linkedJob.customerEmail && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(linkedJob.customerEmail);
                        toast.success('Email copied');
                      }}
                      className="text-xs h-7"
                    >
                      Copy Email
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2"
                  onClick={() => handleNavigate('JobDetail', { jobId: event.jobId })}
                >
                  <ExternalLink className="w-4 h-4" />
                  View Job
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-center gap-2"
                  onClick={() => handleNavigate('PricingIntelligence', { jobId: event.jobId })}
                >
                  <ExternalLink className="w-4 h-4" />
                  Pricing
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-center gap-2"
                  onClick={() => handleNavigate('Proposal', { jobId: event.jobId })}
                >
                  <ExternalLink className="w-4 h-4" />
                  Proposal
                </Button>
              </div>
            </div>
          )}

          {/* No job linked message */}
          {!linkedJob && !isEditing && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
              <p className="text-xs text-slate-600">This event is not linked to a job.</p>
            </div>
          )}

          {/* Quick Schedule Actions */}
          {writeEnabled && linkedJob && !isEditing && (
            <div className="flex flex-col gap-2 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateModalType('appointment');
                  setCreateModalOpen(true);
                }}
                className="w-full justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Schedule Appointment
              </Button>

              {jobSoldStatus && (
                <Button
                  onClick={() => {
                    setCreateModalType('install');
                    setCreateModalOpen(true);
                  }}
                  className="w-full justify-center gap-2 bg-[#52AE22] hover:bg-[#3B8D3E]"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule Production
                </Button>
              )}

              {!jobSoldStatus && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded text-center">
                  Production scheduling available once job is Sold
                </div>
              )}
            </div>
          )}

          {/* Edit/Delete Actions */}
          {canEdit && (
            <div className="flex gap-2 pt-4 border-t border-slate-200">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSubmitting}
                    className="flex-1 bg-[#006FBA] hover:bg-[#005EA5]"
                  >
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Event Modal (Quick Schedule) */}
      {createModalOpen && linkedJob && (
        <CreateEventModal
          isOpen={true}
          onClose={() => {
            setCreateModalOpen(false);
            setCreateModalType(null);
          }}
          companyId={companyId}
          prefilledJob={linkedJob}
          prefilledType={createModalType}
          onSuccess={() => {
            setCreateModalOpen(false);
            setCreateModalType(null);
            queryClient.invalidateQueries({ queryKey: ['calendarEvents', companyId] });
          }}
        />
      )}
    </div>
  );
}