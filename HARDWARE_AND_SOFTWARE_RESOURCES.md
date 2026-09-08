# HARDWARE AND SOFTWARE RESOURCES

This section outlines the comprehensive hardware and software resources utilized in the research, development, deployment, and operational execution of the **Flood Monitoring and Disaster Response Management System** *(ResQConnect Mobile Application and MDRRMO/MSWDO Command Center Web Portals)*.

---

## 1. Software Resources

### A. MDRRMO & MSWDO Command Center Web Applications
* **HyperText Markup Language (HTML5):** Used to construct the semantic layout, visual components, and structural foundation of the web applications.
* **Cascading Style Sheets (CSS3) & TailwindCSS:** Employed for responsive styling, custom design tokens, modern dashboard glassmorphism, and responsive screen adaptations across desktop resolutions.
* **JavaScript (ES6+):** Utilized as the primary client-side programming language to execute interactive user workflows, dynamic DOM manipulation, and asynchronous API communication.
* **React.js (v19):** Applied as the core component-based user interface library to construct reactive Single Page Application (SPA) interfaces for the MDRRMO Central Command and MSWDO Evacuation portals.
* **Vite Build Tool:** Used as the modern frontend development server and production bundler for optimized performance and lightning-fast Hot Module Replacement (HMR).
* **Node.js (v20 LTS):** Employed as the backend JavaScript runtime environment powering server-side event loops, non-blocking asynchronous I/O, and microservice coordination.
* **Express.js Framework:** Utilized as the minimal and robust backend RESTful API framework to manage route dispatching, middleware authentication, and request handling.
* **PostgreSQL Database Engine (v15+):** Serves as the primary enterprise-grade relational database management system (RDBMS) for storing tabular citizen profiles, telemetry logs, SOS dispatches, and role-based access records.
* **Operating System:** Microsoft Windows 10/11 Professional (Development Environment) and Ubuntu Linux 22.04 LTS (Production Cloud Server).

---

### B. ResQConnect Mobile Application (Citizen & Responder Modes)
* **React Native Framework:** Utilized for cross-platform native mobile application development using standard JavaScript and declarative UI paradigms.
* **Expo SDK Framework (v54):** Employed as the core mobile toolchain to access low-level device hardware, handle application lifecycles, and facilitate streamlined deployment.
* **React Navigation (v7):** Implemented to handle native bottom tab bars, modal displays, and stack navigation between emergency, monitoring, and profile screens.
* **AsyncStorage:** Used for client-side local caching, session token persistence, and offline data buffering.
* **Operating System:** Android OS (compatible with Android 8.0 Oreo up to Android 15).

---

### C. Computer Vision & Edge AI Water Level Detection Pipeline (`flood_ai`)
* **Python Programming Language (v3.10+):** Employed as the primary computing language for camera calibration, hydrological data capture, and image processing.
* **OpenCV (Open Source Computer Vision Library v4.9):** Utilized for digital image processing, perspective transformation, region-of-interest (ROI) masking, and water meniscus edge detection against calibrated staff gauges.
* **Ultralytics YOLO (YOLOv8 / YOLO11):** Applied for deep learning object recognition, automated staff gauge metric detection, and water line bounding box localization.
* **PyTorch (v2.0+):** Utilized as the deep learning tensor computation and model inference framework.
* **NumPy (v1.26):** Employed for high-performance multi-dimensional array operations, mathematical matrix calculations, and hydrological rate-of-rise trend algorithms.
* **FFmpeg Engine:** Deployed on the edge device for hardware-accelerated video decoding, converting RTSP raw video streams into low-latency HTTP Live Streaming (HLS) segments.

---

### D. Application Programming Interfaces (APIs) & Protocols
* **Real-Time Streaming Protocol (RTSP):** Industrial video streaming protocol used to ingest high-definition live surveillance video from the on-site CCTV camera to the edge server.
* **HTTP Live Streaming (HLS) Protocol:** Adaptive bitrate video streaming protocol used to broadcast live river surveillance feeds to web dashboards and mobile phones.
* **Firebase Cloud Messaging (FCM) API:** Utilized to push critical flood warnings, audible emergency siren triggers, and SOS mission alerts to mobile devices.
* **OpenWeatherMap & Rain Radar API:** Integrated to pull real-time barometric precipitation radar data, precipitation forecasts, and ambient weather parameters.
* **Socket.io / WebSocket Engine:** Implemented for full-duplex real-time communication, synchronizing live responder GPS movement, emergency dispatches, and sensor updates across all active sessions.
* **RESTful JSON Web API:** Designed and consumed for stateless CRUD operations (users, evacuation shelters, relief logs, and historical analytics).

---

### E. External Libraries & Frameworks
* **Leaflet & React-Leaflet:** Interactive GIS mapping library utilized to render Lumban administrative boundaries, flood hazard heatmaps, evacuation centers, and live rescue units.
* **Recharts & Chart.js:** Applied to generate interactive time-series hydrological charts, rate-of-rise curves, and drill simulation analytics.
* **jsPDF & jsPDF-AutoTable:** Client-side document compilation libraries used to dynamically export official flood monitoring summaries and DROMIC evacuee masterlists to standardized PDF format.
* **Hls.js:** JavaScript HLS client library that enables live video streaming directly within HTML5 video elements without third-party browser plugins.
* **Axios HTTP Client:** Promise-based HTTP client for secure communication between frontend interfaces and the Node.js backend.
* **Zustand:** Lightweight client-side state store used to synchronize authentication tokens, active theme states, and simulated drill configurations.
* **Bcrypt.js:** Cryptographic hashing library used to securely salt and hash user passwords prior to database storage.
* **JSON Web Tokens (jsonwebtoken):** Used for stateless, cryptographically signed bearer authentication and role-based access control (RBAC).
* **Lucide-React & Expo Vector Icons:** Comprehensive SVG icon libraries for intuitive interface navigation.

---

### F. Development, Testing, and Deployment Tools
* **Visual Studio Code (VS Code):** Primary Integrated Development Environment (IDE) utilized for coding, debugging, and extensions integration.
* **Git & GitHub:** Distributed version control system and cloud repository hosting platform for team collaboration and code tracking.
* **Railway.app Cloud Platform:** Platform-as-a-Service (PaaS) used for containerized cloud deployment of the Node.js API, PostgreSQL database, and static web portal.
* **Expo Application Services (EAS Build):** Cloud build infrastructure used to compile the React Native source code into the production Android binary (`ResQConnect-Release.apk`).
* **draw.io (diagrams.net):** Diagramming software used for architectural design, flowchart generation, and unified modeling language (UML) schematics.
* **Postman:** API testing suite used to simulate, validate, and benchmark backend endpoint behaviors and security responses.

---

## 2. Hardware Resources

### A. Edge AI Hydrological Monitoring Station (On-Site River Installation)
* **Single Board Edge Computer (SBC):**
  * *Model:* Raspberry Pi 4 Model B (4GB/8GB RAM) or Raspberry Pi 5
  * *Processor:* Broadcom BCM2711, Quad-core Cortex-A72 (ARM v8) 64-bit SoC @ 1.5 GHz
  * *Operating System:* Raspberry Pi OS (64-bit, Debian-based)
  * *Purpose:* Performs continuous local OpenCV computer vision analysis, rate-of-rise calculation, and RTSP-to-HLS video stream transcoding directly at the river bank.
* **Outdoor CCTV Surveillance Camera:**
  * *Model:* TP-Link Tapo C310 Outdoor Security Camera
  * *Resolution:* 3 Megapixel Ultra-High Definition (2304 × 1296) @ 15 fps
  * *Optical / Night Vision:* 850 nm IR LED Night Vision up to 98 ft (30 meters) with Auto ICR
  * *Ingress Protection:* IP66 Weatherproof and dustproof certification
  * *Connectivity:* RJ-45 10/100 Mbps Ethernet / 2.4 GHz Wi-Fi (802.11 b/g/n)
  * *Stream Protocol:* RTSP on Port 554 with H.264 video compression
* **Physical Water Level Staff Gauge:**
  * *Type:* Metric Staff Gauge (E-type graduated scale, color-banded according to Yellow/Alert, Orange/Warning, and Red/Critical thresholds).
  * *Mounting:* Fixed vertically against a concrete bridge abutment or river retaining wall within the camera's calibrated field of view.
* **Peripheral & Protection Accessories:**
  * *Storage:* 64GB / 128GB SanDisk High Endurance MicroSDXC Card (Class 10, U3, V30) for continuous 24/7 video buffer writes.
  * *Power Unit:* Official Raspberry Pi 5V 3A USB-C Power Adapter with Uninterruptible Power Supply (UPS) battery backup.
  * *Enclosure:* IP66-rated weather-sealed electrical junction box and dual-fan aluminum heatsink case for continuous thermal dissipation.

---

### B. Command Center Workstations (MDRRMO Headquarters & MSWDO Office)
* **Personal Computer / Laptop:**
  * *Processor:* Intel Core i5 (8th Gen or higher) / AMD Ryzen 5 (3000 series or higher), Quad-Core, 2.5 GHz base frequency.
  * *Memory (RAM):* 8GB DDR4 or higher (16GB recommended for simultaneous multi-tab CCTV surveillance).
  * *Storage:* 256GB NVMe Solid State Drive (SSD) or higher.
  * *Display:* 21.5-inch or larger Full HD Monitor (1920 × 1080 resolution) to accommodate multi-panel GIS mapping and live video streams.
  * *Network Connection:* High-Speed Broadband LAN (100 Mbps or higher) / Wi-Fi.

---

### C. Mobile Client Devices (Emergency Responders & Community Citizens)
* **Handheld Device:** Android Smartphone / Tablet
* **Operating System:** Android 8.0 (Oreo) or higher
* **Processor:** Octa-Core 2.0 GHz Cortex-A53 / Snapdragon / MediaTek or higher
* **Memory (RAM):** 3GB or higher (4GB recommended)
* **Storage Space:** At least 500MB free internal memory for map tiles and application storage.
* **Integrated Hardware Sensors:**
  * Global Positioning System (GPS) / GLONASS receiver for real-time SOS location triangulation.
  * Cellular Modem (4G LTE / 5G) or Wi-Fi connectivity for continuous telemetry transmission.
  * Digital Camera (for optional situational disaster damage reporting).

---

## 3. Summary Specifications Table (For Thesis Manuscript)

### Table 1: Minimum vs. Recommended System Hardware Specifications

| Component Layer | Minimum Hardware Requirement | Recommended Hardware Specification |
| :--- | :--- | :--- |
| **On-Site Edge Unit** | Raspberry Pi 4 (4GB RAM), MicroSD 32GB | Raspberry Pi 4/5 (8GB RAM), MicroSD 128GB High Endurance |
| **River Camera** | 1080p IP Camera with RTSP Support | TP-Link Tapo C310 3MP UHD Outdoor IP66 Camera |
| **Command Center PC** | Intel Core i3, 4GB RAM, 128GB HDD, 1366×768 Display | Intel Core i5/i7, 16GB RAM, 512GB SSD, Dual 1080p Displays |
| **Mobile Client** | Android 8.0, Quad-Core 1.5 GHz, 2GB RAM, GPS, 3G | Android 11+, Octa-Core 2.0 GHz, 4GB RAM, GPS, 4G LTE/5G |

### Table 2: System Software Stack Summary

| Layer | Technologies / Software Utilized |
| :--- | :--- |
| **Web Frontend** | React.js v19, Vite, TailwindCSS, HTML5, CSS3, JavaScript (ES6+) |
| **Mobile Frontend** | React Native, Expo SDK v54, React Navigation, AsyncStorage |
| **Backend & Runtime** | Node.js v20 LTS, Express.js, Socket.io |
| **Database Engine** | PostgreSQL v15+ (Relational Database) |
| **Computer Vision / AI** | Python 3.10+, OpenCV 4.9, Ultralytics YOLOv8/YOLO11, PyTorch, NumPy |
| **Video Streaming** | FFmpeg, RTSP, HTTP Live Streaming (HLS), Hls.js |
| **External APIs** | Firebase Cloud Messaging (FCM), OpenWeatherMap API |
| **Mapping & GIS** | Leaflet, React-Leaflet, GeoJSON (Lumban Map & Flood Zones) |
| **Hosting & Cloud** | Railway.app (Cloud Web/API/DB), Expo EAS (Mobile Build) |
| **Development Tools** | Visual Studio Code, Git, GitHub, draw.io, Postman |
