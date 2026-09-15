import cv2
import json
import os
import numpy as np

cal_path = 'flood_ai/calibration.json'
with open(cal_path) as f:
    cal = json.load(f)

img = cv2.imread('flood_ai/test_frame.jpg')
if img is None:
    print("Cannot read test_frame.jpg")
    exit(1)

h, w = img.shape[:2]
roi = cal['roi']
left = int(w * roi['left_pct'] / 100)
right = int(w * roi['right_pct'] / 100)
top = int(h * roi['top_pct'] / 100)
bottom = int(h * roi['bottom_pct'] / 100)

print(f"Frame resolution: {w}x{h}")
print(f"ROI pixel boundaries: Left={left}, Right={right}, Top={top}, Bottom={bottom}")
print(f"ROI width={right - left}px ({roi['right_pct'] - roi['left_pct']:.1f}%), height={bottom - top}px ({roi['bottom_pct'] - roi['top_pct']:.1f}%)")

print("\n--- Calibration Points ---")
pts = sorted(cal['points'], key=lambda p: p['px'])
for p in pts:
    print(f"  {p['m']}m -> Y={p['px']}px")

xp = [p['px'] for p in pts]
fp = [p['m'] for p in pts]

# Slopes
slope_top = (fp[1] - fp[0]) / (xp[1] - xp[0])
slope_bottom = (fp[-1] - fp[-2]) / (xp[-1] - xp[-2])

# Extrapolations
m_at_top_roi = fp[0] + slope_top * (top - xp[0])
m_at_frame_top = fp[0] + slope_top * (0 - xp[0])
m_at_bottom_roi = fp[-1] + slope_bottom * (bottom - xp[-1])
m_at_frame_bottom = fp[-1] + slope_bottom * (h - xp[-1])

px_for_2m = xp[-1] + (2.0 - fp[-1]) / slope_bottom
px_for_7m = xp[0] + (7.0 - fp[0]) / slope_top

print("\n--- Physical & Metric Range Analysis ---")
print(f"Top of frame (Y=0): ~{m_at_frame_top:.2f} meters")
print(f"Top of ROI (Y={top}): ~{m_at_top_roi:.2f} meters")
print(f"Highest calibrated point (Y={pts[0]['px']}): {pts[0]['m']} meters")
print(f"Lowest calibrated point (Y={pts[-1]['px']}): {pts[-1]['m']} meters")
print(f"Bottom of ROI (Y={bottom}): ~{m_at_bottom_roi:.2f} meters")
print(f"Bottom of frame (Y={h}): ~{m_at_frame_bottom:.2f} meters")

print(f"\nTarget 2.0m pixel position: {px_for_2m:.1f}px")
print(f"Target 7.0m pixel position: {px_for_7m:.1f}px")

# Check if points are inside ROI
print("\n--- Blind Spot Checks ---")
blind_spots = []

if top > pts[0]['px']:
    blind_spots.append(f"CRITICAL HIGH BLIND SPOT: 7.0m point is at Y={pts[0]['px']}px, but ROI starts at Y={top}px! Water levels between {m_at_top_roi:.2f}m and 7.0m are outside the ROI top.")
else:
    print(f"  [OK] Top coverage: ROI starts at Y={top}px (supports up to ~{m_at_top_roi:.2f}m), above 7.0m point (Y={pts[0]['px']}px).")

if bottom < px_for_2m:
    blind_spots.append(f"CRITICAL LOW BLIND SPOT: 2.0m (Normal level baseline) is at Y={px_for_2m:.1f}px, but ROI cuts off at Y={bottom}px (~{m_at_bottom_roi:.2f}m)! Water between 2.0m and {m_at_bottom_roi:.2f}m will hit the bottom of the ROI.")
else:
    print(f"  [OK] Bottom coverage: ROI reaches Y={bottom}px (~{m_at_bottom_roi:.2f}m), which covers 2.0m (Y={px_for_2m:.1f}px).")

if px_for_2m > h:
    blind_spots.append(f"CAMERA ANGLE BLIND SPOT: 2.0m point (Y={px_for_2m:.1f}px) is below the physical bottom of the camera frame (h={h}px). The camera needs to tilt down slightly to see 2.0m.")

# Check detection logic constraints
with open('flood_ai/7_sender.py') as f:
    sender_code = f.read()

if "if pred_y < int(h * 0.95)" in sender_code:
    cutoff_y = int(h * 0.95)
    print(f"  AI Detector hardcoded clamp: Y < {cutoff_y}px ({cutoff_y/h*100:.1f}%)")

print("\nIdentified Potential Blind Spots:")
for b in blind_spots:
    print(f"  - {b}")
