/**
 * Simulation Session Recorder & Storage Manager
 * Records timestamped drill points, manages saved drill sessions,
 * and provides preloaded drill runs for Analytics and Reports.
 */

import { calculateDynamicRate } from './waterSimulationUtils.js';

const STORAGE_KEY = 'flood_simulation_drill_sessions_v1';

// Standard pre-loaded drill sessions (including Morning 9:00 AM & Night sessions)
const DEFAULT_DRILL_SESSIONS = [
  {
    id: 'drill-morning-9am-aug27-2026',
    name: 'Morning Flash Flood Drill (2.0m ➔ 6.25m)',
    scenarioType: 'severe_flood',
    startedAt: '2026-08-27T09:00:00+08:00',
    finishedAt: '2026-08-27T09:30:00+08:00',
    durationSec: 60,
    startLevelM: 2.00,
    targetLevelM: 6.25,
    peakLevelM: 6.25,
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
        level = 2.00 + (6.25 - 2.00) * (progress / 0.45);
        phase = 'rising';
      } else if (progress < 0.55) {
        level = 6.25;
        phase = 'peak';
      } else {
        level = 6.25 - (6.25 - 2.00) * ((progress - 0.55) / 0.45);
        phase = 'receding';
      }
      const category = level >= 6.0 ? 'CRITICAL' : level >= 5.0 ? 'EVACUATION' : level >= 4.0 ? 'ALERT' : level >= 3.1 ? 'MONITOR' : 'NORMAL';
      const pointDate = new Date(new Date('2026-08-27T09:00:00+08:00').getTime() + i * 60 * 1000);
      const timeStr = pointDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = 'Aug 27, 2026';
      return {
        elapsedSec: sec,
        date: dateStr,
        timestamp: timeStr,
        isoDateTime: pointDate.toISOString(),
        waterLevelM: parseFloat(level.toFixed(3)),
        waterLevelCm: Math.round(level * 100),
        floodLevel: category,
        ratePerHour: calculateDynamicRate(level, phase),
        phase: phase,
      };
    }),
  },
  {
    id: 'drill-night-930pm-aug26-2026',
    name: 'Night Evacuation Drill (2.0m ➔ 5.85m)',
    scenarioType: 'severe_flood',
    startedAt: '2026-08-26T21:30:00+08:00',
    finishedAt: '2026-08-26T22:00:00+08:00',
    durationSec: 60,
    startLevelM: 2.00,
    targetLevelM: 5.85,
    peakLevelM: 5.85,
    peakCategory: 'EVACUATION',
    pointsCount: 31,
    timeToMonitorSec: 12,
    timeToAlertSec: 24,
    timeToEvacuationSec: 42,
    timeToCriticalSec: null,
    points: Array.from({ length: 31 }).map((_, i) => {
      const sec = i * 2;
      const progress = sec / 60;
      let level = 2.00;
      let phase = 'rising';
      if (progress < 0.45) {
        level = 2.00 + (5.85 - 2.00) * (progress / 0.45);
        phase = 'rising';
      } else if (progress < 0.55) {
        level = 5.85;
        phase = 'peak';
      } else {
        level = 5.85 - (5.85 - 2.00) * ((progress - 0.55) / 0.45);
        phase = 'receding';
      }
      const category = level >= 6.0 ? 'CRITICAL' : level >= 5.0 ? 'EVACUATION' : level >= 4.0 ? 'ALERT' : level >= 3.1 ? 'MONITOR' : 'NORMAL';
      const pointDate = new Date(new Date('2026-08-26T21:30:00+08:00').getTime() + i * 60 * 1000);
      const timeStr = pointDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = 'Aug 26, 2026';
      return {
        elapsedSec: sec,
        date: dateStr,
        timestamp: timeStr,
        isoDateTime: pointDate.toISOString(),
        waterLevelM: parseFloat(level.toFixed(3)),
        waterLevelCm: Math.round(level * 100),
        floodLevel: category,
        ratePerHour: calculateDynamicRate(level, phase),
        phase: phase,
      };
    }),
  },
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
      const category = level >= 6.0 ? 'CRITICAL' : level >= 5.0 ? 'EVACUATION' : level >= 4.0 ? 'ALERT' : level >= 3.1 ? 'MONITOR' : 'NORMAL';
      const pointDate = new Date(Date.now() - 3600000 * 2 + sec * 1000);
      const timeStr = pointDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = pointDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
      return {
        elapsedSec: sec,
        date: dateStr,
        timestamp: timeStr,
        isoDateTime: pointDate.toISOString(),
        waterLevelM: parseFloat(level.toFixed(2)),
        waterLevelCm: Math.round(level * 100),
        floodLevel: category,
        ratePerHour: calculateDynamicRate(level, 'rising'),
        phase: 'rising',
      };
    }),
  },
];

export const getStoredDrillSessions = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let parsed = [];
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {}
    }
    if (!Array.isArray(parsed)) parsed = [];

    // Ensure standard drill sessions (especially 9:00 AM Morning Drill) are always present
    const merged = [...parsed];
    for (const def of DEFAULT_DRILL_SESSIONS) {
      if (!merged.some((s) => s.id === def.id || s.name === def.name)) {
        merged.push(def);
      }
    }

    // Sanitize any previously cached hardcoded rates (210, 220, 260) with dynamic calculations
    const sanitized = merged.map((sess) => ({
      ...sess,
      points: (sess.points || []).map((p) => {
        if (p.ratePerHour === 210 || p.ratePerHour === 220 || p.ratePerHour === 260 || p.ratePerHour == null) {
          return {
            ...p,
            ratePerHour: calculateDynamicRate(p.waterLevelM, p.phase || 'rising'),
          };
        }
        return p;
      }),
    }));

    // Sort by startedAt descending
    sanitized.sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch {}

    return sanitized.length > 0 ? sanitized : DEFAULT_DRILL_SESSIONS;
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
  if (m >= 4.0 && activeRecording.timeToAlertSec === null) activeRecording.timeToAlertSec = elapsed;
  if (m >= 5.0 && activeRecording.timeToEvacuationSec === null) activeRecording.timeToEvacuationSec = elapsed;
  if (m >= 6.0 && activeRecording.timeToCriticalSec === null) activeRecording.timeToCriticalSec = elapsed;

  const nowObj = new Date();
  activeRecording.points.push({
    elapsedSec: elapsed,
    date: point.date || nowObj.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
    timestamp: point.timestamp || nowObj.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    isoDateTime: nowObj.toISOString(),
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
