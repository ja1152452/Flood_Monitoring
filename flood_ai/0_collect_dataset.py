import cv2
import json
import os
import time
from datetime import datetime

_DIR = os.path.dirname(os.path.abspath(__file__))
CAL_FILE = os.path.join(_DIR, "calibration.json")
DATASET_DIR = os.path.join(_DIR, "dataset", "raw_images")

os.makedirs(DATASET_DIR, exist_ok=True)

def main():
    if os.path.exists(CAL_FILE):
        with open(CAL_FILE, "r") as f:
            cal = json.load(f)
    else:
        cal = {}

    rtsp_url = cal.get("rtsp_url", "rtsp://FloodMonitoring:FloodCam2026@192.168.1.16:554/stream1")

    print("=== Lumban Flood Monitor — Dataset Collector ===")
    print(f"Dataset Output Directory: {DATASET_DIR}")
    print(f"Connecting to RTSP Stream: {rtsp_url}\n")
    print("CONTROLS:")
    print("  [SPACE]  : Snap and save single frame")
    print("  [A]      : Toggle Auto-capture (every 5 seconds)")
    print("  [Q]      : Quit\n")

    cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        print(f"ERROR: Could not connect to {rtsp_url}")
        print("Falling back to local camera / stream check...")
        return

    auto_capture = False
    last_capture_time = 0
    saved_count = 0

    cv2.namedWindow("AI Dataset Collector", cv2.WINDOW_NORMAL)

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            print("Warning: Frame drop. Reconnecting...")
            time.sleep(1)
            continue

        display = frame.copy()
        now = time.time()

        if auto_capture and (now - last_capture_time >= 5.0):
            fname = os.path.join(DATASET_DIR, f"frame_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg")
            cv2.imwrite(fname, frame)
            saved_count += 1
            last_capture_time = now
            print(f"[Auto-Snap #{saved_count}] Saved: {fname}")

        # Overlay HUD
        status = "AUTO-CAP: ON (5s)" if auto_capture else "AUTO-CAP: OFF"
        color = (0, 255, 0) if auto_capture else (0, 165, 255)
        cv2.rectangle(display, (10, 10), (450, 60), (0, 0, 0), -1)
        cv2.putText(display, f"{status} | Saved: {saved_count}", (20, 42),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

        cv2.imshow("AI Dataset Collector", display)
        key = cv2.waitKey(30) & 0xFF

        if key == ord('q') or key == ord('Q'):
            print(f"\nExiting collector. Total frames saved: {saved_count}")
            break
        elif key == 32:  # SPACEBAR
            fname = os.path.join(DATASET_DIR, f"frame_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg")
            cv2.imwrite(fname, frame)
            saved_count += 1
            print(f"[Manual Snap #{saved_count}] Saved: {fname}")
        elif key == ord('a') or key == ord('A'):
            auto_capture = not auto_capture
            last_capture_time = time.time()
            print(f"Auto-capture set to: {auto_capture}")

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
