import os
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
os.environ["OPENCV_LOG_LEVEL"] = "OFF"
import cv2
import json

_DIR = os.path.dirname(os.path.abspath(__file__))
cal_path = os.path.join(_DIR, "calibration.json")

with open(cal_path) as f:
    cal = json.load(f)

# 1. Check local snapshots first for instant calibration
candidate_images = [
    os.path.join(_DIR, "test_frame.jpg"),
    os.path.join(_DIR, "..", "test_frame.jpg"),
    os.path.join(_DIR, "live_debug_frame.jpg"),
    os.path.join(_DIR, "capture_20260812_211910.jpg"),
]

for img_path in candidate_images:
    if os.path.exists(img_path):
        frame = cv2.imread(img_path)
        if frame is not None and frame.size > 0:
            print(f"[INFO] Loaded snapshot: {os.path.abspath(img_path)}")
            break

# 2. If no local snapshot, try connecting to camera
if frame is None:
    print("Connecting to camera stream...")
    try:
        cap = cv2.VideoCapture(cal.get("rtsp_url", ""), cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if cap.isOpened():
            for _ in range(5):
                cap.grab()
            ret, frame = cap.retrieve()
            cap.release()
    except Exception:
        pass

if frame is None:
    print("ERROR: Could not load any camera frame or snapshot.")
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
