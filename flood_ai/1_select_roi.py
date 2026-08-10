import cv2
import json
import os

_DIR = os.path.dirname(os.path.abspath(__file__))
cal_path = os.path.join(_DIR, "calibration.json")

with open(cal_path) as f:
    cal = json.load(f)

print("=== Lumban Flood Monitor — Interactive ROI Box Selector ===")
print("Connecting to camera stream...")

cap = cv2.VideoCapture(cal["rtsp_url"], cv2.CAP_FFMPEG)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

if not cap.isOpened():
    print("ERROR: Could not connect to camera.")
    exit(1)

for _ in range(5):
    cap.grab()

ret, frame = cap.retrieve()
cap.release()

if not ret or frame is None:
    print("ERROR: Could not grab frame from camera.")
    exit(1)

h, w = frame.shape[:2]
print(f"Captured frame resolution: {w}x{h}")
print("")
print("INSTRUCTIONS:")
print("  1. Click and drag your mouse to draw the Detection Box around the painted bridge pier.")
print("  2. Press ENTER or SPACE to confirm the box.")
print("  3. Press C to cancel.")

cv2.namedWindow("Select ROI - Painted Bridge Pier", cv2.WINDOW_NORMAL)
cv2.resizeWindow("Select ROI - Painted Bridge Pier", 1280, 720)

bbox = cv2.selectROI("Select ROI - Painted Bridge Pier", frame, showCrosshair=True, fromCenter=False)
cv2.destroyAllWindows()

x, y, box_w, box_h = bbox

if box_w > 0 and box_h > 0:
    left_pct = round((x / w) * 100.0, 2)
    right_pct = round(((x + box_w) / w) * 100.0, 2)
    top_pct = round((y / h) * 100.0, 2)
    bottom_pct = round(((y + box_h) / h) * 100.0, 2)

    cal["roi"] = {
        "left_pct": left_pct,
        "right_pct": right_pct,
        "top_pct": top_pct,
        "bottom_pct": bottom_pct
    }

    with open(cal_path, "w") as f:
        json.dump(cal, f, indent=2)

    print("")
    print("✓ Success! Saved Detection Box to calibration.json:")
    print(f"  Left: {left_pct}%  Right: {right_pct}%  Top: {top_pct}%  Bottom: {bottom_pct}%")
    print("")
    print("You can now run 'python 5_detect.py' or 'python 7_sender.py' with your custom box!")
else:
    print("Selection cancelled. No changes saved.")
