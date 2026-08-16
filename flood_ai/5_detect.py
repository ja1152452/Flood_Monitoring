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

with open("calibration.json") as f:
    CAL = json.load(f)

RTSP_URL         = CAL["rtsp_url"]
BASELINE_PIXEL_Y = CAL["baseline_pixel_y"]
BASELINE_METERS  = CAL["baseline_meters"]
PX_PER_METER     = CAL["px_per_meter"]

# Colored marker ranges for dry staff gauge bands (ONLY vivid colored bands — white removed to avoid water reflection glare!)
MARKER_RANGES = {
  "purple":   ([115, 30,  30],  [160, 255, 255]),
  "red_low":  ([0,   40,  40],  [15,  255, 255]),
  "red_high": ([155, 40,  40],  [180, 255, 255]),
  "orange":   ([10,  35,  35],  [28,  255, 255]),
  "yellow":   ([14,  35,  35],  [40,  255, 255]),
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
    def __init__(self, window_size=3, max_jump_px=100):
        self.window_size = window_size
        self.max_jump_px = max_jump_px
        self.history_y = deque(maxlen=window_size)
        self.history_m = deque(maxlen=window_size)

    def process(self, raw_y, raw_m):
        self.history_y.append(raw_y)
        self.history_m.append(raw_m)

        smooth_y = int(np.median(self.history_y))
        smooth_m = round(float(np.median(self.history_m)), 3)

        std_y = np.std(self.history_y) if len(self.history_y) > 1 else 0.0
        stability = max(0.75, min(0.98, 1.0 - (std_y / 50.0)))
        return smooth_y, smooth_m, round(stability, 3)

GLOBAL_SMOOTHER = WaterlineSmoother(window_size=5)

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

    # --- 1. AI ENGINE (YOLOv8) ---
    ai_model = get_yolo_model()
    if ai_model is not None:
        try:
            results = ai_model.predict(source=bgr_roi, verbose=False, conf=0.40)
            if results and len(results[0].boxes) > 0:
                boxes = results[0].boxes
                for box in boxes:
                    cls_id = int(box.cls[0])
                    conf_val = float(box.conf[0])
                    # Class 0: water_surface (Top edge of water box = actual waterline)
                    if cls_id == 0 and conf_val >= 0.40:
                        top_y = int(box.xyxy[0][1])
                        pred_y = roi_top + top_y
                        if pred_y < int(h * 0.92):  # Valid waterline above bottom floor
                            waterline_y = pred_y
                            ai_confidence = conf_val
                            break
        except Exception as err:
            print(f"[AI Predict Warning] {err}")

    # --- 2. FALLBACK: SHADOW-PROOF BOTTOM-UP SATURATION & COLOR DETECTOR ---
    if waterline_y is None:
        hsv_roi = cv2.cvtColor(bgr_roi, cv2.COLOR_BGR2HSV)

        combined_mask = np.zeros((roi_h, roi_w), dtype=np.uint8)
        for name, (lower, upper) in MARKER_RANGES.items():
            combined_mask = cv2.bitwise_or(combined_mask,
                cv2.inRange(hsv_roi, np.array(lower), np.array(upper)))

        # Remove extreme glare
        glare_mask = cv2.inRange(hsv_roi, np.array([0, 0, 240]), np.array([180, 30, 255]))
        combined_mask = cv2.bitwise_and(combined_mask, cv2.bitwise_not(glare_mask))

        kernel = np.ones((5, 5), np.uint8)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN,  kernel)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)

        row_counts = np.sum(combined_mask > 0, axis=1)
        min_band_px = max(5, int(roi_w * 0.18))
        valid_rows = np.where(row_counts >= min_band_px)[0]

        # Detect water surface edge using calibrated water HSV range
        w_range = _cal.get("water_hsv_range", {})
        w_lower = np.array(w_range.get("lower", [0, 10, 33]))
        w_upper = np.array(w_range.get("upper", [176, 255, 255]))
        water_mask = cv2.inRange(hsv_roi, w_lower, w_upper)
        row_water = np.sum(water_mask > 0, axis=1)
        water_rows = np.where(row_water > (roi_w * 0.25))[0]

        # Transparent Water / Sunlight Glare Strategy:
        # If water is transparent or glaring, prioritize bottom-up gauge board marker submersion scanning!
        if len(valid_rows) > 0:
            # Bottom-Up Scanning: The bottom edge of the lowest visible dry marker = exact waterline
            waterline_y = roi_top + int(valid_rows[-1])
        elif len(water_rows) > 0:
            top_water_y = roi_top + int(water_rows[0])
            waterline_y = top_water_y
        else:
            # Saturation transition: find where painted board (S>45) turns to water/glare
            sat = hsv_roi[:, :, 1]
            row_sat = np.mean(sat, axis=1)
            sat_y = 0
            for y in range(len(row_sat) - 1, -1, -1):
                if row_sat[y] > 45:
                    sat_y = y
                    break
            waterline_y = roi_top + sat_y

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
    print("Press Q to quit, S to save frame, F to toggle Fullscreen.")
    print("")

    cv2.namedWindow("Lumban Flood Monitor", cv2.WINDOW_NORMAL)
    is_fullscreen = False

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

        result    = detect_waterline(frame)
        annotated = annotate_frame(frame, result)

        if result["success"]:
            print(
                f"[{datetime.now().strftime('%H:%M:%S')}]  "
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
        elif key == ord('s'):
            fname = f"capture_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            cv2.imwrite(fname, annotated)
            print(f"Saved: {fname}")

    cap.release()
    cv2.destroyAllWindows()
    print("Detection stopped.")

if __name__ == "__main__":
    main()