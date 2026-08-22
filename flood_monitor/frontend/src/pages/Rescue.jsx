import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingSOS, getSOSHistory, dispatchSOS, respondSOS, completeSOS, getActiveBackups, resolveBackup, dispatchBackup } from '../api/sos';
import { getEvacuationCenters } from '../api/evacuation';
import { getResponderLocations } from '../api/users';
import { getSocket } from '../api/socket';
import { RescueMap } from '../components/map/RescueMap';
import { formatDateTime } from '../utils/floodUtils';
import toast from 'react-hot-toast';
import {
  Phone, Bell, ShieldAlert, Send, Users, AlertTriangle, CheckCircle2, UserPlus,
  Shield, Filter, History, Search, Clock, MapPin, UserCheck, XCircle, ExternalLink, FileText, ChevronRight
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Haversine distance calculator in KM
function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2);
}

const STATUS_LABELS = {
  AVAILABLE:          { label: 'Available (Ready)', color: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  DISPATCHED:         { label: 'Rescuing (Dispatched)', color: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  EN_ROUTE:           { label: 'Rescuing (En Route)', color: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  RESCUE_IN_PROGRESS: { label: 'Rescuing (On-Scene)', color: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  OFF_DUTY:           { label: 'Unavailable / Off Duty', color: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300' },
  UNAVAILABLE:        { label: 'Unavailable', color: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300' },
};

const ROLE_CONFIG = {
  PNP: {
    label: 'PNP Police',
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40',
    cardBorder: 'border-l-blue-600',
    icon: '👮',
  },
  BFP: {
    label: 'BFP Fire',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40',
    cardBorder: 'border-l-amber-600',
    icon: '🚒',
  },
  COAST_GUARD: {
    label: 'Coast Guard (PCG)',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/40',
    cardBorder: 'border-l-sky-600',
    icon: '⚓',
  },
  RHU: {
    label: 'RHU Health',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40',
    cardBorder: 'border-l-emerald-600',
    icon: '🏥',
  },
  MDRRMO: {
    label: 'MDRRMO Official',
    badge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40',
    cardBorder: 'border-l-red-600',
    icon: '🚨',
  },
  MDRRMO_RESPONDER: {
    label: 'MDRRMO Official',
    badge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40',
    cardBorder: 'border-l-red-600',
    icon: '🚨',
  },
  BARANGAY_OFFICIAL: {
    label: 'Brgy Official',
    badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/40',
    cardBorder: 'border-l-purple-600',
    icon: '🏛️',
  },
  RESCUE: {
    label: 'Rescue Team',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/40',
    cardBorder: 'border-l-sky-600',
    icon: '⛑️',
  },
};

export default function Rescue() {
  const qc = useQueryClient();
  const prevPendingIds = useRef(new Set());
  const alertAudioRef  = useRef(null);
  const [alertMuted, setAlertMuted]       = useState(false);
  const [alertUnlocked, setAlertUnlocked] = useState(false);
  const [newSosCount, setNewSosCount]     = useState(0);

  // Dispatch modal state
  const [dispatchModalSos, setDispatchModalSos]         = useState(null);
  const [selectedResponderIds, setSelectedResponderIds]   = useState([]);
  const [dispatchNotes, setDispatchNotes]                 = useState('');
  const [dispatchBackupModalRequest, setDispatchBackupModalRequest] = useState(null);
  const [selectedBackupResponderId, setSelectedBackupResponderId]   = useState('');
  const [dispatchBackupNotes, setDispatchBackupNotes]               = useState('');
  const [activeTab, setActiveTab]                         = useState('incidents'); // 'incidents' | 'roster' | 'backups' | 'history'
  const [roleFilter, setRoleFilter]                       = useState('ALL');

  // History search & filters
  const [historySearch, setHistorySearch]                 = useState('');
  const [historyStatusFilter, setHistoryStatusFilter]     = useState('ALL');
  const [selectedHistoryItem, setSelectedHistoryItem]     = useState(null);

  // Fetch pending SOS requests
  const { data: sosList = [] } = useQuery({
    queryKey: ['sos-pending'],
    queryFn:  getPendingSOS,
    refetchInterval: 5000,
  });

  // Fetch full SOS history
  const { data: sosHistory = [] } = useQuery({
    queryKey: ['sos-history'],
    queryFn:  getSOSHistory,
    refetchInterval: 10000,
  });

  // Fetch active backups
  const { data: backups = [] } = useQuery({
    queryKey: ['active-backups'],
    queryFn:  getActiveBackups,
    refetchInterval: 5000,
  });

  // Fetch evacuation centers
  const { data: centers = [] } = useQuery({
    queryKey: ['evacuation'],
    queryFn:  getEvacuationCenters,
  });

  const [responders, setResponders] = useState([]);

  // Fetch responder locations and status
  const fetchResponders = () => {
    getResponderLocations().then(setResponders).catch(() => {});
  };

  useEffect(() => {
    fetchResponders();
    const interval = setInterval(fetchResponders, 5000);

    const socket = getSocket();

    socket.on('responder:location', (data) => {
      setResponders(prev => {
        const idx = prev.findIndex(r => r.id === data.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...data };
          return updated;
        }
        return [...prev, data];
      });
    });

    socket.on('sos:created', (data) => {
      toast.error(`🚨 NEW RESCUE REQUEST! Emergency SOS submitted in ${data?.barangay_name || 'Lumban'}.`);
      qc.invalidateQueries(['sos-pending']);
      qc.invalidateQueries(['sos-history']);
    });
    socket.on('sos:dispatched', () => {
      qc.invalidateQueries(['sos-pending']);
      qc.invalidateQueries(['sos-history']);
    });
    socket.on('sos:updated', () => {
      qc.invalidateQueries(['sos-pending']);
      qc.invalidateQueries(['sos-history']);
    });
    socket.on('sos:declined', (data) => {
      toast.error(`⚠️ Responder ${data.responder?.full_name || 'Unit'} DECLINED dispatch order. Reassignment / Backup required.`);
      qc.invalidateQueries(['sos-pending']);
      qc.invalidateQueries(['sos-history']);
      fetchResponders();
    });
    socket.on('backup:created', (data) => {
      toast.warn(`🚨 FIELD BACKUP REQUESTED! ${data?.target_role || 'Assistance'} requested.`);
      qc.invalidateQueries(['active-backups']);
    });

    return () => {
      clearInterval(interval);
      socket.off('responder:location');
      socket.off('sos:created');
      socket.off('sos:dispatched');
      socket.off('sos:updated');
      socket.off('sos:declined');
      socket.off('backup:created');
    };
  }, [qc]);

  const safeSosList = Array.isArray(sosList) ? sosList : [];
  const safeSosHistory = Array.isArray(sosHistory) ? sosHistory : [];
  const safeResponders = Array.isArray(responders) ? responders : [];
  const safeBackups = Array.isArray(backups) ? backups : [];

  // Audio alerts for new incoming SOS
  useEffect(() => {
    const pendingIds = new Set(
      safeSosList.filter(s => s.status === 'PENDING').map(s => s.id)
    );
    const incoming = [...pendingIds].filter(id => !prevPendingIds.current.has(id));
    if (incoming.length > 0) {
      setNewSosCount(c => c + incoming.length);
      if (!alertMuted && alertUnlocked && alertAudioRef.current) {
        alertAudioRef.current.currentTime = 0;
        alertAudioRef.current.play().catch(() => {});
      }
    }
    prevPendingIds.current = pendingIds;
  }, [safeSosList, alertMuted, alertUnlocked]);

  // Dispatch mutation
  const dispatchMutation = useMutation({
    mutationFn: ({ sosId, responderIds, notes, dispatchType }) => dispatchSOS(sosId, responderIds, notes, dispatchType),
    onSuccess: (_, vars) => {
      toast.success(`🎉 ${vars.dispatchType === 'BACKUP' ? 'Backup' : 'Primary'} Responders dispatched successfully!`);
      setDispatchModalSos(null);
      setSelectedResponderIds([]);
      setDispatchNotes('');
      qc.invalidateQueries(['sos-pending']);
      qc.invalidateQueries(['sos-history']);
      fetchResponders();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to dispatch responders');
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeSOS,
    onSuccess: () => {
      toast.success('Rescue operation completed ✔ (Responders Available Again)');
      qc.invalidateQueries(['sos-pending']);
      qc.invalidateQueries(['sos-history']);
      fetchResponders();
    },
    onError: () => toast.error('Failed to complete rescue'),
  });

  const resolveBackupMutation = useMutation({
    mutationFn: resolveBackup,
    onSuccess: () => {
      toast.success('Field backup request marked as resolved ✔');
      qc.invalidateQueries(['active-backups']);
    },
    onError: () => toast.error('Failed to resolve backup request'),
  });

  const dispatchBackupMutation = useMutation({
    mutationFn: ({ id, responderId, notes }) => dispatchBackup(id, responderId, notes),
    onSuccess: () => {
      toast.success('🎉 Backup responder officially dispatched!');
      setDispatchBackupModalRequest(null);
      setSelectedBackupResponderId('');
      setDispatchBackupNotes('');
      qc.invalidateQueries(['active-backups']);
      qc.invalidateQueries(['sos-pending']);
      fetchResponders();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to dispatch backup responder');
    },
  });

  const pendingCount = safeSosList.filter(s => s.status === 'PENDING').length;
  const dispatchedCount = safeSosList.filter(s => ['DISPATCHED', 'RESPONDING'].includes(s.status)).length;
  const availableResponders = safeResponders.filter(r => !['DISPATCHED', 'EN_ROUTE', 'RESCUE_IN_PROGRESS', 'OFF_DUTY', 'UNAVAILABLE'].includes(r.responder_status));

  const toggleResponderSelection = (r) => {
    if (['DISPATCHED', 'EN_ROUTE', 'RESCUE_IN_PROGRESS', 'OFF_DUTY', 'UNAVAILABLE'].includes(r.responder_status)) {
      toast.error(`Responder ${r.full_name} is currently ${r.responder_status || 'busy'} and cannot be selected until they become Available again.`);
      return;
    }
    setSelectedResponderIds(prev =>
      prev.includes(r.id) ? prev.filter(item => item !== r.id) : [...prev, r.id]
    );
  };

  const handleConfirmDispatch = () => {
    if (!dispatchModalSos) return;
    if (selectedResponderIds.length === 0) {
      toast.error('Please select at least one available responder unit');
      return;
    }
    dispatchMutation.mutate({
      sosId: dispatchModalSos.id,
      responderIds: selectedResponderIds,
      notes: dispatchNotes,
      dispatchType: 'PRIMARY',
    });
  };

  const openDispatchModal = (sos) => {
    setDispatchModalSos(sos);
    setSelectedResponderIds([]);
    setDispatchNotes('');
  };

  // Filtered SOS history items
  const filteredHistory = safeSosHistory.filter(item => {
    const matchesStatus = historyStatusFilter === 'ALL' || item.status === historyStatusFilter;
    const searchLower = historySearch.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      item.citizen_name?.toLowerCase().includes(searchLower) ||
      item.barangay_name?.toLowerCase().includes(searchLower) ||
      item.dispatched_by_name?.toLowerCase().includes(searchLower) ||
      item.message?.toLowerCase().includes(searchLower) ||
      item.citizen_phone?.includes(searchLower);
    return matchesStatus && matchesSearch;
  });


  return (
    <div className="space-y-6">
      <audio ref={alertAudioRef} src="/tornado-siren.mp3" />

      {/* Audio Siren Alert Banner */}
      {!alertUnlocked && pendingCount > 0 && (
        <div className="flex items-center justify-between bg-red-900/40 border border-red-700 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 blink" />
            <span className="text-sm font-semibold text-red-300">
              🚨 {pendingCount} Pending Rescue Request{pendingCount > 1 ? 's' : ''} awaiting MDRRMO Dispatch
            </span>
          </div>
          <button
            onClick={() => setAlertUnlocked(true)}
            className="flex items-center gap-1.5 text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
            <Bell size={13} /> Enable Sound Alert
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <ShieldAlert className="text-red-600 dark:text-red-500" size={28} />
            MDRRMO Command & Control Dispatch
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Centralized Rescue Dispatching Authority · Municipality of Lumban
          </p>
        </div>

        {/* Operational Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2 text-center">
            <div className="text-xs text-red-700 dark:text-red-400 font-bold">Pending Dispatch</div>
            <div className="text-lg font-black text-red-600 dark:text-red-500">{pendingCount}</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2 text-center">
            <div className="text-xs text-amber-700 dark:text-amber-400 font-bold">Active Operations</div>
            <div className="text-lg font-black text-amber-600 dark:text-amber-400">{dispatchedCount}</div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl px-3 py-2 text-center">
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">Available Units</div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{availableResponders.length}</div>
          </div>
          <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-xl px-3 py-2 text-center">
            <div className="text-xs text-sky-700 dark:text-sky-400 font-bold">Total Resolved</div>
            <div className="text-lg font-black text-sky-600 dark:text-sky-400">
              {safeSosHistory.filter(s => s.status === 'RESOLVED' || s.status === 'COMPLETED').length}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Rescue Map */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            📍 Real-time Operation Map & Unit Vectoring
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Pending</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Dispatched</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Responding / En Route</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Responders</span>
          </div>
        </div>
        <RescueMap
          sosList={safeSosList}
          evacuationCenters={centers}
          responders={safeResponders}
          onRespond={(sosId) => {
            const sos = safeSosList.find(s => s.id === sosId);
            if (sos) openDispatchModal(sos, 'PRIMARY');
          }}
          onComplete={id => completeMutation.mutate(id)}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('incidents')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors shrink-0 ${
            activeTab === 'incidents'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}>
          <AlertTriangle size={14} /> Rescue Incidents ({safeSosList.length})
        </button>

        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors shrink-0 ${
            activeTab === 'roster'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}>
          <Users size={14} /> Responder Availability ({safeResponders.length})
        </button>

        <button
          onClick={() => setActiveTab('backups')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors shrink-0 ${
            activeTab === 'backups'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}>
          <ShieldAlert size={14} /> Field Backup Requests ({safeBackups.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors shrink-0 ${
            activeTab === 'history'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}>
          <History size={14} /> SOS Dispatch History ({safeSosHistory.length})
        </button>
      </div>

      {/* TAB 1: INCIDENTS LIST */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          {safeSosList.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-2" />
              All clear — No active rescue requests at this time.
            </div>
          ) : (
            safeSosList.map(sos => {

              const hasDispatches = Array.isArray(sos.dispatched_responders) && sos.dispatched_responders.length > 0;
              const isPending = sos.status === 'PENDING' && !hasDispatches;
              const isDispatched = sos.status === 'DISPATCHED' || (sos.status === 'PENDING' && hasDispatches);
              const isResponding = sos.status === 'RESPONDING';


              return (
                <div
                  key={sos.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isPending
                      ? 'bg-red-500/5 dark:bg-red-950/20 border-red-500/40'
                      : isDispatched
                      ? 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/40'
                      : 'bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/40'
                  }`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-3 h-3 rounded-full ${
                            isPending ? 'bg-red-500 blink' : isDispatched ? 'bg-amber-500' : 'bg-blue-500'
                          }`}
                        />
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {sos.citizen_name || 'Unknown Resident'}
                        </h3>

                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isPending
                              ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                              : isDispatched
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          }`}>
                          {isPending
                            ? 'Pending MDRRMO Dispatch'
                            : isDispatched
                            ? 'Dispatched — Awaiting Response'
                            : 'Responding / En Route'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-4 flex-wrap">
                        <span>📍 <strong>{sos.barangay_name || 'Unknown Barangay'}</strong></span>
                        <span>🕒 {formatDateTime(sos.created_at)}</span>
                        {sos.citizen_phone && (
                          <a
                            href={`tel:${sos.citizen_phone}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium">
                            <Phone size={12} /> {sos.citizen_phone}
                          </a>
                        )}
                      </div>

                      {sos.message && (
                        <p className="text-xs text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-900/50 p-2.5 rounded-lg italic border border-slate-200 dark:border-slate-800">
                          "{sos.message}"
                        </p>
                      )}

                      {/* Dispatched Responders Info with Role & Dispatch Status Badges */}
                      {sos.dispatched_responders && sos.dispatched_responders.length > 0 && (
                        <div className="mt-2 text-xs bg-slate-100 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Assigned Units & Dispatch Status:
                          </span>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {sos.dispatched_responders.map(r => {
                              const roleCfg = ROLE_CONFIG[r.role] || ROLE_CONFIG.RESCUE;
                              const statusVal = r.responder_duty_status || r.status || 'DISPATCHED';
                              const isDeclined = statusVal === 'DECLINED';
                              const isOnScene = statusVal === 'RESCUE_IN_PROGRESS';
                              const isEnRoute = ['EN_ROUTE', 'ACCEPTED'].includes(statusVal);

                              return (
                                <div
                                  key={r.id}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 font-medium border ${
                                    r.dispatch_type === 'BACKUP'
                                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                                      : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300'
                                  }`}>
                                  <span>{roleCfg.icon}</span>
                                  <span>{r.full_name} ({roleCfg.label})</span>
                                  <span className="text-[10px] uppercase font-bold opacity-80">· {r.dispatch_type}</span>
                                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border uppercase ${
                                    isDeclined
                                      ? 'bg-red-500/20 text-red-600 border-red-500/30'
                                      : isOnScene
                                      ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30'
                                      : isEnRoute
                                      ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-600 border-amber-500/30'
                                  }`}>
                                    {isOnScene ? 'ON SCENE 📍' : isEnRoute ? 'EN ROUTE 🚑' : isDeclined ? 'DECLINED ✖' : 'DISPATCHED 🛡️'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openDispatchModal(sos)}
                        className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm">
                        <Send size={13} /> Official Dispatch (MDRRMO)
                      </button>

                      {sos.dispatched_responders?.length > 0 && (
                        <button
                          onClick={() => {
                            setDispatchBackupModalRequest({
                              id: sos.id,
                              sos_id: sos.id,
                              isDirectSosBackup: true,
                              lat: sos.lat,
                              lng: sos.lng,
                              target_role: null,
                              requester_name: 'MDRRMO Command',
                              requester_role: 'MDRRMO',
                              message: `Backup requested for active SOS incident in ${sos.barangay_name || 'Lumban'}`
                            });
                            setSelectedBackupResponderId('');
                            setDispatchBackupNotes('');
                          }}
                          className="flex items-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-2.5 rounded-xl transition-all shadow-sm">
                          <UserPlus size={13} /> Add Backup
                        </button>
                      )}

                      {(isDispatched || isResponding) && (
                        <button
                          onClick={() => completeMutation.mutate(sos.id)}
                          className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2.5 rounded-xl transition-all">
                          <CheckCircle2 size={13} /> Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: RESPONDER AVAILABILITY ROSTER */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Filter size={14} /> Filter Responders by Agency / Role:
            </div>
            <div className="flex flex-wrap gap-2">
              {['ALL', 'PNP', 'BFP', 'COAST_GUARD', 'RHU', 'MDRRMO', 'BARANGAY_OFFICIAL', 'RESCUE'].map(roleKey => {
                const isSel = roleFilter === roleKey;
                const roleCfg = ROLE_CONFIG[roleKey] || { label: 'All Responders', icon: '🛡️' };
                return (
                  <button
                    key={roleKey}
                    onClick={() => setRoleFilter(roleKey)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 border ${
                      isSel
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                    }`}>
                    <span>{roleCfg.icon}</span>
                    <span>{roleKey === 'BFP' ? 'BFP (Fire & Coast Guard)' : roleCfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {safeResponders.filter(r => roleFilter === 'ALL' || r.role === roleFilter || (roleFilter === 'BFP' && (r.role === 'BFP' || r.role === 'COAST_GUARD')) || (roleFilter === 'MDRRMO' && (r.role === 'MDRRMO' || r.role === 'MDRRMO_RESPONDER'))).map(r => {
              const statusCfg = STATUS_LABELS[r.responder_status] || STATUS_LABELS.AVAILABLE;
              const roleCfg = ROLE_CONFIG[r.role] || ROLE_CONFIG.RESCUE;

              return (
                <div
                  key={r.id}
                  className={`p-4 rounded-2xl bg-white dark:bg-slate-800 border border-l-4 ${roleCfg.cardBorder} shadow-sm space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${roleCfg.badge}`}>
                      {roleCfg.icon} {roleCfg.label}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {r.full_name}
                  </h4>

                  <div className="text-xs text-slate-500 space-y-1">
                    {r.phone_number && <div>📞 {r.phone_number}</div>}
                    <div>📍 {r.last_lat ? `${r.last_lat.toFixed(4)}, ${r.last_lng.toFixed(4)}` : 'No GPS ping yet'}</div>
                    {r.updated_at && <div>🕒 Last active: {formatDateTime(r.updated_at)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: FIELD BACKUP REQUESTS */}
      {activeTab === 'backups' && (
        <div className="space-y-4">
          {safeBackups.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              <Shield size={40} className="mx-auto text-sky-500 mb-2" />
              No active field backup requests at this time.
            </div>
          ) : (
            safeBackups.map(b => (

              <div key={b.id} className="p-4 rounded-2xl bg-sky-500/5 dark:bg-sky-950/20 border border-sky-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase">
                      🚨 Backup Requested by {b.requester_role} — {b.requester_name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 italic">"{b.message || 'Backup needed on-site.'}"</p>
                  <div className="text-[11px] text-slate-500">
                    Target Unit: <strong>{b.target_role}</strong> · Time: {formatDateTime(b.created_at)}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setDispatchBackupModalRequest(b);
                      setSelectedBackupResponderId('');
                    }}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-sm">
                    <UserPlus size={13} /> Dispatch {b.target_role || 'Backup'}
                  </button>
                  <button
                    onClick={() => resolveBackupMutation.mutate(b.id)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1 shadow-sm">
                    <CheckCircle2 size={13} /> Accept & Resolve
                  </button>
                  <button
                    onClick={() => {
                      resolveBackupMutation.mutate(b.id);
                      toast.info('Backup request declined.');
                    }}
                    className="text-xs bg-red-600/90 hover:bg-red-700 text-white font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm">
                    ✖ Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: SOS DISPATCH & INCIDENT HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* History Search & Status Filters */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Search history by resident name, phone, barangay, or dispatcher..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0 flex items-center gap-1">
                  <Filter size={12} /> Status:
                </span>
                {['ALL', 'RESOLVED', 'DISPATCHED', 'RESPONDING', 'CANCELLED', 'PENDING'].map(st => (
                  <button
                    key={st}
                    onClick={() => setHistoryStatusFilter(st)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 border ${
                      historyStatusFilter === st
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                    }`}>
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* History Table / Card List */}
          {filteredHistory.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              <FileText size={36} className="mx-auto text-slate-400 mb-2" />
              No rescue incident history records found matching your filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map(item => {
                const isResolved = item.status === 'RESOLVED' || item.status === 'COMPLETED';
                const isCancelled = item.status === 'CANCELLED';
                const isDispatched = item.status === 'DISPATCHED';
                const isResponding = item.status === 'RESPONDING';

                const statusBadgeStyle = isResolved
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : isCancelled
                  ? 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
                  : isDispatched
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  : isResponding
                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                  : 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30';

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:border-red-500/40 transition-all space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-750 pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isResolved ? 'bg-emerald-500' : isCancelled ? 'bg-slate-400' : isDispatched ? 'bg-amber-500' : 'bg-red-500'}`} />
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {item.citizen_name || 'Resident'}
                            {item.citizen_phone && (
                              <a href={`tel:${item.citizen_phone}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-normal">
                                <Phone size={11} /> {item.citizen_phone}
                              </a>
                            )}
                          </h3>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>📍 <strong>{item.barangay_name || 'Lumban'}</strong></span>
                            {item.lat && (
                              <a
                                href={`https://maps.google.com/?q=${item.lat},${item.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-blue-500 flex items-center gap-0.5">
                                ({item.lat.toFixed(4)}, {item.lng.toFixed(4)}) <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border ${statusBadgeStyle}`}>
                          {item.status}
                        </span>
                        <button
                          onClick={() => setSelectedHistoryItem(item)}
                          className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-xl transition-all">
                          View Details <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Content Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {/* Column 1: Emergency & Dispatcher */}
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                        <div className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                          📢 Request Info & Dispatcher
                        </div>
                        {item.message && (
                          <div className="text-slate-600 dark:text-slate-400 italic">"{item.message}"</div>
                        )}
                        <div className="text-slate-500 pt-1 border-t border-slate-200/50 dark:border-slate-800">
                          Dispatched By: <strong className="text-slate-800 dark:text-slate-200">{item.dispatched_by_name || 'MDRRMO Dispatcher'}</strong>
                          {item.dispatched_by_role && (
                            <span className="text-[10px] ml-1 px-1.5 py-0.2 bg-red-500/10 text-red-600 font-bold rounded">
                              {item.dispatched_by_role}
                            </span>
                          )}
                        </div>
                        {item.dispatch_notes && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            Notes: {item.dispatch_notes}
                          </div>
                        )}
                      </div>

                      {/* Column 2: Assigned Responders */}
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                        <div className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                          ⛑️ Assigned Responder Units ({item.dispatched_responders?.length || 0})
                        </div>
                        {item.dispatched_responders?.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.dispatched_responders.map(r => {
                              const roleCfg = ROLE_CONFIG[r.role] || ROLE_CONFIG.RESCUE;
                              return (
                                <span
                                  key={r.id}
                                  className={`text-[10px] px-2 py-0.5 rounded font-medium border flex items-center gap-1 ${
                                    r.dispatch_type === 'BACKUP'
                                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                                      : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                                  }`}>
                                  <span>{roleCfg.icon}</span>
                                  <span>{r.full_name}</span>
                                  <span className="opacity-70">({r.dispatch_type})</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-slate-400 italic text-[11px]">No units dispatched</div>
                        )}
                      </div>

                      {/* Column 3: Operation Timestamps */}
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <div className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                          ⏱️ Timeline Log
                        </div>
                        <div>🕒 Requested: <strong>{formatDateTime(item.created_at)}</strong></div>
                        {item.dispatched_at && (
                          <div>🚀 Dispatched: <strong>{formatDateTime(item.dispatched_at)}</strong></div>
                        )}
                        {item.responded_at && (
                          <div>🚑 Responded: <strong>{formatDateTime(item.responded_at)}</strong></div>
                        )}
                        {item.resolved_at && (
                          <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                            ✅ Resolved: {formatDateTime(item.resolved_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DISPATCH SELECTION MODAL */}
      {dispatchModalSos && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="text-red-600" size={20} />
                  MDRRMO Official Rescue Dispatch
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Assign available responder units to this rescue request
                </p>
              </div>
              <button
                onClick={() => setDispatchModalSos(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg">
                ✕
              </button>
            </div>

            {/* Resident & Emergency Info Summary */}
            <div className="bg-red-500/5 dark:bg-red-950/20 border border-red-500/30 p-3 rounded-xl space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {dispatchModalSos.citizen_name || 'Resident Name'}
                </span>
                <span className="text-red-600 dark:text-red-400 font-extrabold uppercase">
                  📍 {dispatchModalSos.barangay_name || 'Lumban'}
                </span>
              </div>
              {dispatchModalSos.citizen_phone && (
                <div className="text-slate-600 dark:text-slate-400 font-medium">
                  📞 Phone: {dispatchModalSos.citizen_phone}
                </div>
              )}
              {dispatchModalSos.message && (
                <div className="text-slate-700 dark:text-slate-300 italic pt-1 border-t border-red-500/20">
                  "{dispatchModalSos.message}"
                </div>
              )}
            </div>

            {/* Primary Dispatch Mode Notice (Backup/Manpower option removed as requested) */}
            <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded-xl text-[11px] text-red-700 dark:text-red-300 font-medium flex items-center gap-2">
              <Send size={15} className="shrink-0 text-red-500" />
              <span>Primary Lead Unit Dispatch Mode. Only responders with status <strong>Available</strong> may be selected. Responders currently busy cannot be selected.</span>
            </div>

            {/* Responder Selection Checklist with Agency Role Colors */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Select Responders (Available Units Only)</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold lowercase border border-emerald-500/20">📍 sorted: nearest first</span>
              </label>

              <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-700 rounded-xl p-2">
                {safeResponders.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-4">No responders registered/online.</div>
                ) : (
                  [...safeResponders]
                    .sort((a, b) => {
                      const distA = getDistanceKm(a.last_lat, a.last_lng, dispatchModalSos.lat, dispatchModalSos.lng) ?? 999999;
                      const distB = getDistanceKm(b.last_lat, b.last_lng, dispatchModalSos.lat, dispatchModalSos.lng) ?? 999999;
                      return distA - distB;
                    })
                    .map(r => {

                    const distKm = getDistanceKm(r.last_lat, r.last_lng, dispatchModalSos.lat, dispatchModalSos.lng);
                    const isChecked = selectedResponderIds.includes(r.id);
                    const isBusy = ['DISPATCHED', 'EN_ROUTE', 'RESCUE_IN_PROGRESS', 'OFF_DUTY', 'UNAVAILABLE'].includes(r.responder_status);
                    const statusCfg = STATUS_LABELS[r.responder_status] || STATUS_LABELS.AVAILABLE;
                    const roleCfg = ROLE_CONFIG[r.role] || ROLE_CONFIG.RESCUE;

                    return (
                      <label
                        key={r.id}
                        onClick={() => toggleResponderSelection(r)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border border-l-4 ${roleCfg.cardBorder} cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-red-500/10 border-red-500/50 text-slate-900 dark:text-white'
                            : isBusy
                            ? 'opacity-40 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                        }`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isBusy}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {r.full_name}
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${roleCfg.badge}`}>
                                {roleCfg.icon} {roleCfg.label}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Status: <strong>{statusCfg.label}</strong> {distKm ? `· ${distKm} km away` : ''}
                            </div>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusCfg.color}`}>
                          {isBusy ? (['DISPATCHED', 'EN_ROUTE', 'RESCUE_IN_PROGRESS'].includes(r.responder_status) ? 'Rescuing' : 'Unavailable') : 'Available'}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Dispatch Instructions / Special Notes
              </label>
              <textarea
                rows={2}
                value={dispatchNotes}
                onChange={e => setDispatchNotes(e.target.value)}
                placeholder="e.g. Bring swift water rescue boat + medical kit"
                className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDispatchModalSos(null)}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium px-4 py-2 rounded-xl">
                Cancel
              </button>
              <button
                onClick={handleConfirmDispatch}
                disabled={dispatchMutation.isPending || selectedResponderIds.length === 0}
                className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-md disabled:opacity-50">
                <Send size={14} />
                {dispatchMutation.isPending
                  ? 'Dispatching...'
                  : `Confirm Primary Dispatch (${selectedResponderIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED HISTORY INCIDENT TIMELINE MODAL */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="text-red-600" size={20} />
                  Rescue Incident Full History Log
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Complete dispatch trail, location data, and status progression
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg">
                ✕
              </button>
            </div>

            {/* Resident & Incident Overview Header */}
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {selectedHistoryItem.citizen_name || 'Resident'}
                  </h4>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                    <span>📍 Barangay: <strong>{selectedHistoryItem.barangay_name || 'Lumban'}</strong></span>
                    {selectedHistoryItem.citizen_phone && <span>📞 {selectedHistoryItem.citizen_phone}</span>}
                  </div>
                </div>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30">
                  {selectedHistoryItem.status}
                </span>
              </div>

              {selectedHistoryItem.message && (
                <div className="text-xs text-slate-700 dark:text-slate-300 italic p-2.5 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 mt-2">
                  "{selectedHistoryItem.message}"
                </div>
              )}
            </div>

            {/* Dispatcher Info */}
            <div className="bg-red-500/5 dark:bg-red-950/20 border border-red-500/30 p-3 rounded-xl text-xs space-y-1">
              <div className="font-bold text-red-700 dark:text-red-300 uppercase tracking-wider flex items-center gap-1.5">
                <Shield size={14} /> Official MDRRMO Dispatching Authority
              </div>
              <div className="text-slate-700 dark:text-slate-300">
                Dispatched By: <strong>{selectedHistoryItem.dispatched_by_name || 'MDRRMO Dispatcher'}</strong> ({selectedHistoryItem.dispatched_by_role || 'MDRRMO'})
              </div>
              {selectedHistoryItem.dispatched_at && (
                <div className="text-slate-500">
                  Dispatch Timestamp: <strong>{formatDateTime(selectedHistoryItem.dispatched_at)}</strong>
                </div>
              )}
              {selectedHistoryItem.dispatch_notes && (
                <div className="text-slate-600 dark:text-slate-400 italic">
                  Dispatch Instructions: "{selectedHistoryItem.dispatch_notes}"
                </div>
              )}
            </div>

            {/* Dispatched Units list */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Dispatched Units Roster ({selectedHistoryItem.dispatched_responders?.length || 0})
              </label>

              <div className="space-y-2">
                {selectedHistoryItem.dispatched_responders?.length > 0 ? (
                  selectedHistoryItem.dispatched_responders.map(r => {
                    const roleCfg = ROLE_CONFIG[r.role] || ROLE_CONFIG.RESCUE;
                    return (
                      <div
                        key={r.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs border-l-4 ${roleCfg.cardBorder} bg-slate-50 dark:bg-slate-900`}>
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{roleCfg.icon}</span>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {r.full_name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {roleCfg.label} · {r.phone_number || 'No contact'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            r.dispatch_type === 'BACKUP'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                              : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                          }`}>
                            {r.dispatch_type} UNIT
                          </span>
                          {r.dispatched_at && (
                            <div className="text-[10px] text-slate-400 mt-1">
                              {formatDateTime(r.dispatched_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-slate-400 italic p-3 text-center bg-slate-50 dark:bg-slate-900 rounded-xl">
                    No responder units dispatched for this request.
                  </div>
                )}
              </div>
            </div>

            {/* Incident Timestamps Trail */}
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={14} /> Comprehensive Rescue Lifecycle Timeline
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                <div>🕒 Request Created: <strong>{formatDateTime(selectedHistoryItem.created_at)}</strong></div>
                {selectedHistoryItem.dispatched_at && (
                  <div>🚀 MDRRMO Dispatched: <strong>{formatDateTime(selectedHistoryItem.dispatched_at)}</strong></div>
                )}
                {selectedHistoryItem.responded_at && (
                  <div>🚑 Unit Responded: <strong>{formatDateTime(selectedHistoryItem.responded_at)}</strong></div>
                )}
                {selectedHistoryItem.resolved_at && (
                  <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                    ✅ Operation Resolved: {formatDateTime(selectedHistoryItem.resolved_at)}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold px-5 py-2.5 rounded-xl transition-colors">
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH BACKUP MODAL */}
      {dispatchBackupModalRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-amber-500/30">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  Backup Dispatch Mode
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  Dispatch Backup for {dispatchBackupModalRequest.requester_role} — {dispatchBackupModalRequest.requester_name}
                </h3>
              </div>
              <button
                onClick={() => setDispatchBackupModalRequest(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold">
                ✕
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div>Requested Unit Type: <strong className="uppercase">{dispatchBackupModalRequest.target_role}</strong></div>
              {dispatchBackupModalRequest.message && (
                <div className="italic text-slate-700 dark:text-slate-300">"{dispatchBackupModalRequest.message}"</div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Available {dispatchBackupModalRequest.target_role} Responders Only</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold lowercase border border-emerald-500/20">📍 sorted: nearest first</span>
              </label>

              <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-700 rounded-xl p-2">
                {safeResponders.filter(r => 
                  (!dispatchBackupModalRequest.target_role || 
                   r.role === dispatchBackupModalRequest.target_role || 
                   (dispatchBackupModalRequest.target_role === 'BFP' && (r.role === 'BFP' || r.role === 'COAST_GUARD')) ||
                   (dispatchBackupModalRequest.target_role === 'COAST_GUARD' && r.role === 'COAST_GUARD') ||
                   (dispatchBackupModalRequest.target_role === 'MDRRMO' && (r.role === 'MDRRMO' || r.role === 'MDRRMO_RESPONDER'))
                  ) &&
                  !['DISPATCHED', 'EN_ROUTE', 'RESCUE_IN_PROGRESS', 'OFF_DUTY', 'UNAVAILABLE'].includes(r.responder_status)
                ).length === 0 ? (
                  <div className="text-xs text-amber-600 dark:text-amber-400 text-center py-4 font-medium">
                    ⚠️ No AVAILABLE {dispatchBackupModalRequest.target_role} responders found online.
                  </div>
                ) : (
                  safeResponders
                    .filter(r => 
                      (!dispatchBackupModalRequest.target_role || 
                       r.role === dispatchBackupModalRequest.target_role || 
                       (dispatchBackupModalRequest.target_role === 'BFP' && (r.role === 'BFP' || r.role === 'COAST_GUARD')) ||
                       (dispatchBackupModalRequest.target_role === 'COAST_GUARD' && r.role === 'COAST_GUARD') ||
                       (dispatchBackupModalRequest.target_role === 'MDRRMO' && (r.role === 'MDRRMO' || r.role === 'MDRRMO_RESPONDER'))
                      ) &&
                      !['DISPATCHED', 'EN_ROUTE', 'RESCUE_IN_PROGRESS', 'OFF_DUTY', 'UNAVAILABLE'].includes(r.responder_status)
                    )
                    .sort((a, b) => {
                      const distA = getDistanceKm(a.last_lat, a.last_lng, dispatchBackupModalRequest.lat, dispatchBackupModalRequest.lng) ?? 999999;
                      const distB = getDistanceKm(b.last_lat, b.last_lng, dispatchBackupModalRequest.lat, dispatchBackupModalRequest.lng) ?? 999999;
                      return distA - distB;
                    })
                    .map(r => {
                      const distKm = getDistanceKm(r.last_lat, r.last_lng, dispatchBackupModalRequest.lat, dispatchBackupModalRequest.lng);
                      const isSelected = selectedBackupResponderId === r.id;
                      return (
                        <label
                          key={r.id}
                          onClick={() => setSelectedBackupResponderId(r.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white font-bold'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                          }`}>
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="backup_responder"
                              checked={isSelected}
                              onChange={() => setSelectedBackupResponderId(r.id)}
                              className="text-amber-600 focus:ring-amber-500 w-4 h-4"
                            />
                            <div>
                              <div className="text-xs font-bold">{r.full_name} ({r.role})</div>
                              <div className="text-[11px] text-slate-500">
                                📞 {r.phone_number || 'N/A'} {distKm ? `· 📍 ${distKm} km away` : ''}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-md font-bold">
                            AVAILABLE
                          </span>
                        </label>
                      );
                    })
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Dispatch Instructions (Optional)
              </label>
              <input
                type="text"
                value={dispatchBackupNotes}
                onChange={e => setDispatchBackupNotes(e.target.value)}
                placeholder="e.g. Bring medical kit, proceed to bridge..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDispatchBackupModalRequest(null)}
                className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold px-4 py-2 rounded-xl">
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedBackupResponderId || dispatchBackupMutation.isPending || dispatchMutation.isPending}
                onClick={() => {
                  if (dispatchBackupModalRequest.isDirectSosBackup) {
                    dispatchMutation.mutate({
                      sosId: dispatchBackupModalRequest.sos_id,
                      responderIds: [selectedBackupResponderId],
                      notes: dispatchBackupNotes,
                      dispatchType: 'BACKUP',
                    });
                    setDispatchBackupModalRequest(null);
                  } else {
                    dispatchBackupMutation.mutate({
                      id: dispatchBackupModalRequest.id,
                      responderId: selectedBackupResponderId,
                      notes: dispatchBackupNotes
                    });
                  }
                }}
                className="text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl transition-all shadow-md">
                {dispatchBackupMutation.isPending || dispatchMutation.isPending ? 'Dispatching...' : 'Confirm Backup Dispatch 🚨'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}