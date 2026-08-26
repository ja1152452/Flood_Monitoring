import { create } from 'zustand';
import api from '../api/axios';
import { classifySimulatedLevel } from '../utils/waterSimulationUtils';

let syncTimeout = null;
const syncToBackend = (state) => {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
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
    } catch {
      // Best effort backend sync
    }
  }, 100);
};

export const useSimulationStore = create((set, get) => ({
  // Core mode
  mode: 'live', // 'live' | 'simulation'
  simWaterLevel: 2.00, // in meters
  isSimRising: false,
  simRiseSpeed: 0.08, // m/s

  // Scenario & Timer Sub-Mode
  scenarioSubMode: 'manual', // 'manual' | 'scenario'
  scenarioStartMeters: 2.00,
  scenarioTargetMeters: 5.50,
  scenarioDurationSec: 60,
  scenarioElapsedSec: 0,
  scenarioIsRunning: false,
  scenarioPhase: 'idle', // 'idle' | 'rising' | 'peak' | 'receding' | 'completed'
  scenarioIsCycle: false,

  setMode: (mode) => {
    set({ mode });
    if (mode === 'live') {
      set({ isSimRising: false, scenarioIsRunning: false, scenarioPhase: 'idle' });
    }
    syncToBackend(get());
  },

  setSimWaterLevel: (val) => {
    set((s) => {
      const nextLevel = typeof val === 'function' ? val(s.simWaterLevel) : val;
      return { simWaterLevel: Math.round(nextLevel * 100) / 100 };
    });
    syncToBackend(get());
  },

  setIsSimRising: (isRising) => {
    set({ isSimRising: isRising });
    syncToBackend(get());
  },

  setSimRiseSpeed: (speed) => {
    set({ simRiseSpeed: speed });
    syncToBackend(get());
  },

  resetSimulation: () => {
    set({
      isSimRising: false,
      simWaterLevel: 2.00,
      scenarioIsRunning: false,
      scenarioElapsedSec: 0,
      scenarioPhase: 'idle',
    });
    syncToBackend(get());
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
    });
    syncToBackend(get());
  },

  startScenario: () => {
    const s = get();
    // If starting from idle or completed, start at startMeters
    if (s.scenarioPhase === 'idle' || s.scenarioPhase === 'completed') {
      set({
        simWaterLevel: s.scenarioStartMeters,
        scenarioElapsedSec: 0,
        scenarioPhase: 'rising',
        scenarioIsRunning: true,
      });
    } else {
      set({ scenarioIsRunning: true });
    }
    syncToBackend(get());
  },

  pauseScenario: () => {
    set({ scenarioIsRunning: false });
    syncToBackend(get());
  },

  resetScenario: () => {
    const s = get();
    set({
      scenarioIsRunning: false,
      scenarioElapsedSec: 0,
      scenarioPhase: 'idle',
      simWaterLevel: s.scenarioStartMeters,
    });
    syncToBackend(get());
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

    set({
      scenarioElapsedSec: isDone ? totalDuration : newElapsed,
      simWaterLevel: roundedM,
      scenarioPhase: phase,
      scenarioIsRunning: !isDone,
    });

    syncToBackend(get());
  },
}));
