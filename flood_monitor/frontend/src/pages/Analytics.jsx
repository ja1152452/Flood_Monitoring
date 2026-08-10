import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserStats } from '../api/users';
import { getSummary, getHourlyData } from '../api/analytics';
import { getAlertHistory } from '../api/alerts';
import { getAllReadings } from '../api/readings';
import { getWeather } from '../api/weather';
import { getEvacuationCenters } from '../api/evacuation';
import { WaterLevelChart } from '../components/dashboard/WaterLevelChart';
import { formatDateTime, getFloodConfig } from '../utils/floodUtils';
import { FileDown, X, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts';

const CAMERA_ID = '3b7e2b66-d4d5-4ae9-be3f-1c7c31e5b03f';
const CAMERA_ID_READINGS = CAMERA_ID;

const RISK_COLORS = {
  VERY_HIGH: '#ef4444',
  HIGH:      '#f97316',
  MODERATE:  '#f59e0b',
  LOW:       '#22c55e',
};

const STATUS_COLORS = {
  NORMAL:     '#22c55e',
  MONITOR:    '#eab308',
  ALERT:      '#f97316',
  EVACUATION: '#ef4444',
  CRITICAL:   '#7c3aed',
};

const ROLE_COLORS = {
  SUPER_ADMIN:       '#7c3aed',
  ADMIN:             '#3b82f6',
  RESCUE:            '#22c55e',
  CITIZEN:           '#94a3b8',
  MDRRMO:            '#f97316',
  MSWDO:             '#06b6d4',
  BARANGAY_OFFICIAL: '#f59e0b',
  BFP:               '#ef4444',
  PNP:               '#0ea5e9',
  RHU:               '#a855f7',
};

const ROLE_LABELS = {
  SUPER_ADMIN:       'Super Admin',
  ADMIN:             'MSWDO',
  RESCUE:            'Responder',
  CITIZEN:           'Resident',
  MDRRMO:            'MDRRMO',
  MSWDO:             'MSWDO Staff',
  BARANGAY_OFFICIAL: 'Barangay Official',
  BFP:               'BFP',
  PNP:               'PNP',
  RHU:               'RHU',
};

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
  labelStyle:   { color: '#94a3b8', fontSize: 12 },
  itemStyle:    { color: '#f1f5f9', fontSize: 12 },
};

function StatCard({ label, value, sub, color = 'text-slate-900 dark:text-white' }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm dark:shadow-none">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-4xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-2">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, sub, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm dark:shadow-none">
      <div className="mb-4">
        <div className="text-sm font-semibold text-slate-300">{title}</div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getWeekRange(weekStr) {
  // weekStr = "YYYY-Www"
  const [year, w] = weekStr.split('-W');
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const start = new Date(startOfWeek1);
  start.setDate(startOfWeek1.getDate() + (parseInt(w) - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export default function Analytics() {
  const now = new Date();
  const [wlFilter, setWlFilter] = useState({
    type:        'month',
    month:       now.getMonth(),
    year:        now.getFullYear(),
    date:        `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,
    week:        `${now.getFullYear()}-W${String(Math.ceil((now - new Date(now.getFullYear(),0,1)) / 604800000)).padStart(2,'0')}`,
    flood_level: '',
  });
  const [pdfPreview, setPdfPreview] = useState(null); // { url, filename }

  const { data: stats } = useQuery({
    queryKey:       ['user-stats'],
    queryFn:        getUserStats,
    refetchInterval: 60000,
  });

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn:  getSummary,
    refetchInterval: 60000,
  });

  const { data: hourly = [] } = useQuery({
    queryKey:       ['hourly', CAMERA_ID],
    queryFn:        () => getHourlyData(CAMERA_ID, 24),
    refetchInterval: 60000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['alert-history'],
    queryFn:  () => getAlertHistory({ limit: 20 }),
  });

  // Water level history with filters
  const wlParams = useMemo(() => {
    if (wlFilter.type === 'date') return { date: wlFilter.date, limit: 50000, ...(wlFilter.flood_level && { flood_level: wlFilter.flood_level }) };
    if (wlFilter.type === 'week') {
      const { start, end } = getWeekRange(wlFilter.week);
      // use local date strings so backend AT TIME ZONE handles the boundary
      const from = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}T00:00:00+08:00`;
      const to   = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}T23:59:59+08:00`;
      return { from, to, limit: 50000, ...(wlFilter.flood_level && { flood_level: wlFilter.flood_level }) };
    }
    // month
    const y = wlFilter.year, m = String(wlFilter.month + 1).padStart(2,'0');
    const lastDay = new Date(wlFilter.year, wlFilter.month + 1, 0).getDate();
    return {
      from: `${y}-${m}-01T00:00:00+08:00`,
      to:   `${y}-${m}-${String(lastDay).padStart(2,'0')}T23:59:59+08:00`,
      limit: 50000,
      ...(wlFilter.flood_level && { flood_level: wlFilter.flood_level }),
    };
  }, [wlFilter]);

  const { data: wlHistory = [], isFetching: wlLoading } = useQuery({
    queryKey: ['wl-history', wlParams],
    queryFn:  () => getAllReadings(CAMERA_ID_READINGS, wlParams),
  });

  // All evacuees across all centers
  const { data: centers = [] } = useQuery({
    queryKey: ['evacuation'],
    queryFn:  getEvacuationCenters,
  });

  const { data: allFamilies = [] } = useQuery({
    queryKey: ['all-families', centers.map(c => c.id)],
    queryFn:  async () => {
      const results = await Promise.all(
        centers.map(c => api.get(`/evacuation/${c.id}/families`).then(r => (r.data.data || []).map(f => ({ ...f, center_name: c.name }))))
      );
      return results.flat();
    },
    enabled: centers.length > 0,
  });

  const { data: weather } = useQuery({
    queryKey: ['weather'],
    queryFn:  getWeather,
    refetchInterval: 300000,
  });
  const weatherLabel = weather ? `${weather.description}, ${weather.temp}°C` : '—';

  const buildWlPdf = () => {
    const rows = Array.isArray(wlHistory) ? wlHistory : [];
    const doc = new jsPDF();
    doc.setFontSize(16); doc.setTextColor(30, 41, 59);
    doc.text('Water Level History & Flood Monitoring Report', 14, 16);
    doc.setFontSize(9); doc.setTextColor(100);
    const label = wlFilter.type === 'date' ? wlFilter.date
      : wlFilter.type === 'week' ? `Week ${wlFilter.week}`
      : `${MONTHS[wlFilter.month]} ${wlFilter.year}`;
    doc.text(`Period: ${label}`, 14, 23);
    doc.text(`Weather: ${weatherLabel}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 14, 33);
    autoTable(doc, {
      startY: 39,
      head: [['Date', 'Time', 'Water Level (m)', 'Status', 'Weather']],
      body: rows.map(r => {
        const dt = new Date(r.captured_at || r.recorded_at || r.created_at);
        return [
          dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
          dt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          r.water_level_m != null ? parseFloat(r.water_level_m).toFixed(3) : '—',
          r.flood_level || r.status || '—',
          weatherLabel,
        ];
      }),
      styles: { fontSize: 8, textColor: [30, 41, 59] },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
      columnStyles: { 3: { fontStyle: 'bold' } },
    });
    return doc;
  };

  const handleWlExport = () => {
    const doc = buildWlPdf();
    const label = wlFilter.type === 'date' ? wlFilter.date
      : wlFilter.type === 'week' ? wlFilter.week
      : `${wlFilter.year}-${String(wlFilter.month + 1).padStart(2,'0')}`;
    const filename = `water-level-history-${label}.pdf`;
    const url = doc.output('bloburl');
    setPdfPreview({ url, filename });
  };

  const byBarangay  = stats?.by_barangay  || [];
  const byRole      = stats?.by_role      || [];
  const sosStat     = stats?.sos_stats    || {};
  const sosBarangay = stats?.sos_barangay || [];
  const sosTimeline = stats?.sos_timeline || [];

  const totalUsers    = byRole.reduce((s, r) => s + parseInt(r.count), 0);
  const totalRescuers = byRole.find(r => r.role === 'RESCUE')?.count || 0;
  const totalResidents= byRole.find(r => r.role === 'CITIZEN')?.count || 0;

  const roleChartData = byRole.map(r => ({
    name:  ROLE_LABELS[r.role] || r.role,
    value: parseInt(r.count),
    color: ROLE_COLORS[r.role] || '#64748b',
  }));

  const barangayChartData = byBarangay
    .filter(b => parseInt(b.total_users) > 0)
    .slice(0, 12)
    .map(b => ({
      name:      b.barangay.replace(' (Poblacion)', '').replace('(Residential)', ''),
      residents: parseInt(b.residents || 0),
      rescuers:  parseInt(b.rescuers  || 0),
      total:     parseInt(b.total_users),
      risk:      b.risk_level,
    }));

  const sosBarangayChart = sosBarangay
    .filter(b => parseInt(b.total_sos) > 0)
    .map(b => ({
      name:     b.barangay.replace(' (Poblacion)', ''),
      total:    parseInt(b.total_sos),
      resolved: parseInt(b.resolved || 0),
      pending:  parseInt(b.total_sos) - parseInt(b.resolved || 0),
      risk:     b.risk_level,
    }));

  const timelineData = sosTimeline.map(r => ({
    date:     new Date(r.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
    total:    parseInt(r.total),
    resolved: parseInt(r.resolved),
  }));

  const responseRate = sosStat.total > 0
    ? Math.round((sosStat.resolved / sosStat.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          System-wide data overview — users, SOS requests, and water level trends
        </p>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          User Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users"   value={totalUsers}    sub="All registered accounts" />
          <StatCard label="Responders"    value={totalRescuers}  sub="Barangay rescue teams"  color="text-green-400" />
          <StatCard label="Residents"     value={totalResidents} sub="Registered via mobile"  color="text-blue-400"  />
          <StatCard label="Barangays"     value={byBarangay.filter(b => b.total_users > 0).length} sub="With registered users" color="text-amber-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Users per Barangay" sub="Residents and responders breakdown">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barangayChartData} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#64748b', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="residents" name="Residents"  fill="#3b82f6" radius={[3,3,0,0]} />
              <Bar dataKey="rescuers"  name="Responders" fill="#22c55e" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Users by Role" sub="Distribution across all roles">
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={roleChartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value">
                  {roleChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(val, name) => [val, name]}
                />
                <Legend
                  formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          SOS Rescue Requests
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
          <StatCard label="Total SOS"   value={sosStat.total    || 0} />
          <StatCard label="Resolved"    value={sosStat.resolved || 0} color="text-green-400"
            sub={`${responseRate}% response rate`} />
          <StatCard label="Pending"     value={sosStat.pending  || 0}
            color={(sosStat.pending || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'} />
          <StatCard label="Responding"  value={sosStat.responding || 0} color="text-blue-400" />
          <StatCard label="Avg Response" value={sosStat.avg_response_min ? `${sosStat.avg_response_min}m` : '—'}
            sub="Average response time" color="text-amber-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="SOS Requests per Barangay" sub="Total vs resolved by area">
          {sosBarangayChart.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              No SOS data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sosBarangayChart} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="total"    name="Total SOS"  fill="#ef4444" radius={[3,3,0,0]} />
                <Bar dataKey="resolved" name="Resolved"   fill="#22c55e" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="SOS Timeline (30 days)" sub="Daily requests and resolutions">
          {timelineData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              No SOS data in the last 30 days
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Line type="monotone" dataKey="total"    name="Total SOS"
                  stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} />
                <Line type="monotone" dataKey="resolved" name="Resolved"
                  stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Water Level History with filters */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Water Level History</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter type tabs */}
            {['month','date','week'].map(t => (
              <button key={t}
                onClick={() => setWlFilter(f => ({ ...f, type: t }))}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  wlFilter.type === t 
                    ? 'bg-blue-600 text-white hover:bg-blue-500' 
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                }`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            {/* Filter inputs */}
            {wlFilter.type === 'month' && (
              <>
                <select value={wlFilter.month} onChange={e => setWlFilter(f => ({ ...f, month: +e.target.value }))}
                  className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select value={wlFilter.year} onChange={e => setWlFilter(f => ({ ...f, year: +e.target.value }))}
                  className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}
            {wlFilter.type === 'date' && (
              <input type="date" value={wlFilter.date}
                onChange={e => setWlFilter(f => ({ ...f, date: e.target.value }))}
                className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
            {wlFilter.type === 'week' && (
              <input type="week" value={wlFilter.week}
                onChange={e => setWlFilter(f => ({ ...f, week: e.target.value }))}
                className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
            <select value={wlFilter.flood_level}
              onChange={e => setWlFilter(f => ({ ...f, flood_level: e.target.value }))}
              className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Levels</option>
              <option value="NORMAL">Normal</option>
              <option value="MONITOR">Monitor</option>
              <option value="ALERT">Alert</option>
              <option value="EVACUATION">Evacuation</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <button onClick={handleWlExport} disabled={wlLoading}
              className="flex items-center gap-1.5 text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-900 dark:text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
              <FileDown size={13} />
              {wlLoading ? 'Loading...' : 'Export PDF'}
            </button>
          </div>
        </div>
        <WaterLevelChart data={wlHistory} floodLevel={wlFilter.flood_level} title={`Water Level History — ${wlFilter.type === 'date' ? wlFilter.date : wlFilter.type === 'week' ? `Week ${wlFilter.week}` : `${MONTHS[wlFilter.month]} ${wlFilter.year}`}`} />

        {/* Detailed Water Level Readings Table (Transferred from Flood Reports) */}
        <div className="mt-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-300">Detailed Water Level Readings</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {wlHistory.length} total readings recorded · Current weather: {weatherLabel}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  {['Date', 'Time', 'Water Level', 'Status', 'Weather'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                {wlHistory.map(r => {
                  const dt = new Date(r.captured_at || r.recorded_at || r.created_at);
                  const config = getFloodConfig(r.flood_level || r.status);
                  const statusColor = STATUS_COLORS[r.flood_level || r.status] || '#64748b';
                  return (
                    <tr key={r.id || r.captured_at} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-300">
                        {dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-slate-400">
                        {dt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-5 py-3 text-sm font-bold" style={{ color: statusColor }}>
                        {r.water_level_m != null ? `${parseFloat(r.water_level_m).toFixed(3)} m` : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                          style={{ backgroundColor: statusColor + '22', color: statusColor }}>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-400">
                        {weatherLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {wlHistory.length === 0 && !wlLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500 text-sm">
              <span className="text-3xl">🌊</span>
              <p>No water level readings found for this period</p>
            </div>
          )}
          {wlLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* PDF Preview Modal */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">PDF Preview — {pdfPreview.filename}</span>
              <div className="flex items-center gap-2">
                <a href={pdfPreview.url} download={pdfPreview.filename}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  <FileDown size={13} /> Download
                </a>
                <button onClick={() => setPdfPreview(null)} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors p-1">
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe key={pdfPreview.url} src={pdfPreview.url} className="flex-1 w-full rounded-b-2xl" title="PDF Preview" />
          </div>
        </div>
      )}

      {/* All Evacuee Data */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Evacuee Data (All Centers)</h2>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
          {allFamilies.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
              <Users size={28} className="mr-2 opacity-30" /> No evacuee records
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['#','Head of Family','Age','Barangay','Members','Contact','Arrival Date','Center','Notes'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                  {allFamilies.map((f, i) => (
                    <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-500 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{f.head_name}</td>
                      <td className="px-4 py-3 text-slate-400">{f.age || '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{f.barangay || '—'}</td>
                      <td className="px-4 py-3 text-blue-400 font-semibold">{f.members}</td>
                      <td className="px-4 py-3 text-slate-400">{f.contact || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{f.center_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[140px] truncate">{f.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {byBarangay.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Barangay Registration Details
          </h2>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Barangay','Risk Level','Total Users','Responders','Residents'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                {byBarangay.map(b => (
                  <tr key={b.barangay} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{b.barangay}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: RISK_COLORS[b.risk_level] + '22',
                          color:           RISK_COLORS[b.risk_level] || '#94a3b8',
                        }}>
                        {b.risk_level?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-900 dark:text-white font-semibold">{b.total_users}</td>
                    <td className="px-5 py-3 text-green-400">{b.rescuers || 0}</td>
                    <td className="px-5 py-3 text-blue-400">{b.residents || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}