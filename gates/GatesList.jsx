import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DoorOpen, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function GatesList({ gates, runs, onAdd, onEdit, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const getRunLabel = (runId) => {
    const run = runs.find(r => r.id === runId);
    return run ? run.runLabel : 'Unknown Run';
  };

  const placementColors = {
    'In-line': 'bg-blue-100 text-blue-700',
    'End Of Run': 'bg-purple-100 text-purple-700',
    'At Corner': 'bg-amber-100 text-amber-700'
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="border-b bg-slate-50 cursor-pointer hover:bg-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Gates
                  {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {gates.length} gate{gates.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button onClick={(e) => { e.stopPropagation(); onAdd(); }} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Gate
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
        {gates.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <DoorOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No gates added yet</p>
            <p className="text-sm">Click "Add Gate" to add gates to your runs</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Width</TableHead>
                <TableHead>Placement</TableHead>
                <TableHead>Latch</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gates.map(gate => (
                <TableRow key={gate.id}>
                  <TableCell className="font-medium">{getRunLabel(gate.runId)}</TableCell>
                  <TableCell>{gate.gateType}</TableCell>
                  <TableCell className="font-semibold">{gate.gateWidth}</TableCell>
                  <TableCell>
                    <Badge className={placementColors[gate.placement]}>
                      {gate.placement}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {gate.latchType || <span className="text-slate-400">None</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => onEdit(gate)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => onDelete(gate)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}