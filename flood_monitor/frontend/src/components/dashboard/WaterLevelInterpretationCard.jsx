import React from 'react';
import { TrendingUp, TrendingDown, Minus, Clock, Gauge, ArrowRightLeft, ShieldAlert, Sparkles } from 'lucide-react';
import { getFloodConfig } from '../../utils/floodUtils';

const MDRRMO_CLASSIFICATIONS = [
  { level: 'NORMAL',     range: '2.0 – 3.0 m', label: 'Normal Level',     color: '#16a34a', bg: 'bg-green-100 dark:bg-green-950/60 border-green-300 dark:border-green-800/60 text-green-800 dark:text-green-300' },
  { level: 'MONITOR',    range: '3.1 – 4.0 m', label: 'Monitor Level',    color: '#d97706', bg: 'bg-amber-100 dark:bg-yellow-950/60 border-amber-300 dark:border-yellow-800/60 text-amber-900 dark:text-yellow-300' },
  { level: 'ALERT',      range: '4.1 – 5.0 m', label: 'Alert Level',      color: '#ea580c', bg: 'bg-orange-100 dark:bg-orange-950/60 border-orange-300 dark:border-orange-800/60 text-orange-900 dark:text-orange-300' },
  { level: 'EVACUATION', range: '5.1 – 6.0 m', label: 'Evacuation Level', color: '#dc2626', bg: 'bg-red-100 dark:bg-red-950/60 border-red-300 dark:border-red-800/60 text-red-900 dark:text-red-300' },
  { level: 'CRITICAL',   range: '6.1 – 7.0 m', label: 'Critical Level',   color: '#7c3aed', bg: 'bg-purple-100 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800/60 text-purple-900 dark:text-purple-300' },
];

export function WaterLevelInterpretationCard({ trendData }) {
  if (!trendData) return null;

  const rawTrend = trendData.trend || 'STABLE';
  const trend = rawTrend === 'FALLING' ? 'RECEDING' : rawTrend;
  const deltaM = trendData.delta_m ?? 0;
  const deltaCm = trendData.delta_cm ?? Math.round(Math.abs(deltaM) * 100);
  const timeIntervalText = trendData.time_interval_text || '10 minutes';
  const rateText = trendData.rate_text || `${trendData.rate_per_hour?.toFixed(2) || '0.00'} m/hr`;
  const currentLevelM = trendData.current_level_m ?? trendData.latest_m ?? 0;
  const floodLevel = trendData.flood_level || 'NORMAL';
  const floodConfig = getFloodConfig(floodLevel);

  const predicted1h = trendData.predicted_level_1h ?? currentLevelM;
  const predicted3h = trendData.predicted_level_3h ?? currentLevelM;
  const predictiveText = trendData.predictive_text || (
    trend === 'RISING'
      ? `At current rate (+${(trendData.rate_per_hour || 0).toFixed(2)} m/hr), water level is predicted to reach ${predicted1h}m in 1h and ${predicted3h}m in 3h.`
      : `Water level is ${trend.toLowerCase()} (${currentLevelM.toFixed(2)}m). No rise predicted over the next 3 hours.`
  );

  const TrendIcon = trend === 'RISING'
    ? TrendingUp
    : trend === 'RECEDING'
    ? TrendingDown
    : Minus;

  const trendBadgeStyle = trend === 'RISING'
    ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40'
    : trend === 'RECEDING'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
    : 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600';

  const deltaDirectionText = trend === 'RISING' ? 'Increased' : trend === 'RECEDING' ? 'Decreased' : 'Stable';
  const deltaSign = trend === 'RISING' ? '+' : trend === 'RECEDING' ? '-' : '';

  const interpretationText = trendData.interpretation || (
    trend === 'RISING'
      ? `Water level increased by ${deltaCm} cm within ${timeIntervalText} and is currently at ${trendData.flood_level_label || floodConfig.label} (${currentLevelM.toFixed(2)} m).`
      : trend === 'RECEDING'
      ? `Water level decreased by ${deltaCm} cm within ${timeIntervalText} and is currently at ${floodLabel} (${currentLevelM.toFixed(2)} m).`
      : `Water level remained stable within ${timeIntervalText} and is currently at ${trendData.flood_level_label || floodConfig.label} (${currentLevelM.toFixed(2)} m).`
  );

  return (
    <div className="bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700/80 rounded-2xl p-5 shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h2 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Water-Level Change Interpretation
          </h2>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${trendBadgeStyle}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          <span>{trend}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Real-time Narrative Interpretation */}
        <div className="bg-slate-900 dark:bg-slate-950 border-l-4 border-sky-500 rounded-r-xl p-4 shadow-inner">
          <div className="text-[11px] font-extrabold text-sky-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span>💬 Interpretation</span>
          </div>
          <p className="text-xs font-bold text-slate-100 italic leading-relaxed">
            "{interpretationText}"
          </p>
        </div>

        {/* Real Predictive Forecast Callout */}
        <div className="bg-amber-950/90 dark:bg-slate-950 border-l-4 border-amber-500 rounded-r-xl p-4 shadow-inner text-amber-100">
          <div className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>🔮 Predictive Forecast (Real-time Sensor Rate)</span>
          </div>
          <p className="text-xs font-bold text-slate-100 italic leading-relaxed">
            "{predictiveText}"
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-bold">
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Amount ({deltaDirectionText})</span>
          </div>
          <div className="mt-2">
            <div className={`text-xl font-black ${trend === 'RISING' ? 'text-red-600 dark:text-red-400' : trend === 'RECEDING' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
              {deltaSign}{deltaCm} <span className="text-xs font-extrabold">cm</span>
            </div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
              ({deltaSign}{Math.abs(deltaM).toFixed(2)} m)
            </div>
          </div>
        </div>

        <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-bold">
            <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Time Interval</span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 dark:text-slate-100">
              {timeIntervalText}
            </div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
              Reading Interval
            </div>
          </div>
        </div>

        <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-bold">
            <Gauge className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Rate of Change</span>
          </div>
          <div className="mt-2">
            <div className={`text-xl font-black ${trend === 'RISING' ? 'text-red-600 dark:text-red-400' : trend === 'RECEDING' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
              {rateText}
            </div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
              Rate per hour
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Official MDRRMO Classifications
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {MDRRMO_CLASSIFICATIONS.map((c) => {
            const isCurrent = floodLevel === c.level;
            return (
              <div
                key={c.level}
                className={`border rounded-lg p-2 text-center transition-all ${c.bg} ${isCurrent ? 'ring-2 ring-sky-500 scale-[1.02] shadow-sm' : 'opacity-90'}`}
              >
                <div className="text-xs font-black">
                  {c.label}
                </div>
                <div className="text-[10px] font-extrabold mt-0.5">
                  {c.range}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
