import { getFloodConfig } from '../../utils/floodUtils';

export function FloodBadge({ level, size = 'md' }) {
  const config = getFloodConfig(level);
  const sizes  = { sm: 'text-xs px-2.5 py-0.5', md: 'text-sm px-3 py-1', lg: 'text-base px-4 py-2' };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold shadow-sm ${config.bg} ${config.text} ${sizes[size]}`}>
      <span className="w-2 h-2 rounded-full bg-current opacity-90 inline-block" />
      {config.label}
    </span>
  );
}

export function RiskBadge({ level }) {
  const colors = {
    VERY_HIGH: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/60 dark:text-red-200 dark:border-red-800',
    HIGH:      'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/60 dark:text-orange-200 dark:border-orange-800',
    MODERATE:  'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-800',
    LOW:       'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-800',
  };
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${colors[level] || 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-slate-200'}`}>
      {level?.replace('_', ' ')}
    </span>
  );
}