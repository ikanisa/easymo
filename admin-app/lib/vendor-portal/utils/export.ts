/**
 * Export Utilities
 * Functions for exporting data to various formats
 */

/**
 * Export data to CSV
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
): void {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Determine columns to export
  const exportColumns = columns || 
    Object.keys(data[0]).map(key => ({ key: key as keyof T, label: key }));

  // Create CSV header
  const header = exportColumns.map(col => col.label).join(',');

  // Create CSV rows
  const rows = data.map(item => 
    exportColumns.map(col => {
      const value = item[col.key];
      
      // Handle different value types
      if (value === null || value === undefined) {
        return '';
      }
      
      if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      
      const stringValue = String(value);
      
      // Escape commas and quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    }).join(',')
  );

  // Combine header and rows
  const csv = [header, ...rows].join('\n');

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Export data to JSON
 */
export function exportToJSON<T>(data: T, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.json') ? filename : `${filename}.json`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Format data for PDF export (returns HTML string)
 */
export function formatForPDF<T extends Record<string, unknown>>(
  data: T[],
  title: string,
  columns?: { key: keyof T; label: string }[]
): string {
  if (data.length === 0) {
    return '<p>No data available</p>';
  }

  const exportColumns = columns || 
    Object.keys(data[0]).map(key => ({ key: key as keyof T, label: key }));

  const tableHeaders = exportColumns.map(col => `<th>${col.label}</th>`).join('');
  
  const tableRows = data.map(item => {
    const cells = exportColumns.map(col => {
      const value = item[col.key];
      return `<td>${value !== null && value !== undefined ? String(value) : ''}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <table>
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <p style="margin-top: 20px; color: #666;">Generated on ${new Date().toLocaleString()}</p>
    </body>
    </html>
  `;
}

/**
 * Print data (opens print dialog with formatted table)
 */
export function printData<T extends Record<string, unknown>>(
  data: T[],
  title: string,
  columns?: { key: keyof T; label: string }[]
): void {
  const html = formatForPDF(data, title, columns);
  
  const printWindow = window.open('', '_blank', 'height=600,width=800,noopener,noreferrer');
  if (!printWindow) {
    console.error('Failed to open print window. Please check your popup blocker settings.');
    return;
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  
  // Wait for content to load before printing
  printWindow.onload = () => {
    printWindow.print();
    // Close after print dialog is dismissed
    printWindow.onafterprint = () => {
      printWindow.close();
    };
  };
}
