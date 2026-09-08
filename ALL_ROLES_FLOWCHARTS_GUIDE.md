# COMPLETE PROCESS FLOWCHARTS MASTER GUIDE & TUTORIAL
### Flood Monitoring & Disaster Response Management System
*(ResQConnect Mobile App & MDRRMO/MSWDO Web Portals)*

---

## 📌 Overview of Generated Flowcharts

All flowcharts for the system's four primary actor roles have been generated in the **academic multi-column right-angle format** matching your reference thesis manuscript (`CS04-Arriola-Robles-manuscript.pdf`, Page 135).

Each diagram features:
- **Top spine:** `START` $\rightarrow$ `LOGIN` $\rightarrow$ `DASHBOARD`.
- **Right-angle distribution bus** cleanly branching into parallel functional columns.
- **Zero diagonal line crossings** (clean orthogonal 90-degree lines).
- **Bottom collection bus** converging into `LOGOUT / END`.
- **Publication-ready academic styling** (clean black border on white background).

---

## 📁 Ready-to-Open `.drawio` Files in Your Project

| Role | Target Platform | File Link | Manuscript Figure |
| :--- | :--- | :--- | :--- |
| **MDRRMO Administrator** | Web Command Center | [`ADMIN_ROLE_FLOWCHART.drawio`](file:///c:/Users/jayze/Documents/GitHub/Flood_Monitoring/ADMIN_ROLE_FLOWCHART.drawio) | **Figure 39** |
| **Community Resident / Citizen** | ResQConnect Mobile App | [`RESIDENT_ROLE_FLOWCHART.drawio`](file:///c:/Users/jayze/Documents/GitHub/Flood_Monitoring/RESIDENT_ROLE_FLOWCHART.drawio) | **Figure 40** |
| **Emergency Responder / Rescue Team** | ResQConnect Mobile App (Field Mode) | [`RESPONDER_ROLE_FLOWCHART.drawio`](file:///c:/Users/jayze/Documents/GitHub/Flood_Monitoring/RESPONDER_ROLE_FLOWCHART.drawio) | **Figure 41** |
| **MSWDO Officer / Camp Manager** | MSWDO Web Portal | [`MSWDO_ROLE_FLOWCHART.drawio`](file:///c:/Users/jayze/Documents/GitHub/Flood_Monitoring/MSWDO_ROLE_FLOWCHART.drawio) | **Figure 42** |

---

## 🚀 How to Load Any Diagram in Draw.io

### Method A: Open From Device
1. In your **draw.io** browser tab, click **`File`** $\rightarrow$ **`Open From`** $\rightarrow$ **`Device...`**.
2. Select any `.drawio` file from your `Flood_Monitoring` directory.

### Method B: Copy-Paste XML (Fastest)
1. In your **draw.io** tab, click **`Extras`** in the top menu $\rightarrow$ **`Edit Diagram...`**.
2. Press **`Ctrl + A`** to select all, then replace with the XML provided in each section below.
3. Click **`OK`**.

---

# 1. Community Resident / Citizen (ResQConnect Mobile)

### Figure Title for Manuscript:
> **Figure 40. Proposed Process Flowchart – Community Resident / Citizen (ResQConnect Mobile Application)**

### Manuscript Narrative (Copy to Chapter 3 / 4):
> Figure 40 presents the operational process flowchart for community residents utilizing the ResQConnect mobile application. Upon launching the application, unregistered users are routed to complete verification via SMS one-time passwords (OTP) before accessing the login interface. Authenticated citizens are directed to the Resident Dashboard, which branches into five vital disaster mitigation capabilities: real-time hydrological water level observation and CCTV video streaming, immediate one-tap emergency SOS broadcasting with GPS telemetry and household demographic tagging, geolocation-based evacuation center route discovery, receipt of municipal weather and flood advisories, and direct single-touch speed dialing to local emergency hotlines (MDRRMO, PNP, BFP, RHU). Upon completion or session termination, the application executes a secure exit procedure converging to the terminal state.

### Mermaid Diagram Code:
```mermaid
graph TD
    START([START]) --> OPEN[OPEN RESQCONNECT MOBILE APP]
    OPEN --> REG_CHECK{IS RESIDENT REGISTERED?}
    REG_CHECK -- NO --> REG_FORM[FILL REGISTRATION FORM & VERIFY OTP]
    REG_FORM --> LOGIN[LOGIN WITH PHONE/EMAIL & PASSWORD]
    REG_CHECK -- YES --> LOGIN
    LOGIN --> DASHBOARD[RESIDENT DASHBOARD]

    %% Columns
    DASHBOARD --> C1[MONITOR WATER LEVEL & CCTV FEED]
    C1 --> C1_2[VIEW RAIN RADAR & LUMBAN FLOOD MAP]
    C1_2 --> LOGOUT([LOGOUT / END])

    DASHBOARD --> C2_CHECK{EMERGENCY / FLOOD THREAT?}
    C2_CHECK -- YES --> C2_1[PRESS ONE-TAP EMERGENCY SOS]
    C2_1 --> C2_2[TRANSMIT GPS, HEADCOUNT & MEDICAL NEEDS]
    C2_2 --> C2_3[LIVE RESCUE DISPATCH TRACKING ON MAP]
    C2_3 --> C2_4[CONFIRM RESCUED / EVACUATED TO SHELTER]
    C2_4 --> LOGOUT
    C2_CHECK -- NO --> LOGOUT

    DASHBOARD --> C3_1[SEARCH NEAREST OPEN EVACUATION SHELTER]
    C3_1 --> C3_CHECK{SHELTER OPEN & AVAILABLE?}
    C3_CHECK -- YES --> C3_2[VIEW SAFE EVACUATION ROUTE & MAP]
    C3_2 --> LOGOUT
    C3_CHECK -- NO --> LOGOUT

    DASHBOARD --> C4_1[RECEIVE EMERGENCY BROADCAST NOTIFICATION]
    C4_1 --> C4_2[VIEW MDRRMO FLOOD ADVISORY & GUIDELINES]
    C4_2 --> LOGOUT

    DASHBOARD --> C5_1[ACCESS EMERGENCY HOTLINES DIRECTORY]
    C5_1 --> C5_2[ONE-TAP CALL TO MDRRMO / PNP / BFP / RHU]
    C5_2 --> LOGOUT

    DASHBOARD --> C6_1[USER PROFILE / SETTINGS]
    C6_1 --> C6_CHECK{LOGOUT OR CLOSE APP?}
    C6_CHECK -- YES --> C6_2[TERMINATE SESSION & CLOSE APP]
    C6_2 --> LOGOUT
    C6_CHECK -- NO --> DASHBOARD
```

---

# 2. Emergency Responder / Rescue Team (ResQConnect Mobile)

### Figure Title for Manuscript:
> **Figure 41. Proposed Process Flowchart – Emergency Responder / Rescue Team (ResQConnect Field Application)**

### Manuscript Narrative (Copy to Chapter 3 / 4):
> Figure 41 depicts the operational workflow for emergency rescue personnel operating in the field. Authorized responders log in with role-verified credentials and access the specialized Responder Dashboard. Active units immediately stream live GPS location telemetry to the central MDRRMO Command Center. When distress calls are dispatched, responders review the victim's location, household headcount, and special medical conditions prior to accepting the assignment and transitioning duty status to 'En Route'. On-site, responders assess flood severity, request inter-agency backup (PNP, BFP, Philippine Coast Guard, or Rural Health Unit) if required, conduct boat extraction or first-aid triage, and mark missions as 'Rescued / Resolved' before submitting post-incident action reports.

### Mermaid Diagram Code:
```mermaid
graph TD
    START([START]) --> LOGIN[RESPONDER LOGIN CREDENTIALS]
    LOGIN --> VERIFY{ARE CREDENTIALS VALID?}
    VERIFY -- NO --> LOGIN
    VERIFY -- YES --> DASHBOARD[RESPONDER DASHBOARD]

    %% Columns
    DASHBOARD --> C1_1[SET DUTY STATUS TO ACTIVE / ON-DUTY]
    C1_1 --> C1_2[STREAM LIVE GPS TELEMETRY TO MDRRMO]
    C1_2 --> C1_3[MONITOR HIGH-RISK ZONES ON MAP]
    C1_3 --> LOGOUT([LOGOUT / END])

    DASHBOARD --> C2_CHECK{EMERGENCY SOS MISSION RECEIVED?}
    C2_CHECK -- YES --> C2_1[REVIEW CITIZEN SOS PROFILE & MEDICAL NEEDS]
    C2_1 --> C2_2[ACCEPT MISSION & UPDATE STATUS 'EN ROUTE']
    C2_2 --> LOGOUT
    C2_CHECK -- NO --> LOGOUT

    DASHBOARD --> C3_1[ASSESS RESCUE SCENE & FLOOD SEVERITY]
    C3_1 --> C3_CHECK{BACKUP FORCE REQUIRED?}
    C3_CHECK -- YES --> C3_2[REQUEST BACKUP PNP / BFP / PCG / RHU]
    C3_2 --> LOGOUT
    C3_CHECK -- NO --> LOGOUT

    DASHBOARD --> C4_1[ARRIVE AT INCIDENT SCENE STATUS 'ON SCENE']
    C4_1 --> C4_2[PERFORM FIRST AID / BOAT EXTRACTION / RESCUE]
    C4_2 --> C4_3[MARK INCIDENT STATUS AS 'RESCUED / RESOLVED']
    C4_3 --> C4_4[SUBMIT POST-INCIDENT ACTION REPORT TO HQ]
    C4_4 --> LOGOUT

    DASHBOARD --> C5_1[CHECK REAL-TIME RIVER WATER ELEVATION]
    C5_1 --> C5_2[VIEW LIVE CCTV VIDEO GAUGE SURVEILLANCE]
    C5_2 --> LOGOUT

    DASHBOARD --> C6_1[UPDATE DUTY STATUS TO 'OFF-DUTY']
    C6_1 --> C6_CHECK{CONFIRM LOGOUT & END SHIFT?}
    C6_CHECK -- YES --> C6_2[TERMINATE SESSION & RETURN TO LOGIN]
    C6_2 --> LOGOUT
    C6_CHECK -- NO --> DASHBOARD
```

---

# 3. MSWDO Officer / Evacuation Camp Manager (Web Portal)

### Figure Title for Manuscript:
> **Figure 42. Proposed Process Flowchart – MSWDO Officer / Evacuation Camp Manager (Web Application)**

### Manuscript Narrative (Copy to Chapter 3 / 4):
> Figure 42 details the administrative and humanitarian relief management processes executed by the Municipal Social Welfare and Development Office (MSWDO). Following privileged credential authentication, the officer accesses the MSWDO Relief and Evacuation Dashboard. The workflow coordinates four mission-critical camp management responsibilities: family profiling and demographic intake tagging vulnerable sectors (seniors, PWDs, infants, and pregnant mothers); real-time logging of family food pack (FFP) and hygiene kit distributions with automatic inventory balance deduction; dynamic tracking of evacuation shelter bed capacity with automated overflow notifications sent to MDRRMO to redirect evacuees; and automated generation and export of official DROMIC (Disaster Response Operations Monitoring and Information Center) masterlist audit reports.

### Mermaid Diagram Code:
```mermaid
graph TD
    START([START]) --> LOGIN[LOGIN MSWDO PORTAL CREDENTIALS]
    LOGIN --> VERIFY{ARE CREDENTIALS VALID?}
    VERIFY -- NO --> LOGIN
    VERIFY -- YES --> DASHBOARD[MSWDO RELIEF & EVACUATION DASHBOARD]

    %% Columns
    DASHBOARD --> C1_1[SELECT DESIGNATED EVACUATION CENTER]
    C1_1 --> C1_2[RECORD & PROFILE INCOMING FAMILIES]
    C1_2 --> C1_3[TAG VULNERABLE SECTOR SENIORS / PWDS / INFANTS]
    C1_3 --> LOGOUT([LOGOUT / END])

    DASHBOARD --> C2_CHECK{DISTRIBUTE RELIEF PACKS & KITS?}
    C2_CHECK -- YES --> C2_1[LOG DISTRIBUTION PER FAMILY RECIPIENT ID]
    C2_1 --> C2_2[DEDUCT & UPDATE REMAINING GOODS INVENTORY]
    C2_2 --> LOGOUT
    C2_CHECK -- NO --> LOGOUT

    DASHBOARD --> C3_1[MONITOR CENTER BED / SPACE CAPACITY]
    C3_1 --> C3_CHECK{CENTER REACHED MAX CAPACITY?}
    C3_CHECK -- YES --> C3_2[UPDATE STATUS TO 'FULL / OCCUPIED']
    C3_2 --> C3_3[ALERT MDRRMO COMMAND FOR OVERFLOW REROUTING]
    C3_3 --> LOGOUT
    C3_CHECK -- NO --> LOGOUT

    DASHBOARD --> C4_1[GENERATE DROMIC DISASTER ASSISTANCE SUMMARY]
    C4_1 --> C4_2[EXPORT EVACUEE MASTERLIST TO PDF / EXCEL]
    C4_2 --> C4_3[SUBMIT OFFICIAL RELIEF AUDIT TO LGU / DSWD]
    C4_3 --> LOGOUT

    DASHBOARD --> C5_1[VIEW MDRRMO FLOOD ALERTS & WEATHER BULLETINS]
    C5_1 --> C5_2[COORDINATE RELIEF TRANSPORT LOGISTICS]
    C5_2 --> LOGOUT

    DASHBOARD --> C6_1[USER ACCOUNT & OFFICER PROFILE]
    C6_1 --> C6_CHECK{CONFIRM LOGOUT FROM PORTAL?}
    C6_CHECK -- YES --> C6_2[TERMINATE SESSION & RETURN TO LOGIN]
    C6_2 --> LOGOUT
    C6_CHECK -- NO --> DASHBOARD
```
