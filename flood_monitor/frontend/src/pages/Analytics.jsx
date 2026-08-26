import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserStats } from '../api/users';
import { getSummary, getHourlyData } from '../api/analytics';
import { getAlertHistory } from '../api/alerts';
import { getAllReadings } from '../api/readings';
import { getWeather } from '../api/weather';
import { getEvacuationCenters } from '../api/evacuation';
import { WaterLevelChart } from '../components/dashboard/WaterLevelChart';
import { formatDateTime, getFloodConfig } from '../utils/floodUtils';
import { FileDown, X, Users, Activity, Waves, Clock, CheckCircle2, Trash2, RefreshCw } from 'lucide-react';
import { getStoredDrillSessions, deleteDrillSession } from '../utils/simulationRecorder';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, ReferenceLine,
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
  NORMAL:     '#16a34a',
  MONITOR:    '#d97706',
  ALERT:      '#ea580c',
  EVACUATION: '#dc2626',
  CRITICAL:   '#7e22ce',
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
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
      <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-4xl font-black ${color}`}>{value}</div>
      {sub && <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, sub, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
      <div className="mb-4">
        <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">{title}</div>
        {sub && <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getWeekRange(weekStr) {
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
  
  // Data Source Switcher: 'live' (Real Database) vs 'simulation' (Drill Recordings)
  const [dataSource, setDataSource] = useState('live');

  // Simulation Drill Sessions
  const [drillSessions, setDrillSessions] = useState(() => getStoredDrillSessions());
  const [selectedDrillId, setSelectedDrillId] = useState(() => drillSessions[0]?.id || '');

  const refreshDrills = () => {
    const updated = getStoredDrillSessions();
    setDrillSessions(updated);
    if (!updated.some(s => s.id === selectedDrillId)) {
      setSelectedDrillId(updated[0]?.id || '');
    }
  };

  useEffect(() => {
    refreshDrills();
  }, [dataSource]);

  const selectedDrill = useMemo(() => {
    return drillSessions.find(s => s.id === selectedDrillId) || drillSessions[0] || null;
  }, [drillSessions, selectedDrillId]);

  const [wlFilter, setWlFilter] = useState({
    type:        'month',
    month:       now.getMonth(),
    year:        now.getFullYear(),
    date:        `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,
    week:        `${now.getFullYear()}-W${String(Math.ceil((now - new Date(now.getFullYear(),0,1)) / 604800000)).padStart(2,'0')}`,
    flood_level: '',
  });
  const [pdfPreview, setPdfPreview] = useState(null);

  const { data: stats } = useQuery({
    queryKey:       ['user-stats'],
    queryFn:        getUserStats,
    refetchInterval: 60000,
    enabled: dataSource === 'live',
  });

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn:  getSummary,
    refetchInterval: 60000,
    enabled: dataSource === 'live',
  });

  const { data: hourly = [] } = useQuery({
    queryKey:       ['hourly', CAMERA_ID],
    queryFn:        () => getHourlyData(CAMERA_ID, 24),
    refetchInterval: 60000,
    enabled: dataSource === 'live',
  });

  const { data: history = [] } = useQuery({
    queryKey: ['alert-history'],
    queryFn:  () => getAlertHistory({ limit: 20 }),
    enabled: dataSource === 'live',
  });

  const wlParams = useMemo(() => {
    if (wlFilter.type === 'date') {
      return { date: wlFilter.date, limit: 5000 };
    }
    if (wlFilter.type === 'week') {
      const { start, end } = getWeekRange(wlFilter.week);
      return {
        from:  `${start.toISOString().slice(0,10)}T00:00:00+08:00`,
        to:    `${end.toISOString().slice(0,10)}T23:59:59+08:00`,
        limit: 5000,
      };
    }
    const y = wlFilter.year;
    const m = String(wlFilter.month + 1).padStart(2, '0');
    const lastDay = new Date(y, wlFilter.month + 1, 0).getDate();
    return {
      from:  `${y}-${m}-01T00:00:00+08:00`,
      to:    `${y}-${m}-${String(lastDay).padStart(2,'0')}T23:59:59+08:00`,
      limit: 5000,
    };
  }, [wlFilter]);

  const { data: wlHistory = [], isFetching: wlLoading } = useQuery({
    queryKey: ['all-readings', wlParams],
    queryFn:  () => getAllReadings(CAMERA_ID_READINGS, wlParams),
    enabled:  dataSource === 'live',
  });

  const processedWlHistory = useMemo(() => {
    if (!Array.isArray(wlHistory) || wlHistory.length <= 250) return wlHistory;
    const step = Math.ceil(wlHistory.length / 200);
    const sampled = [];
    for (let i = 0; i < wlHistory.length; i += step) {
      sampled.push(wlHistory[i]);
    }
    return sampled;
  }, [wlHistory]);

  const { data: centers = [] } = useQuery({
    queryKey: ['evacuation-centers'],
    queryFn:  getEvacuationCenters,
    enabled:  dataSource === 'live',
  });

  const { data: allFamilies = [] } = useQuery({
    queryKey: ['all-families', centers.map(c => c.id)],
    queryFn:  async () => {
      const results = await Promise.all(
        centers.map(c => api.get(`/evacuation/${c.id}/families`).then(r => (r.data.data || []).map(f => ({ ...f, center_name: c.name }))))
      );
      return results.flat();
    },
    enabled: centers.length > 0 && dataSource === 'live',
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

  const buildDrillPdf = () => {
    if (!selectedDrill) return null;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.setTextColor(30, 41, 59);
    doc.text(`Simulation Drill Evaluation Report — ${selectedDrill.name}`, 14, 16);
    doc.setFontSize(9); doc.setTextColor(100);
    doc.text(`Drill Duration: ${selectedDrill.durationSec}s | Peak Level: ${selectedDrill.peakLevelM.toFixed(2)}m (${selectedDrill.peakCategory})`, 14, 23);
    doc.text(`Started: ${new Date(selectedDrill.startedAt).toLocaleString('en-PH')} | Logged Data Points: ${selectedDrill.pointsCount}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 14, 33);
    autoTable(doc, {
      startY: 39,
      head: [['Elapsed (s)', 'Time of Day', 'Water Level (m)', 'Level (cm)', 'Status', 'Phase', 'Rate (m/hr)']],
      body: (selectedDrill.points || []).map(p => [
        `+${p.elapsedSec}s`,
        p.timestamp || '—',
        p.waterLevelM.toFixed(2),
        `${p.waterLevelCm} cm`,
        p.floodLevel,
        p.phase || '—',
        `${p.ratePerHour} m/hr`,
      ]),
      styles: { fontSize: 8, textColor: [30, 41, 59] },
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
      columnStyles: { 4: { fontStyle: 'bold' } },
    });
    return doc;
  };

  const handleDrillExport = () => {
    const doc = buildDrillPdf();
    if (!doc) return;
    const filename = `simulation-drill-report-${selectedDrill.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.pdf`;
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
      rescuers:  parseInt(b.rescuers || 0),
    }));

  const sosBarangayData = sosBarangay
    .slice(0, 8)
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

  // Simulation Drill Stats & Chart Data
  const drillChartData = useMemo(() => {
    if (!selectedDrill || !selectedDrill.points) return [];
    return selectedDrill.points.map(p => ({
      time: `${p.elapsedSec}s`,
      level: p.waterLevelM,
      category: p.floodLevel,
    }));
  }, [selectedDrill]);

  const drillCategoryDistribution = useMemo(() => {
    if (!selectedDrill || !selectedDrill.points) return [];
    const counts = { NORMAL: 0, MONITOR: 0, ALERT: 0, EVACUATION: 0, CRITICAL: 0 };
    selectedDrill.points.forEach(p => {
      if (counts[p.floodLevel] !== undefined) counts[p.floodLevel]++;
    });
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([level, count]) => ({
        name: getFloodConfig(level).label,
        value: count,
        color: STATUS_COLORS[level],
      }));
  }, [selectedDrill]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
            System-wide data analytics — real-time sensor metrics and simulated drill evaluation
          </p>
        </div>
      </div>

      {/* DATA SOURCE TOGGLE: Real Live River Data vs Simulation Drill Data */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Select Data Source:
          </span>
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
            <button
              onClick={() => setDataSource('live')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                dataSource === 'live'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}>
              <Activity size={14} />
              Real Live River Data
            </button>
            <button
              onClick={() => setDataSource('simulation')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                dataSource === 'simulation'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}>
              <Waves size={14} />
              Simulation Drill Data
            </button>
          </div>
        </div>

        {dataSource === 'simulation' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500">Drill Session:</span>
            <select
              value={selectedDrillId}
              onChange={(e) => setSelectedDrillId(e.target.value)}
              className="text-xs font-extrabold bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
              {drillSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationSec}s)
                </option>
              ))}
            </select>
            <button
              onClick={refreshDrills}
              className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              title="Refresh Drills">
              <RefreshCw size={14} />
            </button>
            <button
              onClick={handleDrillExport}
              disabled={!selectedDrill}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm">
              <FileDown size={13} />
              Export Drill PDF
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: SIMULATION DRILL DATA ANALYTICS                   */}
      {/* ======================================================== */}
      {dataSource === 'simulation' && selectedDrill && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Drill Session Overview: <span className="text-indigo-400 font-extrabold">{selectedDrill.name}</span>
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                Started: {new Date(selectedDrill.startedAt).toLocaleString('en-PH')} · {selectedDrill.pointsCount} points logged
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Peak Water Level"
                value={`${selectedDrill.peakLevelM.toFixed(2)}m`}
                sub={`Max Threshold: ${selectedDrill.peakCategory}`}
                color={STATUS_COLORS[selectedDrill.peakCategory] ? `text-${STATUS_COLORS[selectedDrill.peakCategory]}` : 'text-indigo-400'}
              />
              <StatCard
                label="Drill Duration"
                value={`${selectedDrill.durationSec}s`}
                sub="Elapsed Scenario Time"
                color="text-blue-600 dark:text-blue-400"
              />
              <StatCard
                label="Time to Warning"
                value={selectedDrill.timeToMonitorSec != null ? `${selectedDrill.timeToMonitorSec}s` : 'N/A'}
                sub="Monitor Level Breach (3.1m)"
                color="text-amber-600 dark:text-amber-400"
              />
              <StatCard
                label="Time to Evacuation"
                value={selectedDrill.timeToEvacuationSec != null ? `${selectedDrill.timeToEvacuationSec}s` : 'N/A'}
                sub="Evacuation Level Breach (5.1m)"
                color="text-red-600 dark:text-red-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Chart 1: Water Level Progression Line Chart */}
            <div className="lg:col-span-2">
              <ChartCard title="Simulated Water Level Progression" sub="Water height (meters) vs scenario timeline">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={drillChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis domain={[0, 7.0]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <ReferenceLine y={3.1} stroke="#d97706" strokeDasharray="4 4" label={{ value: 'Monitor (3.1m)', fill: '#d97706', fontSize: 10 }} />
                    <ReferenceLine y={4.1} stroke="#ea580c" strokeDasharray="4 4" label={{ value: 'Alert (4.1m)', fill: '#ea580c', fontSize: 10 }} />
                    <ReferenceLine y={5.1} stroke="#dc2626" strokeDasharray="4 4" label={{ value: 'Evacuation (5.1m)', fill: '#dc2626', fontSize: 10 }} />
                    <ReferenceLine y={6.1} stroke="#7e22ce" strokeDasharray="4 4" label={{ value: 'Critical (6.1m)', fill: '#7e22ce', fontSize: 10 }} />
                    <Line type="monotone" dataKey="level" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Chart 2: Category Distribution Pie Chart */}
            <div className="lg:col-span-1">
              <ChartCard title="Time Spent per Severity Tier" sub="Proportion of drill duration per threshold">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={drillCategoryDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                      {drillCategoryDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>

          {/* Drill Data Point Records Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Drill Session Log Records ({selectedDrill.points.length} entries)
              </h2>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      {['Elapsed (s)', 'Time of Day', 'Water Level (m)', 'Level (cm)', 'Flood Status', 'Drill Phase', 'Rate of Rise'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                    {selectedDrill.points.map((p, i) => {
                      const cfg = getFloodConfig(p.floodLevel);
                      return (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-5 py-2.5 font-bold text-slate-900 dark:text-white">+{p.elapsedSec}s</td>
                          <td className="px-5 py-2.5 text-xs text-slate-500">{p.timestamp}</td>
                          <td className="px-5 py-2.5 font-black text-indigo-400">{p.waterLevelM.toFixed(2)}m</td>
                          <td className="px-5 py-2.5 text-slate-600 dark:text-slate-300 text-xs font-semibold">{p.waterLevelCm} cm</td>
                          <td className="px-5 py-2.5">
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: cfg.color + '22',
                                color: cfg.color,
                              }}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-xs font-bold uppercase text-slate-500">{p.phase}</td>
                          <td className="px-5 py-2.5 text-xs font-bold text-slate-400">{p.ratePerHour} m/hr</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: REAL LIVE RIVER DATA ANALYTICS                   */}
      {/* ======================================================== */}
      {dataSource === 'live' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              User Overview
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Users"   value={totalUsers}    sub="All registered accounts" />
              <StatCard label="Responders"    value={totalRescuers}  sub="Barangay rescue teams"  color="text-emerald-600 dark:text-emerald-400" />
              <StatCard label="Residents"     value={totalResidents} sub="Registered via mobile"  color="text-blue-600 dark:text-blue-400"  />
              <StatCard label="Barangays"     value={byBarangay.filter(b => b.total_users > 0).length} sub="With registered users" color="text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Users per Barangay" sub="Residents and responders breakdown">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barangayChartData} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="residents" name="Residents"  fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rescuers"  name="Responders" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="User Roles Distribution" sub="Account breakdown by system role">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={roleChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value">
                    {roleChartData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              SOS Emergency Requests
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <StatCard label="Total SOS"       value={sosStat.total     || 0} sub="All time requests" />
              <StatCard label="Resolved"        value={sosStat.resolved  || 0} sub={`${responseRate}% resolution rate`} color="text-emerald-600 dark:text-emerald-400" />
              <StatCard label="Pending"         value={sosStat.pending   || 0} sub="Awaiting response" color="text-amber-600 dark:text-amber-400" />
              <StatCard label="Critical/Evac"   value={sosStat.critical  || 0} sub="Urgent priority"   color="text-red-600 dark:text-red-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="SOS Requests by Barangay" sub="Resolved vs pending per area">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={sosBarangayData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="resolved" name="Resolved" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pending"  name="Pending"  fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="SOS Requests Over Time" sub="Daily emergency volume (last 14 days)">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Line type="monotone" dataKey="total"    name="Total SOS" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="resolved" name="Resolved"  stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              24-Hour Real-Time River Trend
            </h2>
            <WaterLevelChart data={hourly} title="24-Hour Water Level Trend (Hourly Sensor Feed)" />
          </div>

          {/* Water Level History with Filter & PDF Export */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Water Level History & Export Report
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {['month','date','week'].map(t => (
                  <button key={t}
                    onClick={() => setWlFilter(f => ({ ...f, type: t }))}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
                      wlFilter.type === t 
                        ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm' 
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
                {wlFilter.type === 'month' && (
                  <>
                    <select value={wlFilter.month} onChange={e => setWlFilter(f => ({ ...f, month: +e.target.value }))}
                      className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
                      {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={wlFilter.year} onChange={e => setWlFilter(f => ({ ...f, year: +e.target.value }))}
                      className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
                      {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </>
                )}
                {wlFilter.type === 'date' && (
                  <input type="date" value={wlFilter.date}
                    onChange={e => setWlFilter(f => ({ ...f, date: e.target.value }))}
                    className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
                )}
                {wlFilter.type === 'week' && (
                  <input type="week" value={wlFilter.week}
                    onChange={e => setWlFilter(f => ({ ...f, week: e.target.value }))}
                    className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
                )}
                <select value={wlFilter.flood_level} onChange={e => setWlFilter(f => ({ ...f, flood_level: e.target.value }))}
                  className="bg-white border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
                  <option value="">All Levels</option>
                  <option value="NORMAL">Normal</option>
                  <option value="MONITOR">Monitor</option>
                  <option value="ALERT">Alert</option>
                  <option value="EVACUATION">Evacuation</option>
                  <option value="CRITICAL">Critical</option>
                </select>
                <button onClick={handleWlExport} disabled={wlLoading}
                  className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 px-3.5 py-1.5 rounded-lg transition-colors font-bold shadow-sm">
                  <FileDown size={13} />
                  {wlLoading ? 'Loading...' : 'Export PDF Report'}
                </button>
              </div>
            </div>

            <WaterLevelChart
              data={processedWlHistory}
              floodLevel={wlFilter.flood_level}
              title={`Water Level History — ${wlFilter.type === 'date' ? wlFilter.date : wlFilter.type === 'week' ? `Week ${wlFilter.week}` : `${MONTHS[wlFilter.month]} ${wlFilter.year}`}`}
            />

            {/* Detailed Water Level Readings Table */}
            <div className="mt-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Detailed Water Level Readings</h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {wlHistory.length} total readings recorded · Current weather: {weatherLabel}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      {['Date', 'Time', 'Water Level', 'Status', 'Weather'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{h}</th>
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
                          <td className="px-5 py-3 text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-5 py-3 text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
                            {dt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-5 py-3 text-sm font-black" style={{ color: statusColor }}>
                            {r.water_level_m != null ? `${parseFloat(r.water_level_m).toFixed(3)} m` : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                              style={{ backgroundColor: statusColor + '22', color: statusColor }}>
                              {config.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs font-medium text-slate-600 dark:text-slate-400">
                            {weatherLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {wlHistory.length === 0 && !wlLoading && (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500 text-sm font-semibold">
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

          {/* All Evacuee Data */}
          <div>
            <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Evacuee Data (All Centers)</h2>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
              {allFamilies.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-slate-500 text-sm font-semibold">
                  <Users size={28} className="mr-2 opacity-30" /> No evacuee records
                </div>
              ) : (
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                        {['#','Head of Family','Age','Barangay','Members','Contact','Arrival Date','Center','Notes'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                      {allFamilies.map((f, i) => (
                        <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3 text-slate-500 text-xs font-medium">{i + 1}</td>
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{f.head_name}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{f.age || '—'}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{f.barangay || '—'}</td>
                          <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-bold">{f.members}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{f.contact || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap font-medium">
                            {f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-xs font-semibold">{f.center_name || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[140px] truncate font-medium">{f.notes || '—'}</td>
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
              <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                Barangay Registration Details
              </h2>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                      {['Barangay','Risk Level','Total Users','Responders','Residents'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                    {byBarangay.map(b => (
                      <tr key={b.barangay} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">{b.barangay}</td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: RISK_COLORS[b.risk_level] + '22',
                              color:           RISK_COLORS[b.risk_level] || '#64748b',
                            }}>
                            {b.risk_level?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-900 dark:text-white font-extrabold">{b.total_users}</td>
                        <td className="px-5 py-3 text-emerald-600 dark:text-emerald-400 font-bold">{b.rescuers || 0}</td>
                        <td className="px-5 py-3 text-blue-600 dark:text-blue-400 font-bold">{b.residents || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PDF Preview Modal (Works for both Live River Data Reports & Simulation Drill Reports) */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-sm font-bold text-slate-900 dark:text-white">PDF Preview — {pdfPreview.filename}</span>
              <div className="flex items-center gap-2">
                <a href={pdfPreview.url} download={pdfPreview.filename}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors font-bold shadow-sm">
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
    </div>
  );
}