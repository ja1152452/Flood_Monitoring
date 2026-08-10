import cv2
import time

def test_camera_settings():
    """
    Test current camera settings and show how to fix auto-adjustments
    """
    RTSP_URL = "rtsp://FloodMonitoring:FloodCam2026@192.168.1.12:554/stream2"
    
    print("=== Camera Settings Diagnostic ===")
    print("Connecting to camera...")
    
    cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
    
    if not cap.isOpened():
        print("ERROR: Cannot connect to camera")
        return
    
    print("Camera connected! Checking current settings...")
    
    # Check current camera properties
    settings = {
        'AUTO_EXPOSURE': cv2.CAP_PROP_AUTO_EXPOSURE,
        'EXPOSURE': cv2.CAP_PROP_EXPOSURE,
        'BRIGHTNESS': cv2.CAP_PROP_BRIGHTNESS,
        'CONTRAST': cv2.CAP_PROP_CONTRAST,
        'SATURATION': cv2.CAP_PROP_SATURATION,
        'GAIN': cv2.CAP_PROP_GAIN,
        'WHITE_BALANCE_BLUE_U': cv2.CAP_PROP_WHITE_BALANCE_BLUE_U,
        'WHITE_BALANCE_RED_V': cv2.CAP_PROP_WHITE_BALANCE_RED_V,
        'AUTO_WB': cv2.CAP_PROP_AUTO_WB,
    }
    
    print("\n--- Current Camera Settings ---")
    for name, prop in settings.items():
        value = cap.get(prop)
        print(f"{name:25s}: {value}")
    
    print("\n--- Attempting to Fix Auto-Adjustments ---")
    
    # Try to disable automatic adjustments
    try:
        # Disable auto-exposure (0.25 = manual mode for many cameras)
        cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0.25)
        print("✓ Disabled auto-exposure")
        
        # Set fixed exposure value
        cap.set(cv2.CAP_PROP_EXPOSURE, -6)  # Adjust this value as needed
        print("✓ Set fixed exposure")
        
        # Disable auto white balance
        cap.set(cv2.CAP_PROP_AUTO_WB, 0)
        print("✓ Disabled auto white balance")
        
        # Set fixed white balance values
        cap.set(cv2.CAP_PROP_WHITE_BALANCE_BLUE_U, 4000)
        cap.set(cv2.CAP_PROP_WHITE_BALANCE_RED_V, 4000)
        print("✓ Set fixed white balance")
        
        # Set fixed brightness, contrast, saturation
        cap.set(cv2.CAP_PROP_BRIGHTNESS, 50)
        cap.set(cv2.CAP_PROP_CONTRAST, 50)
        cap.set(cv2.CAP_PROP_SATURATION, 50)
        print("✓ Set fixed brightness/contrast/saturation")
        
    except Exception as e:
        print(f"⚠ Some settings may not be adjustable via software: {e}")
    
    print("\n--- Testing Stability ---")
    print("Capturing frames to test if lighting is now stable...")
    print("Press 'q' to quit, 's' to save frame")
    
    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame")
            continue
            
        frame_count += 1
        
        # Calculate average brightness to monitor changes
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        avg_brightness = gray.mean()
        
        # Display frame with brightness info
        cv2.putText(frame, f"Frame: {frame_count}", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(frame, f"Avg Brightness: {avg_brightness:.1f}", (10, 70), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(frame, "Press Q=quit, S=save", (10, 110), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        cv2.imshow("Camera Settings Test", frame)
        
        # Print brightness every 30 frames
        if frame_count % 30 == 0:
            print(f"Frame {frame_count}: Brightness = {avg_brightness:.1f}")
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s'):
            filename = f"camera_test_frame_{frame_count}.jpg"
            cv2.imwrite(filename, frame)
            print(f"Saved: {filename}")
    
    cap.release()
    cv2.destroyAllWindows()
    print("Test completed.")

if __name__ == "__main__":
    test_camera_settings()