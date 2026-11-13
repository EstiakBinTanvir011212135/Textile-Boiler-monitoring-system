import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  AlertEvent,
  BoilerUnit,
  MaintenanceRecord,
  PlantDashboardState,
} from '../types/boiler';

function formatStatus(status: BoilerUnit['status']): string {
  switch (status) {
    case 'nominal':
      return 'NOMINAL';
    case 'warning':
      return 'WARNING';
    case 'critical':
      return 'CRITICAL';
    case 'standby':
      return 'STANDBY';
    case 'maintenance':
      return 'MAINTENANCE';
  }
}

function formatMaintStatus(status: BoilerUnit['maintenanceStatus']): string {
  switch (status) {
    case 'operational':
      return 'Operational';
    case 'inspection_due':
      return 'Inspection Due';
    case 'attention_required':
      return 'Attention Required';
    case 'under_maintenance':
      return 'Under Maintenance';
  }
}

export function exportCompliancePdf(
  dashboard: PlantDashboardState,
  selectedBoiler: BoilerUnit
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const now = new Date();
  const docRef = `TG-CMP-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(
    now.getHours()
  ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  // Top Header Band
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('ThermoGrid Industrial Boiler Compliance Report', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `Plant Status & Telemetry Audit Summary  |  Ref: ${docRef}`,
    margin,
    19
  );
  doc.text(
    `Generated: ${now.toLocaleString()}`,
    pageWidth - margin,
    19,
    { align: 'right' }
  );

  let cursorY = 36;

  // Section 1: Fleet Status Overview
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. Plant Boiler Fleet Status Summary', margin, cursorY);
  cursorY += 3;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    head: [
      [
        'Unit ID',
        'Boiler Name',
        'State',
        'Temp (°C)',
        'Pressure',
        'Water (%)',
        'Fuel (L/hr)',
        'Op. Hours',
        'Maintenance',
      ],
    ],
    body: dashboard.boilers.map((b) => [
      b.id,
      b.name,
      formatStatus(b.status),
      b.temperatureC.toFixed(1),
      `${b.pressureBar.toFixed(2)} bar`,
      `${b.waterLevelPct.toFixed(1)}%`,
      b.fuelConsumptionLph.toFixed(1),
      `${b.operatingHoursTotal.toFixed(1)} h`,
      formatMaintStatus(b.maintenanceStatus),
    ]),
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;

  // Section 2: Focus Unit Detailed Telemetry & Inspection Profile
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `2. Focus Unit Profile: ${selectedBoiler.id} — ${selectedBoiler.name}`,
    margin,
    cursorY
  );
  cursorY += 3;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38, textColor: [71, 85, 105] },
      1: { cellWidth: 52 },
      2: { fontStyle: 'bold', cellWidth: 40, textColor: [71, 85, 105] },
      3: { cellWidth: 52 },
    },
    body: [
      [
        'Location',
        selectedBoiler.location,
        'Model / Capacity',
        `${selectedBoiler.model} (${selectedBoiler.ratedCapacityKgHr.toLocaleString()} kg/h)`,
      ],
      [
        'Fuel Type',
        selectedBoiler.fuelType,
        'Firing Mode / Rate',
        `${selectedBoiler.loadMode.toUpperCase()} (${selectedBoiler.burnerFiringPct}%)`,
      ],
      [
        'Target Pressure',
        `${selectedBoiler.targetPressureBar.toFixed(1)} bar (${(
          selectedBoiler.targetPressureBar * 14.5038
        ).toFixed(0)} psi)`,
        'Steam Output / Eff.',
        `${selectedBoiler.steamOutputKgHr.toLocaleString()} kg/h (${selectedBoiler.efficiencyPct.toFixed(1)}%)`,
      ],
      [
        'Daily Fuel Total',
        `${selectedBoiler.dailyFuelTotalL.toFixed(1)} L`,
        'Feedwater Pump',
        selectedBoiler.feedwaterPumpActive ? 'Active (Replenishing)' : 'Idle',
      ],
      [
        'Hours Since Service',
        `${selectedBoiler.hoursSinceLastService.toFixed(1)} / ${selectedBoiler.serviceIntervalHours} hrs`,
        'Last / Next Inspection',
        `${selectedBoiler.lastInspectionDate} / ${selectedBoiler.nextInspectionDate}`,
      ],
    ],
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  // Section 3: Connected IoT Sensor Calibration Snapshot
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('3. Connected IoT Sensor Channels', margin, cursorY);
  cursorY += 3;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: 255,
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    head: [['Channel ID', 'Sensor Hardware', 'Protocol', 'Reading', 'Signal Quality', 'Last Calibrated', 'State']],
    body: selectedBoiler.sensors.map((s) => [
      s.id,
      s.name,
      s.protocol,
      `${s.value.toFixed(s.unit === 'bar' ? 2 : 1)} ${s.unit}`,
      `${s.signalQualityPct.toFixed(1)}%`,
      s.lastCalibrated,
      s.status.toUpperCase(),
    ]),
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Section 4: Recent Telemetry Samples
  const recentHistory = selectedBoiler.history.slice(-8).reverse();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(`4. Recent Telemetry Log (${selectedBoiler.id}, Latest 8 Intervals)`, margin, cursorY);
  cursorY += 3;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: 255,
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    head: [['Time', 'Temp (°C)', 'Pressure (bar)', 'Water (%)', 'Fuel (L/hr)', 'Steam (kg/hr)', 'Efficiency (%)']],
    body: recentHistory.map((pt) => [
      new Date(pt.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      pt.temperatureC.toFixed(1),
      pt.pressureBar.toFixed(2),
      pt.waterLevelPct.toFixed(1),
      pt.fuelConsumptionLph.toFixed(1),
      pt.steamOutputKgHr.toLocaleString(),
      pt.efficiencyPct.toFixed(1),
    ]),
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Section 5: Alerts & Maintenance Records
  const recentAlerts: AlertEvent[] = dashboard.alerts.slice(0, 8);
  const maintRecords: MaintenanceRecord[] = dashboard.maintenanceRecords.slice(0, 8);

  if (cursorY > pageHeight - 55) {
    doc.addPage();
    cursorY = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('5. Safety Alerts & Alarm Compliance Log', margin, cursorY);
  cursorY += 3;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.8 },
    head: [['Alert ID', 'Unit', 'Severity', 'Reading', 'Message', 'Disposition']],
    body:
      recentAlerts.length > 0
        ? recentAlerts.map((a) => [
            a.id,
            a.boilerId,
            a.severity.toUpperCase(),
            a.valueDisplay,
            a.message,
            a.resolved ? 'Resolved' : a.acknowledged ? 'Acknowledged' : 'Active / Open',
          ])
        : [['—', 'ALL', 'INFO', '—', 'No safety alarms recorded during this reporting window.', 'Nominal']],
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (cursorY > pageHeight - 55) {
    doc.addPage();
    cursorY = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('6. Maintenance & Inspection Audit Trail', margin, cursorY);
  cursorY += 3;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.8 },
    head: [['Record ID', 'Unit', 'Task Description', 'Technician', 'Date', 'Status']],
    body: maintRecords.map((m) => [
      m.id,
      m.boilerId,
      m.taskTitle,
      m.technician,
      m.completedDate ?? m.scheduledDate,
      m.status.replace('_', ' ').toUpperCase(),
    ]),
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  // Compliance Sign-Off Block
  if (cursorY > pageHeight - 32) {
    doc.addPage();
    cursorY = 24;
  }

  doc.setDrawColor(148, 163, 184);
  doc.line(margin, cursorY, margin + 72, cursorY);
  doc.line(pageWidth - margin - 72, cursorY, pageWidth - margin, cursorY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Boiler Chief Engineer / Shift Supervisor', margin, cursorY + 4.5);
  doc.text('Plant Operations Management Approval', pageWidth - margin - 72, cursorY + 4.5);

  // Page numbering footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `ThermoGrid Compliance Record  ·  ${docRef}`,
      margin,
      pageHeight - 8
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  const fileName = `boiler-compliance-report-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
