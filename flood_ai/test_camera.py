import os
import sys
import json
import time
import socket
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
os.environ["OPENCV_LOG_LEVEL"] = "OFF"

try:
    import cv2
    try:
        cv2.setLogLevel(0)
    except Exception:
        pass
except ImportError:
    print("[ERROR] OpenCV (cv2) is not installed. Run: pip3 install opencv-python")
    sys.exit(1)

# Ensure console supports utf-8 safely on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

try:
    import requests
except ImportError:
    print("[ERROR] requests is not installed. Run: pip3 install requests")
    sys.exit(1)

_DIR = os.path.dirname(os.path.abspath(__file__))
CAL_PATH = os.path.join(_DIR, "calibration.json")

def load_calibration():
    if os.path.exists(CAL_PATH):
        with open(CAL_PATH, "r") as f:
            return json.load(f)
    return {}

def save_calibration(cal):
    with open(CAL_PATH, "w") as f:
        json.dump(cal, f, indent=2)
    print(f"[CONFIG] Updated {CAL_PATH} successfully.")

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def scan_port(ip, port=554, timeout=0.4):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        result = s.connect_ex((ip, port))
        s.close()
        return ip if result == 0 else None
    except Exception:
        return None

def find_rtsp_devices_on_network():
    local_ip = get_local_ip()
    if local_ip == "127.0.0.1":
        return []
    
    parts = local_ip.split(".")
    subnet_prefix = f"{parts[0]}.{parts[1]}.{parts[2]}"
    print(f"[SCAN] Scanning subnet {subnet_prefix}.1-254 for RTSP cameras on port 554...")
    
    ips = [f"{subnet_prefix}.{i}" for i in range(1, 255)]
    found = []
    
    with ThreadPoolExecutor(max_workers=50) as executor:
        results = executor.map(lambda ip: scan_port(ip, 554), ips)
        for r in results:
            if r:
                found.append(r)
    return found

def test_rtsp_url(url, timeout_sec=6):
    """Attempt connecting and grabbing a frame via OpenCV."""
    cap = None
    try:
        cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            return False, None
        
        # Grab a few frames to clear buffer
        for _ in range(3):
            cap.grab()
        
        ret, frame = cap.read()
        if ret and frame is not None and frame.size > 0:
            return True, frame
    except Exception:
        pass
    finally:
        if cap is not None:
            try:
                cap.release()
            except Exception:
                pass
    return False, None

def test_railway_backend(backend_url, camera_code, api_key):
    print("\n" + "="*50)
    print(" 🌐 TESTING RAILWAY BACKEND CONNECTIVITY")
    print("="*50)
    print(f"Backend URL : {backend_url}")
    print(f"Camera Code : {camera_code}")
    print(f"Camera Key  : {api_key}")

    # 1. Health check
    try:
        r = requests.get(f"{backend_url}/health", timeout=8)
        if r.status_code == 200:
            print(" [✓] Railway Backend is ONLINE and responding to /health")
        else:
            print(f" [!] Railway Backend returned HTTP {r.status_code} on /health")
    except requests.exceptions.ConnectionError:
        print(f" [✗] Railway Backend UNREACHABLE at {backend_url}. Verify your Railway URL.")
        return False
    except Exception as e:
        print(f" [✗] Error connecting to backend: {e}")
        return False

    # 2. Test Ingest Auth
    try:
        test_payload = {
            "camera_code": camera_code,
            "water_level_m": 0.0,
            "flood_level": "NORMAL",
            "confidence": 1.0,
            "waterline_pixel_y": 700,
            "captured_at": datetime.now(timezone.utc).isoformat()
        }
        r = requests.post(
            f"{backend_url}/api/v1/readings/ingest",
            json=test_payload,
            headers={"X-API-Key": api_key, "bypass-tunnel-reminder": "true"},
            timeout=8
        )
        if r.status_code in [200, 201]:
            print(" [✓] Ingest Authentication SUCCEEDED! (Railway accepted telemetry)")
            return True
        elif r.status_code == 401:
            print(" [✗] 401 Unauthorized from Railway Ingest.")
            print("     -> Either CAMERA_API_KEY is incorrect or camera is not in the database.")
            print("     -> Ensure 'npm run migrate' was run on Railway backend.")
            return False
        else:
            print(f" [!] Ingest returned unexpected code {r.status_code}: {r.text}")
            return False
    except Exception as e:
        print(f" [✗] Ingest test failed: {e}")
        return False

def main():
    print("="*55)
    print(" 📹 LUMBAN FLOOD MONITORING — CAMERA & BACKEND DIAGNOSTIC")
    print("="*55)
    
    cal = load_calibration()
    rtsp_url = cal.get("rtsp_url", "rtsp://Flood_monitoring:FloodCam2026@192.168.1.149:554/stream1")
    backend_url = cal.get("backend_url", "https://flood-monitoring.up.railway.app").rstrip('/')
    camera_code = cal.get("camera_code", "CAM-LUMBAN-01")
    api_key = cal.get("camera_api_key", "Admin@1234")

    print(f"Configured RTSP URL : {rtsp_url}")
    print("\n[1/2] Testing configured camera stream...")
    
    ok, frame = test_rtsp_url(rtsp_url)
    working_url = rtsp_url if ok else None

    if ok:
        print(f"\n [✓] SUCCESS! Camera stream connected!")
        print(f"     Resolution: {frame.shape[1]}x{frame.shape[0]}")
        out_path = os.path.join(_DIR, "test_frame.jpg")
        cv2.imwrite(out_path, frame)
        print(f"     Saved snapshot to: {out_path}")
    else:
        print("\n [✗] Connection failed or 401 Unauthorized on configured URL.")
        print(" [!] Searching for correct camera credentials & network IP...")

        # Extract current host and stream
        user_candidates = ["Flood_monitoring", "FloodMonitoring", "admin"]
        pass_candidates = ["FloodCam2026", "FloodCam2026!", "Admin@1234", "admin", "123456"]
        stream_candidates = ["stream1", "stream2"]
        
        # Extract IP from current URL if present
        curr_ip = None
        if "@" in rtsp_url:
            host_part = rtsp_url.split("@")[1].split("/")[0].split(":")[0]
            curr_ip = host_part

        ip_candidates = []
        if curr_ip:
            ip_candidates.append(curr_ip)
            
        # Discover IPs with port 554 on network
        discovered_ips = find_rtsp_devices_on_network()
        for ip in discovered_ips:
            if ip not in ip_candidates:
                ip_candidates.append(ip)

        print(f"[TEST] Testing {len(ip_candidates)} potential camera IP(s): {ip_candidates}")
        
        found = False
        for ip in ip_candidates:
            if found:
                break
            for u in user_candidates:
                if found:
                    break
                for p in pass_candidates:
                    if found:
                        break
                    for s in stream_candidates:
                        candidate_url = f"rtsp://{u}:{p}@{ip}:554/{s}"
                        sys.stdout.write(f"\r  Trying: rtsp://{u}:***@{ip}:554/{s} ... ")
                        sys.stdout.flush()
                        
                        cand_ok, cand_frame = test_rtsp_url(candidate_url, timeout_sec=3)
                        if cand_ok:
                            sys.stdout.write("FOUND! ✓\n")
                            found = True
                            working_url = candidate_url
                            frame = cand_frame
                            print(f"\n [✓] WORKING STREAM FOUND: {candidate_url}")
                            cal["rtsp_url"] = candidate_url
                            save_calibration(cal)
                            out_path = os.path.join(_DIR, "test_frame.jpg")
                            cv2.imwrite(out_path, frame)
                            print(f"     Saved snapshot to: {out_path}")
                            break
                        else:
                            sys.stdout.write("Failed\n")

        if not found:
            print("\n" + "!"*55)
            print(" [✗] Could not connect to camera RTSP stream automatically.")
            print(" Troubleshooting Checklist:")
            print("  1. In Tapo App -> Settings -> Advanced -> Camera Account:")
            print("     Create/Set Username: FloodMonitoring, Password: FloodCam2026")
            print("  2. In Tapo App -> Settings -> Device Info:")
            print("     Check Camera IP Address and verify Pi & Camera are on same Wi-Fi.")
            print("  3. Reboot the camera (power cycle) to clear any temporary auth lockouts.")
            print("!"*55)

    # Test Railway Backend
    test_railway_backend(backend_url, camera_code, api_key)

    print("\n" + "="*55)
    if working_url:
        print(" 🎉 CAMERA AND SYSTEM ARE READY!")
        print(" To start AI flood detection:")
        print("   python3 flood_ai/7_sender.py")
        print(" To start YouTube live stream:")
        print("   ./start_youtube_stream.sh")
    else:
        print(" ⚠️ Fix camera account credentials in Tapo App and re-run:")
        print("   python3 flood_ai/test_camera.py")
    print("="*55 + "\n")

if __name__ == "__main__":
    main()