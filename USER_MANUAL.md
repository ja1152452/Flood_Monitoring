# USER OPERATIONAL MANUAL
### Flood Monitoring & Disaster Response Management System
*(ResQConnect Mobile Application & MDRRMO/MSWDO Command Center Web Portals)*

---

## 📖 Table of Contents
1. [Introduction & Purpose](#1-introduction--purpose)
2. [Resident / Citizen User Manual (ResQConnect Mobile)](#2-resident--citizen-user-manual-resqconnect-mobile)
3. [Emergency Responder User Manual (ResQConnect Field Mode)](#3-emergency-responder-user-manual-resqconnect-field-mode)
4. [MDRRMO Administrator User Manual (Web Command Center)](#4-mdrrmo-administrator-user-manual-web-command-center)
5. [MSWDO Officer User Manual (Web Evacuation Portal)](#5-mswdo-officer-user-manual-web-evacuation-portal)
6. [Emergency Procedures & Hotlines](#6-emergency-procedures--hotlines)

---

## 1. Introduction & Purpose

This User Operational Manual provides comprehensive, step-by-step instructions for operating the **Flood Monitoring & Disaster Response Management System**. 

The system serves four distinct user groups:
* **Community Residents / Citizens:** Monitored via the **ResQConnect Mobile Application**.
* **Emergency Responders / Rescue Teams:** Dispatched via the **ResQConnect Mobile Application (Field Mode)**.
* **MDRRMO Officers & Incident Commanders:** Operating via the **Web Command Center Portal**.
* **MSWDO Evacuation Camp Managers:** Operating via the **MSWDO Relief & Evacuation Web Portal**.

---

## 2. Resident / Citizen User Manual (ResQConnect Mobile)

### 2.1 Application Installation & First-Time Launch
1. Download and install **`ResQConnect-Release.apk`** on your Android smartphone (Android 8.0 or higher required).
2. Launch the application from your home screen or app drawer.
3. Grant required permissions when prompted:
   * **Location Permission:** Select *"While using the app"* or *"Always allow"* (crucial for GPS distress triangulation).
   * **Notification Permission:** Tap *"Allow"* to receive flood warnings and siren broadcasts.

### 2.2 Account Registration & OTP Verification
1. On the initial screen, tap **`Create Account / Register`**.
2. Complete the registration form:
   * Full Name, Mobile Phone Number, Barangay of Residence, Email Address, and Password.
3. Tap **`Submit Registration`**.
4. Retrieve the **6-digit One-Time Password (OTP)** sent to your registered phone number.
5. Enter the OTP code on the verification screen and tap **`Verify Account`**.
6. Upon successful verification, log in using your registered credentials.

### 2.3 Monitoring River Water Levels & CCTV Feeds
1. From the bottom navigation bar, tap **`Home / Dashboard`**.
2. Review the **Real-Time Water Elevation Card**:
   * **Normal (Green):** Safe river elevation; regular monitoring.
   * **Alert (Yellow):** River rising; community advised to remain vigilant.
   * **Warning (Orange):** Pre-evacuation recommended for low-lying flood zones.
   * **Critical (Red):** Severe flood risk; immediate mandatory evacuation ordered.
3. Tap **`Live CCTV Stream`** to watch real-time video surveillance of the Lumban river staff gauge.
4. Swipe down to refresh hydrological sensor readings and rain radar overlays.

### 2.4 Sending an Emergency SOS Distress Alert
> **⚠️ CRITICAL:** Use this feature ONLY during genuine flood threats or life-threatening emergencies.

1. Navigate to the **`Emergency SOS`** tab (or tap the prominent Red SOS button on the home screen).
2. Confirm or adjust your household demographic details:
   * **Headcount:** Number of individuals requiring extraction.
   * **Special Vulnerabilities:** Check boxes for Seniors, Persons with Disabilities (PWDs), Infants, or Pregnant women.
   * **Medical Emergencies:** Specify immediate medical needs (e.g., insulin dependence, severe injury, hypothermia).
3. Press and hold the **`TRIGGER EMERGENCY SOS`** button for 3 seconds.
4. Your precise GPS latitude and longitude, along with your profile data, will be transmitted instantly to the MDRRMO Command Center.
5. Once received, the screen displays **`SOS DISPATCHED - RESCUE TEAM EN ROUTE`** with live tracking of assigned rescue units.

### 2.5 Finding Nearest Evacuation Shelters
1. Tap the **`Evacuation`** tab.
2. View the map display of all designated evacuation facilities in Lumban.
3. Tap on a shelter marker to review:
   * Center Name, Location, Current Status (Open / Full), and Available Bed Capacity.
4. Tap **`Get Safe Route`** to generate turn-by-turn navigation guiding you along flood-free roadways.

---

## 3. Emergency Responder User Manual (ResQConnect Field Mode)

### 3.1 Responder Login & Duty Status Activation
1. Launch the **ResQConnect** app and enter your authorized responder credentials.
2. The interface automatically detects your role and switches to **`Responder Mode`**.
3. On the top status toggle, switch your duty status from **`OFF-DUTY`** to **`ACTIVE / ON-DUTY`**.
4. Confirm that background GPS tracking is enabled; your location icon will appear on the MDRRMO Headquarters map.

### 3.2 Receiving & Accepting SOS Mission Dispatches
1. When an SOS alert is dispatched by the command center, your device sounds an emergency siren ringtone with a full-screen mission modal.
2. Review the incoming mission profile:
   * Victim Name, Contact Number, Barangay, Exact GPS Distance, Headcount, and Medical Flags.
3. Tap **`ACCEPT MISSION`** within 60 seconds:
   * Your status automatically updates to **`EN ROUTE`**.
   * The MDRRMO Command Center and the stranded citizen are immediately notified of your deployment.
4. Tap **`Navigate`** to open built-in GPS routing directly to the citizen's distress coordinates.

### 3.3 Requesting Multi-Agency Backup
1. If on-site flood waters exceed standard wading levels or swift-water boat extraction is required:
2. Tap **`REQUEST INTER-AGENCY BACKUP`** on the active mission screen.
3. Select the required agency:
   * **PNP (Philippine National Police):** Perimeter control & crowd management.
   * **BFP (Bureau of Fire Protection):** High-angle rescue & ladder extraction.
   * **PCG (Philippine Coast Guard):** Motorized rubber boat fleet.
   * **RHU (Rural Health Unit):** On-site paramedic & emergency ambulance triage.
4. Tap **`Transmit Backup Request`**; the request is highlighted on the MDRRMO Command console.

### 3.4 Concluding a Mission & Submitting Incident Report
1. Upon reaching the incident site, tap **`ARRIVED ON SCENE`** (status switches to `ON SCENE`).
2. Conduct extraction, life safety support, or shelter transport.
3. Once all victims are safely evacuated:
4. Tap **`MARK RESCUE COMPLETED`**.
5. Input a brief field report (Number of rescued citizens, destination evacuation center, remarks).
6. Tap **`Submit Report`**. Your status resets to **`AVAILABLE`** for subsequent deployments.

---

## 4. MDRRMO Administrator User Manual (Web Command Center)

### 4.1 Access & Command Authentication
1. Open a modern web browser (Google Chrome or Microsoft Edge recommended) and navigate to the portal URL.
2. Enter your authorized administrator email and password.
3. Click **`Secure Login`**. Upon token validation, the **MDRRMO Central Incident Command Dashboard** loads.

### 4.2 Central Dashboard Overview
* **Top Metric Ribbon:** Displays current river water level (in meters), rate-of-rise trend ($\text{m/hr}$), active field responders count, and pending SOS alerts.
* **Live CCTV Stream Panel:** Displays real-time 3MP video streaming from the Tapo C310 camera focused on the river staff gauge.
* **Live Water Level Chart:** Interactive Recharts time-series graph displaying 24-hour river elevation trends against Alert, Warning, and Critical thresholds.
* **Emergency Siren Control:** Prominent manual trigger button to engage municipal audible alarms during flash flood emergencies.

### 4.3 Triggering Audible Sirens & Public Flood Advisories
1. If the water level crosses the **Warning (Orange)** or **Critical (Red)** threshold:
2. Click **`TRIGGER SIREN ALARM`** on the top dashboard bar.
3. Confirm the action in the security modal:
   * An audible alarm tone sounds across all connected web consoles.
   * A high-priority push notification is automatically broadcast to all registered citizens via Firebase Cloud Messaging.
4. To issue customized instructions, navigate to **`Announcements`**, type the official LGU bulletin, and click **`Broadcast Warning to All Users`**.

### 4.4 Managing SOS Distress Calls & Dispatching Units
1. Navigate to the **`Rescue Operations`** tab (`/rescue`).
2. Incoming distress signals are listed in the **Active SOS Queue** sorted by urgency and timestamp.
3. Click on a distress ticket to highlight the victim's location marker on the interactive **Lumban GIS Risk Map**.
4. The map displays color-coded icons for available responders (Green), en-route units (Yellow), and busy units (Red).
5. Review the nearest active responder and click **`Dispatch Team`**.
6. The selected responder's mobile device immediately receives the mission packet.

### 4.5 Hydro-Meteorological Analytics & Simulated Drills
1. Navigate to the **`Analytics & Reports`** tab (`/analytics`).
2. Select date ranges to inspect historical water elevations, peak flood levels, and rate-of-rise statistics.
3. **Simulated Drill Management:**
   * To conduct disaster response drills without live flood conditions, toggle **`Simulation Mode`**.
   * Use the **`Detailed Simulated Drill Readings`** table to review, edit timestamps, or apply date shifts for training exercises.
4. Click **`Export PDF Report`** to generate an official LGU disaster summary document complete with tables and charts.

### 4.6 User Account Management & Audit Logs
1. Navigate to **`Users`** (`/users`) to review, create, or deactivate user accounts (Administrator, Responder, MSWDO, Citizen).
2. Navigate to **`Audit Logs`** (`/audit-logs`) to review immutable security logs tracking all logins, emergency dispatches, siren triggers, and data modifications.

---

## 5. MSWDO Officer User Manual (Web Evacuation Portal)

### 5.1 Accessing the MSWDO Portal
1. Navigate to the MSWDO portal URL.
2. Input authorized MSWDO credentials and click **`Sign In`**.
3. The **MSWDO Relief & Evacuation Dashboard** opens.

### 5.2 Selecting and Managing an Evacuation Center
1. From the top dropdown menu, select your assigned evacuation facility (e.g., *Lumban Central Elementary School*, *Barangay Sports Complex*).
2. The center's profile card displays:
   * Total Capacity, Current Headcount, Available Bed Space, and Occupancy Percentage.

### 5.3 Evacuee Family Profiling & Intake
1. Navigate to **`Evacuees Masterlist`** (`/mswdo/evacuees`).
2. Click **`Register New Evacuee Family`**.
3. Input Family Information:
   * Head of Household Name, Origin Barangay, Contact Number, Total Family Members.
4. Tag Vulnerable Household Members:
   * Check counts for **Senior Citizens (60+)**, **Persons with Disabilities (PWDs)**, **Infants / Children (<5)**, and **Pregnant / Lactating Mothers**.
5. Click **`Save & Admit Family`**. The center's active occupancy updates automatically.

### 5.4 Logging Relief Goods & Food Pack Distribution
1. In the active evacuee table, locate the family record.
2. Click **`Log Relief Distribution`**.
3. Check distributed items:
   * **Family Food Packs (FFP)**
   * **Hygiene Kits**
   * **Sleeping Kits / Blankets**
   * **Bottled Potable Water**
4. Click **`Confirm Distribution`**. The transaction is timestamped and deducted from remaining camp inventory.

### 5.5 Center Full-Capacity Overflow Protocols
1. When registered evacuees reach 100% of maximum bed capacity:
2. The center status automatically flags **`FULL CAPACITY`**.
3. The system generates an automated overflow alert to the MDRRMO Command Center console.
4. Mobile application routing automatically redirects subsequent evacuating citizens to the next nearest open facility.

### 5.6 Generating DROMIC Disaster Reports
1. Navigate to **`Reports`** (`/mswdo/reports`).
2. Select the active incident or date period.
3. Click **`Generate DROMIC Report`** (Disaster Response Operations Monitoring and Information Center format).
4. Click **`Download PDF`** or **`Export to Excel`** for formal submission to the Municipal Mayor, Provincial Social Welfare Office, and DSWD Region IV-A.

---

## 6. Emergency Procedures & Hotlines

In the event of network blackout or total cellular outage, follow manual communication protocols:

| Agency | Designation | Hotline Number | VHF Radio Frequency |
| :--- | :--- | :--- | :--- |
| **MDRRMO Lumban** | Emergency Command Center | (049) 501-XXXX / 0917-XXX-XXXX | 145.500 MHz |
| **Lumban Municipal Police (PNP)** | Law Enforcement & Security | 0998-XXX-XXXX | 146.200 MHz |
| **Lumban Fire Station (BFP)** | Search, Rescue & Extrication | 0922-XXX-XXXX | 147.100 MHz |
| **Rural Health Unit (RHU)** | Emergency Medical Services | (049) 501-YYYY | — |
| **MSWDO Disaster Desk** | Relief & Welfare Assistance | (049) 501-ZZZZ | — |
