'use client';

/**
 * ExportButtons - CSV and PDF export buttons
 */

import { Download, FileText } from 'lucide-react';

interface ExportButtonsProps {
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  isExporting?: boolean;
}

export function ExportButtons({
  onExportCSV,
  onExportPDF,
  isExporting = false,
}: ExportButtonsProps) {
  return (
    <div className="vp-export-grid">
      <button
        type="button"
        className="vp-button vp-button--secondary"
        onClick={onExportCSV}
        disabled={isExporting}
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        Export CSV
      </button>
      <button
        type="button"
        className="vp-button vp-button--secondary"
        onClick={onExportPDF}
        disabled={isExporting}
      >
        <FileText className="w-4 h-4" aria-hidden="true" />
        Export PDF
      </button>
    </div>
  );
}
