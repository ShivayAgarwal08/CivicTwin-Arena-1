from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import requests

from .models.schemas import (
    NetworkNode,
    NetworkLink,
    TrafficDemandScenario,
    Proposal,
    ComparisonReport,
    LocationPresetSummary,
    AlternativeResult,
    InterventionType,
    StudyAreaSearchRequest,
    FetchOSMStudyAreaRequest,
    FetchOSMStudyAreaResponse,
    SaveStudyAreaRequest,
)
from .simulation.evaluator import TrafficScenarioEvaluator
from .interventions.ai_generator import AIInterventionGenerator
from .interventions.catalog import INTERVENTION_CATALOG
from .data.presets import PresetRepository
from .data.osm_loader import OSMLoader
from .simulation.router import CorridorRouter

app = FastAPI(
    title="CivicTwin Arena API",
    description="Map-first, AI-assisted urban traffic planning and three-alternative comparison platform.",
    version="1.0.0",
)

# Enable CORS for local dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

evaluator = TrafficScenarioEvaluator()
ai_generator = AIInterventionGenerator()


class CompareRequest(BaseModel):
    preset_id: Optional[str] = "jiit_sec128_noida"
    custom_nodes: Optional[List[NetworkNode]] = None
    custom_links: Optional[List[NetworkLink]] = None
    custom_demand: Optional[TrafficDemandScenario] = None
    human_proposal: Proposal
    ai_proposal: Optional[Proposal] = None
    location_name: Optional[str] = "JIIT Sector 128, Noida"
    problem_statement: Optional[str] = "Evening peak campus dispersal congestion"
    objective: Optional[str] = "Reduce vehicle delay and queue spillover without excessive financial or neighbor impact"


class GenerateAIProposalRequest(BaseModel):
    preset_id: Optional[str] = "jiit_sec128_noida"
    custom_nodes: Optional[List[NetworkNode]] = None
    custom_links: Optional[List[NetworkLink]] = None
    custom_demand: Optional[TrafficDemandScenario] = None
    human_proposal: Proposal
    user_objective: Optional[str] = "Reduce bottleneck delay and queue without neighbor spillover"


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "engine": "CivicTwin BPR + Webster + Multi-Path Logit Assignment Engine",
        "version": "1.0.0",
        "active_presets_count": len(PresetRepository.list_presets()),
    }


@app.get("/api/catalog")
def get_catalog():
    """Returns the catalog of supported interventions and engineering cost rates."""
    return INTERVENTION_CATALOG


@app.get("/api/presets", response_model=List[LocationPresetSummary])
def get_presets():
    """Returns list of real-world verified presets."""
    return PresetRepository.list_presets()


@app.get("/api/presets/{preset_id}")
def get_preset_detail(preset_id: str):
    """Returns network structure, geometry, and baseline evaluation for a preset."""
    data = PresetRepository.get_preset(preset_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Preset '{preset_id}' not found.")
    nodes, links, demand, meta = data

    # Compute baseline alternative
    baseline_proposal = Proposal(
        id="baseline",
        author="BASELINE",
        title="Existing Road Network (Baseline)",
        description="Current baseline road layout and modeled peak traffic flows without intervention.",
        interventions=[],
    )
    baseline_result = evaluator.evaluate_alternative(
        base_links=links,
        base_nodes=nodes,
        demand_scenario=demand,
        proposal=baseline_proposal,
        baseline_results=None,
    )

    routes = CorridorRouter.generate_routes_for_corridor(
        links=links,
        nodes=nodes,
        od_flows=demand.od_flows,
        link_performance=baseline_result.link_results,
    )

    return {
        "metadata": meta,
        "nodes": nodes,
        "links": links,
        "demand": demand,
        "baseline_result": baseline_result,
        "routes": routes,
    }


@app.get("/api/presets/{preset_id}/routes")
def get_preset_routes(preset_id: str):
    """Returns all topologically connected paths and turn-by-turn guidance for the corridor."""
    data = PresetRepository.get_preset(preset_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Preset '{preset_id}' not found.")
    nodes, links, demand, _ = data
    baseline_proposal = Proposal(id="base", author="BASELINE", title="Base", description="", interventions=[])
    baseline_result = evaluator.evaluate_alternative(links, nodes, demand, baseline_proposal)
    return CorridorRouter.generate_routes_for_corridor(links, nodes, demand.od_flows, baseline_result.link_results)


@app.post("/api/generate-ai-proposal", response_model=Proposal)
def generate_ai_proposal(req: GenerateAIProposalRequest):
    """
    Intelligently generates a distinct, inspectable alternative intervention
    grounded in the scenario's topology and bottleneck analysis.
    """
    nodes, links, demand = None, None, None
    if req.preset_id:
        data = PresetRepository.get_preset(req.preset_id)
        if data:
            nodes, links, demand, _ = data

    if not nodes or not links:
        nodes = req.custom_nodes or []
        links = req.custom_links or []
        demand = req.custom_demand

    if not links or not demand:
        raise HTTPException(status_code=400, detail="Missing network links or demand scenario.")

    # Run baseline to determine actual bottlenecks
    base_proposal = Proposal(
        id="baseline",
        author="BASELINE",
        title="Baseline",
        description="Baseline",
    )
    base_res = evaluator.evaluate_alternative(
        base_links=links,
        base_nodes=nodes,
        demand_scenario=demand,
        proposal=base_proposal,
    )

    ai_prop = ai_generator.generate_alternative_proposal(
        links=links,
        nodes=nodes,
        demand_scenario=demand,
        human_proposal=req.human_proposal,
        baseline_link_results=base_res.link_results,
        user_objective=req.user_objective or "Reduce delay without spillover",
    )
    return ai_prop


@app.post("/api/compare", response_model=ComparisonReport)
def compare_three_alternatives(req: CompareRequest):
    """
    Fairly evaluates all three alternatives (Baseline, Human, AI)
    under the identical scenario, traffic demand, and assumptions.
    """
    nodes, links, demand = None, None, None
    location_name = req.location_name
    problem_statement = req.problem_statement
    objective = req.objective

    if req.preset_id:
        data = PresetRepository.get_preset(req.preset_id)
        if data:
            nodes, links, demand, meta = data
            location_name = meta.get("name", location_name)
            problem_statement = meta.get("problem_statement", problem_statement)
            objective = meta.get("objective", objective)

    if req.custom_links and len(req.custom_links) > 0:
        links = req.custom_links
    if req.custom_nodes and len(req.custom_nodes) > 0:
        nodes = req.custom_nodes
    if req.custom_demand:
        demand = req.custom_demand

    if not links or not demand:
        raise HTTPException(status_code=400, detail="Road network or demand scenario is missing.")

    # If AI proposal was not pre-generated, generate one now
    ai_prop = req.ai_proposal
    if not ai_prop:
        base_proposal = Proposal(
            id="baseline",
            author="BASELINE",
            title="Baseline",
            description="Baseline",
        )
        base_res = evaluator.evaluate_alternative(
            base_links=links,
            base_nodes=nodes,
            demand_scenario=demand,
            proposal=base_proposal,
        )
        ai_prop = ai_generator.generate_alternative_proposal(
            links=links,
            nodes=nodes,
            demand_scenario=demand,
            human_proposal=req.human_proposal,
            baseline_link_results=base_res.link_results,
            user_objective=objective or "Reduce delay without spillover",
        )

    # Fair Three-Alternative Evaluation
    report = evaluator.compare_three_alternatives(
        base_links=links,
        base_nodes=nodes,
        demand_scenario=demand,
        human_proposal=req.human_proposal,
        ai_proposal=ai_prop,
        location_name=location_name or "Road Corridor",
        problem_statement=problem_statement or "Peak hour traffic bottleneck",
        objective_extracted=objective or "Reduce delay without spillover",
    )
    return report


@app.post("/api/study-areas/search")
def search_study_areas(req: StudyAreaSearchRequest):
    """
    Searches Nominatim OpenStreetMap for location matches with bounding boxes.
    """
    from .data.osm_loader import search_nominatim
    results = search_nominatim(req.query, limit=req.limit)
    return {"results": results}


@app.post("/api/study-areas/fetch-osm", response_model=FetchOSMStudyAreaResponse)
def fetch_osm_study_area(req: FetchOSMStudyAreaRequest):
    """
    Queries OpenStreetMap Overpass API for real road geometry within bounding box,
    extracts intersection nodes, builds connected graph, prunes dead ends,
    and derives IRC:106 capacities and synthesized baseline OD demand.
    """
    raw_overpass = OSMLoader.query_overpass_bbox(
        south=req.south, west=req.west, north=req.north, east=req.east
    )
    if not raw_overpass or "elements" not in raw_overpass or not raw_overpass["elements"]:
        raise HTTPException(
            status_code=422,
            detail="No vehicular road network geometry found in selected bounding box. Please select an urban corridor with mapped roadways.",
        )

    nodes, links, warnings = OSMLoader.parse_osm_elements(
        elements=raw_overpass["elements"], area_name=req.area_name
    )

    if not nodes or not links:
        raise HTTPException(
            status_code=422,
            detail=f"Unable to construct connected network from OSM elements. Reason: {'; '.join(warnings) if warnings else 'Zero usable road links'}",
        )

    demand = OSMLoader.synthesize_demand_for_network(nodes, links)

    mid_lat = (req.south + req.north) / 2.0
    mid_lon = (req.west + req.east) / 2.0

    return FetchOSMStudyAreaResponse(
        status="success",
        area_name=req.area_name,
        city=req.city,
        nodes=nodes,
        links=links,
        demand=demand,
        warnings=warnings,
        node_count=len(nodes),
        link_count=len(links),
        is_connected=True,
        center=[mid_lat, mid_lon],
        default_zoom=16,
    )


@app.post("/api/study-areas/save")
def save_study_area(req: SaveStudyAreaRequest):
    """
    Persists a verified study area to local storage so it can be reloaded as a preset.
    """
    fpath = OSMLoader.save_study_area(
        area_id=req.id,
        name=req.name,
        city=req.city,
        problem_statement=req.problem_statement,
        objective=req.objective,
        nodes=req.nodes,
        links=req.links,
        demand=req.demand,
        metadata=req.metadata,
    )
    return {"status": "saved", "id": req.id, "file_path": fpath}


@app.get("/api/simulation-assumptions")
def get_simulation_assumptions():
    """
    Returns the complete, transparent engineering and methodological assumptions catalog.
    Exposes IRC:106 capacities, BPR exponents, Webster signal cycle parameters,
    and the 4-tier data provenance structure.
    """
    return {
        "regulatory_code": "Indian Roads Congress IRC:106-1990 (Guidelines for Capacity of Urban Roads in Plain Areas)",
        "traffic_flow_model": {
            "travel_time_function": "Bureau of Public Roads (BPR) Polynomial",
            "formula": "t = t0 * (1 + alpha * (V / C)^beta)",
            "alpha": 0.15,
            "beta": 4.0,
            "speed_recovery_exponent": "Deterministic polynomial queue growth beyond capacity (V/C > 1.0)",
        },
        "signal_delay_model": {
            "formula": "Webster's Simplified Delay Formula: d = [C*(1 - lambda)^2] / [2*(1 - lambda*x)] + [x^2] / [2*q*(1 - x)]",
            "cycle_length_sec_default": 90.0,
            "effective_green_ratio_default": 0.50,
            "saturation_flow_per_lane_vph": 1800.0,
        },
        "road_capacity_benchmarks_irc106": {
            "arterial_primary": "1600 PCU / lane / hr (Design Speed: 50 km/h)",
            "sub_arterial_secondary": "1300 PCU / lane / hr (Design Speed: 40 km/h)",
            "collector_tertiary": "1000 PCU / lane / hr (Design Speed: 35 km/h)",
            "local_residential": "750 PCU / lane / hr (Design Speed: 30 km/h)",
        },
        "demand_and_pcu_assumptions": {
            "peak_analysis_period_hours": 1.0,
            "car_passenger_equivalent_factor": 1.0,
            "bus_truck_heavy_vehicle_factor": 2.5,
            "two_wheeler_motorcycle_factor": 0.5,
            "auto_rickshaw_factor": 1.2,
            "calibration_status": "Modeled evening dispersal demand calibrated from regional master plans; NOT live sensor probe counts",
        },
        "intervention_cost_benchmarks": {
            "curbside_pickup_bay": "₹8.5 Lakhs (60m indented bay, excavation, paver blocks, curb barriers)",
            "signal_retiming": "₹1.2 Lakhs (Traffic engineering study, signal controller firmware recalibration)",
            "lane_addition": "₹12,000 per linear meter per lane (Full-depth asphalt widening, drainage relocation)",
            "road_closure": "₹1.5 Lakhs (Fixed signage, concrete jersey barriers, diversion markings)",
        },
        "data_provenance_tiers": [
            {
                "tier": "A. Observed Data",
                "description": "Empirical vehicle probe speeds & counts. Currently: Static municipal survey benchmarks (OpenCity / DMRC cordon surveys).",
                "coverage": "Specific study corridors",
            },
            {
                "tier": "B. Network-Derived Data",
                "description": "Road centerline polyline geometry, intersection coordinates, road classification, and one-way restrictions.",
                "source": "OpenStreetMap contributors (ODbL) via Overpass API / Nominatim",
            },
            {
                "tier": "C. Simulation Inputs",
                "description": "IRC:106 capacity standards, assumed peak demand matrix, vehicle composition factors, signal split parameters.",
                "source": "Engineered inputs based on Indian highway standards",
            },
            {
                "tier": "D. Simulation Outputs",
                "description": "Modeled link travel times, queue backlogs in meters, network throughput, spillover impact, normalized decision scores.",
                "source": "CivicTwin Assignment & Evaluator Engine",
            },
        ],
        "limitations_caveats": [
            "Simulation outputs reflect mathematical trade-offs derived from deterministic queuing and macroscopic BPR equations.",
            "AI and Human proposals identify theoretical network-wide balance; real-world implementation mandates detailed topographic ground surveys, underground utility clearances, and local public hearings.",
            "No live loop detector or connected-vehicle probe integration is active; demand is synthetically calibrated to evening peak flows.",
        ],
    }


