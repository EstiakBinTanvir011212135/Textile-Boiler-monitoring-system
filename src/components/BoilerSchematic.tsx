import React from 'react';
import type { BoilerUnit } from '../types/boiler';
import type { Translations } from '../i18n/translations';

interface BoilerSchematicProps {
  boiler: BoilerUnit;
  t: Translations;
}

export const BoilerSchematic: React.FC<BoilerSchematicProps> = ({ boiler, t }) => {
  const waterPct = Math.max(0, Math.min(100, boiler.waterLevelPct));
  const drumTop = 62;
  const drumHeight = 148;
  const waterHeight = (waterPct / 100) * (drumHeight - 16);
  const waterY = drumTop + drumHeight - 8 - waterHeight;

  const isLowWater = boiler.waterLevelPct <= 38;
  const isHighTemp = boiler.temperatureC >= 195;
  const isHighPressure = boiler.pressureBar >= 11.9;

  const waterFill = isLowWater
    ? '#DC2626'
    : boiler.waterLevelPct < 48
      ? '#D97706'
      : '#0284C7';

  const flameScale = boiler.isRunning ? Math.max(0.35, boiler.burnerFiringPct / 100) : 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t.boilerCrossSection}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {boiler.id} · {boiler.model}
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          {boiler.isRunning ? `${boiler.burnerFiringPct}% ${t.firingRate}` : t.statusStandby}
        </span>
      </div>

      <div className="py-4">
        <svg
          viewBox="0 0 360 250"
          className="w-full h-auto select-none"
          role="img"
          aria-label={`${boiler.name} internal schematic`}
        >
          {/* Steam Output Header Pipe */}
          <path
            d="M 180 62 L 180 28 L 285 28"
            fill="none"
            className="stroke-slate-400 dark:stroke-slate-600"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Steam Flow Direction Arrow */}
          {boiler.isRunning && (
            <path
              d="M 272 22 L 284 28 L 272 34"
              fill="none"
              className={isHighPressure ? 'stroke-rose-600' : 'stroke-amber-600 dark:stroke-amber-400'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <text
            x="212"
            y="18"
            className="fill-slate-600 dark:fill-slate-300 font-mono text-[10px]"
          >
            STEAM {boiler.steamOutputKgHr} kg/h
          </text>

          {/* Safety Relief Valve Indicator */}
          <rect
            x="118"
            y="42"
            width="18"
            height="20"
            rx="2"
            className="fill-slate-200 dark:fill-slate-800 stroke-slate-500 dark:stroke-slate-500"
            strokeWidth="1.5"
          />
          <line
            x1="127"
            y1="30"
            x2="127"
            y2="42"
            className={isHighPressure ? 'stroke-rose-600' : 'stroke-slate-500'}
            strokeWidth="2"
          />
          <text
            x="80"
            y="38"
            className="fill-slate-500 dark:fill-slate-400 font-mono text-[9px]"
          >
            {boiler.pressureBar.toFixed(2)} bar
          </text>

          {/* Main Boiler Pressure Vessel Shell */}
          <rect
            x="64"
            y={drumTop}
            width="232"
            height={drumHeight}
            rx="18"
            className="fill-slate-100 dark:fill-slate-900 stroke-slate-400 dark:stroke-slate-600"
            strokeWidth="2.5"
          />

          {/* Inner Drum Cavity */}
          <rect
            x="72"
            y={drumTop + 8}
            width="216"
            height={drumHeight - 16}
            rx="12"
            className="fill-white dark:fill-slate-950 stroke-slate-300 dark:stroke-slate-700"
            strokeWidth="1"
          />

          {/* Water Column Fill */}
          <clipPath id={`drum-clip-${boiler.id}`}>
            <rect
              x="73"
              y={drumTop + 9}
              width="214"
              height={drumHeight - 18}
              rx="11"
            />
          </clipPath>
          <g clipPath={`url(#drum-clip-${boiler.id})`}>
            <rect
              x="73"
              y={waterY}
              width="214"
              height={drumTop + drumHeight - waterY}
              fill={waterFill}
              fillOpacity={0.22}
            />
            <line
              x1="73"
              y1={waterY}
              x2="287"
              y2={waterY}
              stroke={waterFill}
              strokeWidth="2"
            />
          </g>

          {/* Low Water Cutoff Reference Line (35%) */}
          <line
            x1="74"
            y1={drumTop + drumHeight - 8 - 0.35 * (drumHeight - 16)}
            x2="112"
            y2={drumTop + drumHeight - 8 - 0.35 * (drumHeight - 16)}
            className="stroke-rose-500"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          <text
            x="77"
            y={drumTop + drumHeight - 12 - 0.35 * (drumHeight - 16)}
            className="fill-rose-600 dark:fill-rose-400 font-mono text-[8px]"
          >
            MIN 35%
          </text>

          {/* Fire-Tube Combustion Chamber */}
          <rect
            x="98"
            y="148"
            width="164"
            height="42"
            rx="6"
            className="fill-slate-900 dark:fill-slate-900 stroke-slate-500"
            strokeWidth="1.5"
          />

          {/* Burner Flame */}
          {boiler.isRunning ? (
            <g transform={`translate(106, 169) scale(${flameScale}, 1)`}>
              <path
                d="M 0 -10 Q 52 -16 112 0 Q 52 16 0 10 Z"
                fill={isHighTemp ? '#EF4444' : '#F59E0B'}
                fillOpacity="0.88"
              />
              <path
                d="M 0 -5 Q 36 -9 74 0 Q 36 9 0 5 Z"
                fill="#FEF08A"
                fillOpacity="0.95"
              />
            </g>
          ) : (
            <text
              x="180"
              y="173"
              textAnchor="middle"
              className="fill-slate-400 font-mono text-[10px]"
            >
              BURNER OFF
            </text>
          )}

          {/* Water & Temperature Readouts inside Vessel */}
          <text
            x="276"
            y="96"
            textAnchor="end"
            className="fill-slate-700 dark:fill-slate-200 font-mono text-[11px] font-semibold"
          >
            {boiler.temperatureC.toFixed(1)} °C
          </text>
          <text
            x="276"
            y="112"
            textAnchor="end"
            className="fill-sky-700 dark:fill-sky-400 font-mono text-[11px] font-semibold"
          >
            LVL {boiler.waterLevelPct.toFixed(1)}%
          </text>

          {/* Feedwater Inlet Pipe & Pump */}
          <path
            d="M 22 184 L 64 184"
            fill="none"
            className={
              boiler.feedwaterPumpActive
                ? 'stroke-sky-600 dark:stroke-sky-400'
                : 'stroke-slate-300 dark:stroke-slate-700'
            }
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle
            cx="32"
            cy="184"
            r="12"
            className={
              boiler.feedwaterPumpActive
                ? 'fill-sky-100 dark:fill-sky-950 stroke-sky-600 dark:stroke-sky-400'
                : 'fill-slate-100 dark:fill-slate-900 stroke-slate-400 dark:stroke-slate-600'
            }
            strokeWidth="2"
          />
          <text
            x="32"
            y="187"
            textAnchor="middle"
            className={
              boiler.feedwaterPumpActive
                ? 'fill-sky-700 dark:fill-sky-300 font-mono text-[9px] font-bold'
                : 'fill-slate-500 font-mono text-[9px]'
            }
          >
            P1
          </text>
          <text
            x="10"
            y="210"
            className="fill-slate-500 dark:fill-slate-400 font-mono text-[9px]"
          >
            {boiler.feedwaterPumpActive ? t.pumpActive : t.pumpIdle}
          </text>

          {/* Flue Stack Exhaust */}
          <rect
            x="296"
            y="84"
            width="28"
            height="72"
            className="fill-slate-200 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600"
            strokeWidth="1.5"
          />
          <text
            x="310"
            y="174"
            textAnchor="middle"
            className="fill-slate-500 dark:fill-slate-400 font-mono text-[9px]"
          >
            FLUE
          </text>

          {/* Support Saddles */}
          <path d="M 105 210 L 95 232 L 125 232 L 118 210 Z" className="fill-slate-300 dark:fill-slate-700" />
          <path d="M 242 210 L 235 232 L 265 232 L 255 210 Z" className="fill-slate-300 dark:fill-slate-700" />
        </svg>
      </div>

      {/* Compact Key Operating Summary Row */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
        <div>
          <span className="text-slate-500 dark:text-slate-400 block">{t.steamOutput}</span>
          <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
            {boiler.steamOutputKgHr.toLocaleString()} kg/h
          </span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 block">{t.thermalEfficiency}</span>
          <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
            {boiler.efficiencyPct.toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 block">Fuel Type</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {boiler.fuelType}
          </span>
        </div>
      </div>
    </div>
  );
};
