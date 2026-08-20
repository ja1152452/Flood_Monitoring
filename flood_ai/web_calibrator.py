import os
import sys
import json
import socket
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import numpy as np

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
os.environ["OPENCV_LOG_LEVEL"] = "OFF"

try:
    import cv2
except ImportError:
    print("OpenCV is required. Run: pip3 install opencv-python")
    sys.exit(1)

_DIR = os.path.dirname(os.path.abspath(__file__))
CAL_PATH = os.path.join(_DIR, "calibration.json")

def load_cal():
    if os.path.exists(CAL_PATH):
        with open(CAL_PATH, "r") as f:
            return json.load(f)
    return {}

def save_cal(cal):
    with open(CAL_PATH, "w") as f:
        json.dump(cal, f, indent=2)
    print(f"[SAVED] Updated {CAL_PATH}")

def get_live_frame():
    cal = load_cal()
    backend_url = cal.get("backend_url", "https://flood-monitoring.up.railway.app").rstrip('/')

    # 1. Try fetching live snapshot from Railway backend
    try:
        import requests
        r = requests.get(f"{backend_url}/api/v1/stream/snapshot", timeout=3)
        if r.status_code == 200 and len(r.content) > 1000:
            arr = np.frombuffer(r.content, np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is not None and frame.size > 0:
                cv2.imwrite(os.path.join(_DIR, "test_frame.jpg"), frame)
                return frame
    except Exception:
        pass

    # 2. Check local image candidates
    candidate_images = [
        os.path.join(_DIR, "..", "test_frame.jpg"),
        os.path.join(_DIR, "test_frame.jpg"),
        os.path.join(_DIR, "live_debug_frame.jpg"),
        os.path.join(_DIR, "capture_20260812_211910.jpg"),
    ]
    for img_path in candidate_images:
        if os.path.exists(img_path):
            frame = cv2.imread(img_path)
            if frame is not None and frame.size > 0:
                return frame

    # 3. Try RTSP
    rtsp_url = cal.get("rtsp_url", "")
    if rtsp_url:
        try:
            cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if cap.isOpened():
                for _ in range(3):
                    cap.grab()
                ret, frame = cap.retrieve()
                cap.release()
                if ret and frame is not None and frame.size > 0:
                    cv2.imwrite(os.path.join(_DIR, "test_frame.jpg"), frame)
                    return frame
        except Exception:
            pass

    # 4. Create dummy canvas if all else fails
    blank = np.zeros((720, 1280, 3), dtype=np.uint8)
    cv2.putText(blank, "Camera Offline. Check RTSP URL.", (300, 360), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    return blank

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lumban Flood Monitoring - Web Calibration Tool</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --border: #334155;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --danger: #ef4444;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 20px; min-height: 100vh; }
    .container { max-width: 1400px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 700; color: #60a5fa; }
    .badge { background: #1e3a8a; color: #93c5fd; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; }
    
    .layout { display: grid; grid-template-columns: 1fr 380px; gap: 24px; }
    @media (max-width: 1024px) { .layout { grid-template-columns: 1fr; } }
    
    .canvas-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; }
    .canvas-container { position: relative; width: 100%; max-width: 960px; overflow: hidden; border-radius: 8px; border: 2px solid var(--border); }
    canvas { width: 100%; height: auto; display: block; cursor: crosshair; }
    
    .toolbar { display: flex; gap: 10px; margin-top: 14px; width: 100%; max-width: 960px; justify-content: space-between; }
    .mode-btn { flex: 1; padding: 10px 16px; background: #334155; border: 2px solid transparent; color: white; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .mode-btn.active { background: #2563eb; border-color: #60a5fa; }
    
    .sidebar { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
    .section-title { font-size: 16px; font-weight: 600; color: #93c5fd; margin-bottom: 8px; }
    .step-desc { font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px; }
    
    .points-list { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    .point-item { display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); font-size: 14px; }
    .point-item span { font-weight: 600; }
    .point-delete { color: var(--danger); background: none; border: none; cursor: pointer; font-size: 16px; font-weight: bold; }
    
    .btn { padding: 12px 20px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 15px; }
    .btn-primary { background: var(--primary); color: white; width: 100%; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-success { background: var(--success); color: white; width: 100%; font-size: 16px; }
    .btn-success:hover { filter: brightness(1.1); }
    .btn-secondary { background: #475569; color: white; }
    
    .stats-box { background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid var(--border); font-size: 13px; }
    .stat-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .stat-val { font-weight: 600; color: #38bdf8; }
    
    .toast { position: fixed; bottom: 20px; right: 20px; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: none; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); z-index: 100; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>🌊 Lumban Flood Monitoring — Web Calibration</h1>
        <p style="font-size: 13px; color: var(--text-muted);">Calibrate Water Staff Gauge & AI Detection Box Live in Browser</p>
      </div>
      <div class="badge">Live Edge Mode</div>
    </header>

    <div class="layout">
      <!-- Main Canvas View -->
      <div class="canvas-card">
        <div class="canvas-container" id="container">
          <canvas id="canvas"></canvas>
        </div>
        <div class="toolbar">
          <button class="mode-btn active" id="modeRoiBtn" onclick="setMode('roi')">1️⃣ Draw Detection Box (ROI)</button>
          <button class="mode-btn" id="modePointsBtn" onclick="setMode('points')">2️⃣ Click Height Points</button>
          <button class="btn btn-secondary" onclick="refreshFrame()">🔄 Refresh Frame</button>
        </div>
      </div>

      <!-- Control Sidebar -->
      <div class="sidebar">
        <div>
          <div class="section-title">Step 1: Detection Box (ROI)</div>
          <p class="step-desc">Click and drag a box around the colored gauge pillar. This restricts AI detection to the gauge.</p>
          <div class="stats-box">
            <div class="stat-row"><span>Left:</span> <span class="stat-val" id="roiLeft">0%</span></div>
            <div class="stat-row"><span>Right:</span> <span class="stat-val" id="roiRight">0%</span></div>
            <div class="stat-row"><span>Top:</span> <span class="stat-val" id="roiTop">0%</span></div>
            <div class="stat-row"><span>Bottom:</span> <span class="stat-val" id="roiBottom">0%</span></div>
          </div>
        </div>

        <div>
          <div class="section-title">Step 2: Meter Points Calibration</div>
          <p class="step-desc">Switch to Mode 2. Click directly on the horizontal color band lines on your pillar (from top to bottom):</p>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:12px; color:var(--text-muted);">Points List:</span>
            <button class="btn btn-secondary" style="padding:4px 10px; font-size:12px; background:#ef4444;" onclick="clearAllPoints()">🗑️ Clear All</button>
          </div>
          <div class="points-list" id="pointsList">
            <!-- Dynamic Points -->
          </div>
        </div>

        <div style="margin-top: auto; display: flex; flex-direction: column; gap: 10px;">
          <button class="btn btn-success" onclick="saveCalibration()">💾 Save & Apply Calibration</button>
        </div>
      </div>
    </div>
  </div>

  <div class="toast" id="toast">✓ Calibration saved successfully!</div>

  <script>
    let mode = 'roi'; // 'roi' | 'points'
    let img = new Image();
    let canvas = document.getElementById('canvas');
    let ctx = canvas.getContext('2d');
    
    let isDrawing = false;
    let startX = 0, startY = 0;
    
    let calData = {
      roi: { left_pct: 30, right_pct: 70, top_pct: 10, bottom_pct: 95 },
      points: []
    };

    function setMode(m) {
      mode = m;
      document.getElementById('modeRoiBtn').classList.toggle('active', m === 'roi');
      document.getElementById('modePointsBtn').classList.toggle('active', m === 'points');
      draw();
    }

    async function loadData() {
      try {
        let res = await fetch('/api/calibration');
        calData = await res.json();
        if (!calData.points) calData.points = [];
        if (!calData.roi) calData.roi = { left_pct: 30, right_pct: 70, top_pct: 10, bottom_pct: 95 };
        updateUiStats();
        updatePointsList();
      } catch(e) { console.error(e); }
      refreshFrame();
    }

    function refreshFrame() {
      img.src = '/frame.jpg?t=' + Date.now();
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        draw();
      };
    }

    function draw() {
      if (!img.complete) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const w = canvas.width;
      const h = canvas.height;

      // Draw ROI Box
      if (calData.roi) {
        const x = (calData.roi.left_pct / 100) * w;
        const y = (calData.roi.top_pct / 100) * h;
        const rw = ((calData.roi.right_pct - calData.roi.left_pct) / 100) * w;
        const rh = ((calData.roi.bottom_pct - calData.roi.top_pct) / 100) * h;

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, rw, rh);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.fillRect(x, y, rw, rh);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText('Detection Box (ROI)', x + 6, y + 20);
      }

      // Draw Calibration Points
      if (calData.points) {
        calData.points.forEach((p, idx) => {
          const py = p.px;
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, py);
          ctx.lineTo(w, py);
          ctx.stroke();

          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.arc(w / 2, py, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(w / 2 + 12, py - 12, 80, 22);
          ctx.fillStyle = '#facc15';
          ctx.font = 'bold 15px Inter, sans-serif';
          ctx.fillText(p.m.toFixed(2) + 'm', w / 2 + 16, py + 4);
        });
      }
    }

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      if (mode === 'roi') {
        isDrawing = true;
        startX = x;
        startY = y;
      } else if (mode === 'points') {
        const heightStr = prompt(`Enter real water/meter height at y=${Math.round(y)}px (e.g. 4.0):`);
        if (heightStr && !isNaN(heightStr)) {
          calData.points.push({ px: Math.round(y), m: parseFloat(heightStr) });
          calData.points.sort((a, b) => a.px - b.px);
          updatePointsList();
          draw();
        }
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing || mode !== 'roi') return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const currentX = (e.clientX - rect.left) * scaleX;
      const currentY = (e.clientY - rect.top) * scaleY;

      const minX = Math.min(startX, currentX);
      const maxX = Math.max(startX, currentX);
      const minY = Math.min(startY, currentY);
      const maxY = Math.max(startY, currentY);

      calData.roi = {
        left_pct: parseFloat(((minX / canvas.width) * 100).toFixed(2)),
        right_pct: parseFloat(((maxX / canvas.width) * 100).toFixed(2)),
        top_pct: parseFloat(((minY / canvas.height) * 100).toFixed(2)),
        bottom_pct: parseFloat(((maxY / canvas.height) * 100).toFixed(2))
      };
      updateUiStats();
      draw();
    });

    canvas.addEventListener('mouseup', () => { isDrawing = false; });

    function updateUiStats() {
      if (!calData.roi) return;
      document.getElementById('roiLeft').innerText = calData.roi.left_pct + '%';
      document.getElementById('roiRight').innerText = calData.roi.right_pct + '%';
      document.getElementById('roiTop').innerText = calData.roi.top_pct + '%';
      document.getElementById('roiBottom').innerText = calData.roi.bottom_pct + '%';
    }

    function updatePointsList() {
      const el = document.getElementById('pointsList');
      el.innerHTML = '';
      if (!calData.points || calData.points.length === 0) {
        el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">No points added yet. Switch to Mode 2 to click points.</div>';
        return;
      }
      calData.points.forEach((p, idx) => {
        const item = document.createElement('div');
        item.className = 'point-item';
        item.innerHTML = `
          <span>Height: ${p.m.toFixed(2)}m (y=${p.px}px)</span>
          <button class="point-delete" onclick="deletePoint(${idx})">×</button>
        `;
        el.appendChild(item);
      });
    }

    function deletePoint(idx) {
      calData.points.splice(idx, 1);
      updatePointsList();
      draw();
    }

    function clearAllPoints() {
      if (confirm('Clear all calibration points?')) {
        calData.points = [];
        updatePointsList();
        draw();
      }
    }

    async function saveCalibration() {
      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(calData)
        });
        if (res.ok) {
          const toast = document.getElementById('toast');
          toast.style.display = 'block';
          setTimeout(() => toast.style.display = 'none', 3000);
        }
      } catch(e) { alert('Failed to save: ' + e); }
    }

    window.onload = loadData;
  </script>
</body>
</html>
"""

class CalibratorHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/" or parsed.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))
        elif parsed.path == "/frame.jpg":
            frame = get_live_frame()
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(buf.tobytes())
        elif parsed.path == "/api/calibration":
            cal = load_cal()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(cal).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/save":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body.decode("utf-8"))

            cal = load_cal()
            if "roi" in data:
                cal["roi"] = data["roi"]
            if "points" in data:
                pts = data["points"]
                cal["points"] = pts
                if len(pts) >= 2:
                    px_arr = np.array([p["px"] for p in pts], dtype=float)
                    m_arr  = np.array([p["m"] for p in pts], dtype=float)
                    coeffs = np.polyfit(px_arr, m_arr, 1)
                    a, b = coeffs
                    cal["px_per_meter"] = round(abs(1.0 / a), 4) if a != 0 else 1.0
                    cal["baseline_pixel_y"] = int(px_arr.mean())
                    cal["baseline_meters"] = round(float(np.polyval(coeffs, cal["baseline_pixel_y"])), 4)
            
            save_cal(cal)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()

def main():
    port = 8080
    server_address = ('', port)
    httpd = HTTPServer(server_address, CalibratorHandler)
    local_ip = get_local_ip()
    print("="*60)
    print(" 🌊 LUMBAN FLOOD MONITORING — WEB CALIBRATION SERVER")
    print("="*60)
    print(f" Web UI running! Open this link in your browser:")
    print(f" 👉 http://{local_ip}:{port}")
    print(f" 👉 http://localhost:{port}")
    print("="*60)
    print("Press CTRL + C to stop the calibration server when done.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nCalibration server stopped.")

if __name__ == "__main__":
    main()
