import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllReadings } from '../api/readings';
import { getWeather } from '../api/weather';
import { getFloodConfig } from '../utils/floodUtils';
import { FileDown, X, Activity, Waves, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { getStoredDrillSessions } from '../utils/simulationRecorder';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CAMERA_ID = '3b7e2b66-d4d5-4ae9-be3f-1c7c31e5b03f';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const STATUS_COLORS = {
  NORMAL:     '#22c55e',
  MONITOR:    '#eab308',
  ALERT:      '#f97316',
  EVACUATION: '#ef4444',
  CRITICAL:   '#7c3aed',
};

export default function FloodMonitoringReports() {
  const now = new Date();
  
  // Data Source Switcher: 'live' (Real Database) vs 'simulation' (Drill Recordings)
  const [reportSource, setReportSource] = useState('live');

  // Simulation Drill Sessions
  const [drillSessions, setDrillSessions] = useState(() => getStoredDrillSessions());
  const [selectedDrillId, setSelectedDrillId] = useState(() => drillSessions[0]?.id || 'ALL_SESSIONS');

  const refreshDrills = () => {
    const updated = getStoredDrillSessions();
    setDrillSessions(updated);
    if (selectedDrillId !== 'ALL_SESSIONS' && !updated.some(s => s.id === selectedDrillId)) {
      setSelectedDrillId(updated[0]?.id || 'ALL_SESSIONS');
    }
  };

  useEffect(() => {
    refreshDrills();
  }, [reportSource]);

  const selectedDrill = useMemo(() => {
    if (selectedDrillId === 'ALL_SESSIONS') {
      const allPoints = drillSessions.flatMap(s => {
        const sessionDate = new Date(s.startedAt || Date.now());
        const sessionDateStr = sessionDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
        return (s.points || []).map(p => ({
          ...p,
          sessionName: s.name,
          date: p.date || sessionDateStr,
        }));
      });

      const maxPeak = drillSessions.reduce((max, s) => Math.max(max, s.peakLevelM || 0), 2.0);
      const peakCat = maxPeak >= 6.1 ? 'CRITICAL' : maxPeak >= 5.1 ? 'EVACUATION' : maxPeak >= 4.1 ? 'ALERT' : maxPeak >= 3.1 ? 'MONITOR' : 'NORMAL';

      return {
        id: 'ALL_SESSIONS',
        name: 'All Combined Drill Sessions (Lahat ng Drill Runs)',
        scenarioType: 'combined_history',
        startedAt: drillSessions[drillSessions.length - 1]?.startedAt || new Date().toISOString(),
        finishedAt: drillSessions[0]?.finishedAt || new Date().toISOString(),
        durationSec: drillSessions.reduce((sum, s) => sum + (s.durationSec || 0), 0),
        startLevelM: 2.00,
        targetLevelM: maxPeak,
        peakLevelM: maxPeak,
        peakCategory: peakCat,
        pointsCount: allPoints.length,
        points: allPoints,
      };
    }
    return drillSessions.find(s => s.id === selectedDrillId) || drillSessions[0] || null;
  }, [drillSessions, selectedDrillId]);

  const [filter, setFilter] = useState({
    type:  'all',
    date:  now.toISOString().slice(0, 10),
    month: now.getMonth(),
    year:  now.getFullYear(),
  });
  const [pdfPreview, setPdfPreview] = useState(null);

  const { data: weather } = useQuery({
    queryKey: ['weather'],
    queryFn:  getWeather,
    refetchInterval: 300000,
  });

  const params = useMemo(() => {
    if (filter.type === 'all') {
      return { limit: 50000 };
    }
    if (filter.type === 'date') {
      return { date: filter.date, limit: 50000 };
    }
    const y = filter.year, m = String(filter.month + 1).padStart(2, '0');
    const lastDay = new Date(filter.year, filter.month + 1, 0).getDate();
    return {
      from: `${y}-${m}-01T00:00:00+08:00`,
      to:   `${y}-${m}-${String(lastDay).padStart(2,'0')}T23:59:59+08:00`,
      limit: 50000,
    };
  }, [filter]);

  const { data: readings = [], isFetching } = useQuery({
    queryKey: ['flood-report-readings', params],
    queryFn:  () => getAllReadings(CAMERA_ID, params),
    enabled:  reportSource === 'live',
  });

  const weatherLabel = weather
    ? `${weather.description}, ${weather.temp}°C`
    : '—';

  // --- Real Live PDF Generator ---
  const handleLiveExport = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Flood Monitoring Report', 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(100);
    const periodLabel = filter.type === 'all'
      ? 'All Historical Records (Lahat ng Data)'
      : filter.type === 'date'
        ? filter.date
        : `${MONTHS[filter.month]} ${filter.year}`;
    doc.text(`Period: ${periodLabel}`, 14, 23);
    doc.text(`Weather: ${weatherLabel}`, 14, 28);
    doc.text(`Total Records: ${readings.length}`, 14, 33);
    doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 14, 38);

    autoTable(doc, {
      startY: 44,
      head: [['Date', 'Time', 'Water Level (m)', 'Status', 'Weather']],
      body: readings.map(r => {
        const dt = new Date(r.captured_at);
        return [
          dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
          dt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          r.water_level_m != null ? parseFloat(r.water_level_m).toFixed(3) : '—',
          r.flood_level || '—',
          weatherLabel,
        ];
      }),
      styles:     { fontSize: 8, textColor: [30, 41, 59] },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
      columnStyles: { 3: { fontStyle: 'bold' } },
    });

    const filename = `flood-monitoring-report-${filter.type === 'all' ? 'all-records' : filter.type === 'date' ? filter.date : `${filter.year}-${String(filter.month+1).padStart(2,'0')}`}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

  // --- Simulation Drill PDF Generator ---
  const handleDrillExportPdf = () => {
    if (!selectedDrill || !selectedDrill.points) return;
    const doc = new jsPDF();
    
    // Header Banner
    doc.setFontSize(16);
    doc.setTextColor(79, 70, 229);
    doc.text('MDRRMO Flood Simulation Drill Report', 14, 16);
    
    doc.setFontSize(10);
    doc.setTextColor(220, 38, 38);
    doc.text('[ FOR TRAINING, DRILLS & READINESS TESTING ONLY ]', 14, 23);

    const drillDateStr = selectedDrill.startedAt
      ? new Date(selectedDrill.startedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
      : new Date().toLocaleDateString('en-PH');

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Drill Session: ${selectedDrill.name}`, 14, 30);
    doc.text(`Drill Date: ${drillDateStr}`, 14, 35);
    doc.text(`Scenario Type: ${String(selectedDrill.scenarioType).toUpperCase()}`, 14, 40);
    doc.text(`Peak Water Level Reached: ${selectedDrill.peakLevelM.toFixed(2)}m (${selectedDrill.peakCategory})`, 14, 45);
    doc.text(`Drill Duration: ${selectedDrill.durationSec} seconds (${selectedDrill.pointsCount} points logged)`, 14, 50);
    doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 14, 55);

    const sortedDrillPoints = [...(selectedDrill.points || [])].sort((a, b) => {
      const tA = a.isoDateTime ? new Date(a.isoDateTime).getTime() : (a.elapsedSec ?? 0);
      const tB = b.isoDateTime ? new Date(b.isoDateTime).getTime() : (b.elapsedSec ?? 0);
      return tB - tA;
    });

    autoTable(doc, {
      startY: 60,
      head: [['Date', 'Elapsed Time', 'Time of Day', 'Simulated Level (m)', 'Level (cm)', 'Flood Status', 'Drill Phase', 'Rate of Rise']],
      body: sortedDrillPoints.map(p => {
        const pDate = p.date || drillDateStr;
        return [
          pDate,
          `+${p.elapsedSec}s`,
          p.timestamp,
          `${p.waterLevelM.toFixed(2)}m`,
          `${p.waterLevelCm} cm`,
          p.floodLevel,
          p.phase ? p.phase.toUpperCase() : 'N/A',
          `${p.ratePerHour} m/hr`,
        ];
      }),
      styles:     { fontSize: 8, textColor: [30, 41, 59] },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
      columnStyles: { 0: { fontStyle: 'bold' }, 5: { fontStyle: 'bold' } },
    });

    const filename = `simulation-drill-report-${selectedDrill.id}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

  // --- Simulation Drill CSV Generator ---
  const handleDrillExportCsv = () => {
    if (!selectedDrill || !selectedDrill.points) return;
    const defaultDateStr = selectedDrill.startedAt
      ? new Date(selectedDrill.startedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
      : new Date().toLocaleDateString('en-PH');

    const sortedDrillPoints = [...(selectedDrill.points || [])].sort((a, b) => {
      const tA = a.isoDateTime ? new Date(a.isoDateTime).getTime() : (a.elapsedSec ?? 0);
      const tB = b.isoDateTime ? new Date(b.isoDateTime).getTime() : (b.elapsedSec ?? 0);
      return tB - tA;
    });

    const headers = ['Date', 'Elapsed_Seconds', 'Timestamp', 'Water_Level_Meters', 'Water_Level_CM', 'Flood_Status', 'Drill_Phase', 'Rate_M_Per_Hr'];
    const rows = sortedDrillPoints.map(p => [
      `"${p.date || defaultDateStr}"`,
      p.elapsedSec,
      `"${p.timestamp}"`,
      p.waterLevelM,
      p.waterLevelCm,
      `"${p.floodLevel}"`,
      `"${p.phase}"`,
      p.ratePerHour,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `simulation_drill_${selectedDrill.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="page-header flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Flood Monitoring & Simulation Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {reportSource === 'live'
              ? `${readings.length} live records loaded · Weather: ${weatherLabel}`
              : `Drill Archive · ${selectedDrill?.pointsCount || 0} drill data points recorded`}
          </p>
        </div>

        {/* DATA SOURCE TOGGLE */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
          <button
            onClick={() => setReportSource('live')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              reportSource === 'live'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}>
            <Activity size={14} />
            Real Flood Reports
          </button>
          <button
            onClick={() => setReportSource('simulation')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              reportSource === 'simulation'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}>
            <Waves size={14} />
            Simulation Drill Reports
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: REAL LIVE DATA REPORT CONTROLS                 */}
      {/* ======================================================== */}
      {reportSource === 'live' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'all', label: 'All Records (Lahat)' },
                { id: 'date', label: 'Date View' },
                { id: 'month', label: 'Month View' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setFilter(f => ({ ...f, type: t.id }))}
                  className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
                    filter.type === t.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                  {t.label}
                </button>
              ))}

              {filter.type === 'all' && (
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800">
                  Showing ALL {readings.length} historical logs
                </span>
              )}

              {filter.type === 'date' && (
                <input
                  type="date"
                  value={filter.date}
                  onChange={e => setFilter(f => ({ ...f, date: e.target.value }))}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                />
              )}

              {filter.type === 'month' && (
                <div className="flex items-center gap-2">
                  <select
                    value={filter.month}
                    onChange={e => setFilter(f => ({ ...f, month: parseInt(e.target.value) }))}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold">
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={filter.year}
                    onChange={e => setFilter(f => ({ ...f, year: parseInt(e.target.value) }))}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold">
                    {[2024, 2025, 2026].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              onClick={handleLiveExport}
              disabled={isFetching || readings.length === 0}
              className="flex items-center gap-2 text-xs font-black bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl transition-all shadow-md active:scale-95">
              <FileDown size={14} />
              Export Official PDF Report
            </button>
          </div>

          {/* Real Live Table */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    {['Date', 'Time', 'Water Level (m)', 'Status', 'Weather'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                  {readings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">
                        {isFetching ? 'Loading real flood records...' : 'No flood records found for this period.'}
                      </td>
                    </tr>
                  ) : (
                    readings.map(r => {
                      const dt = new Date(r.captured_at);
                      const cfg = getFloodConfig(r.flood_level);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">
                            {dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-5 py-3 text-slate-500 font-mono text-xs">
                            {dt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-5 py-3 font-black text-blue-600 dark:text-blue-400">
                            {r.water_level_m != null ? `${parseFloat(r.water_level_m).toFixed(3)}m` : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: cfg.color + '22',
                                color: cfg.color,
                              }}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">{weatherLabel}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: SIMULATION DRILL REPORT CONTROLS               */}
      {/* ======================================================== */}
      {reportSource === 'simulation' && selectedDrill && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-black uppercase text-slate-500">Drill Session:</span>
              <select
                value={selectedDrillId}
                onChange={(e) => setSelectedDrillId(e.target.value)}
                className="text-xs font-extrabold bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
                <option value="ALL_SESSIONS">
                  ⭐ All Drill Sessions (Lahat ng Drill Runs Combined - {drillSessions.length} sessions)
                </option>
                {drillSessions.map((s) => {
                  const dateStr = s.startedAt
                    ? new Date(s.startedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '';
                  const timeStr = s.startedAt
                    ? new Date(s.startedAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} — {dateStr} {timeStr} ({s.durationSec}s · {s.peakCategory})
                    </option>
                  );
                })}
              </select>
              <button
                onClick={refreshDrills}
                className="p-2 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Refresh Drills">
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDrillExportCsv}
                className="flex items-center gap-2 text-xs font-black bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95">
                <FileSpreadsheet size={14} className="text-emerald-400" />
                Export CSV Spreadsheet
              </button>
              <button
                onClick={handleDrillExportPdf}
                className="flex items-center gap-2 text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-all shadow-md active:scale-95">
                <FileDown size={14} />
                Export Drill PDF Report
              </button>
            </div>
          </div>

          {/* Drill Summary Card */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-indigo-950/20 border border-indigo-500/30 p-4 rounded-2xl text-xs">
            <div>
              <span className="text-slate-500 font-semibold block">Drill Name:</span>
              <span className="font-extrabold text-indigo-300 text-sm truncate block">{selectedDrill.name}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Date Conducted:</span>
              <span className="font-extrabold text-amber-300 text-sm">
                {selectedDrill.startedAt
                  ? new Date(selectedDrill.startedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                  : new Date().toLocaleDateString('en-PH')}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Peak Level Reached:</span>
              <span className="font-extrabold text-white text-sm">{selectedDrill.peakLevelM.toFixed(2)}m ({selectedDrill.peakCategory})</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Total Duration:</span>
              <span className="font-extrabold text-white text-sm">{selectedDrill.durationSec}s</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Data Points Logged:</span>
              <span className="font-extrabold text-white text-sm">{selectedDrill.pointsCount} entries</span>
            </div>
          </div>

          {/* Drill Data Table */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    {['Date', 'Elapsed (s)', 'Time of Day', 'Simulated Level (m)', 'Level (cm)', 'Flood Status', 'Drill Phase', 'Rate of Rise'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                  {[...(selectedDrill.points || [])].sort((a, b) => {
                    const tA = a.isoDateTime ? new Date(a.isoDateTime).getTime() : (a.elapsedSec ?? 0);
                    const tB = b.isoDateTime ? new Date(b.isoDateTime).getTime() : (b.elapsedSec ?? 0);
                    return tB - tA;
                  }).map((p, i) => {
                    const cfg = getFloodConfig(p.floodLevel);
                    const defaultDateStr = selectedDrill.startedAt
                      ? new Date(selectedDrill.startedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                      : new Date().toLocaleDateString('en-PH');
                    const rowDate = p.date || defaultDateStr;

                    return (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-5 py-2.5 font-bold text-slate-900 dark:text-white text-xs">{rowDate}</td>
                        <td className="px-5 py-2.5 font-semibold text-slate-500 dark:text-slate-400 text-xs">+{p.elapsedSec}s</td>
                        <td className="px-5 py-2.5 text-xs text-slate-500 font-mono">{p.timestamp}</td>
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
                        <td className="px-5 py-2.5 text-xs font-bold uppercase text-slate-500">{p.phase || 'N/A'}</td>
                        <td className="px-5 py-2.5 text-xs font-bold text-slate-400">{p.ratePerHour} m/hr</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PDF Modal Preview */}
      {pdfPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                {pdfPreview.filename}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={pdfPreview.url}
                  download={pdfPreview.filename}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm">
                  <FileDown size={13} />
                  Download
                </a>
                <button
                  onClick={() => setPdfPreview(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
                  <X size={16} />
                </button>
              </div>
            </div>
            <iframe src={pdfPreview.url} className="flex-1 w-full border-0" title="PDF Preview" />
          </div>
        </div>
      )}
    </div>
  );
}
