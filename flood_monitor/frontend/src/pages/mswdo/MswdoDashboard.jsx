import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEvacuationCenters, updateEvacuationCenter } from '../../api/evacuation';
import { getAnnouncements } from '../../api/announcements';
import { useAuthStore } from '../../store/authStore';
import { formatDateTime } from '../../utils/floodUtils';
import {
  Users, Home, AlertTriangle, CheckCircle,
  Plus, Minus, RefreshCw, Megaphone, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';

function StatCard({ icon: Icon, label, value, sub, color = '#3b82f6', bg = '#1e3a5f' }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex items-start gap-4 shadow-sm dark:shadow-none">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: bg }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
        <div className="text-3xl font-bold" style={{ color }}>{value}</div>
        {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function StatusBadge({ pct }) {
  if (pct >= 100) return (
    <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-red-900/50 text-red-300 border border-red-700">
      <AlertTriangle size={12} /> FULL CAPACITY
    </span>
  );
  if (pct >= 75) return (
    <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-900/50 text-amber-300 border border-amber-700">
      <AlertTriangle size={12} /> WARNING
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-green-900/50 text-green-300 border border-green-700">
      <CheckCircle size={12} /> SAFE
    </span>
  );
}

export default function MswdoDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [delta, setDelta] = useState('');
  const [activityLog, setActivityLog] = useState([]);

  const { data: centers = [] } = useQuery({
    queryKey: ['evacuation'],
    queryFn: getEvacuationCenters,
    refetchInterval: 15000,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: getAnnouncements,
    refetchInterval: 30000,
  });

  const center = centers.find(c => c.id === user?.evacuation_center_id) || centers[0];

  const updateCount = useMutation({
    mutationFn: ({ id, capacity_current }) => updateEvacuationCenter(id, { capacity_current }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries(['evacuation']);
      const action = vars.capacity_current > (center?.capacity_current || 0) ? 'Added' : 'Reduced';
      const diff = Math.abs(vars.capacity_current - (center?.capacity_current || 0));
      setActivityLog(prev => [{
        time: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
        text: `${action} ${diff} evacuee${diff !== 1 ? 's' : ''} — total now ${vars.capacity_current}`,
      }, ...prev.slice(0, 9)]);
      toast.success('Evacuee count updated');
      setDelta('');
    },
    onError: () => toast.error('Update failed'),
  });

  const handleAdd = () => {
    const n = parseInt(delta);
    if (!n || n <= 0 || !center) return;
    const next = Math.min((center.capacity_current || 0) + n, center.capacity_total);
    updateCount.mutate({ id: center.id, capacity_current: next });
  };

  const handleReduce = () => {
    const n = parseInt(delta);
    if (!n || n <= 0 || !center) return;
    const next = Math.max((center.capacity_current || 0) - n, 0);
    updateCount.mutate({ id: center.id, capacity_current: next });
  };

  if (!center) return (
    <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
      No evacuation center assigned. Contact MDRRMO Admin.
    </div>
  );

  const current = center.capacity_current || 0;
  const total = center.capacity_total || 1;
  const avail = Math.max(total - current, 0);
  const pct = Math.min(Math.round((current / total) * 100), 100);
  const barColor = pct >= 100 ? '#ef4444' : pct >= 75 ? '#f59e0b' : '#22c55e';

  const TYPE_COLOR = {
    FLOOD_WARNING: { bg: '#7f1d1d', text: '#fca5a5', label: 'Flood Warning' },
    EVACUATION_ORDER: { bg: '#78350f', text: '#fcd34d', label: 'Evacuation Order' },
    ALL_CLEAR: { bg: '#14532d', text: '#86efac', label: 'All Clear' },
    GENERAL: { bg: '#1e3a5f', text: '#93c5fd', label: 'General' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">MSWDO Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {center.name} · {center.barangay_name || center.barangay}
          </p>
        </div>
        <StatusBadge pct={pct} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Current Evacuees" value={current}
          sub="People inside" color="#3b82f6" bg="#1e3a5f22" />
        <StatCard icon={Home} label="Max Capacity" value={total}
          sub="Total slots" color="#a78bfa" bg="#2e1065" />
        <StatCard icon={CheckCircle} label="Available Space" value={avail}
          sub="Remaining slots" color="#22c55e" bg="#14532d22" />
        <StatCard icon={Activity} label="Occupancy" value={`${pct}%`}
          sub={pct >= 75 ? 'Near capacity' : 'Normal load'}
          color={barColor} bg="#0f172a" />
      </div>

      {/* Capacity bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-300">Capacity Overview</span>
          <span className="text-xs text-slate-500">{current} / {total} occupants</span>
        </div>
        <div className="h-4 bg-slate-700 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>0</span>
          <span className="font-medium" style={{ color: barColor }}>{pct}% full</span>
          <span>{total}</span>
        </div>
      </div>

      {/* Evacuee update + Center info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Update form */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm dark:shadow-none">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 uppercase tracking-wider mb-4">
            Update Evacuee Count
          </h3>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1.5">Number of Evacuees</label>
              <input
                type="number" min="1" value={delta}
                onChange={e => setDelta(e.target.value)}
                placeholder="Enter number"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleAdd} disabled={!delta || updateCount.isPending}
              className="flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
              <Plus size={16} /> Add Evacuees
            </button>
            <button onClick={handleReduce} disabled={!delta || updateCount.isPending}
              className="flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
              <Minus size={16} /> Reduce Evacuees
            </button>
          </div>
          <div className="mt-4 p-3 bg-slate-900 rounded-xl flex items-center justify-between">
            <span className="text-xs text-slate-400">Current total</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{current}
              <span className="text-sm font-normal text-slate-500 ml-1">/ {total}</span>
            </span>
          </div>
        </div>

        {/* Center info */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm dark:shadow-none">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 uppercase tracking-wider mb-4">
            Center Information
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Center Name', value: center.name },
              { label: 'Barangay', value: center.barangay_name || center.barangay },
              { label: 'Address', value: center.address || '—' },
              { label: 'Contact Person', value: center.contact_person || '—' },
              { label: 'Contact Number', value: center.contact_number || '—' },
              {
                label: 'Status', value: center.is_open ? 'Open' : 'Closed',
                valueColor: center.is_open ? '#22c55e' : '#94a3b8'
              },
            ].map(({ label, value, valueColor }) => (
              <div key={label} className="flex items-start justify-between py-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
                <span className="text-xs text-slate-500 w-32 shrink-0">{label}</span>
                <span className="text-xs font-medium text-right" style={{ color: valueColor || 'rgb(var(--text-base))' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Announcements + Activity log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* MDRRMO Announcements */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone size={15} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 uppercase tracking-wider">
              MDRRMO Announcements
            </h3>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {announcements.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No announcements</p>
            ) : announcements.slice(0, 5).map(a => {
              const meta = TYPE_COLOR[a.type] || TYPE_COLOR.GENERAL;
              return (
                <div key={a.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-transparent">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: meta.bg + '55', color: meta.text }}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-slate-500">{formatDateTime(a.created_at)}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">{a.title}</div>
                  <div className="text-xs text-slate-400">{a.message}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity log */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw size={15} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Recent Activity
            </h3>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {activityLog.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No activity yet this session</p>
            ) : activityLog.map((log, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
                <span className="text-xs text-slate-500 shrink-0 w-14">{log.time}</span>
                <span className="text-xs text-slate-900 dark:text-slate-300">{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
