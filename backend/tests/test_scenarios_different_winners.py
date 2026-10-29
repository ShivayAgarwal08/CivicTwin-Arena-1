import pytest
from app.models.schemas import (
    NetworkNode,
    NetworkLink,
    TrafficDemandScenario,
    ODDemand,
    Proposal,
    SingleIntervention,
    InterventionType,
    AuthorType,
    WinnerType,
)
from app.simulation.evaluator import TrafficScenarioEvaluator


@pytest.fixture
def base_test_network():
    nodes = [
        NetworkNode(id="n_in", name="North Entrance", lat=28.52, lon=77.36, is_signalized=False),
        NetworkNode(id="n_junction", name="Central Junction", lat=28.518, lon=77.368, is_signalized=True, green_split=0.45),
        NetworkNode(id="n_out", name="South Exit", lat=28.514, lon=77.371, is_signalized=False),
        NetworkNode(id="n_side", name="Residential East", lat=28.517, lon=77.375, is_signalized=False),
    ]

    links = [
        # Main bottleneck arterial
        NetworkLink(
            id="link_main_arterial",
            name="Main College Avenue",
            from_node="n_in",
            to_node="n_junction",
            highway_type="secondary",
            length_m=500.0,
            lanes=2,
            free_flow_speed_kmh=45.0,
            base_capacity_vph=1500.0,
            has_curbside_friction=True,
            coordinates=[[77.36, 28.52], [77.368, 28.518]],
        ),
        # Downstream link
        NetworkLink(
            id="link_downstream",
            name="Downstream Expressway Feeder",
            from_node="n_junction",
            to_node="n_out",
            highway_type="primary",
            length_m=450.0,
            lanes=2,
            free_flow_speed_kmh=50.0,
            base_capacity_vph=1800.0,
            coordinates=[[77.368, 28.518], [77.371, 28.514]],
        ),
        # Side residential link
        NetworkLink(
            id="link_side_street",
            name="Narrow Residential Lane",
            from_node="n_in",
            to_node="n_side",
            highway_type="residential",
            length_m=480.0,
            lanes=1,
            free_flow_speed_kmh=30.0,
            base_capacity_vph=650.0,
            coordinates=[[77.36, 28.52], [77.375, 28.517]],
        ),
        NetworkLink(
            id="link_side_to_out",
            name="Residential Exit Link",
            from_node="n_side",
            to_node="n_out",
            highway_type="residential",
            length_m=420.0,
            lanes=1,
            free_flow_speed_kmh=30.0,
            base_capacity_vph=650.0,
            coordinates=[[77.375, 28.517], [77.371, 28.514]],
        ),
    ]

    demand = TrafficDemandScenario(
        scenario_id="test_demand",
        name="Test Corridor Peak Demand",
        peak_duration_min=60.0,
        od_flows=[
            ODDemand(origin_node="n_in", destination_node="n_out", flow_vph=1750.0),
        ],
    )

    return nodes, links, demand


def test_human_proposal_wins_scenario(base_test_network):
    """
    Test scenario where the HUMAN proposal wins fairly:
    Human proposes a highly targeted offline pickup bay on the main avenue,
    which eliminates double-parking friction (+45% capacity recovery) for only 8.5 Lakhs.
    AI proposes an expensive one-way diversion loop with long detours costing 20 Lakhs.
    """
    nodes, links, demand = base_test_network
    evaluator = TrafficScenarioEvaluator()

    human_prop = Proposal(
        id="human_smart_bay",
        author=AuthorType.HUMAN,
        title="Human: Dedicated Offline Pick-up Bay",
        description="Eliminates curbside parking friction directly at the gate.",
        interventions=[
            SingleIntervention(
                intervention_type=InterventionType.PICKUP_BAY,
                target_link_ids=["link_main_arterial"],
                parameters={"friction_recovery_pct": 0.45},
                estimated_cost_inr=850000.0,  # 8.5 Lakhs
            )
        ],
    )

    ai_prop = Proposal(
        id="ai_expensive_diversion",
        author=AuthorType.AI,
        title="AI: Complex One-Way Diversion Loop",
        description="Diverts through traffic onto parallel street with costly civil works.",
        interventions=[
            SingleIntervention(
                intervention_type=InterventionType.ONE_WAY_DIVERSION,
                target_link_ids=["link_side_street"],
                parameters={},
                estimated_cost_inr=2000000.0,  # 20 Lakhs
            )
        ],
    )

    report = evaluator.compare_three_alternatives(
        base_links=links,
        base_nodes=nodes,
        demand_scenario=demand,
        human_proposal=human_prop,
        ai_proposal=ai_prop,
    )

    assert report.preferred_winner == WinnerType.HUMAN
    assert report.human_proposal.metrics.score_breakdown.total_score > report.ai_proposal.metrics.score_breakdown.total_score
    assert report.human_proposal.metrics.score_breakdown.total_score > report.baseline.metrics.score_breakdown.total_score


def test_ai_proposal_wins_scenario(base_test_network):
    """
    Test scenario where the AI proposal wins fairly:
    Human proposes expensive physical road widening costing 45 Lakhs.
    AI proposes coordinated signal re-timing (+18% green split) at junction for only 1.5 Lakhs,
    achieving equivalent queue clearing at 1/30th the financial cost!
    """
    nodes, links, demand = base_test_network
    evaluator = TrafficScenarioEvaluator()

    human_prop = Proposal(
        id="human_expensive_widening",
        author=AuthorType.HUMAN,
        title="Human: Expensive Road Widening",
        description="Widens link with costly land acquisition.",
        interventions=[
            SingleIntervention(
                intervention_type=InterventionType.ADD_LANE,
                target_link_ids=["link_main_arterial"],
                parameters={"extra_lanes": 1},
                estimated_cost_inr=4500000.0,  # 45 Lakhs
            )
        ],
    )

    ai_prop = Proposal(
        id="ai_signal_opt",
        author=AuthorType.AI,
        title="AI: Smart Intersection Signal Optimization",
        description="Reallocates signal green time to the critical approach at minimal cost.",
        interventions=[
            SingleIntervention(
                intervention_type=InterventionType.SIGNAL_RETIMING,
                target_node_id="n_junction",
                target_link_ids=["link_main_arterial"],
                parameters={"green_split_delta": 0.20},
                estimated_cost_inr=150000.0,  # 1.5 Lakhs
            )
        ],
    )

    report = evaluator.compare_three_alternatives(
        base_links=links,
        base_nodes=nodes,
        demand_scenario=demand,
        human_proposal=human_prop,
        ai_proposal=ai_prop,
    )

    assert report.preferred_winner == WinnerType.AI
    assert report.ai_proposal.metrics.score_breakdown.total_score > report.human_proposal.metrics.score_breakdown.total_score


def test_baseline_wins_scenario(base_test_network):
    """
    Test scenario where BASELINE wins fairly:
    Both Human and AI proposals introduce severe, counterproductive interventions:
    - Human proposal severely calms the main arterial (-20 km/h) and costs 15 Lakhs, worsening gridlock.
    - AI proposal closes or restricts the residential exit and costs 25 Lakhs.
    As a result, the existing baseline network outperforms both interventions on evidence!
    """
    nodes, links, demand = base_test_network
    evaluator = TrafficScenarioEvaluator()

    human_counterproductive = Proposal(
        id="human_harmful_calming",
        author=AuthorType.HUMAN,
        title="Human: Aggressive Speed Cushions on Main Arterial",
        description="Artificially slows arterial traffic, causing massive backlog.",
        interventions=[
            SingleIntervention(
                intervention_type=InterventionType.TRAFFIC_CALMING,
                target_link_ids=["link_main_arterial"],
                parameters={"speed_reduction_kmh": 25.0},
                estimated_cost_inr=1500000.0,  # 15 Lakhs
            )
        ],
    )

    ai_harmful = Proposal(
        id="ai_costly_failure",
        author=AuthorType.AI,
        title="AI: Redundant Expensive Construction",
        description="Huge unnecessary expenditure on side street with zero benefit.",
        interventions=[
            SingleIntervention(
                intervention_type=InterventionType.TRAFFIC_CALMING,
                target_link_ids=["link_side_street"],
                parameters={"speed_reduction_kmh": 20.0},
                estimated_cost_inr=2500000.0,  # 25 Lakhs
            )
        ],
    )

    report = evaluator.compare_three_alternatives(
        base_links=links,
        base_nodes=nodes,
        demand_scenario=demand,
        human_proposal=human_counterproductive,
        ai_proposal=ai_harmful,
    )

    assert report.preferred_winner == WinnerType.BASELINE
    assert report.baseline.metrics.score_breakdown.total_score > report.human_proposal.metrics.score_breakdown.total_score
    assert report.baseline.metrics.score_breakdown.total_score > report.ai_proposal.metrics.score_breakdown.total_score
