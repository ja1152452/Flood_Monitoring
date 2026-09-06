import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuditLogs, createAuditLog, updateAuditLog, deleteAuditLog } from '../api/analytics';
import { getUsers } from '../api/users';
import { useAuthStore } from '../store/authStore';
import { formatDateTime } from '../utils/floodUtils';
import {
  Search, Activity, Waves, Layers, Plus, Edit2, Trash2,
  Eye, Calendar, Clock, X, Check, AlertCircle, FileText,
  User, Shield, Tag, CornerDownRight
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

const PRESET_ACTIONS = [
  { value: 'DRILL_SCENARIO_STARTED', label: '⏱️ DRILL_SCENARIO_STARTED' },
  { value: 'SIMULATION_STARTED',      label: '🧪 SIMULATION_STARTED' },
  { value: 'SIMULATION_STOPPED',      label: '🛑 SIMULATION_STOPPED' },
  { value: 'SIMULATION_RESET',        label: '🔄 SIMULATION_RESET' },
  { value: 'ALERT_TRIGGERED',         label: '🚨 ALERT_TRIGGERED' },
  { value: 'ALERT_RESOLVED',          label: '✅ ALERT_RESOLVED' },
  { value: 'SOS_TRIGGERED',           label: '🆘 SOS_TRIGGERED' },
  { value: 'SOS_ACKNOWLEDGED',        label: '👁️ SOS_ACKNOWLEDGED' },
  { value: 'SOS_RESOLVED',            label: '🏁 SOS_RESOLVED' },
  { value: 'RESCUE_DISPATCHED',       label: '🚑 RESCUE_DISPATCHED' },
  { value: 'RESCUE_COMPLETED',        label: '🤝 RESCUE_COMPLETED' },
  { value: 'USER_CREATED',            label: '👤 USER_CREATED' },
  { value: 'USER_UPDATED',            label: '✏️ USER_UPDATED' },
  { value: 'USER_DELETED',            label: '🗑️ USER_DELETED' },
  { value: 'MAINTENANCE_LOG',         label: '🛠️ MAINTENANCE_LOG' },
  { value: 'INSPECTION_CHECK',        label: '📋 INSPECTION_CHECK' },
  { value: 'SYSTEM_BACKUP',           label: '💾 SYSTEM_BACKUP' },
  { value: 'CUSTOM',                  label: '✨ Custom Action…' },
];

const COMMON_ENTITY_TYPES = [
  'FLOOD_SIMULATION',
  'water_level_readings',
  'flood_alerts',
  'sos_requests',
  'rescue_operations',
  'users',
  'cameras',
  'evacuation_centers',
  'evacuation_families',
  'flood_risk_areas',
  'announcements',
  'SYSTEM',
  'OTHER',
];

const toDateTimeLocal = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

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
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingLog,    setEditingLog]    = useState(null); // null = create, object = edit
  const [viewLog,       setViewLog]       = useState(null); // object for inspection modal
  const [deleteTarget,  setDeleteTarget]  = useState(null); // object to confirm deletion

  // Form state
  const [formData, setFormData] = useState({
    actionPreset: 'DRILL_SCENARIO_STARTED',
    actionCustom: '',
    description:  '',
    created_at:   '',
    user_id:      '',
    entity_type:  'FLOOD_SIMULATION',
    entity_id:    '',
    details_json: '',
  });

  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn:  () => getAuditLogs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    refetchInterval: 30000,
    keepPreviousData: true,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-audit'],
    queryFn:  () => getUsers({ limit: 100 }),
  });
  const usersList = usersData?.data || [];
  const usersMap = Object.fromEntries(usersList.map(u => [u.id, u]));

  const createMutation = useMutation({
    mutationFn: createAuditLog,
    onSuccess: () => {
      toast.success('Audit log entry created successfully');
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setFormModalOpen(false);
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to create audit log entry';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateAuditLog(id, data),
    onSuccess: () => {
      toast.success('Audit log entry updated successfully');
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setFormModalOpen(false);
      setEditingLog(null);
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to update audit log entry';
      toast.error(msg);
    },
  });

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

  const openCreateModal = () => {
    setEditingLog(null);
    setFormData({
      actionPreset: 'DRILL_SCENARIO_STARTED',
      actionCustom: '',
      description:  '',
      created_at:   toDateTimeLocal(new Date()),
      user_id:      currentUser?.id || '',
      entity_type:  'FLOOD_SIMULATION',
      entity_id:    '', // Auto-generated upon save
      details_json: '',
    });
    setFormModalOpen(true);
  };

  const openEditModal = (log) => {
    setEditingLog(log);
    const isPreset = PRESET_ACTIONS.some(p => p.value === log.action);
    let detailsJson = '';
    const stateObj = log.after_state || log.before_state;
    if (stateObj) {
      try {
        detailsJson = typeof stateObj === 'string' ? stateObj : JSON.stringify(stateObj, null, 2);
      } catch {
        detailsJson = '';
      }
    }

    setFormData({
      actionPreset: isPreset ? log.action : 'CUSTOM',
      actionCustom: isPreset ? '' : log.action,
      description:  log.description || '',
      created_at:   toDateTimeLocal(log.created_at),
      user_id:      log.user_id || '',
      entity_type:  log.entity_type || '',
      entity_id:    log.entity_id || '',
      details_json: detailsJson,
    });
    setFormModalOpen(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const finalAction = formData.actionPreset === 'CUSTOM'
      ? formData.actionCustom.trim()
      : formData.actionPreset;

    if (!finalAction) {
      toast.error('Action is required');
      return;
    }

    let parsedState = null;
    if (formData.details_json && formData.details_json.trim()) {
      try {
        parsedState = JSON.parse(formData.details_json.trim());
      } catch {
        toast.error('Details JSON is invalid. Please enter valid JSON or leave it empty.');
        return;
      }
    }

    let formattedCreatedAt = null;
    if (formData.created_at && String(formData.created_at).trim()) {
      const d = new Date(formData.created_at);
      if (!isNaN(d.getTime())) {
        formattedCreatedAt = d.toISOString();
      }
    }

    const payload = {
      action: finalAction,
      description: formData.description?.trim() || null,
      createdAt: formattedCreatedAt,
      userId: formData.user_id?.trim() || null,
      entityType: formData.entity_type?.trim() || null,
      // If editing, preserve existing entity_id; if new, let backend auto-generate upon save!
      entityId: editingLog ? (formData.entity_id?.trim() || null) : null,
      afterState: parsedState,
    };

    if (editingLog) {
      updateMutation.mutate({ id: editingLog.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = logs.filter(log => {
    const isSim = (log.action || '').includes('SIMULATION') || (log.action || '').includes('DRILL') || (log.entity_type || '').includes('SIMULATION');
    if (categoryTab === 'live' && isSim) return false;
    if (categoryTab === 'simulation' && !isSim) return false;

    const queryStr = search.toLowerCase();
    const cleanDesc = (log.description || '').toLowerCase();
    const matchSearch = !search ||
      (log.user_email   || '').toLowerCase().includes(queryStr) ||
      (log.user_full_name || '').toLowerCase().includes(queryStr) ||
      (log.action       || '').toLowerCase().includes(queryStr) ||
      (log.entity_type  || '').toLowerCase().includes(queryStr) ||
      cleanDesc.includes(queryStr) ||
      (log.entity_id    || '').toLowerCase().includes(queryStr);
    const matchAction = !actionFilter || (log.action || '').includes(actionFilter);
    return matchSearch && matchAction;
  });

  const inputCls = "w-full text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm transition-all";

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
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all hover:shadow hover:-translate-y-0.5 active:translate-y-0">
            <Plus size={15} />
            Add Audit Log
          </button>
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
                          onClick={() => openEditModal(log)}
                          title="Edit Audit Log"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors">
                          <Edit2 size={15} />
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

      {/* CREATE & EDIT MODAL */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                  {editingLog ? <Edit2 size={16} /> : <Plus size={16} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingLog ? 'Edit Audit Log Entry' : 'Create New Audit Log Entry'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingLog ? 'Modify activity record, timestamp, and details' : 'Log a customized activity or test event'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {/* CUSTOM DATE & TIME PICKER */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar size={13} className="text-red-500" />
                    Event Date &amp; Time (Timestamp)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, created_at: toDateTimeLocal(new Date()) }))}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline">
                      Set to Now
                    </button>
                    {formData.created_at && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                        <button
                          type="button"
                          onClick={() => setFormData(f => ({ ...f, created_at: '' }))}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-400 hover:underline">
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={formData.created_at || ''}
                  onChange={e => setFormData(f => ({ ...f, created_at: e.target.value }))}
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Customize the exact date and time recorded for this activity. Leave blank to default to current date and time.
                </p>
              </div>

              {/* ACTION SELECTION */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Action Type *
                </label>
                <select
                  className={inputCls}
                  value={formData.actionPreset}
                  onChange={e => setFormData(f => ({ ...f, actionPreset: e.target.value }))}>
                  {PRESET_ACTIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>

                {formData.actionPreset === 'CUSTOM' && (
                  <input
                    type="text"
                    placeholder="Enter custom action (e.g. SYSTEM_OPTIMIZATION)"
                    className={`${inputCls} mt-2 font-mono uppercase`}
                    value={formData.actionCustom}
                    onChange={e => setFormData(f => ({ ...f, actionCustom: e.target.value }))}
                  />
                )}
              </div>

              {/* USER / OPERATOR & ENTITY TYPE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Operator / User
                  </label>
                  <select
                    className={inputCls}
                    value={formData.user_id}
                    onChange={e => setFormData(f => ({ ...f, user_id: e.target.value }))}>
                    <option value="">System (Automated / None)</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Entity Type
                  </label>
                  <input
                    list="entity-types-list"
                    className={inputCls}
                    placeholder="e.g. FLOOD_SIMULATION"
                    value={formData.entity_type}
                    onChange={e => setFormData(f => ({ ...f, entity_type: e.target.value }))}
                  />
                  <datalist id="entity-types-list">
                    {COMMON_ENTITY_TYPES.map(e => (
                      <option key={e} value={e} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* ENTITY ID - READ-ONLY & AUTO-GENERATED (NO MANUAL TYPING REQUIRED) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Entity Reference ID
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    Auto-generated upon save
                  </span>
                </div>
                <input
                  type="text"
                  readOnly
                  disabled
                  placeholder="Auto-generated upon save"
                  className={`${inputCls} bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none font-mono text-[11px]`}
                  value={editingLog ? (formData.entity_id || 'None') : 'Auto-generated upon save'}
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {editingLog
                    ? 'Unique reference ID linked to this activity log entry.'
                    : 'A unique reference ID is automatically created upon saving. No manual entry needed.'}
                </p>
              </div>

              {/* DESCRIPTION - MULTI-LINE COMFORTABLE */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Description / Notes
                </label>
                <textarea
                  rows={3}
                  className={inputCls}
                  placeholder="Enter a plain, readable description of what occurred (e.g. Dispatched BFP Team for flood rescue in Brgy. Wawa)..."
                  value={formData.description}
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Displays in the table as a clean, understandable description for MDRRMO officers.
                </p>
              </div>

              {/* DETAILS / STATE (JSON) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Additional Details / State Payload (JSON, Optional)
                </label>
                <textarea
                  rows={3}
                  className={`${inputCls} font-mono text-[11px]`}
                  placeholder='{"notes": "Monsoon surge warning", "water_level_m": 2.5}'
                  value={formData.details_json}
                  onChange={e => setFormData(f => ({ ...f, details_json: e.target.value }))}
                />
              </div>

              {/* MODAL FOOTER */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all disabled:opacity-50">
                  <Check size={14} />
                  {editingLog ? 'Save Changes' : 'Create Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
              <button
                type="button"
                onClick={() => {
                  const toEdit = viewLog;
                  setViewLog(null);
                  openEditModal(toEdit);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 transition-colors">
                <Edit2 size={13} />
                Edit This Log
              </button>
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
