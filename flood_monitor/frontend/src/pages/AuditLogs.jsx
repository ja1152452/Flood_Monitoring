import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuditLogs, createAuditLog, updateAuditLog, deleteAuditLog } from '../api/analytics';
import { getUsers } from '../api/users';
import { getEvacuationCenters } from '../api/evacuation';
import { useAuthStore } from '../store/authStore';
import {
  BUSINESS_MODULES,
  ENTITY_TYPES,
  SEVERITY_CONFIG,
  generateReferenceCode,
  formatActionLabel,
  formatEntityName,
  formatFriendlyDateTime,
  formatRelativeTime,
  parseLogPayload,
} from '../utils/auditLogFormatter';
import {
  Search, Activity, Waves, Layers, Plus, Edit2, Trash2,
  Eye, Calendar, Clock, X, Check, AlertCircle, FileText,
  User, Shield, Tag, Sparkles, RefreshCw, ChevronDown, ChevronRight,
  Info, CheckCircle2, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

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

export default function AuditLogs() {
  const [page,          setPage]          = useState(0);
  const [search,        setSearch]        = useState('');
  const [actionFilter,  setActionFilter]  = useState('');
  const [categoryTab,   setCategoryTab]   = useState('all'); // 'all' | 'live' | 'simulation' | 'manual'
  const [sourceFilter,  setSourceFilter]  = useState('all'); // 'all' | 'manual' | 'system'

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingLog,    setEditingLog]    = useState(null);
  const [viewLog,       setViewLog]       = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [showTechDiag,  setShowTechDiag]  = useState(false); // toggle technical diagnostic accordion in view modal

  // Manual Audit Log Form State (Completely Human-Friendly, Zero Raw JSON)
  const [formData, setFormData] = useState({
    action:        'ALERT_TRIGGERED',
    summary:       '',
    notes:         '',
    severity:      'NORMAL',
    created_at:    '',
    entity_type:   'Flood Alert Warning',
    entity_id:     '',
    selected_user: '',
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

  const { data: evacCenters = [] } = useQuery({
    queryKey: ['evac-centers-for-audit'],
    queryFn:  getEvacuationCenters,
  });

  const createMutation = useMutation({
    mutationFn: createAuditLog,
    onSuccess: () => {
      toast.success('Operational audit log successfully recorded');
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setFormModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to record audit log');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateAuditLog(id, data),
    onSuccess: () => {
      toast.success('Audit log record successfully updated');
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setFormModalOpen(false);
      setEditingLog(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update audit log');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAuditLog,
    onSuccess: () => {
      toast.success('Audit log record deleted');
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete audit log');
    },
  });

  // Open Create Modal with auto-generated reference ID and defaults
  const openCreateModal = () => {
    setEditingLog(null);
    const defaultEntityType = 'Flood Alert Warning';
    const autoRef = generateReferenceCode(defaultEntityType);

    setFormData({
      action:        'ALERT_TRIGGERED',
      summary:       '',
      notes:         '',
      severity:      'NORMAL',
      created_at:    toDateTimeLocal(new Date()),
      entity_type:   defaultEntityType,
      entity_id:     autoRef,
      selected_user: currentUser?.id || '',
    });
    setFormModalOpen(true);
  };

  // Open Edit Modal prefilled with friendly fields
  const openEditModal = (log) => {
    setEditingLog(log);
    const parsed = parseLogPayload(log);

    setFormData({
      action:        log.action || 'GENERAL_NOTE',
      summary:       parsed.summary || log.description || '',
      notes:         parsed.notes || '',
      severity:      parsed.severity || log.severity || 'NORMAL',
      created_at:    toDateTimeLocal(log.created_at),
      entity_type:   formatEntityName(log.entity_type),
      entity_id:     log.entity_id || generateReferenceCode(log.entity_type),
      selected_user: log.user_id || '',
    });
    setFormModalOpen(true);
  };

  // When entity type changes in the form, automatically re-generate matching reference ID if default
  const handleEntityTypeChange = (newType) => {
    setFormData(f => ({
      ...f,
      entity_type: newType,
      entity_id: generateReferenceCode(newType),
    }));
  };

  // Form submission handler
  const handleFormSubmit = (e) => {
    e.preventDefault();

    if (!formData.summary.trim()) {
      toast.error('Please provide a primary summary headline describing this event.');
      return;
    }

    const payload = {
      action:      formData.action,
      summary:     formData.summary.trim(),
      description: formData.summary.trim(),
      notes:       formData.notes.trim(),
      severity:    formData.severity,
      createdAt:   formData.created_at ? new Date(formData.created_at).toISOString() : null,
      userId:      formData.selected_user || currentUser?.id || null,
      entityType:  formData.entity_type,
      entityId:    formData.entity_id.trim() || generateReferenceCode(formData.entity_type),
    };

    if (editingLog) {
      updateMutation.mutate({ id: editingLog.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Filtering
  const filtered = logs.filter(log => {
    const isSim = (log.action || '').includes('SIMULATION') || (log.action || '').includes('DRILL') || (log.entity_type || '').includes('SIMULATION');
    const isManual = Boolean(log.is_manual);

    if (categoryTab === 'live' && isSim) return false;
    if (categoryTab === 'simulation' && !isSim) return false;
    if (categoryTab === 'manual' && !isManual) return false;

    if (sourceFilter === 'manual' && !isManual) return false;
    if (sourceFilter === 'system' && isManual) return false;

    const queryStr = search.toLowerCase();
    const actionLabel = formatActionLabel(log.action).toLowerCase();
    const entityLabel = formatEntityName(log.entity_type).toLowerCase();

    const matchSearch = !search ||
      (log.user_email     || '').toLowerCase().includes(queryStr) ||
      (log.user_full_name || '').toLowerCase().includes(queryStr) ||
      (log.description    || '').toLowerCase().includes(queryStr) ||
      (log.entity_id      || '').toLowerCase().includes(queryStr) ||
      actionLabel.includes(queryStr) ||
      entityLabel.includes(queryStr);

    const matchAction = !actionFilter || (log.action || '').includes(actionFilter);

    return matchSearch && matchAction;
  });

  const inputCls = "w-full text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm transition-all";

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Trail &amp; Operational Logs</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              Forensic Integrity Active
            </span>
          </div>
          <p className="text-sm mt-1 text-slate-600 dark:text-slate-400">
            Official operational event ledger — tracking automated telemetry alerts, drills, and authorized administrative entries
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0">
            <Plus size={15} />
            Record Audit Log
          </button>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search headline, reference, actor…"
              className="pl-8 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={e => { setSourceFilter(e.target.value); setPage(0); }}
            className="text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm font-semibold">
            <option value="all">All Sources</option>
            <option value="manual">✍️ Manual Entries Only</option>
            <option value="system">⚡ Automated System Only</option>
          </select>
        </div>
      </div>

      {/* CATEGORY SWITCHER */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit shadow-inner">
        <button
          onClick={() => { setCategoryTab('all'); setPage(0); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
            categoryTab === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}>
          <Layers size={13} />
          All Logs
        </button>
        <button
          onClick={() => { setCategoryTab('live'); setPage(0); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
            categoryTab === 'live'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}>
          <Activity size={13} />
          Live Operations
        </button>
        <button
          onClick={() => { setCategoryTab('simulation'); setPage(0); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
            categoryTab === 'simulation'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}>
          <Waves size={13} />
          Drills &amp; Simulations
        </button>
        <button
          onClick={() => { setCategoryTab('manual'); setPage(0); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
            categoryTab === 'manual'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}>
          <FileText size={13} />
          Administrative Manual Logs
        </button>
      </div>

      {/* AUDIT LOGS TABLE */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                {['Source', 'Date & Time', 'Event / Action', 'Target Entity', 'Description & Operational Remarks', 'Actor', 'Actions'].map(h => (
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
                const parsed = parseLogPayload(log);
                const actionLabel = formatActionLabel(log.action);
                const entityLabel = formatEntityName(log.entity_type);
                const severityCfg = SEVERITY_CONFIG[parsed.severity] || SEVERITY_CONFIG.NORMAL;
                const refCode = log.entity_id || generateReferenceCode(log.entity_type);

                return (
                  <tr key={log.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    {/* 1. Log Source Indicator */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {log.is_manual ? (
                        <span
                          title={`Manually logged by ${log.user_full_name || log.user_email || 'Admin'}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-xs">
                          ✍️ Manual Entry
                        </span>
                      ) : (
                        <span
                          title="System-generated event telemetry"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          ⚡ System Auto
                        </span>
                      )}
                    </td>

                    {/* 2. Date & Time Column */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {formatFriendlyDateTime(log.created_at)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock size={11} />
                        <span>{formatRelativeTime(log.created_at)}</span>
                      </div>
                    </td>

                    {/* 3. Event / Action Column */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-xs text-slate-900 dark:text-white">
                        {actionLabel}
                      </div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${severityCfg.badge}`}>
                        {severityCfg.label}
                      </span>
                    </td>

                    {/* 4. Target Entity with Auto-Generated Reference */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {entityLabel}
                      </div>
                      <div className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                        #{refCode}
                      </div>
                    </td>

                    {/* 5. Human-Readable Description & Remarks (FITTED & FORMATTED) */}
                    <td className="px-5 py-3.5 text-xs min-w-[300px] max-w-lg">
                      {/* Primary Headline Summary */}
                      <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug break-words">
                        {parsed.summary}
                      </div>

                      {/* Operational Remarks / Justification if present */}
                      {parsed.notes && (
                        <div className="mt-1 text-slate-600 dark:text-slate-300 text-[11px] italic bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 leading-relaxed break-words">
                          "{parsed.notes}"
                        </div>
                      )}

                      {/* Clean Attribute Chips (Never raw JSON) */}
                      {parsed.chips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {parsed.chips.slice(0, 4).map((chip, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800">
                              <span className="text-slate-400 dark:text-slate-500 mr-1">{chip.label}:</span>
                              <span className="font-semibold">{chip.val}</span>
                            </span>
                          ))}
                          {parsed.chips.length > 4 && (
                            <button
                              onClick={() => setViewLog(log)}
                              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
                              +{parsed.chips.length - 4} more
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 6. Actor / Responsible User */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {log.user_full_name || log.user_email || 'Automated System'}
                      </div>
                      {log.user_role && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                          {log.user_role}
                        </span>
                      )}
                    </td>

                    {/* 7. Row Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewLog(log)}
                          title="View Plain-Language Details"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => openEditModal(log)}
                          title="Edit Audit Record"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors">
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(log)}
                          title="Delete Record"
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
              {isLoading ? 'Retrieving audit trail records…' : 'No audit log records match your current filters.'}
            </p>
          </div>
        )}
      </div>

      {/* PAGINATION */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
        <span>Showing {filtered.length} of {logs.length} entries (Page {page + 1})</span>
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

      {/* ========================================================================= */}
      {/* MANUAL AUDIT LOG INPUT MODAL (Zero JSON, Clean & Non-IT Friendly)          */}
      {/* ========================================================================= */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                  {editingLog ? <Edit2 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingLog ? 'Edit Administrative Audit Record' : 'Record Official Audit Log Entry'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Document operational actions, emergency measures, or official field directives
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
              {/* 1. Occurrence Timestamp with Shortcuts */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar size={13} className="text-red-500" />
                    Occurrence Date &amp; Time
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, created_at: toDateTimeLocal(new Date()) }))}
                      className="text-xs font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline">
                      Set to Current Time
                    </button>
                    {formData.created_at && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                        <button
                          type="button"
                          onClick={() => setFormData(f => ({ ...f, created_at: '' }))}
                          className="text-xs font-bold text-rose-500 hover:text-rose-400 hover:underline">
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
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  You can set retroactive dates for past incidents. The system automatically preserves the exact server submission time separately for security forensics.
                </p>
              </div>

              {/* 2. Action / Event Categorization (Grouped by Business Module) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Event Category &amp; Action *
                </label>
                <select
                  className={inputCls}
                  value={formData.action}
                  onChange={e => {
                    const chosen = e.target.value;
                    let suggestedSeverity = 'NORMAL';
                    for (const m of BUSINESS_MODULES) {
                      const found = m.actions.find(a => a.value === chosen);
                      if (found) { suggestedSeverity = found.defaultSeverity; break; }
                    }
                    setFormData(f => ({ ...f, action: chosen, severity: suggestedSeverity }));
                  }}>
                  {BUSINESS_MODULES.map(module => (
                    <optgroup key={module.group} label={`${module.icon} ${module.group}`}>
                      {module.actions.map(act => (
                        <option key={act.value} value={act.value}>
                          {act.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* 3. Target Entity & Auto-Generated Reference ID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Target Subject Type
                  </label>
                  <select
                    className={inputCls}
                    value={formData.entity_type}
                    onChange={e => handleEntityTypeChange(e.target.value)}>
                    {ENTITY_TYPES.map(e => (
                      <option key={e.value} value={e.value}>
                        {e.icon} {e.value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Auto-Generated Reference ID
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, entity_id: generateReferenceCode(f.entity_type) }))}
                      title="Generate new unique identifier"
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 flex items-center gap-1 hover:underline">
                      <RefreshCw size={11} />
                      Regenerate
                    </button>
                  </div>
                  <input
                    type="text"
                    className={`${inputCls} font-mono font-bold text-slate-800 dark:text-slate-200`}
                    value={formData.entity_id}
                    onChange={e => setFormData(f => ({ ...f, entity_id: e.target.value }))}
                  />
                </div>
              </div>

              {/* Optional Quick Link to Existing System Record */}
              {formData.entity_type.includes('User') && (
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900 space-y-1.5">
                  <label className="text-xs font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1">
                    <User size={13} />
                    Link to Registered Citizen / Official:
                  </label>
                  <select
                    className={inputCls}
                    value={formData.selected_user}
                    onChange={e => {
                      const uId = e.target.value;
                      const uObj = usersList.find(u => u.id === uId);
                      setFormData(f => ({
                        ...f,
                        selected_user: uId,
                        entity_id: uObj ? `USR-${uObj.email.split('@')[0].toUpperCase()}-${uId.slice(0,4).toUpperCase()}` : f.entity_id
                      }));
                    }}>
                    <option value="">Choose User (Optional)…</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email} ({u.role}) — {u.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 4. Primary Summary Headline (Human-Readable) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Primary Summary Headline *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Updated emergency contact and siren schedule for Brgy. Concepcion Hall"
                  className={inputCls}
                  value={formData.summary}
                  onChange={e => setFormData(f => ({ ...f, summary: e.target.value }))}
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  A concise, plain-language description displayed as the primary entry title in the audit table.
                </p>
              </div>

              {/* 5. Operational Notes / Justification */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Operational Notes &amp; Official Remarks
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide additional background context, reason for the directive, responder observations, or authorized justification..."
                  className={inputCls}
                  value={formData.notes}
                  onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* 6. Status / Severity Tag */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Status &amp; Severity Level
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => {
                    const isSelected = formData.severity === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData(f => ({ ...f, severity: key }))}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border text-center ${
                          isSelected
                            ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        }`}>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
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
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md transition-all disabled:opacity-50">
                  <Check size={14} />
                  {editingLog ? 'Update Record' : 'Save Audit Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PLAIN-LANGUAGE INSPECTION MODAL (Human-Friendly Presentation)             */}
      {/* ========================================================================= */}
      {viewLog && (() => {
        const parsed = parseLogPayload(viewLog);
        const actionLabel = formatActionLabel(viewLog.action);
        const entityLabel = formatEntityName(viewLog.entity_type);
        const severityCfg = SEVERITY_CONFIG[parsed.severity] || SEVERITY_CONFIG.NORMAL;
        const refCode = viewLog.entity_id || generateReferenceCode(viewLog.entity_type);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                    <Eye size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Official Audit Log Overview
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Reference #{refCode}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setViewLog(null); setShowTechDiag(false); }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Source & Severity Banner */}
                <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    {viewLog.is_manual ? (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                        ✍️ Official Manual Administrative Entry
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-800">
                        ⚡ Automated Telemetry Event
                      </span>
                    )}
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase border ${severityCfg.badge}`}>
                    Status: {severityCfg.label}
                  </span>
                </div>

                {/* Primary Summary Callout */}
                <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-blue-700 dark:text-blue-300">
                    Primary Event Summary
                  </span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                    {parsed.summary}
                  </p>
                </div>

                {/* Operational Notes */}
                {parsed.notes && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                      Operational Remarks &amp; Justification
                    </span>
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed italic whitespace-pre-wrap">
                      "{parsed.notes}"
                    </p>
                  </div>
                )}

                {/* Event Facts Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">Event Action:</span>
                    <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{actionLabel}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">Subject / Target Entity:</span>
                    <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{entityLabel}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">Event Occurrence Date:</span>
                    <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                      {formatFriendlyDateTime(viewLog.created_at)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">Forensic Submission Time:</span>
                    <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                      {formatFriendlyDateTime(viewLog.actual_created_at || viewLog.created_at)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 sm:col-span-2">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-semibold">Responsible Administrator / Actor:</span>
                    <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                      {viewLog.user_full_name || viewLog.user_email || 'Automated System Routine'}
                      {viewLog.user_role ? ` (${viewLog.user_role})` : ''}
                    </span>
                  </div>
                </div>

                {/* Clean Attribute Chips */}
                {parsed.chips.length > 0 && (
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2 block">
                      Operational Parameters
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {parsed.chips.map((chip, i) => (
                        <div
                          key={i}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                          <span className="text-slate-500 mr-1">{chip.label}:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{chip.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Collapsible Technical Diagnostics (for IT/Forensics only) */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowTechDiag(s => !s)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                    <span className="flex items-center gap-1.5">
                      <Shield size={13} />
                      Technical Diagnostics &amp; Raw Forensics (Optional)
                    </span>
                    {showTechDiag ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {showTechDiag && (
                    <div className="p-4 bg-slate-900 text-slate-300 text-[11px] font-mono space-y-2">
                      <div><span className="text-slate-500">Record UUID:</span> {viewLog.id}</div>
                      <div><span className="text-slate-500">Client IP:</span> {viewLog.ip_address || '—'}</div>
                      <div><span className="text-slate-500">User Agent:</span> {viewLog.user_agent || '—'}</div>
                      {viewLog.after_state && (
                        <div>
                          <span className="text-emerald-400 block mb-1">State Payload:</span>
                          <pre className="p-2.5 rounded bg-black/40 text-emerald-300 max-h-36 overflow-auto">
                            {typeof viewLog.after_state === 'string' ? viewLog.after_state : JSON.stringify(viewLog.after_state, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewLog;
                    setViewLog(null);
                    openEditModal(toEdit);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 transition-colors">
                  <Edit2 size={13} />
                  Edit This Record
                </button>

                <button
                  type="button"
                  onClick={() => { setViewLog(null); setShowTechDiag(false); }}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Audit Log Entry</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This forensic action is permanent and cannot be undone.</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div>
                <span className="text-slate-500 font-medium">Event:</span>{' '}
                <span className="font-bold text-slate-900 dark:text-white">{formatActionLabel(deleteTarget.action)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Date:</span>{' '}
                <span className="text-slate-700 dark:text-slate-300">{formatFriendlyDateTime(deleteTarget.created_at)}</span>
              </div>
              {deleteTarget.description && (
                <div className="text-slate-600 dark:text-slate-400 italic pt-1">
                  "{deleteTarget.description}"
                </div>
              )}
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
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
