import pytest
import math
from app.simulation.bpr_engine import BPRTrafficEngine
from app.simulation.assignment import TrafficAssignmentEngine, NetworkGraph
from app.models.schemas import (
    NetworkNode,
    NetworkLink,
    TrafficDemandScenario,
    ODDemand,
    Proposal,
    SingleIntervention,
    InterventionType,
    AuthorType,
)
from app.simulation.evaluator import TrafficScenarioEvaluator


def test_free_flow_formula_exactness():
    """
    Verifies t0 = length_m / (speed_kmh / 3.6).
    Length: 1800m, Speed: 60 km/h = 16.6667 m/s -> t0 = 108.0 seconds.
    """
    engine = BPRTrafficEngine(alpha=0.15, beta=4.0)
    res = engine.compute_link_travel_time(
        length_m=1800.0,
        free_flow_speed_kmh=60.0,
        volume_vph=0.0,
        capacity_vph=1500.0,
        is_signalized=False,
    )
    assert math.isclose(res["free_flow_time_sec"], 108.0, abs_tol=0.01)
    assert math.isclose(res["actual_travel_time_sec"], 108.0, abs_tol=0.01)
    assert res["delay_sec_per_veh"] == 0.0


def test_deterministic_queue_formula():
    """
    Verifies deterministic triangular queue accumulation and delay:
    For V = 2000 vph, C = 1000 vph over T = 60 min (1 hr):
    Excess = 1000 veh/hr.
    Q_max = 1000 vehicles.
    Queue length = 1000 * 7.5m = 7500 meters.
    Average queuing delay per arriving vehicle:
      d_queue = (Q_max / (2 * V)) * 3600 = (1000 / 4000) * 3600 = 900.0 seconds (15 minutes).
    """
    engine = BPRTrafficEngine(alpha=0.15, beta=4.0, vehicle_effective_length_m=7.5)
    res = engine.compute_link_travel_time(
        length_m=1000.0,
        free_flow_speed_kmh=50.0,
        volume_vph=2000.0,
        capacity_vph=1000.0,
        is_signalized=False,
        peak_duration_min=60.0,
    )

    assert res["vc_ratio"] == 2.0
    assert math.isclose(res["queue_vehicles"], 1000.0, abs_tol=0.1)
    assert math.isclose(res["queue_length_m"], 7500.0, abs_tol=0.1)
    assert math.isclose(res["queue_delay_sec"], 900.0, abs_tol=0.1)


def test_road_closure_rerouting_and_flow_conservation():
    """
    Verifies that when a direct route is closed (InterventionType.ROAD_CLOSURE),
    traffic assignment assigns strictly 0 vehicles to the closed link and diverts 100%
    of trips to the alternate collector route, preserving total demand conservation.
    """
    nodes = [
        NetworkNode(id="O", name="Origin", lat=0, lon=0),
        NetworkNode(id="D", name="Destination", lat=0, lon=1),
        NetworkNode(id="Mid", name="Intermediate", lat=1, lon=0.5),
    ]

    # Two parallel routes from O to D:
    # Route 1: Direct link (O -> D)
    # Route 2: Detour via Mid (O -> Mid -> D)
    links = [
        NetworkLink(
            id="link_direct",
            name="Direct Corridor",
            from_node="O",
            to_node="D",
            length_m=1000.0,
            base_capacity_vph=1200.0,
            free_flow_speed_kmh=50.0,
        ),
        NetworkLink(
            id="link_detour_1",
            name="Detour Leg 1",
            from_node="O",
            to_node="Mid",
            length_m=600.0,
            base_capacity_vph=1000.0,
            free_flow_speed_kmh=40.0,
        ),
        NetworkLink(
            id="link_detour_2",
            name="Detour Leg 2",
            from_node="Mid",
            to_node="D",
            length_m=600.0,
            base_capacity_vph=1000.0,
            free_flow_speed_kmh=40.0,
        ),
    ]

    demand = TrafficDemandScenario(
        scenario_id="closure_test",
        name="Closure Test",
        peak_duration_min=60.0,
        od_flows=[ODDemand(origin_node="O", destination_node="D", flow_vph=800.0)],
    )

    evaluator = TrafficScenarioEvaluator()

    # 1. Baseline: link_direct is open and shares traffic
    base_prop = Proposal(id="base", author=AuthorType.BASELINE, title="Baseline", description="Base")
    base_res = evaluator.evaluate_alternative(links, nodes, demand, base_prop)
    assert base_res.link_results["link_direct"].volume_vph > 0

    # 2. Closure proposal: close link_direct
    closure_prop = Proposal(
        id="closure",
        author=AuthorType.HUMAN,
        title="Direct Link Closure",
        description="Close direct link",
        interventions=[
            SingleIntervention(
                intervention_type=InterventionType.ROAD_CLOSURE,
                target_link_ids=["link_direct"],
                parameters={},
                estimated_cost_inr=50000.0,
            )
        ],
    )

    closure_res = evaluator.evaluate_alternative(
        links, nodes, demand, closure_prop, baseline_results=base_res.link_results
    )

    # Direct link must receive strictly 0 volume
    assert closure_res.link_results["link_direct"].volume_vph == 0.0
    # Detour route must absorb 100% of the 800 vph demand
    assert math.isclose(closure_res.link_results["link_detour_1"].volume_vph, 800.0, abs_tol=1.0)
    assert math.isclose(closure_res.link_results["link_detour_2"].volume_vph, 800.0, abs_tol=1.0)
    # Spillover on detour links must be detected as deteriorated/moderate due to absorbed flow
    assert closure_res.link_results["link_detour_1"].spillover_status in ["moderate", "deteriorated", "newly_congested"]


def test_baseline_invariance_when_editing_proposals():
    """
    Verifies that the Baseline results remain completely identical and invariant
    regardless of what proposal interventions are evaluated against it.
    """
    nodes = [
        NetworkNode(id="A", name="A", lat=0, lon=0),
        NetworkNode(id="B", name="B", lat=0, lon=1),
    ]
    links = [
        NetworkLink(id="L1", name="L1", from_node="A", to_node="B", length_m=500.0, base_capacity_vph=1000.0),
    ]
    demand = TrafficDemandScenario(
        scenario_id="s1",
        name="s1",
        peak_duration_min=60.0,
        od_flows=[ODDemand(origin_node="A", destination_node="B", flow_vph=900.0)],
    )

    evaluator = TrafficScenarioEvaluator()
    base_prop = Proposal(id="base", author=AuthorType.BASELINE, title="Base", description="Base")

    run1 = evaluator.evaluate_alternative(links, nodes, demand, base_prop)

    # Create radical human proposal (e.g. 5 lanes)
    human_prop = Proposal(
        id="h",
        author=AuthorType.HUMAN,
        title="Huge Expansion",
        description="Expand",
        interventions=[
            SingleIntervention(
                intervention_type=InterventionType.ADD_LANE,
                target_link_ids=["L1"],
                parameters={"extra_lanes": 5},
                estimated_cost_inr=5000000.0,
            )
        ],
    )
    _ = evaluator.evaluate_alternative(links, nodes, demand, human_prop, baseline_results=run1.link_results)

    # Run baseline again to verify 0 cross-contamination
    run2 = evaluator.evaluate_alternative(links, nodes, demand, base_prop)

    assert run1.metrics.avg_vehicle_delay_sec == run2.metrics.avg_vehicle_delay_sec
    assert run1.metrics.avg_vc_ratio == run2.metrics.avg_vc_ratio
    assert run1.link_results["L1"].capacity_vph == run2.link_results["L1"].capacity_vph
    assert run1.link_results["L1"].volume_vph == run2.link_results["L1"].volume_vph
