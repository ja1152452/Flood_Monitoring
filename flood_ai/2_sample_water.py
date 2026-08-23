import cv2
import numpy as np
import json
import os

CALIBRATION_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "calibration.json")

def load_calibration():
    if os.path.exists(CALIBRATION_FILE):
        with open(CALIBRATION_FILE, "r") as f:
            return json.load(f)
    return {}

def save_calibration(data):
    with open(CALIBRATION_FILE, "w") as f:
        json.dump(data, f, indent=2)
    print(f"\n✓ Saved water HSV range to {CALIBRATION_FILE}")

clicked_hsv = []
display_frame = None
hsv_frame = None

def mouse_callback(event, x, y, flags, param):
    global clicked_hsv, display_frame, hsv_frame
    if event == cv2.EVENT_LBUTTONDOWN:
        if hsv_frame is not None:
            # Sample a 9x9 neighborhood around the click point
            h, w = hsv_frame.shape[:2]
            y1 = max(0, y - 4)
            y2 = min(h, y + 5)
            x1 = max(0, x - 4)
            x2 = min(w, x + 5)
            
            patch = hsv_frame[y1:y2, x1:x2]
            avg_hsv = np.mean(patch, axis=(0, 1))
            clicked_hsv.append(avg_hsv)
            
            # Draw point indicator on display frame
            cv2.circle(display_frame, (x, y), 6, (0, 255, 255), -1)
            cv2.circle(display_frame, (x, y), 8, (0, 0, 0), 2)
            cv2.putText(display_frame, f"Sample #{len(clicked_hsv)}", (x + 12, y + 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)
            cv2.imshow("Sample Water Color - Click on Water Surface", display_frame)

def main():
    global display_frame, hsv_frame
    cal = load_calibration()
    rtsp_url = cal.get("rtsp_url", "rtsp://Flood_monitoring:FloodCam2026@192.168.0.112:554/stream1")

    print("=== Lumban Flood Monitor — Interactive Water Color Sampler ===")
    print("Connecting to camera stream...")
    cap = cv2.VideoCapture(rtsp_url)
    
    if not cap.isOpened():
        print(f"Error: Could not connect to {rtsp_url}")
        return

    ret, frame = cap.read()
    cap.release()

    if not ret or frame is None:
        print("Error: Failed to grab frame from camera.")
        return

    display_frame = frame.copy()
    
    # Enhanced LAB CLAHE for matching 5_detect.py pipeline
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    enhanced_bgr = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR)
    hsv_frame = cv2.cvtColor(enhanced_bgr, cv2.COLOR_BGR2HSV)

    cv2.namedWindow("Sample Water Color - Click on Water Surface", cv2.WINDOW_NORMAL)
    cv2.setMouseCallback("Sample Water Color - Click on Water Surface", mouse_callback)

    print("\nINSTRUCTIONS:")
    print("  1. Click 2-3 times directly on the water surface (dark/muddy water).")
    print("  2. Press 'S' to SAVE the sampled water color to calibration.json.")
    print("  3. Press 'R' to RESET samples.")
    print("  4. Press 'Q' to Quit without saving.\n")

    while True:
        # Show instruction bar overlay
        overlay = display_frame.copy()
        cv2.rectangle(overlay, (0, 0), (display_frame.shape[1], 45), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.7, display_frame, 0.3, 0, display_frame)
        
        status_text = f"Samples: {len(clicked_hsv)} | Press 'S' to Save | 'R' to Reset | 'Q' to Quit"
        cv2.putText(display_frame, status_text, (20, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        cv2.imshow("Sample Water Color - Click on Water Surface", display_frame)
        key = cv2.waitKey(30) & 0xFF

        if key == ord('s') or key == ord('S'):
            if not clicked_hsv:
                print("No water samples collected yet! Click on the water surface first.")
                continue

            samples = np.array(clicked_hsv)
            min_hsv = np.min(samples, axis=0)
            max_hsv = np.max(samples, axis=0)

            # Apply safe tolerances around the sampled water color
            h_min = max(0, int(min_hsv[0] - 15))
            h_max = min(180, int(max_hsv[0] + 15))

            s_min = max(0, int(min_hsv[1] - 40))
            s_max = min(255, int(max_hsv[1] + 40))

            v_min = max(0, int(min_hsv[2] - 50))
            v_max = min(255, int(max_hsv[2] + 50))

            hsv_range = {
                "lower": [h_min, s_min, v_min],
                "upper": [h_max, s_max, v_max]
            }

            cal["water_hsv_range"] = hsv_range
            save_calibration(cal)

            print(f"Sampled Water HSV Range:")
            print(f"  Lower: {hsv_range['lower']}")
            print(f"  Upper: {hsv_range['upper']}")
            print("\nYou can now run 'python 5_detect.py' or 'python 7_sender.py'!")
            break

        elif key == ord('r') or key == ord('R'):
            clicked_hsv.clear()
            display_frame = frame.copy()
            print("Samples reset. Click on the water surface again.")

        elif key == ord('q') or key == ord('Q'):
            print("Quit without saving.")
            break

    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
