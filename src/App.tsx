import React, { useEffect, useRef, useState } from 'react';
import { Download, FileText, Moon, Pause, Play, Sun, Upload } from 'lucide-react';
import { TRANSLATIONS, type Language } from './i18n/translations';
import type {
  AlertEvent,
  BoilerUnit,
  FaultScenario,
  LoadMode,
  MaintenanceAttachment,
  MaintenanceRecord,
  PlantDashboardState,
} from './types/boiler';
import { TelemetryChart } from './components/TelemetryChart';
import { BoilerSchematic } from './components/BoilerSchematic';
import { AnalyticsView } from './components/AnalyticsView';
import { MaintenanceView } from './components/MaintenanceView';
import { IotDatabaseView } from './components/IotDatabaseView';
import { AiAssistantView } from './components/AiAssistantView';
import { exportCompliancePdf } from './utils/exportCompliancePdf';
import { downloadTelemetryCsvReport } from './utils/exportCsv';

type NavTab = 'overview' | 'analytics' | 'maintenance' | 'iot' | 'ai';

export default function App() {
  const quickUploadRef = useRef<HTMLInputElement | null>(null);
  const [dashboard, setDashboard] = useState<PlantDashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [selectedBoilerId, setSelectedBoilerId] = useState<string>('BLR-01');
  const [streamPaused, setStreamPaused] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [darkMode, setDarkMode] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null);

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Initial state fetch
  useEffect(() => {
    let active = true;
    fetch('/api/state')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<PlantDashboardState>;
      })
      .then((data) => {
        if (active) {
          setDashboard(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to connect to telemetry server');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Live SSE Telemetry Subscription
  useEffect(() => {
    if (streamPaused) {
      setStreamConnected(false);
      return;
    }

    const source = new EventSource('/api/telemetry/stream');
    source.onopen = () => {
      setStreamConnected(true);
    };
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as PlantDashboardState;
        setDashboard(parsed);
        setStreamConnected(true);
        setLoading(false);
      } catch {
        // Ignore malformed frame
      }
    };
    source.onerror = () => {
      setStreamConnected(false);
    };

    return () => {
      source.close();
      setStreamConnected(false);
    };
  }, [streamPaused]);

  const boilers = dashboard?.boilers ?? [];
  const selectedBoiler: BoilerUnit | undefined =
    boilers.find((b) => b.id === selectedBoilerId) ?? boilers[0];
  const alerts = dashboard?.alerts ?? [];
  const activeAlerts = alerts.filter((a) => !a.resolved);
  const maintenanceRecords = dashboard?.maintenanceRecords ?? [];

  const updateBoilerControl = async (
    boilerId: string,
    body: {
      isRunning?: boolean;
      loadMode?: LoadMode;
      targetPressureBar?: number;
      faultScenario?: FaultScenario;
    }
  ) => {
    const res = await fetch(`/api/boilers/${boilerId}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const stateRes = await fetch('/api/state');
      if (stateRes.ok) {
        setDashboard((await stateRes.json()) as PlantDashboardState);
      }
    }
  };

  const handleAcknowledgeAlert = async (id: string) => {
    await fetch(`/api/alerts/${id}/acknowledge`, { method: 'POST' });
    const stateRes = await fetch('/api/state');
    if (stateRes.ok) setDashboard((await stateRes.json()) as PlantDashboardState);
  };

  const handleResolveAlert = async (id: string) => {
    await fetch(`/api/alerts/${id}/resolve`, { method: 'POST' });
    const stateRes = await fetch('/api/state');
    if (stateRes.ok) setDashboard((await stateRes.json()) as PlantDashboardState);
  };

  const refreshState = async () => {
    const stateRes = await fetch('/api/state', { cache: 'no-store' });
    if (stateRes.ok) {
      setDashboard((await stateRes.json()) as PlantDashboardState);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      await downloadTelemetryCsvReport(dashboard);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleQuickUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadStatus(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/sensors/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            defaultBoilerId: selectedBoilerId,
            filename: file.name,
            content: typeof reader.result === 'string' ? reader.result : '',
          }),
        });
        const data = (await res.json()) as {
          importedCount?: number;
          updatedBoilers?: string[];
          error?: string;
        };
        if (!res.ok) {
          setUploadStatus({ type: 'error', text: data.error || 'Telemetry upload failed.' });
          return;
        }
        await refreshState();
        setUploadStatus({
          type: 'success',
          text: `Uploaded ${file.name}: ${data.importedCount ?? 0} reading(s) applied to ${(
            data.updatedBoilers ?? [selectedBoilerId]
          ).join(', ')}.`,
        });
      } catch {
        setUploadStatus({ type: 'error', text: 'Network error uploading telemetry file.' });
      }
    };
    reader.readAsText(file);
  };

  const handleAddMaintenance = async (payload: {
    boilerId: string;
    taskTitle: string;
    category: MaintenanceRecord['category'];
    technician: string;
    scheduledDate: string;
    notes: string;
    markCompleted: boolean;
    attachment?: MaintenanceAttachment | null;
  }) => {
    await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await refreshState();
  };

  const handleUpdateMaintenanceStatus = async (
    id: string,
    status: MaintenanceRecord['status']
  ) => {
    await fetch(`/api/maintenance/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await refreshState();
  };

  const handleInjectSensorPacket = async (payload: {
    boilerId: string;
    temperatureC: number;
    pressureBar: number;
    waterLevelPct: number;
    fuelConsumptionLph: number;
  }) => {
    await fetch('/api/sensors/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await refreshState();
  };

  const renderStatusLabel = (status: BoilerUnit['status']) => {
    switch (status) {
      case 'nominal':
        return { text: t.statusNominal, glyph: '●', cls: 'text-emerald-700 dark:text-emerald-400' };
      case 'warning':
        return { text: t.statusWarning, glyph: '▲', cls: 'text-amber-700 dark:text-amber-400' };
      case 'critical':
        return { text: t.statusCritical, glyph: '✖', cls: 'text-rose-700 dark:text-rose-400' };
      case 'standby':
        return { text: t.statusStandby, glyph: '○', cls: 'text-slate-600 dark:text-slate-400' };
      case 'maintenance':
        return { text: t.statusMaintenance, glyph: '◆', cls: 'text-blue-700 dark:text-blue-400' };
    }
  };

  const renderMaintenanceLabel = (status: BoilerUnit['maintenanceStatus']) => {
    switch (status) {
      case 'operational':
        return { text: t.maintOperational, glyph: '●', cls: 'text-emerald-700 dark:text-emerald-400' };
      case 'inspection_due':
        return { text: t.maintInspectionDue, glyph: '▲', cls: 'text-amber-700 dark:text-amber-400' };
      case 'attention_required':
        return { text: t.maintAttentionRequired, glyph: '✖', cls: 'text-rose-700 dark:text-rose-400' };
      case 'under_maintenance':
        return { text: t.maintUnderMaintenance, glyph: '◆', cls: 'text-blue-700 dark:text-blue-400' };
    }
  };

  const renderAlertSeverity = (severity: AlertEvent['severity']) => {
    switch (severity) {
      case 'critical':
        return { label: t.statusCritical, glyph: '✖', cls: 'text-rose-700 dark:text-rose-400' };
      case 'warning':
        return { label: t.statusWarning, glyph: '▲', cls: 'text-amber-700 dark:text-amber-400' };
      case 'info':
        return { label: 'Info', glyph: '●', cls: 'text-sky-700 dark:text-sky-400' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar Contract: Exactly 3 zones separated by gap-8 */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('overview');
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            {t.brand}
          </a>

          {/* Zone 2: 5 single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            {(
              [
                { id: 'overview', label: t.navOverview },
                { id: 'analytics', label: t.navAnalytics },
                { id: 'maintenance', label: t.navMaintenance },
                { id: 'iot', label: t.navIot },
                { id: 'ai', label: t.navAi },
              ] as const
            ).map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-amber-600 text-slate-900 dark:text-slate-100'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="shrink-0">
            <button
              type="button"
              disabled={!dashboard || exportingCsv}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportingCsv ? 'Exporting...' : t.exportCsv}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Bar (only visible below md) */}
      <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {(
          [
            { id: 'overview', label: t.navOverview },
            { id: 'analytics', label: t.navAnalytics },
            { id: 'maintenance', label: t.navMaintenance },
            { id: 'iot', label: t.navIot },
            { id: 'ai', label: t.navAi },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
              activeTab === item.id
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Workspace Toolbar: Boiler Selector + Real Stream Control + Language & Theme */}
        <section className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-4">
            <div
              className="inline-flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
              role="tablist"
              aria-label="Select Boiler Unit"
            >
              {boilers.map((b) => {
                const isSelected = selectedBoiler?.id === b.id;
                const badge = renderStatusLabel(b.status);
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedBoilerId(b.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="font-mono">{b.id}</span>
                    <span className="hidden sm:inline">{b.name}</span>
                    <span className={badge.cls} aria-hidden="true">
                      {badge.glyph}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedBoiler && (
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>{selectedBoiler.location}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{selectedBoiler.ratedCapacityKgHr.toLocaleString()} kg/hr</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Genuine SSE Connection Telemetry */}
            <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-300">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  streamPaused
                    ? 'bg-slate-400'
                    : streamConnected
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                }`}
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">
                {streamPaused
                  ? t.pausedStream
                  : streamConnected
                    ? t.liveStream
                    : t.connectingStream}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setStreamPaused((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {streamPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{streamPaused ? t.resume : t.pause}</span>
            </button>

            <input
              ref={quickUploadRef}
              type="file"
              accept=".csv,.json,.txt"
              onChange={handleQuickUploadFile}
              className="hidden"
              aria-label="Upload telemetry CSV or JSON file"
            />
            <button
              type="button"
              onClick={() => quickUploadRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'CSV আপলোড' : 'Upload CSV'}</span>
            </button>

            <button
              type="button"
              disabled={!dashboard || !selectedBoiler}
              onClick={() => {
                if (dashboard && selectedBoiler) {
                  exportCompliancePdf(dashboard, selectedBoiler);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t.exportPdf}</span>
            </button>

            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'en' ? 'bn' : 'en'))}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              aria-label="Toggle Language"
            >
              {lang === 'en' ? 'বাংলা' : 'English'}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              aria-label="Toggle Light or Dark theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </section>

        {uploadStatus && (
          <div
            className={`flex items-center justify-between gap-4 px-4 py-2.5 text-xs rounded-lg border ${
              uploadStatus.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            <span>{uploadStatus.text}</span>
            <button
              type="button"
              onClick={() => setUploadStatus(null)}
              className="font-medium underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading / Error State */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-xl p-6 text-sm text-rose-700 dark:text-rose-400">
            Unable to load plant telemetry: {error}
          </div>
        ) : !selectedBoiler ? null : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 1. Core 6-Metric Strip (Temperature, Pressure, Water Level, Fuel, Operating Hours, Maintenance Status) */}
                <section
                  aria-label="Core Boiler Parameters"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800"
                >
                  {/* 1. Boiler Temperature */}
                  <div className="p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t.boilerTemperature}
                      </span>
                      <span
                        className={`text-xs font-mono ${
                          selectedBoiler.temperatureC >= 202
                            ? 'text-rose-600 dark:text-rose-400'
                            : selectedBoiler.temperatureC >= 195
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {selectedBoiler.tempDeltaPerMin >= 0 ? '+' : ''}
                        {selectedBoiler.tempDeltaPerMin.toFixed(1)}/m
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-baseline">
                      <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        {selectedBoiler.temperatureC.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1.5">
                        °C
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {t.safeRange}: 165–195 °C
                    </p>
                  </div>

                  {/* 2. Steam Pressure */}
                  <div className="p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t.steamPressure}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {(selectedBoiler.pressureBar * 14.5038).toFixed(0)} psi
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-baseline">
                      <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        {selectedBoiler.pressureBar.toFixed(2)}
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1.5">
                        bar
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {t.target}: {selectedBoiler.targetPressureBar.toFixed(1)} bar
                    </p>
                  </div>

                  {/* 3. Water Level */}
                  <div className="p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t.waterLevel}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          selectedBoiler.waterLevelPct <= 35
                            ? 'text-rose-600 dark:text-rose-400'
                            : selectedBoiler.waterLevelPct <= 46
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-sky-700 dark:text-sky-400'
                        }`}
                      >
                        {selectedBoiler.feedwaterPumpActive ? t.pumpActive : t.pumpIdle}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-baseline">
                      <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        {selectedBoiler.waterLevelPct.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1.5">
                        %
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {t.safeRange}: 45–85 %
                    </p>
                  </div>

                  {/* 4. Fuel Consumption */}
                  <div className="p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t.fuelConsumption}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {selectedBoiler.burnerFiringPct}%
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-baseline">
                      <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        {selectedBoiler.fuelConsumptionLph.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1.5">
                        L/hr
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {t.dailyTotal}: {selectedBoiler.dailyFuelTotalL.toFixed(0)} L
                    </p>
                  </div>

                  {/* 5. Operating Hours */}
                  <div className="p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t.operatingHours}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {selectedBoiler.currentRunHours.toFixed(1)}h run
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-baseline">
                      <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        {selectedBoiler.operatingHoursTotal.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1.5">
                        hrs
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {t.sinceService}: {selectedBoiler.hoursSinceLastService.toFixed(0)} /{' '}
                      {selectedBoiler.serviceIntervalHours}h
                    </p>
                  </div>

                  {/* 6. Maintenance Status */}
                  <div className="p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t.maintenanceStatus}
                      </span>
                    </div>
                    {(() => {
                      const m = renderMaintenanceLabel(selectedBoiler.maintenanceStatus);
                      return (
                        <div className={`mt-2.5 text-base font-semibold ${m.cls}`}>
                          {m.glyph} {m.text}
                        </div>
                      );
                    })()}
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {t.nextInspection}: {selectedBoiler.nextInspectionDate}
                    </p>
                  </div>
                </section>

                {/* 2. Main Split Stage: Live Multi-Channel Chart + Boiler Cross-Section & Controls */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* Left 8 Columns: Telemetry Chart + Operational Management Controls */}
                  <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-6">
                    <TelemetryChart boiler={selectedBoiler} t={t} />

                    {/* Operational Management Controls Strip */}
                    <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {t.unitControls} · {selectedBoiler.id}
                        </h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {selectedBoiler.name}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
                        {/* Power / Standby Switch */}
                        <div>
                          <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                            {t.boilerPower}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateBoilerControl(selectedBoiler.id, {
                                isRunning: !selectedBoiler.isRunning,
                              })
                            }
                            className={`w-full px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                              selectedBoiler.isRunning
                                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                          >
                            {selectedBoiler.isRunning ? t.stopBoiler : t.startBoiler}
                          </button>
                        </div>

                        {/* Load Mode */}
                        <div>
                          <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                            {t.loadMode}
                          </span>
                          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            {(['eco', 'normal', 'peak'] as LoadMode[]).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() =>
                                  updateBoilerControl(selectedBoiler.id, { loadMode: mode })
                                }
                                className={`py-1 text-xs font-medium capitalize rounded transition-colors cursor-pointer ${
                                  selectedBoiler.loadMode === mode
                                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                              >
                                {mode}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Target Pressure Setpoint */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-slate-500 dark:text-slate-400">
                              {t.targetPressure}
                            </span>
                            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                              {selectedBoiler.targetPressureBar.toFixed(1)} bar
                            </span>
                          </div>
                          <input
                            type="range"
                            min={6.0}
                            max={12.5}
                            step={0.1}
                            value={selectedBoiler.targetPressureBar}
                            onChange={(e) =>
                              updateBoilerControl(selectedBoiler.id, {
                                targetPressureBar: Number(e.target.value),
                              })
                            }
                            className="w-full accent-amber-600 cursor-pointer"
                            aria-label={t.targetPressure}
                          />
                        </div>

                        {/* Fault Injection / Safety Test */}
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                            {t.faultSimulation}
                          </label>
                          <select
                            value={selectedBoiler.faultScenario}
                            onChange={(e) =>
                              updateBoilerControl(selectedBoiler.id, {
                                faultScenario: e.target.value as FaultScenario,
                              })
                            }
                            className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          >
                            <option value="none">{t.faultNone}</option>
                            <option value="high_temp_drift">{t.faultHighTemp}</option>
                            <option value="low_water_alert">{t.faultLowWater}</option>
                            <option value="pressure_surge">{t.faultPressureSurge}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right 4 Columns: Boiler Cross-Section Schematic */}
                  <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
                    <BoilerSchematic boiler={selectedBoiler} t={t} />
                  </div>
                </section>

                {/* 3. Plant Boiler Fleet Table + Active Alerts Feed */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Fleet Table (7 cols) */}
                  <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {t.fleetComparison}
                      </h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Click a row to inspect
                      </span>
                    </div>

                    <div className="overflow-x-auto mt-2">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                            <th className="py-2.5 pr-3">Unit</th>
                            <th className="py-2.5 px-3 text-right">Temp</th>
                            <th className="py-2.5 px-3 text-right">Pressure</th>
                            <th className="py-2.5 px-3 text-right">Water</th>
                            <th className="py-2.5 px-3 text-right">Fuel</th>
                            <th className="py-2.5 px-3 text-right">Hours</th>
                            <th className="py-2.5 pl-3 text-right">State</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                          {boilers.map((b) => {
                            const isSelected = b.id === selectedBoiler.id;
                            const badge = renderStatusLabel(b.status);
                            return (
                              <tr
                                key={b.id}
                                onClick={() => setSelectedBoilerId(b.id)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-slate-100/80 dark:bg-slate-800/60'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                                }`}
                              >
                                <td className="py-3 pr-3">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {b.name}
                                  </div>
                                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                    {b.id} · {b.fuelType}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                                  {b.temperatureC.toFixed(1)} °C
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                                  {b.pressureBar.toFixed(2)} bar
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                                  {b.waterLevelPct.toFixed(1)} %
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                                  {b.fuelConsumptionLph.toFixed(1)} L/h
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                  {b.operatingHoursTotal.toFixed(0)} h
                                </td>
                                <td className={`py-3 pl-3 text-right font-medium whitespace-nowrap ${badge.cls}`}>
                                  {badge.glyph} {badge.text}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Active Alerts & Alarms Feed (5 cols) */}
                  <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {t.activeAlerts}
                      </h3>
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {activeAlerts.length} active
                      </span>
                    </div>

                    <div className="divide-y divide-slate-200 dark:divide-slate-800 mt-1">
                      {activeAlerts.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                          {t.noActiveAlerts}
                        </p>
                      ) : (
                        activeAlerts.map((alert) => {
                          const sev = renderAlertSeverity(alert.severity);
                          return (
                            <div key={alert.id} className="py-4 space-y-2">
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${sev.cls}`}>
                                    {sev.glyph} {sev.label}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                                    ·
                                  </span>
                                  <span className="font-mono text-slate-700 dark:text-slate-300">
                                    {alert.boilerId}
                                  </span>
                                </div>
                                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                  {alert.valueDisplay}
                                </span>
                              </div>

                              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                {alert.message}
                              </p>

                              <div className="flex items-center justify-between gap-2 pt-1">
                                <span className="text-[11px] font-mono text-slate-400">
                                  {new Date(alert.timestamp).toLocaleTimeString()}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPendingAiPrompt(
                                        `Diagnose alert on ${alert.boilerId} (${alert.parameter} = ${alert.valueDisplay}): "${alert.message}". Explain the root cause, impact on textile dyeing/stenter production, and immediate corrective actions.`
                                      );
                                      setActiveTab('ai');
                                    }}
                                    className="px-2.5 py-1 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  >
                                    Ask AI
                                  </button>
                                  {!alert.acknowledged ? (
                                    <button
                                      type="button"
                                      onClick={() => handleAcknowledgeAlert(alert.id)}
                                      className="px-2.5 py-1 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    >
                                      {t.acknowledge}
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-slate-400">
                                      {t.acknowledged}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleResolveAlert(alert.id)}
                                    className="px-2.5 py-1 text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer"
                                  >
                                    {t.resolve}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'analytics' && (
              <AnalyticsView
                dashboard={dashboard}
                boilers={boilers}
                selectedBoiler={selectedBoiler}
                onRefreshState={refreshState}
                t={t}
              />
            )}

            {activeTab === 'maintenance' && (
              <MaintenanceView
                boilers={boilers}
                records={maintenanceRecords}
                onAddRecord={handleAddMaintenance}
                onUpdateStatus={handleUpdateMaintenanceStatus}
                t={t}
              />
            )}

            {activeTab === 'iot' && (
              <IotDatabaseView
                selectedBoiler={selectedBoiler}
                onInjectPacket={handleInjectSensorPacket}
                onRefreshState={refreshState}
              />
            )}

            {activeTab === 'ai' && (
              <AiAssistantView
                dashboard={dashboard}
                selectedBoiler={selectedBoiler}
                language={lang}
                initialPrompt={pendingAiPrompt}
                onConsumeInitialPrompt={() => setPendingAiPrompt(null)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
