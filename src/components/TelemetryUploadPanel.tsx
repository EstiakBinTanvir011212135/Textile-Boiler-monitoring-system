import React, { useRef, useState } from 'react';
import { Download, FileUp, Upload } from 'lucide-react';
import { downloadSampleTelemetryCsv } from '../utils/exportCsv';

interface TelemetryUploadPanelProps {
  defaultBoilerId: string;
  onUploadComplete: () => Promise<void>;
}

export const TelemetryUploadPanel: React.FC<TelemetryUploadPanelProps> = ({
  defaultBoilerId,
  onUploadComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const readSelectedFile = (file: File) => {
    setResultMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setSelectedFile({
        name: file.name,
        content,
        size: file.size,
      });
    };
    reader.onerror = () => {
      setResultMsg({ type: 'error', text: 'Failed to read selected file from disk.' });
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readSelectedFile(file);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setResultMsg(null);
    try {
      const res = await fetch('/api/sensors/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultBoilerId,
          filename: selectedFile.name,
          content: selectedFile.content,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        importedCount?: number;
        updatedBoilers?: string[];
        error?: string;
      };
      if (!res.ok) {
        setResultMsg({ type: 'error', text: data.error || 'Upload failed' });
        return;
      }
      await onUploadComplete();
      setResultMsg({
        type: 'success',
        text: `Imported ${data.importedCount ?? 0} reading(s) into ${(data.updatedBoilers ?? [defaultBoilerId]).join(', ')}.`,
      });
      setSelectedFile(null);
    } catch {
      setResultMsg({ type: 'error', text: 'Network error while uploading telemetry file.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Upload Sensor Telemetry File (CSV / JSON)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Import historical or batch PLC readings directly into {defaultBoilerId} or multi-unit logs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadSampleTelemetryCsv(defaultBoilerId)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Sample CSV</span>
        </button>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`border border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer ${
          isDragging
            ? 'border-amber-600 bg-amber-50/50 dark:bg-amber-950/20'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/60 dark:bg-slate-950/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,.txt"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Choose telemetry CSV or JSON file"
        />
        <FileUp className="w-5 h-5 mx-auto text-slate-500 dark:text-slate-400 mb-2" />
        {selectedFile ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
              {selectedFile.name}
            </p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {(selectedFile.size / 1024).toFixed(1)} KB ready to import
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Click to choose a file or drag and drop CSV / JSON here
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Columns: boilerId, temperatureC, pressureBar, waterLevelPct, fuelConsumptionLph
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs">
          {resultMsg && (
            <span
              className={
                resultMsg.type === 'success'
                  ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                  : 'text-rose-700 dark:text-rose-400 font-medium'
              }
            >
              {resultMsg.text}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedFile && (
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            disabled={!selectedFile || uploading}
            onClick={handleUploadSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Uploading...' : 'Upload & Import Readings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
