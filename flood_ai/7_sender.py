import cv2
import time
import threading
import requests
import csv
import os
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
import json
import numpy as np
from datetime import datetime, timezone

_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(_DIR, "calibration.json")) as f:
    CAL = json.load(f)

RTSP_URL         = CAL["rtsp_url"]
BASELINE_PIXEL_Y = CAL["baseline_pixel_y"]
BASELINE_METERS  = CAL["baseline_meters"]
PX_PER_METER     = CAL["px_per_meter"]

MARKER_RANGES = {
  "white":    ([0,   0,   160], [180, 45,  255]),
  "yellow":   ([18,  80,  70],  [38,  255, 255]),
  "orange":   ([8,   90,  70],  [18,  255, 255]),
  "red_low":  ([0,   80,  60],  [8,   255, 255]),
  "red_high": ([165, 80,  60],  [180, 255, 255]),
  "purple":   ([120, 50,  50],  [158, 255, 255]),
}

WATER_RANGE = ([0, 0, 30], [180, 80, 180])

FLOOD_BASELINE = 2.135  # Current raw reading when dry, subtracted to make 0.0m = no water

FLOOD_THRESHOLDS = [
    (0.0,  3.1,  "NORMAL"),
    (3.1,  4.1,  "MONITOR"),
    (4.1,  5.1,  "ALERT"),
    (5.1,  6.1,  "EVACUATION"),
    (6.1,  99.0, "CRITICAL"),
]

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
    with open(os.path.join(_DIR, "calibration.json")) as f:
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

API_URL      = os.environ.get('BACKEND_URL', 'http://localhost:5001')
CAMERA_CODE  = os.environ.get('CAMERA_CODE', 'CAM-LUMBAN-01')
CAMERA_API_KEY = os.environ.get('CAMERA_API_KEY', 'Admin@1234')
INTERVAL     = int(os.environ.get('INTERVAL', '2'))
RTSP_URL_ENV = os.environ.get('RTSP_URL', '')

if RTSP_URL_ENV:
    RTSP_URL = RTSP_URL_ENV
EMAIL        = "mdrrmo@lumban.gov.ph"
PASSWORD     = "Admin@1234"
LOG_FILE     = os.path.join(_DIR, "sender_log.csv")

def get_token():
    r = requests.post(f"{API_URL}/api/v1/auth/login", json={
        "email":    EMAIL,
        "password": PASSWORD,
    }, timeout=10)
    r.raise_for_status()
    token = r.json()["data"]["accessToken"]
    print(f"[Auth] Logged in successfully")
    return token

def annotate_frame(frame, result):
    out = frame.copy()
    h, w = out.shape[:2]
    roi  = result.get('roi', {})

    # ROI box
    cv2.rectangle(out,
        (roi.get('left', 0),  roi.get('top', 0)),
        (roi.get('right', w), roi.get('bottom', h)),
        (255, 255, 0), 1)

    # Waterline
    wy = result['waterline_pixel_y']
    cv2.line(out, (0, wy), (w, wy), (0, 255, 255), 2)

    # Label
    label = f"{result['water_level_m']:.3f}m  {result['flood_level']}  {result['confidence']:.0%}"
    cv2.rectangle(out, (8, 8), (len(label) * 9 + 12, 30), (0, 0, 0), -1)
    cv2.putText(out, label, (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)

    return out


def send_snapshot(frame, camera_api_key):
    _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    try:
        requests.post(
            f"{API_URL}/api/v1/stream/snapshot",
            data=buf.tobytes(),
            headers={'Content-Type': 'image/jpeg', 'X-API-Key': camera_api_key},
            timeout=5,
        )
    except Exception:
        pass  # snapshot is best-effort


def send_reading(reading, camera_api_key):
    r = requests.post(
        f"{API_URL}/api/v1/readings/ingest",
        json={
            "camera_code":       CAMERA_CODE,
            "water_level_m":     float(reading["water_level_m"]),
            "flood_level":       reading["flood_level"],
            "waterline_pixel_y": int(reading["waterline_pixel_y"]),
            "confidence":        float(reading["confidence"]),
            "captured_at":       datetime.now(timezone.utc).isoformat(),
        },
        headers={"X-API-Key": camera_api_key},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()

def write_log(result, api_success, error=""):
    file_exists = os.path.exists(LOG_FILE)
    with open(LOG_FILE, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "timestamp","water_level_m","flood_level",
            "confidence","api_success","error"
        ])
        if not file_exists:
            writer.writeheader()
        writer.writerow({
            "timestamp":     datetime.now().isoformat(),
            "water_level_m": result.get("water_level_m",""),
            "flood_level":   result.get("flood_level",""),
            "confidence":    result.get("confidence",""),
            "api_success":   api_success,
            "error":         error,
        })

class _FrameReader:
    """Background thread that continuously drains the RTSP buffer,
    always keeping only the latest frame."""
    def __init__(self, url):
        self._cap   = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self._cap.set(cv2.CAP_PROP_FPS, 30)
        self._frame = None
        self._lock  = threading.Lock()
        self._ok    = self._cap.isOpened()
        if self._ok:
            threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        while True:
            ret, frame = self._cap.read()
            if ret:
                with self._lock:
                    self._frame = frame
            else:
                break

    def get(self):
        with self._lock:
            return self._frame

    @property
    def opened(self):
        return self._ok

    def release(self):
        self._cap.release()


def main():
    print("=== Lumban Flood Monitor — Live Sender ===")
    print(f"Sending to: {API_URL}")
    print(f"Camera: {CAMERA_CODE}")
    print(f"Interval: {INTERVAL}s")
    print("")

    print("Connecting to camera...")
    reader = _FrameReader(RTSP_URL)

    if not reader.opened:
        print("ERROR: Cannot connect to camera")
        return

    print("Camera connected.")
    print("")

    reading_count = 0

    while True:
        start = time.monotonic()

        frame = reader.get()

        if frame is None:
            time.sleep(0.1)
        else:
            result = detect_waterline(frame)
            reading_count += 1

            if result["success"]:
                annotated = annotate_frame(frame, result)
                send_snapshot(annotated, CAMERA_API_KEY)
                try:
                    api_response = send_reading(result, CAMERA_API_KEY)
                    write_log(result, True)
                    print(
                        f"[{datetime.now().strftime('%H:%M:%S')}] "
                        f"#{reading_count:04d} "
                        f"Water: {result['water_level_m']:.3f}m | "
                        f"Status: {result['flood_level']:12s} | "
                        f"Confidence: {result['confidence']:.0%} | "
                        f"✓ Sent to API"
                    )
                except requests.exceptions.ConnectionError:
                    write_log(result, False, "API unreachable")
                    print(
                        f"[{datetime.now().strftime('%H:%M:%S')}] "
                        f"#{reading_count:04d} "
                        f"Water: {result['water_level_m']:.3f}m | "
                        f"Status: {result['flood_level']:12s} | "
                        f"✗ API unreachable — logged locally"
                    )
                except Exception as e:
                    write_log(result, False, str(e))
                    print(
                        f"[{datetime.now().strftime('%H:%M:%S')}] "
                        f"#{reading_count:04d} "
                        f"✗ API error: {e}"
                    )
            else:
                write_log({}, False, result["reason"])
                print(
                    f"[{datetime.now().strftime('%H:%M:%S')}] "
                    f"#{reading_count:04d} "
                    f"Detection failed — {result['reason']}"
                )

        elapsed = time.monotonic() - start
        time.sleep(max(0, INTERVAL - elapsed))

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("")
        print("Sender stopped.")