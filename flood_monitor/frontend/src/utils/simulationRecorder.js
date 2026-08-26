/**
 * Simulation Session Recorder & Storage Manager
 * Records timestamped drill points, manages saved drill sessions,
 * and provides preloaded drill runs for Analytics and Reports.
 */

const STORAGE_KEY = 'flood_simulation_drill_sessions_v1';

// Sample pre-loaded drill sessions for immediate testing in Analytics & Reports
const DEFAULT_DRILL_SESSIONS = [
  {
    id: 'drill-flash-flood-2026',
    name: 'Flash Flood Readiness Drill (2.0m ➔ 5.5m)',
    scenarioType: 'severe_flood',
    startedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    finishedAt: new Date(Date.now() - 3600000 * 2 + 60000).toISOString(),
    durationSec: 60,
    startLevelM: 2.00,
    targetLevelM: 5.50,
    peakLevelM: 5.50,
    peakCategory: 'EVACUATION',
    pointsCount: 31,
    timeToMonitorSec: 12,
    timeToAlertSec: 25,
    timeToEvacuationSec: 48,
    timeToCriticalSec: null,
    points: Array.from({ length: 31 }).map((_, i) => {
      const sec = i * 2;
      const progress = sec / 60;
      const level = 2.00 + (5.50 - 2.00) * progress;
      const category = level >= 6.1 ? 'CRITICAL' : level >= 5.1 ? 'EVACUATION' : level >= 4.1 ? 'ALERT' : level >= 3.1 ? 'MONITOR' : 'NORMAL';
      const timeStr = new Date(Date.now() - 3600000 * 2 + sec * 1000).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return {
        elapsedSec: sec,
        timestamp: timeStr,
        waterLevelM: parseFloat(level.toFixed(2)),
        waterLevelCm: Math.round(level * 100),
        floodLevel: category,
        ratePerHour: 210.0,
        phase: 'rising',
      };
    }),
  },
  {
    id: 'drill-full-cycle-2026',
    name: 'Full Flood Inundation & Receding Cycle',
    scenarioType: 'full_cycle',
    startedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    finishedAt: new Date(Date.now() - 3600000 * 5 + 60000).toISOString(),
    durationSec: 60,
    startLevelM: 2.00,
    targetLevelM: 6.20,
    peakLevelM: 6.20,
    peakCategory: 'CRITICAL',
    pointsCount: 31,
    timeToMonitorSec: 8,
    timeToAlertSec: 16,
    timeToEvacuationSec: 24,
    timeToCriticalSec: 28,
    points: Array.from({ length: 31 }).map((_, i) => {
      const sec = i * 2;
      const progress = sec / 60;
      let level = 2.00;
      let phase = 'rising';
      if (progress < 0.45) {
        level = 2.00 + (6.20 - 2.00) * (progress / 0.45);
        phase = 'rising';
      } else if (progress < 0.55) {
        level = 6.20;
        phase = 'peak';
      } else {
        level = 6.20 - (6.20 - 2.00) * ((progress - 0.55) / 0.45);
        phase = 'receding';
      }
      const category = level >= 6.1 ? 'CRITICAL' : level >= 5.1 ? 'EVACUATION' : level >= 4.1 ? 'ALERT' : level >= 3.1 ? 'MONITOR' : 'NORMAL';
      const timeStr = new Date(Date.now() - 3600000 * 5 + sec * 1000).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return {
        elapsedSec: sec,
        timestamp: timeStr,
        waterLevelM: parseFloat(level.toFixed(2)),
        waterLevelCm: Math.round(level * 100),
        floodLevel: category,
        ratePerHour: phase === 'rising' ? 250.0 : phase === 'receding' ? -250.0 : 0.0,
        phase: phase,
      };
    }),
  },
];

export const getStoredDrillSessions = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DRILL_SESSIONS));
      return DEFAULT_DRILL_SESSIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_DRILL_SESSIONS;
  } catch {
    return DEFAULT_DRILL_SESSIONS;
  }
};

export const saveDrillSession = (session) => {
  try {
    const current = getStoredDrillSessions();
    const updated = [session, ...current.filter((s) => s.id !== session.id)].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save drill session:', err);
    return [];
  }
};

export const deleteDrillSession = (id) => {
  try {
    const current = getStoredDrillSessions();
    const filtered = current.filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch {
    return [];
  }
};

// Active live recorder instance for current simulation run
let activeRecording = null;

export const startDrillRecording = (name = 'Simulation Drill Run', config = {}) => {
  activeRecording = {
    id: `drill-${Date.now()}`,
    name: name,
    scenarioType: config.scenarioType || 'manual',
    startedAt: new Date().toISOString(),
    startLevelM: config.startLevelM || 2.00,
    targetLevelM: config.targetLevelM || 5.50,
    peakLevelM: config.startLevelM || 2.00,
    peakCategory: 'NORMAL',
    timeToMonitorSec: null,
    timeToAlertSec: null,
    timeToEvacuationSec: null,
    timeToCriticalSec: null,
    points: [],
  };
  return activeRecording;
};

export const recordDrillPoint = (point) => {
  if (!activeRecording) return;

  const m = parseFloat(point.waterLevelM || point.water_level_m || 2.0);
  const cat = point.floodLevel || point.flood_level || 'NORMAL';
  const elapsed = point.elapsedSec ?? activeRecording.points.length;

  if (m > activeRecording.peakLevelM) {
    activeRecording.peakLevelM = m;
    activeRecording.peakCategory = cat;
  }

  if (m >= 3.1 && activeRecording.timeToMonitorSec === null) activeRecording.timeToMonitorSec = elapsed;
  if (m >= 4.1 && activeRecording.timeToAlertSec === null) activeRecording.timeToAlertSec = elapsed;
  if (m >= 5.1 && activeRecording.timeToEvacuationSec === null) activeRecording.timeToEvacuationSec = elapsed;
  if (m >= 6.1 && activeRecording.timeToCriticalSec === null) activeRecording.timeToCriticalSec = elapsed;

  activeRecording.points.push({
    elapsedSec: elapsed,
    timestamp: point.timestamp || new Date().toLocaleTimeString('en-PH'),
    waterLevelM: m,
    waterLevelCm: Math.round(m * 100),
    floodLevel: cat,
    ratePerHour: point.ratePerHour || 0,
    phase: point.phase || 'rising',
  });
};

export const finishDrillRecording = () => {
  if (!activeRecording || activeRecording.points.length === 0) {
    activeRecording = null;
    return null;
  }

  const finishedSession = {
    ...activeRecording,
    finishedAt: new Date().toISOString(),
    durationSec: activeRecording.points.length > 0 ? activeRecording.points[activeRecording.points.length - 1].elapsedSec : 0,
    pointsCount: activeRecording.points.length,
  };

  saveDrillSession(finishedSession);
  activeRecording = null;
  return finishedSession;
};
