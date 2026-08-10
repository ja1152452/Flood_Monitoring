import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

const THRESHOLD_LINES = [
  { y: 3.1, label: 'Monitor',    color: '#F59E0B' },
  { y: 4.1, label: 'Alert',      color: '#F97316' },
  { y: 5.1, label: 'Evacuation', color: '#ff0000' },
  { y: 6.1, label: 'Critical',   color: '#7C3AED' },
];

const LEVEL_COLORS = {
  NORMAL:     '#22c55e',
  MONITOR:    '#F59E0B',
  ALERT:      '#F97316',
  EVACUATION: '#ef4444',
  CRITICAL:   '#7C3AED',
};

export function WaterLevelChart({ data = [], title = 'Water Level History', floodLevel = '' }) {
  const strokeColor = LEVEL_COLORS[floodLevel] || '#3B82F6';
  const formatted = data.map(d => ({
    time:  format(new Date(d.hour || d.captured_at), 'HH:mm'),
    level: parseFloat(d.avg_level_m || d.water_level_m || 0),
    max:   parseFloat(d.max_level_m || d.water_level_m || 0),
  }));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
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
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis domain={[0, 8]} tick={{ fill: '#64748b', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(v) => [`${v.toFixed(2)}m`, 'Water Level']}
          />
          {THRESHOLD_LINES.map(t => (
            <ReferenceLine key={t.label} y={t.y} stroke={t.color}
              strokeDasharray="4 4" strokeWidth={1}
              label={{ value: t.label, fill: t.color, fontSize: 10, position: 'insideTopRight' }}
            />
          ))}
          <Area type="monotone" dataKey="level" stroke={strokeColor}
            strokeWidth={2} fill="url(#levelGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}