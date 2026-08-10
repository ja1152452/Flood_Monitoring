import os
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
import cv2
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

# Colored marker ranges for reference
MARKER_RANGES = {
  "white":    ([0,   0,   160], [180, 45,  255]),
  "yellow":   ([18,  80,  70],  [38,  255, 255]),
  "orange":   ([8,   90,  70],  [18,  255, 255]),
  "red_low":  ([0,   80,  60],  [8,   255, 255]),
  "red_high": ([165, 80,  60],  [180, 255, 255]),
  "purple":   ([120, 50,  50],  [158, 255, 255]),
}

# Actual water color detection - adjusted for clearer water
WATER_RANGE = ([0, 0, 30], [180, 80, 180])

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
    for low, high, level in FLOOD_THRESHOLDS:
        if low <= water_level_m < high:
            return level
    return "CRITICAL"

from collections import deque

class WaterlineSmoother:
    def __init__(self, window_size=15, max_jump_px=35):
        self.window_size = window_size
        self.max_jump_px = max_jump_px
        self.history_y = deque(maxlen=window_size)
        self.history_m = deque(maxlen=window_size)

    def process(self, raw_y, raw_m):
        if self.history_y:
            current_median_y = np.median(self.history_y)
            if abs(raw_y - current_median_y) > self.max_jump_px and len(self.history_y) >= 5:
                raw_y = current_median_y + np.sign(raw_y - current_median_y) * self.max_jump_px

        self.history_y.append(raw_y)
        self.history_m.append(raw_m)

        smooth_y = int(np.median(self.history_y))
        smooth_m = round(float(np.median(self.history_m)), 3)
        std_y = np.std(self.history_y) if len(self.history_y) > 1 else 0.0
        stability = max(0.75, min(0.98, 1.0 - (std_y / 50.0)))
        return smooth_y, smooth_m, round(stability, 3)

GLOBAL_SMOOTHER = WaterlineSmoother(window_size=15)

def detect_waterline(frame, use_clahe=True, smoother=GLOBAL_SMOOTHER):
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "calibration.json")) as f:
        _cal = json.load(f)
    BASELINE_PIXEL_Y = _cal["baseline_pixel_y"]
    BASELINE_METERS  = _cal["baseline_meters"]
    PX_PER_METER     = _cal["px_per_meter"]

    h, w = frame.shape[:2]

    roi_cfg    = _cal.get("roi", {})
    roi_top    = int(h * (roi_cfg.get("top_pct", 10.0) / 100.0))
    roi_bottom = int(h * (roi_cfg.get("bottom_pct", 90.0) / 100.0))
    roi_left   = int(w * (roi_cfg.get("left_pct", 30.0) / 100.0))
    roi_right  = int(w * (roi_cfg.get("right_pct", 70.0) / 100.0))

    bgr_roi = frame[roi_top:roi_bottom, roi_left:roi_right]

    if use_clahe:
        lab = cv2.cvtColor(bgr_roi, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        enhanced_bgr = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR)
        hsv_roi = cv2.cvtColor(enhanced_bgr, cv2.COLOR_BGR2HSV)
    else:
        hsv_roi = cv2.cvtColor(bgr_roi, cv2.COLOR_BGR2HSV)

    roi_h, roi_w = hsv_roi.shape[:2]

    # Detect colored markers
    combined_mask = np.zeros(hsv_roi.shape[:2], dtype=np.uint8)
    for name, (lower, upper) in MARKER_RANGES.items():
        mask = cv2.inRange(hsv_roi, np.array(lower), np.array(upper))
        combined_mask = cv2.bitwise_or(combined_mask, mask)

    kernel = np.ones((5, 5), np.uint8)
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    waterline_y = None
    if contours:
        min_area = roi_h * roi_w * 0.01
        significant = [c for c in contours if cv2.contourArea(c) > min_area]

        if significant:
            lowest_bottom_y = 0
            for c in significant:
                x, y, bw, bh = cv2.boundingRect(c)
                bottom_y = y + bh
                if bottom_y > lowest_bottom_y:
                    lowest_bottom_y = bottom_y
            waterline_y = roi_top + lowest_bottom_y

    if waterline_y is None:
        return {"success": False, "reason": "No markers detected"}

    if "points" in _cal and len(_cal["points"]) >= 2:
        pts = sorted(_cal["points"], key=lambda p: p["px"])
        xp = [p["px"] for p in pts]
        fp = [p["m"] for p in pts]
        if waterline_y < xp[0]:
            slope = (fp[1] - fp[0]) / (xp[1] - xp[0])
            val = fp[0] + slope * (waterline_y - xp[0])
        elif waterline_y > xp[-1]:
            slope = (fp[-1] - fp[-2]) / (xp[-1] - xp[-2])
            val = fp[-1] + slope * (waterline_y - xp[-1])
        else:
            val = float(np.interp(waterline_y, xp, fp))
        raw_water_level_m = round(val, 3)
    else:
        pixel_delta   = BASELINE_PIXEL_Y - waterline_y
        water_level_raw = BASELINE_METERS + (pixel_delta / PX_PER_METER)
        raw_water_level_m = max(0.0, round(water_level_raw - FLOOD_BASELINE, 3))

    if smoother is not None:
        smooth_y, smooth_m, confidence = smoother.process(waterline_y, raw_water_level_m)
        waterline_y = smooth_y
        water_level_m = smooth_m
    else:
        water_level_m = raw_water_level_m
        confidence = 0.88

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

    cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    cap.set(cv2.CAP_PROP_FPS, 30)

    if not cap.isOpened():
        print("ERROR: Cannot connect to camera.")
        return

    print("Camera connected!")
    print("Press Q to quit, S to save frame.")
    print("")

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
        elif key == ord('s'):
            fname = f"capture_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            cv2.imwrite(fname, annotated)
            print(f"Saved: {fname}")

    cap.release()
    cv2.destroyAllWindows()
    print("Detection stopped.")

if __name__ == "__main__":
    main()