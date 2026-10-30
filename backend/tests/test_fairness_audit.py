import pytest
import copy
from app.models.schemas import (
    NetworkLink,
    NetworkNode,
    ODDemand,
    TrafficDemandScenario,
    Proposal,
    SingleIntervention,
    InterventionType,
    AuthorType,
    WinnerType,
)
from app.simulation.evaluator import TrafficScenarioEvaluator
from app.simulation.bpr_engine import BPRTrafficEngine
from app.data.presets import PresetRepository
from app.interventions.ai_generator import AIInterventionGenerator


@pytest.fixture
def evaluator():
    return TrafficScenarioEvaluator()


@pytest.fixture
def ai_generator():
    return AIInterventionGenerator()


def test_investigation_1_ai_vs_human_equal_search(evaluator, ai_generator):
    """
    Investigation 1:
    Verify that when Human and AI evaluate equivalent interventions,
    both receive mathematically identical scores.
    """
    preset_data = PresetRepository.get_preset("jiit_sec128_noida")
    nodes, links, demand, _ = preset_data

    base_prop = Proposal(id="base", author=AuthorType.BASELINE, title="Baseline", description="", interventions=[])
    base_res = evaluator.evaluate_alternative(links, nodes, demand, base_prop, None)

    # Generate AI proposal
    ai_prop = ai_generator.generate_alternative_proposal(links, nodes, demand, base_prop, base_res.link_results)

    # Human adopts the exact same proposal
    human_prop = copy.deepcopy(ai_prop)
    human_prop.id = "h_adopted"
    human_prop.author = AuthorType.HUMAN

    report = evaluator.compare_three_alternatives(links, nodes, demand, human_prop, ai_prop)

    # Numerical scores must be identical
    assert report.human_proposal.metrics.score_breakdown.total_score == report.ai_proposal.metrics.score_breakdown.total_score
    assert report.human_proposal.metrics.avg_vehicle_delay_sec == report.ai_proposal.metrics.avg_vehicle_delay_sec
    assert report.human_proposal.metrics.network_throughput_vph == report.ai_proposal.metrics.network_throughput_vph


def test_investigation_2_zero_baseline_queue_stability(evaluator):
    """
    Investigation 2:
    Confirm that zero baseline queue scenarios never trigger division by zero, NaN, or Inf.
    """
    nodes = [NetworkNode(id="n1", name="N1", lat=28.5, lon=77.3), NetworkNode(id="n2", name="N2", lat=28.51, lon=77.31)]
    links = [NetworkLink(id="l1", name="L1", from_node="n1", to_node="n2", length_m=500.0, lanes=2, base_capacity_vph=1200.0, free_flow_speed_kmh=50.0, coordinates=[[28.5, 77.3], [28.51, 77.31]])]

    # Baseline queue = 0 (demand = 800 < 1200)
    demand = TrafficDemandScenario(scenario_id="d0", name="D0", od_flows=[ODDemand(origin_node="n1", destination_node="n2", flow_vph=800.0)], peak_duration_min=60.0)
    base_prop = Proposal(id="b", author=AuthorType.BASELINE, title="B", description="", interventions=[])
    base_res = evaluator.evaluate_alternative(links, nodes, demand, base_prop, None)
    assert base_res.metrics.max_queue_length_m == 0.0

    # 2.1: Base Q=0, Prop Q=0
    res_zero = evaluator.evaluate_alternative(links, nodes, demand, base_prop, base_res.link_results)
    assert res_zero.metrics.score_breakdown.queue_component == 25.0
    assert not (res_zero.metrics.score_breakdown.total_score != res_zero.metrics.score_breakdown.total_score) # not NaN

    # 2.2: Base Q=0, Prop Q > 0 (choked link)
    choked_links = copy.deepcopy(links)
    choked_links[0].base_capacity_vph = 500.0 # 800 on 500 -> queue forms
    res_choke = evaluator.evaluate_alternative(choked_links, nodes, demand, base_prop, base_res.link_results)
    assert res_choke.metrics.max_queue_length_m > 0.0
    assert res_choke.metrics.score_breakdown.queue_component == 0.0
    assert not (res_choke.metrics.score_breakdown.total_score != res_choke.metrics.score_breakdown.total_score)

    # 2.3: Base Q > 0, Prop Q = 0
    demand_heavy = TrafficDemandScenario(scenario_id="dh", name="DH", od_flows=[ODDemand(origin_node="n1", destination_node="n2", flow_vph=1500.0)], peak_duration_min=60.0)
    base_heavy = evaluator.evaluate_alternative(links, nodes, demand_heavy, base_prop, None)
    assert base_heavy.metrics.max_queue_length_m > 0.0

    prop_add_lane = Proposal(id="al", author=AuthorType.HUMAN, title="AL", description="", interventions=[
        SingleIntervention(intervention_type=InterventionType.ADD_LANE, target_link_ids=["l1"], parameters={"extra_lanes": 1})
    ])
    res_cleared = evaluator.evaluate_alternative(links, nodes, demand_heavy, prop_add_lane, base_heavy.link_results)
    assert res_cleared.metrics.max_queue_length_m == 0.0
    assert res_cleared.metrics.score_breakdown.queue_component == 25.0
    assert not (res_cleared.metrics.score_breakdown.total_score != res_cleared.metrics.score_breakdown.total_score)


def test_investigation_3_throughput_sensitivity(evaluator):
    """
    Investigation 3:
    Throughput sensitivity in demand-limited vs capacity-limited regimes.
    """
    nodes = [NetworkNode(id="n1", name="N1", lat=28.5, lon=77.3), NetworkNode(id="n2", name="N2", lat=28.51, lon=77.31)]
    base_prop = Proposal(id="b", author=AuthorType.BASELINE, title="B", description="", interventions=[])
    lane_prop = Proposal(id="l", author=AuthorType.HUMAN, title="L", description="", interventions=[
        SingleIntervention(intervention_type=InterventionType.ADD_LANE, target_link_ids=["l1"], parameters={"extra_lanes": 1})
    ])

    # 3.1 Demand-limited: Demand 800, Capacity 1500 -> boosting capacity has 0 throughput delta
    links_d = [NetworkLink(id="l1", name="L1", from_node="n1", to_node="n2", length_m=500.0, lanes=2, base_capacity_vph=1500.0, free_flow_speed_kmh=50.0, coordinates=[[28.5, 77.3], [28.51, 77.31]])]
    demand_d = TrafficDemandScenario(scenario_id="dd", name="DD", od_flows=[ODDemand(origin_node="n1", destination_node="n2", flow_vph=800.0)], peak_duration_min=60.0)
    res_d_before = evaluator.evaluate_alternative(links_d, nodes, demand_d, base_prop, None)
    res_d_after = evaluator.evaluate_alternative(links_d, nodes, demand_d, lane_prop, None)
    assert res_d_before.metrics.network_throughput_vph == 800.0
    assert res_d_after.metrics.network_throughput_vph == 800.0
    assert res_d_after.metrics.network_throughput_vph - res_d_before.metrics.network_throughput_vph == 0.0

    # 3.2 Capacity-limited: Demand 1800, Capacity 1200 -> boosting capacity directly increases throughput
    links_c = [NetworkLink(id="l1", name="L1", from_node="n1", to_node="n2", length_m=500.0, lanes=2, base_capacity_vph=1200.0, free_flow_speed_kmh=50.0, coordinates=[[28.5, 77.3], [28.51, 77.31]])]
    demand_c = TrafficDemandScenario(scenario_id="dc", name="DC", od_flows=[ODDemand(origin_node="n1", destination_node="n2", flow_vph=1800.0)], peak_duration_min=60.0)
    res_c_before = evaluator.evaluate_alternative(links_c, nodes, demand_c, base_prop, None)
    res_c_after = evaluator.evaluate_alternative(links_c, nodes, demand_c, lane_prop, None)
    assert res_c_before.metrics.network_throughput_vph == 1200.0
    assert res_c_before.metrics.queued_vehicles == 600.0
    assert res_c_after.metrics.network_throughput_vph == 1800.0
    assert res_c_after.metrics.queued_vehicles == 0.0
    assert res_c_after.metrics.network_throughput_vph - res_c_before.metrics.network_throughput_vph == 600.0


def test_investigation_4_queue_length_illustrative_estimate():
    """
    Investigation 4:
    Verify that queue length is computed as 1D deterministic backlog (excess veh * 7.5m)
    and does NOT divide by lane count or simulate multi-lane 2D packing.
    """
    bpr = BPRTrafficEngine(vehicle_effective_length_m=7.5)
    res = bpr.compute_link_travel_time(
        length_m=1000.0,
        free_flow_speed_kmh=50.0,
        volume_vph=1500.0,
        capacity_vph=1000.0, # 500 excess
        peak_duration_min=60.0,
    )
    # 500 vehicles * 7.5m = 3750.0m
    assert res["queue_vehicles"] == 500.0
    assert res["queue_length_m"] == 3750.0


def test_investigation_5_author_identity_neutrality(evaluator):
    """
    Investigation 5:
    Swapping author labels and proposal IDs yields bitwise identical results.
    """
    preset_data = PresetRepository.get_preset("jiit_sec128_noida")
    nodes, links, demand, _ = preset_data

    plan_x = Proposal(
        id="plan_x",
        author=AuthorType.HUMAN,
        title="Plan X",
        description="",
        interventions=[
            SingleIntervention(intervention_type=InterventionType.PICKUP_BAY, target_link_ids=["link_jiit_gate_frontage"], parameters={"friction_recovery_pct": 0.40}, estimated_cost_inr=800000.0)
        ]
    )
    plan_y = Proposal(
        id="plan_y",
        author=AuthorType.AI,
        title="Plan Y",
        description="",
        interventions=[
            SingleIntervention(intervention_type=InterventionType.SIGNAL_RETIMING, target_node_id="node_jiit_gate1", target_link_ids=["link_jiit_gate_frontage"], parameters={"green_split_delta": 0.15}, estimated_cost_inr=150000.0)
        ]
    )

    # Forward: X as Human, Y as AI
    rep_fwd = evaluator.compare_three_alternatives(links, nodes, demand, plan_x, plan_y)

    # Swapped: Y as Human, X as AI
    plan_x_swapped = copy.deepcopy(plan_x)
    plan_x_swapped.id = "plan_x_ai"
    plan_x_swapped.author = AuthorType.AI

    plan_y_swapped = copy.deepcopy(plan_y)
    plan_y_swapped.id = "plan_y_human"
    plan_y_swapped.author = AuthorType.HUMAN

    rep_rev = evaluator.compare_three_alternatives(links, nodes, demand, plan_y_swapped, plan_x_swapped)

    # Compare metrics of Plan X under both configurations
    assert rep_fwd.human_proposal.metrics.avg_vehicle_delay_sec == rep_rev.ai_proposal.metrics.avg_vehicle_delay_sec
    assert rep_fwd.human_proposal.metrics.score_breakdown.total_score == rep_rev.ai_proposal.metrics.score_breakdown.total_score

    # Compare metrics of Plan Y under both configurations
    assert rep_fwd.ai_proposal.metrics.avg_vehicle_delay_sec == rep_rev.human_proposal.metrics.avg_vehicle_delay_sec
    assert rep_fwd.ai_proposal.metrics.score_breakdown.total_score == rep_rev.human_proposal.metrics.score_breakdown.total_score

