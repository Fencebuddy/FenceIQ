import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarClock, CheckCircle2, SkipForward, RotateCcw, Zap } from 'lucide-react';
import { format, isToday, isPast, isFuture } from 'date-fns';
import toast from 'react-hot-toast';

const TYPE_ICONS = {
  THANK_YOU: '🙏', REVIEW_REQUEST: '⭐', REFERRAL_ASK: '🤝', CHECK_IN: '👋',
  MAINTENANCE_TIP: '🔧', WARRANTY_REMINDER: '📋', HOLIDAY: '🎄',
  BIRTHDAY: '🎂', ANNIVERSARY: '🎉', DOG_BDAY: '🐾', OTHER: '📬'
};

const STATUS_STYLES = {
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ready: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  sent: 'bg-green-500/20 text-green-400 border-green-500/30',
  skipped: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30'
};

const CHANNEL_ICONS = { email: '✉️', sms: '💬', call: '📞', direct_mail: '📮' };

export default function TouchpointsList({ touchpoints = [], queryKey }) {
  const queryClient = useQueryClient();
  const [rescheduleDialog, setRescheduleDialog] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [notes, setNotes] = useState('');

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StewardshipTouchpoint.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Updated'); setRescheduleDialog(null); }
  });

  const markSent = (tp) => updateMutation.mutate({ id: tp.id, data: { status: 'sent', sentAt: new Date().toISOString() } });
  const markSkipped = (tp) => updateMutation.mutate({ id: tp.id, data: { status: 'skipped', outcomeNotes: notes } });
  const reschedule = () => {
    if (!newDate) return;
    updateMutation.mutate({ id: rescheduleDialog.id, data: { scheduledAt: new Date(newDate).toISOString(), status: 'scheduled' } });
  };

  const upcoming = touchpoints
    .filter(tp => tp.status !== 'sent' && tp.status !== 'skipped' && tp.status !== 'failed')
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  const past = touchpoints
    .filter(tp => ['sent', 'skipped', 'failed'].includes(tp.status))
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))
    .slice(0, 5);

  const renderRow = (tp, isUpcoming) => {
    const date = tp.scheduledAt ? new Date(tp.scheduledAt) : null;
    const dateLabel = date ? (isToday(date) ? 'Today' : format(date, 'MMM d, yyyy')) : '—';
    const isPastDue = date && isPast(date) && !isToday(date) && isUpcoming;

    return (
      <div key={tp.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg ${isPastDue ? 'bg-red-900/20 border border-red-800/30' : 'bg-slate-900/60'}`}>
        <span className="text-lg w-6 shrink-0">{TYPE_ICONS[tp.type] || '📬'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-100">{tp.type.replace(/_/g, ' ')}</span>
            <span className="text-xs text-slate-400">{CHANNEL_ICONS[tp.channel]} {tp.channel}</span>
          </div>
          <p className={`text-xs mt-0.5 ${isPastDue ? 'text-red-400' : 'text-slate-400'}`}>
            {isPastDue ? '⚠️ Overdue — ' : ''}{dateLabel}
          </p>
        </div>
        <Badge className={`text-xs border shrink-0 ${STATUS_STYLES[tp.status] || STATUS_STYLES.scheduled}`}>
          {tp.status}
        </Badge>
        {isUpcoming && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="w-7 h-7 text-green-400 hover:text-green-300" title="Mark Sent" onClick={() => markSent(tp)}>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-slate-200" title="Reschedule" onClick={() => { setRescheduleDialog(tp); setNewDate(''); }}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-yellow-400 hover:text-yellow-300" title="Skip" onClick={() => markSkipped(tp)}>
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="w-5 h-5 text-[#006FBA]" />
        <h4 className="font-semibold text-slate-100">Touchpoints</h4>
        <Badge className="bg-slate-700 text-slate-300 text-xs">{upcoming.length} upcoming</Badge>
      </div>

      {upcoming.length === 0 && past.length === 0 ? (
        <div className="text-center py-8">
          <Zap className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No touchpoints scheduled. Generate a plan to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.map(tp => renderRow(tp, true))}
          {past.length > 0 && (
            <>
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-700">Recent history</p>
              {past.map(tp => renderRow(tp, false))}
            </>
          )}
        </div>
      )}

      <Dialog open={!!rescheduleDialog} onOpenChange={() => setRescheduleDialog(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader><DialogTitle className="text-slate-100">Reschedule Touchpoint</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-slate-300 text-xs">New Date</Label><Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-slate-100" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialog(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button onClick={reschedule} disabled={!newDate} className="bg-[#006FBA] hover:bg-[#005EA5]">Reschedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}