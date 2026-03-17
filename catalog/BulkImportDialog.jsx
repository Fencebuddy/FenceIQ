import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";

// Validation enums
const VALID_MATERIAL_TYPES = ['vinyl', 'chain_link', 'aluminum', 'wood', 'steel', 'general'];
const VALID_CATEGORIES = ['post', 'rail', 'fabric', 'panel', 'gate', 'hardware', 'concrete', 'misc', 'fee'];
const VALID_FINISHES = ['galvanized', 'black_vinyl', 'aluminum', 'white', 'tan', 'grey', 'khaki', 'cedar', 'black'];
const VALID_UNITS = ['each', 'lf', 'roll', 'bag', 'kit', 'pcs'];

export default function BulkImportDialog({ open, onOpenChange, onSubmit, isLoading }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parseError, setParseError] = useState('');
  const [rowErrors, setRowErrors] = useState([]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError('');
    setRowErrors([]);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        const { items, errors } = parseFile(selectedFile.type, content);
        
        if (items.length === 0 && errors.length === 0) {
          setParseError('No valid items found in file');
          return;
        }

        setPreview(items);
        setRowErrors(errors);
      } catch (err) {
        setParseError(err.message);
      }
    };

    reader.readAsText(selectedFile);
  };

  const parseFile = (fileType, content) => {
    const errors = [];
    let items = [];

    if (fileType === 'application/json' || fileType.includes('json')) {
      items = JSON.parse(content);
    } else {
      // Parse CSV
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const item = {};

        headers.forEach((header, idx) => {
          item[header] = values[idx] || '';
        });

        items.push({ ...item, _row: i + 1 });
      }
    }

    // Validate all items
    const validatedItems = [];
    const seenKeys = new Set();

    items.forEach((item) => {
      const rowNum = item._row || items.indexOf(item) + 1;
      const rowErrors = [];

      // Required fields
      if (!item.crm_name?.trim()) {
        rowErrors.push('crm_name is required');
      }

      // Enum validations
      if (!VALID_MATERIAL_TYPES.includes(item.material_type?.toLowerCase())) {
        rowErrors.push(`material_type must be one of: ${VALID_MATERIAL_TYPES.join(', ')}`);
      }

      if (!VALID_CATEGORIES.includes(item.category?.toLowerCase())) {
        rowErrors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
      }

      if (!item.finish?.trim() || !VALID_FINISHES.includes(item.finish?.toLowerCase())) {
        rowErrors.push(`finish is required and must be one of: ${VALID_FINISHES.join(', ')}`);
      }

      if (!VALID_UNITS.includes(item.unit?.toLowerCase())) {
        rowErrors.push(`unit must be one of: ${VALID_UNITS.join(', ')}`);
      }

      // Cost validation: allow blank to default to 0
      const cost = item.cost?.trim() === '' ? 0 : parseFloat(item.cost);
      if (isNaN(cost)) {
        rowErrors.push('cost must be a valid number or blank (defaults to 0)');
      }

      if (rowErrors.length > 0) {
        errors.push({ row: rowNum, errors: rowErrors });
      } else {
        // Trim whitespace, lowercase enums, parseFloat cost
        validatedItems.push({
          crm_name: item.crm_name.trim(),
          material_type: item.material_type.toLowerCase().trim(),
          category: item.category.toLowerCase().trim(),
          finish: item.finish.toLowerCase().trim(),
          cost: cost,
          unit: item.unit.toLowerCase().trim()
        });
      }
    });

    return { items: validatedItems, errors };
  };

  const handleSubmit = () => {
    if (!preview || preview.length === 0) {
      setParseError('No items to import');
      return;
    }

    onSubmit(preview);
    resetForm();
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setParseError('');
    setRowErrors([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Materials</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!preview ? (
            <div>
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-emerald-400 transition-colors cursor-pointer"
                   onClick={() => document.getElementById('fileInput').click()}>
                <Upload className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                <p className="font-medium text-slate-700">Click to upload or drag and drop</p>
                <p className="text-sm text-slate-500 mt-1">CSV or JSON files</p>
                <input
                  id="fileInput"
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium text-slate-700 mb-2">CSV Format (required columns):</p>
                <pre className="text-xs text-slate-600 overflow-x-auto">crm_name,material_type,category,cost,unit,finish
              4' Chain Link Fabric (Galvanized),chain_link,fabric,35.50,roll,galvanized
              GALV Top Rail 1-3/8in,chain_link,rail,0.50,lf,galvanized</pre>
                <p className="text-xs text-slate-500 mt-2">
                  • All string fields trimmed of whitespace<br/>
                  • material_type, category, unit, finish automatically lowercased<br/>
                  • Cost: blank or numeric (blanks default to 0)
                </p>
              </div>

              {parseError && (
                 <Alert variant="destructive" className="mt-4">
                   <AlertCircle className="w-4 h-4" />
                   <AlertDescription>{parseError}</AlertDescription>
                 </Alert>
               )}

               {rowErrors.length > 0 && (
                 <Alert variant="destructive" className="mt-4">
                   <AlertTriangle className="w-4 h-4" />
                   <AlertDescription>
                     <div className="font-medium mb-2">{rowErrors.length} row(s) have validation errors:</div>
                     <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                       {rowErrors.map((err, idx) => (
                         <div key={idx} className="font-mono text-xs">
                           Row {err.row}: {err.errors.join('; ')}
                         </div>
                       ))}
                     </div>
                   </AlertDescription>
                 </Alert>
               )}
            </div>
          ) : (
            <div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium text-emerald-900">{preview.length} items ready to import</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreview(null)}
                  className="mt-2"
                >
                  Choose Different File
                </Button>
              </div>

              <div className="max-h-80 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                   <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-2">Name</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-left py-2 px-2">Category</th>
                        <th className="text-left py-2 px-2">Finish</th>
                        <th className="text-left py-2 px-2">Unit</th>
                        <th className="text-right py-2 px-2">Cost</th>
                      </tr>
                    </thead>
                   <tbody>
                     {preview.map((item, idx) => (
                       <tr key={idx} className="border-t hover:bg-slate-50">
                         <td className="py-2 px-2">{item.crm_name}</td>
                         <td className="py-2 px-2 text-xs text-slate-600">{item.material_type}</td>
                         <td className="py-2 px-2 text-xs text-slate-600">{item.category}</td>
                         <td className="py-2 px-2 text-xs text-slate-600">{item.finish}</td>
                         <td className="py-2 px-2 text-xs text-slate-600">{item.unit}</td>
                         <td className="py-2 px-2 text-right font-medium">${item.cost.toFixed(2)}</td>
                       </tr>
                     ))}
                   </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
          >
            Cancel
          </Button>
          {preview && (
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Import {preview.length} Items
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}