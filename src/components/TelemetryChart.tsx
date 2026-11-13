import React, { useState } from 'react';
import type { BoilerUnit } from '../types/boiler';
import type { Translations } from '../i18n/translations';

export type MetricChannel = 'temperatureC' | 'pressureBar' | 'waterLevelPct' | 'fuelConsumptionLph';

interface TelemetryChartProps {
  boiler: BoilerUnit;
  t: Translations;
}

const CHANNEL_META: Record<
  MetricChannel,
  {
    labelKey: keyof Translations;
    unit: string;
    color: string;
    strokeClass: string;
    minBound: number;
    maxBound: number;
    safeHigh?: number;
    safeLow?: number;
  }
> = {
  temperatureC: {
    labelKey: 'boilerTemperature',
    unit: '°C',
    color: '#D97706',
    strokeClass: 'stroke-amber-600 dark:stroke-amber-400',
    minBound: 40,
    maxBound: 225,
    safeHigh: 195,
  },
  pressureBar: {
    labelKey: 'steamPressure',
    unit: 'bar',
    color: '#2563EB',
    strokeClass: 'stroke-blue-600 dark:stroke-blue-400',
    minBound: 0,
    maxBound: 14,
    safeHigh: 12.0,
  },
  waterLevelPct: {
    labelKey: 'waterLevel',
    unit: '%',
    color: '#0284C7',
    strokeClass: 'stroke-sky-600 dark:stroke-sky-400',
    minBound: 20,
    maxBound: 100,
    safeLow: 45,
  },
  fuelConsumptionLph: {
    labelKey: 'fuelConsumption',
    unit: 'L/hr',
    color: '#059669',
    strokeClass: 'stroke-emerald-600 dark:stroke-emerald-400',
    minBound: 0,
    maxBound: 200,
  },
};

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ boiler, t }) => {
  const [channel, setChannel] = useState<MetricChannel>('temperatureC');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const history = boiler.history;
  const meta = CHANNEL_META[channel];

  const width = 760;
  const height = 260;
  const padLeft = 48;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 32;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const values = history.map((pt) => pt[channel]);
  const dataMin = values.length ? Math.min(...values) : meta.minBound;
  const dataMax = values.length ? Math.max(...values) : meta.maxBound;

  const yMin = Math.floor(Math.min(meta.minBound, dataMin - 5));
  const yMax = Math.ceil(Math.max(dataMax + 8, channel === 'pressureBar' ? 13 : meta.minBound + 20));
  const span = Math.max(1, yMax - yMin);

  const toX = (idx: number) =>
    history.length <= 1 ? padLeft : padLeft + (idx / (history.length - 1)) * innerW;
  const toY = (val: number) => padTop + innerH - ((val - yMin) / span) * innerH;

  const linePath = history
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(pt[channel]).toFixed(1)}`)
    .join(' ');

  const areaPath =
    history.length > 0
      ? `${linePath} L ${toX(history.length - 1).toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${toX(0).toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`
      : '';

  const targetLineVal =
    channel === 'pressureBar'
      ? boiler.targetPressureBar
      : meta.safeHigh ?? meta.safeLow ?? null;

  const activeIndex = hoverIdx !== null && history[hoverIdx] ? hoverIdx : history.length - 1;
  const activePoint = history[activeIndex];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (history.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const clamped = Math.max(padLeft, Math.min(width - padRight, relX));
    const idx = Math.round(((clamped - padLeft) / innerW) * (history.length - 1));
    setHoverIdx(Math.max(0, Math.min(history.length - 1, idx)));
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + span * f);
  const xTickIndices =
    history.length >= 4
      ? [0, Math.floor(history.length / 3), Math.floor((2 * history.length) / 3), history.length - 1]
      : [0];

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="flex flex-col">
      {/* Chart Header & Channel Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t.liveTelemetryChart}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {boiler.name} · {history.length} recent samples
          </p>
        </div>

        <div
          className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg"
          role="tablist"
          aria-label="Telemetry Channel"
        >
          {(Object.keys(CHANNEL_META) as MetricChannel[]).map((key) => {
            const isSelected = channel === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setChannel(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t[CHANNEL_META[key].labelKey]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Crosshair Readout Bar */}
      {activePoint && (
        <div className="flex flex-wrap items-center justify-between gap-4 py-3 text-xs">
          <div className="flex items-baseline gap-2">
            <span className="text-slate-500 dark:text-slate-400">{t[meta.labelKey]}:</span>
            <span className="font-mono tabular-nums text-lg font-semibold text-slate-900 dark:text-slate-100">
              {channel === 'pressureBar'
                ? activePoint[channel].toFixed(2)
                : activePoint[channel].toFixed(1)}
            </span>
            <span className="font-mono text-slate-500 dark:text-slate-400">{meta.unit}</span>
          </div>

          <div className="flex items-center gap-4 font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>T: {activePoint.temperatureC.toFixed(1)}°C</span>
            <span>P: {activePoint.pressureBar.toFixed(2)} bar</span>
            <span>LVL: {activePoint.waterLevelPct.toFixed(1)}%</span>
            <span>@ {formatTime(activePoint.timestamp)}</span>
          </div>
        </div>
      )}

      {/* SVG Plot */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={`area-grad-${channel}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={meta.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={meta.color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines */}
          {yTicks.map((tickVal, idx) => {
            const y = toY(tickVal);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 font-mono text-[10px]"
                >
                  {channel === 'pressureBar' ? tickVal.toFixed(1) : Math.round(tickVal)}
                </text>
              </g>
            );
          })}

          {/* Reference Target / Threshold Line */}
          {targetLineVal !== null && targetLineVal >= yMin && targetLineVal <= yMax && (
            <g>
              <line
                x1={padLeft}
                y1={toY(targetLineVal)}
                x2={width - padRight}
                y2={toY(targetLineVal)}
                className="stroke-slate-400 dark:stroke-slate-500"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={width - padRight - 4}
                y={toY(targetLineVal) - 5}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 font-mono text-[9px]"
              >
                {channel === 'pressureBar'
                  ? `TARGET ${targetLineVal.toFixed(1)} bar`
                  : meta.safeHigh
                    ? `LIMIT ${meta.safeHigh}${meta.unit}`
                    : `MIN ${meta.safeLow}${meta.unit}`}
              </text>
            </g>
          )}

          {/* Area & Line */}
          {areaPath && <path d={areaPath} fill={`url(#area-grad-${channel})`} />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={meta.color}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* X-axis Timestamps */}
          {xTickIndices.map((idx) => {
            const pt = history[idx];
            if (!pt) return null;
            return (
              <text
                key={idx}
                x={toX(idx)}
                y={height - 8}
                textAnchor={idx === 0 ? 'start' : idx === history.length - 1 ? 'end' : 'middle'}
                className="fill-slate-400 dark:fill-slate-500 font-mono text-[10px]"
              >
                {formatTime(pt.timestamp)}
              </text>
            );
          })}

          {/* Crosshair & Active Point Dot */}
          {activePoint && (
            <g>
              <line
                x1={toX(activeIndex)}
                y1={padTop}
                x2={toX(activeIndex)}
                y2={padTop + innerH}
                className="stroke-slate-300 dark:stroke-slate-700"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={toX(activeIndex)}
                cy={toY(activePoint[channel])}
                r="4.5"
                fill={meta.color}
                className="stroke-white dark:stroke-slate-900"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
