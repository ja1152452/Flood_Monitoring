# SYSTEM & TECHNICAL ADMINISTRATION MANUAL
### Flood Monitoring & Disaster Response Management System
*(Architecture, Deployment, Edge AI IoT Configuration & Maintenance Guide)*

---

## 📖 Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Server & Development Environment Setup](#2-server--development-environment-setup)
3. [Database Configuration & Migrations](#3-database-configuration--migrations)
4. [Backend API Engine Deployment](#4-backend-api-engine-deployment)
5. [Frontend Web Application Deployment](#5-frontend-web-application-deployment)
6. [Mobile Application Build & Distribution (Expo EAS)](#6-mobile-application-build--distribution-expo-eas)
7. [Edge AI Station Setup (Raspberry Pi & Tapo C310)](#7-edge-ai-station-setup-raspberry-pi--tapo-c310)
8. [Production Cloud Deployment (Railway.app)](#8-production-cloud-deployment-railwayapp)
9. [Backup, Recovery & Database Maintenance](#9-backup-recovery--database-maintenance)
10. [Troubleshooting & Diagnostic Matrix](#10-troubleshooting--diagnostic-matrix)

---

## 1. System Architecture Overview

The system operates on a distributed, resilient three-tier architecture:

```
┌─────────────────────────┐         RTSP Stream         ┌──────────────────────────────┐
│  TP-Link Tapo C310 CCTV │ ──────────────────────────> │   Raspberry Pi 4/5 Edge      │
│  (Outdoor 3MP Camera)   │                             │  ├─ FFmpeg (RTSP -> HLS)     │
└─────────────────────────┘                             │  └─ OpenCV / YOLO (7_sender) │
                                                        └──────────────┬───────────────┘
                                                                       │
                                                            HTTPS POST /api/readings
                                                                       │
                                                                       ▼
                                                        ┌──────────────────────────────┐
                                                        │   Railway Cloud Server       │
                                                        │  ├─ Node.js / Express API    │
                                                        │  ├─ PostgreSQL Database      │
                                                        │  ├─ Socket.io WebSocket Hub  │
                                                        │  └─ Vite / React Admin Web   │
                                                        └──────────────┬───────────────┘
                                                                       │
                                                           WebSockets / HTTPS REST
                                                                       │
                                                                       ▼
                                                        ┌──────────────────────────────┐
                                                        │   ResQConnect Mobile App     │
                                                        │   (React Native / Expo APK)  │
                                                        └──────────────────────────────┘
```

---

## 2. Server & Development Environment Setup

### 2.1 Software Prerequisites
Install the following dependencies on the host server or administrator workstation:
* **Node.js:** `v20.x LTS` or higher (Verify with `node -v`)
* **npm:** `v10.x` or higher (Verify with `npm -v`)
* **PostgreSQL:** `v15.x` or `v16.x` (Verify with `psql --version`)
* **Python:** `v3.10.x` or `v3.11.x` (Verify with `python --version`)
* **Git:** Latest version (Verify with `git --version`)
* **Docker & Docker Compose:** Optional for containerized deployments.

### 2.2 Cloning the Repository
```bash
git clone https://github.com/ja1152452/Flood_Monitoring.git
cd Flood_Monitoring
```

---

## 3. Database Configuration & Migrations

### 3.1 PostgreSQL Database Provisioning
1. Access the PostgreSQL command line shell:
   ```bash
   psql -U postgres
   ```
2. Create the production database and privileged user:
   ```sql
   CREATE DATABASE floodmonitor_db;
   CREATE USER flood_admin WITH ENCRYPTED PASSWORD 'YourSecurePassword123!';
   GRANT ALL PRIVILEGES ON DATABASE floodmonitor_db TO flood_admin;
   \q
   ```

### 3.2 Running Schema Migrations
1. Navigate to the backend directory:
   ```bash
   cd flood_monitor/backend
   ```
2. Execute the automated migration script:
   ```bash
   npm run migrate
   ```
3. The migration script executes `src/config/migrate.js`, constructing the relational tables, custom enumerations (`user_role`, `flood_status`, `sos_status`), triggers, and audit log tables.

---

## 4. Backend API Engine Deployment

### 4.1 Installing Backend Dependencies
```bash
cd flood_monitor/backend
npm install
```

### 4.2 Environment Configuration (`.env`)
Create a `.env` file in `flood_monitor/backend/` using the following schema:
```env
# Server Network Settings
PORT=5000
NODE_ENV=production

# PostgreSQL Database Connection URL
DATABASE_URL=postgresql://flood_admin:YourSecurePassword123!@localhost:5432/floodmonitor_db

# JWT Security Secrets
JWT_SECRET=super_secret_jwt_key_random_string_change_in_production
JWT_EXPIRES_IN=7d

# CORS Allowed Origins
CORS_ORIGIN=http://localhost:5173,https://your-domain.railway.app

# Firebase Service Account (For Push Notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyHere\n-----END PRIVATE KEY-----\n"

# Weather API
OPENWEATHER_API_KEY=your_openweather_api_key
```

### 4.3 Starting the Backend Engine
* **Development Mode (with auto-reload):**
  ```bash
  npm run dev
  ```
* **Production Mode:**
  ```bash
  npm start
  ```
* Verify server status by requesting health check: `curl http://localhost:5000/api/health`

---

## 5. Frontend Web Application Deployment

### 5.1 Installing Frontend Dependencies
```bash
cd flood_monitor/frontend
npm install
```

### 5.2 Environment Configuration (`.env.production`)
Create a `.env.production` file in `flood_monitor/frontend/`:
```env
VITE_API_URL=https://your-backend-api.railway.app
VITE_SOCKET_URL=https://your-backend-api.railway.app
VITE_MAP_TILES_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

### 5.3 Building for Production
Compile the optimized static bundle:
```bash
npm run build
```
The compiled output is generated in `flood_monitor/frontend/dist/` ready to be served via Nginx, Apache, or Railway static hosting.

---

## 6. Mobile Application Build & Distribution (Expo EAS)

### 6.1 Prerequisites
Install the Expo Application Services (EAS) command-line interface globally:
```bash
npm install -g eas-cli
```

### 6.2 Configuring EAS Build
Navigate to the mobile directory and log in to your Expo account:
```bash
cd flood_monitor/mobile
eas login
eas build:configure
```

### 6.3 Generating the Standalone Release APK
Run the cloud build command to produce an installable Android APK:
```bash
eas build -p android --profile preview
```
Once compilation completes, download the generated binary file (`ResQConnect-Release.apk`) and distribute it to municipal responders and community citizens.

---

## 7. Edge AI Station Setup (Raspberry Pi & Tapo C310)

### 7.1 Tapo C310 CCTV Setup & Fixed IP Configuration
1. Connect the Tapo C310 camera to power and pair it with the **TP-Link Tapo App** on a mobile device.
2. In camera settings, assign a static local IP address (e.g., `192.168.1.150`).
3. Enable **Advanced Settings $\rightarrow$ Camera Account**:
   * Username: `cctv_admin`
   * Password: `CameraPassword123!`
4. Verify RTSP stream accessibility using VLC media player:
   ```
   rtsp://cctv_admin:CameraPassword123!@192.168.1.150:554/stream1
   ```

### 7.2 Raspberry Pi Software Setup
Execute on the Raspberry Pi:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv ffmpeg git
cd ~
git clone https://github.com/ja1152452/Flood_Monitoring.git
cd Flood_Monitoring/flood_ai
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 7.3 Calibrating the Water Level Staff Gauge
1. Capture a reference calibration frame from the camera:
   ```bash
   python3 test_camera.py
   ```
2. Launch the interactive calibration script to select Region of Interest (ROI) and define pixel-to-meter ratios:
   ```bash
   python3 3_calibrate.py
   ```
3. The generated pixel coordinates and water thresholds are saved automatically into `calibration.json`.

### 7.4 Setting Up Continuous Edge Services (Systemd)
Create a persistent daemon service so the AI sender runs continuously and restarts on reboot:
1. Copy the systemd service file:
   ```bash
   sudo cp flood-ai.service /etc/systemd/system/
   ```
2. Enable and start the edge service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable flood-ai.service
   sudo systemctl start flood-ai.service
   ```
3. Inspect live operational logs:
   ```bash
   journalctl -u flood-ai.service -f
   ```

---

## 8. Production Cloud Deployment (Railway.app)

The system includes pre-configured `docker-compose.yml` and Nixpacks manifests for one-click deployment on Railway:

1. Log in to [Railway.app](https://railway.app) and create a **New Project** linked to the GitHub repository.
2. **Provision PostgreSQL Database:**
   * Click **+ New** $\rightarrow$ **Database** $\rightarrow$ **Add PostgreSQL**.
   * Note the internal database connection string variable (`DATABASE_URL`).
3. **Deploy Backend Service:**
   * Set Root Directory to `/flood_monitor/backend`.
   * Attach the `DATABASE_URL` environment variable.
4. **Deploy Frontend Web Service:**
   * Set Root Directory to `/flood_monitor/frontend`.
   * Set Build Command: `npm run build`.
   * Set Start Command: `npm run start` or static routing.

---

## 9. Backup, Recovery & Database Maintenance

### 9.1 Creating a Full Database Backup
Execute a compressed SQL dump:
```bash
pg_dump -U flood_admin -h localhost floodmonitor_db > floodmonitor_backup_$(date +%Y%m%d).sql
```

### 9.2 Restoring Database from Backup
In the event of hardware failure or database corruption:
1. Drop the corrupted database:
   ```bash
   dropdb -U postgres floodmonitor_db
   createdb -U postgres floodmonitor_db
   ```
2. Restore from SQL archive:
   ```bash
   psql -U flood_admin -d floodmonitor_db -f floodmonitor_backup_20260908.sql
   ```

---

## 10. Troubleshooting & Diagnostic Matrix

| Symptom / Error | Root Cause | Verified Resolution |
| :--- | :--- | :--- |
| **`column status is of type sos_status but expression is of type text`** | PostgreSQL strict enum type mismatch in parameterized SQL dispatch query. | Cast parameter explicitly in query: `WHERE status = $1::sos_status` (Resolved in commit `f15c0dc`). |
| **CCTV Live Stream Black Screen / HLS Not Loading** | FFmpeg RTSP process terminated or on-site bandwidth degradation. | Verify camera connectivity: `ping 192.168.1.150`. Restart streaming service: `sudo systemctl restart flood-ai.service`. |
| **`ECONNREFUSED 127.0.0.1:5432`** | PostgreSQL daemon is inactive or port 5432 is blocked. | Verify database status: `sudo systemctl status postgresql`. Ensure `DATABASE_URL` matches credentials. |
| **WebSocket / Socket.io Disconnecting Frequently** | Reverse proxy timeout or missing WebSocket header upgrades. | In Nginx or proxy config, ensure headers: `Upgrade $http_upgrade; Connection "upgrade";`. |
| **Mobile App Cannot Send SOS / Network Error** | Backend URL configured to `localhost` instead of public HTTPS domain. | Update `VITE_API_URL` in mobile `.env` to point to production Railway HTTPS URL, then recompile APK. |
| **AI Sensor Reporting Erratic Water Levels** | Camera shifted position or nighttime glare obscured staff gauge marks. | Re-run `python3 3_calibrate.py` to re-align gauge ROI markers and adjust IR night illumination. |
