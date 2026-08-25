import os
import shutil
from ultralytics import YOLO

_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_YAML = os.path.join(_DIR, "dataset", "data.yaml")
MODEL_SAVE_DIR = os.path.join(_DIR, "models")
os.makedirs(MODEL_SAVE_DIR, exist_ok=True)

def train_model():
    print("=== Training YOLOv12 Flood AI Model ===")
    print(f"Dataset config: {DATA_YAML}")
    print(f"Output directory: {MODEL_SAVE_DIR}\n")

    # Load pretrained YOLOv12 nano model
    model = YOLO("yolo12n.pt")

    # Train model with data augmentations for shadow & lighting invariance
    results = model.train(
        data=DATA_YAML,
        epochs=50,
        imgsz=640,
        batch=4,
        project=MODEL_SAVE_DIR,
        name="water_yolo_train",
        exist_ok=True,
        verbose=True,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        degrees=10.0,
        translate=0.1,
        scale=0.2,
        fliplr=0.5,
        mosaic=1.0,
        deterministic=False
    )

    best_weights = os.path.join(MODEL_SAVE_DIR, "water_yolo_train", "weights", "best.pt")
    target_weights = os.path.join(MODEL_SAVE_DIR, "water_yolo.pt")

    if os.path.exists(best_weights):
        shutil.copy(best_weights, target_weights)
        print(f"\n[OK] AI Model trained successfully!")
        print(f"  Model saved to: {target_weights}")
    else:
        print("\nWarning: Could not find best.pt after training.")

if __name__ == "__main__":
    train_model()
