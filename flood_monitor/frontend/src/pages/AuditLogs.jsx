import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from '../api/analytics';
import { formatDateTime } from '../utils/floodUtils';
import { Search } from 'lucide-react';

const PAGE_SIZE = 50;

const ACTION_COLORS = {
  DELETED:      { bg: '#fef2f2', color: '#dc2626' },
  DEACTIVATED:  { bg: '#fef2f2', color: '#dc2626' },
  CREATED:      { bg: '#f0fdf4', color: '#16a34a' },
  UPDATED:      { bg: '#eff6ff', color: '#2563eb' },
  ACTIVATED:    { bg: '#eff6ff', color: '#2563eb' },
  SOS:          { bg: '#fff7ed', color: '#ea580c' },
  BACKUP:       { bg: '#fdf4ff', color: '#9333ea' },
  LOGIN:        { bg: '#f0fdf4', color: '#15803d' },
  DEFAULT:      { bg: '#f8fafc', color: '#64748b' },
};

function getActionStyle(action = '') {
  for (const [key, style] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return style;
  }
  return ACTION_COLORS.DEFAULT;
}

const ACTION_FILTER_OPTIONS = [
  { value: '',            label: 'All Actions' },
  { value: 'SOS',         label: 'SOS' },
  { value: 'BACKUP',      label: 'Backup' },
  { value: 'CREATED',     label: 'Created' },
  { value: 'UPDATED',     label: 'Updated' },
  { value: 'DELETED',     label: 'Deleted' },
  { value: 'LOGIN',       label: 'Login' },
];

export default function AuditLogs() {
  const [page,          setPage]          = useState(0);
  const [search,        setSearch]        = useState('');
  const [actionFilter,  setActionFilter]  = useState('');

  const { data: logs = [] } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn:  () => getAuditLogs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    refetchInterval: 30000,
    keepPreviousData: true,
  });

  const filtered = logs.filter(log => {
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
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-base))' }}>Audit Trail</h1>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-faint))' }}>
            Master log of all activities — residents, responders &amp; admin
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search user, action…"
              className="pl-7 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ backgroundColor: 'rgb(var(--bg-base))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-base))' }}
            />
          </div>
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(0); }}
            className="text-xs rounded-lg border px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ backgroundColor: 'rgb(var(--bg-base))', borderColor: 'rgb(var(--border-color))', color: 'rgb(var(--text-base))' }}>
            {ACTION_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: 'rgb(var(--bg-card))', borderColor: 'rgb(var(--border-color))' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgb(var(--border-color))', backgroundColor: 'rgb(var(--bg-base))' }}>
              {['Time', 'User', 'Role', 'Action', 'Entity', 'Details'].map(h => (
                <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'rgb(var(--text-faint))' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(log => {
              const { bg, color } = getActionStyle(log.action);
              const details = log.after_state
                ? (() => { try { const o = typeof log.after_state === 'string' ? JSON.parse(log.after_state) : log.after_state; return Object.entries(o).slice(0,2).map(([k,v]) => `${k}: ${v}`).join(', '); } catch { return '—'; } })()
                : '—';
              return (
                <tr key={log.id}
                  style={{ borderBottom: '1px solid rgb(var(--border-color))' }}
                  className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: 'rgb(var(--text-faint))' }}>
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-xs font-medium" style={{ color: 'rgb(var(--text-base))' }}>
                      {log.user_email || 'System'}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                      {log.user_role || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg font-mono"
                      style={{ backgroundColor: bg, color }}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2 py-0.5 rounded-md"
                      style={{ color: 'rgb(var(--text-muted))', backgroundColor: 'rgb(var(--bg-base))' }}>
                      {log.entity_type || '—'}
                      {log.entity_id ? ` #${String(log.entity_id).slice(0, 8)}` : ''}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs max-w-[200px] truncate" style={{ color: 'rgb(var(--text-faint))' }}
                    title={details}>
                    {details}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="text-3xl">📋</span>
            <p className="text-sm" style={{ color: 'rgb(var(--text-faint))' }}>No audit logs found</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: 'rgb(var(--text-faint))' }}>
        <span>Showing {filtered.length} of {logs.length} entries (page {page + 1})</span>
        <div className="flex items-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg border disabled:opacity-40 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            style={{ borderColor: 'rgb(var(--border-color))' }}>
            ← Prev
          </button>
          <button disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg border disabled:opacity-40 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            style={{ borderColor: 'rgb(var(--border-color))' }}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
