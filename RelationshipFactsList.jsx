import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Brain } from 'lucide-react';
import toast from 'react-hot-toast';

const FACT_TYPES = ['DOG_NAME','DOG_BREED','KID_NAME','BIRTHDAY','ANNIVERSARY','MOVE_IN_DATE','FENCE_INSTALL_DATE','FENCE_WARRANTY_END','FAVORITE_TEAM','FAVORITE_RESTAURANT','COMMUNICATION_PREFERENCE','OTHER'];
const DATE_FACTS = ['BIRTHDAY','ANNIVERSARY','MOVE_IN_DATE','FENCE_INSTALL_DATE','FENCE_WARRANTY_END'];
const CONFIDENCE_COLORS = { low: 'bg-yellow-500/20 text-yellow-400', med: 'bg-blue-500/20 text-blue-400', high: 'bg-green-500/20 text-green-400' };

const EMPTY_FORM = { factType: 'DOG_NAME', value: '', dateValue: '', confidence: 'med', source: 'rep' };

export default function RelationshipFactsList({ facts = [], companyId, customerProfileId, queryKey }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null); // null | 'create' | fact object
  const [form, setForm] = useState(EMPTY_FORM);

  const isDate = DATE_FACTS.includes(form.factType);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RelationshipFacts.create({ companyId, customerProfileId, ...data }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setDialog(null); toast.success('Fact added'); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RelationshipFacts.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setDialog(null); toast.success('Fact updated'); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RelationshipFacts.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Fact removed'); }
  });

  const openCreate = () => { setForm(EMPTY_FORM); setDialog('create'); };
  const openEdit = (fact) => { setForm({ factType: fact.factType, value: fact.value || '', dateValue: fact.dateValue || '', confidence: fact.confidence || 'med', source: fact.source || 'rep' }); setDialog(fact); };

  const handleSave = () => {
    if (dialog === 'create') {
      createMutation.mutate(form);
    } else {
      updateMutation.mutate({ id: dialog.id, data: form });
    }
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#006FBA]" />
          <h4 className="font-semibold text-slate-100">Relationship Intel</h4>
          <Badge className="bg-slate-700 text-slate-300 text-xs">{facts.length}</Badge>
        </div>
        <Button size="sm" onClick={openCreate} className="bg-[#006FBA] hover:bg-[#005EA5] h-8">
          <Plus className="w-3.5 h-3.5 mr-1" />Add Fact
        </Button>
      </div>

      {facts.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">No facts yet — add dog names, birthdays, favorite teams, and more.</p>
      ) : (
        <div className="space-y-2">
          {facts.map(fact => (
            <div key={fact.id} className="flex items-center justify-between bg-slate-900/60 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-xs font-mono text-slate-400 shrink-0">{fact.factType.replace(/_/g, ' ')}</span>
                <span className="text-slate-100 font-medium truncate">{fact.value || fact.dateValue || '—'}</span>
                <Badge className={`text-xs shrink-0 ${CONFIDENCE_COLORS[fact.confidence] || CONFIDENCE_COLORS.med}`}>{fact.confidence}</Badge>
                <span className="text-xs text-slate-500 shrink-0">{fact.source}</span>
              </div>
              <div className="flex gap-1 ml-2">
                <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-slate-100" onClick={() => openEdit(fact)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400 hover:text-red-300" onClick={() => deleteMutation.mutate(fact.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader><DialogTitle className="text-slate-100">{dialog === 'create' ? 'Add Fact' : 'Edit Fact'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-slate-300 text-xs">Fact Type</Label>
              <Select value={form.factType} onValueChange={v => setForm(f => ({ ...f, factType: v }))}>
                <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {FACT_TYPES.map(t => <SelectItem key={t} value={t} className="text-slate-100 focus:bg-slate-700">{t.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isDate ? (
              <div><Label className="text-slate-300 text-xs">Date</Label><Input type="date" value={form.dateValue} onChange={e => setForm(f => ({ ...f, dateValue: e.target.value }))} className="mt-1 bg-slate-800 border-slate-600 text-slate-100" /></div>
            ) : (
              <div><Label className="text-slate-300 text-xs">Value</Label><Input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="e.g. Buddy, Green Bay Packers..." className="mt-1 bg-slate-800 border-slate-600 text-slate-100" /></div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-xs">Confidence</Label>
                <Select value={form.confidence} onValueChange={v => setForm(f => ({ ...f, confidence: v }))}>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {['low','med','high'].map(c => <SelectItem key={c} value={c} className="text-slate-100 focus:bg-slate-700">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Source</Label>
                <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {['rep','callcenter','survey','import','inferred'].map(s => <SelectItem key={s} value={s} className="text-slate-100 focus:bg-slate-700">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button onClick={handleSave} className="bg-[#006FBA] hover:bg-[#005EA5]">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}