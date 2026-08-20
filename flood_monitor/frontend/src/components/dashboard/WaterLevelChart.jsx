import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { useThemeStore } from '../../store/themeStore';

const THRESHOLD_LINES = [
  { y: 3.1, label: 'Monitor',    color: '#D97706' },
  { y: 4.1, label: 'Alert',      color: '#EA580C' },
  { y: 5.1, label: 'Evacuation', color: '#DC2626' },
  { y: 6.1, label: 'Critical',   color: '#7C3AED' },
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
  const formatted = data.map(d => ({
    time:  format(new Date(d.hour || d.captured_at), 'HH:mm'),
    level: parseFloat(d.avg_level_m || d.water_level_m || 0),
    max:   parseFloat(d.max_level_m || d.water_level_m || 0),
  }));

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={formatted} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="levelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
          <XAxis dataKey="time" tick={{ fill: isDark ? '#94a3b8' : '#475569', fontSize: 11, fontWeight: 600 }} />
          <YAxis domain={[0, 8]} tick={{ fill: isDark ? '#94a3b8' : '#475569', fontSize: 11, fontWeight: 600 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
              borderRadius: 12,
              color: isDark ? '#f8fafc' : '#0f172a',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              fontWeight: 600,
            }}
            labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 700 }}
            formatter={(v) => [`${v.toFixed(2)}m`, 'Water Level']}
          />
          {THRESHOLD_LINES.map(t => (
            <ReferenceLine key={t.label} y={t.y} stroke={t.color}
              strokeDasharray="4 4" strokeWidth={1.5}
              label={{ value: t.label, fill: t.color, fontSize: 10, fontWeight: 'bold', position: 'insideTopRight' }}
            />
          ))}
          <Area type="monotone" dataKey="level" stroke={strokeColor}
            strokeWidth={2.5} fill="url(#levelGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}