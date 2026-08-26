import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { useThemeStore } from '../../store/themeStore';

const THRESHOLD_LINES = [
  { y: 3.1, label: 'Monitor (3.1m)',    color: '#D97706' },
  { y: 4.1, label: 'Alert (4.1m)',      color: '#EA580C' },
  { y: 5.1, label: 'Evacuation (5.1m)', color: '#DC2626' },
  { y: 6.1, label: 'Critical (6.1m)',   color: '#7C3AED' },
];

const LEVEL_COLORS = {
  NORMAL:     '#2563EB',
  MONITOR:    '#D97706',
  ALERT:      '#EA580C',
  EVACUATION: '#DC2626',
  CRITICAL:   '#7C3AED',
};

export function WaterLevelChart({ data = [], title = 'Water Level History', floodLevel = '' }) {
  const { isDark } = useThemeStore();

  const { formatted, isMultiDay, yMin, yMax } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return { formatted: [], isMultiDay: false, yMin: 0, yMax: 6.5 };
    }

    // 1. Sort data chronologically by timestamp
    const sorted = [...data].sort((a, b) => {
      const tA = new Date(a.captured_at || a.recorded_at || a.created_at || a.hour || 0).getTime();
      const tB = new Date(b.captured_at || b.recorded_at || b.created_at || b.hour || 0).getTime();
      return tA - tB;
    });

    // 2. Check if data spans multiple days
    const first = new Date(sorted[0].captured_at || sorted[0].recorded_at || sorted[0].created_at || sorted[0].hour || 0);
    const last  = new Date(sorted[sorted.length - 1].captured_at || sorted[sorted.length - 1].recorded_at || sorted[sorted.length - 1].created_at || sorted[sorted.length - 1].hour || 0);
    const multiDay = first.toDateString() !== last.toDateString();

    const fmt = sorted.map(d => {
      const rawTime = d.captured_at || d.recorded_at || d.created_at || d.hour;
      const dt = rawTime ? new Date(rawTime) : new Date();
      const levelVal = parseFloat(d.water_level_m ?? d.avg_level_m ?? 0);
      return {
        timestamp: dt.getTime(),
        timeLabel: multiDay ? format(dt, 'MMM dd HH:mm') : format(dt, 'HH:mm'),
        fullDateTime: format(dt, 'yyyy-MM-dd HH:mm:ss'),
        level: Math.max(0, levelVal),
        status: d.flood_level || d.status || 'NORMAL',
      };
    });

    const levels = fmt.map(d => d.level);
    const minVal = levels.length ? Math.min(...levels) : 0;
    const maxVal = levels.length ? Math.max(...levels) : 3;
    const computedMin = Math.max(0, Math.floor(minVal - 0.2));
    const computedMax = Math.max(6.5, Math.ceil(maxVal + 0.5));

    return {
      formatted: fmt,
      isMultiDay: multiDay,
      yMin: computedMin,
      yMax: computedMax,
    };
  }, [data]);

  const strokeColor = LEVEL_COLORS[floodLevel] || '#2563EB';

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          {title}
        </h3>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Showing {formatted.length} data points
        </span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={formatted} margin={{ top: 15, right: 30, left: 10, bottom: 25 }}>
          <defs>
            <linearGradient id="waterLevelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.45} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} opacity={0.6} />
          
          <XAxis
            dataKey="timeLabel"
            tick={{ fill: isDark ? '#94a3b8' : '#475569', fontSize: 10, fontWeight: 600 }}
            angle={isMultiDay ? -30 : 0}
            textAnchor={isMultiDay ? 'end' : 'middle'}
            interval="preserveStartEnd"
          />
          
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(val) => `${val}m`}
            tick={{ fill: isDark ? '#94a3b8' : '#475569', fontSize: 11, fontWeight: 700 }}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const dataPoint = payload[0].payload;
              return (
                <div className="bg-slate-900/95 border border-slate-700 text-white rounded-xl p-3 shadow-xl backdrop-blur-md text-xs">
                  <div className="font-mono text-slate-400 mb-1">{dataPoint.fullDateTime}</div>
                  <div className="flex items-center gap-2 text-sm font-extrabold" style={{ color: strokeColor }}>
                    <span>Water Level:</span>
                    <span className="text-base">{dataPoint.level.toFixed(3)}m</span>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-300">
                    Status: <span className="uppercase">{dataPoint.status}</span>
                  </div>
                </div>
              );
            }}
          />

          {THRESHOLD_LINES.map(t => (
            <ReferenceLine
              key={t.label}
              y={t.y}
              stroke={t.color}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: t.label,
                fill: t.color,
                fontSize: 10,
                fontWeight: 'bold',
                position: 'insideTopRight',
                dy: -12,
              }}
            />
          ))}

          <Area
            type="monotone"
            dataKey="level"
            stroke={strokeColor}
            strokeWidth={3}
            fill="url(#waterLevelGrad)"
            activeDot={{ r: 6, fill: strokeColor, stroke: '#ffffff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}