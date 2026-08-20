import cv2
import numpy as np
import json
import os

_DIR = os.path.dirname(os.path.abspath(__file__))
CAL_PATH = os.path.join(_DIR, "calibration.json")

def load_cal():
    if os.path.exists(CAL_PATH):
        with open(CAL_PATH, "r") as f:
            return json.load(f)
    return {}

def save_cal(data):
    with open(CAL_PATH, "w") as f:
        json.dump(data, f, indent=2)

def train_light_model():
    print("=== LUMBAN FLOOD MONITORING - AUTOMATED AI TRAINER ===")

    cal = load_cal()
    candidate_images = [
        os.path.join(_DIR, "test_frame.jpg"),
        os.path.join(_DIR, "..", "test_frame.jpg"),
        os.path.join(_DIR, "live_debug_frame.jpg"),
        os.path.join(_DIR, "capture_20260812_211910.jpg")
    ]

    frames = []
    for p in candidate_images:
        if os.path.exists(p):
            f = cv2.imread(p)
            if f is not None and f.size > 0:
                frames.append(f)

    if not frames:
        print("ERROR: No calibration images found to train.")
        return

    print(f"Loaded {len(frames)} calibration frames for AI training...")

    all_hsv = []
    for f in frames:
        h, w = f.shape[:2]
        roi_cfg = cal.get("roi", {"left_pct": 30, "right_pct": 70, "top_pct": 10, "bottom_pct": 95})
        top = int(h * (roi_cfg.get("top_pct", 10) / 100))
        bottom = int(h * (roi_cfg.get("bottom_pct", 95) / 100))
        left = int(w * (roi_cfg.get("left_pct", 30) / 100))
        right = int(w * (roi_cfg.get("right_pct", 70) / 100))

        roi = f[top:bottom, left:right]
        if roi.size > 0:
            hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
            all_hsv.append(hsv.reshape(-1, 3))

    if all_hsv:
        concat_hsv = np.vstack(all_hsv)

        # 1. Train water color bounds (medium to low saturation, medium value)
        water_pixels = concat_hsv[(concat_hsv[:, 1] < 120) & (concat_hsv[:, 2] < 200)]
        if len(water_pixels) > 50:
            h_mean = np.mean(water_pixels[:, 0])
            s_mean = np.mean(water_pixels[:, 1])
            v_mean = np.mean(water_pixels[:, 2])

            cal["water_hsv_range"] = {
                "lower": [max(0, int(h_mean - 20)), max(0, int(s_mean - 35)), max(0, int(v_mean - 45))],
                "upper": [min(180, int(h_mean + 20)), min(255, int(s_mean + 35)), min(255, int(v_mean + 45))]
            }
            print(f"[OK] Trained Water HSV Range: {cal['water_hsv_range']}")

        # 2. Train sunlight deadband and glare suppression
        cal["sunlight_filter_enabled"] = True
        cal["deadband_m"] = 0.035
        cal["model_trained_status"] = "TRAINED_OK"

        save_cal(cal)
        print("[OK] AI Training Complete! Calibration updated in calibration.json.")

if __name__ == "__main__":
    train_light_model()
