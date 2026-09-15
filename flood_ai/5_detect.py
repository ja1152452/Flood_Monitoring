import os
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
os.environ["OPENCV_LOG_LEVEL"] = "OFF"
import cv2
try:
    cv2.setLogLevel(0)
except Exception:
    pass
import numpy as np
import json
from datetime import datetime

print("=== Lumban Flood Monitor — Live Detection ===")

_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(_DIR, "calibration.json")) as f:
    CAL = json.load(f)

RTSP_URL         = CAL["rtsp_url"]
BASELINE_PIXEL_Y = CAL["baseline_pixel_y"]
BASELINE_METERS  = CAL["baseline_meters"]
PX_PER_METER     = CAL["px_per_meter"]

# Colored marker ranges for dry staff gauge bands (ONLY vivid colored bands — white removed to avoid water reflection glare!)
MARKER_RANGES = {
  "purple":     ([115, 60,  60],  [160, 255, 255]),
  "red_low":    ([0,   70,  110], [15,  255, 255]),
  "red_high":   ([160, 70,  110], [180, 255, 255]),
  "orange":     ([5,   80,  135], [28,  255, 255]),
  "yellow":     ([14,  80,  135], [40,  255, 255]),
}

# Brown floodwater color range (muddy river water during rising flood)
BROWN_FLOOD_RANGE = ([0, 15, 15], [35, 180, 220])

FLOOD_BASELINE = 2.135  # Current raw reading when dry, subtracted to make 0.0m = no water

FLOOD_THRESHOLDS = [
    (0.0,  3.1,  "NORMAL"),
    (3.1,  4.1,  "MONITOR"),
    (4.1,  5.1,  "ALERT"),
    (5.1,  6.1,  "EVACUATION"),
    (6.1,  99.0, "CRITICAL"),
]

LEVEL_COLORS_BGR = {
    "NORMAL":     (200, 200, 200),
    "MONITOR":    (0,   200, 255),
    "ALERT":      (0,   140, 255),
    "EVACUATION": (0,   0,   220),
    "CRITICAL":   (180, 0,   180),
}

def classify(water_level_m):
    if water_level_m < 3.1:
        return "NORMAL"
    for low, high, level in FLOOD_THRESHOLDS:
        if low <= water_level_m < high:
            return level
    return "CRITICAL"

from collections import deque

class WaterlineSmoother:
    def __init__(self, window_size=9, deadband_m=0.065, max_jump_m=0.25, outlier_streak_thresh=5):
        self.window_size = window_size
        self.deadband_m = deadband_m
        self.max_jump_m = max_jump_m
        self.outlier_streak_thresh = outlier_streak_thresh
        self.outlier_streak = 0
        self.history_y = deque(maxlen=window_size)
        self.history_m = deque(maxlen=window_size)
        self.last_stable_m = None
        self.last_stable_y = None

    def reset(self, raw_y=None, raw_m=None):
        self.history_y.clear()
        self.history_m.clear()
        self.outlier_streak = 0
        if raw_y is not None and raw_m is not None:
            self.history_y.append(raw_y)
            self.history_m.append(raw_m)
        self.last_stable_m = raw_m
        self.last_stable_y = raw_y

    def process(self, raw_y, raw_m, is_manual=False):
        if is_manual or self.last_stable_m is None:
            self.reset(raw_y, raw_m)
            return raw_y, raw_m, 0.99

        jump = abs(raw_m - self.last_stable_m)
        if jump > self.max_jump_m:
            self.outlier_streak += 1
            drop_spike = (self.last_stable_m - raw_m) > 0.50
            thresh = 15 if drop_spike else self.outlier_streak_thresh
            if self.outlier_streak >= thresh:
                self.reset(raw_y, raw_m)
                return raw_y, raw_m, 0.95
            return self.last_stable_y, self.last_stable_m, 0.90

        self.outlier_streak = 0
        self.history_y.append(raw_y)
        self.history_m.append(raw_m)

        median_y = int(np.median(self.history_y))
        median_m = round(float(np.median(self.history_m)), 3)

        if abs(median_m - self.last_stable_m) < self.deadband_m:
            smooth_m = self.last_stable_m
            smooth_y = self.last_stable_y
        else:
            alpha = 0.22
            smooth_m = round(self.last_stable_m * (1 - alpha) + median_m * alpha, 3)
            smooth_y = int(self.last_stable_y * (1 - alpha) + median_y * alpha)
            self.last_stable_m = smooth_m
            self.last_stable_y = smooth_y

        std_y = np.std(self.history_y) if len(self.history_y) > 1 else 0.0
        stability = max(0.85, min(0.99, 1.0 - (std_y / 60.0)))
        return smooth_y, smooth_m, round(stability, 3)

GLOBAL_SMOOTHER = WaterlineSmoother(window_size=9, deadband_m=0.065)

YOLO_MODEL = None

def get_yolo_model():
    global YOLO_MODEL
    if YOLO_MODEL is None:
        model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "water_yolo.pt")
        if os.path.exists(model_path):
            try:
                from ultralytics import YOLO
                YOLO_MODEL = YOLO(model_path)
                print(f"[AI Engine] Loaded YOLO model from {model_path}")
            except Exception as e:
                print(f"[AI Engine] Model load warning: {e}")
    return YOLO_MODEL

def detect_waterline(frame, use_clahe=True, smoother=GLOBAL_SMOOTHER):
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "calibration.json")) as f:
        _cal = json.load(f)

    h, w = frame.shape[:2]

    roi_cfg    = _cal.get("roi", {})
    roi_top    = int(h * (roi_cfg.get("top_pct",    10.0) / 100.0))
    roi_bottom = int(h * (roi_cfg.get("bottom_pct", 90.0) / 100.0))
    roi_left   = int(w * (roi_cfg.get("left_pct",   30.0) / 100.0))
    roi_right  = int(w * (roi_cfg.get("right_pct",  70.0) / 100.0))

    bgr_roi = frame[roi_top:roi_bottom, roi_left:roi_right]
    roi_h, roi_w = bgr_roi.shape[:2]

    waterline_y = None
    ai_confidence = 0.88

    # --- 0. MANUAL OVERRIDE (If locked in Web Calibrator) ---
    manual_y = _cal.get("manual_waterline_y")
    if manual_y is not None and int(manual_y) > 0:
        waterline_y = int(manual_y)
        ai_confidence = 0.98

    # --- 1. PRIMARY AI ENGINE (YOLOv12) ---
    if waterline_y is None:
        ai_model = get_yolo_model()
        if ai_model is not None:
            try:
                results = ai_model.predict(source=bgr_roi, verbose=False, conf=0.35)
                if results and len(results[0].boxes) > 0:
                    boxes = results[0].boxes
                    for box in boxes:
                        cls_id = int(box.cls[0])
                        conf_val = float(box.conf[0])
                        # Class 0: water_surface (Top edge of water box = actual waterline)
                        if cls_id == 0 and conf_val >= 0.35:
                            top_y = int(box.xyxy[0][1])
                            pred_y = roi_top + top_y
                            if pred_y < int(h * 0.95):  # Valid waterline inside ROI
                                waterline_y = pred_y
                                ai_confidence = conf_val
                                break
            except Exception as err:
                print(f"[AI Predict Warning] {err}")

    # --- 2. SECONDARY REAL-TIME SATURATION & COLOR DETECTOR ---
    if waterline_y is None:
        hsv_roi = cv2.cvtColor(bgr_roi, cv2.COLOR_BGR2HSV)

        # Mask for vivid staff gauge painted colors + white bottom band
        gauge_mask = np.zeros((roi_h, roi_w), dtype=np.uint8)
        for name, (lower, upper) in MARKER_RANGES.items():
            gauge_mask = cv2.bitwise_or(gauge_mask,
                cv2.inRange(hsv_roi, np.array(lower), np.array(upper)))

        # Remove extreme sunlight white glare (V > 245, S < 25)
        glare_mask = cv2.inRange(hsv_roi, np.array([0, 0, 245]), np.array([180, 25, 255]))
        gauge_mask = cv2.bitwise_and(gauge_mask, cv2.bitwise_not(glare_mask))

        kernel = np.ones((5, 5), np.uint8)
        gauge_mask = cv2.morphologyEx(gauge_mask, cv2.MORPH_OPEN,  kernel)
        gauge_mask = cv2.morphologyEx(gauge_mask, cv2.MORPH_CLOSE, kernel)

        row_counts = np.sum(gauge_mask > 0, axis=1)
        min_band_px = max(4, int(roi_w * 0.15))
        valid_gauge_rows = np.where(row_counts >= min_band_px)[0]

        if len(valid_gauge_rows) > 0:
            # Group rows into contiguous vertical blocks
            clusters = []
            cur_cluster = [valid_gauge_rows[0]]
            for r in valid_gauge_rows[1:]:
                if r - cur_cluster[-1] <= 6:
                    cur_cluster.append(r)
                else:
                    clusters.append(cur_cluster)
                    cur_cluster = [r]
            if cur_cluster:
                clusters.append(cur_cluster)

            # CRITICAL REFLECTION REJECTION:
            # The physical staff gauge board is mounted from the top wall downwards.
            # Any colored reflection in water is ALWAYS in the water BELOW the physical board.
            # We select the FIRST substantial colored cluster from the top (length >= 8 rows).
            physical_cluster = None
            for c in clusters:
                if len(c) >= 8:
                    physical_cluster = c
                    break

            if physical_cluster is not None:
                cont_end = physical_cluster[-1]

                # If reflection is continuous with the board, detect where brightness drops into water
                val_roi = hsv_roi[:, :, 2]
                cluster_vals = [np.mean(val_roi[r, :]) for r in physical_cluster]
                peak_v = max(cluster_vals) if cluster_vals else 200
                for i, r in enumerate(physical_cluster):
                    if i > len(physical_cluster) // 2 and cluster_vals[i] < peak_v * 0.65:
                        cont_end = r
                        break

                waterline_y = roi_top + int(cont_end)
                ai_confidence = 0.94

        if waterline_y is None:
            if smoother is not None and getattr(smoother, 'last_stable_y', None) is not None:
                # Hold previous stable reading rather than guessing
                waterline_y = smoother.last_stable_y
                ai_confidence = 0.85
            else:
                # Fallback: scan downwards from highest-saturation gauge center
                sat = hsv_roi[:, :, 1]
                row_sat = np.mean(sat, axis=1)
                peak_y = int(np.argmax(row_sat))
                sat_y = peak_y
                for y in range(peak_y, len(row_sat)):
                    if row_sat[y] < 35:
                        sat_y = y
                        break
                waterline_y = roi_top + sat_y
                ai_confidence = 0.75

    if waterline_y is None:
        return {"success": False, "reason": "No staff gauge or water surface detected"}

    # Map waterline_y to meters
    if "points" in _cal and len(_cal["points"]) >= 2:
        pts = sorted(_cal["points"], key=lambda p: p["px"])
        xp = [p["px"] for p in pts]
        fp = [p["m"] for p in pts]
        if waterline_y <= xp[0]:
            slope = (fp[1] - fp[0]) / (xp[1] - xp[0]) if (xp[1] - xp[0]) != 0 else 0
            val = fp[0] + slope * (waterline_y - xp[0])
        elif waterline_y >= xp[-1]:
            slope = (fp[-1] - fp[-2]) / (xp[-1] - xp[-2]) if (xp[-1] - xp[-2]) != 0 else 0
            val = fp[-1] + slope * (waterline_y - xp[-1])
        else:
            val = float(np.interp(waterline_y, xp, fp))
        raw_water_level_m = round(max(0.0, val), 3)
    else:
        pixel_delta   = BASELINE_PIXEL_Y - waterline_y
        water_level_raw = BASELINE_METERS + (pixel_delta / PX_PER_METER)
        raw_water_level_m = max(0.0, round(water_level_raw - FLOOD_BASELINE, 3))

    if smoother is not None:
        smooth_y, smooth_m, confidence = smoother.process(waterline_y, raw_water_level_m)
        waterline_y = smooth_y
        water_level_m = max(0.0, smooth_m)
    else:
        water_level_m = raw_water_level_m
        confidence = ai_confidence

    flood_level = classify(water_level_m)

    return {
        "success":           True,
        "water_level_m":     water_level_m,
        "flood_level":       flood_level,
        "waterline_pixel_y": waterline_y,
        "confidence":        round(confidence, 3),
        "roi": {
            "top":    roi_top,
            "bottom": roi_bottom,
            "left":   roi_left,
            "right":  roi_right,
        },
    }

def annotate_frame(frame, result):
    annotated = frame.copy()
    h, w      = frame.shape[:2]

    roi = result.get("roi", {})
    cv2.rectangle(
        annotated,
        (roi.get("left", 0),  roi.get("top", 0)),
        (roi.get("right", w), roi.get("bottom", h)),
        (200, 200, 0), 1
    )

    if result["success"]:
        y          = result["waterline_pixel_y"]
        level      = result["flood_level"]
        color      = LEVEL_COLORS_BGR.get(level, (255, 255, 255))
        water_m    = result["water_level_m"]
        confidence = result["confidence"]

        cv2.line(annotated, (0, y), (w, y), color, 3)

        cv2.rectangle(annotated, (10, 10), (520, 85), (0, 0, 0), -1)
        cv2.rectangle(annotated, (10, 10), (520, 85), color, 2)

        cv2.putText(annotated,
                    f"{level} LEVEL",
                    (20, 42),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

        cv2.putText(annotated,
                    f"Water: {water_m:.2f} meters    Confidence: {confidence:.0%}",
                    (20, 72),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)

        cv2.line(annotated,
                 (w - 20, BASELINE_PIXEL_Y),
                 (w, BASELINE_PIXEL_Y),
                 (150, 150, 150), 1)
        cv2.putText(annotated,
                    f"{BASELINE_METERS:.1f}m baseline",
                    (w - 180, BASELINE_PIXEL_Y - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (150, 150, 150), 1)

    else:
        cv2.rectangle(annotated, (10, 10), (700, 60), (0, 0, 0), -1)
        cv2.rectangle(annotated, (10, 10), (700, 60), (0, 0, 200), 2)
        cv2.putText(annotated,
                    f"DETECTION FAILED: {result['reason']}",
                    (18, 42),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 80, 255), 2)

    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(annotated,
                f"Lumban Flood Monitor  |  {ts}  |  Q=quit  S=save",
                (10, h - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (130, 130, 130), 1)

    return annotated

def meter_to_pixel_y(meters, cal, frame_h):
    if "points" in cal and len(cal["points"]) >= 2:
        pts = sorted(cal["points"], key=lambda p: p["m"])
        xm = [p["m"] for p in pts]
        yp = [p["px"] for p in pts]
        if meters <= xm[0]:
            slope = (yp[1] - yp[0]) / (xm[1] - xm[0]) if (xm[1] - xm[0]) != 0 else 0
            val = yp[0] + slope * (meters - xm[0])
        elif meters >= xm[-1]:
            slope = (yp[-1] - yp[-2]) / (xm[-1] - xm[-2]) if (xm[-1] - xm[-2]) != 0 else 0
            val = yp[-1] + slope * (meters - xm[-1])
        else:
            val = float(np.interp(meters, xm, yp))
        scale = frame_h / 360.0
        return int(max(0, min(frame_h, val * scale)))
    else:
        scale = frame_h / 360.0
        return int(max(0, min(frame_h, (cal.get("baseline_pixel_y", 230) - (meters - cal.get("baseline_meters", 3.869)) * cal.get("px_per_meter", 48.08)) * scale)))

def apply_water_simulation(frame, sim_meters, cal):
    """Overlays semi-transparent simulated floodwater within ROI onto live CCTV frame."""
    out = frame.copy()
    h, w = out.shape[:2]
    roi_cfg = cal.get("roi", {})
    roi_top = int(h * (roi_cfg.get("top_pct", 10.0) / 100.0))
    roi_bottom = int(h * (roi_cfg.get("bottom_pct", 90.0) / 100.0))
    roi_left = int(w * (roi_cfg.get("left_pct", 30.0) / 100.0))
    roi_right = int(w * (roi_cfg.get("right_pct", 70.0) / 100.0))

    sim_y = meter_to_pixel_y(sim_meters, cal, h)
    water_top = max(roi_top, min(roi_bottom, sim_y))

    if water_top < roi_bottom:
        overlay = out.copy()
        # Murky river water tint BGR: (110, 80, 40)
        cv2.rectangle(overlay, (roi_left, water_top), (roi_right, roi_bottom), (110, 80, 40), -1)
        cv2.addWeighted(overlay, 0.65, out, 0.35, 0, out)
        # Foam / ripple line
        cv2.line(out, (roi_left, water_top), (roi_right, water_top), (220, 240, 255), 2)

    return out, water_top

def grab_frame(cap):
    ret, frame = cap.read()
    return frame if ret else None

def main():
    print("")
    print("Detection logic: BOTTOM of LOWEST visible colored band = waterline")
    print("")
    print("Thresholds:")
    for low, high, level in FLOOD_THRESHOLDS:
        print(f"  {level:12s}  {low:.1f}m – {high:.1f}m")
    print("")
    print("Connecting to camera...")

    hls_url = "http://localhost:5001/api/v1/stream/index.m3u8"
    cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    cap.set(cv2.CAP_PROP_FPS, 30)

    if not cap.isOpened():
        print(f"[Stream] Direct RTSP busy/unavailable. Falling back to Backend HLS Stream: {hls_url}")
        cap = cv2.VideoCapture(hls_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        print("ERROR: Cannot connect to camera or HLS stream.")
        return

    print("Camera connected!")
    print("Press Q to quit, S to save frame, F to toggle Fullscreen, M to toggle Simulation Mode.")
    print("")

    cv2.namedWindow("Lumban Flood Monitor", cv2.WINDOW_NORMAL)
    is_fullscreen = False
    is_simulation = False
    sim_level_m   = 2.00

    while True:
        frame = grab_frame(cap)

        if frame is None:
            print("Frame grab failed — reconnecting...")
            cap.release()
            cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            cap.set(cv2.CAP_PROP_FPS, 30)
            continue

        if is_simulation:
            sim_frame, _ = apply_water_simulation(frame, sim_level_m, CAL)
            result = {
                "success": True,
                "water_level_m": sim_level_m,
                "flood_level": classify(sim_level_m),
                "waterline_pixel_y": meter_to_pixel_y(sim_level_m, CAL, frame.shape[0]),
                "confidence": 0.99,
                "roi": {
                    "top": int(frame.shape[0] * (CAL.get("roi", {}).get("top_pct", 10.0) / 100.0)),
                    "bottom": int(frame.shape[0] * (CAL.get("roi", {}).get("bottom_pct", 90.0) / 100.0)),
                    "left": int(frame.shape[1] * (CAL.get("roi", {}).get("left_pct", 30.0) / 100.0)),
                    "right": int(frame.shape[1] * (CAL.get("roi", {}).get("right_pct", 70.0) / 100.0)),
                },
            }
            annotated = annotate_frame(sim_frame, result)
            cv2.putText(annotated, f"[SIMULATION MODE: {sim_level_m:.2f}m] Press 1-4 for Presets, +/- to Adjust",
                        (10, annotated.shape[0] - 32), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)
        else:
            result    = detect_waterline(frame)
            annotated = annotate_frame(frame, result)

        if result["success"]:
            mode_tag = "[SIM] " if is_simulation else ""
            print(
                f"[{datetime.now().strftime('%H:%M:%S')}]  {mode_tag}"
                f"Water: {result['water_level_m']:.3f}m  |  "
                f"Status: {result['flood_level']:12s}  |  "
                f"Confidence: {result['confidence']:.0%}"
            )
        else:
            print(
                f"[{datetime.now().strftime('%H:%M:%S')}]  "
                f"FAILED — {result['reason']}"
            )

        cv2.imshow("Lumban Flood Monitor", annotated)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('f'):
            is_fullscreen = not is_fullscreen
            prop = cv2.WINDOW_FULLSCREEN if is_fullscreen else cv2.WINDOW_NORMAL
            cv2.setWindowProperty("Lumban Flood Monitor", cv2.WND_PROP_FULLSCREEN, prop)
        elif key == ord('m'):
            is_simulation = not is_simulation
            print(f"[Mode] Simulation {'ENABLED' if is_simulation else 'DISABLED'}")
        elif key == ord('1') and is_simulation:
            sim_level_m = 2.00 # NORMAL
        elif key == ord('2') and is_simulation:
            sim_level_m = 3.50 # WARNING
        elif key == ord('3') and is_simulation:
            sim_level_m = 5.20 # CRITICAL
        elif key == ord('4') and is_simulation:
            sim_level_m = 6.50 # FLOOD
        elif (key == ord('+') or key == ord('=')) and is_simulation:
            sim_level_m = min(7.00, sim_level_m + 0.10)
        elif (key == ord('-') or key == ord('_')) and is_simulation:
            sim_level_m = max(0.00, sim_level_m - 0.10)
        elif key == ord('s'):
            fname = f"capture_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            cv2.imwrite(fname, annotated)
            print(f"Saved: {fname}")

    cap.release()
    cv2.destroyAllWindows()
    print("Detection stopped.")

if __name__ == "__main__":
    main()