import { formatWaterLevel, formatTime, getFloodConfig } from '../../utils/floodUtils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function WaterLevelCard({ reading, trend }) {
  const config = getFloodConfig(reading?.flood_level);

  const TrendIcon = trend?.trend === 'RISING'
    ? TrendingUp
    : trend?.trend === 'FALLING'
      ? TrendingDown
      : Minus;

  const trendColor = trend?.trend === 'RISING'
    ? 'text-red-400'
    : trend?.trend === 'FALLING'
      ? 'text-green-400'
      : 'text-slate-400';

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          Water Level
        </span>
        <span className="text-xs text-slate-500">
          {formatTime(reading?.captured_at)}
        </span>
      </div>

      <div className="flex items-end gap-3 mb-4">
        <span className="text-6xl font-bold" style={{ color: config.color }}>
          {formatWaterLevel(reading?.water_level_m)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <TrendIcon size={16} className={trendColor} />
        <span className={`text-sm font-medium ${trendColor}`}>
          {trend?.trend || 'STABLE'}
        </span>
        {trend?.delta_m != null && (
          <span className="text-xs text-slate-500">
            ({trend.delta_m > 0 ? '+' : ''}{trend.delta_m?.toFixed(3)}m)
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="text-xs text-slate-500">
          Confidence: {reading?.confidence != null ? `${(reading.confidence * 100).toFixed(0)}%` : '--'}
        </div>
      </div>
    </div>
  );
}