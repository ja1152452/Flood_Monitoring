import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { useThemeStore } from '../../store/themeStore';

const THRESHOLD_LINES = [
  { y: 3.1, label: 'Monitor (3.1m)',    color: '#D97706', dy: 10 },
  { y: 4.1, label: 'Alert (4.1m)',      color: '#EA580C', dy: 10 },
  { y: 5.1, label: 'Evacuation (5.1m)', color: '#DC2626', dy: 10 },
  { y: 6.1, label: 'Critical (6.1m)',   color: '#7C3AED', dy: -12 },
];

const LEVEL_COLORS = {
  NORMAL:     '#16A34A',
  MONITOR:    '#D97706',
  ALERT:      '#EA580C',
  EVACUATION: '#DC2626',
  CRITICAL:   '#7C3AED',
};

export function WaterLevelChart({ data = [], title = 'Water Level History', floodLevel = '' }) {
  const { isDark } = useThemeStore();
  const strokeColor = LEVEL_COLORS[floodLevel] || '#2563EB';

  // 1. Sort data chronologically ASCENDING (oldest -> newest)
  const validData = (Array.isArray(data) ? data : [])
    .filter(d => d.hour || d.captured_at || d.recorded_at || d.created_at)
    .sort((a, b) => new Date(a.hour || a.captured_at || a.recorded_at || a.created_at) - new Date(b.hour || b.captured_at || b.recorded_at || b.created_at));

  // 2. Downsample high-density readings (e.g. 9000+ points) to max 250 points for smooth performance
  const step = Math.max(1, Math.floor(validData.length / 250));
  const sampled = validData.filter((_, idx) => idx % step === 0);

  const formatted = sampled.map(d => {
    const dt = new Date(d.hour || d.captured_at || d.recorded_at || d.created_at);
    const val = parseFloat(d.avg_level_m || d.water_level_m || 0);
    return {
      time:     format(dt, 'MMM d HH:mm'),
      fullDate: format(dt, 'yyyy-MM-dd HH:mm:ss'),
      level:    parseFloat(val.toFixed(3)),
    };
  });

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          {title}
        </h3>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Showing {formatted.length} data points
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={formatted} margin={{ top: 15, right: 30, left: 10, bottom: 25 }}>
          <defs>
            <linearGradient id="levelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.35} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
          <XAxis
            dataKey="time"
            tick={{ fill: isDark ? '#94a3b8' : '#475569', fontSize: 10, fontWeight: 600 }}
            angle={-20}
            textAnchor="end"
            interval="preserveStartEnd"
          />
          <YAxis
            type="number"
            domain={[0, 8]}
            ticks={[0, 1, 2, 3.1, 4.1, 5.1, 6.1, 8]}
            tickFormatter={(v) => `${v}m`}
            tick={{ fill: isDark ? '#94a3b8' : '#475569', fontSize: 11, fontWeight: 600 }}
            width={45}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
              borderRadius: 12,
              color: isDark ? '#f8fafc' : '#0f172a',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontWeight: 600,
            }}
            labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 700 }}
            formatter={(v) => [`${Number(v).toFixed(3)}m`, 'Water Level']}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
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
                position: 'insideTopLeft',
                dy: t.dy,
                dx: 5,
              }}
            />
          ))}

          <Area
            type="monotone"
            dataKey="level"
            stroke={strokeColor}
            strokeWidth={2.5}
            fill="url(#levelGrad)"
            dot={false}
            activeDot={{ r: 5, stroke: strokeColor, strokeWidth: 2, fill: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}