export type BoilerStatus = 'nominal' | 'warning' | 'critical' | 'standby' | 'maintenance';

export type MaintenanceStatus =
  | 'operational'
  | 'inspection_due'
  | 'attention_required'
  | 'under_maintenance';

export type LoadMode = 'eco' | 'normal' | 'peak';

export type FaultScenario = 'none' | 'high_temp_drift' | 'low_water_alert' | 'pressure_surge';

export interface TelemetryPoint {
  timestamp: string;
  temperatureC: number;
  pressureBar: number;
  waterLevelPct: number;
  fuelConsumptionLph: number;
  efficiencyPct: number;
  steamOutputKgHr: number;
}

export interface SensorChannel {
  id: string;
  name: string;
  protocol: string;
  value: number;
  unit: string;
  signalQualityPct: number;
  lastCalibrated: string;
  status: 'online' | 'drifting' | 'fault';
}

export interface BoilerUnit {
  id: string;
  name: string;
  location: string;
  model: string;
  fuelType: 'Natural Gas' | 'Heavy Fuel Oil' | 'Diesel';
  ratedCapacityKgHr: number;
  status: BoilerStatus;
  maintenanceStatus: MaintenanceStatus;
  isRunning: boolean;
  loadMode: LoadMode;
  targetPressureBar: number;
  faultScenario: FaultScenario;
  temperatureC: number;
  tempDeltaPerMin: number;
  pressureBar: number;
  waterLevelPct: number;
  feedwaterPumpActive: boolean;
  burnerFiringPct: number;
  fuelConsumptionLph: number;
  dailyFuelTotalL: number;
  steamOutputKgHr: number;
  efficiencyPct: number;
  operatingHoursTotal: number;
  hoursSinceLastService: number;
  serviceIntervalHours: number;
  currentRunHours: number;
  lastInspectionDate: string;
  nextInspectionDate: string;
  sensors: SensorChannel[];
  history: TelemetryPoint[];
}

export interface AlertEvent {
  id: string;
  boilerId: string;
  boilerName: string;
  severity: 'warning' | 'critical' | 'info';
  parameter: 'temperature' | 'pressure' | 'water_level' | 'fuel' | 'maintenance' | 'sensor';
  message: string;
  valueDisplay: string;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
}

export interface MaintenanceAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface MaintenanceRecord {
  id: string;
  boilerId: string;
  boilerName: string;
  taskTitle: string;
  category: 'Preventive' | 'Calibration' | 'Inspection' | 'Repair';
  technician: string;
  scheduledDate: string;
  completedDate: string | null;
  dueAtHours: number;
  status: 'completed' | 'scheduled' | 'overdue' | 'in_progress';
  notes: string;
  attachment?: MaintenanceAttachment | null;
}

export interface PlantDashboardState {
  boilers: BoilerUnit[];
  alerts: AlertEvent[];
  maintenanceRecords: MaintenanceRecord[];
  serverTime: string;
}
