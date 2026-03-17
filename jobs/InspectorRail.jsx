import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  MapPin, Phone, Mail, User, Package, Ruler, Pencil, Trash2,
  RefreshCw, Plus, Camera, Upload, X, Loader2, ChevronDown, ChevronUp, AlertTriangle
} from "lucide-react";
import MapMaterialsList from '@/components/materials/MapMaterialsList';
import ValidationPanel from '@/components/validation/ValidationPanel';
import PurchaseOrderPanel from '@/components/office/PurchaseOrderPanel';

const STATUSES = ['Draft', 'Inspection Complete', 'Sent to Office', 'Materials Ordered', 'Installed', 'Closed'];

export default function InspectorRail({
  job,
  runs,
  gates,
  materials,
  mapMaterials,
  totalLF,
  materialCombinations,
  hasMixedSpecs,
  hasMixedStyles,
  displayStyle,
  validation,
  showValidation,
  setShowValidation,
  uploadingPhoto,
  jobId,
  fenceLines,
  queryClient,
  updateStatusMutation,
  updateJobMutation,
  handlePhotoUpload,
  handleDeletePhoto,
  setShowRunForm,
  setShowGateForm,
  setShowMaterialForm,
  setEditingRun,
  setEditingGate,
  setEditingMaterial,
  setDeleteRun,
  setDeleteGate,
  setDeleteMaterial,
  calculateMaterialsFromRuns,
  isCalculating,
  setActiveTab
}) {
  const [photosOpen, setPhotosOpen] = useState(false);

  return (
    <Card className="h-full flex flex-col bg-white">
      <Tabs defaultValue="details" className="h-full flex flex-col">
        <CardHeader className="border-b bg-slate-50 py-3 flex-shrink-0">
          <TabsList className="grid w-full grid-cols-3 bg-slate-100">
            <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
            <TabsTrigger value="runs" className="text-xs">Runs & Gates</TabsTrigger>
            <TabsTrigger value="materials" className="text-xs">Materials</TabsTrigger>
          </TabsList>
        </CardHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Details Tab */}
          <TabsContent value="details" className="mt-0 p-4 space-y-4">
            {/* Customer Info */}
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-900 truncate">{job.addressLine1}</p>
                  <p className="text-sm text-slate-600">{job.city}, {job.state} {job.zip}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <a href={`tel:${job.customerPhone}`} className="text-sm text-blue-600 truncate">{job.customerPhone}</a>
              </div>
              {job.customerEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <a href={`mailto:${job.customerEmail}`} className="text-sm text-blue-600 truncate">{job.customerEmail}</a>
                </div>
              )}
              {job.repName && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-600 truncate">Rep: {job.repName}</span>
                </div>
              )}
            </div>

            {/* Status Selector */}
            <div className="pt-3 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Status:</span>
                <Select value={job.status} onValueChange={(v) => updateStatusMutation.mutate(v)}>
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {job.jobNotes && (
              <div className="pt-3 border-t">
                <p className="text-xs text-slate-500 mb-1">Notes:</p>
                <p className="text-sm text-slate-700">{job.jobNotes}</p>
              </div>
            )}

            {/* Lock Warning */}
            {job.isLocked && (
              <Alert className="border-red-500 bg-red-50">
                <AlertDescription className="text-xs text-red-800">
                  <strong>🔒 Locked:</strong> Office must unlock for edits.
                </AlertDescription>
              </Alert>
            )}

            {/* Office Documents */}
            {(job.crewLoadSheetUrl || job.supplierExportUrl) && (
              <div className="pt-3 border-t space-y-2">
                <p className="text-sm font-semibold text-slate-700">Office Documents</p>
                {job.crewLoadSheetUrl && (
                  <a href={job.crewLoadSheetUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                      📋 Crew Load Sheet
                    </Button>
                  </a>
                )}
                {job.supplierExportUrl && (
                  <a href={job.supplierExportUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                      📦 Supplier Export
                    </Button>
                  </a>
                )}
              </div>
            )}

            {/* Site Photos */}
            <Collapsible open={photosOpen} onOpenChange={setPhotosOpen} className="pt-3 border-t">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-1 rounded">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    <span className="text-sm font-semibold">Site Photos ({job.photos?.length || 0})</span>
                    {photosOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                  <label onClick={(e) => e.stopPropagation()} className="cursor-pointer">
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} className="hidden" />
                    <Button type="button" disabled={uploadingPhoto} size="sm" variant="outline" className="h-7 text-xs" asChild>
                      <span>
                        {uploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      </span>
                    </Button>
                  </label>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                {!job.photos || job.photos.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    <Camera className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs">No photos yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {job.photos.map((photo, idx) => (
                      <div key={idx} className="relative group">
                        <img src={photo} alt={`Site ${idx + 1}`} className="w-full h-24 object-cover rounded border" />
                        <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleDeletePhoto(photo)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          {/* Runs & Gates Tab */}
          <TabsContent value="runs" className="mt-0 p-4 space-y-3">
            <div className="flex gap-2">
              <Button onClick={() => setShowRunForm(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs flex-1">
                <Plus className="w-3 h-3 mr-1" /> Run
              </Button>
              <Button onClick={() => setShowGateForm(true)} size="sm" variant="outline" className="h-7 text-xs flex-1">
                <Plus className="w-3 h-3 mr-1" /> Gate
              </Button>
            </div>

            <div className="flex items-center justify-between py-2 border-b">
              <p className="text-xs text-slate-500">{runs.length} runs • {gates.length} gates • {totalLF} LF</p>
              <Button size="icon" variant="ghost" onClick={() => {
                queryClient.invalidateQueries(['runs', jobId]);
                queryClient.invalidateQueries(['gates', jobId]);
              }} className="h-6 w-6">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>

            {runs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Ruler className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs">No runs added yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                {runs.map(run => {
                  const runGates = gates.filter(g => g.runId === run.id);
                  return (
                    <div key={run.id} data-run-id={run.id} className="border rounded-lg p-2 bg-white">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <h3 className="font-semibold text-xs text-slate-900 truncate">{run.runLabel}</h3>
                            <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0">{run.lengthLF} LF</Badge>
                            {run.verify_needed && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]">
                                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Verify
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-600 space-y-0">
                            <p className="truncate">{run.materialType} • {run.fenceHeight} • {run.style}</p>
                            {run.slope && run.slope !== 'None' && <p>Slope: {run.slope}</p>}
                            {run.runNotes && <p className="text-slate-500 italic truncate">{run.runNotes}</p>}
                          </div>
                        </div>
                        <div className="flex gap-0.5 flex-shrink-0">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingRun(run); setShowRunForm(true); }}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-red-600 hover:text-red-700 h-6 w-6" onClick={() => setDeleteRun(run)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {runGates.length > 0 && (
                        <div className="mt-2 pt-2 border-t space-y-1">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase">Gates:</p>
                          {runGates.map(gate => (
                            <div key={gate.id} className="flex items-center justify-between bg-slate-50 rounded p-1">
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="font-medium">{gate.gateType}</span>
                                <span className="text-slate-600">{gate.gateWidth}</span>
                                <span className="text-slate-500">• {gate.placement}</span>
                              </div>
                              <div className="flex gap-0.5">
                                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setEditingGate(gate); setShowGateForm(true); }}>
                                  <Pencil className="w-2.5 h-2.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-5 w-5 text-red-600 hover:text-red-700" onClick={() => setDeleteGate(gate)}>
                                  <Trash2 className="w-2.5 h-2.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Materials Tab */}
          <TabsContent value="materials" className="mt-0 p-4 space-y-4">
            <MapMaterialsList 
              mapMaterials={mapMaterials}
              materials={materials}
              jobId={jobId}
              job={job}
              fenceLines={fenceLines}
              gates={gates}
              onRefresh={() => {}}
              onAddMaterial={() => setShowMaterialForm(true)}
              onEditMaterial={(mat) => { setEditingMaterial(mat); setShowMaterialForm(true); }}
              onDeleteMaterial={(mat) => setDeleteMaterial(mat)}
              onCalculate={calculateMaterialsFromRuns}
              isCalculating={isCalculating}
              isOpen={true}
              setIsOpen={() => {}}
            />

            {validation && showValidation && (
              <ValidationPanel validation={validation} />
            )}

            {job.status !== 'Draft' && (
              <PurchaseOrderPanel job={job} />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
}