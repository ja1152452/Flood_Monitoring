import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from '../api/analytics';
import { formatDateTime } from '../utils/floodUtils';
import { Search, Activity, Waves, Layers } from 'lucide-react';

const PAGE_SIZE = 50;

const ACTION_COLORS = {
  DELETED:      { bg: '#fee2e2', color: '#b91c1c' },
  DEACTIVATED:  { bg: '#fee2e2', color: '#b91c1c' },
  CREATED:      { bg: '#dcfce7', color: '#15803d' },
  UPDATED:      { bg: '#dbeafe', color: '#1d4ed8' },
  ACTIVATED:    { bg: '#dbeafe', color: '#1d4ed8' },
  SOS:          { bg: '#ffedd5', color: '#c2410c' },
  BACKUP:       { bg: '#f3e8ff', color: '#7e22ce' },
  LOGIN:        { bg: '#dcfce7', color: '#166534' },
  SIMULATION:   { bg: '#e0e7ff', color: '#4338ca' },
  DRILL:        { bg: '#ede9fe', color: '#6d28d9' },
  DEFAULT:      { bg: '#f1f5f9', color: '#475569' },
};

function getActionStyle(action = '') {
  for (const [key, style] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return style;
  }
  return ACTION_COLORS.DEFAULT;
}

const ACTION_FILTER_OPTIONS = [
  { value: '',            label: 'All Actions' },
  { value: 'SIMULATION',  label: '🧪 Simulation & Drills' },
  { value: 'DRILL',       label: '⏱️ Drill Scenarios' },
  { value: 'SOS',         label: '🚨 SOS Emergencies' },
  { value: 'BACKUP',      label: '💾 Backups' },
  { value: 'CREATED',     label: '➕ Created' },
  { value: 'UPDATED',     label: '✏️ Updated' },
  { value: 'DELETED',     label: '🗑️ Deleted' },
  { value: 'LOGIN',       label: '🔑 Login' },
];

export default function AuditLogs() {
  const [page,          setPage]          = useState(0);
  const [search,        setSearch]        = useState('');
  const [actionFilter,  setActionFilter]  = useState('');
  const [categoryTab,   setCategoryTab]   = useState('all'); // 'all' | 'live' | 'simulation'

  const { data: logs = [] } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn:  () => getAuditLogs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    refetchInterval: 30000,
    keepPreviousData: true,
  });

  const filtered = logs.filter(log => {
    const isSim = (log.action || '').includes('SIMULATION') || (log.action || '').includes('DRILL') || (log.entity_type || '').includes('SIMULATION');
    if (categoryTab === 'live' && isSim) return false;
    if (categoryTab === 'simulation' && !isSim) return false;

    const matchSearch = !search ||
      (log.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.action     || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.entity_type|| '').toLowerCase().includes(search.toLowerCase());
    const matchAction = !actionFilter || (log.action || '').includes(actionFilter);
    return matchSearch && matchAction;
  });

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Trail</h1>
          <p className="text-sm mt-1 text-slate-600 dark:text-slate-400">
            Master activity log — real emergency operations, administration, and simulation drill tests
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search user, action…"
              className="pl-8 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
            />
          </div>
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(0); }}
            className="text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm font-semibold">
            {ACTION_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Pills Switcher */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit shadow-inner">
        <button
          onClick={() => { setCategoryTab('all'); setPage(0); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
            categoryTab === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}>
          <Layers size={13} />
          All Activities
        </button>
        <button
          onClick={() => { setCategoryTab('live'); setPage(0); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
            categoryTab === 'live'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}>
          <Activity size={13} />
          Live Operations Only
        </button>
        <button
          onClick={() => { setCategoryTab('simulation'); setPage(0); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
            categoryTab === 'simulation'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}>
          <Waves size={13} />
          Simulation &amp; Drills Only
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                {['Time', 'User', 'Role', 'Action', 'Entity', 'Details'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
              {filtered.map(log => {
                const { bg, color } = getActionStyle(log.action);
                const details = log.after_state
                  ? (() => { try { const o = typeof log.after_state === 'string' ? JSON.parse(log.after_state) : log.after_state; return Object.entries(o).slice(0,2).map(([k,v]) => `${k}: ${v}`).join(', '); } catch { return '—'; } })()
                  : '—';
                return (
                  <tr key={log.id}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="px-5 py-3.5 text-xs font-medium whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {log.user_email || 'System'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {log.user_role || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg font-mono"
                        style={{ backgroundColor: bg, color }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                        {log.entity_type || '—'}
                        {log.entity_id ? ` #${String(log.entity_id).slice(0, 8)}` : ''}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs max-w-[200px] truncate font-medium text-slate-600 dark:text-slate-400"
                      title={details}>
                      {details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="text-3xl">📋</span>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No audit logs found</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
        <span>Showing {filtered.length} of {logs.length} entries (page {page + 1})</span>
        <div className="flex items-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 disabled:opacity-40 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold shadow-sm">
            ← Prev
          </button>
          <button disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 disabled:opacity-40 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold shadow-sm">
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
