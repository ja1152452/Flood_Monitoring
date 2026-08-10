import cv2

RTSP_URL = "rtsp://FloodMonitoring:FloodCam2026@192.168.1.12:554/stream2"

print("Connecting to camera...")
cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)

if not cap.isOpened():
    print("ERROR: Cannot connect to camera.")
    print("Check: camera is on, IP is correct, camera account credentials are correct")
    exit()

print("Connected! Grabbing frame...")

for _ in range(5):
    cap.grab()

ret, frame = cap.retrieve()

if not ret or frame is None:
    print("ERROR: Could not read frame from camera.")
    exit()

print(f"Frame captured successfully! Size: {frame.shape}")

cv2.imwrite("test_frame.jpg", frame)
print("Saved test_frame.jpg — open it to confirm the image is clear")

cap.release()