# Complete Master Guide: Flood Monitoring & Emergency Response System
### End-to-End Tutorial for Raspberry Pi, Tapo C310, Railway Cloud Deployment, and HLS Streaming

---

## Table of Contents
1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Hardware & Accessory Checklist](#2-hardware--accessory-checklist)
3. [Part 1: Raspberry Pi Beginner Setup](#part-1-raspberry-pi-beginner-setup)
4. [Part 2: Tapo C310 CCTV & Water Gauge Installation](#part-2-tapo-c310-cctv--water-gauge-installation)
5. [Part 3: Railway.app Cloud Deployment](#part-3-railwayapp-cloud-deployment)
6. [Part 4: Video Streaming Pipeline (RTSP to HLS)](#part-4-video-streaming-pipeline-rtsp-to-hls)
7. [Part 5: OpenCV AI Water Level Detection Setup](#part-5-opencv-ai-water-level-detection-setup)
8. [Part 6: Mobile App Build & Configuration](#part-6-mobile-app-build--configuration)
9. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## 1. System Overview & Architecture

This system monitors flood levels in real-time using computer vision and alerts authorities (MDRRMO) and citizens automatically.

```
┌─────────────────────────┐        RTSP Video        ┌──────────────────────────────┐
│  TP-Link Tapo C310 CCTV │ ───────────────────────> │ Raspberry Pi 4/5 (On-Site)   │
└─────────────────────────┘                          │  ├─ FFmpeg (RTSP -> HLS)     │
                                                     │  └─ OpenCV (7_sender.py AI)   │
                                                     └──────────────┬───────────────┘
                                                                    │
                                                       HTTPS POST /api/readings
                                                                    │
                                                                    ▼
                                                     ┌──────────────────────────────┐
                                                     │  Railway.app Cloud Hosting   │
                                                     │  ├─ PostgreSQL Database      │
                                                     │  ├─ Node.js Backend API      │
                                                     │  └─ React Web Admin Frontend │
                                                     └──────────────┬───────────────┘
                                                                    │
                                                            WebSockets / HTTP
                                                                    │
                                                                    ▼
                                                     ┌──────────────────────────────┐
                                                     │  Mobile App (Expo / Android) │
                                                     └──────────────────────────────┘
```

---

## 2. Hardware & Accessory Checklist

| Item | Specification | Purpose |
| :--- | :--- | :--- |
| **Raspberry Pi** | Raspberry Pi 4 (4GB/8GB) or Pi 5 (4GB/8GB) | On-site edge computing server |
| **CCTV Camera** | TP-Link Tapo C310 Outdoor 3MP Camera | Captures river gauge video |
| **MicroSD Card (Pi)** | 64GB or 128GB **SanDisk High Endurance** | Raspberry Pi OS, DB, & 24/7 video caching |
| **MicroSD Card (Camera)**| 32GB or 64GB High Endurance *(Optional)* | Local camera fallback backup recording |
| **Power Supply** | Official 5V 3A (Pi 4) or 5V 5A (Pi 5) USB-C | Clean power for Raspberry Pi |
| **Cooling** | Armor Aluminum Heatsink Case with Dual Fans | Keeps Pi cool under continuous processing |
| **Junction Box** | IP66 Waterproof Outdoor Enclosure | Protects Tapo camera power/LAN connections |
| **Cable** | Outdoor Cat6 Ethernet Cable | Wired network from Tapo to Router/Pi |
| **UPS Battery** | 12V/5V Mini-UPS | Power backup during storm blackouts |
| **Water Gauge** | E-Gauge / Color-Coded Staff Gauge Board | Physical color reference for OpenCV detection |

---

## Part 1: Raspberry Pi Beginner Setup

### Step 1.1: Flash the SD Card on Windows
1. Download & install **Raspberry Pi Imager** on your Windows laptop from [raspberrypi.com/software](https://www.raspberrypi.com/software/).
2. Insert your 64GB MicroSD card into your laptop.
3. Open Raspberry Pi Imager:
   - **Device**: Select `Raspberry Pi 4` or `Raspberry Pi 5`.
   - **OS**: Select `Raspberry Pi OS (64-bit)`.
   - **Storage**: Select your MicroSD card.
4. Click **Next** -> Choose **Edit Settings** (OS Customization):
   - **Hostname**: `floodpi`
   - **Username**: `pi`
   - **Password**: *(e.g. `flood123`)*
   - **Wireless LAN**: Enter your Wi-Fi Name (SSID) and Password.
   - **Services Tab**: Check **Enable SSH** (Use password authentication).
5. Click **SAVE** -> Click **YES** to write.

### Step 1.2: Connect to the Raspberry Pi over Wi-Fi
1. Insert the MicroSD card into the Raspberry Pi and plug in the power cord.
2. Wait 2 minutes for it to boot and connect to Wi-Fi.
3. On your Windows laptop, open **Command Prompt** (`Win + R`, type `cmd`, press `Enter`).
4. Connect via SSH:
   ```cmd
   ssh pi@floodpi.local
   ```
5. Type `yes` and enter your password. You are now inside the Pi terminal!

### Step 1.3: Install System Programs
Copy and paste this into the Pi terminal:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-opencv python3-pip ffmpeg git nodejs npm
pip3 install requests numpy
```

---

## Part 2: Tapo C310 CCTV & Water Gauge Installation

### Step 2.1: Configure Tapo Camera RTSP Stream
1. Download the **TP-Link Tapo App** on your smartphone and connect the Tapo C310 to your Wi-Fi.
2. Go to **Camera Settings** -> **Advanced Settings** -> **Camera Account**.
3. Create a username and password (e.g. User: `floodadmin`, Pass: `FloodCam2026`).
4. Note down your camera's IP address from the app (e.g. `192.168.1.12`).
5. Your RTSP stream URL is:
   `rtsp://floodadmin:FloodCam2026@192.168.1.12:554/stream2`

### Step 2.2: Mount Camera & Gauge Board
1. Securely mount the water gauge board vertically on the bridge pier/river wall.
2. Mount the Tapo C310 camera facing the gauge board with a clear, unobstructed line of sight.
3. Place power connectors inside an IP66 waterproof junction box.

---

## Part 3: Railway.app Cloud Deployment

### Step 3.1: Provision Database & Deploy Backend
1. Sign up at [Railway.app](https://railway.com/) with GitHub.
2. Click **+ New Project** -> **Provision PostgreSQL**.
3. Click **+ New** -> **GitHub Repo** -> select `Flood-Monitoring-System`.
4. In **Settings** -> **Root Directory**, set to `/flood_monitor/backend`.
5. Add Environment Variables in Railway:
   - `PORT`: `5000`
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `your_secure_random_jwt_secret_key`
6. In **Settings** -> **Networking**, click **Generate Domain** (e.g. `https://flood-backend-production.up.railway.app`).
7. Open Railway terminal for Backend and run: `npm run migrate`.

### Step 3.2: Deploy Web Admin Dashboard
1. Click **+ New** -> **GitHub Repo** -> select `Flood-Monitoring-System`.
2. Set **Root Directory** to `/flood_monitor/frontend`.
3. Add Environment Variables:
   - `VITE_API_BASE_URL`: `https://flood-backend-production.up.railway.app`
   - `VITE_SOCKET_URL`: `https://flood-backend-production.up.railway.app`
4. Under **Networking**, click **Generate Domain** (e.g. `https://flood-web.up.railway.app`).

---

## Part 4: Video Streaming Pipeline (RTSP to HLS)

### Step 4.1: How Video Streaming Operates
1. FFmpeg reads the Tapo RTSP stream: `rtsp://floodadmin:FloodCam2026@192.168.1.12:554/stream2`.
2. FFmpeg slices video into 2-second HTTP Live Streaming chunks (`stream.m3u8` and `.ts` files).
3. The Express backend serves these files via `GET /api/v1/stream/index.m3u8`.
4. The React Frontend plays live video using `hls.js` inside the web browser.

---

## Part 5: OpenCV AI Water Level Detection Setup

On the Raspberry Pi:
```bash
# 1. Download repository
git clone https://github.com/YOUR_GITHUB_USERNAME/Flood-Monitoring-System.git
cd Flood-Monitoring-System/flood_ai

# 2. Configure calibration parameters
nano calibration.json
```

Update `calibration.json`:
```json
{
  "rtsp_url": "rtsp://floodadmin:FloodCam2026@192.168.1.12:554/stream2",
  "baseline_pixel_y": 450,
  "baseline_meters": 0.0,
  "px_per_meter": 220.0
}
```

Run the AI script:
```bash
python3 7_sender.py
```

---

## Part 6: Mobile App Build & Configuration

1. In `flood_monitor/mobile/src/config/api.js`, update your backend endpoint:
   ```javascript
   export const API_URL = 'https://flood-backend-production.up.railway.app/api';
   ```
2. Build the Android APK using Expo:
   ```bash
   cd flood_monitor/mobile
   eas build -p android --profile preview
   ```

---

## Troubleshooting & FAQs

- **Q: My Raspberry Pi won't connect to Wi-Fi.**
  - *Fix*: Double check SSID and password in Raspberry Pi Imager. Ensure you use 2.4GHz Wi-Fi if using older Pi models.
- **Q: Tapo RTSP stream fails or says Connection Refused.**
  - *Fix*: Verify Camera Account was created in Tapo App settings. Test the RTSP URL in VLC media player on your laptop.
- **Q: FFmpeg takes too much CPU on Pi.**
  - *Fix*: Ensure `-c:v copy` flag is enabled so video is copied without heavy CPU re-encoding.
