# 🌊 PralaySetu + Sankat OS

### From Cyclone Forecast to Verified Field Action

**AI-powered disaster impact intelligence and accountable field response for India.**

> **Existing systems tell authorities that a cyclone is coming.
> PralaySetu shows what will be affected.
> Sankat OS tells the responsible team what to do next — and verifies whether it happened.**

---

## 🚨 Overview

**PralaySetu + Sankat OS** is an AI-powered disaster response prototype designed to bridge the gap between **hazard forecasting and actionable, accountable field response**.

The project combines geospatial intelligence, infrastructure impact analysis, dependency/cascade modelling, mission prioritisation, field evidence collection, and Gemini-powered multimodal verification into a single operational workflow.

The current prototype is demonstrated using a **Puri, Odisha coastal cyclone scenario**, using real geospatial data derived from OpenStreetMap together with a controlled cyclone scenario.

Instead of stopping at:

```text
A cyclone is coming.
```

the system aims to answer:

```text
What is likely to be affected?
        ↓
Which infrastructure matters most?
        ↓
What dependencies could fail?
        ↓
What should responders do first?
        ↓
Who is responsible?
        ↓
Did the field action actually happen?
        ↓
What changed after the action?
```

---

# 🎯 Problem

Disaster management systems often provide excellent information about the **hazard itself**, but operational teams still face a difficult transition from:

**forecast → infrastructure impact → prioritisation → field action → verification**

For example, knowing that a cyclone is approaching does not automatically answer:

* Which roads are at risk?
* Which infrastructure assets are exposed?
* Which critical assets should be prioritised?
* What infrastructure depends on what?
* Which response mission should happen first?
* Has the assigned team acknowledged the mission?
* Was the field action actually completed?
* Does new field evidence change the priority?
* Should the mission be resolved, reopened, or escalated?

PralaySetu + Sankat OS is designed around this operational gap.

---

# 💡 Solution

The platform is divided into two complementary systems.

## 🧠 PralaySetu — Intelligence Brain

PralaySetu converts hazard information into operational intelligence.

```text
Hazard
  ↓
Impact Analysis
  ↓
Infrastructure Exposure
  ↓
Road Risk
  ↓
Dependency / Cascade Analysis
  ↓
Priority Scoring
  ↓
Response Missions
```

It answers:

> **“What is likely to be affected, how important is it, and what should receive attention first?”**

---

## 🛰️ Sankat OS — Execution Brain

Sankat OS converts prioritised risks into accountable field operations.

```text
Priority
  ↓
Mission
  ↓
Assignment
  ↓
Acknowledgement
  ↓
Field Action
  ↓
Evidence
  ↓
Gemini Verification
  ↓
Reassessment
  ↓
Human Review
  ↓
Resolve / Reopen / Escalate
```

It answers:

> **“What should the response team do, who owns it, and can the result be verified?”**

---

# 🔄 End-to-End Workflow

The current prototype implements the following operational loop:

```text
┌──────────────┐
│    Hazard    │
└──────┬───────┘
       ↓
┌──────────────┐
│ Impact       │
│ Analysis     │
└──────┬───────┘
       ↓
┌──────────────┐
│ Infrastructure│
│ Exposure     │
└──────┬───────┘
       ↓
┌──────────────┐
│ Dependency / │
│ Cascade      │
└──────┬───────┘
       ↓
┌──────────────┐
│ Priority     │
└──────┬───────┘
       ↓
┌──────────────┐
│ Mission      │
└──────┬───────┘
       ↓
┌──────────────┐
│ Assignment   │
└──────┬───────┘
       ↓
┌──────────────┐
│ Acknowledge  │
└──────┬───────┘
       ↓
┌──────────────┐
│ Field Action │
└──────┬───────┘
       ↓
┌──────────────┐
│ GPS + Photo  │
│ + Notes      │
└──────┬───────┘
       ↓
┌──────────────┐
│ Gemini       │
│ Verification │
└──────┬───────┘
       ↓
┌──────────────┐
│ Reassessment │
└──────┬───────┘
       ↓
┌──────────────┐
│ Human Review │
└──────┬───────┘
       ↓
┌─────────────────────────┐
│ Resolve / Reopen /      │
│ Escalate                │
└─────────────────────────┘
```

---

# 🗺️ Current Pilot

The prototype currently uses **Puri, Odisha** as the demonstration geography.

### Current pilot data

| Component                                  |           Current Prototype |
| ------------------------------------------ | --------------------------: |
| Infrastructure assets                      |                      **51** |
| Road features                              |                  **~1,930** |
| Candidate spatial dependency relationships |                     **123** |
| Geography                                  |            **Puri, Odisha** |
| Road / infrastructure geography            |       OpenStreetMap-derived |
| Map format                                 |                     GeoJSON |
| Hazard                                     | Controlled cyclone scenario |
| AI verification                            |           Gemini multimodal |
| Frontend map                               |                     Leaflet |

> **Note:** The 123 relationships are candidate spatial dependency relationships generated for the prototype. They should not be interpreted as verified causal infrastructure dependencies.

---

# 🧠 Core Intelligence Engines

PralaySetu is built as a modular intelligence pipeline.

## 1. Impact Engine

Processes the supplied hazard scenario and determines which infrastructure and operational elements are potentially exposed.

---

## 2. Priority Engine

Combines factors such as:

* asset criticality
* hazard exposure
* dependency relationships
* operational importance

to produce a prioritised response view.

---

## 3. Road Risk Engine

Analyses road geometry against the supplied hazard scenario and generates road-risk scores.

This allows the system to reason about potential accessibility and transportation risks.

---

## 4. Road Priority Engine

Converts road-risk information into operational road priorities.

---

## 5. Dependency Engine

Models potential infrastructure and road cascades.

Example:

```text
Flooded / blocked road
        ↓
Reduced accessibility
        ↓
Affected infrastructure
        ↓
Potential secondary operational impact
```

This helps move beyond isolated asset-level risk.

---

## 6. Mission Engine

Converts prioritised infrastructure and road risks into actionable response missions.

Each mission can contain information such as:

* target
* priority
* reason
* recommended action
* status
* ownership
* evidence
* verification state

---

## 7. Reassessment Engine

After field evidence is submitted, the system can compare the observed field state with the earlier assessment and produce an updated operational assessment.

The resulting mission moves into **human review** rather than being automatically closed.

---

# 🤖 Gemini-Powered AI

Gemini is integrated into the operational workflow rather than being used only as a chatbot.

## Multimodal Evidence Verification

Field teams can submit evidence such as:

* photographs
* field notes
* GPS information

The evidence is sent through the verification workflow where Gemini analyses the submitted visual evidence and produces structured verification information.

```text
Field Evidence
      ↓
Gemini Multimodal Analysis
      ↓
Observed Field State
      ↓
Reassessment
      ↓
Human Review
```

This creates a feedback loop between **predicted impact** and **observed reality**.

---

# 🧩 Agent-Oriented Architecture

The system is designed around four logical AI/agent roles:

### 1. Impact Analysis Agent

Responsible for interpreting hazard information and infrastructure impact.

### 2. Mission Planning Agent

Converts prioritised risks into operational missions.

### 3. Evidence Verification Agent

Uses Gemini multimodal capabilities to analyse field evidence.

### 4. Reassessment Agent

Uses newly observed field information to reassess operational risk.

### Important implementation note

The current project demonstrates **Gemini integration for multimodal evidence verification and reassessment**.

The four roles represent an **agent-oriented architecture**. They should not be interpreted as four independently deployed Vertex AI agents in the current prototype.

---

# 👷 Field Operations

Sankat OS includes a dedicated field mission workflow.

A responder can:

1. Open an assigned mission
2. Acknowledge the mission
3. Start the mission
4. Capture field information
5. Provide GPS coordinates
6. Add notes
7. Upload photographic evidence
8. Complete the field task
9. Trigger evidence verification
10. Review reassessment results

The mission can then be:

```text
RESOLVE
   or
REOPEN
   or
ESCALATE
```

This creates an explicit human-in-the-loop accountability layer.

---

# 🔁 Mission Lifecycle

The implemented mission lifecycle includes:

```text
PENDING
   ↓
ASSIGNED
   ↓
ACKNOWLEDGED
   ↓
STARTED
   ↓
COMPLETED
   ↓
VERIFIED
   ↓
HUMAN REVIEW
   ↓
RESOLVED
```

Alternative operational paths:

```text
Human Review
    ├── Resolve
    ├── Reopen
    └── Escalate
```

---

# 🗺️ Operational Map

The command centre uses an interactive map to visualise operational geography.

The current prototype uses:

* OpenStreetMap-derived data
* GeoJSON
* Leaflet
* processed road data
* processed infrastructure data

The map provides the spatial foundation for:

* infrastructure visibility
* road analysis
* hazard context
* operational prioritisation

---

# 🖥️ Application Architecture

```text
                    ┌───────────────────────┐
                    │      Next.js UI       │
                    │  Officer Command      │
                    │  Centre + Field UI    │
                    └───────────┬───────────┘
                                │
                                │ REST API
                                ↓
                    ┌───────────────────────┐
                    │      FastAPI          │
                    │       Backend         │
                    └───────────┬───────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ↓                   ↓                   ↓
     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
     │ Intelligence│     │  Missions   │     │  Evidence   │
     │   Engines   │     │  Workflow   │     │ Verification│
     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
            │                   │                   │
            ↓                   ↓                   ↓
     ┌────────────────────────────────────────────────────┐
     │              Geospatial / Operational Data         │
     │       GeoJSON • Roads • Infrastructure • OSM       │
     └────────────────────────────────────────────────────┘
                                │
                                ↓
                     ┌─────────────────────┐
                     │       Gemini        │
                     │ Multimodal AI       │
                     └─────────────────────┘
```

---

# 🛠️ Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* Leaflet

## Backend

* Python
* FastAPI
* Pydantic
* REST APIs

## Geospatial

* OpenStreetMap-derived data
* GeoJSON
* Leaflet
* processed road and infrastructure datasets

## AI

* Gemini API
* Gemini multimodal capabilities

## Intelligence

* Impact analysis
* Priority scoring
* Road risk
* Road priority
* Dependency/cascade analysis
* Mission generation
* Reassessment

---

# 📁 Project Structure

```text
pralaysetu-sankat-os/
│
├── backend/
│   └── app/
│       ├── main.py
│       │
│       ├── api/
│       │   ├── scenarios.py
│       │   ├── assets.py
│       │   ├── hazards.py
│       │   ├── missions.py
│       │   ├── field_evidence.py
│       │   ├── verification.py
│       │   └── operational_map.py
│       │
│       ├── services/
│       │   ├── gemini_service.py
│       │   ├── hazard.py
│       │   ├── impact_engine.py
│       │   ├── priority_engine.py
│       │   ├── road_risk_engine.py
│       │   ├── road_priority_engine.py
│       │   ├── dependency_engine.py
│       │   ├── mission_engine.py
│       │   └── reassessment_engine.py
│       │
│       └── models/
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   └── field/
│   │       └── page.tsx
│   │
│   ├── components/
│   │   └── OperationalMap.tsx
│   │
│   └── lib/
│       └── api.ts
│
├── data/
│   ├── raw/
│   └── processed/
│       ├── puri_assets.json
│       ├── puri_dependencies.json
│       ├── puri_operational_map.geojson
│       └── puri_roads.geojson
│
├── README.md
└── ...
```

---

# 🔌 API Workflow

The backend exposes REST APIs for the complete operational lifecycle.

### Health

```http
GET /
GET /health
```

### Scenarios

```http
GET /api/scenarios
```

### Assets

```http
GET /api/assets
```

### Hazard

```http
GET /api/hazard
POST /api/hazard
```

### Operational Map

```http
GET /api/operational-map
```

### Missions

```http
GET /api/missions
GET /api/missions/{mission_id}
PATCH /api/missions/{mission_id}/status
```

### Mission Operations

```http
POST /api/missions/{mission_id}/assign
POST /api/missions/{mission_id}/acknowledge
POST /api/missions/{mission_id}/start
POST /api/missions/{mission_id}/complete
```

### Evidence

```http
POST /api/missions/{mission_id}/evidence/upload
```

### AI Verification

```http
POST /api/missions/{mission_id}/verify
```

### Human Review

```http
POST /api/missions/{mission_id}/human-review
POST /api/missions/{mission_id}/resolve
POST /api/missions/{mission_id}/reopen
POST /api/missions/{mission_id}/escalate
```

---

# 🚀 Getting Started

## Prerequisites

Install:

* Python 3.11+
* Node.js 18+
* npm
* Git

A Gemini API key is required for AI-powered evidence verification.

---

## 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd pralaysetu-sankat-os
```

---

# ⚙️ Backend Setup

Navigate to the backend:

```bash
cd backend
```

Create a virtual environment:

### Windows

```powershell
python -m venv .venv
.venv\Scripts\activate
```

### Linux / macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

---

## 🔐 Configure Gemini

Create a `.env` file according to the environment configuration used by the project.

Example:

```env
GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>
```

> Never commit API keys, credentials, or secrets to GitHub.

---

## ▶️ Start Backend

From the backend directory:

```bash
uvicorn app.main:app --reload
```

The API will be available at:

```text
http://localhost:8000
```

Health check:

```text
http://localhost:8000/health
```

---

# 💻 Frontend Setup

Open another terminal.

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:3000
```

---

# 🔗 Frontend ↔ Backend Configuration

Configure the frontend API base URL according to the environment configuration used by the project.

For local development, it will typically point to:

```text
http://localhost:8000
```

For deployment, replace it with the deployed backend URL.

---

# 🧪 Demo Flow

The recommended demonstration sequence is:

### Step 1 — Open Command Centre

Show the operational dashboard and map.

### Step 2 — Select Cyclone Scenario

Load the controlled cyclone scenario.

### Step 3 — Run Impact Analysis

Show potentially affected infrastructure and roads.

### Step 4 — Show Dependencies

Demonstrate how infrastructure/road relationships influence priority.

### Step 5 — Generate Missions

Convert prioritised risks into actionable missions.

### Step 6 — Assign Mission

Assign the mission to a responder/team.

### Step 7 — Acknowledge

The field responder acknowledges the mission.

### Step 8 — Start Field Mission

Open the field interface.

### Step 9 — Capture Evidence

Submit:

* GPS
* photograph
* field notes

### Step 10 — Gemini Verification

Send evidence through the multimodal verification workflow.

### Step 11 — Reassessment

Generate an updated operational assessment.

### Step 12 — Human Review

Review the new assessment.

### Step 13 — Decision

Choose:

```text
Resolve
Reopen
Escalate
```

This demonstrates the complete:

**Hazard → Impact → Mission → Field Evidence → AI Verification → Reassessment → Human Decision**

loop.

---

# 📊 Current Implementation Status

## ✅ Implemented

* FastAPI backend
* Next.js frontend
* Officer command centre
* Field mission interface
* Puri pilot dataset
* OpenStreetMap-derived geography
* GeoJSON operational map
* Infrastructure impact analysis
* Road risk analysis
* Road priority analysis
* Dependency/cascade analysis
* Priority scoring
* Mission generation
* Mission assignment
* Mission acknowledgement
* Mission start
* Mission completion
* GPS field information
* Photo evidence
* Field notes
* Evidence upload
* Gemini multimodal verification
* Reassessment workflow
* Human review
* Resolve / reopen / escalate lifecycle
* Controlled cyclone scenario
* REST API workflow

---

# 🛣️ Roadmap

The current prototype is intentionally designed so that it can evolve into a larger India-scale disaster intelligence platform.

## 🌍 Geospatial Scale

Planned integrations include:

* Google Earth Engine
* larger satellite datasets
* elevation analysis
* expanded infrastructure datasets
* state-level geospatial layers
* national-scale processing

---

## ☁️ Cloud Architecture

Future production architecture can use:

* Google Cloud Run
* Vertex AI
* BigQuery / BigQuery GIS
* Firebase
* Cloud Functions

This would allow persistent, scalable processing across larger geographies.

---

## 🤖 AI & Agent Expansion

Future versions can expand the agent-oriented architecture using:

* Vertex AI
* Gemini
* structured tool calling
* RAG
* specialised disaster-response agents
* automated mission planning
* predictive models

---

## 🌐 Multilingual & Voice Response

Planned capabilities include:

* Hindi
* Odia
* English
* Speech-to-Text
* Text-to-Speech
* Translation API
* Dialogflow

This is particularly important for last-mile field operations.

---

## 📡 Offline Field Operations

A future field application can support:

* offline mission access
* local evidence storage
* GPS capture without connectivity
* queued uploads
* automatic synchronisation when connectivity returns

---

## 🌦️ Live Disaster Feeds

Future versions can integrate live operational feeds such as:

* IMD weather information
* satellite observations
* rainfall
* wind
* flood information
* emergency infrastructure status

---

# 🇮🇳 India-Scale Vision

The current implementation starts with a focused **Puri, Odisha pilot**.

The architecture is designed to expand:

```text
Puri
  ↓
Odisha
  ↓
Coastal States
  ↓
India
```

The same architecture can support multiple hazards:

```text
🌪️ Cyclone
      │
      ├── Infrastructure Risk
      ├── Road Risk
      └── Response Missions

🌊 Flood
      │
      ├── Infrastructure Risk
      ├── Accessibility
      └── Response Missions

🔥 Heatwave
      │
      ├── Vulnerable Areas
      └── Response Missions

⛰️ Landslide
      │
      ├── Road Risk
      ├── Infrastructure Exposure
      └── Response Missions

🌍 Earthquake
      │
      ├── Infrastructure Exposure
      ├── Dependency Impact
      └── Response Missions
```

---

# 🔐 Human-in-the-Loop by Design

PralaySetu + Sankat OS does not treat AI output as an unquestionable decision.

The system follows:

```text
AI Assessment
      ↓
Field Evidence
      ↓
AI Verification
      ↓
Reassessment
      ↓
Human Review
      ↓
Operational Decision
```

This design helps maintain:

* accountability
* auditability
* human oversight
* operational control
* evidence-based decisions

---

# ⚠️ Prototype Limitations

This repository represents a **working disaster-response prototype**, not a certified emergency-management system.

Important limitations include:

* Current hazard analysis uses controlled/realistic scenarios.
* Current risk engines are deterministic prototype models rather than certified scientific damage-prediction systems.
* Current mission state is held in application memory and is not yet backed by production-grade persistent storage.
* The current map uses OpenStreetMap-derived geography.
* Live IMD operational integration is not part of the demonstrated MVP.
* Google Earth Engine is part of the planned scaling architecture, not a required current runtime dependency.
* Production Vertex AI agent deployment is part of the scaling roadmap.
* Offline PWA functionality is planned rather than fully implemented.
* Full multilingual voice workflow is part of the roadmap.
* The prototype has not been presented as a live government deployment.

These limitations are intentional and identify the next engineering steps required for productionisation.

---

# 🏗️ Production Architecture — Future

A future production deployment could evolve toward:

```text
                    DATA SOURCES
                         │
       ┌─────────────────┼──────────────────┐
       ↓                 ↓                  ↓
   Satellite          Weather          Infrastructure
       │                 │                  │
       └─────────────────┼──────────────────┘
                         ↓
                Google Earth Engine
                         ↓
                    BigQuery GIS
                         ↓
                 ┌───────────────┐
                 │  PralaySetu   │
                 │ Intelligence  │
                 └───────┬───────┘
                         ↓
             Gemini / Vertex AI
                         ↓
                  Priority Engine
                         ↓
                   Sankat OS
                         ↓
             Mission Assignment
                         ↓
              Field Application
                         ↓
          GPS + Photo + Voice + Notes
                         ↓
                 Gemini Verification
                         ↓
                    Reassessment
                         ↓
                   Human Review
                         ↓
              Resolve / Reopen / Escalate
```

---

# 🎯 Why This Architecture Matters

Most disaster workflows can be represented as:

```text
Detect → Alert → Respond
```

PralaySetu + Sankat OS extends this into:

```text
Detect
  ↓
Understand Impact
  ↓
Understand Dependencies
  ↓
Prioritise
  ↓
Create Mission
  ↓
Assign
  ↓
Execute
  ↓
Collect Evidence
  ↓
Verify
  ↓
Reassess
  ↓
Human Review
  ↓
Resolve / Reopen / Escalate
```

The key idea is not simply **predicting disaster risk**.

It is creating a feedback loop between:

**prediction → action → evidence → verification → reassessment**

---

# 🏆 Code for Communities 2.0 Alignment

## Problem–Solution Fit — 20%

The project directly addresses the operational gap between:

**hazard warning → infrastructure impact → prioritised action → verified response**

---

## AI / Technical Execution — 25%

The prototype combines:

* Gemini multimodal AI
* geospatial intelligence
* dependency modelling
* deterministic risk engines
* mission orchestration
* evidence verification
* reassessment
* REST APIs
* human-in-the-loop operations

---

## Depth & Reach Across India — 20%

The prototype begins with Puri, Odisha while maintaining an architecture designed for:

* Odisha
* coastal states
* larger Indian geographies
* multiple disaster types

---

## Impact Potential — 15%

Potential operational benefits include:

* better infrastructure visibility
* prioritised response
* dependency-aware planning
* evidence-based field verification
* improved accountability
* faster reassessment of changing conditions

No unverified claims about lives saved or economic losses prevented are made by this prototype.

---

## Deployability & Scalability — 20%

The architecture is designed for future integration with:

* Cloud Run
* Vertex AI
* BigQuery GIS
* Firebase
* Earth Engine
* Maps Platform
* voice services
* live disaster feeds

---

# 🌟 Key Differentiator

PralaySetu + Sankat OS is not designed as another disaster information dashboard.

It connects:

```text
GEOSPATIAL INTELLIGENCE
          +
AI
          +
INFRASTRUCTURE DEPENDENCIES
          +
MISSION MANAGEMENT
          +
FIELD EVIDENCE
          +
AI VERIFICATION
          +
HUMAN REVIEW
```

into one operational loop.

> **PralaySetu finds the impact.
> Sankat OS makes the response accountable.**

---

# 📜 Project Status

**Status:** Working Prototype

**Pilot Geography:** Puri, Odisha, India

**Primary Hazard:** Cyclone

**Primary AI:** Gemini Multimodal

**Architecture:** India-scale disaster-response platform

**Deployment:** Frontend/backend deployment is being finalised; production cloud architecture is part of the scaling roadmap.

---

# 👥 Intended Users

The system is designed conceptually for disaster-response operations involving:

* district disaster management teams
* emergency response coordinators
* infrastructure teams
* field responders
* road and public-works teams
* local administration
* emergency operations centres

The current implementation is a prototype and has not been represented as a live government deployment.

---

# 📄 License

Add the project's chosen open-source license here, for example:

```text
MIT License
```

if the repository is intended to be released under MIT.

---

# 🤝 Contribution

Contributions are welcome.

Potential areas include:

* new hazard models
* additional geospatial datasets
* satellite integration
* improved dependency modelling
* AI agent workflows
* multilingual support
* offline field operations
* cloud deployment
* disaster-specific modules

---

# 🚀 Vision

Disasters do not end when a warning is issued.

The real challenge begins when responders need to answer:

> **What is affected?**

> **What should we do first?**

> **Who should do it?**

> **Did it actually happen?**

> **What changed after we acted?**

PralaySetu + Sankat OS is built around answering those questions in one continuous operational loop.

## 🌊 From Forecast → Impact → Mission → Evidence → Verification → Action

### **PralaySetu finds the impact. Sankat OS makes the response accountable.**
