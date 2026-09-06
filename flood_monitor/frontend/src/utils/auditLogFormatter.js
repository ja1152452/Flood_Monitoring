/**
 * Audit Log Formatting & Presentation Utility
 * Converts technical database records and raw payloads into clean, human-readable
 * operational language suitable for non-technical administrators.
 */

// Logical business modules with grouped action definitions and friendly labels
export const BUSINESS_MODULES = [
  {
    group: 'User & Access Management',
    icon: '👥',
    actions: [
      { value: 'USER_CREATED',       label: 'New Account Created',           defaultSeverity: 'NORMAL' },
      { value: 'USER_UPDATED',       label: 'User Account Details Modified', defaultSeverity: 'NORMAL' },
      { value: 'USER_DEACTIVATED',   label: 'User Account Suspended/Deactivated', defaultSeverity: 'WARNING' },
      { value: 'USER_DELETED',       label: 'User Account Permanently Deleted', defaultSeverity: 'WARNING' },
      { value: 'USER_LOGIN',         label: 'User Session Login',            defaultSeverity: 'NORMAL' },
      { value: 'USER_PASSWORD_RESET',label: 'Password Reset Issued',         defaultSeverity: 'NORMAL' },
    ],
  },
  {
    group: 'Operational Alerts & Flood Risk',
    icon: '⚠️',
    actions: [
      { value: 'ALERT_TRIGGERED',    label: 'Flood Alert Broadcasted',       defaultSeverity: 'CRITICAL' },
      { value: 'ALERT_ESCALATED',    label: 'Flood Warning Level Escalated', defaultSeverity: 'CRITICAL' },
      { value: 'ALERT_RESOLVED',     label: 'Flood Warning Resolved / Stand Down', defaultSeverity: 'RESOLVED' },
      { value: 'RISK_AREA_DEFINED',  label: 'High Risk Flood Zone Configured', defaultSeverity: 'ADVISORY' },
      { value: 'WATER_READING_ANOMALY', label: 'Sensor Reading Discrepancy Flagged', defaultSeverity: 'WARNING' },
    ],
  },
  {
    group: 'Emergency & Rescue Operations',
    icon: '🚨',
    actions: [
      { value: 'SOS_TRIGGERED',      label: 'Emergency SOS Signal Received', defaultSeverity: 'CRITICAL' },
      { value: 'SOS_ACKNOWLEDGED',   label: 'Emergency SOS Acknowledged',    defaultSeverity: 'ADVISORY' },
      { value: 'RESCUE_DISPATCHED',  label: 'Rescue Team Dispatched',        defaultSeverity: 'CRITICAL' },
      { value: 'BACKUP_REQUESTED',   label: 'Field Backup Unit Requested',   defaultSeverity: 'WARNING' },
      { value: 'RESCUE_COMPLETED',   label: 'Rescue Operation Completed',    defaultSeverity: 'RESOLVED' },
      { value: 'SOS_RESOLVED',       label: 'Emergency SOS Marked Resolved', defaultSeverity: 'RESOLVED' },
    ],
  },
  {
    group: 'Drills & Water Simulations',
    icon: '🧪',
    actions: [
      { value: 'DRILL_SCENARIO_STARTED', label: 'Evacuation Drill Scenario Started', defaultSeverity: 'ADVISORY' },
      { value: 'SIMULATION_STARTED',      label: 'Water Surge Simulation Initiated',  defaultSeverity: 'ADVISORY' },
      { value: 'SIMULATION_STOPPED',      label: 'Water Surge Simulation Concluded',  defaultSeverity: 'NORMAL' },
      { value: 'SIMULATION_RESET',        label: 'Simulation Levels Reset to Normal', defaultSeverity: 'NORMAL' },
    ],
  },
  {
    group: 'Evacuation Center Operations',
    icon: '🏠',
    actions: [
      { value: 'EVACUEE_REGISTERED', label: 'Evacuee Family Registered',     defaultSeverity: 'NORMAL' },
      { value: 'EVACUEE_DEPARTED',   label: 'Evacuees Returned Home / Decamped', defaultSeverity: 'RESOLVED' },
      { value: 'RELIEF_DISTRIBUTED', label: 'Relief Goods Distributed',      defaultSeverity: 'NORMAL' },
      { value: 'CENTER_CAPACITY_UPDATE', label: 'Evacuation Center Capacity Updated', defaultSeverity: 'ADVISORY' },
    ],
  },
  {
    group: 'System & Hardware Maintenance',
    icon: '🛠️',
    actions: [
      { value: 'MAINTENANCE_CHECK',  label: 'Sensor / Camera Maintenance Check', defaultSeverity: 'MAINTENANCE' },
      { value: 'INSPECTION_LOG',     label: 'Equipment Inspection Conducted', defaultSeverity: 'MAINTENANCE' },
      { value: 'SYSTEM_SETTINGS',    label: 'System Configuration Updated',  defaultSeverity: 'NORMAL' },
      { value: 'SYSTEM_BACKUP',      label: 'Database / System Backup Completed', defaultSeverity: 'NORMAL' },
    ],
  },
  {
    group: 'General Administrative Operations',
    icon: '📝',
    actions: [
      { value: 'OFFICIAL_MEMO',      label: 'Administrative Directive / Memo', defaultSeverity: 'NORMAL' },
      { value: 'INCIDENT_RECORD',    label: 'Operational Incident Recorded', defaultSeverity: 'ADVISORY' },
      { value: 'MANUAL_OVERRIDE',    label: 'Manual Operational Override',   defaultSeverity: 'WARNING' },
      { value: 'GENERAL_NOTE',       label: 'General Official Remark',       defaultSeverity: 'NORMAL' },
    ],
  },
];

// Target Entity options with prefixes for auto-generating IDs
export const ENTITY_TYPES = [
  { value: 'User Account',          prefix: 'USR', icon: '👤' },
  { value: 'Monitoring Camera',     prefix: 'CAM', icon: '📹' },
  { value: 'Water Level Sensor',    prefix: 'SNR', icon: '🌊' },
  { value: 'Flood Alert Warning',   prefix: 'ALT', icon: '⚠️' },
  { value: 'Emergency SOS Request', prefix: 'SOS', icon: '🚨' },
  { value: 'Evacuation Center',     prefix: 'EVC', icon: '🏠' },
  { value: 'Evacuee Family',        prefix: 'FAM', icon: '👨‍👩‍👧' },
  { value: 'Drill & Simulation',    prefix: 'DRL', icon: '⏱️' },
  { value: 'Rescue Operation',      prefix: 'RES', icon: '🚑' },
  { value: 'Flood Risk Zone',       prefix: 'RSK', icon: '🗺️' },
  { value: 'Public Announcement',   prefix: 'ANN', icon: '📢' },
  { value: 'System Configuration',  prefix: 'SYS', icon: '⚙️' },
  { value: 'General Activity',      prefix: 'LOG', icon: '📋' },
];

export const SEVERITY_CONFIG = {
  NORMAL:      { label: 'Normal',      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
  ADVISORY:    { label: 'Advisory',    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' },
  WARNING:     { label: 'Warning',     badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
  CRITICAL:    { label: 'Critical',    badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' },
  RESOLVED:    { label: 'Resolved',    badge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800' },
  MAINTENANCE: { label: 'Maintenance', badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' },
};

/**
 * Generate a friendly unique reference code: [PREFIX]-[YYYYMMDD]-[RANDOM_4_HEX]
 * e.g., USR-20260906-8F2A, LOG-20260906-1B90
 */
export function generateReferenceCode(entityType = '') {
  const norm = (entityType || '').toLowerCase();
  let prefix = 'LOG';
  const found = ENTITY_TYPES.find(e => e.value.toLowerCase() === norm || norm.includes(e.prefix.toLowerCase()));
  if (found) {
    prefix = found.prefix;
  } else if (norm.includes('user') || norm.includes('account')) {
    prefix = 'USR';
  } else if (norm.includes('camera')) {
    prefix = 'CAM';
  } else if (norm.includes('sensor') || norm.includes('reading')) {
    prefix = 'SNR';
  } else if (norm.includes('alert') || norm.includes('warning')) {
    prefix = 'ALT';
  } else if (norm.includes('sos') || norm.includes('emergency')) {
    prefix = 'SOS';
  } else if (norm.includes('evac')) {
    prefix = 'EVC';
  } else if (norm.includes('drill') || norm.includes('sim')) {
    prefix = 'DRL';
  } else if (norm.includes('rescue')) {
    prefix = 'RES';
  } else if (norm.includes('system')) {
    prefix = 'SYS';
  }

  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const hash = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${dateStr}-${hash}`;
}

/**
 * Map raw database action keys to clean, human-readable event descriptions
 */
export function formatActionLabel(rawAction = '') {
  if (!rawAction) return 'General Event';
  for (const module of BUSINESS_MODULES) {
    const match = module.actions.find(a => a.value === rawAction);
    if (match) return match.label;
  }
  // Convert SNAKE_CASE to Title Case as fallback
  return rawAction
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format entity name into human-friendly string
 */
export function formatEntityName(rawEntity = '') {
  if (!rawEntity) return 'General Subject';
  const found = ENTITY_TYPES.find(e => e.value.toLowerCase() === rawEntity.toLowerCase());
  if (found) return found.value;

  const norm = rawEntity.toLowerCase();
  if (norm.includes('simulation') || norm.includes('drill')) return 'Drill & Simulation';
  if (norm.includes('reading') || norm.includes('sensor')) return 'Water Level Sensor';
  if (norm.includes('alert')) return 'Flood Alert Warning';
  if (norm.includes('sos')) return 'Emergency SOS';
  if (norm.includes('user')) return 'User Account';
  if (norm.includes('camera')) return 'Monitoring Camera';
  if (norm.includes('evac')) return 'Evacuation Center';
  if (norm.includes('family')) return 'Evacuee Family';
  if (norm.includes('risk')) return 'Flood Risk Zone';
  if (norm.includes('announcement')) return 'Public Announcement';
  if (norm.includes('system')) return 'System Configuration';

  return rawEntity
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Standard 12-hour friendly date & time: "Sep 06, 2026 • 01:55 PM"
 */
export function formatFriendlyDateTime(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';

  return d.toLocaleString('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).replace(',', ' •');
}

/**
 * Relative time description (e.g. "Just now", "25 mins ago", "Yesterday")
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatFriendlyDateTime(dateString);
}

/**
 * Intelligently parse and format raw database states into human-readable sentences
 * without exposing raw JSON syntax to the user.
 */
export function parseLogPayload(log) {
  const result = {
    summary: log.description || '',
    notes: '',
    severity: (log.severity || 'NORMAL').toUpperCase(),
    isManual: Boolean(log.is_manual),
    chips: [],
  };

  let state = log.after_state || log.before_state;
  if (state && typeof state === 'string') {
    try {
      state = JSON.parse(state);
    } catch {
      state = { text: state };
    }
  }

  if (state && typeof state === 'object') {
    // If it was saved via the structured manual form
    if (state.summary && !result.summary) {
      result.summary = state.summary;
    }
    if (state.notes) {
      result.notes = state.notes;
    }
    if (state.severity) {
      result.severity = state.severity.toUpperCase();
    }
    if (state.is_manual !== undefined) {
      result.isManual = Boolean(state.is_manual);
    }

    // Dynamic translation of common automated keys into human sentences & chips
    if (state.scenario_name) {
      if (!result.summary) result.summary = `Drill Scenario: ${state.scenario_name}`;
      result.chips.push({ label: 'Scenario', val: state.scenario_name });
    }
    if (state.water_level_m !== undefined) {
      result.chips.push({ label: 'Water Level', val: `${Number(state.water_level_m).toFixed(2)}m` });
    }
    if (state.flood_level) {
      result.chips.push({ label: 'Flood Status', val: state.flood_level });
    }
    if (state.target_level_m !== undefined) {
      result.chips.push({ label: 'Target Surge', val: `${Number(state.target_level_m).toFixed(2)}m` });
    }
    if (state.duration_sec !== undefined) {
      result.chips.push({ label: 'Duration', val: `${Math.round(state.duration_sec / 60)} mins` });
    }
    if (state.barangay_name || state.location) {
      result.chips.push({ label: 'Location', val: state.barangay_name || state.location });
    }
    if (state.responder_name) {
      result.chips.push({ label: 'Responder', val: state.responder_name });
    }

    // Capture other simple attributes cleanly
    for (const [k, v] of Object.entries(state)) {
      if (['summary', 'notes', 'severity', 'is_manual', 'reference_id', 'scenario_name', 'water_level_m', 'flood_level', 'target_level_m', 'duration_sec', 'barangay_name', 'location', 'responder_name'].includes(k)) {
        continue;
      }
      if (v === null || v === undefined) continue;
      const friendlyKey = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      result.chips.push({
        label: friendlyKey,
        val: typeof v === 'object' ? JSON.stringify(v) : String(v),
      });
    }
  }

  // Fallback summary if nothing was found
  if (!result.summary) {
    result.summary = formatActionLabel(log.action);
  }

  return result;
}
