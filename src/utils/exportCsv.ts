import type { PlantDashboardState } from '../types/boiler';

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCsvCell(val: string | number): string {
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function downloadTelemetryCsvReport(
  dashboard: PlantDashboardState | null,
  boilerId?: string
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const defaultFilename = boilerId
    ? `boiler-telemetry-${boilerId.toLowerCase()}-${today}.csv`
    : `boiler-telemetry-report-${today}.csv`;

  const query = boilerId ? `?boilerId=${encodeURIComponent(boilerId)}` : '';

  try {
    const res = await fetch(`/api/export/csv${query}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csvText = await res.text();
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    triggerBlobDownload(blob, defaultFilename);
    return;
  } catch {
    // Client-side fallback using live in-memory state if server fetch is interrupted
    if (!dashboard) throw new Error('No boiler telemetry data available to export.');
    const targetBoilers = boilerId
      ? dashboard.boilers.filter((b) => b.id === boilerId)
      : dashboard.boilers;

    const lines: string[] = [];
    const nowIso = new Date().toISOString();
    lines.push('SECTION: BOILER FLEET CURRENT STATUS SUMMARY');
    lines.push(
      [
        'Boiler ID',
        'Unit Name',
        'Location',
        'Status',
        'Maintenance Status',
        'Temperature (C)',
        'Steam Pressure (bar)',
        'Water Level (%)',
        'Fuel Consumption (L/hr)',
        'Daily Fuel Total (L)',
        'Steam Output (kg/hr)',
        'Efficiency (%)',
        'Operating Hours (hrs)',
        'Hours Since Service (hrs)',
        'Next Inspection Date',
        'Snapshot Timestamp',
      ]
        .map(escapeCsvCell)
        .join(',')
    );

    for (const b of targetBoilers) {
      lines.push(
        [
          b.id,
          b.name,
          b.location,
          b.status,
          b.maintenanceStatus,
          b.temperatureC.toFixed(1),
          b.pressureBar.toFixed(2),
          b.waterLevelPct.toFixed(1),
          b.fuelConsumptionLph.toFixed(1),
          b.dailyFuelTotalL.toFixed(1),
          b.steamOutputKgHr.toFixed(0),
          b.efficiencyPct.toFixed(1),
          b.operatingHoursTotal.toFixed(2),
          b.hoursSinceLastService.toFixed(1),
          b.nextInspectionDate,
          nowIso,
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }

    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerBlobDownload(blob, defaultFilename);
  }
}

export function downloadSampleTelemetryCsv(boilerId = 'BLR-01'): void {
  const now = Date.now();
  const rows = [
    'boilerId,timestamp,temperatureC,pressureBar,waterLevelPct,fuelConsumptionLph',
    `${boilerId},${new Date(now - 120_000).toISOString()},184.8,10.82,67.4,142.1`,
    `${boilerId},${new Date(now - 60_000).toISOString()},185.6,10.90,66.9,143.4`,
    `${boilerId},${new Date(now).toISOString()},186.2,10.95,66.2,144.8`,
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + rows], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, `sample-boiler-telemetry-${boilerId.toLowerCase()}.csv`);
}

export async function downloadAttachmentFile(attachmentId: string, filename: string): Promise<void> {
  const res = await fetch(`/api/uploads/${encodeURIComponent(attachmentId)}`);
  if (!res.ok) {
    throw new Error('Failed to download attachment');
  }
  const blob = await res.blob();
  triggerBlobDownload(blob, filename);
}
