# CivicTwin Arena — Map-First Urban Traffic Planning & Three-Alternative Studio

> A map-first, AI-assisted urban traffic planning and intervention comparison platform for urban planners, municipal authorities, traffic engineers, and researchers.

---

## 1. What is CivicTwin Arena?

CivicTwin Arena is designed to let planners and engineers test proposed changes to real road networks, compare their predicted consequences against the existing baseline, and discover whether an AI-assisted or human-crafted intervention produces a better overall outcome.

It directly exposes **trade-offs** and **spillover effects**:
- Widening a corridor may improve local throughput while choking downstream residential collectors.
- A human-crafted offline pick-up bay may solve curbside campus friction cleanly at 1/10th the cost of an AI recommendation.
- An intervention may introduce secondary bottlenecks so severe that the **Baseline Network** emerges as the most defensible choice.
- **Fair evaluation**: No predetermined winners, hardcoded labels, or fabricated score adjustments.

---

## 2. The Three-Alternative Comparison Workflow

Every planning scenario supports three competing alternatives evaluated under identical traffic demand, network scope, and mathematical assumptions:

1. **A. Existing Network — The Baseline**:
   - Reference condition representing the current network without interventions.
   - Shows modeled evening peak demand, queue conditions, vehicle delay, and volume-to-capacity ($V/C$) ratios.
   - Remains completely unchanged when editing proposed interventions.

2. **B. My Proposal — The Human Alternative**:
   - The user selects a road on the map and configures concrete physical or operational interventions:
     * **Dedicated Curbside Pick-up / Drop-off Bay**: Eliminates curbside friction (e.g. parents, auto-rickshaws, and ride-hail cabs blocking lanes outside college gates or metro stations).
     * **Add Travel Lane / Road Widening**: Increases directional carriageway capacity by +1,100 vph per lane.
     * **Traffic Signal Phase Re-timing**: Reallocates green split ($\lambda = g/C$) to clear congested approaches.
     * **One-Way Reversal & Channelization**: Re-routes directional flows and eliminates turning conflicts.
     * **Traffic Calming**: Speed cushions to protect residential streets from cut-through rat-running.
     * **Median Gap Closure**: Eliminates hazardous right-turn friction points.

3. **C. AI Proposal — The Independent Alternative**:
   - Analyzes network topology, bottleneck locations, and the user's stated planning objective.
   - Evaluates plausible alternative candidates and selects an inspectable, model-justified proposal.
   - Never copies the user's proposal; provides an explicit engineering rationale, trade-offs, and assumptions.

---

## 3. Simulation Model & Mathematical Foundations

### A. Link Performance Function (BPR + Webster Extension)
Link travel time $t_a(v_a)$ is derived from the calibrated Bureau of Public Roads (BPR) function:
$$t_a(v_a) = t_{0, a} \cdot \left[ 1 + \alpha \left(\frac{v_a}{C_a}\right)^\beta \right]$$
- $t_{0, a} = \frac{\text{Length}_a}{v_{0, a} / 3.6}$ (free-flow travel time)
- $\alpha = 0.15, \beta = 4.0$ (standard urban road flow)
- For signalized approaches, Webster's uniform and incremental delay is incorporated:
  $$d_{\text{signal}} = \frac{C_{\text{cycle}} (1 - \lambda)^2}{2(1 - \lambda x)} + \frac{x^2}{2 q (1 - x)}$$

### B. Dynamic Oversaturation Queuing
When volume $v_a > C_a$ during peak duration $T_{\text{peak}}$:
$$\text{Queue (vehicles)} = (v_a - C_a) \cdot \frac{T_{\text{peak}}}{60}$$
$$\text{Queue Length (meters)} = \text{Queue (veh)} \times 7.5\text{ m/veh}$$

### C. Multi-Path Traffic Assignment (Logit Route Choice)
OD flows are assigned across paths using generalized travel cost:
$$P(p) = \frac{\exp(-\theta \cdot T_p)}{\sum_{k} \exp(-\theta \cdot T_k)}$$
Ensures that widening a road realistically attracts diverted trips (induced local volume), while restrictions divert traffic to adjacent parallel streets.

### D. Spillover Classification
Surrounding links not directly modified are classified based on relative delay change $\delta$:
- **Improved**: $\delta \le -10\%$ (delay reduced $\ge 10\%$)
- **Neutral**: $-10\% < \delta \le +5\%$ (equilibrium maintained)
- **Moderate**: $+5\% \le \delta \le +20\%$ (minor traffic spillover)
- **Deteriorated**: $\delta > +20\%$ (noticeable queue spillover)
- **Newly Congested**: Baseline $V/C < 0.85 \to$ Proposed $V/C \ge 0.95$ (severe induced bottleneck)

### E. Transparent Composite Decision Score (0 - 100)
$$\text{Score} = \text{DelayComponent}(35) + \text{QueueComponent}(25) + \text{SpilloverComponent}(25) + \text{CostEfficiency}(15)$$
- All components and formulas are exposed in the UI breakdown drawer.

---

## 4. Real-World Corridor Presets Included

1. **Jaypee Institute of Information Technology (JIIT) Sector 128 & Wish Town, Noida**:
   - Real OSM geometry for Wish Town Boulevard, Expressway Service Road, and Jaypee Hospital Chowk.
   - Calibrated 3:00 PM - 7:00 PM college dispersal & parent pick-up congestion.
2. **Botanical Garden Metro Interchange, Noida**:
   - Real OSM Dadri Main Road & Captain Shashi Kant Marg corridor.
   - Evening commuter rush with auto-rickshaw boarding curb-choke.
3. **Noida Sector 62 & Electronic City Metro**:
   - Fortis Hospital Chowk, Electronic City terminal, and institutional campus ring (JIIT Sec 62, Symbiosis).
4. **Custom OpenStreetMap Search**:
   - Free Nominatim search bar to center on any campus or corridor worldwide.

---

## 5. Architecture & Directory Structure

```
three_alternative_comparison/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI endpoints & CORS
│   │   ├── models/schemas.py        # Pydantic schemas for nodes, links, proposals, reports
│   │   ├── simulation/
│   │   │   ├── bpr_engine.py        # BPR travel time, Webster signal delay, queue dynamics
│   │   │   ├── assignment.py        # Multi-path Logit equilibrium assignment
│   │   │   ├── spillover.py         # Link-by-link spillover classifier
│   │   │   └── evaluator.py         # 3-Alternative evaluator & transparent scoring
│   │   ├── interventions/
│   │   │   ├── catalog.py           # Supported interventions & engineering rate schedule
│   │   │   └── ai_generator.py      # Independent AI candidate generator
│   │   └── data/
│   │       ├── osm_loader.py        # Overpass OSM API fetcher & Haversine geometry calculator
│   │       ├── presets.py           # Preset repository & loader
│   │       └── presets/             # High-fidelity verified real OSM corridor JSON files
│   ├── tests/
│   │   ├── test_bpr_engine.py       # Mathematical validation of BPR & queue equations
│   │   ├── test_scenarios_different_winners.py # Automated tests where Human, AI, and Baseline win fairly
│   │   └── test_api_endpoints.py    # FastAPI endpoint test suite
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Main 7-step studio orchestrator
│   │   ├── components/
│   │   │   ├── ScenarioHeader.tsx   # Top brand bar, presets, search, alternative switcher
│   │   │   ├── MapWorkspace.tsx     # Map-first Leaflet workspace with V/C coloring & badges
│   │   │   ├── ProposalBuilder.tsx  # Human intervention configurator & cost counter
│   │   │   ├── AIProposalCard.tsx   # Inspectable AI proposal card & rationale
│   │   │   ├── ComparisonTable.tsx  # Synchronized 3-alternative metrics comparison
│   │   │   ├── ComparisonCharts.tsx # Visual bar & delta charts
│   │   │   ├── SpilloverInspector.tsx # Surrounding links spillover analysis
│   │   │   └── DecisionReportModal.tsx # Printable official urban planning brief
│   │   ├── api/client.ts            # Typed client for backend API
│   │   ├── types/traffic.ts         # TypeScript interfaces
│   │   └── index.css                # Tailwind styling & Leaflet enhancements
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## 6. How to Run the Application Locally

### A. Run Backend API (FastAPI)
```bash
# In the project root:
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API docs available at: `http://localhost:8000/docs`

### B. Run Frontend (React + Vite)
```bash
# In a second terminal:
cd frontend
npm run dev
```
Open your browser at: `http://localhost:5173`

### C. Run Automated Tests
```bash
python -m pytest backend/tests -v
```
All 12 unit and scenario tests pass deterministically.
