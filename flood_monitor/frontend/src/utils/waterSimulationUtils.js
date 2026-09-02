/**
 * Real-Time Water Level Simulation Utilities
 * Calibrated specifically for Lumban Bridge Tapo C310 CCTV & E-Staff Gauge.
 * 
 * Uses exact calibration points from calibration.json:
 *   7m -> 56px
 *   6m -> 128px
 *   5m -> 190px
 *   4m -> 247px
 *   3m -> 296px
 *   2m -> 337px
 *   0m -> 360px
 */

export const CALIBRATION_CONFIG = {
  baseline_pixel_y: 230,
  baseline_meters: 3.869,
  px_per_meter: 48.0838,
  roi: {
    left_pct: 48.44,
    right_pct: 58.13,
    top_pct: 15.28,
    bottom_pct: 100,
  },
  // Reference frame dimensions from calibration
  reference_width: 640,
  reference_height: 360,
  points: [
    { px: 56, m: 7.0 },
    { px: 128, m: 6.0 },
    { px: 190, m: 5.0 },
    { px: 247, m: 4.0 },
    { px: 296, m: 3.0 },
    { px: 337, m: 2.0 },
    { px: 360, m: 0.0 },
  ],
};

// Project official threshold definitions
export const SIMULATION_THRESHOLDS = [
  { min: 0.0, max: 3.1, level: 'NORMAL', label: 'Normal Level', color: '#16a34a', bg: 'bg-emerald-600', text: 'text-emerald-300' },
  { min: 3.1, max: 4.0, level: 'MONITOR', label: 'Monitor Level (Warning)', color: '#d97706', bg: 'bg-amber-600', text: 'text-amber-300' },
  { min: 4.0, max: 5.0, level: 'ALERT', label: 'Alert Level (Warning)', color: '#ea580c', bg: 'bg-orange-600', text: 'text-orange-300' },
  { min: 5.0, max: 6.0, level: 'EVACUATION', label: 'Evacuation Level (Critical)', color: '#dc2626', bg: 'bg-red-600', text: 'text-red-300' },
  { min: 6.0, max: 99.0, level: 'CRITICAL', label: 'Critical Level (Flood)', color: '#7e22ce', bg: 'bg-purple-700', text: 'text-purple-300' },
];

// Presets using existing project meter values
export const SIMULATION_PRESETS = [
  { id: 'NORMAL', label: 'NORMAL', meters: 2.00, desc: 'Normal Dry Baseline (2.00 m)', color: '#16a34a', bgClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30' },
  { id: 'WARNING', label: 'WARNING', meters: 3.50, desc: 'Monitor / Warning (3.50 m)', color: '#d97706', bgClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30' },
  { id: 'CRITICAL', label: 'CRITICAL', meters: 5.20, desc: 'Evacuation / Critical (5.20 m)', color: '#dc2626', bgClass: 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30' },
  { id: 'FLOOD', label: 'FLOOD', meters: 6.50, desc: 'Severe Flood Level (6.50 m)', color: '#7e22ce', bgClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30' },
];

// Automated scenario drill presets
export const SCENARIO_PRESETS = [
  { id: 'minor_spate', label: 'Minor Spate', startM: 2.00, targetM: 3.50, durationSec: 30, isCycle: false, desc: 'Normal ➔ Monitor (2.0m ➔ 3.5m in 30s)', color: '#d97706' },
  { id: 'moderate_flood', label: 'Moderate Flood', startM: 2.00, targetM: 4.50, durationSec: 60, isCycle: false, desc: 'Normal ➔ Alert (2.0m ➔ 4.5m in 60s)', color: '#ea580c' },
  { id: 'severe_flood', label: 'Flash Flood', startM: 2.00, targetM: 5.50, durationSec: 60, isCycle: false, desc: 'Normal ➔ Evacuation (2.0m ➔ 5.5m in 60s)', color: '#dc2626' },
  { id: 'catastrophic', label: 'Major Inundation', startM: 2.00, targetM: 6.80, durationSec: 90, isCycle: false, desc: 'Normal ➔ Critical Flood (2.0m ➔ 6.8m in 90s)', color: '#7e22ce' },
  { id: 'full_cycle', label: 'Full Flood Cycle', startM: 2.00, targetM: 5.50, durationSec: 60, isCycle: true, desc: 'Rise ➔ Peak ➔ Recede (Complete 60s Cycle)', color: '#2563eb' },
];

/**
 * Classify a water level in meters into the project flood category.
 * @param {number} meters - Water level in meters
 * @returns {object} Threshold object
 */
export function classifySimulatedLevel(meters) {
  const m = Math.max(0.0, parseFloat(meters) || 0.0);
  for (const t of SIMULATION_THRESHOLDS) {
    if (m >= t.min && m < t.max) {
      return t;
    }
  }
  return SIMULATION_THRESHOLDS[SIMULATION_THRESHOLDS.length - 1];
}

/**
 * Convert water level in meters (m) to pixel Y coordinate on a canvas of height `canvasHeight`.
 * Uses calibrated piecewise interpolation based on `points`.
 * 
 * @param {number} meters - Water level in meters (0.0m to 7.0m+)
 * @param {number} canvasHeight - Current canvas/video height in pixels (default: 360)
 * @returns {number} Pixel Y position for the waterline
 */
export function meterToPixelY(meters, canvasHeight = CALIBRATION_CONFIG.reference_height) {
  const m = Math.max(0.0, parseFloat(meters) || 0.0);
  const pts = [...CALIBRATION_CONFIG.points].sort((a, b) => a.m - b.m);
  
  const scale = canvasHeight / CALIBRATION_CONFIG.reference_height;

  let refPixelY;

  if (m <= pts[0].m) {
    // Extrapolate below 0m
    const slope = (pts[1].px - pts[0].px) / (pts[1].m - pts[0].m);
    refPixelY = pts[0].px + slope * (m - pts[0].m);
  } else if (m >= pts[pts.length - 1].m) {
    // Extrapolate above 7m
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const slope = (last.px - prev.px) / (last.m - prev.m);
    refPixelY = last.px + slope * (m - last.m);
  } else {
    // Piecewise linear interpolation
    for (let i = 0; i < pts.length - 1; i++) {
      if (m >= pts[i].m && m <= pts[i + 1].m) {
        const ratio = (m - pts[i].m) / (pts[i + 1].m - pts[i].m);
        refPixelY = pts[i].px + ratio * (pts[i + 1].px - pts[i].px);
        break;
      }
    }
  }

  // Bound within reasonable frame coordinates
  return Math.max(0, Math.min(canvasHeight, (refPixelY ?? CALIBRATION_CONFIG.baseline_pixel_y) * scale));
}

/**
 * Convert pixel Y coordinate on canvas of height `canvasHeight` back to meters (m).
 * @param {number} pixelY - Current pixel Y position
 * @param {number} canvasHeight - Current canvas height
 * @returns {number} Water level in meters rounded to 2 decimal places
 */
export function pixelYToMeter(pixelY, canvasHeight = CALIBRATION_CONFIG.reference_height) {
  const scale = canvasHeight / CALIBRATION_CONFIG.reference_height;
  const refPixelY = pixelY / scale;

  const pts = [...CALIBRATION_CONFIG.points].sort((a, b) => a.px - b.px); // Sorted top to bottom (smaller px = higher meters)

  let meters;
  if (refPixelY <= pts[0].px) {
    const slope = (pts[1].m - pts[0].m) / (pts[1].px - pts[0].px);
    meters = pts[0].m + slope * (refPixelY - pts[0].px);
  } else if (refPixelY >= pts[pts.length - 1].px) {
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const slope = (last.m - prev.m) / (last.px - prev.px);
    meters = last.m + slope * (refPixelY - last.px);
  } else {
    for (let i = 0; i < pts.length - 1; i++) {
      if (refPixelY >= pts[i].px && refPixelY <= pts[i + 1].px) {
        const ratio = (refPixelY - pts[i].px) / (pts[i + 1].px - pts[i].px);
        meters = pts[i].m + ratio * (pts[i + 1].m - pts[i].m);
        break;
      }
    }
  }

  return Math.max(0.0, Math.round((meters ?? 0.0) * 100) / 100);
}

/**
 * Compute the bounding ROI pixel coordinates on a canvas of width `w` and height `h`.
 * @param {number} w - Canvas width
 * @param {number} h - Canvas height
 * @returns {object} { left, right, top, bottom, width, height }
 */
export function getRoiBounds(w, h) {
  const { roi } = CALIBRATION_CONFIG;
  const left = Math.round((roi.left_pct / 100) * w);
  const right = Math.round((roi.right_pct / 100) * w);
  const top = Math.round((roi.top_pct / 100) * h);
  const bottom = Math.round((roi.bottom_pct / 100) * h);

  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}
