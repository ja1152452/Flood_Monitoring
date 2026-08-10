export const MAX_LEVEL = 10.0;

export const FLOOD_CONFIG = {
  NORMAL: { label: 'Normal Level', color: '#6B7280', bg: '#1f2937', emoji: '🟢' },
  MONITOR: { label: 'Monitor Level', color: '#F59E0B', bg: '#451a03', emoji: '🟡' },
  ALERT: { label: 'Alert Level', color: '#F97316', bg: '#431407', emoji: '🟠' },
  EVACUATION: { label: 'Evacuation Level', color: '#EF4444', bg: '#450a0a', emoji: '🔴' },
  CRITICAL: { label: 'Critical Level', color: '#7C3AED', bg: '#2e1065', emoji: '🟣' },
};

export const getFloodConfig = (level) => FLOOD_CONFIG[level] || FLOOD_CONFIG.NORMAL;
export const shouldSiren = (level) => ['MONITOR', 'ALERT', 'EVACUATION', 'CRITICAL'].includes(level);
export const formatWaterLevel = (m) => m != null ? `${parseFloat(m).toFixed(2)}m` : '--';

export const formatTime = (ts) => {
  if (!ts) return '--';
  return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const formatDateTime = (ts) => {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
