import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["active_presets_count"] >= 3


def test_get_catalog():
    res = client.get("/api/catalog")
    assert res.status_code == 200
    data = res.json()
    assert "ADD_LANE" in data
    assert "PICKUP_BAY" in data
    assert "SIGNAL_RETIMING" in data


def test_get_presets():
    res = client.get("/api/presets")
    assert res.status_code == 200
    presets = res.json()
    ids = [p["id"] for p in presets]
    assert "jiit_sec128_noida" in ids
    assert "botanical_garden_noida" in ids
    assert "sec62_electronic_city_noida" in ids


def test_get_preset_detail_jiit128():
    res = client.get("/api/presets/jiit_sec128_noida")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert "links" in data
    assert "demand" in data
    assert "baseline_result" in data
    assert "routes" in data
    assert len(data["routes"]) > 0
    assert data["baseline_result"]["metrics"]["avg_vehicle_delay_sec"] > 0


def test_get_preset_routes():
    res = client.get("/api/presets/jiit_sec128_noida/routes")
    assert res.status_code == 200
    routes = res.json()
    assert len(routes) >= 3
    first_route = routes[0]
    assert "turn_instructions" in first_route
    assert len(first_route["turn_instructions"]) >= 3
    assert first_route["total_distance_m"] > 0


def test_generate_ai_proposal_endpoint():
    payload = {
        "preset_id": "jiit_sec128_noida",
        "human_proposal": {
            "id": "h1",
            "author": "HUMAN",
            "title": "Human proposal",
            "description": "User wants to widen link",
            "interventions": [
                {
                    "intervention_type": "ADD_LANE",
                    "target_link_ids": ["link_jiit_frontage_south"],
                    "parameters": {"extra_lanes": 1},
                    "estimated_cost_inr": 1200000.0,
                }
            ],
        },
        "user_objective": "Relieve college gate evening peak queue without spillover",
    }
    res = client.post("/api/generate-ai-proposal", json=payload)
    assert res.status_code == 200
    ai_prop = res.json()
    assert ai_prop["author"] == "AI"
    assert len(ai_prop["interventions"]) > 0
    # AI should NOT simply copy human proposal of ADD_LANE on link_jiit_frontage_south
    interv_types = [i["intervention_type"] for i in ai_prop["interventions"]]
    assert "ADD_LANE" not in interv_types


def test_compare_endpoint_jiit128():
    payload = {
        "preset_id": "jiit_sec128_noida",
        "human_proposal": {
            "id": "h1",
            "author": "HUMAN",
            "title": "Human Pickup Bay Proposal",
            "description": "Construct offline pickup bay outside JIIT Gate 1",
            "interventions": [
                {
                    "intervention_type": "PICKUP_BAY",
                    "target_link_ids": ["link_jiit_frontage_south"],
                    "parameters": {"friction_recovery_pct": 0.45},
                    "estimated_cost_inr": 850000.0,
                }
            ],
        },
        "objective": "Eliminate curbside queue choke outside JIIT college gate",
    }
    res = client.post("/api/compare", json=payload)
    assert res.status_code == 200
    report = res.json()
    assert "baseline" in report
    assert "human_proposal" in report
    assert "ai_proposal" in report
    assert report["preferred_winner"] in ["HUMAN", "AI", "BASELINE"]
    assert len(report["trade_offs_identified"]) >= 3
    assert len(report["baseline"]["link_results"]) > 0


def test_simulation_assumptions_endpoint():
    res = client.get("/api/simulation-assumptions")
    assert res.status_code == 200
    data = res.json()
    assert "regulatory_code" in data
    assert "IRC:106" in data["regulatory_code"]
    assert "data_provenance_tiers" in data
    assert len(data["data_provenance_tiers"]) == 4
    assert "traffic_flow_model" in data


def test_study_area_search_endpoint():
    res = client.post("/api/study-areas/search", json={"query": "Connaught Place", "limit": 3})
    assert res.status_code == 200
    data = res.json()
    assert "results" in data


def test_fetch_osm_empty_area_returns_422():
    # Null island bounding box with no roads
    payload = {
        "south": 0.0,
        "west": 0.0,
        "north": 0.001,
        "east": 0.001,
        "area_name": "Ocean Test",
    }
    res = client.post("/api/study-areas/fetch-osm", json=payload)
    # Must reject with 422 diagnostic and NOT silently substitute a preset
    assert res.status_code == 422
    assert "No vehicular road" in res.json()["detail"] or "geometry" in res.json()["detail"]


