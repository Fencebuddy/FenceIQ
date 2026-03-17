import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

const SIGNAL_TYPES = [
  { value: 'SOLD_JOB', label: '✅ Sold Job', weight: +10 },
  { value: 'REFERRAL', label: '🤝 Referral', weight: +6 },
  { value: 'APPT_SET', label: '📅 Appt Set', weight: +4 },
  { value: 'REVIEW', label: '⭐ Review', weight: +3 },
  { value: 'LEAD_CREATED', label: '💡 Lead Created', weight: +2 },
  { value: 'DOOR_KNOCK', label: '🚪 Door Knock', weight: +1 },
  { value: 'DIRECT_MAIL_DROP', label: '📬 Direct Mail Drop', weight: +1 },
  { value: 'NO_SHOW', label: '🚫 No Show', weight: 0 },
  { value: 'LOST_JOB', label: '❌ Lost Job', weight: -3 },
  { value: 'CANCELED', label: '⛔ Canceled', weight: -2 },
];

export default function AddSignalDialog({ open, onClose, zones, companyId, defaultZoneId }) {
  const queryClient = useQueryClient();

  const [zoneId, setZoneId] = useState(defaultZoneId || '');
  const [signalType, setSignalType] = useState('');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState('1');

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.ZoneSignal.create({
      companyId,
      zoneId,
      signalType,
      occurredAt,
      value: parseFloat(value) || 1
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoneSignals'] });
      toast.success('Signal recorded');
      onClose();
    },
    onError: (e) => toast.error(e.message)
  });

  const selectedType = SIGNAL_TYPES.find(t => t.value === signalType);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Zone Signal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Zone *</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select zone..." /></SelectTrigger>
              <SelectContent>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Signal Type *</Label>
            <Select value={signalType} onValueChange={setSignalType}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select signal..." /></SelectTrigger>
              <SelectContent>
                {SIGNAL_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} ({t.weight > 0 ? '+' : ''}{t.weight})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Value (multiplier)</Label>
              <Input type="number" min="0.1" step="0.1" value={value} onChange={e => setValue(e.target.value)} className="mt-1" />
            </div>
          </div>
          {selectedType && (
            <div className="text-sm text-slate-500 bg-slate-50 rounded p-2">
              Score impact: <span className={selectedType.weight > 0 ? 'text-green-600 font-semibold' : selectedType.weight < 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                {selectedType.weight > 0 ? '+' : ''}{(selectedType.weight * (parseFloat(value) || 1)).toFixed(1)} pts
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!zoneId || !signalType || saveMutation.isPending}
            className="bg-[#006FBA] hover:bg-[#005EA5]"
          >
            Record Signal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}