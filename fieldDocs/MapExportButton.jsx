/**
 * Map Export Button - Generates Field Install Map PDF
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateFieldDocs } from './fieldDocEngine';

export default function MapExportButton({ jobId, disabled = false, variant = 'default' }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    if (!jobId) {
      toast.error('No job selected');
      return;
    }

    setIsLoading(true);
    try {
      const result = await generateFieldDocs({
        jobId,
        includePhotos: false,
        output: 'combined', // Map + crew load sheet
      });

      if (!result.ok) {
        toast.error(result.error || 'Failed to generate field documents');
        return;
      }

      // Download PDF
      const link = document.createElement('a');
      link.href = result.pdfBlobUrl;
      link.download = `Field-Map-${result.meta.jobNumber}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(result.pdfBlobUrl);

      toast.success('Field documents exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error exporting field documents');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || isLoading}
      variant={variant}
      size="sm"
      className="gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          Export Map
        </>
      )}
    </Button>
  );
}