import copy
import pytest
from app.models.schemas import (
    NetworkLink,
    NetworkNode,
    ODDemand,
    TrafficDemandScenario,
    Proposal,
    SingleIntervention,
    InterventionType,
    WinnerType,
    AuthorType,
)
from app.simulation.evaluator import TrafficScenarioEvaluator
from app.simulation.bpr_engine import BPRTrafficEngine


def create_simple_corridor_network():
    """
    Creates a simple corridor network with 3 nodes and 2 links:
    n1 ---(link_1: cap 1200)---> n2 ---(link_2: cap 1200)---> n3
    """
    nodes = [
        NetworkNode(id="n1", name="Node 1", lat=28.5, lon=77.3, is_signalized=False),
        NetworkNode(id="n2", name="Node 2", lat=28.51, lon=77.31, is_signalized=True, green_split=0.5, cycle_length_sec=90.0),
        NetworkNode(id="n3", name="Node 3", lat=28.52, lon=77.32, is_signalized=False),
    ]
    links = [
        NetworkLink(
            id="link_1",
            name="Corridor Link 1",
            from_node="n1",
            to_node="n2",
            length_m=1000.0,
            lanes=2,
            base_capacity_vph=1200.0,
            free_flow_speed_kmh=50.0,
            coordinates=[[28.5, 77.3], [28.51, 77.31]],
        ),
        NetworkLink(
            id="link_2",
            name="Corridor Link 2",
            from_node="n2",
            to_node="n3",
            length_m=1000.0,
            lanes=2,
            base_capacity_vph=1200.0,
            free_flow_speed_kmh=50.0,
            coordinates=[[28.51, 77.31], [28.52, 77.32]],
        ),
    ]
    return nodes, links


class TestThroughputAndUnitConsistency:
    """Audit Point 1: Throughput and vehicle conservation tests."""

    def test_vehicle_conservation_undersaturated(self):
        """When demand < capacity, all vehicles are served. Queued = 0, Unserved = 0."""
        nodes, links = create_simple_corridor_network()
        demand = TrafficDemandScenario(
            scenario_id="undersat",
            name="Undersaturated Flow",
            od_flows=[ODDemand(origin_node="n1", destination_node="n3", flow_vph=800.0)],
            peak_duration_min=60.0,
        )
        evaluator = TrafficScenarioEvaluator()
        empty_proposal = Proposal(
            id="empty", author=AuthorType.HUMAN, title="Noop", description="", interventions=[]
        )
        res = evaluator.evaluate_alternative(links, nodes, demand, empty_proposal)

        metrics = res.metrics
        # Peak duration is 1.0 hour, so 800 vph = 800 vehicles
        assert metrics.total_demand_vehicles == 800.0
        assert metrics.network_throughput_vph == 800.0
        assert metrics.served_vehicles == 800.0
        assert metrics.queued_vehicles == 0.0
        assert metrics.unserved_vehicles == 0.0

        # Exact conservation: Demand = Served + Queued + Unserved
        assert metrics.total_demand_vehicles == (
            metrics.served_vehicles + metrics.queued_vehicles + metrics.unserved_vehicles
        )

    def test_vehicle_conservation_oversaturated(self):
        """When demand > capacity, excess vehicles queue. Demand = Served + Queued + Unserved."""
        nodes, links = create_simple_corridor_network()
        # Demand of 1500 vph exceeds link capacity of 1200 vph by 300 vph
        demand = TrafficDemandScenario(
            scenario_id="oversat",
            name="Oversaturated Flow",
            od_flows=[ODDemand(origin_node="n1", destination_node="n3", flow_vph=1500.0)],
            peak_duration_min=60.0,
        )
        evaluator = TrafficScenarioEvaluator()
        empty_proposal = Proposal(
            id="empty", author=AuthorType.HUMAN, title="Noop", description="", interventions=[]
        )
        res = evaluator.evaluate_alternative(links, nodes, demand, empty_proposal)

        metrics = res.metrics
        assert metrics.total_demand_vehicles == 1500.0
        assert metrics.network_throughput_vph <= 1200.0
        assert metrics.queued_vehicles > 0.0
        assert metrics.unserved_vehicles == 0.0

        # Exact vehicle conservation within 1 vehicle rounding tolerance
        conservation_sum = metrics.served_vehicles + metrics.queued_vehicles + metrics.unserved_vehicles
        assert abs(metrics.total_demand_vehicles - conservation_sum) <= 1.0

    def test_different_peak_durations_scaling(self):
        """Verify that peak duration T_peak scales vehicle counts correctly without unit errors."""
        nodes, links = create_simple_corridor_network()
        evaluator = TrafficScenarioEvaluator()
        empty_proposal = Proposal(
            id="empty", author=AuthorType.HUMAN, title="Noop", description="", interventions=[]
        )

        # 30-minute peak (0.5 hour)
        demand_30m = TrafficDemandScenario(
            scenario_id="peak_30m",
            name="30m Peak",
            od_flows=[ODDemand(origin_node="n1", destination_node="n3", flow_vph=1600.0)],
            peak_duration_min=30.0,
        )
        res_30m = evaluator.evaluate_alternative(links, nodes, demand_30m, empty_proposal)

        # 120-minute peak (2.0 hours)
        demand_120m = TrafficDemandScenario(
            scenario_id="peak_120m",
            name="120m Peak",
            od_flows=[ODDemand(origin_node="n1", destination_node="n3", flow_vph=1600.0)],
            peak_duration_min=120.0,
        )
        res_120m = evaluator.evaluate_alternative(links, nodes, demand_120m, empty_proposal)

        # Total demand vehicles should scale 4x (0.5 hr vs 2.0 hr)
        assert res_30m.metrics.total_demand_vehicles == 800.0   # 1600 * 0.5
        assert res_120m.metrics.total_demand_vehicles == 3200.0 # 1600 * 2.0

        # Hourly throughput (vph) should remain consistent between durations
        assert res_30m.metrics.network_throughput_vph == res_120m.metrics.network_throughput_vph

        # Conservation holds for both durations
        cons_30m = res_30m.metrics.served_vehicles + res_30m.metrics.queued_vehicles + res_30m.metrics.unserved_vehicles
        assert abs(res_30m.metrics.total_demand_vehicles - cons_30m) <= 1.0

        cons_120m = res_120m.metrics.served_vehicles + res_120m.metrics.queued_vehicles + res_120m.metrics.unserved_vehicles
        assert abs(res_120m.metrics.total_demand_vehicles - cons_120m) <= 1.0

    def test_severed_connectivity_unserved_demand(self):
        """When road is closed and no path exists, demand is classified as unserved."""
        nodes, links = create_simple_corridor_network()
        demand = TrafficDemandScenario(
            scenario_id="severed",
            name="Severed Demand",
            od_flows=[ODDemand(origin_node="n1", destination_node="n3", flow_vph=1000.0)],
            peak_duration_min=60.0,
        )
        closure_proposal = Proposal(
            id="close",
            author=AuthorType.HUMAN,
            title="Closure",
            description="",
            interventions=[
                SingleIntervention(
                    intervention_type=InterventionType.ROAD_CLOSURE,
                    target_link_ids=["link_1"],
                    parameters={},
                )
            ],
        )
        evaluator = TrafficScenarioEvaluator()
        res = evaluator.evaluate_alternative(links, nodes, demand, closure_proposal)

        assert res.metrics.unserved_vehicles == 1000.0
        assert res.metrics.network_throughput_vph == 0.0
        assert res.metrics.served_vehicles == 0.0
        assert res.metrics.total_demand_vehicles == res.metrics.unserved_vehicles


class TestScoringTransparency:
    """Audit Point 2: Winner scoring transparency, normalization, and tie-breaking."""

    def test_zero_cost_intervention_full_cost_points(self):
        """A zero-cost intervention (e.g. signal timing) should receive full 15 cost component points."""
        nodes, links = create_simple_corridor_network()
        demand = TrafficDemandScenario(
            scenario_id="test",
            name="Test",
            od_flows=[ODDemand(origin_node="n1", destination_node="n3", flow_vph=1000.0)],
            peak_duration_min=60.0,
        )
        zero_cost_prop = Proposal(
            id="retiming",
            author=AuthorType.HUMAN,
            title="Signal Retiming",
            description="Timing shift",
            interventions=[
                SingleIntervention(
                    intervention_type=InterventionType.SIGNAL_RETIMING,
                    target_node_id="n2",
                    target_link_ids=["link_1"],
                    parameters={"green_split_delta": 0.10},
                    estimated_cost_inr=0.0,
                )
            ],
        )
        evaluator = TrafficScenarioEvaluator()
        res = evaluator.evaluate_alternative(links, nodes, demand, zero_cost_prop)
        assert res.metrics.score_breakdown.cost_penalty == 15.0

    def test_extreme_cost_bounded_and_non_negative(self):
        """An astronomical capital cost (₹10,000 Lakhs = ₹100 Crore) should bound cost score to 0, not negative."""
        nodes, links = create_simple_corridor_network()
        demand = TrafficDemandScenario(
            scenario_id="test",
            name="Test",
            od_flows=[ODDemand(origin_node="n1", destination_node="n3", flow_vph=1000.0)],
            peak_duration_min=60.0,
        )
        extreme_cost_prop = Proposal(
            id="megaproject",
            author=AuthorType.HUMAN,
            title="Megaproject",
            description="Massive civil spend",
            interventions=[
                SingleIntervention(
                    intervention_type=InterventionType.WIDEN_ROAD,
                    target_link_ids=["link_1"],
                    parameters={"capacity_boost_factor": 0.5},
                    estimated_cost_inr=1_000_000_000.0, # 100 Crore INR
                )
            ],
        )
        evaluator = TrafficScenarioEvaluator()
        res = evaluator.evaluate_alternative(links, nodes, demand, extreme_cost_prop)
        assert res.metrics.score_breakdown.cost_penalty == 0.0
        assert 0.0 <= res.metrics.score_breakdown.total_score <= 100.0

    def test_exact_tie_broken_by_physical_network_delay(self):
        """When scores are in a near-tie (< 0.8 pts), the candidate with lower total network delay wins."""
        nodes, links = create_simple_corridor_network()
        demand = TrafficDemandScenario(
            scenario_id="tie",
            name="Tie Scenario",
            od_flows=[ODDemand(origin_node="n1", destination_node="n3", flow_vph=1000.0)],
            peak_duration_min=60.0,
        )
        evaluator = TrafficScenarioEvaluator()

        # Two identical proposals but one has slightly higher speed (lower delay)
        prop_a = Proposal(
            id="h",
            author=AuthorType.HUMAN,
            title="Alternative A",
            description="",
            interventions=[
                SingleIntervention(
                    intervention_type=InterventionType.SIGNAL_RETIMING,
                    target_node_id="n2",
                    target_link_ids=["link_1"],
                    parameters={"green_split_delta": 0.05},
                    estimated_cost_inr=10000.0,
                )
            ],
        )
        prop_b = Proposal(
            id="ai",
            author=AuthorType.AI,
            title="Alternative B",
            description="",
            interventions=[
                SingleIntervention(
                    intervention_type=InterventionType.SIGNAL_RETIMING,
                    target_node_id="n2",
                    target_link_ids=["link_1"],
                    parameters={"green_split_delta": 0.06},
                    estimated_cost_inr=10000.0,
                )
            ],
        )

        report = evaluator.compare_three_alternatives(
            base_links=links,
            base_nodes=nodes,
            demand_scenario=demand,
            human_proposal=prop_a,
            ai_proposal=prop_b,
        )

        h_score = report.human_proposal.metrics.score_breakdown.total_score
        a_score = report.ai_proposal.metrics.score_breakdown.total_score

        if abs(h_score - a_score) < 0.8:
            # Must choose the one with smaller total_network_delay_veh_hours
            if report.human_proposal.metrics.total_network_delay_veh_hours < report.ai_proposal.metrics.total_network_delay_veh_hours:
                assert report.preferred_winner == WinnerType.HUMAN
            else:
                assert report.preferred_winner == WinnerType.AI

    def test_name_and_identity_neutrality(self):
        """Swapping proposal IDs/titles between Human and AI does not change computed metrics."""
        nodes, links = create_simple_corridor_network()
        demand = TrafficDemandScenario(
            scenario_id="neutral",
            name="Neutrality Check",
            od_flows=[ODDemand(origin_node="n1", destination_node="n3", flow_vph=1100.0)],
            peak_duration_min=60.0,
        )
        evaluator = TrafficScenarioEvaluator()

        interv_1 = [
            SingleIntervention(
                intervention_type=InterventionType.ADD_LANE,
                target_link_ids=["link_1"],
                parameters={"extra_lanes": 1},
                estimated_cost_inr=4000000.0,
            )
        ]
        interv_2 = [
            SingleIntervention(
                intervention_type=InterventionType.SIGNAL_RETIMING,
                target_node_id="n2",
                target_link_ids=["link_1"],
                parameters={"green_split_delta": 0.15},
                estimated_cost_inr=200000.0,
            )
        ]

        # Order 1: Human has interv_1, AI has interv_2
        h_prop_1 = Proposal(id="p1", author=AuthorType.HUMAN, title="Lane", description="", interventions=interv_1)
        ai_prop_1 = Proposal(id="p2", author=AuthorType.AI, title="Signal", description="", interventions=interv_2)
        report_1 = evaluator.compare_three_alternatives(links, nodes, demand, h_prop_1, ai_prop_1)

        # Order 2: AI has interv_1, Human has interv_2
        h_prop_2 = Proposal(id="p2", author=AuthorType.HUMAN, title="Signal", description="", interventions=interv_2)
        ai_prop_2 = Proposal(id="p1", author=AuthorType.AI, title="Lane", description="", interventions=interv_1)
        report_2 = evaluator.compare_three_alternatives(links, nodes, demand, h_prop_2, ai_prop_2)

        # Metrics for interv_1 must be identical regardless of whether author is Human or AI
        assert report_1.human_proposal.metrics.score_breakdown.total_score == report_2.ai_proposal.metrics.score_breakdown.total_score
        assert report_1.ai_proposal.metrics.score_breakdown.total_score == report_2.human_proposal.metrics.score_breakdown.total_score
        assert report_1.baseline.metrics.score_breakdown.total_score == report_2.baseline.metrics.score_breakdown.total_score


class TestQueueAndCongestionMetrics:
    """Audit Point 3: Distinguishing vehicles from meters, zero queue when V <= C."""

    def test_queue_distinction_meters_vs_vehicles(self):
        """Verify queue_length_m = queue_vehicles * 7.5 meters."""
        bpr = BPRTrafficEngine(vehicle_effective_length_m=7.5)
        # Volume 1600 vph, Capacity 1200 vph over 60 min -> 400 excess veh
        res = bpr.compute_link_travel_time(
            length_m=1000.0,
            free_flow_speed_kmh=50.0,
            volume_vph=1600.0,
            capacity_vph=1200.0,
            peak_duration_min=60.0,
        )
        assert res["queue_vehicles"] == 400.0
        assert res["queue_length_m"] == 400.0 * 7.5
        assert res["queue_length_m"] == 3000.0

    def test_no_queue_when_undersaturated(self):
        """When volume <= capacity, deterministic queue is strictly 0.0."""
        bpr = BPRTrafficEngine()
        res = bpr.compute_link_travel_time(
            length_m=1000.0,
            free_flow_speed_kmh=50.0,
            volume_vph=1000.0,
            capacity_vph=1200.0,
            peak_duration_min=60.0,
        )
        assert res["queue_vehicles"] == 0.0
        assert res["queue_length_m"] == 0.0
        assert res["queue_delay_sec"] == 0.0


class TestReproducibilityAndInvariance:
    """Audit Point 4: Determinism and baseline invariance."""

    def test_repeated_evaluations_strictly_identical(self):
        """Calling evaluation twice on identical input produces bitwise identical metrics."""
        nodes, links = create_simple_corridor_network()
        demand = TrafficDemandScenario(
            scenario_id="rep",
            name="Reproducibility",
            od_flows=[ODDemand(origin_node="n1", destination_node="n3", flow_vph=1350.0)],
            peak_duration_min=60.0,
        )
        evaluator = TrafficScenarioEvaluator()
        prop = Proposal(
            id="p",
            author=AuthorType.HUMAN,
            title="Test",
            description="",
            interventions=[
                SingleIntervention(
                    intervention_type=InterventionType.WIDEN_ROAD,
                    target_link_ids=["link_1"],
                    parameters={"capacity_boost_factor": 0.25},
                )
            ],
        )

        res_1 = evaluator.evaluate_alternative(links, nodes, demand, prop)
        res_2 = evaluator.evaluate_alternative(links, nodes, demand, prop)

        assert res_1.metrics.avg_journey_time_min == res_2.metrics.avg_journey_time_min
        assert res_1.metrics.avg_vehicle_delay_sec == res_2.metrics.avg_vehicle_delay_sec
        assert res_1.metrics.network_throughput_vph == res_2.metrics.network_throughput_vph
        assert res_1.metrics.score_breakdown.total_score == res_2.metrics.score_breakdown.total_score

    def test_baseline_invariance_under_proposal_changes(self):
        """Changing the human proposal does not alter baseline metrics in comparison reports."""
        nodes, links = create_simple_corridor_network()
        demand = TrafficDemandScenario(
            scenario_id="inv",
            name="Invariance",
            od_flows=[ODDemand(origin_node="n1", destination_node="n3", flow_vph=1200.0)],
            peak_duration_min=60.0,
        )
        evaluator = TrafficScenarioEvaluator()

        prop_ai = Proposal(id="ai", author=AuthorType.AI, title="AI", description="", interventions=[])

        # Report 1 with lane addition
        prop_h1 = Proposal(
            id="h1",
            author=AuthorType.HUMAN,
            title="Add Lane",
            description="",
            interventions=[
                SingleIntervention(
                    intervention_type=InterventionType.ADD_LANE,
                    target_link_ids=["link_1"],
                    parameters={"extra_lanes": 2},
                )
            ],
        )
        rep_1 = evaluator.compare_three_alternatives(links, nodes, demand, prop_h1, prop_ai)

        # Report 2 with road closure
        prop_h2 = Proposal(
            id="h2",
            author=AuthorType.HUMAN,
            title="Close Road",
            description="",
            interventions=[
                SingleIntervention(
                    intervention_type=InterventionType.ROAD_CLOSURE,
                    target_link_ids=["link_2"],
                    parameters={},
                )
            ],
        )
        rep_2 = evaluator.compare_three_alternatives(links, nodes, demand, prop_h2, prop_ai)

        # Baseline metrics must be 100% invariant
        assert rep_1.baseline.metrics.avg_journey_time_min == rep_2.baseline.metrics.avg_journey_time_min
        assert rep_1.baseline.metrics.avg_vehicle_delay_sec == rep_2.baseline.metrics.avg_vehicle_delay_sec
        assert rep_1.baseline.metrics.network_throughput_vph == rep_2.baseline.metrics.network_throughput_vph
        assert rep_1.baseline.metrics.total_network_delay_veh_hours == rep_2.baseline.metrics.total_network_delay_veh_hours
        assert rep_1.baseline.metrics.score_breakdown.total_score == rep_2.baseline.metrics.score_breakdown.total_score

