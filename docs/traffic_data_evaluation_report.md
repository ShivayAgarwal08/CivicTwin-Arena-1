# CivicTwin Arena: Real-World Traffic Data Sources Evaluation & Data Architecture

## 1. Executive Summary & Objective

CivicTwin Arena aims to provide municipal planners and traffic engineers with credible, transparent decision-support tools. A critical requirement for credibility is **intellectual honesty regarding data provenance**:
- OpenStreetMap (OSM) provides rich **network geometry and topological connectivity**, but does **not** provide live traffic counts, observed vehicle speeds, or volume measurements.
- Real-world traffic simulations must strictly separate what was **directly observed**, what was **derived from GIS geometry**, what was **assumed/modeled based on civil engineering codes (e.g., IRC:106)**, and what is a **simulation output**.

---

## 2. Comprehensive Evaluation of Traffic Data Sources in India

| Provider | Data Offered | Coverage in India | API Accessibility & Free Tier | Licensing / Attribution | Live Observed Counts / Speeds? | Recommendation for CivicTwin |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OpenStreetMap (Overpass API / Nominatim)** | Road centerlines, road class (`primary`, `secondary`, etc.), surface, one-way tags, lane count (when tagged), junction topology. | Pan-India coverage. High fidelity in Tier-1 & Tier-2 cities; variable lane tagging in peripheral corridors. | 100% Free & Open API. Overpass API rate-limited to ~10k requests/day with caching. | Open Database License (ODbL). Requires clear attribution: `© OpenStreetMap contributors`. | **NO observed speeds or counts.** Strictly geometric & taxonomic. | **Primary Road Network Backbone.** Used for dynamic geometry extraction, network graph construction, and routing. |
| **TomTom Traffic Flow & Incidents API** | Current vehicle speed, free-flow speed, travel time, confidence score, road closure/incident polygons. | High coverage across 50+ Indian urban agglomerations (Delhi-NCR, Mumbai, Bengaluru, Hyderabad, Chennai, Pune, etc.). Derived from connected vehicle GPS probes. | Free Developer tier: **2,500 free transactions/day**. Easy REST JSON endpoints (`flowSegmentData`). | Commercial freemium. Requires attribution and API key. | **YES: Observed average vehicle speeds and delay ratio ($v / v_{free}$).** Does NOT provide absolute vehicle volume (vph counts). | **Strong Candidate for Observed Speeds.** Excellent for validating BPR travel times against actual probe speeds during peak hours. |
| **HERE Traffic Flow v7** | Real-time speeds, Jam Factor (0–10 scale), segment traversability, incident details. | Extensive coverage across major Indian arterial corridors and national highways. | Freemium: **250,000 free transactions/month** in Developer tier. REST API returning XML/JSON. | Commercial freemium. Strict cache limits (max 5 minutes). | **YES: Observed probe speeds and jam factor.** No vehicle volume counts. | **Strong Candidate for Congestion Index.** Jam factor provides direct ground truth for bottleneck locations. |
| **Mappls (MapmyIndia) Traffic API** | Real-time traffic conditions, congestion levels, incidents, Indianized road classes. | Deepest pan-India road tagging, excellent local landmark and lane attribution. | Free trial on developer portal; commercial enterprise contract required for sustained production traffic feeds. | Proprietary Indian mapping license. Key strictly required. | **YES: Congestion status & speeds.** No public vehicle counts. | **Optional Enterprise Add-on.** Useful if deploying specific Indian municipal pilot deployments with enterprise sponsorship. |
| **Google Routes / Traffic** | Duration in traffic, congestion levels (`NORMAL`, `SLOW`, `TRAFFIC_JAM`). | Ubiquitous Indian coverage based on Android device telemetry. | Paid billing account required ($200 monthly free credit). No raw vehicle speed API—only route duration. | Proprietary commercial license. Strict display restrictions (requires Google Maps display). | **YES (derived duration).** No vehicle count or volume data. | **Not Recommended for Core Simulation.** Terms of Service prohibit separating traffic data from Google Maps rendering tiles. |
| **Government Open Data (OpenCity.in / Delhi Open Data / MoRTH)** | Periodic cordon vehicle classification counts, manual tally surveys, bus GPS feeds (e.g. Delhi DIMTS). | Sporadic. Specific intersections or corridors surveyed for master plans (e.g. DMRC, CIDCO, BBMP). | Open datasets (CSV / GeoJSON / PDF survey reports). Free public access. | National Open Data Sharing and Accessibility Policy (NDSAP). | **YES (historical observed volume counts), but STATIC.** Not continuous real-time feeds. | **Benchmark Calibration Reference.** Used to establish realistic OD demand baselines and peak hour volumes for Indian urban corridors. |

---

## 3. Four-Tier Data Provenance Architecture

To eliminate ambiguity and prevent misleading claims, CivicTwin Arena categorizes every data field into four distinct tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CIVICTWIN DATA PROVENANCE MODEL                       │
└─────────────────────────────────────────────────────────────────────────────┘
  │
  ├── [TIER A] OBSERVED DATA (External Empirical Measurements)
  │    ├── Ground-truth vehicle probe speed (km/h) [Source: TomTom / Probe]
  │    ├── Real-time Jam Factor (0-10) [Source: HERE API]
  │    ├── Manual Cordon Peak Counts (vph) [Source: Municipal Survey / OpenCity]
  │    └── Timestamp, sample window, and empirical confidence interval
  │
  ├── [TIER B] NETWORK-DERIVED DATA (Directly Extracted from GIS Topology)
  │    ├── Road segment length (meters) [Computed via WGS84 Haversine / Polyline]
  │    ├── Functional Road Hierarchy (`primary`, `secondary`, `tertiary`)
  │    ├── Node coordinates & intersection topology (Leaflet WGS84 [lat, lon])
  │    └── Lane count & one-way restrictions (extracted from OSM tags)
  │
  ├── [TIER C] SIMULATION INPUTS (Engineered Assumptions & Regulatory Codes)
  │    ├── Base link capacity (vph) [Calibrated via Indian Roads Congress IRC:106-1990]
  │    ├── Free-flow speed assumptions (km/h) based on road class
  │    ├── Peak hour evaluation duration (default: 1.0 hour)
  │    ├── Origin-Destination Trip Demand Matrix (vph)
  │    └── Signal cycle time & effective green splits (Webster timing assumptions)
  │
  ├── [TIER D] SIMULATION OUTPUTS (Model Computations)
  │    ├── BPR Travel Time & Queue Delay (s/veh)
  │    ├── Estimated Maximum Physical Queue Length (m)
  │    ├── Network-wide Throughput (vph) & Total Delay (veh-hours)
  │    ├── Surrounding link spillover classification (`newly_congested`, etc.)
  │    └── Multi-criteria normalized scoring and trade-off comparison
```

---

## 4. Implementation Strategy for Dynamic Road Networks

1. **OSM Dynamic Study Area Ingestion:**
   - User types a location or specifies an urban corridor.
   - Backend queries Nominatim to get bounding coordinates.
   - Overpass API downloads all connected highway ways within a calibrated radius (e.g., 600m–1200m).
   - Graph builder extracts intersection nodes, filters for connected giant component, prunes orphaned links, and assigns IRC:106 capacities.
   - If an area cannot support a connected corridor, return explicit diagnostic errors (e.g., "Insufficient connected highway ways in selected radius") without faking presets.

2. **Transparent Assumptions Inspector:**
   - The UI surfaces an interactive assumptions drawer exposing IRC:106 capacity tables, BPR polynomial exponents ($\alpha=0.15, \beta=4.0$), Webster cycle equations, and cost metrics.

