import cv2
import json
import time
import csv
import os
from datetime import datetime
from detect import detect_waterline, grab_frame, RTSP_URL

print("=== Lumban Flood Monitor — 30 Second Sampler ===")

with open("calibration.json") as f:
    CAL = json.load(f)

INTERVAL_SECONDS = 30
LOG_FILE         = "readings_log.csv"
CSV_HEADERS      = [
    "timestamp",
    "water_level_m",
    "flood_level",
    "waterline_pixel_y",
    "confidence",
    "success",
    "failure_reason",
]

def write_log(result):
    file_exists = os.path.exists(LOG_FILE)
    with open(LOG_FILE, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        if not file_exists:
            writer.writeheader()

        if result["success"]:
            writer.writerow({
                "timestamp":         datetime.now().isoformat(),
                "water_level_m":     result["water_level_m"],
                "flood_level":       result["flood_level"],
                "waterline_pixel_y": result["waterline_pixel_y"],
                "confidence":        result["confidence"],
                "success":           True,
                "failure_reason":    "",
            })
        else:
            writer.writerow({
                "timestamp":         datetime.now().isoformat(),
                "water_level_m":     "",
                "flood_level":       "",
                "waterline_pixel_y": "",
                "confidence":        "",
                "success":           False,
                "failure_reason":    result.get("reason", "Unknown"),
            })

def main():
    print(f"Interval  : every {INTERVAL_SECONDS} seconds")
    print(f"Log file  : {LOG_FILE}")
    print(f"Camera    : {RTSP_URL}")
    print("")
    print("Press CTRL+C to stop.")
    print("")

    cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        print("ERROR: Cannot connect to camera.")
        print("Run 1_test_camera.py first to confirm camera is working.")
        return

    print("Camera connected. Logging started.")
    print("")

    reading_count = 0

    while True:
        start = time.monotonic()

        frame = grab_frame(cap)

        if frame is None:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Frame failed — reconnecting...")
            cap.release()
            time.sleep(3)
            cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        else:
            result = detect_waterline(frame)
            write_log(result)
            reading_count += 1

            if result["success"]:
                print(
                    f"[{datetime.now().strftime('%H:%M:%S')}]  "
                    f"#{reading_count:04d}  "
                    f"Water: {result['water_level_m']:.3f}m  |  "
                    f"Status: {result['flood_level']:12s}  |  "
                    f"Confidence: {result['confidence']:.0%}  |  "
                    f"Logged to {LOG_FILE}"
                )
            else:
                print(
                    f"[{datetime.now().strftime('%H:%M:%S')}]  "
                    f"#{reading_count:04d}  "
                    f"FAILED — {result['reason']}  |  "
                    f"Logged to {LOG_FILE}"
                )

        elapsed = time.monotonic() - start
        sleep   = max(0, INTERVAL_SECONDS - elapsed)

        if sleep > 0:
            time.sleep(sleep)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("")
        print("Sampler stopped by user.")
        print(f"All readings saved to {LOG_FILE}")