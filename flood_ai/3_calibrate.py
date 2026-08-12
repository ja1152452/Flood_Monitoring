import cv2
import numpy as np
import json
import os

_DIR     = os.path.dirname(os.path.abspath(__file__))
CAL_FILE = os.path.join(_DIR, "calibration.json")

with open(CAL_FILE) as f:
    _existing = json.load(f)
RTSP_URL = _existing["rtsp_url"]

print("=== Lumban Flood Monitor — Multi-Point Meter Calibration ===")
print("")
print("INSTRUCTIONS:")
print("  Click on points on the ruler/marker where you know the exact meter value.")
print("  After each click, type the real meter reading in the terminal.")
print("  Click at least 2 points (more = more accurate).")
print("  Press ENTER with no input when done.")
print("  Press R to reset all points and start over.")
print("  Press Q to quit without saving.")
print("")

points   = []   # list of (pixel_y, meters)
display_frame = None
clone         = None


def redraw():
    global display_frame
    display_frame = clone.copy()
    h, w = display_frame.shape[:2]
    for i, (py, m) in enumerate(points):
        cv2.circle(display_frame, (w // 2, py), 6, (0, 255, 255), -1)
        cv2.putText(display_frame, f"{m:.2f}m", (w // 2 + 12, py + 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 1)
    if len(points) >= 2:
        sorted_pts = sorted(points, key=lambda p: p[0])
        xp = [p[0] for p in sorted_pts]
        fp = [p[1] for p in sorted_pts]
        baseline_pixel_y = int(np.mean(xp))
        baseline_meters  = float(np.interp(baseline_pixel_y, xp, fp))
        cv2.putText(display_frame,
                    f"Interpolation Active. baseline={baseline_meters:.3f}m @ y={baseline_pixel_y}px",
                    (10, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 255, 100), 1)
    cv2.imshow("Calibration", display_frame)


def click_event(event, x, y, flags, param):
    if event == cv2.EVENT_LBUTTONDOWN:
        print(f"\n  Clicked pixel y={y}")
        val = input("  Enter real meter value at this point (or press ENTER to cancel): ").strip()
        if val == "":
            print("  Cancelled.")
            return
        try:
            meters = float(val)
        except ValueError:
            print("  Invalid number, skipped.")
            return
        points.append((y, meters))
        print(f"  Added: y={y}px → {meters:.2f}m  (total points: {len(points)})")
        redraw()


print("Grabbing frame from camera...")
cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
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

clone         = frame.copy()
display_frame = frame.copy()

cv2.imshow("Calibration", display_frame)
cv2.setMouseCallback("Calibration", click_event)

print("Window opened. Click points on the ruler.")
print("Press S to save, R to reset, Q to quit.")
print("")

while True:
    key = cv2.waitKey(50) & 0xFF

    if key == ord('r'):
        points.clear()
        display_frame = clone.copy()
        cv2.imshow("Calibration", display_frame)
        print("Reset — all points cleared.")

    elif key == ord('s'):
        if len(points) < 2:
            print("Need at least 2 points to save.")
            continue

        px_arr = np.array([p[0] for p in points], dtype=float)
        m_arr  = np.array([p[1] for p in points], dtype=float)
        coeffs = np.polyfit(px_arr, m_arr, 1)
        a, b   = coeffs

        px_per_meter     = abs(1.0 / a) if a != 0 else 1.0
        baseline_pixel_y = int(px_arr.mean())
        baseline_meters  = round(float(np.polyval(coeffs, baseline_pixel_y)), 4)
        
        sorted_points = sorted(points, key=lambda p: p[0])

        config = _existing.copy()
        config.update({
            "rtsp_url":         RTSP_URL,
            "baseline_pixel_y": baseline_pixel_y,
            "baseline_meters":  baseline_meters,
            "px_per_meter":     round(px_per_meter, 4),
            "points":           [{"px": p[0], "m": p[1]} for p in sorted_points]
        })

        with open(CAL_FILE, "w") as f:
            json.dump(config, f, indent=2)

        print("")
        print("=== Saved to calibration.json ===")
        print(f"  Points used:      {len(points)}")
        print(f"  px_per_meter:     {px_per_meter:.4f} (fallback)")
        print(f"  baseline_pixel_y: {baseline_pixel_y} px")
        print(f"  baseline_meters:  {baseline_meters:.4f} m")
        print("")
        print("Point breakdown (Interpolated):")
        xp = [p["px"] for p in config["points"]]
        fp = [p["m"] for p in config["points"]]
        for py, m in sorted(points, key=lambda p: p[1]):
            predicted = float(np.interp(py, xp, fp))
            print(f"  y={py:4d}px  real={m:.2f}m  predicted={predicted:.3f}m  err={predicted-m:+.3f}m")
        break

    elif key == ord('q'):
        print("Quit without saving.")
        break

cv2.destroyAllWindows()
