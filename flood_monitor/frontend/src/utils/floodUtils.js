export const FLOOD_CONFIG = {
  NORMAL: { label: 'Normal Level', color: '#16a34a', bg: 'bg-emerald-600', text: 'text-emerald-100', border: 'border-emerald-400' },
  MONITOR: { label: 'Monitor Level', color: '#d97706', bg: 'bg-amber-600', text: 'text-amber-100', border: 'border-amber-400' },
  ALERT: { label: 'Alert Level', color: '#ea580c', bg: 'bg-orange-600', text: 'text-orange-100', border: 'border-orange-400' },
  EVACUATION: { label: 'Evacuation Level', color: '#dc2626', bg: 'bg-red-600', text: 'text-red-100', border: 'border-red-500' },
  CRITICAL: { label: 'Critical Level', color: '#7e22ce', bg: 'bg-purple-700', text: 'text-purple-100', border: 'border-purple-500' },
};

export const RISK_CONFIG = {
  VERY_HIGH: { label: 'Very High Risk', color: '#EF4444', bg: 'bg-red-600' },
  HIGH: { label: 'High Risk', color: '#F97316', bg: 'bg-orange-500' },
  MODERATE: { label: 'Moderate Risk', color: '#F59E0B', bg: 'bg-amber-500' },
  LOW: { label: 'Low Risk', color: '#22C55E', bg: 'bg-green-600' },
};

export const getFloodConfig = (level) =>
  FLOOD_CONFIG[level] || FLOOD_CONFIG.NORMAL;

export const shouldSiren = (level) =>
  ['MONITOR', 'ALERT', 'EVACUATION', 'CRITICAL'].includes(level);

export const formatWaterLevel = (m) =>
  m != null ? `${parseFloat(m).toFixed(2)}m` : '--';

export const formatTime = (ts) => {
  if (!ts) return '--';
  return new Date(ts).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

export const formatDateTime = (ts) => {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('en-PH', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};