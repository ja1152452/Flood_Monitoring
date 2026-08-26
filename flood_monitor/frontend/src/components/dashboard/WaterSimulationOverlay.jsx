import { useEffect, useRef } from 'react';
import {
  meterToPixelY,
  getRoiBounds,
  classifySimulatedLevel,
  CALIBRATION_CONFIG,
} from '../../utils/waterSimulationUtils';

/**
 * WaterSimulationOverlay
 * Renders a real-time fluid simulation canvas over the live CCTV feed,
 * masked strictly to the calibrated staff gauge / river channel ROI.
 */
export function WaterSimulationOverlay({
  waterLevelMeters = 2.0,
  isActive = true,
  isRising = false,
  width = 640,
  height = 360,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const timeRef = useRef(0);
  const smoothedLevelRef = useRef(waterLevelMeters);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      timeRef.current += 0.035;
      const t = timeRef.current;

      // Smoothly glide towards target water level (lerp)
      smoothedLevelRef.current += (waterLevelMeters - smoothedLevelRef.current) * 0.1;
      const currentLevel = smoothedLevelRef.current;

      const cw = canvas.width;
      const ch = canvas.height;

      // Clear canvas
      ctx.clearRect(0, 0, cw, ch);

      const roi = getRoiBounds(cw, ch);
      const targetWaterlineY = meterToPixelY(currentLevel, ch);
      const classification = classifySimulatedLevel(currentLevel);

      // --- 1. DRAW ROI REGION HIGHLIGHT ---
      ctx.save();
      // Outer ROI border (Subtle Sky Blue like OpenCV AI detection)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(roi.left, roi.top, roi.width, roi.height);
      ctx.setLineDash([]); // Reset dash

      // ROI label in corner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(roi.left, Math.max(0, roi.top - 18), 120, 18);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px Inter, system-ui, sans-serif';
      ctx.fillText('ROI: STAFF GAUGE', roi.left + 5, Math.max(12, roi.top - 5));

      // Staff gauge calibrated meter tick marks
      CALIBRATION_CONFIG.points.forEach((pt) => {
        const tickY = meterToPixelY(pt.m, ch);
        if (tickY >= roi.top && tickY <= roi.bottom) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.moveTo(roi.right - 10, tickY);
          ctx.lineTo(roi.right, tickY);
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.font = 'bold 9px Inter, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`${pt.m.toFixed(0)}m`, roi.right + 4, tickY + 3);
        }
      });
      ctx.restore();

      // --- 2. DRAW SEMI-TRANSPARENT SIMULATED WATER LAYER ---
      // We clip strictly inside the ROI column
      ctx.save();
      ctx.beginPath();
      ctx.rect(roi.left, roi.top, roi.width, roi.height);
      ctx.clip();

      const waveAmp1 = 3.0;
      const waveFreq1 = 0.05;
      const waveAmp2 = 1.5;
      const waveFreq2 = 0.12;

      // Create wave path for water surface
      ctx.beginPath();
      const startX = roi.left;
      const endX = roi.right;

      // Start at bottom right of ROI
      ctx.moveTo(endX, roi.bottom);
      ctx.lineTo(startX, roi.bottom);

      // Draw undulating wave surface from left to right
      for (let x = startX; x <= endX; x += 2) {
        const relX = x - startX;
        const waveY =
          targetWaterlineY +
          Math.sin(relX * waveFreq1 + t * 2.5) * waveAmp1 +
          Math.cos(relX * waveFreq2 - t * 1.8) * waveAmp2;
        ctx.lineTo(x, waveY);
      }
      ctx.closePath();

      // Realistic turbid river water gradient with depth opacity
      const waterGrad = ctx.createLinearGradient(0, targetWaterlineY, 0, roi.bottom);
      waterGrad.addColorStop(0, 'rgba(14, 165, 233, 0.65)'); // Translucent bright cyan/blue surface
      waterGrad.addColorStop(0.3, 'rgba(2, 132, 199, 0.72)');
      waterGrad.addColorStop(0.7, 'rgba(3, 105, 161, 0.82)');
      waterGrad.addColorStop(1, 'rgba(7, 89, 133, 0.90)'); // Deep riverbed

      ctx.fillStyle = waterGrad;
      ctx.fill();

      // Surface water shimmer / foam line
      ctx.beginPath();
      for (let x = startX; x <= endX; x += 2) {
        const relX = x - startX;
        const waveY =
          targetWaterlineY +
          Math.sin(relX * waveFreq1 + t * 2.5) * waveAmp1 +
          Math.cos(relX * waveFreq2 - t * 1.8) * waveAmp2;
        if (x === startX) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.95)';
      ctx.lineWidth = 3.0;
      ctx.stroke();

      // Water internal light caustics / ripples
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      for (let offset = 15; offset < roi.bottom - targetWaterlineY; offset += 20) {
        ctx.beginPath();
        for (let x = startX + 5; x <= endX - 5; x += 4) {
          const cy =
            targetWaterlineY +
            offset +
            Math.sin((x - startX) * 0.05 + t * 1.5 + offset) * 2.0;
          if (x === startX + 5) ctx.moveTo(x, cy);
          else ctx.lineTo(x, cy);
        }
        ctx.stroke();
      }

      ctx.restore();

      // --- 3. AI WATERLINE DETECTION OVERLAY (MATCHING 7_sender.py HUD) ---
      ctx.save();
      // Laser Line across full frame width
      // Black shadow outline for high contrast against real CCTV
      ctx.beginPath();
      ctx.moveTo(0, targetWaterlineY);
      ctx.lineTo(cw, targetWaterlineY);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Thick Bright Yellow Waterline Indicator
      ctx.beginPath();
      ctx.moveTo(0, targetWaterlineY);
      ctx.lineTo(cw, targetWaterlineY);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Floating Tag directly on the Yellow Waterline
      const tagText = ` WATERLINE: ${currentLevel.toFixed(2)}m [${classification.level}] `;
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      const textWidth = ctx.measureText(tagText).width;

      const tagX = Math.max(10, Math.min(cw - textWidth - 20, roi.left - 20));
      const tagY = Math.max(26, targetWaterlineY - 10);

      // Tag Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.90)';
      ctx.fillRect(tagX, tagY - 18, textWidth + 12, 22);

      // Tag Border with severity color
      ctx.strokeStyle = classification.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(tagX, tagY - 18, textWidth + 12, 22);

      // Tag Text
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'left';
      ctx.fillText(tagText, tagX + 6, tagY - 3);

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isActive, waterLevelMeters, isRising, width, height]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 w-full h-full pointer-events-none z-30"
      style={{ display: 'block' }}
    />
  );
}
