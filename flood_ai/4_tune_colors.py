import cv2
import numpy as np
import json

print("=== HSV Color Tuner ===")
print("")
print("INSTRUCTIONS:")
print("  Left side  = live camera feed")
print("  Right side = color mask (white = detected, black = ignored)")
print("")
print("  Tune the sliders until ONLY your target color band is white.")
print("  Press S to print the values.")
print("  Press Q to quit.")
print("")
print("  Run this separately for each color:")
print("    Yellow (Monitor), Orange (Alert), Red (Evacuation), Purple (Critical)")
print("")

with open("calibration.json") as f:
    CAL = json.load(f)

print("Grabbing frame from camera...")
cap = cv2.VideoCapture(CAL["rtsp_url"], cv2.CAP_FFMPEG)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

if not cap.isOpened():
    print("ERROR: Cannot connect to camera.")
    exit()

for _ in range(5):
    cap.grab()

ret, frame = cap.retrieve()
cap.release()

if not ret or frame is None:
    print("ERROR: Could not grab frame.")
    exit()

frame_small = cv2.resize(frame, (640, 360))
hsv         = cv2.cvtColor(frame_small, cv2.COLOR_BGR2HSV)

def nothing(x):
    pass

cv2.namedWindow("HSV Tuner", cv2.WINDOW_NORMAL)
cv2.resizeWindow("HSV Tuner", 1280, 400)

cv2.createTrackbar("H Low",  "HSV Tuner", 0,   180, nothing)
cv2.createTrackbar("H High", "HSV Tuner", 180, 180, nothing)
cv2.createTrackbar("S Low",  "HSV Tuner", 0,   255, nothing)
cv2.createTrackbar("S High", "HSV Tuner", 255, 255, nothing)
cv2.createTrackbar("V Low",  "HSV Tuner", 0,   255, nothing)
cv2.createTrackbar("V High", "HSV Tuner", 255, 255, nothing)

saved_ranges = {}

while True:
    hl = cv2.getTrackbarPos("H Low",  "HSV Tuner")
    hh = cv2.getTrackbarPos("H High", "HSV Tuner")
    sl = cv2.getTrackbarPos("S Low",  "HSV Tuner")
    sh = cv2.getTrackbarPos("S High", "HSV Tuner")
    vl = cv2.getTrackbarPos("V Low",  "HSV Tuner")
    vh = cv2.getTrackbarPos("V High", "HSV Tuner")

    lower = np.array([hl, sl, vl])
    upper = np.array([hh, sh, vh])
    mask  = cv2.inRange(hsv, lower, upper)

    mask_bgr = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
    combined = np.hstack([frame_small, mask_bgr])

    cv2.putText(combined,
                f"H:{hl}-{hh}  S:{sl}-{sh}  V:{vl}-{vh}",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    cv2.putText(combined,
                "S=Save values   Q=Quit",
                (10, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)

    cv2.imshow("HSV Tuner", combined)

    key = cv2.waitKey(1) & 0xFF

    if key == ord('s'):
        color_name = input("Enter color name (yellow / orange / red / purple): ").strip().lower()
        saved_ranges[color_name] = {
            "lower": [hl, sl, vl],
            "upper": [hh, sh, vh],
        }
        print(f"  Saved {color_name}: lower=[{hl},{sl},{vl}]  upper=[{hh},{sh},{vh}]")
        print("")
        print("Copy this into 5_detect.py COLOR_RANGES:")
        print(f'  "{color_name}": ([{hl}, {sl}, {vl}], [{hh}, {sh}, {vh}]),')
        print("")

    elif key == ord('q'):
        break

cv2.destroyAllWindows()

if saved_ranges:
    with open("color_ranges.json", "w") as f:
        json.dump(saved_ranges, f, indent=2)
    print("All saved ranges written to color_ranges.json")
    print("")
    print("COPY THESE INTO 5_detect.py COLOR_RANGES section:")
    for name, r in saved_ranges.items():
        lo = r["lower"]
        hi = r["upper"]
        print(f'  "{name}": ([{lo[0]}, {lo[1]}, {lo[2]}], [{hi[0]}, {hi[1]}, {hi[2]}]),')