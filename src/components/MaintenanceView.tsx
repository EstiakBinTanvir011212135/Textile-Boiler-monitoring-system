import React, { useRef, useState } from 'react';
import { Download, Paperclip, X } from 'lucide-react';
import type { BoilerUnit, MaintenanceAttachment, MaintenanceRecord } from '../types/boiler';
import type { Translations } from '../i18n/translations';
import { downloadAttachmentFile } from '../utils/exportCsv';

interface MaintenanceViewProps {
  boilers: BoilerUnit[];
  records: MaintenanceRecord[];
  onAddRecord: (payload: {
    boilerId: string;
    taskTitle: string;
    category: MaintenanceRecord['category'];
    technician: string;
    scheduledDate: string;
    notes: string;
    markCompleted: boolean;
    attachment?: MaintenanceAttachment | null;
  }) => Promise<void>;
  onUpdateStatus: (id: string, status: MaintenanceRecord['status']) => Promise<void>;
  t: Translations;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  boilers,
  records,
  onAddRecord,
  onUpdateStatus,
  t,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'completed'>('all');
  const [boilerId, setBoilerId] = useState<string>(boilers[0]?.id ?? 'BLR-01');
  const [taskTitle, setTaskTitle] = useState('');
  const [category, setCategory] = useState<MaintenanceRecord['category']>('Preventive');
  const [technician, setTechnician] = useState('');
  const [scheduledDate, setScheduledDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');
  const [markCompleted, setMarkCompleted] = useState(false);
  const [attachment, setAttachment] = useState<MaintenanceAttachment | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredRecords = records.filter((rec) => {
    if (filter === 'all') return true;
    if (filter === 'completed') return rec.status === 'completed';
    return rec.status !== 'completed';
  });

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Attachment must be 8 MB or smaller.');
      return;
    }

    setUploadError(null);
    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/maintenance/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            contentBase64: typeof reader.result === 'string' ? reader.result : '',
          }),
        });
        const data = (await res.json()) as {
          attachment?: MaintenanceAttachment;
          error?: string;
        };
        if (!res.ok || !data.attachment) {
          setUploadError(data.error || 'Failed to upload file.');
          return;
        }
        setAttachment(data.attachment);
      } catch {
        setUploadError('Network error uploading attachment.');
      } finally {
        setUploadingFile(false);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read file.');
      setUploadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !technician.trim()) return;
    setSubmitting(true);
    try {
      await onAddRecord({
        boilerId,
        taskTitle,
        category,
        technician,
        scheduledDate,
        notes,
        markCompleted,
        attachment,
      });
      setTaskTitle('');
      setNotes('');
      setMarkCompleted(false);
      setAttachment(null);
      setUploadError(null);
    } finally {
      setSubmitting(false);
    }
  };

  const formatMaintLabel = (status: BoilerUnit['maintenanceStatus']) => {
    switch (status) {
      case 'operational':
        return { text: t.maintOperational, cls: 'text-emerald-700 dark:text-emerald-400', glyph: '●' };
      case 'inspection_due':
        return { text: t.maintInspectionDue, cls: 'text-amber-700 dark:text-amber-400', glyph: '▲' };
      case 'attention_required':
        return { text: t.maintAttentionRequired, cls: 'text-rose-700 dark:text-rose-400', glyph: '✖' };
      case 'under_maintenance':
        return { text: t.maintUnderMaintenance, cls: 'text-blue-700 dark:text-blue-400', glyph: '◆' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Service Interval Health Strip across all Boilers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {boilers.map((b) => {
          const pctUsed = Math.min(
            100,
            Math.round((b.hoursSinceLastService / b.serviceIntervalHours) * 100)
          );
          const hrsRemaining = Math.max(0, b.serviceIntervalHours - b.hoursSinceLastService);
          const badge = formatMaintLabel(b.maintenanceStatus);

          return (
            <div
              key={b.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{b.id}</p>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {b.name}
                  </h3>
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${badge.cls}`}>
                  {badge.glyph} {badge.text}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400">{t.sinceService}</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                    {b.hoursSinceLastService.toFixed(1)} / {b.serviceIntervalHours} hrs
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      pctUsed >= 92
                        ? 'bg-amber-600'
                        : pctUsed >= 100
                          ? 'bg-rose-600'
                          : 'bg-emerald-600'
                    }`}
                    style={{ width: `${pctUsed}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {t.lastInspection}: <strong className="font-mono font-medium text-slate-700 dark:text-slate-300">{b.lastInspectionDate}</strong>
                </span>
                <span className="font-mono tabular-nums">
                  {hrsRemaining.toFixed(0)}h left
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Split: Maintenance Ledger + Log Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Maintenance Log Table (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Inspection & Service Schedule
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Completing a preventive service resets the unit operating service counter.
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['all', 'scheduled', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    filter === tab
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 mt-2">
            {filteredRecords.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No maintenance records match this filter.
              </p>
            ) : (
              filteredRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {rec.boilerId}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{rec.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{rec.technician}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {rec.completedDate
                          ? `Completed ${rec.completedDate}`
                          : `Scheduled ${rec.scheduledDate}`}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {rec.taskTitle}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {rec.notes}
                    </p>
                    {rec.attachment && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            downloadAttachmentFile(rec.attachment!.id, rec.attachment!.filename)
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>
                            {rec.attachment.filename} ({(rec.attachment.sizeBytes / 1024).toFixed(1)} KB)
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {rec.status === 'completed' ? (
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        ● Completed
                      </span>
                    ) : (
                      <>
                        {rec.status !== 'in_progress' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(rec.id, 'in_progress')}
                            className="px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Start Work
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(rec.id, 'completed')}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Mark Complete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Log Maintenance Form (4 cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
        >
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Log or Schedule Service
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Update inspection status for plant management audit trail.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Boiler Unit
            </label>
            <select
              value={boilerId}
              onChange={(e) => setBoilerId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              {boilers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} · {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Service Task Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Safety Valve & Burner Tune-up"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MaintenanceRecord['category'])}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="Preventive">Preventive</option>
                <option value="Inspection">Inspection</option>
                <option value="Calibration">Calibration</option>
                <option value="Repair">Repair</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Assigned Engineer / Technician
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Engr. Tariqul Islam"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Inspection Notes
            </label>
            <textarea
              rows={2}
              placeholder="Parts checked, calibration offset, or gasket status..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Inspection Certificate / File Attachment
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.csv,.txt,.doc,.docx"
              onChange={handleAttachmentSelect}
              className="hidden"
              aria-label="Upload inspection certificate or maintenance attachment"
            />
            {attachment ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg">
                <span className="truncate text-slate-800 dark:text-slate-200 font-medium">
                  {attachment.filename} ({(attachment.sizeBytes / 1024).toFixed(1)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer shrink-0"
                  aria-label="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploadingFile}
                onClick={() => fileInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>{uploadingFile ? 'Uploading file...' : 'Attach PDF, Image, or CSV Report'}</span>
              </button>
            )}
            {uploadError && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{uploadError}</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={markCompleted}
              onChange={(e) => setMarkCompleted(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700"
            />
            <span>Mark as completed immediately (resets service counter)</span>
          </label>

          <button
            type="submit"
            disabled={submitting || uploadingFile}
            className="w-full px-4 py-2.5 text-sm font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Saving...' : 'Save Maintenance Record'}
          </button>
        </form>
      </div>
    </div>
  );
};
