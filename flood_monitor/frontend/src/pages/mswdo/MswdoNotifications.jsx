import { useQuery } from '@tanstack/react-query';
import { getAnnouncements } from '../../api/announcements';
import { formatDateTime } from '../../utils/floodUtils';
import { Bell, AlertTriangle, Megaphone, CheckCircle, Info } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

const TYPE_META = {
  FLOOD_WARNING:    { icon: AlertTriangle,
    darkColor: '#fca5a5', darkBg: '#7f1d1d',
    lightColor: '#991b1b', lightBg: '#fee2e2',
    label: 'Flood Warning' },
  EVACUATION_ORDER: { icon: AlertTriangle,
    darkColor: '#fcd34d', darkBg: '#78350f',
    lightColor: '#92400e', lightBg: '#fef3c7',
    label: 'Evacuation Order' },
  ALL_CLEAR:        { icon: CheckCircle,
    darkColor: '#86efac', darkBg: '#14532d',
    lightColor: '#166534', lightBg: '#dcfce7',
    label: 'All Clear' },
  GENERAL:          { icon: Info,
    darkColor: '#93c5fd', darkBg: '#1e3a5f',
    lightColor: '#1e40af', lightBg: '#dbeafe',
    label: 'General' },
};

export default function MswdoNotifications() {
  const { isDark } = useThemeStore();
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn:  getAnnouncements,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5 font-medium">
          Announcements and alerts from MDRRMO
        </p>
      </div>

      {announcements.some(a => a.type === 'EVACUATION_ORDER') && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 shadow-sm siren-pulse">
          <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <div className="text-sm font-bold text-amber-900 dark:text-amber-300">Active Evacuation Order</div>
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-0.5">
              MDRRMO has issued an evacuation order. Please follow instructions immediately.
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm font-semibold">Loading notifications...</div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 font-semibold">
            <Bell size={36} className="mb-3 opacity-20" />
            <p className="text-sm">No announcements from MDRRMO</p>
          </div>
        ) : announcements.map(a => {
          const meta = TYPE_META[a.type] || TYPE_META.GENERAL;
          const Icon = meta.icon;
          const color = isDark ? meta.darkColor : meta.lightColor;
          const bg    = isDark ? meta.darkBg    : meta.lightBg;
          return (
            <div key={a.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: bg }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{a.title}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full border"
                    style={{ backgroundColor: bg, color, borderColor: color }}>
                    {meta.label}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-2">{a.message}</p>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <Megaphone size={12} />
                  <span>By {a.created_by_name || 'MDRRMO'}</span>
                  <span>·</span>
                  <span>{formatDateTime(a.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}