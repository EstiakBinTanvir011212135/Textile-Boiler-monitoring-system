import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { BoilerUnit } from '../types/boiler';
import { TelemetryUploadPanel } from './TelemetryUploadPanel';

interface IotDatabaseViewProps {
  selectedBoiler: BoilerUnit;
  onInjectPacket: (payload: {
    boilerId: string;
    temperatureC: number;
    pressureBar: number;
    waterLevelPct: number;
    fuelConsumptionLph: number;
  }) => Promise<void>;
  onRefreshState: () => Promise<void>;
}

const PYTHON_AGENT_CODE = `"""
ThermoGrid Python IoT Edge Gateway
Reads industrial boiler sensors via Modbus RTU / Serial and pushes
telemetry packets to the Node.js API & MySQL persistence layer.
"""
import time
import requests
# from pymodbus.client import ModbusSerialClient  # Uncomment for hardware PLC

API_ENDPOINT = "http://localhost:3000/api/sensors/ingest"
BOILER_ID = "BLR-01"

def read_plc_registers():
    # Replace with live Modbus RTU / ADC sensor reads in production
    return {
        "boilerId": BOILER_ID,
        "temperatureC": 185.2,
        "pressureBar": 10.85,
        "waterLevelPct": 67.8,
        "fuelConsumptionLph": 141.5,
    }

def main():
    while True:
        payload = read_plc_registers()
        try:
            resp = requests.post(API_ENDPOINT, json=payload, timeout=3)
            resp.raise_for_status()
            print(f"[OK] Pushed {BOILER_ID}: {payload['temperatureC']} C")
        except requests.RequestException as exc:
            print(f"[ERR] Ingestion failed: {exc}")
        time.sleep(2.0)

if __name__ == "__main__":
    main()`;

const MYSQL_SCHEMA_SQL = `-- ThermoGrid MySQL 8.0 Schema for Smart Boiler Monitoring
CREATE DATABASE IF NOT EXISTS thermogrid_boiler;
USE thermogrid_boiler;

CREATE TABLE boilers (
  id VARCHAR(16) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(120) NOT NULL,
  fuel_type ENUM('Natural Gas', 'Heavy Fuel Oil', 'Diesel') NOT NULL,
  rated_capacity_kghr INT NOT NULL,
  operating_hours_total DECIMAL(10, 2) DEFAULT 0.00,
  maintenance_status ENUM('operational', 'inspection_due', 'attention_required', 'under_maintenance') DEFAULT 'operational'
);

CREATE TABLE telemetry_readings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  boiler_id VARCHAR(16) NOT NULL,
  temperature_c DECIMAL(5, 1) NOT NULL,
  pressure_bar DECIMAL(5, 2) NOT NULL,
  water_level_pct DECIMAL(5, 1) NOT NULL,
  fuel_consumption_lph DECIMAL(6, 1) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_boiler_time (boiler_id, recorded_at),
  CONSTRAINT fk_telemetry_boiler FOREIGN KEY (boiler_id) REFERENCES boilers(id)
);

CREATE TABLE maintenance_logs (
  id VARCHAR(24) PRIMARY KEY,
  boiler_id VARCHAR(16) NOT NULL,
  task_title VARCHAR(180) NOT NULL,
  technician VARCHAR(100) NOT NULL,
  scheduled_date DATE NOT NULL,
  completed_date DATE NULL,
  status ENUM('scheduled', 'in_progress', 'completed', 'overdue') DEFAULT 'scheduled',
  CONSTRAINT fk_maint_boiler FOREIGN KEY (boiler_id) REFERENCES boilers(id)
);`;

export const IotDatabaseView: React.FC<IotDatabaseViewProps> = ({
  selectedBoiler,
  onInjectPacket,
  onRefreshState,
}) => {
  const [tempInput, setTempInput] = useState(selectedBoiler.temperatureC.toString());
  const [pressureInput, setPressureInput] = useState(selectedBoiler.pressureBar.toString());
  const [waterInput, setWaterInput] = useState(selectedBoiler.waterLevelPct.toString());
  const [fuelInput, setFuelInput] = useState(selectedBoiler.fuelConsumptionLph.toString());
  const [sending, setSending] = useState(false);
  const [packetFeedback, setPacketFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'python' | 'mysql'>('python');
  const [copied, setCopied] = useState(false);

  const handleSendPacket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setPacketFeedback(null);
    try {
      await onInjectPacket({
        boilerId: selectedBoiler.id,
        temperatureC: Number(tempInput),
        pressureBar: Number(pressureInput),
        waterLevelPct: Number(waterInput),
        fuelConsumptionLph: Number(fuelInput),
      });
      setPacketFeedback(`Ingested live IoT packet into ${selectedBoiler.id} via POST /api/sensors/ingest`);
    } finally {
      setSending(false);
    }
  };

  const handleCopyCode = async () => {
    const content = activeTab === 'python' ? PYTHON_AGENT_CODE : MYSQL_SCHEMA_SQL;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Batch CSV / JSON File Upload */}
      <TelemetryUploadPanel
        defaultBoilerId={selectedBoiler.id}
        onUploadComplete={onRefreshState}
      />

      {/* Live Sensor Channels Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {selectedBoiler.name} · Connected IoT Sensor Array
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hardware transducers feeding live telemetry through Python Edge Gateway to Node.js API
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Endpoint: POST /api/sensors/ingest
          </span>
        </div>

        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-4">Channel ID</th>
                <th className="py-2.5 px-4">Sensor Hardware</th>
                <th className="py-2.5 px-4">Bus Protocol</th>
                <th className="py-2.5 px-4 text-right">Live Value</th>
                <th className="py-2.5 px-4 text-right">Signal Quality</th>
                <th className="py-2.5 px-4">Last Calibrated</th>
                <th className="py-2.5 pl-4 text-right">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {selectedBoiler.sensors.map((sensor) => (
                <tr key={sensor.id}>
                  <td className="py-3 pr-4 font-mono text-slate-700 dark:text-slate-300">
                    {sensor.id}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                    {sensor.name}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                    {sensor.protocol}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {sensor.value.toFixed(sensor.unit === 'bar' ? 2 : 1)} {sensor.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {sensor.signalQualityPct.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                    {sensor.lastCalibrated}
                  </td>
                  <td className="py-3 pl-4 text-right whitespace-nowrap">
                    {sensor.status === 'online' ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        ● Online
                      </span>
                    ) : sensor.status === 'drifting' ? (
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        ▲ Drifting
                      </span>
                    ) : (
                      <span className="text-rose-700 dark:text-rose-400 font-medium">
                        ✖ Fault
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Split: Live Sensor Packet Injector + Python/MySQL Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSendPacket}
          className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
        >
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Test IoT Sensor Ingestion
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Push a manual sensor packet to {selectedBoiler.id} via the live Node.js REST endpoint.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Temperature (°C)
              </label>
              <input
                type="number"
                step="0.1"
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Pressure (bar)
              </label>
              <input
                type="number"
                step="0.01"
                value={pressureInput}
                onChange={(e) => setPressureInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Water Level (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={waterInput}
                onChange={(e) => setWaterInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Fuel Rate (L/hr)
              </label>
              <input
                type="number"
                step="0.1"
                value={fuelInput}
                onChange={(e) => setFuelInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full px-4 py-2.5 text-sm font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            {sending ? 'Transmitting...' : 'Send Sensor Packet'}
          </button>

          {packetFeedback && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-mono">
              {packetFeedback}
            </p>
          )}
        </form>

        {/* Python Edge Agent & MySQL Schema Reference (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('python')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'python'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Python Edge Agent (boiler_iot_agent.py)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mysql')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'mysql'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                MySQL Schema (boiler_monitoring.sql)
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          <pre className="mt-4 p-4 rounded-lg bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto leading-relaxed">
            <code>{activeTab === 'python' ? PYTHON_AGENT_CODE : MYSQL_SCHEMA_SQL}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
