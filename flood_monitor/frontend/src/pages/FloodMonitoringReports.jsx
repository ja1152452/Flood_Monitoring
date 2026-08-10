import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllReadings } from '../api/readings';
import { getWeather } from '../api/weather';
import { getFloodConfig } from '../utils/floodUtils';
import { FileDown, X } from 'lucide-react';
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
  const [filter, setFilter] = useState({
    type:  'date',
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
  });

  const weatherLabel = weather
    ? `${weather.description}, ${weather.temp}°C`
    : '—';

  const handleExport = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Flood Monitoring Report', 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(100);
    const periodLabel = filter.type === 'date'
      ? filter.date
      : `${MONTHS[filter.month]} ${filter.year}`;
    doc.text(`Period: ${periodLabel}`, 14, 23);
    doc.text(`Weather: ${weatherLabel}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 14, 33);

    autoTable(doc, {
      startY: 39,
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

    const filename = `flood-monitoring-report-${filter.type === 'date' ? filter.date : `${filter.year}-${String(filter.month+1).padStart(2,'0')}`}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-base))' }}>
            Flood Monitoring Reports
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--text-faint))' }}>
            {readings.length} readings · Current weather: {weatherLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {['date', 'month'].map(t => (
            <button key={t}
              onClick={() => setFilter(f => ({ ...f, type: t }))}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter.type === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
              }`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}

          {filter.type === 'date' && (
            <input type="date" value={filter.date}
              onChange={e => setFilter(f => ({ ...f, date: e.target.value }))}
              className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none" />
          )}

          {filter.type === 'month' && (
            <>
              <select value={filter.month}
                onChange={e => setFilter(f => ({ ...f, month: +e.target.value }))}
                className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none">
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={filter.year}
                onChange={e => setFilter(f => ({ ...f, year: +e.target.value }))}
                className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none">
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          )}

          <button onClick={handleExport} disabled={isFetching || readings.length === 0}
            className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
            <FileDown size={13} />
            {isFetching ? 'Loading...' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border-color))' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgb(var(--border-color))', backgroundColor: 'rgb(var(--bg-base))' }}>
                {['Date', 'Time', 'Water Level', 'Status', 'Weather'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'rgb(var(--text-faint))' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {readings.map(r => {
                const dt     = new Date(r.captured_at);
                const config = getFloodConfig(r.flood_level);
                return (
                  <tr key={r.id}
                    style={{ borderBottom: '1px solid rgb(var(--border-color))' }}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-5 py-3 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                      {dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 text-xs font-mono" style={{ color: 'rgb(var(--text-muted))' }}>
                      {dt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-sm font-bold" style={{ color: STATUS_COLORS[r.flood_level] || 'rgb(var(--text-base))' }}>
                      {r.water_level_m != null ? `${parseFloat(r.water_level_m).toFixed(3)} m` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ backgroundColor: (STATUS_COLORS[r.flood_level] || '#64748b') + '22', color: STATUS_COLORS[r.flood_level] || '#64748b' }}>
                        {config.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                      {weatherLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {readings.length === 0 && !isFetching && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="text-3xl">🌊</span>
            <p className="text-sm" style={{ color: 'rgb(var(--text-faint))' }}>No readings for this period</p>
          </div>
        )}
        {isFetching && (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-sm font-semibold text-slate-800 dark:text-white">PDF Preview — {pdfPreview.filename}</span>
              <div className="flex items-center gap-2">
                <a href={pdfPreview.url} download={pdfPreview.filename}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  <FileDown size={13} /> Download
                </a>
                <button onClick={() => setPdfPreview(null)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors p-1">
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
