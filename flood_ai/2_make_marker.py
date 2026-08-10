import cv2
import numpy as np

print("=== Generating Lumban Water Level Marker ===")

HEIGHT = 700
WIDTH  = 200

img = np.ones((HEIGHT, WIDTH, 3), dtype=np.uint8) * 240

bands = [
    ([180, 0,   180], 0,   140),
    ([0,   0,   200], 140, 280),
    ([0,   100, 255], 280, 420),
    ([0,   200, 255], 420, 560),
    ([200, 200, 200], 560, 700),
]

for color, y_start, y_end in bands:
    img[y_start:y_end, :] = color
    img[y_start:y_start + 3, :] = [255, 255, 255]

font       = cv2.FONT_HERSHEY_SIMPLEX
font_scale = 0.38
thickness  = 1
text_color = (30, 30, 30)

labels = [
    ("CRITICAL",    "6.1 - 7.0m", 0,   140),
    ("EVACUATION",  "5.1 - 6.0m", 140, 280),
    ("ALERT",       "4.1 - 5.0m", 280, 420),
    ("MONITOR",     "3.1 - 4.0m", 420, 560),
    ("NORMAL",      "2.0 - 3.0m", 560, 700),
]

for level, meters, y_start, y_end in labels:
    center_y = (y_start + y_end) // 2

    level_size = cv2.getTextSize(level, font, font_scale, thickness)[0]
    level_x    = (WIDTH - level_size[0]) // 2
    cv2.putText(img, level, (level_x, center_y - 8), font, font_scale, text_color, thickness)

    meter_size = cv2.getTextSize(meters, font, font_scale - 0.05, thickness)[0]
    meter_x    = (WIDTH - meter_size[0]) // 2
    cv2.putText(img, meters, (meter_x, center_y + 12), font, font_scale - 0.05, text_color, thickness)

cv2.imwrite("lumban_marker.png", img)

print("")
print("lumban_marker.png has been saved!")
print("")
print("FLOOD LEVEL COLORS:")
print("  Purple    = CRITICAL    (6.1 - 7.0m)")
print("  Red       = EVACUATION  (5.1 - 6.0m)")
print("  Orange    = ALERT       (4.1 - 5.0m)")
print("  Yellow    = MONITOR     (3.1 - 4.0m)")
print("  White     = NORMAL      (2.0 - 3.0m)")
print("")
print("NEXT STEPS:")
print("  1. Open lumban_marker.png")
print("  2. Display it fullscreen on a monitor OR print it on paper")
print("  3. Point your camera at it clearly")
print("  4. Make sure the full marker is visible in the camera frame")
print("  5. Run 1_test_camera.py again to confirm marker is in frame")
print("  6. Then run 3_calibrate.py")