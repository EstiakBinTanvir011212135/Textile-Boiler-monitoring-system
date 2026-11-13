export type Language = 'en' | 'bn';

export interface Translations {
  brand: string;
  navOverview: string;
  navAnalytics: string;
  navMaintenance: string;
  navIot: string;
  navAi: string;
  exportCsv: string;
  exportPdf: string;
  liveStream: string;
  pausedStream: string;
  connectingStream: string;
  pause: string;
  resume: string;
  // Core 6 metrics
  boilerTemperature: string;
  steamPressure: string;
  waterLevel: string;
  fuelConsumption: string;
  operatingHours: string;
  maintenanceStatus: string;
  // Sublabels & units
  safeRange: string;
  target: string;
  dailyTotal: string;
  sinceService: string;
  currentRun: string;
  nextInspection: string;
  lastInspection: string;
  pumpActive: string;
  pumpIdle: string;
  // Statuses
  statusNominal: string;
  statusWarning: string;
  statusCritical: string;
  statusStandby: string;
  statusMaintenance: string;
  maintOperational: string;
  maintInspectionDue: string;
  maintAttentionRequired: string;
  maintUnderMaintenance: string;
  // Controls
  unitControls: string;
  boilerPower: string;
  startBoiler: string;
  stopBoiler: string;
  loadMode: string;
  targetPressure: string;
  faultSimulation: string;
  faultNone: string;
  faultHighTemp: string;
  faultLowWater: string;
  faultPressureSurge: string;
  // Sections
  liveTelemetryChart: string;
  boilerCrossSection: string;
  fleetComparison: string;
  activeAlerts: string;
  acknowledge: string;
  resolve: string;
  acknowledged: string;
  noActiveAlerts: string;
  steamOutput: string;
  thermalEfficiency: string;
  firingRate: string;
}

export const TRANSLATIONS: Record<Language, Translations> = {
  en: {
    brand: 'ThermoGrid',
    navOverview: 'Overview',
    navAnalytics: 'Analytics',
    navMaintenance: 'Maintenance',
    navIot: 'IoT & MySQL',
    navAi: 'Plant AI',
    exportCsv: 'Export CSV',
    exportPdf: 'Export PDF',
    liveStream: 'Live Stream · 1.5s',
    pausedStream: 'Stream Paused',
    connectingStream: 'Connecting...',
    pause: 'Pause',
    resume: 'Resume',
    boilerTemperature: 'Boiler Temperature',
    steamPressure: 'Steam Pressure',
    waterLevel: 'Water Level',
    fuelConsumption: 'Fuel Consumption',
    operatingHours: 'Operating Hours',
    maintenanceStatus: 'Maintenance Status',
    safeRange: 'Safe band',
    target: 'Target',
    dailyTotal: 'Today total',
    sinceService: 'Since service',
    currentRun: 'Current run',
    nextInspection: 'Next service',
    lastInspection: 'Last check',
    pumpActive: 'Feed pump active',
    pumpIdle: 'Feed pump idle',
    statusNominal: 'Nominal',
    statusWarning: 'Warning',
    statusCritical: 'Critical',
    statusStandby: 'Standby',
    statusMaintenance: 'Maintenance',
    maintOperational: 'Operational',
    maintInspectionDue: 'Inspection Due',
    maintAttentionRequired: 'Attention Required',
    maintUnderMaintenance: 'Under Maintenance',
    unitControls: 'Operational Controls',
    boilerPower: 'Unit State',
    startBoiler: 'Start Boiler',
    stopBoiler: 'Set Standby',
    loadMode: 'Firing Mode',
    targetPressure: 'Target Steam Pressure',
    faultSimulation: 'Safety Test / Fault Injection',
    faultNone: 'Normal Operation',
    faultHighTemp: 'High Temp Drift',
    faultLowWater: 'Low Water Alert',
    faultPressureSurge: 'Pressure Surge',
    liveTelemetryChart: 'Live Sensor Telemetry',
    boilerCrossSection: 'Boiler Drum & Burner Schematic',
    fleetComparison: 'Plant Boiler Fleet Overview',
    activeAlerts: 'Active Alerts & Alarms',
    acknowledge: 'Acknowledge',
    resolve: 'Resolve',
    acknowledged: 'Acknowledged',
    noActiveAlerts: 'All boiler systems operating within safe thresholds.',
    steamOutput: 'Steam Output',
    thermalEfficiency: 'Thermal Efficiency',
    firingRate: 'Burner Firing',
  },
  bn: {
    brand: 'ThermoGrid',
    navOverview: 'ওভারভিউ',
    navAnalytics: 'বিশ্লেষণ',
    navMaintenance: 'রক্ষণাবেক্ষণ',
    navIot: 'IoT ও ডাটাবেস',
    navAi: 'প্ল্যান্ট AI',
    exportCsv: 'CSV ডাউনলোড',
    exportPdf: 'PDF রিপোর্ট',
    liveStream: 'লাইভ ডাটা · ১.৫সে',
    pausedStream: 'বিরতি',
    connectingStream: 'সংযুক্ত হচ্ছে...',
    pause: 'থামান',
    resume: 'চালু করুন',
    boilerTemperature: 'বয়লার তাপমাত্রা',
    steamPressure: 'স্টিম চাপ',
    waterLevel: 'পানির স্তর',
    fuelConsumption: 'জ্বালানি ব্যবহার',
    operatingHours: 'চালু থাকার সময়',
    maintenanceStatus: 'রক্ষণাবেক্ষণ অবস্থা',
    safeRange: 'নিরাপদ সীমা',
    target: 'লক্ষ্যমাত্রা',
    dailyTotal: 'আজকের মোট',
    sinceService: 'সার্ভিসের পর',
    currentRun: 'চলমান সময়',
    nextInspection: 'পরবর্তী সার্ভিস',
    lastInspection: 'শেষ পরীক্ষা',
    pumpActive: 'ফিড পাম্প চালু',
    pumpIdle: 'ফিড পাম্প বন্ধ',
    statusNominal: 'স্বাভাবিক',
    statusWarning: 'সতর্কতা',
    statusCritical: 'জরুরি',
    statusStandby: 'স্ট্যান্ডবাই',
    statusMaintenance: 'মেরামতাধীন',
    maintOperational: 'সচল ও নিরাপদ',
    maintInspectionDue: 'পরীক্ষা প্রয়োজন',
    maintAttentionRequired: 'জরুরি সার্ভিস',
    maintUnderMaintenance: 'মেরামত চলছে',
    unitControls: 'অপারেশনাল কন্ট্রোল',
    boilerPower: 'ইউনিট অবস্থা',
    startBoiler: 'বয়লার চালু করুন',
    stopBoiler: 'স্ট্যান্ডবাই করুন',
    loadMode: 'বার্নার মোড',
    targetPressure: 'লক্ষ্য স্টিম চাপ',
    faultSimulation: 'নিরাপত্তা টেস্ট / ফল্ট সিমুলেশন',
    faultNone: 'স্বাভাবিক অপারেশন',
    faultHighTemp: 'অতিরিক্ত তাপমাত্রা',
    faultLowWater: 'পানি কমে যাওয়া',
    faultPressureSurge: 'অতিরিক্ত চাপ',
    liveTelemetryChart: 'লাইভ সেন্সর টেলিমেট্রি',
    boilerCrossSection: 'বয়লার ড্রাম ও বার্নার ডায়াগ্রাম',
    fleetComparison: 'প্ল্যান্ট বয়লার তালিকা',
    activeAlerts: 'সতর্কবার্তা ও অ্যালার্ম',
    acknowledge: 'নিশ্চিত করুন',
    resolve: 'সমাধান',
    acknowledged: 'নিশ্চিতকৃত',
    noActiveAlerts: 'সব বয়লার নিরাপদ সীমার মধ্যে সচল রয়েছে।',
    steamOutput: 'স্টিম উৎপাদন',
    thermalEfficiency: 'তাপীয় দক্ষতা',
    firingRate: 'বার্নার লোড',
  },
};
