import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import type {
  AlertEvent,
  BoilerUnit,
  FaultScenario,
  LoadMode,
  MaintenanceAttachment,
  MaintenanceRecord,
  MaintenanceStatus,
  PlantDashboardState,
  TelemetryPoint,
} from './src/types/boiler.ts';

function getAiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const STATE_FILE = path.join(DATA_DIR, 'boiler_state.json');

interface PersistedState {
  boilers: BoilerUnit[];
  alerts: AlertEvent[];
  maintenanceRecords: MaintenanceRecord[];
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function round(val: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

function generateInitialHistory(
  baseTemp: number,
  basePressure: number,
  baseWater: number,
  baseFuel: number,
  isRunning: boolean
): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  const now = Date.now();
  for (let i = 47; i >= 0; i--) {
    const t = new Date(now - i * 90_000).toISOString();
    const wave = Math.sin(i * 0.35) * 0.8 + Math.cos(i * 0.17) * 0.5;
    const temp = isRunning ? baseTemp + wave * 1.6 : baseTemp + wave * 0.4;
    const pressure = isRunning ? basePressure + wave * 0.18 : basePressure + wave * 0.03;
    const water = clamp(baseWater - Math.sin(i * 0.28) * 3.5, 25, 92);
    const fuel = isRunning ? Math.max(12, baseFuel + wave * 5.2) : 0;
    const efficiency = isRunning ? clamp(88.4 + Math.cos(i * 0.2) * 1.1, 78, 94) : 0;
    const steam = isRunning ? Math.max(0, fuel * 26.5) : 0;
    points.push({
      timestamp: t,
      temperatureC: round(temp, 1),
      pressureBar: round(pressure, 2),
      waterLevelPct: round(water, 1),
      fuelConsumptionLph: round(fuel, 1),
      efficiencyPct: round(efficiency, 1),
      steamOutputKgHr: round(steam, 0),
    });
  }
  return points;
}

function createSeedState(): PersistedState {
  const nowIso = new Date().toISOString();

  const boilers: BoilerUnit[] = [
    {
      id: 'BLR-01',
      name: 'Main Steam Unit 01',
      location: 'Utility Bay A · Ground Floor',
      model: 'Cleaver-Brooks CBEX 6000',
      fuelType: 'Natural Gas',
      ratedCapacityKgHr: 6000,
      status: 'nominal',
      maintenanceStatus: 'operational',
      isRunning: true,
      loadMode: 'normal',
      targetPressureBar: 10.8,
      faultScenario: 'none',
      temperatureC: 184.4,
      tempDeltaPerMin: 0.2,
      pressureBar: 10.82,
      waterLevelPct: 68.4,
      feedwaterPumpActive: false,
      burnerFiringPct: 72,
      fuelConsumptionLph: 142.8,
      dailyFuelTotalL: 1842.6,
      steamOutputKgHr: 3784,
      efficiencyPct: 89.2,
      operatingHoursTotal: 4218.5,
      hoursSinceLastService: 184.5,
      serviceIntervalHours: 500,
      currentRunHours: 18.7,
      lastInspectionDate: '2026-10-18',
      nextInspectionDate: '2026-12-02',
      sensors: [
        {
          id: 'SENS-01-T',
          name: 'PT-100 Drum Thermocouple',
          protocol: 'Modbus RTU · Ch1',
          value: 184.4,
          unit: '°C',
          signalQualityPct: 99.6,
          lastCalibrated: '2026-10-18',
          status: 'online',
        },
        {
          id: 'SENS-01-P',
          name: 'Rosemount Header Transducer',
          protocol: '4-20mA Loop · Ch2',
          value: 10.82,
          unit: 'bar',
          signalQualityPct: 99.8,
          lastCalibrated: '2026-10-18',
          status: 'online',
        },
        {
          id: 'SENS-01-W',
          name: 'Guided-Wave Level Probe',
          protocol: 'Modbus RTU · Ch3',
          value: 68.4,
          unit: '%',
          signalQualityPct: 98.9,
          lastCalibrated: '2026-10-18',
          status: 'online',
        },
        {
          id: 'SENS-01-F',
          name: 'Coriolis Fuel Mass Meter',
          protocol: 'Pulse / MQTT · Ch4',
          value: 142.8,
          unit: 'L/hr',
          signalQualityPct: 99.4,
          lastCalibrated: '2026-10-05',
          status: 'online',
        },
      ],
      history: generateInitialHistory(184.4, 10.82, 68.4, 142.8, true),
    },
    {
      id: 'BLR-02',
      name: 'Process Heat Unit 02',
      location: 'Dyeing & Finishing Wing · Bay B',
      model: 'Bosch Universal UL-S 4500',
      fuelType: 'Diesel',
      ratedCapacityKgHr: 4500,
      status: 'warning',
      maintenanceStatus: 'inspection_due',
      isRunning: true,
      loadMode: 'eco',
      targetPressureBar: 9.5,
      faultScenario: 'none',
      temperatureC: 178.1,
      tempDeltaPerMin: -0.1,
      pressureBar: 9.54,
      waterLevelPct: 61.8,
      feedwaterPumpActive: true,
      burnerFiringPct: 61,
      fuelConsumptionLph: 108.4,
      dailyFuelTotalL: 1390.2,
      steamOutputKgHr: 2860,
      efficiencyPct: 86.7,
      operatingHoursTotal: 6472.0,
      hoursSinceLastService: 472.0,
      serviceIntervalHours: 500,
      currentRunHours: 14.2,
      lastInspectionDate: '2026-08-29',
      nextInspectionDate: '2026-11-16',
      sensors: [
        {
          id: 'SENS-02-T',
          name: 'PT-100 Flue & Drum Sensor',
          protocol: 'Modbus RTU · Ch1',
          value: 178.1,
          unit: '°C',
          signalQualityPct: 97.4,
          lastCalibrated: '2026-08-29',
          status: 'online',
        },
        {
          id: 'SENS-02-P',
          name: 'Siemens Steam Pressure Gauge',
          protocol: '4-20mA Loop · Ch2',
          value: 9.54,
          unit: 'bar',
          signalQualityPct: 98.1,
          lastCalibrated: '2026-08-29',
          status: 'online',
        },
        {
          id: 'SENS-02-W',
          name: 'Differential Water Column',
          protocol: 'Modbus RTU · Ch3',
          value: 61.8,
          unit: '%',
          signalQualityPct: 96.5,
          lastCalibrated: '2026-08-29',
          status: 'online',
        },
        {
          id: 'SENS-02-F',
          name: 'Positive Displacement Flow',
          protocol: 'Pulse / MQTT · Ch4',
          value: 108.4,
          unit: 'L/hr',
          signalQualityPct: 97.9,
          lastCalibrated: '2026-08-29',
          status: 'online',
        },
      ],
      history: generateInitialHistory(178.1, 9.54, 61.8, 108.4, true),
    },
    {
      id: 'BLR-03',
      name: 'Auxiliary Standby Unit 03',
      location: 'Utility Bay A · East Reserve',
      model: 'Thermax Revomax 3000',
      fuelType: 'Natural Gas',
      ratedCapacityKgHr: 3000,
      status: 'standby',
      maintenanceStatus: 'operational',
      isRunning: false,
      loadMode: 'eco',
      targetPressureBar: 8.5,
      faultScenario: 'none',
      temperatureC: 64.2,
      tempDeltaPerMin: 0.0,
      pressureBar: 1.15,
      waterLevelPct: 74.5,
      feedwaterPumpActive: false,
      burnerFiringPct: 0,
      fuelConsumptionLph: 0,
      dailyFuelTotalL: 214.0,
      steamOutputKgHr: 0,
      efficiencyPct: 0,
      operatingHoursTotal: 1940.2,
      hoursSinceLastService: 92.0,
      serviceIntervalHours: 500,
      currentRunHours: 0,
      lastInspectionDate: '2026-10-30',
      nextInspectionDate: '2027-01-12',
      sensors: [
        {
          id: 'SENS-03-T',
          name: 'PT-100 Drum Thermocouple',
          protocol: 'Modbus RTU · Ch1',
          value: 64.2,
          unit: '°C',
          signalQualityPct: 99.9,
          lastCalibrated: '2026-10-30',
          status: 'online',
        },
        {
          id: 'SENS-03-P',
          name: 'Header Pressure Transmitter',
          protocol: '4-20mA Loop · Ch2',
          value: 1.15,
          unit: 'bar',
          signalQualityPct: 99.5,
          lastCalibrated: '2026-10-30',
          status: 'online',
        },
        {
          id: 'SENS-03-W',
          name: 'Capacitive Level Probe',
          protocol: 'Modbus RTU · Ch3',
          value: 74.5,
          unit: '%',
          signalQualityPct: 99.2,
          lastCalibrated: '2026-10-30',
          status: 'online',
        },
        {
          id: 'SENS-03-F',
          name: 'Gas Mass Flow Sensor',
          protocol: 'Pulse / MQTT · Ch4',
          value: 0,
          unit: 'L/hr',
          signalQualityPct: 99.7,
          lastCalibrated: '2026-10-30',
          status: 'online',
        },
      ],
      history: generateInitialHistory(64.2, 1.15, 74.5, 0, false),
    },
  ];

  const alerts: AlertEvent[] = [
    {
      id: 'ALT-1042',
      boilerId: 'BLR-02',
      boilerName: 'Process Heat Unit 02',
      severity: 'warning',
      parameter: 'maintenance',
      message: '500-hour preventive burner & safety valve inspection due within 28 operating hours.',
      valueDisplay: '472 / 500 hrs',
      timestamp: nowIso,
      acknowledged: false,
      resolved: false,
    },
    {
      id: 'ALT-1041',
      boilerId: 'BLR-01',
      boilerName: 'Main Steam Unit 01',
      severity: 'info',
      parameter: 'water_level',
      message: 'Automatic feedwater replenishment cycle completed smoothly.',
      valueDisplay: '68.4 %',
      timestamp: new Date(Date.now() - 22 * 60_000).toISOString(),
      acknowledged: true,
      resolved: true,
    },
  ];

  const maintenanceRecords: MaintenanceRecord[] = [
    {
      id: 'MNT-201',
      boilerId: 'BLR-02',
      boilerName: 'Process Heat Unit 02',
      taskTitle: 'Burner Nozzle Cleaning & Flue Gas Calibration',
      category: 'Preventive',
      technician: 'Engr. Tariqul Islam',
      scheduledDate: '2026-11-16',
      completedDate: null,
      dueAtHours: 6500,
      status: 'scheduled',
      notes: 'Due at 6,500 operating hrs. Inspect diesel atomizer and O2 trim sensor.',
    },
    {
      id: 'MNT-202',
      boilerId: 'BLR-01',
      boilerName: 'Main Steam Unit 01',
      taskTitle: 'Bottom Blowdown Valve & TDS Probe Check',
      category: 'Inspection',
      technician: 'Engr. Farhan Chowdhury',
      scheduledDate: '2026-12-02',
      completedDate: null,
      dueAtHours: 4534,
      status: 'scheduled',
      notes: 'Routine quarterly blowdown valve seat verification and conductivity test.',
    },
    {
      id: 'MNT-203',
      boilerId: 'BLR-03',
      boilerName: 'Auxiliary Standby Unit 03',
      taskTitle: 'Safety Relief Valve Hydrostatic Verification',
      category: 'Calibration',
      technician: 'Engr. Nusrat Jahan',
      scheduledDate: '2026-10-30',
      completedDate: '2026-10-30',
      dueAtHours: 1900,
      status: 'completed',
      notes: 'Pop test certified at 13.2 bar. Lead seal replaced and logged.',
    },
    {
      id: 'MNT-204',
      boilerId: 'BLR-01',
      boilerName: 'Main Steam Unit 01',
      taskTitle: '500-Hour Full Refractory & Gasket Audit',
      category: 'Preventive',
      technician: 'Engr. Tariqul Islam',
      scheduledDate: '2026-10-18',
      completedDate: '2026-10-18',
      dueAtHours: 4034,
      status: 'completed',
      notes: 'All fire-tube seals intact. Thermal efficiency measured at 89.4%.',
    },
  ];

  return { boilers, alerts, maintenanceRecords };
}

function loadOrInitState(): PersistedState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedState;
      if (Array.isArray(parsed.boilers) && parsed.boilers.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read persisted state, seeding fresh data:', err);
  }
  const seeded = createSeedState();
  saveState(seeded);
  return seeded;
}

function saveState(state: PersistedState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist boiler state:', err);
  }
}

const state: PersistedState = loadOrInitState();
const sseClients = new Set<express.Response>();

function maybeCreateAlert(
  boiler: BoilerUnit,
  severity: AlertEvent['severity'],
  parameter: AlertEvent['parameter'],
  message: string,
  valueDisplay: string
): void {
  const existing = state.alerts.find(
    (a) => a.boilerId === boiler.id && a.parameter === parameter && !a.resolved
  );
  if (existing) {
    existing.valueDisplay = valueDisplay;
    existing.severity = severity;
    existing.message = message;
    return;
  }
  const newAlert: AlertEvent = {
    id: `ALT-${Math.floor(1050 + Math.random() * 8900)}`,
    boilerId: boiler.id,
    boilerName: boiler.name,
    severity,
    parameter,
    message,
    valueDisplay,
    timestamp: new Date().toISOString(),
    acknowledged: false,
    resolved: false,
  };
  state.alerts.unshift(newAlert);
  if (state.alerts.length > 40) {
    state.alerts = state.alerts.slice(0, 40);
  }
}

function evaluateBoilerHealth(boiler: BoilerUnit): void {
  if (boiler.maintenanceStatus === 'under_maintenance') {
    boiler.status = 'maintenance';
    return;
  }
  if (!boiler.isRunning) {
    boiler.status = 'standby';
    return;
  }

  let hasCritical = false;
  let hasWarning = false;

  // Temperature thresholds
  if (boiler.temperatureC >= 202) {
    hasCritical = true;
    maybeCreateAlert(
      boiler,
      'critical',
      'temperature',
      'Drum temperature exceeded critical safety limit (202 °C). Immediate load reduction required.',
      `${boiler.temperatureC.toFixed(1)} °C`
    );
  } else if (boiler.temperatureC >= 195) {
    hasWarning = true;
    maybeCreateAlert(
      boiler,
      'warning',
      'temperature',
      'Boiler temperature drifting above nominal operating band (195 °C).',
      `${boiler.temperatureC.toFixed(1)} °C`
    );
  }

  // Pressure thresholds
  if (boiler.pressureBar >= 12.6) {
    hasCritical = true;
    maybeCreateAlert(
      boiler,
      'critical',
      'pressure',
      'Steam header pressure approaching safety relief threshold (12.6 bar).',
      `${boiler.pressureBar.toFixed(2)} bar`
    );
  } else if (boiler.pressureBar >= 11.9) {
    hasWarning = true;
    maybeCreateAlert(
      boiler,
      'warning',
      'pressure',
      'Steam pressure elevated above target band.',
      `${boiler.pressureBar.toFixed(2)} bar`
    );
  }

  // Water level thresholds
  if (boiler.waterLevelPct <= 35) {
    hasCritical = true;
    maybeCreateAlert(
      boiler,
      'critical',
      'water_level',
      'Low water level cutout warning! Feedwater pump at maximum duty.',
      `${boiler.waterLevelPct.toFixed(1)} %`
    );
  } else if (boiler.waterLevelPct <= 46) {
    hasWarning = true;
    maybeCreateAlert(
      boiler,
      'warning',
      'water_level',
      'Water level below 46% setpoint; feedwater makeup active.',
      `${boiler.waterLevelPct.toFixed(1)} %`
    );
  }

  // Maintenance threshold check
  if (boiler.hoursSinceLastService >= boiler.serviceIntervalHours) {
    boiler.maintenanceStatus = 'attention_required';
    hasWarning = true;
    maybeCreateAlert(
      boiler,
      'warning',
      'maintenance',
      'Scheduled service interval exceeded. Schedule inspection promptly.',
      `${boiler.hoursSinceLastService.toFixed(1)} / ${boiler.serviceIntervalHours} hrs`
    );
  } else if (boiler.hoursSinceLastService >= boiler.serviceIntervalHours - 40) {
    if (boiler.maintenanceStatus === 'operational') {
      boiler.maintenanceStatus = 'inspection_due';
    }
    hasWarning = true;
  }

  boiler.status = hasCritical ? 'critical' : hasWarning ? 'warning' : 'nominal';
}

function stepSimulation(): void {
  const nowIso = new Date().toISOString();

  for (const boiler of state.boilers) {
    const prevTemp = boiler.temperatureC;

    if (!boiler.isRunning || boiler.maintenanceStatus === 'under_maintenance') {
      // Cool down toward warm standby 55C
      boiler.burnerFiringPct = 0;
      boiler.feedwaterPumpActive = false;
      boiler.temperatureC = round(
        boiler.temperatureC + (58 - boiler.temperatureC) * 0.04 + (Math.random() - 0.5) * 0.15,
        1
      );
      boiler.pressureBar = round(
        Math.max(0.8, boiler.pressureBar + (1.1 - boiler.pressureBar) * 0.06),
        2
      );
      boiler.fuelConsumptionLph = 0;
      boiler.steamOutputKgHr = 0;
      boiler.efficiencyPct = 0;
      boiler.currentRunHours = 0;
    } else {
      const modeMult =
        boiler.loadMode === 'peak' ? 1.18 : boiler.loadMode === 'eco' ? 0.84 : 1.0;

      // Target pressure & corresponding saturated steam temperature approximation
      let targetPressure = boiler.targetPressureBar;
      if (boiler.faultScenario === 'pressure_surge') {
        targetPressure = 12.85;
      }

      // Pressure dynamics
      const pressureNoise = (Math.random() - 0.5) * 0.08;
      boiler.pressureBar = round(
        clamp(boiler.pressureBar + (targetPressure - boiler.pressureBar) * 0.22 + pressureNoise, 1.0, 13.8),
        2
      );

      // Temperature roughly tracks pressure (saturated steam ~100 + 84 * (P/10.8)^0.26)
      let targetTemp = 104 + 79.5 * Math.pow(Math.max(boiler.pressureBar, 1) / 10.5, 0.24);
      if (boiler.faultScenario === 'high_temp_drift') {
        targetTemp = 205.5;
      }

      const tempNoise = (Math.random() - 0.5) * 0.35;
      boiler.temperatureC = round(
        clamp(boiler.temperatureC + (targetTemp - boiler.temperatureC) * 0.2 + tempNoise, 45, 220),
        1
      );

      // Water level & feedwater pump hysteresis
      if (boiler.faultScenario === 'low_water_alert') {
        boiler.feedwaterPumpActive = true;
        boiler.waterLevelPct = round(
          clamp(boiler.waterLevelPct - 1.2 + (Math.random() - 0.5) * 0.3, 28, 88),
          1
        );
      } else {
        if (boiler.waterLevelPct < 58) boiler.feedwaterPumpActive = true;
        if (boiler.waterLevelPct > 74) boiler.feedwaterPumpActive = false;

        const waterDelta = boiler.feedwaterPumpActive ? 0.65 : -0.38 * modeMult;
        boiler.waterLevelPct = round(
          clamp(boiler.waterLevelPct + waterDelta + (Math.random() - 0.5) * 0.25, 30, 88),
          1
        );
      }

      // Firing & fuel consumption
      const baseFuelForUnit = boiler.ratedCapacityKgHr / 42;
      const targetFiring = clamp(68 * modeMult + (targetPressure - boiler.pressureBar) * 14, 25, 98);
      boiler.burnerFiringPct = round(
        boiler.burnerFiringPct + (targetFiring - boiler.burnerFiringPct) * 0.3,
        0
      );
      boiler.fuelConsumptionLph = round(
        baseFuelForUnit * (boiler.burnerFiringPct / 72) + (Math.random() - 0.5) * 1.4,
        1
      );

      // Accumulate daily fuel & operating hours (1.5s tick = 1.5 / 3600 hr)
      const hrStep = 1.5 / 3600;
      boiler.dailyFuelTotalL = round(boiler.dailyFuelTotalL + boiler.fuelConsumptionLph * hrStep, 2);
      boiler.operatingHoursTotal = round(boiler.operatingHoursTotal + hrStep, 3);
      boiler.hoursSinceLastService = round(boiler.hoursSinceLastService + hrStep, 3);
      boiler.currentRunHours = round(boiler.currentRunHours + hrStep, 3);

      boiler.steamOutputKgHr = round(boiler.fuelConsumptionLph * 26.5, 0);
      const faultPenalty = boiler.faultScenario !== 'none' ? 5.2 : 0;
      boiler.efficiencyPct = round(
        clamp(89.5 - Math.abs(boiler.burnerFiringPct - 74) * 0.08 - faultPenalty + (Math.random() - 0.5) * 0.4, 72, 93.5),
        1
      );
    }

    boiler.tempDeltaPerMin = round((boiler.temperatureC - prevTemp) * 40, 2);

    // Sync live sensor channel readouts
    if (boiler.sensors[0]) {
      boiler.sensors[0].value = boiler.temperatureC;
      boiler.sensors[0].status = boiler.temperatureC > 200 ? 'drifting' : 'online';
    }
    if (boiler.sensors[1]) {
      boiler.sensors[1].value = boiler.pressureBar;
      boiler.sensors[1].status = boiler.pressureBar > 12.4 ? 'drifting' : 'online';
    }
    if (boiler.sensors[2]) {
      boiler.sensors[2].value = boiler.waterLevelPct;
      boiler.sensors[2].status = boiler.waterLevelPct < 38 ? 'fault' : 'online';
    }
    if (boiler.sensors[3]) {
      boiler.sensors[3].value = boiler.fuelConsumptionLph;
    }

    evaluateBoilerHealth(boiler);

    boiler.history.push({
      timestamp: nowIso,
      temperatureC: boiler.temperatureC,
      pressureBar: boiler.pressureBar,
      waterLevelPct: boiler.waterLevelPct,
      fuelConsumptionLph: boiler.fuelConsumptionLph,
      efficiencyPct: boiler.efficiencyPct,
      steamOutputKgHr: boiler.steamOutputKgHr,
    });
    if (boiler.history.length > 60) {
      boiler.history = boiler.history.slice(-60);
    }
  }
}

function broadcastState(): void {
  if (sseClients.size === 0) return;
  const payload: PlantDashboardState = {
    boilers: state.boilers,
    alerts: state.alerts,
    maintenanceRecords: state.maintenanceRecords,
    serverTime: new Date().toISOString(),
  };
  const encoded = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    res.write(encoded);
  }
}

let tickCounter = 0;
setInterval(() => {
  stepSimulation();
  broadcastState();
  tickCounter += 1;
  if (tickCounter % 10 === 0) {
    saveState(state);
  }
}, 1500);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  app.get('/api/state', (_req, res) => {
    const payload: PlantDashboardState = {
      boilers: state.boilers,
      alerts: state.alerts,
      maintenanceRecords: state.maintenanceRecords,
      serverTime: new Date().toISOString(),
    };
    res.json(payload);
  });

  app.get('/api/telemetry/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const initialPayload: PlantDashboardState = {
      boilers: state.boilers,
      alerts: state.alerts,
      maintenanceRecords: state.maintenanceRecords,
      serverTime: new Date().toISOString(),
    };
    res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  app.post('/api/boilers/:id/control', (req, res) => {
    const boiler = state.boilers.find((b) => b.id === req.params.id);
    if (!boiler) {
      res.status(404).json({ error: 'Boiler unit not found' });
      return;
    }

    const {
      isRunning,
      loadMode,
      targetPressureBar,
      faultScenario,
      maintenanceStatus,
    } = req.body as {
      isRunning?: boolean;
      loadMode?: LoadMode;
      targetPressureBar?: number;
      faultScenario?: FaultScenario;
      maintenanceStatus?: MaintenanceStatus;
    };

    if (typeof isRunning === 'boolean') {
      boiler.isRunning = isRunning;
      if (isRunning && boiler.maintenanceStatus === 'under_maintenance') {
        boiler.maintenanceStatus = 'operational';
      }
    }
    if (loadMode && ['eco', 'normal', 'peak'].includes(loadMode)) {
      boiler.loadMode = loadMode;
    }
    if (typeof targetPressureBar === 'number' && !Number.isNaN(targetPressureBar)) {
      boiler.targetPressureBar = round(clamp(targetPressureBar, 6.0, 12.5), 1);
    }
    if (
      faultScenario &&
      ['none', 'high_temp_drift', 'low_water_alert', 'pressure_surge'].includes(faultScenario)
    ) {
      boiler.faultScenario = faultScenario;
      if (faultScenario === 'none') {
        // Resolve active simulation-triggered alerts for this boiler
        for (const alert of state.alerts) {
          if (
            alert.boilerId === boiler.id &&
            ['temperature', 'pressure', 'water_level'].includes(alert.parameter)
          ) {
            alert.resolved = true;
            alert.acknowledged = true;
          }
        }
      }
    }
    if (
      maintenanceStatus &&
      ['operational', 'inspection_due', 'attention_required', 'under_maintenance'].includes(
        maintenanceStatus
      )
    ) {
      boiler.maintenanceStatus = maintenanceStatus;
      if (maintenanceStatus === 'under_maintenance') {
        boiler.isRunning = false;
      }
    }

    evaluateBoilerHealth(boiler);
    saveState(state);
    broadcastState();
    res.json({ boiler });
  });

  app.post('/api/sensors/ingest', (req, res) => {
    const { boilerId, temperatureC, pressureBar, waterLevelPct, fuelConsumptionLph } =
      req.body as {
        boilerId?: string;
        temperatureC?: number;
        pressureBar?: number;
        waterLevelPct?: number;
        fuelConsumptionLph?: number;
      };

    const boiler = state.boilers.find((b) => b.id === boilerId);
    if (!boiler) {
      res.status(400).json({ error: 'Invalid or missing boilerId' });
      return;
    }

    if (typeof temperatureC === 'number' && !Number.isNaN(temperatureC)) {
      boiler.temperatureC = round(clamp(temperatureC, 20, 260), 1);
    }
    if (typeof pressureBar === 'number' && !Number.isNaN(pressureBar)) {
      boiler.pressureBar = round(clamp(pressureBar, 0, 16), 2);
    }
    if (typeof waterLevelPct === 'number' && !Number.isNaN(waterLevelPct)) {
      boiler.waterLevelPct = round(clamp(waterLevelPct, 0, 100), 1);
    }
    if (typeof fuelConsumptionLph === 'number' && !Number.isNaN(fuelConsumptionLph)) {
      boiler.fuelConsumptionLph = round(clamp(fuelConsumptionLph, 0, 400), 1);
    }

    evaluateBoilerHealth(boiler);
    boiler.history.push({
      timestamp: new Date().toISOString(),
      temperatureC: boiler.temperatureC,
      pressureBar: boiler.pressureBar,
      waterLevelPct: boiler.waterLevelPct,
      fuelConsumptionLph: boiler.fuelConsumptionLph,
      efficiencyPct: boiler.efficiencyPct,
      steamOutputKgHr: boiler.steamOutputKgHr,
    });
    if (boiler.history.length > 60) {
      boiler.history = boiler.history.slice(-60);
    }

    saveState(state);
    broadcastState();
    res.json({ ok: true, boiler });
  });

  app.post('/api/alerts/:id/acknowledge', (req, res) => {
    const alert = state.alerts.find((a) => a.id === req.params.id);
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    alert.acknowledged = true;
    saveState(state);
    broadcastState();
    res.json({ alert });
  });

  app.post('/api/alerts/:id/resolve', (req, res) => {
    const alert = state.alerts.find((a) => a.id === req.params.id);
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    alert.acknowledged = true;
    alert.resolved = true;
    saveState(state);
    broadcastState();
    res.json({ alert });
  });

  app.post('/api/sensors/upload', (req, res) => {
    const { defaultBoilerId, filename, content } = req.body as {
      defaultBoilerId?: string;
      filename?: string;
      content?: string;
    };

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'File content is required' });
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      res.status(400).json({ error: 'Uploaded file is empty' });
      return;
    }

    interface ParsedRow {
      boilerId?: string;
      temperatureC?: number;
      pressureBar?: number;
      waterLevelPct?: number;
      fuelConsumptionLph?: number;
      timestamp?: string;
    }

    const rowsToImport: ParsedRow[] = [];
    const errors: string[] = [];

    const isJson = filename?.toLowerCase().endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{');

    if (isJson) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (let i = 0; i < arr.length; i++) {
          const item = arr[i] as Record<string, unknown>;
          if (!item || typeof item !== 'object') continue;
          rowsToImport.push({
            boilerId: String(item.boilerId ?? item.boiler_id ?? item.id ?? defaultBoilerId ?? ''),
            temperatureC:
              item.temperatureC !== undefined
                ? Number(item.temperatureC)
                : item.temperature !== undefined
                  ? Number(item.temperature)
                  : undefined,
            pressureBar:
              item.pressureBar !== undefined
                ? Number(item.pressureBar)
                : item.pressure !== undefined
                  ? Number(item.pressure)
                  : undefined,
            waterLevelPct:
              item.waterLevelPct !== undefined
                ? Number(item.waterLevelPct)
                : item.waterLevel !== undefined
                  ? Number(item.waterLevel)
                  : undefined,
            fuelConsumptionLph:
              item.fuelConsumptionLph !== undefined
                ? Number(item.fuelConsumptionLph)
                : item.fuel !== undefined
                  ? Number(item.fuel)
                  : undefined,
            timestamp: typeof item.timestamp === 'string' ? item.timestamp : undefined,
          });
        }
      } catch {
        res.status(400).json({ error: 'Invalid JSON syntax in uploaded telemetry file' });
        return;
      }
    } else {
      // Parse CSV
      const lines = trimmed
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'));

      if (lines.length < 2) {
        res.status(400).json({ error: 'CSV must include a header row and at least one data row' });
        return;
      }

      const splitCsvLine = (line: string): string[] => {
        const out: string[] = [];
        let curr = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            out.push(curr.trim());
            curr = '';
          } else {
            curr += ch;
          }
        }
        out.push(curr.trim());
        return out;
      };

      const rawHeaders = splitCsvLine(lines[0]).map((h) =>
        h.toLowerCase().replace(/[^a-z0-9]/g, '')
      );

      const findIdx = (candidates: string[]) =>
        rawHeaders.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

      const boilerIdx = findIdx(['boilerid', 'unitid', 'boiler', 'id']);
      const tempIdx = findIdx(['temperaturec', 'temperature', 'temp']);
      const pressIdx = findIdx(['pressurebar', 'steampressure', 'pressure']);
      const waterIdx = findIdx(['waterlevelpct', 'waterlevel', 'water']);
      const fuelIdx = findIdx(['fuelconsumptionlph', 'fuelconsumption', 'fuelrate', 'fuel']);
      const timeIdx = findIdx(['timestamp', 'time', 'recordedat']);

      for (let r = 1; r < lines.length; r++) {
        const cols = splitCsvLine(lines[r]);
        if (cols.length === 0) continue;
        const parseNum = (idx: number): number | undefined => {
          if (idx < 0 || cols[idx] === undefined || cols[idx] === '') return undefined;
          const n = Number(cols[idx]);
          return Number.isFinite(n) ? n : undefined;
        };

        const bId = boilerIdx >= 0 && cols[boilerIdx] ? cols[boilerIdx] : defaultBoilerId;
        const temp = parseNum(tempIdx);
        const press = parseNum(pressIdx);
        const water = parseNum(waterIdx);
        const fuel = parseNum(fuelIdx);

        if (temp === undefined && press === undefined && water === undefined && fuel === undefined) {
          errors.push(`Row ${r + 1}: no numeric telemetry fields found`);
          continue;
        }

        rowsToImport.push({
          boilerId: bId,
          temperatureC: temp,
          pressureBar: press,
          waterLevelPct: water,
          fuelConsumptionLph: fuel,
          timestamp: timeIdx >= 0 && cols[timeIdx] ? cols[timeIdx] : undefined,
        });
      }
    }

    let importedCount = 0;
    const updatedSet = new Set<string>();

    for (const row of rowsToImport) {
      const targetId = row.boilerId || defaultBoilerId;
      const boiler = state.boilers.find((b) => b.id.toLowerCase() === String(targetId).toLowerCase());
      if (!boiler) {
        errors.push(`Unknown boiler ID "${targetId}"`);
        continue;
      }

      if (typeof row.temperatureC === 'number' && !Number.isNaN(row.temperatureC)) {
        boiler.temperatureC = round(clamp(row.temperatureC, 20, 260), 1);
      }
      if (typeof row.pressureBar === 'number' && !Number.isNaN(row.pressureBar)) {
        boiler.pressureBar = round(clamp(row.pressureBar, 0, 16), 2);
      }
      if (typeof row.waterLevelPct === 'number' && !Number.isNaN(row.waterLevelPct)) {
        boiler.waterLevelPct = round(clamp(row.waterLevelPct, 0, 100), 1);
      }
      if (typeof row.fuelConsumptionLph === 'number' && !Number.isNaN(row.fuelConsumptionLph)) {
        boiler.fuelConsumptionLph = round(clamp(row.fuelConsumptionLph, 0, 400), 1);
        boiler.steamOutputKgHr = round(boiler.fuelConsumptionLph * 26.5, 0);
      }

      evaluateBoilerHealth(boiler);

      const parsedTime = row.timestamp && !Number.isNaN(Date.parse(row.timestamp))
        ? new Date(row.timestamp).toISOString()
        : new Date().toISOString();

      boiler.history.push({
        timestamp: parsedTime,
        temperatureC: boiler.temperatureC,
        pressureBar: boiler.pressureBar,
        waterLevelPct: boiler.waterLevelPct,
        fuelConsumptionLph: boiler.fuelConsumptionLph,
        efficiencyPct: boiler.efficiencyPct,
        steamOutputKgHr: boiler.steamOutputKgHr,
      });
      if (boiler.history.length > 60) {
        boiler.history = boiler.history.slice(-60);
      }

      importedCount += 1;
      updatedSet.add(boiler.id);
    }

    if (importedCount === 0) {
      res.status(400).json({
        error: errors[0] || 'No valid telemetry records found in uploaded file',
        errors,
      });
      return;
    }

    saveState(state);
    broadcastState();
    res.json({
      ok: true,
      importedCount,
      updatedBoilers: Array.from(updatedSet),
      errors,
    });
  });

  app.post('/api/maintenance/upload', (req, res) => {
    const { filename, mimeType, contentBase64 } = req.body as {
      filename?: string;
      mimeType?: string;
      contentBase64?: string;
    };

    if (!filename || !contentBase64) {
      res.status(400).json({ error: 'filename and contentBase64 are required' });
      return;
    }

    const base64Clean = contentBase64.includes(',') ? contentBase64.split(',')[1] : contentBase64;
    const buffer = Buffer.from(base64Clean, 'base64');
    if (buffer.length === 0 || buffer.length > 8 * 1024 * 1024) {
      res.status(400).json({ error: 'File must be between 1 byte and 8 MB' });
      return;
    }

    const id = `ATT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedPath = path.join(UPLOADS_DIR, `${id}__${safeName}`);
    fs.writeFileSync(storedPath, buffer);

    const attachment: MaintenanceAttachment = {
      id,
      filename: path.basename(filename),
      mimeType: mimeType || 'application/octet-stream',
      sizeBytes: buffer.length,
      uploadedAt: new Date().toISOString(),
    };

    res.status(201).json({ attachment });
  });

  app.get('/api/uploads/:id', (req, res) => {
    const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!fs.existsSync(UPLOADS_DIR)) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }
    const files = fs.readdirSync(UPLOADS_DIR);
    const match = files.find((f) => f.startsWith(`${id}__`));
    if (!match) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }
    const originalName = match.slice(id.length + 2);
    const fullPath = path.join(UPLOADS_DIR, match);
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    res.sendFile(fullPath);
  });

  app.post('/api/maintenance', (req, res) => {
    const {
      boilerId,
      taskTitle,
      category,
      technician,
      scheduledDate,
      notes,
      markCompleted,
      attachment,
    } = req.body as {
      boilerId?: string;
      taskTitle?: string;
      category?: MaintenanceRecord['category'];
      technician?: string;
      scheduledDate?: string;
      notes?: string;
      markCompleted?: boolean;
      attachment?: MaintenanceAttachment | null;
    };

    const boiler = state.boilers.find((b) => b.id === boilerId);
    if (!boiler || !taskTitle || !technician) {
      res.status(400).json({ error: 'boilerId, taskTitle, and technician are required' });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const completed = Boolean(markCompleted);

    const record: MaintenanceRecord = {
      id: `MNT-${Math.floor(205 + Math.random() * 790)}`,
      boilerId: boiler.id,
      boilerName: boiler.name,
      taskTitle: taskTitle.trim(),
      category: category ?? 'Preventive',
      technician: technician.trim(),
      scheduledDate: scheduledDate || today,
      completedDate: completed ? today : null,
      dueAtHours: Math.round(boiler.operatingHoursTotal + (completed ? 0 : 25)),
      status: completed ? 'completed' : 'scheduled',
      notes: notes?.trim() || 'Logged from Plant Management Console.',
      attachment: attachment ?? null,
    };

    state.maintenanceRecords.unshift(record);

    if (completed) {
      boiler.hoursSinceLastService = 0;
      boiler.maintenanceStatus = 'operational';
      boiler.lastInspectionDate = today;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 45);
      boiler.nextInspectionDate = nextDate.toISOString().slice(0, 10);
      for (const alert of state.alerts) {
        if (alert.boilerId === boiler.id && alert.parameter === 'maintenance') {
          alert.resolved = true;
          alert.acknowledged = true;
        }
      }
      evaluateBoilerHealth(boiler);
    }

    saveState(state);
    broadcastState();
    res.status(201).json({ record });
  });

  app.patch('/api/maintenance/:id', (req, res) => {
    const record = state.maintenanceRecords.find((r) => r.id === req.params.id);
    if (!record) {
      res.status(404).json({ error: 'Maintenance record not found' });
      return;
    }

    const { status } = req.body as { status?: MaintenanceRecord['status'] };
    if (status && ['completed', 'scheduled', 'overdue', 'in_progress'].includes(status)) {
      record.status = status;
      const boiler = state.boilers.find((b) => b.id === record.boilerId);
      if (status === 'completed') {
        const today = new Date().toISOString().slice(0, 10);
        record.completedDate = today;
        if (boiler) {
          boiler.hoursSinceLastService = 0;
          boiler.maintenanceStatus = 'operational';
          boiler.lastInspectionDate = today;
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + 45);
          boiler.nextInspectionDate = nextDate.toISOString().slice(0, 10);
          for (const alert of state.alerts) {
            if (alert.boilerId === boiler.id && alert.parameter === 'maintenance') {
              alert.resolved = true;
              alert.acknowledged = true;
            }
          }
          evaluateBoilerHealth(boiler);
        }
      } else if (status === 'in_progress' && boiler) {
        boiler.maintenanceStatus = 'under_maintenance';
        boiler.isRunning = false;
        evaluateBoilerHealth(boiler);
      }
    }

    saveState(state);
    broadcastState();
    res.json({ record });
  });

  app.get('/api/export/csv', (req, res) => {
    const filterBoilerId = typeof req.query.boilerId === 'string' ? req.query.boilerId : '';
    const escapeCsv = (val: string | number): string => {
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const targetBoilers = filterBoilerId
      ? state.boilers.filter((b) => b.id === filterBoilerId)
      : state.boilers;

    const lines: string[] = [];
    const nowIso = new Date().toISOString();

    // Section 1: Current Fleet Summary
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
        .map(escapeCsv)
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
          .map(escapeCsv)
          .join(',')
      );
    }

    // Section 2: Historical Telemetry Log
    lines.push('');
    lines.push('SECTION: HISTORICAL TELEMETRY LEDGER');
    lines.push(
      [
        'Boiler ID',
        'Unit Name',
        'Timestamp',
        'Temperature (C)',
        'Steam Pressure (bar)',
        'Water Level (%)',
        'Fuel Consumption (L/hr)',
        'Steam Output (kg/hr)',
        'Efficiency (%)',
      ]
        .map(escapeCsv)
        .join(',')
    );

    for (const b of targetBoilers) {
      for (const pt of [...b.history].reverse()) {
        lines.push(
          [
            b.id,
            b.name,
            pt.timestamp,
            pt.temperatureC.toFixed(1),
            pt.pressureBar.toFixed(2),
            pt.waterLevelPct.toFixed(1),
            pt.fuelConsumptionLph.toFixed(1),
            pt.steamOutputKgHr.toFixed(0),
            pt.efficiencyPct.toFixed(1),
          ]
            .map(escapeCsv)
            .join(',')
        );
      }
    }

    const csv = '\uFEFF' + lines.join('\r\n');
    const filename = filterBoilerId
      ? `boiler-telemetry-${filterBoilerId.toLowerCase()}-${nowIso.slice(0, 10)}.csv`
      : `boiler-telemetry-report-${nowIso.slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  });

  app.post('/api/ai/chat', async (req, res) => {
    const { messages, selectedBoilerId, language } = req.body as {
      messages?: Array<{ role: 'user' | 'assistant'; text: string }>;
      selectedBoilerId?: string;
      language?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({
        error: 'Gemini API key is not configured. Please check Settings > Secrets.',
      });
      return;
    }

    // Build live quantitative telemetry & predictive forecast snapshot
    const runningBoilers = state.boilers.filter((b) => b.isRunning);
    const totalSteamKgHr = runningBoilers.reduce((s, b) => s + b.steamOutputKgHr, 0);
    const totalRatedCapacity = state.boilers.reduce((s, b) => s + b.ratedCapacityKgHr, 0);
    const totalHourlyFuelL = runningBoilers.reduce((s, b) => s + b.fuelConsumptionLph, 0);
    const projected24hFuelL = totalHourlyFuelL * 24;
    const projected7dFuelL = projected24hFuelL * 7;
    const avgFuelCostPerL = 109; // BDT/L reference tariff

    const boilerBriefs = state.boilers
      .map((b) => {
        const recent = b.history.slice(-10);
        const tempTrend =
          recent.length >= 2
            ? recent[recent.length - 1].temperatureC - recent[0].temperatureC
            : 0;
        const hrsUntilService = Math.max(0, b.serviceIntervalHours - b.hoursSinceLastService);
        const daysUntilService = hrsUntilService / 18; // ~18h average daily plant shift load

        return [
          `- ${b.id} (${b.name}) | Location: ${b.location} | Model: ${b.model} | Fuel: ${b.fuelType}`,
          `  State: ${b.status.toUpperCase()} (Running: ${b.isRunning}, Mode: ${b.loadMode}, Fault: ${b.faultScenario})`,
          `  Temp: ${b.temperatureC.toFixed(1)} °C (recent 10-sample drift: ${tempTrend >= 0 ? '+' : ''}${tempTrend.toFixed(1)} °C) | Pressure: ${b.pressureBar.toFixed(2)} bar (Target: ${b.targetPressureBar.toFixed(1)} bar)`,
          `  Water Level: ${b.waterLevelPct.toFixed(1)}% (Feed pump: ${b.feedwaterPumpActive ? 'ACTIVE' : 'IDLE'}) | Firing: ${b.burnerFiringPct}%`,
          `  Fuel Rate: ${b.fuelConsumptionLph.toFixed(1)} L/hr | Today Fuel: ${b.dailyFuelTotalL.toFixed(1)} L | Steam Output: ${b.steamOutputKgHr} / ${b.ratedCapacityKgHr} kg/hr | Efficiency: ${b.efficiencyPct.toFixed(1)}%`,
          `  Operating Hours: ${b.operatingHoursTotal.toFixed(1)} hrs total | Since Service: ${b.hoursSinceLastService.toFixed(1)} / ${b.serviceIntervalHours} hrs (${hrsUntilService.toFixed(1)} hrs / ~${daysUntilService.toFixed(1)} days left) | Maint Status: ${b.maintenanceStatus}`,
          `  Last Inspection: ${b.lastInspectionDate} | Next Scheduled: ${b.nextInspectionDate}`,
        ].join('\n');
      })
      .join('\n\n');

    const activeAlertsBrief = state.alerts
      .filter((a) => !a.resolved)
      .map((a) => `- [${a.severity.toUpperCase()}] ${a.boilerId} (${a.parameter}: ${a.valueDisplay}) — ${a.message} (Ack: ${a.acknowledged})`)
      .join('\n') || '- None (all boilers within safe thresholds)';

    const maintBrief = state.maintenanceRecords
      .slice(0, 6)
      .map((m) => `- ${m.id} | ${m.boilerId} | ${m.taskTitle} | ${m.category} | Tech: ${m.technician} | Status: ${m.status} | Date: ${m.completedDate ?? m.scheduledDate}`)
      .join('\n');

    const systemInstruction = `You are ThermoGrid Plant AI, a specialized industrial boiler operations, company utility intelligence, and textile manufacturing engineering assistant.

COMPANY & PLANT PROFILE:
- Company: ThermoGrid Textile & Steam Operations (Integrated Knit & Woven Dyeing, Finishing, and Utility Plant)
- Utility Infrastructure: 3 Industrial Boilers (Main Steam BLR-01 6,000 kg/hr Natural Gas; Process Heat BLR-02 4,500 kg/hr Diesel; Auxiliary Standby BLR-03 3,000 kg/hr Natural Gas). Total plant steam capacity: ${totalRatedCapacity.toLocaleString()} kg/hr.
- Currently Active Steam Generation: ${totalSteamKgHr.toLocaleString()} kg/hr across ${runningBoilers.length} running unit(s).
- Current Focus Unit in Dashboard: ${selectedBoilerId || 'BLR-01'}
- Preferred UI Language Hint: ${language === 'bn' ? 'Bengali (বাংলা) unless the user writes in English' : 'Match the user message language (English or Bengali/বাংলা)'}.

SPECIALIZED TEXTILE ENGINEERING & STEAM PROCESS KNOWLEDGE:
- Wet Processing & Dyeing:
  * High-Temperature Polyester Jet Dyeing requires 130 °C bath (steam header 9.5–11.0 bar for fast ramp rate ~2.5 °C/min without bottlenecking adjacent machines).
  * Cotton Reactive Dyeing (60–95 °C) and Scouring/Bleaching (98–110 °C) depend on stable 8.0–9.5 bar header pressure.
  * Mercerizing & Jigger Dyeing require dry saturated steam (dryness fraction >= 0.97) to prevent uneven caustic/dye dilution.
- Finishing & Heat-Setting:
  * Stenter Frames (Polyester/Lycra heat-setting 180–205 °C) & Drying Cylinders (120–145 °C) require consistent thermal oil/high-pressure steam heat transfer; pressure drops >0.8 bar cause GSM & shade variation across fabric width.
  * Compactor & Sanforizing units require 4.5–6.0 bar dry steam conditioning for shrinkage control (<3%).
- Textile Utility Benchmarks:
  * Specific Steam Consumption (SSC): Typical benchmark is 2.8–4.2 kg steam per kg of finished dyed knit fabric (target <= 3.2 kg/kg with condensate recovery).
  * Condensate Return: Each 10% increase in condensate recovery (~85 °C feedwater) saves ~1.5–1.8% boiler fuel.
  * Blowdown & Water Quality: High TDS (>2,500 ppm) causes carryover into steam headers, risking dye spotting in jet dyeing nozzles and scale fouling on fire-tubes (1 mm scale increases fuel burn by ~3–5%).

LIVE PLANT TELEMETRY SNAPSHOT (${new Date().toISOString()}):
${boilerBriefs}

ACTIVE ALARMS:
${activeAlertsBrief}

RECENT MAINTENANCE LOGS:
${maintBrief}

QUANTITATIVE FORECASTING BASELINE (AT CURRENT RUN RATE):
- Combined Live Fuel Burn: ${totalHourlyFuelL.toFixed(1)} L/hr
- Projected Next 24h Fuel Burn: ~${projected24hFuelL.toFixed(0)} L (Est. cost ~${Math.round(projected24hFuelL * avgFuelCostPerL).toLocaleString()} BDT at ${avgFuelCostPerL} BDT/L)
- Projected Next 7 Days Fuel Burn: ~${projected7dFuelL.toFixed(0)} L (Est. cost ~${Math.round(projected7dFuelL * avgFuelCostPerL).toLocaleString()} BDT)
- Spare Standby Steam Capacity (BLR-03): ${state.boilers.find((b) => b.id === 'BLR-03')?.isRunning ? '0 kg/hr (already active)' : '3,000 kg/hr available on warm standby'}

RESPONSE GUIDELINES:
- Answer with executive clarity, precision, and practical engineering depth like ChatGPT for industrial plant management.
- Always cite exact live numbers from the telemetry above when discussing current status or making future predictions (e.g., fuel forecasts, maintenance due dates, steam capacity headroom, failure risk).
- Clearly distinguish between live observed readings and projected/predicted estimates (state your assumptions, e.g., current firing rate or 18h/day shift load).
- Use clean Markdown headings, bullet lists, and concise tables when helpful. Keep responses structured and immediately actionable.`;

    const lastMsg = messages[messages.length - 1];
    const mappedHistory = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.text }],
    }));
    const firstUserIdx = mappedHistory.findIndex((m) => m.role === 'user');
    const history = firstUserIdx >= 0 ? mappedHistory.slice(firstUserIdx) : [];

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const ai = getAiClient();
      const chat = ai.chats.create({
        model: 'gemini-4-hydrogen',
        ...(history.length > 0 ? { history } : {}),
        config: {
          systemInstruction,
        },
      });

      const stream = await chat.sendMessageStream({
        message: lastMsg.text,
      });

      for await (const chunk of stream) {
        const c = chunk as GenerateContentResponse;
        const delta = c.text;
        if (delta) {
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err: unknown) {
      console.error('Gemini AI chat error:', err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      let friendly = 'Unable to generate AI response right now. Please try again.';
      if (
        rawMsg.includes('API_KEY_INVALID') ||
        rawMsg.includes('PERMISSION_DENIED') ||
        rawMsg.includes('API key')
      ) {
        friendly = 'Gemini API key error (400/403). Please verify your GEMINI_API_KEY in Settings > Secrets.';
      } else if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
        friendly = 'Rate limit or quota reached (429). Please wait a moment or check your billing-enabled API key in Settings > Secrets.';
      } else if (rawMsg) {
        friendly = `AI request error: ${rawMsg.slice(0, 180)}`;
      }
      res.write(`data: ${JSON.stringify({ error: friendly })}\n\n`);
      res.end();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ThermoGrid Boiler Monitor running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
