import os
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
os.environ["OPENCV_LOG_LEVEL"] = "OFF"
import cv2
try:
    cv2.setLogLevel(0)
except Exception:
    pass
import time
import threading
import requests
import csv
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

def classify(water_level_m):
    if water_level_m < 3.1:
        return "NORMAL"
    for low, high, level in FLOOD_THRESHOLDS:
        if low <= water_level_m < high:
            return level
    return "CRITICAL"

from collections import deque

class WaterlineSmoother:
    def __init__(self, window_size=11, deadband_m=0.035, max_jump_px=120):
        self.window_size = window_size
        self.deadband_m = deadband_m  # Ignore jitter < 3.5cm unless sustained
        self.max_jump_px = max_jump_px
        self.history_y = deque(maxlen=window_size)
        self.history_m = deque(maxlen=window_size)
        self.last_stable_m = None
        self.last_stable_y = None

    def process(self, raw_y, raw_m):
        self.history_y.append(raw_y)
        self.history_m.append(raw_m)

        # Median filter removes sunlight glare spikes
        median_y = int(np.median(self.history_y))
        median_m = round(float(np.median(self.history_m)), 3)

        if self.last_stable_m is None:
            self.last_stable_m = median_m
            self.last_stable_y = median_y

        # Deadband / Hysteresis Filter: If change < 3.5cm, hold previous stable reading
        if abs(median_m - self.last_stable_m) < self.deadband_m:
            smooth_m = self.last_stable_m
            smooth_y = self.last_stable_y
        else:
            # Sustained movement above 3.5cm -> update smoothly
            alpha = 0.35  # Exponential moving average factor
            smooth_m = round(self.last_stable_m * (1 - alpha) + median_m * alpha, 3)
            smooth_y = int(self.last_stable_y * (1 - alpha) + median_y * alpha)
            self.last_stable_m = smooth_m
            self.last_stable_y = smooth_y

        std_y = np.std(self.history_y) if len(self.history_y) > 1 else 0.0
        stability = max(0.85, min(0.99, 1.0 - (std_y / 60.0)))
        return smooth_y, smooth_m, round(stability, 3)

GLOBAL_SMOOTHER = WaterlineSmoother(window_size=11, deadband_m=0.035)

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

    # --- 2. FALLBACK: SUNLIGHT-PROOF SATURATION BOUNDARY DETECTOR ---
    if waterline_y is None:
        hsv_roi = cv2.cvtColor(bgr_roi, cv2.COLOR_BGR2HSV)

        # 1. Mask for vivid staff gauge painted colors (Yellow, Orange, Red, Purple)
        gauge_mask = np.zeros((roi_h, roi_w), dtype=np.uint8)
        for name, (lower, upper) in MARKER_RANGES.items():
            gauge_mask = cv2.bitwise_or(gauge_mask,
                cv2.inRange(hsv_roi, np.array(lower), np.array(upper)))

        # Remove extreme sunlight white glare (V > 240, S < 30)
        glare_mask = cv2.inRange(hsv_roi, np.array([0, 0, 235]), np.array([180, 45, 255]))
        gauge_mask = cv2.bitwise_and(gauge_mask, cv2.bitwise_not(glare_mask))

        kernel = np.ones((5, 5), np.uint8)
        gauge_mask = cv2.morphologyEx(gauge_mask, cv2.MORPH_OPEN,  kernel)
        gauge_mask = cv2.morphologyEx(gauge_mask, cv2.MORPH_CLOSE, kernel)

        row_counts = np.sum(gauge_mask > 0, axis=1)
        min_band_px = max(4, int(roi_w * 0.15))
        valid_gauge_rows = np.where(row_counts >= min_band_px)[0]

        if len(valid_gauge_rows) > 0:
            # Bottom-Up Scanning: The lowest row where painted gauge is visible IS the waterline!
            lowest_dry_row = valid_gauge_rows[-1]
            waterline_y = roi_top + int(lowest_dry_row)
        else:
            # Saturation transition: find where painted board (S > 35) transitions to water
            sat = hsv_roi[:, :, 1]
            row_sat = np.mean(sat, axis=1)
            sat_y = roi_h - 1
            for y in range(len(row_sat) - 1, -1, -1):
                if row_sat[y] > 35:
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

API_URL        = os.environ.get('BACKEND_URL', CAL.get('backend_url', 'https://flood-backend-production.up.railway.app')).rstrip('/')
CAMERA_CODE    = os.environ.get('CAMERA_CODE', CAL.get('camera_code', 'CAM-LUMBAN-01'))
CAMERA_API_KEY = os.environ.get('CAMERA_API_KEY', CAL.get('camera_api_key', 'Admin@1234'))
INTERVAL       = int(os.environ.get('INTERVAL', str(CAL.get('interval', 2))))
RTSP_URL_ENV   = os.environ.get('RTSP_URL', '')

if RTSP_URL_ENV:
    RTSP_URL = RTSP_URL_ENV
EMAIL        = CAL.get('admin_email', "mdrrmo@lumban.gov.ph")
PASSWORD     = CAL.get('admin_password', "Admin@1234")
LOG_FILE     = os.path.join(_DIR, "sender_log.csv")

def get_token():
    r = requests.post(f"{API_URL}/api/v1/auth/login", json={
        "email":    EMAIL,
        "password": PASSWORD,
    }, headers={"bypass-tunnel-reminder": "true"}, timeout=10)
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
            headers={'Content-Type': 'image/jpeg', 'X-API-Key': camera_api_key, 'bypass-tunnel-reminder': 'true'},
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
        headers={"X-API-Key": camera_api_key, "bypass-tunnel-reminder": "true"},
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
    """On-demand frame reader that fetches frames without locking RTSP port 554 continuously."""
    def __init__(self, primary_url, fallback_url=None):
        self._primary_url  = primary_url
        self._fallback_url = fallback_url
        self._frame = None
        self._lock  = threading.Lock()
        self._ok    = True
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        while True:
            for url in filter(None, [self._primary_url, self._fallback_url]):
                try:
                    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
                    if cap.isOpened():
                        ret, frame = cap.read()
                        cap.release()
                        if ret and frame is not None:
                            with self._lock:
                                self._frame = frame
                            break
                    else:
                        cap.release()
                except Exception:
                    pass
            time.sleep(2.0)

    def get(self):
        with self._lock:
            return self._frame

    @property
    def opened(self):
        return True

    def release(self):
        pass



def main():
    print("=== Lumban Flood Monitor — Live Sender ===")
    print(f"Sending to: {API_URL}")
    print(f"Camera: {CAMERA_CODE}")
    print(f"Interval: {INTERVAL}s")
    print("")

    hls_stream = f"{API_URL}/api/v1/stream/index.m3u8"
    print("Connecting to camera stream...")
    reader = _FrameReader(RTSP_URL, fallback_url=hls_stream)

    if not reader.opened:
        print("ERROR: Cannot connect to camera or HLS stream")
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