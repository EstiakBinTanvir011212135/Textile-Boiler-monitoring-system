import React, { useState } from 'react';
import { Download } from 'lucide-react';
import type { BoilerUnit, PlantDashboardState } from '../types/boiler';
import type { Translations } from '../i18n/translations';
import { downloadTelemetryCsvReport } from '../utils/exportCsv';
import { TelemetryUploadPanel } from './TelemetryUploadPanel';

interface AnalyticsViewProps {
  dashboard: PlantDashboardState | null;
  boilers: BoilerUnit[];
  selectedBoiler: BoilerUnit;
  onRefreshState: () => Promise<void>;
  t: Translations;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  dashboard,
  boilers,
  selectedBoiler,
  onRefreshState,
  t,
}) => {
  const [fuelUnitCost, setFuelUnitCost] = useState<number>(109); // e.g., BDT / L or equivalent

  const totalDailyFuel = boilers.reduce((sum, b) => sum + b.dailyFuelTotalL, 0);
  const totalSteamOutput = boilers.reduce((sum, b) => sum + b.steamOutputKgHr, 0);
  const runningBoilers = boilers.filter((b) => b.isRunning);
  const avgEfficiency =
    runningBoilers.length > 0
      ? runningBoilers.reduce((sum, b) => sum + b.efficiencyPct, 0) / runningBoilers.length
      : 0;
  const estimatedDailyCost = totalDailyFuel * fuelUnitCost;
  const estimatedCo2Kg = totalDailyFuel * 2.68;

  const history = selectedBoiler.history.slice(-24);

  return (
    <div className="space-y-6">
      {/* Plant-Wide Daily Aggregates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Plant Steam Output
          </p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {totalSteamOutput.toLocaleString()}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
              kg/hr
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {runningBoilers.length} of {boilers.length} units active
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Cumulative Daily Fuel
          </p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {totalDailyFuel.toFixed(1)}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
              L today
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Across all utility bays
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Fleet Thermal Efficiency
          </p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {avgEfficiency.toFixed(1)}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
              %
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Target baseline ≥ 87.0%
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Est. Daily Fuel Cost
            </p>
            <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>Rate:</span>
              <input
                type="number"
                min={1}
                max={500}
                value={fuelUnitCost}
                onChange={(e) => setFuelUnitCost(Math.max(1, Number(e.target.value) || 0))}
                className="w-14 px-1.5 py-0.5 text-right font-mono tabular-nums text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                aria-label="Fuel unit cost per liter"
              />
            </label>
          </div>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {Math.round(estimatedDailyCost).toLocaleString()}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
              BDT
            </span>
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Est. emissions: {Math.round(estimatedCo2Kg).toLocaleString()} kg CO2
          </p>
        </div>
      </div>

      {/* Selected Boiler Efficiency & Fuel Ratio Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {selectedBoiler.name} · Telemetry Sample Ledger
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {selectedBoiler.id} · {selectedBoiler.fuelType} · Rated {selectedBoiler.ratedCapacityKgHr.toLocaleString()} kg/hr
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Latest {history.length} intervals
            </span>
            <button
              type="button"
              onClick={() => downloadTelemetryCsvReport(dashboard, selectedBoiler.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {selectedBoiler.id} CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-4">Timestamp</th>
                <th className="py-2.5 px-4 text-right">{t.boilerTemperature}</th>
                <th className="py-2.5 px-4 text-right">{t.steamPressure}</th>
                <th className="py-2.5 px-4 text-right">{t.waterLevel}</th>
                <th className="py-2.5 px-4 text-right">{t.fuelConsumption}</th>
                <th className="py-2.5 px-4 text-right">{t.steamOutput}</th>
                <th className="py-2.5 pl-4 text-right">{t.thermalEfficiency}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono tabular-nums text-xs">
              {[...history].reverse().slice(0, 12).map((pt, idx) => (
                <tr
                  key={`${pt.timestamp}-${idx}`}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {new Date(pt.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-900 dark:text-slate-100">
                    {pt.temperatureC.toFixed(1)} °C
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-900 dark:text-slate-100">
                    {pt.pressureBar.toFixed(2)} bar
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-900 dark:text-slate-100">
                    {pt.waterLevelPct.toFixed(1)} %
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-900 dark:text-slate-100">
                    {pt.fuelConsumptionLph.toFixed(1)} L/hr
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-900 dark:text-slate-100">
                    {pt.steamOutputKgHr.toLocaleString()} kg/hr
                  </td>
                  <td className="py-2.5 pl-4 text-right text-slate-900 dark:text-slate-100">
                    {pt.efficiencyPct.toFixed(1)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Telemetry File Upload Panel */}
      <TelemetryUploadPanel
        defaultBoilerId={selectedBoiler.id}
        onUploadComplete={onRefreshState}
      />
    </div>
  );
};
