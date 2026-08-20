import os
import json
import socket
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
os.environ["OPENCV_LOG_LEVEL"] = "OFF"

import cv2
import numpy as np

_DIR = os.path.dirname(os.path.abspath(__file__))
CAL_PATH = os.path.join(_DIR, "calibration.json")

def load_calibration():
    if os.path.exists(CAL_PATH):
        with open(CAL_PATH, "r") as f:
            return json.load(f)
    return {}

def save_calibration(data):
    cal = load_calibration()
    cal.update(data)
    with open(CAL_PATH, "w") as f:
        json.dump(cal, f, indent=2)
    print(f"[SUCCESS] Saved updated calibration to {CAL_PATH}")

def grab_camera_frame():
    cal = load_calibration()
    rtsp_url = cal.get("rtsp_url", "")
    
    # 1. Try RTSP
    if rtsp_url:
        try:
            cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if cap.isOpened():
                for _ in range(5):
                    cap.grab()
                ret, frame = cap.retrieve()
                cap.release()
                if ret and frame is not None and frame.size > 0:
                    cv2.imwrite(os.path.join(_DIR, "test_frame.jpg"), frame)
                    return frame
        except Exception as e:
            print(f"[WARN] RTSP frame grab failed: {e}")
    
    # 2. Fallback to local snapshot
    snap_path = os.path.join(_DIR, "test_frame.jpg")
    if os.path.exists(snap_path):
        frame = cv2.imread(snap_path)
        if frame is not None:
            return frame
            
    # 3. Create dummy frame if nothing else
    dummy = np.zeros((720, 1280, 3), dtype=np.uint8)
    cv2.putText(dummy, "Camera Stream Offline", (400, 360), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
    return dummy

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lumban Flood Monitor — Visual Calibration</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --accent: #f59e0b;
      --danger: #ef4444;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 340px; gap: 20px; }
    header { grid-column: 1 / -1; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    h1 { font-size: 1.5rem; color: #60a5fa; }
    .card { background: var(--card); border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    
    .canvas-container { position: relative; width: 100%; overflow: hidden; border-radius: 8px; border: 2px solid #475569; background: #000; }
    canvas { display: block; width: 100%; cursor: crosshair; }
    
    .controls { display: flex; flex-direction: column; gap: 16px; }
    .btn { background: var(--primary); color: #fff; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn:hover { background: var(--primary-hover); }
    .btn-success { background: var(--success); }
    .btn-success:hover { background: #059669; }
    .btn-outline { background: transparent; border: 1px solid #475569; }
    .btn-outline:hover { background: #334155; }
    .btn-danger { background: var(--danger); }
    .btn-danger:hover { background: #dc2626; }
    
    .mode-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #0f172a; padding: 4px; border-radius: 8px; }
    .mode-btn { background: transparent; color: var(--text-muted); border: none; padding: 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .mode-btn.active { background: var(--primary); color: #fff; }
    
    .points-list { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
    .point-item { display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 8px 12px; border-radius: 6px; font-size: 0.9rem; }
    .point-item span { color: #38bdf8; font-weight: 600; }
    .delete-btn { color: var(--danger); background: none; border: none; cursor: pointer; font-size: 1rem; }
    
    .stat-row { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px; }
    .stat-row b { color: var(--text); }
    
    .alert { padding: 12px; border-radius: 8px; font-size: 0.85rem; background: #1e3a8a; color: #93c5fd; border: 1px solid #3b82f6; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>🌊 Lumban Flood Monitoring — Visual Calibration</h1>
        <p style="color: var(--text-muted); font-size: 0.85rem;">Interactive calibration directly on your Raspberry Pi</p>
      </div>
      <button class="btn btn-outline" onclick="fetchNewFrame()">🔄 Refresh Frame</button>
    </header>

    <div class="card">
      <div class="canvas-container">
        <canvas id="calCanvas"></canvas>
      </div>
      <p style="margin-top: 10px; font-size: 0.85rem; color: var(--text-muted);" id="instructionText">
        💡 <b>Step 1:</b> Click and drag a box around the colored gauge pillar.
      </p>
    </div>

    <div class="card controls">
      <div>
        <label style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: block; margin-bottom: 6px;">Select Tool Mode</label>
        <div class="mode-toggle">
          <button class="mode-btn active" id="modeRoiBtn" onclick="setMode('roi')">1. Draw Box (ROI)</button>
          <button class="mode-btn" id="modePointsBtn" onclick="setMode('points')">2. Set Meter Points</button>
        </div>
      </div>

      <div id="roiStats" style="background: #0f172a; padding: 12px; border-radius: 8px;">
        <div class="stat-row"><span>Left:</span><b id="valLeft">0%</b></div>
        <div class="stat-row"><span>Right:</span><b id="valRight">0%</b></div>
        <div class="stat-row"><span>Top:</span><b id="valTop">0%</b></div>
        <div class="stat-row"><span>Bottom:</span><b id="valBottom">0%</b></div>
      </div>

      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <label style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Calibrated Points</label>
          <button style="background: none; border: none; color: var(--danger); font-size: 0.75rem; cursor: pointer;" onclick="clearPoints()">Clear All</button>
        </div>
        <div class="points-list" id="pointsList">
          <!-- Dynamic points -->
        </div>
      </div>

      <div class="alert" id="statusAlert">
        Draw your gauge box, then switch to <b>Set Meter Points</b> to click bottom/color bands.
      </div>

      <button class="btn btn-success" style="width: 100%; padding: 14px; font-size: 1rem;" onclick="saveConfig()">
        💾 Save Calibration to Pi
      </button>
    </div>
  </div>

  <script>
    const canvas = document.getElementById('calCanvas');
    const ctx = canvas.getContext('2d');
    
    let currentMode = 'roi'; // 'roi' or 'points'
    let img = new Image();
    let imgLoaded = false;
    
    let roi = { left_pct: 30, right_pct: 60, top_pct: 10, bottom_pct: 95 };
    let points = []; // [{ px: y, m: meters }]
    let isDrawing = false;
    let startX = 0, startY = 0;

    function init() {
      fetch('/api/config')
        .then(r => r.json())
        .then(data => {
          if (data.roi) roi = data.roi;
          if (data.points) points = data.points;
          updateUI();
          fetchNewFrame();
        });
    }

    function fetchNewFrame() {
      img = new Image();
      img.onload = () => {
        imgLoaded = true;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        render();
      };
      img.src = '/api/frame.jpg?t=' + Date.now();
    }

    function setMode(mode) {
      currentMode = mode;
      document.getElementById('modeRoiBtn').classList.toggle('active', mode === 'roi');
      document.getElementById('modePointsBtn').classList.toggle('active', mode === 'points');
      
      const instr = document.getElementById('instructionText');
      if (mode === 'roi') {
        instr.innerHTML = '💡 <b>Step 1 (ROI Box):</b> Click and drag a rectangle over the colored gauge pillar.';
      } else {
        instr.innerHTML = '💡 <b>Step 2 (Meter Points):</b> Click points along the gauge (ground, color bands) and type the meter height.';
      }
      render();
    }

    function render() {
      if (!imgLoaded) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const w = canvas.width;
      const h = canvas.height;

      // Draw ROI Box
      const rx = (roi.left_pct / 100) * w;
      const ry = (roi.top_pct / 100) * h;
      const rw = ((roi.right_pct - roi.left_pct) / 100) * w;
      const rh = ((roi.bottom_pct - roi.top_pct) / 100) * h;

      // Darken outside ROI
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, w, ry);
      ctx.fillRect(0, ry + rh, w, h - (ry + rh));
      ctx.fillRect(0, ry, rx, rh);
      ctx.fillRect(rx + rw, ry, w - (rx + rw), rh);

      // ROI Border
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('GAUGE DETECTION AREA (ROI)', rx + 8, ry + 24);

      // Draw Meter Points
      points.forEach((p, i) => {
        const py = p.px;
        ctx.beginPath();
        ctx.arc(w / 2, py, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`${p.m.toFixed(2)}m`, (w / 2) + 14, py + 6);
        
        ctx.beginPath();
        ctx.moveTo(rx, py);
        ctx.lineTo(rx + rw, py);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Canvas Events
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      if (currentMode === 'roi') {
        isDrawing = true;
        startX = x;
        startY = y;
      } else if (currentMode === 'points') {
        const meterVal = prompt(`Enter real-world meter value for clicked pixel (y=${Math.round(y)}px):\\n(e.g., 0.0, 3.1, 4.0, 5.0, 6.0)`);
        if (meterVal !== null && meterVal.trim() !== '') {
          const num = parseFloat(meterVal);
          if (!isNaN(num)) {
            points.push({ px: Math.round(y), m: num });
            points.sort((a, b) => b.px - a.px); // bottom up
            updateUI();
            render();
          }
        }
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing || currentMode !== 'roi') return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const curX = (e.clientX - rect.left) * scaleX;
      const curY = (e.clientY - rect.top) * scaleY;

      const minX = Math.min(startX, curX);
      const maxX = Math.max(startX, curX);
      const minY = Math.min(startY, curY);
      const maxY = Math.max(startY, curY);

      roi.left_pct = parseFloat(((minX / canvas.width) * 100).toFixed(2));
      roi.right_pct = parseFloat(((maxX / canvas.width) * 100).toFixed(2));
      roi.top_pct = parseFloat(((minY / canvas.height) * 100).toFixed(2));
      roi.bottom_pct = parseFloat(((maxY / canvas.height) * 100).toFixed(2));

      updateUI();
      render();
    });

    canvas.addEventListener('mouseup', () => { isDrawing = false; });

    function updateUI() {
      document.getElementById('valLeft').innerText = roi.left_pct + '%';
      document.getElementById('valRight').innerText = roi.right_pct + '%';
      document.getElementById('valTop').innerText = roi.top_pct + '%';
      document.getElementById('valBottom').innerText = roi.bottom_pct + '%';

      const pList = document.getElementById('pointsList');
      pList.innerHTML = '';
      points.forEach((p, idx) => {
        const item = document.createElement('div');
        item.className = 'point-item';
        item.innerHTML = `
          <div><span>${p.m.toFixed(2)}m</span> <small style="color:#64748b;">(y=${p.px}px)</small></div>
          <button class="delete-btn" onclick="deletePoint(${idx})">✕</button>
        `;
        pList.appendChild(item);
      });
    }

    function deletePoint(idx) {
      points.splice(idx, 1);
      updateUI();
      render();
    }

    function clearPoints() {
      if (confirm('Clear all meter points?')) {
        points = [];
        updateUI();
        render();
      }
    }

    function saveConfig() {
      if (points.length < 2) {
        alert('Please add at least 2 meter calibration points (e.g. 0.0m at bottom and 6.0m at top).');
        setMode('points');
        return;
      }

      const payload = {
        roi: roi,
        points: points,
        baseline_pixel_y: points[0].px,
        baseline_meters: points[0].m,
        px_per_meter: Math.abs((points[points.length-1].px - points[0].px) / (points[points.length-1].m - points[0].m || 1))
      };

      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          document.getElementById('statusAlert').className = 'alert';
          document.getElementById('statusAlert').style.background = '#065f46';
          document.getElementById('statusAlert').style.color = '#a7f3d0';
          document.getElementById('statusAlert').innerHTML = '✅ <b>Calibration saved successfully!</b> You can now start 7_sender.py or the live stream.';
          alert('Calibration saved to calibration.json!');
        }
      });
    }

    init();
  </script>
</body>
</html>
"""

class CalibrationServer(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/" or parsed.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(HTML_TEMPLATE.encode("utf-8"))
        elif parsed.path == "/api/frame.jpg":
            frame = grab_camera_frame()
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(buf.tobytes())
        elif parsed.path == "/api/config":
            cal = load_calibration()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(cal).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/save":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body.decode("utf-8"))
            save_calibration(data)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def main():
    port = 8080
    local_ip = get_local_ip()
    print("=" * 60)
    print(" 🌊 LUMBAN FLOOD MONITOR — WEB CALIBRATION SERVER")
    print("=" * 60)
    print(f" Web UI running at:")
    print(f"   👉 http://{local_ip}:{port}")
    print(f"   👉 http://localhost:{port}")
    print("")
    print(" Open the link above in your laptop browser to calibrate visually!")
    print(" Press CTRL+C to stop the server when done.")
    print("=" * 60)

    server = HTTPServer(("0.0.0.0", port), CalibrationServer)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Calibration server stopped.")

if __name__ == "__main__":
    main()
