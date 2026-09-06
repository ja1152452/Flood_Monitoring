import { create } from 'zustand';
import api from '../api/axios';
import { classifySimulatedLevel, calculateDynamicRate } from '../utils/waterSimulationUtils';
import { startDrillRecording, recordDrillPoint, finishDrillRecording } from '../utils/simulationRecorder';

let lastSyncTime = 0;
let pendingSyncTimeout = null;

const RAILWAY_SIM_URL = 'https://flood-monitoring.up.railway.app/api/v1/stream/simulation';

export const calculateEffectiveSimRate = (state) => {
  if (!state || state.mode !== 'simulation') return 0.0;
  if (state.scenarioSubMode === 'scenario') {
    if (!state.scenarioIsRunning) return 0.0;
    const phase = state.scenarioPhase;
    if (phase === 'peak' || phase === 'idle' || phase === 'completed') return 0.0;
    return calculateDynamicRate(state.simWaterLevel, phase);
  } else {
    // Manual continuous rise: compute dynamic rate from current water level
    return state.isSimRising ? calculateDynamicRate(state.simWaterLevel, true) : 0.0;
  }
};

const syncToBackend = (state, force = false) => {
  const now = Date.now();
  const send = async () => {
    try {
      const isSim = state.mode === 'simulation';
      const classification = classifySimulatedLevel(state.simWaterLevel);
      const effectiveRate = calculateEffectiveSimRate(state);
      const isRising = effectiveRate > 0.01;

      const payload = {
        active: isSim,
        water_level_m: state.simWaterLevel,
        flood_level: classification.level,
        is_rising: isRising,
        rate_per_hour: effectiveRate,
      };

      // 1. Primary sync to local backend
      await api.post('/stream/simulation', payload).catch(() => {});

      // 2. Also dual-sync to Railway so all mobile app users receive the simulation immediately
      if (typeof window !== 'undefined' && !window.location.hostname.includes('railway.app')) {
        fetch(RAILWAY_SIM_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }

      lastSyncTime = Date.now();
    } catch {
      // Best effort backend sync
    }
  };

  if (force || now - lastSyncTime >= 150) {
    if (pendingSyncTimeout) {
      clearTimeout(pendingSyncTimeout);
      pendingSyncTimeout = null;
    }
    send();
  } else if (!pendingSyncTimeout) {
    pendingSyncTimeout = setTimeout(() => {
      pendingSyncTimeout = null;
      send();
    }, 150);
  }
};

export const useSimulationStore = create((set, get) => ({
  // Core mode
  mode: 'live', // 'live' | 'simulation'
  simWaterLevel: 2.00, // in meters
  isSimRising: false,
  simRiseSpeed: 0.08, // m/s
  simRatePerHour: 0.0, // Live synchronized rate of change in m/hr

  // Scenario & Timer Sub-Mode
  scenarioSubMode: 'scenario', // 'scenario'
  scenarioStartMeters: 2.00,
  scenarioTargetMeters: 5.50,
  scenarioDurationSec: 60,
  scenarioElapsedSec: 0,
  scenarioIsRunning: false,
  scenarioPhase: 'idle', // 'idle' | 'rising' | 'peak' | 'receding' | 'completed'
  scenarioIsCycle: false,
  lastRecordedSec: -1,

  setMode: (mode) => {
    set({ mode });
    if (mode === 'live') {
      set({ isSimRising: false, scenarioIsRunning: false, scenarioPhase: 'idle', simRatePerHour: 0.0 });
      finishDrillRecording();
    }
    syncToBackend(get(), true);
  },

  setSimWaterLevel: (val) => {
    set((s) => {
      const nextLevel = typeof val === 'function' ? val(s.simWaterLevel) : val;
      return { simWaterLevel: Math.round(nextLevel * 100) / 100 };
    });
    syncToBackend(get(), false);
  },

  instantJump: (meters) => {
    const rounded = Math.round(meters * 100) / 100;
    set({
      simWaterLevel: rounded,
      isSimRising: false,
      scenarioIsRunning: false,
      scenarioPhase: 'completed',
      simRatePerHour: 0.0,
    });
    syncToBackend(get(), true);
  },

  setIsSimRising: (isRising) => {
    const rate = isRising ? calculateDynamicRate(get().simWaterLevel, true) : 0.0;
    set({ isSimRising: isRising, simRatePerHour: rate });
    if (isRising) {
      startDrillRecording('Manual Simulation Run', { startLevelM: get().simWaterLevel });
    } else {
      finishDrillRecording();
    }
    syncToBackend(get(), true);
  },

  setSimRiseSpeed: (speed) => {
    const rate = get().isSimRising ? calculateDynamicRate(get().simWaterLevel, true) : 0.0;
    set({ simRiseSpeed: speed, simRatePerHour: rate });
    syncToBackend(get(), true);
  },

  resetSimulation: () => {
    finishDrillRecording();
    set({
      isSimRising: false,
      simWaterLevel: 2.00,
      scenarioIsRunning: false,
      scenarioElapsedSec: 0,
      scenarioPhase: 'idle',
      simRatePerHour: 0.0,
      lastRecordedSec: -1,
    });
    syncToBackend(get(), true);
  },

  // Scenario Actions
  setScenarioSubMode: (subMode) => set({ scenarioSubMode: subMode }),
  
  setScenarioStartMeters: (m) => set({ scenarioStartMeters: Math.max(0, Math.min(7.0, m)) }),
  setScenarioTargetMeters: (m) => set({ scenarioTargetMeters: Math.max(0, Math.min(7.0, m)) }),
  setScenarioDurationSec: (s) => set({ scenarioDurationSec: Math.max(10, Math.min(600, s)) }),
  setScenarioIsCycle: (isCycle) => set({ scenarioIsCycle: isCycle }),

  applyScenarioPreset: (preset) => {
    set({
      scenarioStartMeters: preset.startM,
      scenarioTargetMeters: preset.targetM,
      scenarioDurationSec: preset.durationSec,
      scenarioIsCycle: !!preset.isCycle,
      scenarioElapsedSec: 0,
      scenarioPhase: 'idle',
      scenarioIsRunning: false,
      simWaterLevel: preset.startM,
      simRatePerHour: 0.0,
      lastRecordedSec: -1,
    });
    syncToBackend(get(), true);
  },

  startScenario: () => {
    const s = get();
    const drillName = s.scenarioIsCycle ? `Full Cycle Drill (${s.scenarioStartMeters}m ➔ ${s.scenarioTargetMeters}m)` : `Flood Rise Drill (${s.scenarioStartMeters}m ➔ ${s.scenarioTargetMeters}m)`;
    startDrillRecording(
      drillName,
      {
        startLevelM: s.scenarioStartMeters,
        targetLevelM: s.scenarioTargetMeters,
        scenarioType: s.scenarioIsCycle ? 'full_cycle' : 'rise',
      }
    );

    api.post('/stream/simulation/audit-log', {
      action: 'DRILL_SCENARIO_STARTED',
      details: {
        scenario_name: drillName,
        start_level_m: s.scenarioStartMeters,
        target_level_m: s.scenarioTargetMeters,
        duration_sec: s.scenarioDurationSec,
        is_cycle: s.scenarioIsCycle,
      },
    }).catch(() => {});

    const startRate = calculateEffectiveSimRate({
      ...s,
      scenarioIsRunning: true,
      scenarioPhase: 'rising',
    });

    if (s.scenarioPhase === 'idle' || s.scenarioPhase === 'completed') {
      set({
        simWaterLevel: s.scenarioStartMeters,
        scenarioElapsedSec: 0,
        scenarioPhase: 'rising',
        scenarioIsRunning: true,
        simRatePerHour: startRate,
        lastRecordedSec: -1,
      });
    } else {
      set({ scenarioIsRunning: true, simRatePerHour: startRate });
    }
    syncToBackend(get(), true);
  },

  pauseScenario: () => {
    set({ scenarioIsRunning: false, simRatePerHour: 0.0 });
    syncToBackend(get(), true);
  },

  resetScenario: () => {
    finishDrillRecording();
    const s = get();
    set({
      scenarioIsRunning: false,
      scenarioElapsedSec: 0,
      scenarioPhase: 'idle',
      simWaterLevel: s.scenarioStartMeters,
      simRatePerHour: 0.0,
      lastRecordedSec: -1,
    });
    syncToBackend(get(), true);
  },

  tickScenario: (deltaSec) => {
    const s = get();
    if (!s.scenarioIsRunning || s.mode !== 'simulation' || s.scenarioSubMode !== 'scenario') return;

    const newElapsed = s.scenarioElapsedSec + deltaSec;
    const totalDuration = s.scenarioDurationSec;
    const progress = Math.min(1.0, newElapsed / totalDuration);

    const startM = s.scenarioStartMeters;
    const targetM = s.scenarioTargetMeters;

    let currentM = startM;
    let phase = 'rising';

    if (s.scenarioIsCycle) {
      // Full Lifecycle: Rise (0% - 45%), Hold Peak (45% - 55%), Recede (55% - 100%)
      if (progress < 0.45) {
        const riseProgress = progress / 0.45;
        currentM = startM + (targetM - startM) * riseProgress;
        phase = 'rising';
      } else if (progress < 0.55) {
        currentM = targetM;
        phase = 'peak';
      } else if (progress < 1.0) {
        const recedeProgress = (progress - 0.55) / 0.45;
        currentM = targetM - (targetM - startM) * recedeProgress;
        phase = 'receding';
      } else {
        currentM = startM;
        phase = 'completed';
      }
    } else {
      // Rise Only
      if (progress < 1.0) {
        currentM = startM + (targetM - startM) * progress;
        phase = 'rising';
      } else {
        currentM = targetM;
        phase = 'completed';
      }
    }

    const isDone = progress >= 1.0;
    const roundedM = Math.round(currentM * 100) / 100;
    const classification = classifySimulatedLevel(roundedM);

    const activeRate = isDone ? 0.0 : calculateDynamicRate(roundedM, phase);

    // Record sample point every second
    const secFloor = Math.floor(newElapsed);
    if (secFloor > s.lastRecordedSec) {
      recordDrillPoint({
        elapsedSec: secFloor,
        waterLevelM: roundedM,
        floodLevel: classification.level,
        phase: phase,
        ratePerHour: activeRate,
      });
      set({ lastRecordedSec: secFloor });
    }

    if (isDone) {
      finishDrillRecording();
      api.post('/stream/simulation/audit-log', {
        action: 'DRILL_SCENARIO_COMPLETED',
        details: {
          start_level_m: startM,
          target_level_m: targetM,
          peak_level_m: roundedM,
          duration_sec: totalDuration,
          status: classification.level,
        },
      }).catch(() => {});
    }

    set({
      scenarioElapsedSec: isDone ? totalDuration : newElapsed,
      simWaterLevel: roundedM,
      scenarioPhase: phase,
      scenarioIsRunning: !isDone,
      simRatePerHour: activeRate,
    });

    syncToBackend(get(), false);
  },
}));
