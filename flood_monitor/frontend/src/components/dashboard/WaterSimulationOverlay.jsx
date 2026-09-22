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
  x = 0,
  y = 0,
  width = 640,
  height = 360,
  calConfig = null,
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

      const activeRoi = calConfig?.roi || CALIBRATION_CONFIG.roi;
      const activePoints = (Array.isArray(calConfig?.points) && calConfig.points.length >= 2)
        ? calConfig.points
        : CALIBRATION_CONFIG.points;

      const roi = getRoiBounds(cw, ch, activeRoi);
      const rawWaterlineY = meterToPixelY(currentLevel, ch, activePoints);
      // Keep waterline smoothly visible and bounded inside the video frame
      const targetWaterlineY = Math.min(ch - 14, Math.max(roi.top + 4, rawWaterlineY));
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
      activePoints.forEach((pt) => {
        const tickY = meterToPixelY(pt.m, ch, activePoints);
        if (tickY >= roi.top - 6 && tickY <= roi.bottom + 6) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.moveTo(roi.right - 12, tickY);
          ctx.lineTo(roi.right, tickY);
          ctx.stroke();

          // High contrast background pill for tick mark label
          const label = pt.m % 1 === 0 ? `${pt.m.toFixed(0)}m` : `${pt.m.toFixed(1)}m`;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(roi.right + 3, tickY - 7, 34, 14);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px Inter, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(label, roi.right + 6, tickY + 3);
        }
      });
      ctx.restore();

      // --- 2. DRAW REALISTIC SIMULATED RIVER WATER LAYER ---
      // 2A: Full-frame wide river water wash from targetWaterlineY to bottom
      ctx.save();
      const waveAmp1 = 2.5;
      const waveFreq1 = 0.035;
      const waveAmp2 = 1.2;
      const waveFreq2 = 0.08;

      ctx.beginPath();
      ctx.moveTo(cw, ch);
      ctx.lineTo(0, ch);
      for (let x = 0; x <= cw; x += 4) {
        const waveY =
          targetWaterlineY +
          Math.sin(x * waveFreq1 + t * 2.2) * waveAmp1 +
          Math.cos(x * waveFreq2 - t * 1.5) * waveAmp2;
        ctx.lineTo(x, waveY);
      }
      ctx.closePath();

      // Wide river water gradient
      const riverGrad = ctx.createLinearGradient(0, targetWaterlineY, 0, ch);
      riverGrad.addColorStop(0, 'rgba(14, 165, 233, 0.40)'); // Translucent bright cyan
      riverGrad.addColorStop(0.3, 'rgba(2, 132, 199, 0.48)');
      riverGrad.addColorStop(1, 'rgba(7, 89, 133, 0.70)');   // Deep river water
      ctx.fillStyle = riverGrad;
      ctx.fill();

      // Full-width surface foam / shimmer line
      ctx.beginPath();
      for (let x = 0; x <= cw; x += 4) {
        const waveY =
          targetWaterlineY +
          Math.sin(x * waveFreq1 + t * 2.2) * waveAmp1 +
          Math.cos(x * waveFreq2 - t * 1.5) * waveAmp2;
        if (x === 0) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.80)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // 2B: Concentrated denser water layer inside the staff gauge ROI column
      ctx.beginPath();
      ctx.rect(roi.left, roi.top, roi.width, roi.height);
      ctx.clip();

      ctx.beginPath();
      ctx.moveTo(roi.right, roi.bottom);
      ctx.lineTo(roi.left, roi.bottom);
      for (let x = roi.left; x <= roi.right; x += 2) {
        const relX = x - roi.left;
        const waveY =
          targetWaterlineY +
          Math.sin(relX * 0.06 + t * 2.5) * 2.0 +
          Math.cos(relX * 0.12 - t * 1.8) * 1.0;
        ctx.lineTo(x, waveY);
      }
      ctx.closePath();

      const gaugeWaterGrad = ctx.createLinearGradient(0, targetWaterlineY, 0, roi.bottom);
      gaugeWaterGrad.addColorStop(0, 'rgba(14, 165, 233, 0.60)');
      gaugeWaterGrad.addColorStop(0.4, 'rgba(2, 132, 199, 0.70)');
      gaugeWaterGrad.addColorStop(1, 'rgba(7, 89, 133, 0.85)');
      ctx.fillStyle = gaugeWaterGrad;
      ctx.fill();

      // Staff gauge underwater caustics
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
      ctx.lineWidth = 1.5;
      for (let offset = 12; offset < roi.bottom - targetWaterlineY; offset += 18) {
        ctx.beginPath();
        for (let x = roi.left + 4; x <= roi.right - 4; x += 4) {
          const cy =
            targetWaterlineY +
            offset +
            Math.sin((x - roi.left) * 0.07 + t * 1.8 + offset) * 1.8;
          if (x === roi.left + 4) ctx.moveTo(x, cy);
          else ctx.lineTo(x, cy);
        }
        ctx.stroke();
      }
      ctx.restore();

      // --- 3. AI WATERLINE DETECTION HUD (MATCHING 7_sender.py HUD) ---
      ctx.save();
      // Laser Line across full frame width
      // Dark high-contrast background shadow
      ctx.beginPath();
      ctx.moveTo(0, targetWaterlineY);
      ctx.lineTo(cw, targetWaterlineY);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.90)';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Thick Neon Yellow Waterline Indicator with soft glow
      ctx.beginPath();
      ctx.moveTo(0, targetWaterlineY);
      ctx.lineTo(cw, targetWaterlineY);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow

      // Floating Tag directly on the Yellow Waterline
      const tagText = ` WATERLINE: ${currentLevel.toFixed(2)}m [${classification.level}] `;
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      const textWidth = ctx.measureText(tagText).width;

      const tagX = Math.max(10, Math.min(cw - textWidth - 24, roi.left - 20));
      const tagY = Math.max(26, Math.min(ch - 14, targetWaterlineY - 8));

      // Tag Background (Opaque Black)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
      ctx.fillRect(tagX, tagY - 18, textWidth + 14, 22);

      // Tag Border with classification severity color
      ctx.strokeStyle = classification.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(tagX, tagY - 18, textWidth + 14, 22);

      // Status indicator dot inside tag
      ctx.fillStyle = classification.color;
      ctx.beginPath();
      ctx.arc(tagX + 9, tagY - 7, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Tag Text in Bright Yellow
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'left';
      ctx.fillText(tagText, tagX + 12, tagY - 3);

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
  }, [isActive, waterLevelMeters, isRising, width, height, x, y, calConfig]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute pointer-events-none z-30"
      style={{
        display: 'block',
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  );
}
