import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getActiveAlerts, getAlertHistory, resolveAlert, toggleSiren, triggerManualAlarm } from '../api/alerts';
import { FloodBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatDateTime } from '../utils/floodUtils';
import toast from 'react-hot-toast';
import { CheckCircle, Volume2, VolumeX, AlertTriangle } from 'lucide-react';

export default function Alerts() {
  const qc = useQueryClient();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const { data: active = [] } = useQuery({
    queryKey: ['active-alerts'],
    queryFn: getActiveAlerts,
    refetchInterval: 15000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['alert-history'],
    queryFn: () => getAlertHistory({ limit: 20 }),
  });

  const resolve = useMutation({
    mutationFn: ({ id }) => resolveAlert(id, 'Manually resolved'),
    onSuccess: () => {
      toast.success('Alert resolved');
      qc.invalidateQueries(['active-alerts']);
      qc.invalidateQueries(['alert-history']);
    },
    onError: () => toast.error('Failed to resolve alert'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, siren_active }) => toggleSiren(id, siren_active),
    onSuccess: (_, variables) => {
      toast.success(variables.siren_active ? 'Siren activated' : 'Siren deactivated');
      qc.invalidateQueries(['active-alerts']);
    },
    onError: () => toast.error('Failed to toggle siren'),
  });

  const manualAlarm = useMutation({
    mutationFn: triggerManualAlarm,
    onSuccess: () => {
      toast.success('Manual emergency alarm triggered successfully');
      qc.invalidateQueries(['active-alerts']);
      qc.invalidateQueries(['alert-history']);
      setIsConfirmOpen(false);
    },
    onError: () => toast.error('Failed to trigger manual alarm'),
  });

  const handleManualAlarm = () => {
    setIsConfirmOpen(true);
  };

  const confirmAlarm = () => {
    manualAlarm.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Alerts</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">{active.length} active · {(history.data || history || []).length} in history</p>
        </div>
        <button
          onClick={handleManualAlarm}
          disabled={manualAlarm.isPending}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-md">
          <AlertTriangle size={18} />
          {manualAlarm.isPending ? 'Triggering...' : 'Trigger Manual Alarm'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Active Alerts</h3>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            active.length > 0
              ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
              : 'bg-emerald-100 text-emerald-700 dark:bg-green-500/20 dark:text-green-400'
          }`}>
            {active.length} active
          </span>
        </div>
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="text-4xl">✅</span>
            <p className="text-slate-700 dark:text-slate-300 text-sm font-semibold">No active alerts</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs">River conditions are currently normal</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map(alert => (
              <div key={alert.id}
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 blink" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{alert.location_name}</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {alert.barangay_name} • Triggered: {formatDateTime(alert.triggered_at)}
                  </div>
                  {alert.siren_active && (
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1 font-bold">🔊 Siren Active</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <FloodBadge level={alert.flood_level} size="sm" />
                  <button
                    onClick={() => toggle.mutate({ id: alert.id, siren_active: !alert.siren_active })}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                      alert.siren_active
                        ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30 dark:border-red-500/50'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:border-slate-600'
                    }`}>
                    {alert.siren_active ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    {alert.siren_active ? 'Turn Off Siren' : 'Turn On Siren'}
                  </button>
                  <button
                    onClick={() => resolve.mutate({ id: alert.id })}
                    className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors font-bold shadow-sm">
                    <CheckCircle size={14} />
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Alert History</h3>
        <div className="divide-y divide-slate-200 dark:divide-slate-700/50">
          {(history.data || history || []).slice(0, 20).map(alert => (
            <div key={alert.id}
              className="flex items-center justify-between py-3.5">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{alert.location_name}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{formatDateTime(alert.triggered_at)}</div>
              </div>
              <div className="flex items-center gap-2">
                <FloodBadge level={alert.flood_level} size="sm" />
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${alert.is_active
                    ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-green-500/15 dark:text-green-400'
                  }`}>
                  {alert.is_active ? 'Active' : 'Resolved'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} title="Confirm Manual Alarm">
        <div className="flex flex-col items-center text-center p-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-500 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Are you absolutely sure?</h4>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
            This will instantly send a <strong className="text-red-600 dark:text-red-400">CRITICAL</strong> emergency push notification to ALL active users and activate the system-wide alarm. This action cannot be undone.
          </p>
          <div className="flex w-full gap-3">
            <button
              onClick={() => setIsConfirmOpen(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white font-semibold transition-colors">
              Cancel
            </button>
            <button
              onClick={confirmAlarm}
              disabled={manualAlarm.isPending}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors flex items-center justify-center shadow-md">
              {manualAlarm.isPending ? 'Triggering...' : 'Yes, Trigger Alarm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}