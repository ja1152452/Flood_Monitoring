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

### Process 3.0 Approving Rescue Mission Process Data Flow Diagram

Process 3.0 illustrates the verification and authorization of emergency distress operations. The MDRRMO Administrator reviews the incoming distress incident and triggers the approval to dispatch a dedicated rescue team through the **3.0 RESCUE DISPATCH** process. Once approved, the system dispatches automated SMS and push notifications to the **COMMUNITY RESIDENT**, confirming the rescue unit deployment and providing estimated time of arrival (ETA).

[Insert Figure 44: Process 3.0 Approving Rescue Mission Process Data Flow Diagram here]

> **Figure 44.** This figure shows the data flow diagram of the approving rescue mission process of Flood Monitoring and Disaster Response Management System.

---

### Process 4.0 Evacuation Shelter and Relief Goods Allocation Process Data Flow Diagram

Process 4.0 outlines the dual-channel humanitarian assistance pipeline managed by the Municipal Social Welfare and Development Office (MSWDO). In the primary channel, the MSWDO Officer inputs shelter allocation directives into the **4.0 SHELTER ALLOCATION** module, assigning certified evacuee families to designated shelter rooms. Concurrently, the officer initiates relief pack distribution through **4.1 RELIEF GOODS DISTRIBUTION**, logging distributed family food packs and hygiene kits directly to the **COMMUNITY RESIDENT**.

[Insert Figure 45: Process 4.0 Evacuation Shelter and Relief Goods Allocation Process Data Flow Diagram here]

> **Figure 45.** This figure shows the data flow diagram of the evacuation shelter and relief goods allocation process of Flood Monitoring and Disaster Response Management System.

---

### Process 5.0 Overall Flood Monitoring and Disaster Response Management System Process Data Flow Diagram

Process 5.0 consolidates the entire end-to-end data communication infrastructure of the Flood Monitoring and Disaster Response Management System. The diagram unifies citizen registration (`1.0`), secure authentication (`1.2`), real-time river surveillance (`2.0`), early warning siren and alert broadcasting (`2.1`), emergency rescue mission dispatching (`3.0`), temporary evacuation shelter accommodation (`4.0`), and relief food pack distribution (`5.0`). The MDRRMO Administrator and MSWDO Officers serve as the centralized commanding entities executing operational directives, while the persistent central database guarantees transactional integrity and real-time bidirectional telemetry for community residents.

[Insert Figure 46: Process 5.0 Overall Flood Monitoring and Disaster Response Management System Process Data Flow Diagram here]

> **Figure 46.** This figure shows the overall data flow diagram of the Flood Monitoring and Disaster Response Management System.
