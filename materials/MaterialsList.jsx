import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calculator, Package, Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function MaterialsList({ materials, totalLF, onAdd, onEdit, onDelete, runs = [], onCalculate, isCalculating }) {
  const [isOpen, setIsOpen] = useState(false);

  // Group materials by run
  const materialsByRun = runs.map(run => ({
    run,
    materials: materials.filter(mat => mat.runId === run.id)
  })).filter(group => group.materials.length > 0);

  // Materials not assigned to a run
  const unassignedMaterials = materials.filter(mat => !mat.runId);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="border-b bg-slate-50 cursor-pointer hover:bg-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  Calculated Materials
                  {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </CardTitle>
              </div>
              <div className="flex flex-col gap-2 items-end" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col gap-2">
                  {onCalculate && (
                    <Button 
                      onClick={onCalculate}
                      disabled={isCalculating}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      size="sm"
                    >
                      {isCalculating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
                      Calculate
                    </Button>
                  )}
                  <Button 
                    onClick={onAdd}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    + Add
                  </Button>
                </div>
                <p className="text-sm text-slate-500">
                  {materials.length > 0 
                    ? `Materials calculated from manual inputs • ${materials.length} item${materials.length !== 1 ? 's' : ''}`
                    : 'No materials calculated yet'}
                </p>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
        {materials.length === 0 ? (
          <div className="p-8 md:p-3 text-center md:text-left text-slate-500">
            <div className="flex flex-col md:flex-row md:items-center md:gap-2">
              <Package className="w-12 h-12 md:hidden mx-auto mb-3 text-slate-300" />
              <p className="md:text-sm">No materials calculated yet • Click "Calculate Materials" to generate the materials list</p>
            </div>
          </div>
        ) : materialsByRun.length > 0 || unassignedMaterials.length > 0 ? (
          <div className="divide-y">
            {materialsByRun.map(({ run, materials: runMaterials }) => (
              <div key={run.id} className="p-4">
                <h4 className="font-semibold text-sm text-emerald-700 mb-3">
                  {run.runLabel} ({run.lengthLF} LF)
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runMaterials.map(mat => (
                      <TableRow key={mat.id}>
                        <TableCell className="font-medium">{mat.lineItemName}</TableCell>
                        <TableCell className="text-right font-bold text-lg">{mat.quantity}</TableCell>
                        <TableCell className="text-slate-600">{mat.unit}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => onEdit(mat)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => onDelete(mat)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
            
            {unassignedMaterials.length > 0 && (
              <div className="p-4">
                <h4 className="font-semibold text-sm text-slate-700 mb-3">General Materials</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unassignedMaterials.map(mat => {
                      // Check if this is a section header
                      if (mat.lineItemName?.startsWith('__SECTION__')) {
                        const sectionName = mat.lineItemName.replace('__SECTION__', '');
                        return (
                          <TableRow key={mat.id} className="bg-emerald-50 hover:bg-emerald-50">
                            <TableCell colSpan={4} className="font-bold text-emerald-900 py-3">
                              {sectionName}
                            </TableCell>
                          </TableRow>
                        );
                      }
                      
                      return (
                        <TableRow key={mat.id}>
                          <TableCell className="font-medium">{mat.lineItemName}</TableCell>
                          <TableCell className="text-right font-bold text-lg">{mat.quantity}</TableCell>
                          <TableCell className="text-slate-600">{mat.unit}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => onEdit(mat)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => onDelete(mat)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : null}
            </CardContent>
          </CollapsibleContent>
          </Card>
          </Collapsible>
          );
          }