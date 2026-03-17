import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Edit2, Mail, Phone, MapPin, Tag, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const COMMON_TAGS = ['dog-owner', 'pool', 'privacy-fence', 'high-end', 'referral-source', 'hoa', 'repeat-customer'];

export default function CustomerProfileCard({ profile, onUpdated }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...profile });
  const [tagInput, setTagInput] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.CustomerProfile.update(profile.id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['customerProfile'] });
      onUpdated?.(updated);
      setEditing(false);
      toast.success('Profile updated');
    }
  });

  const addTag = (tag) => {
    const t = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || form.tags?.includes(t)) return;
    setForm(f => ({ ...f, tags: [...(f.tags || []), t] }));
    setTagInput('');
  };

  const removeTag = (tag) => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));

  if (!editing) {
    return (
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              {profile.preferredName || profile.firstName || '—'} {profile.lastName || ''}
            </h3>
            {profile.preferredName && profile.firstName && (
              <p className="text-slate-400 text-sm">{profile.firstName} {profile.lastName}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-100" onClick={() => { setForm({ ...profile }); setEditing(true); }}>
            <Edit2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2 text-sm text-slate-300">
          {profile.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-500" />{profile.email}</div>}
          {profile.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-500" />{profile.phone}</div>}
          {profile.addressLine1 && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-500" />
              {profile.addressLine1}, {profile.addressCity}, {profile.addressState} {profile.addressZip}
            </div>
          )}
        </div>

        {profile.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {profile.tags.map(tag => (
              <Badge key={tag} className="bg-[#006FBA]/20 text-[#52AE22] border border-[#52AE22]/30 text-xs">
                <Tag className="w-2.5 h-2.5 mr-1" />{tag}
              </Badge>
            ))}
          </div>
        )}

        {profile.notes && (
          <p className="mt-3 text-sm text-slate-400 italic border-t border-slate-700 pt-3">{profile.notes}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 border border-[#006FBA]/40 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-slate-300 text-xs">First Name</Label><Input value={form.firstName || ''} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="mt-1 bg-slate-900 border-slate-600 text-slate-100" /></div>
        <div><Label className="text-slate-300 text-xs">Last Name</Label><Input value={form.lastName || ''} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className="mt-1 bg-slate-900 border-slate-600 text-slate-100" /></div>
        <div><Label className="text-slate-300 text-xs">Preferred Name</Label><Input value={form.preferredName || ''} onChange={e => setForm(f => ({ ...f, preferredName: e.target.value }))} className="mt-1 bg-slate-900 border-slate-600 text-slate-100" /></div>
        <div><Label className="text-slate-300 text-xs">Phone</Label><Input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1 bg-slate-900 border-slate-600 text-slate-100" /></div>
        <div className="col-span-2"><Label className="text-slate-300 text-xs">Email</Label><Input value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1 bg-slate-900 border-slate-600 text-slate-100" /></div>
      </div>

      <div>
        <Label className="text-slate-300 text-xs">Tags</Label>
        <div className="flex gap-2 mt-1">
          <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag(tagInput)} placeholder="Add tag..." className="bg-slate-900 border-slate-600 text-slate-100" />
          <Button size="sm" onClick={() => addTag(tagInput)} className="bg-[#006FBA] hover:bg-[#005EA5]">Add</Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {COMMON_TAGS.map(t => (
            <button key={t} onClick={() => addTag(t)} className={`text-xs px-2 py-0.5 rounded border transition-colors ${form.tags?.includes(t) ? 'bg-[#52AE22]/20 border-[#52AE22]/50 text-[#52AE22]' : 'border-slate-600 text-slate-400 hover:border-slate-400'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {form.tags?.map(tag => (
            <Badge key={tag} className="bg-[#006FBA]/20 text-[#52AE22] border border-[#52AE22]/30 text-xs gap-1">
              {tag}<button onClick={() => removeTag(tag)}><X className="w-2.5 h-2.5" /></button>
            </Badge>
          ))}
        </div>
      </div>

      <div><Label className="text-slate-300 text-xs">Notes</Label><Textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 bg-slate-900 border-slate-600 text-slate-100 min-h-[80px]" /></div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending} className="bg-[#006FBA] hover:bg-[#005EA5]">
          <Check className="w-4 h-4 mr-1" />Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="text-slate-400">
          <X className="w-4 h-4 mr-1" />Cancel
        </Button>
      </div>
    </div>
  );
}