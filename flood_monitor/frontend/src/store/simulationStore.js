import { create } from 'zustand';
import api from '../api/axios';
import { classifySimulatedLevel } from '../utils/waterSimulationUtils';
import { startDrillRecording, recordDrillPoint, finishDrillRecording } from '../utils/simulationRecorder';

let lastSyncTime = 0;
let pendingSyncTimeout = null;

const syncToBackend = (state, force = false) => {
  const now = Date.now();
  const send = async () => {
    try {
      const isSim = state.mode === 'simulation';
      const classification = classifySimulatedLevel(state.simWaterLevel);
      const isRising = state.scenarioSubMode === 'scenario' 
        ? state.scenarioPhase === 'rising' 
        : state.isSimRising;

      await api.post('/stream/simulation', {
        active: isSim,
        water_level_m: state.simWaterLevel,
        flood_level: classification.level,
        is_rising: isRising,
        rate_per_hour: isRising ? parseFloat((state.simRiseSpeed * 3600).toFixed(2)) : 0.0,
      });
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
      set({ isSimRising: false, scenarioIsRunning: false, scenarioPhase: 'idle' });
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
    });
    syncToBackend(get(), true);
  },

  setIsSimRising: (isRising) => {
    set({ isSimRising: isRising });
    if (isRising) {
      startDrillRecording('Manual Simulation Run', { startLevelM: get().simWaterLevel });
    } else {
      finishDrillRecording();
    }
    syncToBackend(get(), true);
  },

  setSimRiseSpeed: (speed) => {
    set({ simRiseSpeed: speed });
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

    if (s.scenarioPhase === 'idle' || s.scenarioPhase === 'completed') {
      set({
        simWaterLevel: s.scenarioStartMeters,
        scenarioElapsedSec: 0,
        scenarioPhase: 'rising',
        scenarioIsRunning: true,
        lastRecordedSec: -1,
      });
    } else {
      set({ scenarioIsRunning: true });
    }
    syncToBackend(get(), true);
  },

  pauseScenario: () => {
    set({ scenarioIsRunning: false });
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

    // Record sample point every second
    const secFloor = Math.floor(newElapsed);
    if (secFloor > s.lastRecordedSec) {
      recordDrillPoint({
        elapsedSec: secFloor,
        waterLevelM: roundedM,
        floodLevel: classification.level,
        phase: phase,
        ratePerHour: phase === 'rising' ? parseFloat((((targetM - startM) / totalDuration) * 3600).toFixed(1)) : 0,
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
    });

    syncToBackend(get(), false);
  },
}));
