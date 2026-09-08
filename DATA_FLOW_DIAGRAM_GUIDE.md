# DATA FLOW DIAGRAMS MANUSCRIPT SECTION
### Flood Monitoring & Disaster Response Management System
*(ResQConnect Mobile Application & MDRRMO/MSWDO Portals)*

---

## 📖 Manuscript Chapter 3 Text (Direct Copy)

### DATA FLOW DIAGRAM

This section shows and demonstrates the data flow diagram of Flood Monitoring and Disaster Response Management System.

---

### Process 1.0 Registration and Authentication Process Data Flow Diagram

Process 1.0 illustrates the data movement during citizen and responder onboarding. The resident inputs demographic details (`USER INFO`) into the **1.0 REGISTRATION** module, which stores the salted record into the central **DATABASE**. To access operational features, the user inputs credentials into the **1.2 SIGN IN** process, which validates the session token against the persistent database before granting authorization.

[Insert Figure 42: Process 1.0 Registration and Authentication Process Data Flow Diagram here]

> **Figure 42.** This figure shows the data flow diagram of the registration and authentication process of Flood Monitoring and Disaster Response Management System.

---

### Process 2.0 Water Level Monitoring and Emergency Siren Process Data Flow Diagram

Process 2.0 depicts the automated hydrological surveillance pipeline. The on-site **CCTV / TAPO C310 CAMERA** streams high-definition RTSP video to the **2.1 AI WATER LEVEL DETECTION & RATE OF RISE ANALYSIS** engine. Calibrated water levels are committed to the **DATABASE** and rendered to the **MDRRMO ADMINISTRATOR**. Upon critical river cresting, the administrator issues a command to **2.2 EMERGENCY SIREN & WARNING BROADCAST**, which simultaneously triggers physical audible alarms and dispatches Firebase push notifications to registered **COMMUNITY RESIDENTS**.

[Insert Figure 43: Process 2.0 Water Level Monitoring and Emergency Siren Process Data Flow Diagram here]

> **Figure 43.** This figure shows the data flow diagram of the water level monitoring and emergency siren warning process of Flood Monitoring and Disaster Response Management System.

---

### Process 3.0 Emergency SOS and Rescue Mission Dispatch Process Data Flow Diagram

Process 3.0 illustrates the real-time emergency dispatch workflow. A stranded **COMMUNITY RESIDENT** transmits an SOS beacon containing GPS coordinates, household headcounts, and medical flags to **3.1 PROCESS INCOMING SOS & TRIAGE VULNERABILITIES**. The distress ticket is saved in the **DATABASE** and flagged on the **MDRRMO COMMAND CENTER** console. The administrator initiates **3.2 DISPATCH RESCUE TEAM & MONITOR TELEMETRY**, assigning the incident to an active **EMERGENCY RESPONDER** who transmits real-time status transitions (`EN ROUTE`, `ON SCENE`, `RESCUED`).

[Insert Figure 44: Process 3.0 Emergency SOS and Rescue Mission Dispatch Process Data Flow Diagram here]

> **Figure 44.** This figure shows the data flow diagram of the emergency SOS and rescue mission dispatch process of Flood Monitoring and Disaster Response Management System.

---

### Process 4.0 Evacuation Shelter and Relief Goods Management Process Data Flow Diagram

Process 4.0 delineates evacuation shelter camp management. The **MSWDO OFFICER** conducts intake through **4.1 EVACUEE PROFILING & SHELTER CAPACITY TRACKING**, logging family headcounts and vulnerability tags into the **DATABASE**. If capacity reaches 100%, an automated overflow alert notifies the **MDRRMO COMMAND CENTER**. Concurrently, **4.2 RELIEF PACK DISTRIBUTION & DROMIC REPORT GENERATION** records distributed food packs and hygiene kits, generating official DROMIC disaster assistance reports.

[Insert Figure 45: Process 4.0 Evacuation Shelter and Relief Goods Management Process Data Flow Diagram here]

> **Figure 45.** This figure shows the data flow diagram of the evacuation shelter and relief goods management process of Flood Monitoring and Disaster Response Management System.
