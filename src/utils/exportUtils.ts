import {
  AppDatabaseState,
  formatDateDDMMYYYY,
} from '../domain/ledgerEngine';

export interface ExportDocumentPayload {
  format: 'pdf' | 'csv' | 'json';
  filename: string;
  mimeType: string;
  title: string;
  subtitle?: string;
  summaryMetrics?: Array<{ label: string; value: string }>;
  headers?: string[];
  rows?: (string | number)[][];
  blob: Blob;
  dataUrl: string;
  plainTextSummary: string;
}

type ExportListener = (payload: ExportDocumentPayload) => void;
const exportListeners = new Set<ExportListener>();

export function subscribeToExports(listener: ExportListener): () => void {
  exportListeners.add(listener);
  return () => {
    exportListeners.delete(listener);
  };
}

function notifyExportListeners(payload: ExportDocumentPayload): void {
  exportListeners.forEach((listener) => listener(payload));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

function buildPlainTextReport(
  title: string,
  subtitle: string,
  summaryMetrics: Array<{ label: string; value: string }>,
  headers: string[],
  rows: (string | number)[][]
): string {
  const lines: string[] = [];
  lines.push(`*FRIENDS SAVINGS & LOAN MANAGER*`);
  lines.push(`*${title}*`);
  if (subtitle) lines.push(subtitle);
  lines.push(`Generated: ${formatDateDDMMYYYY(new Date().toISOString().slice(0, 10))}`);
  lines.push('----------------------------------------');

  if (summaryMetrics.length > 0) {
    for (const m of summaryMetrics) {
      lines.push(`• ${m.label}: ${m.value}`);
    }
    lines.push('----------------------------------------');
  }

  if (headers.length > 0) {
    lines.push(headers.join(' | '));
    lines.push('----------------------------------------');
    for (const r of rows) {
      lines.push(r.map((c) => String(c ?? '')).join(' | '));
    }
  }
  return lines.join('\n');
}

/**
 * Downloads an Excel-compatible (.csv) file with UTF-8 BOM for ₹ symbol support
 * and opens the Android/Web Export & Share Sheet so it always works in Android WebViews.
 */
export function exportTableToExcelCSV(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [
    escapeCell(title),
    `Generated on,${formatDateDDMMYYYY(new Date().toISOString().slice(0, 10))}`,
    '',
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const finalFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  triggerBrowserDownload(blob, finalFilename);

  const plainTextSummary = buildPlainTextReport(title, 'Excel (.CSV) Export', [], headers, rows);

  void blobToDataUrl(blob).then((dataUrl) => {
    notifyExportListeners({
      format: 'csv',
      filename: finalFilename,
      mimeType: 'text/csv',
      title,
      subtitle: 'Excel-Compatible Spreadsheet (.CSV)',
      headers,
      rows,
      blob,
      dataUrl,
      plainTextSummary,
    });
  });
}

/**
 * Generates a real, standalone binary PDF-1.4 file for any report table
 * and opens the Android/Web Export & Share Sheet so it works offline in Android APK WebViews and browsers.
 */
export function exportReportToPDF(
  filename: string,
  reportTitle: string,
  subtitle: string,
  summaryMetrics: Array<{ label: string; value: string }>,
  headers: string[],
  rows: (string | number)[][]
): void {
  const sanitizePdfText = (input: string | number): string => {
    return String(input ?? '')
      .replace(/₹/g, 'Rs. ')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  };

  const lines: Array<{ text: string; size: number; bold?: boolean }> = [];
  lines.push({ text: 'FRIENDS SAVINGS & INTEREST-FREE LOAN MANAGER', size: 14, bold: true });
  lines.push({ text: sanitizePdfText(reportTitle), size: 12, bold: true });
  lines.push({ text: sanitizePdfText(subtitle), size: 9 });
  lines.push({ text: '----------------------------------------------------------------------------------------', size: 9 });

  if (summaryMetrics.length > 0) {
    const metricLine = summaryMetrics
      .map((m) => `${sanitizePdfText(m.label)}: ${sanitizePdfText(m.value)}`)
      .join('   |   ');
    lines.push({ text: metricLine, size: 9, bold: true });
    lines.push({ text: '----------------------------------------------------------------------------------------', size: 9 });
  }

  const colWidths = headers.map((h, colIdx) => {
    const maxDataLen = rows.reduce((acc, r) => {
      const len = sanitizePdfText(r[colIdx] ?? '').length;
      return Math.max(acc, len);
    }, sanitizePdfText(h).length);
    return Math.min(28, Math.max(10, maxDataLen + 2));
  });

  const formatRowText = (cells: (string | number)[]) =>
    cells
      .map((c, idx) => {
        const clean = sanitizePdfText(c);
        const w = colWidths[idx] || 14;
        return clean.length > w ? clean.slice(0, w - 1) + '.' : clean.padEnd(w, ' ');
      })
      .join('  ');

  lines.push({ text: formatRowText(headers), size: 8, bold: true });
  lines.push({ text: '-'.repeat(92), size: 8 });

  for (const row of rows.slice(0, 120)) {
    lines.push({ text: formatRowText(row), size: 8 });
  }

  let y = 800;
  const contentOps: string[] = ['BT'];
  for (const line of lines) {
    if (y < 45) break;
    const fontKey = line.bold ? '/F2' : '/F1';
    contentOps.push(`${fontKey} ${line.size} Tf`);
    contentOps.push(`1 0 0 1 36 ${y} Tm`);
    contentOps.push(`(${line.text}) Tj`);
    y -= line.size + 5;
  }
  contentOps.push('ET');
  const streamData = contentOps.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamData.length} >>\nstream\n${streamData}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blob = new Blob([pdf], { type: 'application/pdf' });
  triggerBrowserDownload(blob, finalFilename);

  const plainTextSummary = buildPlainTextReport(
    reportTitle,
    subtitle,
    summaryMetrics,
    headers,
    rows
  );

  void blobToDataUrl(blob).then((dataUrl) => {
    notifyExportListeners({
      format: 'pdf',
      filename: finalFilename,
      mimeType: 'application/pdf',
      title: reportTitle,
      subtitle,
      summaryMetrics,
      headers,
      rows,
      blob,
      dataUrl,
      plainTextSummary,
    });
  });
}

/**
 * Exports full JSON database backup
 */
export function exportDatabaseBackupJSON(state: AppDatabaseState): void {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const datePart = formatDateDDMMYYYY(state.settings.currentReferenceDate);
  const finalFilename = `FriendsSavings_Backup_${datePart}.json`;
  triggerBrowserDownload(blob, finalFilename);

  void blobToDataUrl(blob).then((dataUrl) => {
    notifyExportListeners({
      format: 'json',
      filename: finalFilename,
      mimeType: 'application/json',
      title: `Complete Database Backup (${datePart})`,
      subtitle: `${state.members.length} members · ${state.transactions.length} transactions · ${state.loans.length} loans`,
      blob,
      dataUrl,
      plainTextSummary: json,
    });
  });
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  } catch {
    // Fallback handled by ExportPreviewModal for Android WebView
  }
}
