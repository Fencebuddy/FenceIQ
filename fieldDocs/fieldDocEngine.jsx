/**
 * Field Document Generation Engine
 * Orchestrates creation of Field Install Map + Crew Load Sheet PDFs
 */

import jsPDF from 'jspdf';
import { renderFieldInstallMapPage } from './render/fieldMapSheet';
import { generateCrewLoadSheet } from '../office/CrewLoadSheetGenerator';
import { base44 } from '@/api/base44Client';

export async function generateFieldDocs({
  jobId,
  companyIdOverride = null,
  includePhotos = false,
  output = 'combined',
}) {
  try {
    // Load job
    const job = await base44.entities.Job.get(jobId);
    if (!job) {
      return {
        ok: false,
        error: 'Job not found',
      };
    }

    // Check for map data
    if (!job.mapData || !job.mapData.fenceLines || job.mapData.fenceLines.length === 0) {
      return {
        ok: false,
        error:
          'No yard map geometry found. Open the Yard Map and draw fence lines before exporting Field Install Map.',
      };
    }

    // Load runs and gates for crew load sheet
    let runs = [];
    let gates = [];
    let materials = [];

    if (output === 'combined' || output === 'materialsOnly') {
      // Load runs (we'll query by jobId)
      try {
        runs = await base44.entities.Run.filter({ jobId }) || [];
      } catch (e) {
        console.warn('Could not load runs:', e);
      }

      // Load gates
      try {
        gates = await base44.entities.Gate.filter({ jobId }) || [];
      } catch (e) {
        console.warn('Could not load gates:', e);
      }

      // Load materials
      try {
        materials = await base44.entities.MaterialLine.filter({ jobId }) || [];
      } catch (e) {
        console.warn('Could not load materials:', e);
      }
    }

    // Create combined PDF
    const pdf = new jsPDF('l', 'pt', 'letter'); // Landscape

    // Page 1: Field Install Map
    if (output === 'combined' || output === 'mapOnly') {
      try {
        const mapPdf = await renderFieldInstallMapPage(job, job.mapData.fenceLines || [], gates, runs);
        // Merge map PDF pages
        const mapPageCount = mapPdf.internal.pages.length - 1;
        for (let i = 1; i <= mapPageCount; i++) {
          const pageData = mapPdf.internal.pages[i];
          if (pageData) {
            pdf.addPage();
            pdf.internal.pages.push(pageData);
          }
        }
      } catch (e) {
        console.warn('Could not render field install map:', e);
      }
    }

    // Pages 2+: Crew Load Sheet
    if (output === 'combined' || output === 'materialsOnly') {
      try {
        const crewPdf = await generateCrewLoadSheet(job, runs, gates, materials, job.mapData.fenceLines || []);
        
        // Merge crew load sheet pages
        const crewPageCount = crewPdf.internal.pages.length - 1; // -1 because pages array has null at index 0
        for (let i = 1; i <= crewPageCount; i++) {
          const pageData = crewPdf.internal.pages[i];
          if (pageData) {
            pdf.addPage();
            pdf.internal.pages.push(pageData);
          }
        }
      } catch (e) {
        console.warn('Could not generate crew load sheet:', e);
        // Still return the map
      }
    }

    // Convert to blob and create URL
    const pdfBlob = pdf.output('blob');
    const pdfBlobUrl = URL.createObjectURL(pdfBlob);

    return {
      ok: true,
      pdfBlobUrl,
      meta: {
        jobId,
        jobNumber: job.jobNumber,
        generated: new Date().toISOString(),
        pages: pdf.internal.pages.length - 1,
      },
    };
  } catch (error) {
    console.error('[fieldDocEngine] Error:', error);
    return {
      ok: false,
      error: error.message || 'Unknown error generating field documents',
    };
  }
}