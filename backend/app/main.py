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
)
from .simulation.evaluator import TrafficScenarioEvaluator
from .interventions.ai_generator import AIInterventionGenerator
from .interventions.catalog import INTERVENTION_CATALOG
from .data.presets import PresetRepository
from .data.osm_loader import OSMLoader

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

    return {
        "metadata": meta,
        "nodes": nodes,
        "links": links,
        "demand": demand,
        "baseline_result": baseline_result,
    }


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


@app.get("/api/search-osm")
def search_osm_location(
    q: str = Query(..., description="Location name to search"),
    fetch_network: bool = Query(False, description="Whether to fetch Overpass geometry if bounding box found"),
):
    """
    Free Nominatim OSM geocoding search for any road, campus, or intersection worldwide.
    """
    headers = {"User-Agent": "CivicTwinArena/1.0 (traffic-planning-tool)"}
    try:
        url = "https://nominatim.openstreetmap.org/search"
        resp = requests.get(url, params={"q": q, "format": "json", "limit": 5}, headers=headers, timeout=6)
        if resp.status_code == 200:
            results = resp.json()
            return {"results": results}
        else:
            return {"results": [], "note": "OSM geocoder returned non-200 status"}
    except Exception as e:
        return {"results": [], "error": str(e)}
