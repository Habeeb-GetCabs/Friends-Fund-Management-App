import React, { useState } from 'react';
import {
  X,
  Share2,
  Printer,
  Download,
  Copy,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ExportDocumentPayload,
  triggerBrowserDownload,
} from '../utils/exportUtils';

interface ExportPreviewModalProps {
  payload: ExportDocumentPayload;
  onClose: () => void;
}

export const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  payload,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleNativeShare = async () => {
    setStatusMessage(null);
    try {
      const file = new File([payload.blob], payload.filename, {
        type: payload.mimeType,
      });

      if (
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: payload.title,
          text: payload.subtitle || payload.title,
          files: [file],
        });
        setStatusMessage('Shared / saved file via device share sheet.');
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: payload.title,
          text: payload.plainTextSummary,
        });
        setStatusMessage('Shared report via device share sheet.');
        return;
      }

      // Fallback if navigator.share is unavailable: copy to clipboard and trigger download
      triggerBrowserDownload(payload.blob, payload.filename);
      setStatusMessage(`Downloaded ${payload.filename}.`);
    } catch (err) {
      const msg = (err as Error)?.message || '';
      if (!msg.toLowerCase().includes('abort')) {
        triggerBrowserDownload(payload.blob, payload.filename);
        setStatusMessage(`Downloaded ${payload.filename}.`);
      }
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(payload.plainTextSummary);
      setCopied(true);
      setStatusMessage(
        payload.format === 'json'
          ? 'Backup JSON copied to clipboard!'
          : 'Formatted report copied! You can now paste it into WhatsApp or Notes.'
      );
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setStatusMessage('Could not access clipboard automatically.');
    }
  };

  const handlePrintOrSavePdf = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-preview-modal-title"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 shadow-xl my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              {payload.format === 'csv' ? (
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
              ) : (
                <FileText className="w-5 h-5 text-emerald-700" />
              )}
            </div>
            <div>
              <h2
                id="export-preview-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900"
              >
                {payload.format === 'pdf'
                  ? 'PDF Report Ready'
                  : payload.format === 'csv'
                  ? 'Excel (.CSV) Report Ready'
                  : 'Database Backup Ready'}
              </h2>
              <p className="text-xs font-mono text-slate-500 mt-0.5 break-all">
                {payload.filename}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast inside Modal */}
        {statusMessage && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Action Buttons for Android Phone & Web */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleNativeShare}
            className="py-2.5 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-2 min-h-[44px]"
          >
            <Share2 className="w-4 h-4 shrink-0" />
            <span>Share / Save to Phone</span>
          </button>

          <a
            href={payload.dataUrl || '#'}
            download={payload.filename}
            onClick={() => {
              triggerBrowserDownload(payload.blob, payload.filename);
              setStatusMessage(`Downloading ${payload.filename}...`);
            }}
            className="py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-2 min-h-[44px] text-center"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Download File</span>
          </a>

          <button
            type="button"
            onClick={handlePrintOrSavePdf}
            className="py-2.5 px-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-2 min-h-[44px]"
          >
            <Printer className="w-4 h-4 text-slate-600 shrink-0" />
            <span>Print / Save as PDF</span>
          </button>

          <button
            type="button"
            onClick={handleCopyText}
            className="py-2.5 px-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-2 min-h-[44px]"
          >
            <Copy className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{copied ? 'Copied!' : 'Copy for WhatsApp'}</span>
          </button>
        </div>

        {/* Report Document Preview */}
        <div className="mt-4 flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            Friends Savings &amp; Interest-Free Loan Manager
          </div>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">
            {payload.title}
          </h3>
          {payload.subtitle && (
            <p className="text-xs text-slate-500 mt-0.5">{payload.subtitle}</p>
          )}

          {payload.summaryMetrics && payload.summaryMetrics.length > 0 && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {payload.summaryMetrics.map((m, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-white border border-slate-200"
                >
                  <div className="text-[11px] text-slate-500">{m.label}</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {payload.headers && payload.rows ? (
            <div className="mt-3 overflow-x-auto bg-white rounded-lg border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-slate-600 font-semibold">
                    {payload.headers.map((h, i) => (
                      <th key={i} className="py-2 px-2.5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {payload.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={payload.headers.length}
                        className="py-6 text-center text-slate-500"
                      >
                        No entries in this report.
                      </td>
                    </tr>
                  ) : (
                    payload.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="py-2 px-2.5 font-mono tabular-nums text-slate-800"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="mt-3 p-3 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-700 overflow-x-auto max-h-60">
              {payload.plainTextSummary}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
