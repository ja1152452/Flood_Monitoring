import { getFloodConfig } from '../../utils/floodUtils';

export function FloodBadge({ level, size = 'md' }) {
  const config = getFloodConfig(level);
  const sizes  = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1', lg: 'text-base px-4 py-2' };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${config.bg} ${config.text} ${sizes[size]}`}>
      <span className="w-2 h-2 rounded-full bg-current opacity-80 inline-block" />
      {config.label}
    </span>
  );
}

export function RiskBadge({ level }) {
  const colors = {
    VERY_HIGH: 'bg-red-900 text-red-200',
    HIGH:      'bg-orange-900 text-orange-200',
    MODERATE:  'bg-amber-900 text-amber-200',
    LOW:       'bg-green-900 text-green-200',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[level] || 'bg-gray-700 text-gray-300'}`}>
      {level?.replace('_', ' ')}
    </span>
  );
}