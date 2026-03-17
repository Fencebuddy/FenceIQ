import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Loader2, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CatalogImporter({ isOpen, onClose, onImportComplete }) {
    const [file, setFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
            setError(null);
            setResult(null);
        } else {
            setError("Please select a valid PDF file");
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setIsProcessing(true);
        setError(null);
        setResult(null);

        try {
            // Step 1: Upload file
            const { file_url } = await base44.integrations.Core.UploadFile({ file });

            // Step 2: Extract materials from PDF using LLM
            const extractedData = await base44.integrations.Core.InvokeLLM({
                prompt: `Extract ALL materials from this CRM materials export PDF.

For each material, extract:
- name (exact as shown)
- color (if specified)
- price (numeric value only)
- package_qty (if shown, else 1)
- brand (if shown)
- sku (if shown)
- model (if shown)

Classify each material into:
- category: post, panel, rail, fabric, hardware, gate, concrete, labor, fee, or misc
- sub_category: line_post, corner_post, end_post, gate_post, top_rail, tension_bar, hinge, latch, delivery, etc.
- material_type: vinyl, chain_link, aluminum, wood, composite, steel, or general
- finish: galv, black_vinyl, white, tan, colored, aluminum, or none
- size: extract height/width/length (e.g., "4'", "6'", "2.5in")
- unit: each, pcs, ft, lf, roll, bag, kit, set, stick, bundle, or board

CRITICAL RULES:
1. Labor items → category: "labor", material_type: "general"
2. Delivery/Dump/Subcontractor fees → category: "fee", material_type: "general"
3. Bundled items (contains "+") → split OR mark as bundle
4. Duplicates (same name, different price) → keep ALL variants
5. Extract ALL items from all pages

Return a JSON array of materials.`,
                file_urls: [file_url],
                response_json_schema: {
                    type: "object",
                    properties: {
                        materials: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    color: { type: "string" },
                                    price: { type: "number" },
                                    package_qty: { type: "number" },
                                    brand: { type: "string" },
                                    sku: { type: "string" },
                                    model: { type: "string" },
                                    category: { type: "string" },
                                    sub_category: { type: "string" },
                                    material_type: { type: "string" },
                                    finish: { type: "string" },
                                    size: { type: "string" },
                                    unit: { type: "string" }
                                },
                                required: ["name", "price", "category", "material_type", "unit"]
                            }
                        }
                    }
                }
            });

            if (!extractedData?.materials || extractedData.materials.length === 0) {
                throw new Error("No materials found in PDF");
            }

            // Step 3: Insert into MaterialCatalog entity
            const catalogRecords = extractedData.materials.map(mat => ({
                material_id: generateMaterialId(mat.name),
                crm_name: mat.name,
                category: mat.category || 'misc',
                sub_category: mat.sub_category || '',
                material_type: mat.material_type || 'general',
                finish: mat.finish || 'none',
                size: mat.size || '',
                unit: mat.unit || 'each',
                cost: mat.price || 0,
                package_qty: mat.package_qty || 1,
                brand: mat.brand || '',
                sku: mat.sku || '',
                model: mat.model || '',
                fencebuddy_mapping: '', // To be mapped manually
                source: 'crm',
                active: true,
                last_updated: new Date().toISOString()
            }));

            await base44.entities.MaterialCatalog.bulkCreate(catalogRecords);

            setResult({
                success: true,
                count: catalogRecords.length,
                materials: catalogRecords
            });

            if (onImportComplete) {
                onImportComplete(catalogRecords);
            }

        } catch (err) {
            console.error('Catalog import error:', err);
            setError(err.message || "Failed to import catalog. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setError(null);
        setResult(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Import CRM Material Catalog
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                            Upload your CRM materials export PDF. The system will extract all materials, normalize them, and create your cost catalog.
                        </AlertDescription>
                    </Alert>

                    {!result && (
                        <>
                            <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="catalog-upload"
                                    disabled={isProcessing}
                                />
                                <label
                                    htmlFor="catalog-upload"
                                    className="cursor-pointer flex flex-col items-center gap-2"
                                >
                                    <Upload className="w-8 h-8 text-slate-400" />
                                    <div>
                                        <p className="text-sm font-medium">
                                            {file ? file.name : "Click to select PDF"}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Materials Export from CRM
                                        </p>
                                    </div>
                                </label>
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={handleClose}
                                    disabled={isProcessing}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={!file || isProcessing}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 mr-2" />
                                            Import Catalog
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}

                    {result?.success && (
                        <Alert className="bg-emerald-50 border-emerald-200">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            <AlertDescription>
                                <div className="font-semibold text-emerald-900 mb-2">
                                    Successfully imported {result.count} materials!
                                </div>
                                <div className="text-sm text-emerald-700">
                                    Materials have been added to your catalog. You can now map them to FenceBuddy line items in the Catalog Manager.
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {result?.success && (
                        <div className="flex justify-end">
                            <Button onClick={handleClose}>
                                Done
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function generateMaterialId(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}