import os
import glob
import shutil
import json
import cv2
import numpy as np

_DIR = os.path.dirname(os.path.abspath(__file__))
CAL_FILE = os.path.join(_DIR, "calibration.json")
DATASET_ROOT = os.path.join(_DIR, "dataset")

TRAIN_IMG = os.path.join(DATASET_ROOT, "images", "train")
VAL_IMG   = os.path.join(DATASET_ROOT, "images", "val")
TRAIN_LBL = os.path.join(DATASET_ROOT, "labels", "train")
VAL_LBL   = os.path.join(DATASET_ROOT, "labels", "val")

os.makedirs(TRAIN_IMG, exist_ok=True)
os.makedirs(VAL_IMG, exist_ok=True)
os.makedirs(TRAIN_LBL, exist_ok=True)
os.makedirs(VAL_LBL, exist_ok=True)

def generate_data_yaml():
    yaml_path = os.path.join(DATASET_ROOT, "data.yaml")
    content = f"""path: {os.path.abspath(DATASET_ROOT)}
train: images/train
val: images/val

names:
  0: water_surface
  1: gauge_board
"""
    with open(yaml_path, "w") as f:
        f.write(content)
    print(f"[OK] Generated {yaml_path}")

def generate_yolo_label(img, cal_data):
    h, w = img.shape[:2]
    roi = cal_data.get("roi", {"left_pct": 28.59, "right_pct": 40.31, "top_pct": 0.65, "bottom_pct": 89.63})
    
    top = (roi["top_pct"] / 100.0)
    bot = (roi["bottom_pct"] / 100.0)
    left = (roi["left_pct"] / 100.0)
    right = (roi["right_pct"] / 100.0)

    # Detect exact waterline using saturation detector
    top_px = int(h * top)
    bot_px = int(h * bot)
    left_px = int(w * left)
    right_px = int(w * right)
    
    bgr_roi = img[top_px:bot_px, left_px:right_px]
    hsv_roi = cv2.cvtColor(bgr_roi, cv2.COLOR_BGR2HSV)
    sat = hsv_roi[:, :, 1]
    row_sat = np.mean(sat, axis=1)
    
    waterline_in_roi = len(row_sat) - 1
    for y in range(len(row_sat) - 1, -1, -1):
        if row_sat[y] > 45:
            waterline_in_roi = y
            break
            
    waterline_y_px = top_px + waterline_in_roi
    split_norm = waterline_y_px / float(h)
    
    # Class 1: Gauge Board (From top of ROI to waterline)
    gb_x = (left + right) / 2.0
    gb_y = (top + split_norm) / 2.0
    gb_w = (right - left)
    gb_h = max(0.01, split_norm - top)
    
    # Class 0: Water Surface (From waterline to bottom of ROI)
    ws_x = (left + right) / 2.0
    ws_y = (split_norm + bot) / 2.0
    ws_w = (right - left)
    ws_h = max(0.01, bot - split_norm)

    labels = [
        f"1 {gb_x:.6f} {gb_y:.6f} {gb_w:.6f} {gb_h:.6f}",
        f"0 {ws_x:.6f} {ws_y:.6f} {ws_w:.6f} {ws_h:.6f}"
    ]
    return "\n".join(labels)

def prepare_dataset():
    if os.path.exists(CAL_FILE):
        with open(CAL_FILE, "r") as f:
            cal = json.load(f)
    else:
        cal = {}

    generate_data_yaml()

    # Collect source images
    sources = glob.glob(os.path.join(_DIR, "capture_*.jpg"))
    raw_sources = glob.glob(os.path.join(DATASET_ROOT, "raw_images", "*.jpg"))
    all_images = sources + raw_sources

    if not all_images:
        print("No images found to build dataset!")
        return

    print(f"Found {len(all_images)} total images for dataset preparation.")

    np.random.shuffle(all_images)
    split_idx = max(1, int(len(all_images) * 0.8))

    train_files = all_images[:split_idx]
    val_files   = all_images[split_idx:]

    for file_list, target_img_dir, target_lbl_dir in [
        (train_files, TRAIN_IMG, TRAIN_LBL),
        (val_files, VAL_IMG, VAL_LBL)
    ]:
        for img_path in file_list:
            base_name = os.path.splitext(os.path.basename(img_path))[0]
            dest_img = os.path.join(target_img_dir, f"{base_name}.jpg")
            dest_lbl = os.path.join(target_lbl_dir, f"{base_name}.txt")

            shutil.copy(img_path, dest_img)

            img = cv2.imread(img_path)
            if img is not None:
                labels_str = generate_yolo_label(img, cal)
                with open(dest_lbl, "w") as f:
                    f.write(labels_str)

    print(f"[OK] Dataset prepared successfully!")
    print(f"  Train samples: {len(train_files)}")
    print(f"  Val samples  : {len(val_files)}")

if __name__ == "__main__":
    prepare_dataset()
