# EcoSync – Smart Waste Management Digital Twin

A complete **software-only** simulation of a smart waste management system with Computer Vision classification, digital twin tracking, collector portal, and GenAI-powered reports.

---

## 📁 Project Structure (Frontend / Backend Separated)

```
waste_mangement/
│
├── index.html                  ← Main HTML page (entry point)
│
├── frontend/                   ← FRONTEND (UI, styles, rendering)
│   ├── css/
│   │   └── styles.css          ← All styling (white/light theme + 3D Twin HUD)
│   └── js/
│       └── ui.js               ← DOM rendering, 3D controls, navigation, event handlers
│
├── backend/                    ← BACKEND (3D engine, data, logic, API, SQLite)
│   ├── three.min.js            ← Offline Three.js 3D WebGL graphics library
│   ├── bin_twin_3d.js          ← ⭐ 3D Digital Dustbin Twin Engine (physics, flaps, CV scan, re-routing)
│   ├── config.js               ← API keys (Gemini AI)
│   ├── data.js                 ← State store, sample waste catalog, 3D drop recording
│   ├── api.js                  ← GenAI educational guidance & Python backend sync
│   ├── cv_bin_twin.py          ← Python Digital Twin engine, SQLite database & REST API (--serve)
│   └── waste_twin.db           ← SQLite database (users, bins, drops, pickups)
│
└── README.md                   ← This file
```

### What goes where?

| Layer | Files | Contains |
|-------|-------|----------|
| **Frontend** | `frontend/css/styles.css`, `frontend/js/ui.js` | CSS styling, 3D studio controls, DOM rendering, SVG flow diagrams, toast notifications |
| **Backend** | `backend/three.min.js`, `backend/bin_twin_3d.js`, `backend/config.js`, `backend/data.js`, `backend/api.js` | 3D WebGL digital twin, physics, state store, CV classification, GenAI feedback |
| **Python Backend** | `backend/cv_bin_twin.py`, `backend/waste_twin.db` | Merged backend from app.py: SQLite database, terminal dashboard, REST API server (`--serve`) |
| **Entry** | `index.html` | HTML structure, loads Three.js & backend engines first, then frontend |

---

## 🚀 How to Run

1. **Double-click** `index.html` to open in your browser
2. That's it — no server, no npm, no build step needed!

> The app runs entirely in the browser using vanilla HTML, CSS, and JavaScript.

---

## 🔑 Where to Add API Key (for real Gemini AI reports)

Open **`backend/config.js`** and paste your key on line 12:

```javascript
const GEMINI_API_KEY = 'YOUR_KEY_HERE';  // ← PASTE YOUR GEMINI API KEY HERE
```

**Get a free key at:** [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)

> Without an API key, the app still works — it uses simulated (offline) reports.

---

## 📋 Pages & Features

### 1. 📊 Dashboard
- 4 stat cards: Smart Bins count, Segregation Score, Active Alerts, Recycled %
- SVG locality map with colour-coded bins (green < 50%, amber 50-80%, red > 80%)
- Locality leaderboard with scores and trends
- Recycling & Processing Units status bars
- GenAI report generation (daily summary + "what-if add 1 truck" scenario)

### 2. 🗑️ Smart Bin CV (Computer Vision)
- 4 colour-coded bins: Wet (green), Dry (blue), Hazardous (red), Non-Recyclable (black)
- Photo upload with drag & drop
- Simulated CV classification with confidence bar
- Wrong-sort detection → alert + score penalty
- Recent scans gallery

### 3. 🚛 Collector Portal
- Login with role selection (Official Worker / Waste Picker)
- Bin alerts when fill > 60%
- Accept pickup → QR code scan simulation → weigh-in at drop-off
- Pickup history with status tracking

### 4. 🗺️ Waste Tracking
- Day lifecycle timeline (fill → collect → refill → alert → deliver)
- Animated SVG flow diagram: Households → Smart Bins → Trucks → 4 Destinations
- Active workers list with online/offline status
- Destination capacity bars
- Live event log

---

## ⏩ Simulation Controls

- **Clock** (sidebar): Shows simulated time starting at 6:00 AM
- **"Advance 1 hr" button**: Fast-forwards time, triggering:
  - 6–8 AM: Households fill bins
  - 8–10 AM: Official workers collect waste
  - 10 AM–5 PM: Bins refill during the day
  - When bin > 80%: Waste picker alerts triggered
  - Midnight: Daily reset

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Structure | Vanilla HTML5 |
| Styling | Vanilla CSS3 (light theme, CSS variables) |
| Logic | Vanilla JavaScript (ES6+) |
| Fonts | Montserrat + Anton (Google Fonts) |
| AI Reports | Google Gemini API (optional) |
| Server | None — runs from `file://` |

---

## Demo Credentials

For the Collector Portal login, use **any** Worker ID and password — the demo accepts all entries.
