import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuditLogs, deleteAuditLog } from '../api/analytics';
import { getUsers } from '../api/users';
import { formatDateTime } from '../utils/floodUtils';
import {
  Search, Activity, Waves, Layers, Trash2,
  Eye, Clock, AlertCircle, X
} from 'lucide-react';
import toast from 'react-hot-toast';

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
  MAINTENANCE:  { bg: '#fef3c7', color: '#b45309' },
  INSPECTION:   { bg: '#ccfbf1', color: '#0f766e' },
  ALERT:        { bg: '#fee2e2', color: '#b91c1c' },
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
  { value: 'ALERT',       label: '⚠️ Flood Alerts' },
  { value: 'BACKUP',      label: '💾 Backups' },
  { value: 'CREATED',     label: '➕ Created' },
  { value: 'UPDATED',     label: '✏️ Updated' },
  { value: 'DELETED',     label: '🗑️ Deleted' },
  { value: 'LOGIN',       label: '🔑 Login' },
  { value: 'MAINTENANCE', label: '🛠️ Maintenance & Checks' },
];



/**
 * Converts technical states or raw payloads into clean, plain English sentences
 * that non-IT personnel like MDRRMO officers can easily understand.
 */
function getReadableDescription(log, usersMap = {}) {
  const action = log.action || '';
  const rawState = log.after_state || log.before_state;

  let s = rawState || {};
  if (typeof s === 'string') {
    try {
      s = JSON.parse(s);
    } catch {
      s = {};
    }
  }
  if (!s || typeof s !== 'object') s = {};

  // 1. User Account Creation (Requirement 1: "Created [Role] account for [email]")
  if (action === 'USER_CREATED') {
    const role = s.role || s.user_role || (log.entity_id && usersMap[log.entity_id]?.role);
    const email = s.email || s.user_email || (log.entity_id && usersMap[log.entity_id]?.email);
    if (role && email) {
      return `Created ${role} account for ${email}`;
    }
    if (email) {
      return `Created account for ${email}`;
    }
    if (role) {
      return `Created ${role} account`;
    }
    if (log.description && typeof log.description === 'string' && log.description.trim() && !log.description.includes('by administrator')) {
      return log.description.trim();
    }
    return 'User account created by administrator';
  }

  // 2. Dispatched Events (Requirement 2: SOS_DISPATCHED_PRIMARY, SOS_DISPATCHED_BACKUP, BACKUP_DISPATCHED)
  if (action.includes('DISPATCHED') || action.includes('DISPATCH')) {
    const isBackup = action.includes('BACKUP') || s.dispatch_type === 'BACKUP';
    const isPrimary = action.includes('PRIMARY') || s.dispatch_type === 'PRIMARY';
    const prefix = isBackup ? 'Dispatched backup: ' : (isPrimary ? 'Dispatched primary: ' : 'Dispatched: ');

    const responderIds = s.assigned_responders || (s.responder_id ? [s.responder_id] : (s.responderId ? [s.responderId] : [])) || [];
    const responderList = Array.isArray(responderIds) ? responderIds : [responderIds];

    const teamDescriptions = [];
    for (const rid of responderList) {
      const u = typeof rid === 'string' ? usersMap[rid] : (typeof rid === 'object' ? rid : null);
      if (u) {
        const roleLabel = u.role ? `${u.role} Team` : 'Responder Unit';
        teamDescriptions.push(`${roleLabel} (Officer ${u.full_name || u.email || 'Responder'})`);
      }
    }

    if (teamDescriptions.length === 0) {
      const rRole = s.responder_role || s.role;
      const rName = s.responder_name || s.full_name || s.name;
      if (rRole && rName) {
        teamDescriptions.push(`${rRole} Team (Officer ${rName})`);
      } else if (rRole) {
        teamDescriptions.push(`${rRole} Team`);
      } else if (rName) {
        teamDescriptions.push(`Officer ${rName}`);
      } else if (s.team_summary && typeof s.team_summary === 'string' && s.team_summary.trim()) {
        teamDescriptions.push(s.team_summary.trim());
      }
    }

    if (teamDescriptions.length > 0) {
      const teamText = teamDescriptions.join(' and ');
      const notes = s.notes ? ` — Notes: ${s.notes}` : '';
      return `${prefix}${teamText}${notes}`;
    }

    if (log.description && typeof log.description === 'string' && log.description.trim() && !log.description.includes('emergency response units') && !log.description.includes('response team')) {
      return log.description.trim();
    }

    if (s.notes) {
      return `${prefix}response team — Notes: ${s.notes}`;
    }
    return `${prefix}emergency response units`;
  }

  // If already has a clean custom description (not generic)
  if (log.description && typeof log.description === 'string' && log.description.trim()) {
    return log.description.trim();
  }

  // 2. SOS Distress Call Created
  if (action === 'SOS_CREATED') {
    let loc = '';
    if (s.lat && s.lng) {
      loc = `coordinates (${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)})`;
    }
    if (loc) {
      return `SOS distress call reported at ${loc}`;
    }
    return `SOS distress call reported`;
  }

  // 3. SOS Response Lifecycle
  if (action === 'SOS_RESPONDED_EN_ROUTE' || action === 'SOS_RESPONDED') {
    return 'Responder acknowledged and is currently en route to distress location';
  }
  if (action === 'SOS_RESPONDED_RESCUE_IN_PROGRESS') {
    return 'Rescue operation is in progress on site';
  }
  if (action === 'SOS_RESCUE_COMPLETED') {
    return 'Rescue operation successfully completed';
  }
  if (action === 'SOS_CANCELLED') {
    return 'SOS distress request cancelled by resident';
  }
  if (action === 'SOS_DISPATCH_DECLINED') {
    return 'Responder declined dispatch order';
  }
  if (action === 'BACKUP_REQUESTED') {
    const roleReq = s.target_role || s.role || 'additional';
    return `Field responder requested ${roleReq} backup assistance`;
  }
  if (action === 'BACKUP_RESOLVED') {
    return 'Field backup request resolved and cleared';
  }

  // 4. Flood Simulation & Drills
  if (action === 'DRILL_SCENARIO_STARTED') {
    const name = s.scenario_name || s.name || 'Emergency Drill';
    const target = s.target_level_m ? ` (Target: ${s.target_level_m}m)` : '';
    return `Drill scenario started: ${name}${target}`;
  }
  if (action === 'DRILL_SCENARIO_COMPLETED') {
    return `Drill scenario completed successfully`;
  }
  if (action === 'DRILL_THRESHOLD_BREACHED') {
    return `Drill warning threshold reached`;
  }
  if (action === 'SIMULATION_STARTED') {
    const level = s.water_level_m ? ` (Water level: ${Number(s.water_level_m).toFixed(2)}m)` : '';
    return `Flood simulation initiated${level}`;
  }
  if (action === 'SIMULATION_STOPPED') {
    return `Flood simulation stopped and deactivated`;
  }
  if (action === 'SIMULATION_RESET') {
    return `Flood simulation reset to normal baseline`;
  }

  // 5. Alerts & Sirens
  if (action === 'ALERT_DISPATCHED' || action === 'ALERT_TRIGGERED') {
    const lvl = s.flood_level ? ` (${s.flood_level})` : '';
    return `Flood warning alert triggered and dispatched${lvl}`;
  }
  if (action === 'MANUAL_SIREN_TRIGGERED') {
    return `Emergency warning siren manually sounded`;
  }

  // 6. Announcements & Evacuation
  if (action === 'ANNOUNCEMENT_CREATED') {
    const title = s.title ? `: "${s.title}"` : '';
    return `Public safety announcement posted${title}`;
  }
  if (action === 'ANNOUNCEMENT_DEACTIVATED') {
    return `Public safety announcement deactivated`;
  }
  if (action.includes('EVAC_CENTER')) {
    const center = s.name ? ` "${s.name}"` : '';
    if (action.includes('CREATED')) return `Evacuation center${center} registered`;
    if (action.includes('UPDATED')) return `Evacuation center${center} updated`;
    if (action.includes('DELETED')) return `Evacuation center${center} removed`;
  }
  if (action === 'FAMILY_ADDED') {
    return `Evacuee family registered at evacuation center`;
  }
  if (action === 'FAMILY_UPDATED') {
    return `Evacuee family records updated`;
  }

  // 7. Users & Security
  if (action === 'USER_LOGIN') {
    return `User logged into the system console`;
  }
  if (action === 'USER_REGISTER') {
    return `New user account registered`;
  }
  if (action === 'USER_CREATED') {
    return `User account created by administrator`;
  }
  if (action === 'USER_UPDATED') {
    return `User account profile updated`;
  }
  if (action === 'USER_DEACTIVATED') {
    return `User account deactivated`;
  }
  if (action === 'USER_DELETED') {
    return `User account permanently deleted`;
  }

  // 8. Custom / Explicit messages in state
  if (s.message && typeof s.message === 'string') return s.message;
  if (s.notes && typeof s.notes === 'string') return s.notes;
  if (s.reason && typeof s.reason === 'string') return s.reason;

  return '—';
}

export default function AuditLogs() {
  const [page,          setPage]          = useState(0);
  const [search,        setSearch]        = useState('');
  const [actionFilter,  setActionFilter]  = useState('');
  const [categoryTab,   setCategoryTab]   = useState('all'); // 'all' | 'live' | 'simulation'

  // Modals state
  const [viewLog,       setViewLog]       = useState(null); // object for inspection modal
  const [deleteTarget,  setDeleteTarget]  = useState(null); // object to confirm deletion

  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', page, categoryTab, actionFilter, search],
    queryFn:  () => getAuditLogs({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      category: categoryTab !== 'all' ? categoryTab : undefined,
      action: actionFilter || undefined,
      search: search.trim() || undefined,
    }),
    refetchInterval: 30000,
    keepPreviousData: true,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-audit'],
    queryFn:  () => getUsers({ limit: 100 }),
  });
  const usersList = usersData?.data || [];
  const usersMap = Object.fromEntries(usersList.map(u => [u.id, u]));

  const deleteMutation = useMutation({
    mutationFn: deleteAuditLog,
    onSuccess: () => {
      toast.success('Audit log entry deleted');
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete audit log entry');
    },
  });

  const filtered = logs;

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between flex-wrap gap-4">
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
              placeholder="Search user, action, description…"
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
                {['Time', 'User', 'Role', 'Action', 'Entity', 'Description', 'Actions'].map(h => (
                  <th
                    key={h}
                    className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 ${
                      h === 'Actions' ? 'text-right' : 'text-left'
                    }`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
              {filtered.map(log => {
                const { bg, color } = getActionStyle(log.action);
                const cleanDescription = getReadableDescription(log, usersMap);

                return (
                  <tr key={log.id}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    {/* Time */}
                    <td className="px-5 py-3.5 text-xs font-medium whitespace-nowrap text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-400 shrink-0" />
                        <span>{formatDateTime(log.created_at)}</span>
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {log.user_full_name || log.user_email || 'System'}
                      </div>
                      {log.user_full_name && log.user_email && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {log.user_email}
                        </div>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {log.user_role || '—'}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg font-mono inline-block shadow-sm"
                        style={{ backgroundColor: bg, color }}>
                        {log.action}
                      </span>
                    </td>

                    {/* Entity */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {log.entity_type || '—'}
                        {log.entity_id ? ` #${String(log.entity_id).slice(0, 8)}` : ''}
                      </span>
                    </td>

                    {/* Description - PLAIN READABLE SENTENCE (NO RAW JSON OR CHIPS) */}
                    <td className="px-5 py-3.5 text-xs min-w-[280px] max-w-xl">
                      {cleanDescription && cleanDescription !== '—' ? (
                        <div className="font-semibold text-slate-800 dark:text-slate-200 leading-relaxed whitespace-normal break-words">
                          {cleanDescription}
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-medium">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewLog(log)}
                          title="View Full Details"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(log)}
                          title="Delete Audit Log"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
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
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              {isLoading ? 'Loading audit trail…' : 'No audit logs found'}
            </p>
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



      {/* VIEW DETAILS MODAL */}
      {viewLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  <Eye size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Audit Log Inspection
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ID: {viewLog.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">Action:</span>
                  <span className="font-mono font-bold px-2.5 py-1 rounded-lg text-xs inline-block"
                    style={getActionStyle(viewLog.action)}>
                    {viewLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">Timestamp:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatDateTime(viewLog.created_at)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">Operator:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {viewLog.user_full_name || viewLog.user_email || 'System'}
                  </span>
                  {viewLog.user_role && (
                    <span className="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {viewLog.user_role}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">Entity Reference:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {viewLog.entity_type || '—'} {viewLog.entity_id ? `(#${viewLog.entity_id})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">IP Address:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {viewLog.ip_address || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block mb-1">Client User-Agent:</span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate block" title={viewLog.user_agent}>
                    {viewLog.user_agent || '—'}
                  </span>
                </div>
              </div>

              {/* Full Description Box */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Description
                </label>
                <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-slate-800 dark:text-blue-100 text-xs leading-relaxed whitespace-pre-wrap break-words font-medium">
                  {getReadableDescription(viewLog, usersMap)}
                </div>
              </div>

              {/* State Payloads */}
              {viewLog.after_state && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    After State Payload (Raw Technical JSON)
                  </label>
                  <pre className="p-3.5 rounded-xl bg-slate-900 text-emerald-400 text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                    {typeof viewLog.after_state === 'string'
                      ? viewLog.after_state
                      : JSON.stringify(viewLog.after_state, null, 2)}
                  </pre>
                </div>
              )}

              {viewLog.before_state && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Before State Payload (Raw Technical JSON)
                  </label>
                  <pre className="p-3.5 rounded-xl bg-slate-900 text-amber-400 text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                    {typeof viewLog.before_state === 'string'
                      ? viewLog.before_state
                      : JSON.stringify(viewLog.before_state, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
              <button
                type="button"
                onClick={() => setViewLog(null)}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Audit Log Entry</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div>
                <span className="text-slate-500">Action:</span>{' '}
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{deleteTarget.action}</span>
              </div>
              <div>
                <span className="text-slate-500">Timestamp:</span>{' '}
                <span className="text-slate-700 dark:text-slate-300">{formatDateTime(deleteTarget.created_at)}</span>
              </div>
              <div className="text-slate-600 dark:text-slate-400 italic">
                "{getReadableDescription(deleteTarget, usersMap)}"
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors">
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all disabled:opacity-50">
                <Trash2 size={14} />
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
