/**
 * In-Memory Simulation State Manager
 * Connects Web Admin Simulation controls with Backend APIs, SSE streams, and Citizen Mobile Apps.
 */

let simulationState = {
  active: false,
  water_level_m: 2.00,
  flood_level: 'NORMAL',
  is_rising: false,
  rate_per_hour: 0.0,
  updated_at: new Date().toISOString(),
};

export const getSimulationState = () => ({ ...simulationState });

export const setSimulationState = (dto = {}) => {
  simulationState = {
    ...simulationState,
    ...dto,
    updated_at: new Date().toISOString(),
  };
  return simulationState;
};

export const resetSimulationState = () => {
  simulationState = {
    active: false,
    water_level_m: 2.00,
    flood_level: 'NORMAL',
    is_rising: false,
    rate_per_hour: 0.0,
    updated_at: new Date().toISOString(),
  };
  return simulationState;
};

export const isSimulationActive = () => simulationState.active === true;
