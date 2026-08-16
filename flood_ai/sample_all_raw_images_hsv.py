import glob
import json
import os
import cv2
import numpy as np

_DIR = os.path.dirname(os.path.abspath(__file__))
CAL_FILE = os.path.join(_DIR, "calibration.json")
DATASET_DIR = os.path.join(_DIR, "dataset", "raw_images")

def sample_all_water_colors():
    if os.path.exists(CAL_FILE):
        with open(CAL_FILE, "r") as f:
            cal = json.load(f)
    else:
        cal = {}

    roi = cal.get("roi", {"left_pct": 31.56, "right_pct": 56.09, "top_pct": 11.11, "bottom_pct": 98.52})
    
    images = glob.glob(os.path.join(DATASET_DIR, "*.jpg"))
    if not images:
        print("No images found in raw_images!")
        return

    hsv_samples = []

    for img_path in images:
        img = cv2.imread(img_path)
        if img is None:
            continue
        
        h, w = img.shape[:2]
        
        # Focus on the water portion (bottom 40% of the ROI or bottom of frame)
        left = int(w * (roi["left_pct"] / 100.0))
        right = int(w * (roi["right_pct"] / 100.0))
        top = int(h * (roi["top_pct"] / 100.0))
        bot = int(h * (roi["bottom_pct"] / 100.0))
        
        # Water surface is typically in the lower half of ROI
        water_top = top + int((bot - top) * 0.5)
        
        water_crop = img[water_top:bot, left:right]
        if water_crop.size == 0:
            water_crop = img[int(h * 0.6):h, int(w * 0.2):int(w * 0.8)]
            
        hsv_crop = cv2.cvtColor(water_crop, cv2.COLOR_BGR2HSV)
        
        # Flatten pixels: (N, 3)
        pixels = hsv_crop.reshape(-1, 3)
        hsv_samples.append(pixels)

    if not hsv_samples:
        print("No valid water pixels extracted.")
        return

    all_pixels = np.vstack(hsv_samples)
    
    # Calculate percentiles (5th and 95th) to eliminate outliers/reflections/glare
    h_min, s_min, v_min = np.percentile(all_pixels, 2, axis=0)
    h_max, s_max, v_max = np.percentile(all_pixels, 98, axis=0)
    
    # Format HSV bounds
    lower_hsv = [int(max(0, h_min)), int(max(0, s_min)), int(max(0, v_min))]
    upper_hsv = [int(min(180, h_max)), int(min(255, s_max)), int(min(255, v_max))]
    
    mean_hsv = np.mean(all_pixels, axis=0).astype(int).tolist()
    median_hsv = np.median(all_pixels, axis=0).astype(int).tolist()

    print("=== Water Color HSV Analysis Across All 57 Images ===")
    print(f"Total analyzed water pixels: {len(all_pixels):,}")
    print(f"Mean HSV   : H={mean_hsv[0]}, S={mean_hsv[1]}, V={mean_hsv[2]}")
    print(f"Median HSV : H={median_hsv[0]}, S={median_hsv[1]}, V={median_hsv[2]}")
    print(f"Calculated Water HSV Lower Bound: {lower_hsv}")
    print(f"Calculated Water HSV Upper Bound: {upper_hsv}")

    cal["water_hsv_range"] = {
        "lower": lower_hsv,
        "upper": upper_hsv
    }
    
    with open(CAL_FILE, "w") as f:
        json.dump(cal, f, indent=2)
    print(f"[OK] Updated {CAL_FILE} with full water color range!")

if __name__ == "__main__":
    sample_all_water_colors()
