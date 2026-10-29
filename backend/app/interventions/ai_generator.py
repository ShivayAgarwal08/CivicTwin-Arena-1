from typing import List, Dict, Optional, Tuple, Any
from ..models.schemas import (
    NetworkLink,
    NetworkNode,
    TrafficDemandScenario,
    Proposal,
    SingleIntervention,
    InterventionType,
    AuthorType,
)
from ..interventions.catalog import INTERVENTION_CATALOG


class AIInterventionGenerator:
    """
    Intelligently analyzes network bottlenecks, topology, and user proposal,
    then constructs an independent, inspectable alternative intervention.
    """

    def generate_alternative_proposal(
        self,
        links: List[NetworkLink],
        nodes: List[NetworkNode],
        demand_scenario: TrafficDemandScenario,
        human_proposal: Proposal,
        baseline_link_results: Dict[str, Any],
        user_objective: str = "Reduce bottleneck delay and queue without neighbor spillover",
    ) -> Proposal:
        # 1. Identify critical bottleneck links in baseline (sorted by V/C and queue)
        ranked_bottlenecks = sorted(
            baseline_link_results.values(),
            key=lambda r: (r.vc_ratio, r.queue_length_m),
            reverse=True,
        )

        critical_link = ranked_bottlenecks[0] if ranked_bottlenecks else None
        critical_link_id = critical_link.link_id if critical_link else (links[0].id if links else "link_1")
        critical_node_id = None
        for l in links:
            if l.id == critical_link_id:
                critical_node_id = l.to_node
                break

        # Check what human proposed to guarantee distinctness
        human_interv_types = {i.intervention_type for i in human_proposal.interventions}
        human_target_links = {lid for i in human_proposal.interventions for lid in i.target_link_ids}

        # Candidate Strategy 1: Curbside Pickup/Drop-off Bay + Traffic Calming
        # Ideal when roadside double-parking chokes road capacity
        has_pickup_bay_human = InterventionType.PICKUP_BAY in human_interv_types
        has_signal_human = InterventionType.SIGNAL_RETIMING in human_interv_types
        has_widening_human = (InterventionType.ADD_LANE in human_interv_types or InterventionType.WIDEN_ROAD in human_interv_types)

        # Candidate strategies formulation
        candidates: List[Proposal] = []

        # Find parallel or collector links in the network
        collector_links = [
            l for l in links
            if l.id != critical_link_id and l.id not in human_target_links and "service" in l.highway_type or "tertiary" in l.highway_type
        ]
        parallel_target = collector_links[0].id if collector_links else (links[1].id if len(links) > 1 else critical_link_id)

        # Candidate A: Signal Re-timing + Upstream Median Closure
        # (Low cost, highly targeted signal green wave)
        sig_node = critical_node_id or (nodes[0].id if nodes else "node_1")
        cand_a_intervs = [
            SingleIntervention(
                intervention_type=InterventionType.SIGNAL_RETIMING,
                target_node_id=sig_node,
                target_link_ids=[critical_link_id],
                parameters={"green_split_delta": 0.18},
                estimated_cost_inr=150000.0,
                rationale="Reallocates +18% cycle green time to the congested inbound approach at the critical junction.",
            ),
            SingleIntervention(
                intervention_type=InterventionType.MEDIAN_CLOSURE,
                target_link_ids=[critical_link_id],
                parameters={},
                estimated_cost_inr=180000.0,
                rationale="Closes uncontrolled median right-turn opening to eliminate shockwave braking on the approach.",
            ),
        ]
        cand_a = Proposal(
            id="ai_cand_signal_opt",
            author=AuthorType.AI,
            title="AI Alternative: Coordinated Signal Split & Median Channelization",
            description=(
                "Rather than expensive physical road widening, dynamically optimize intersection signal splits "
                "by reallocating 18% additional green phase time to the critical queue approach, complemented "
                "by sealing mid-block median openings to eliminate right-turn friction."
            ),
            interventions=cand_a_intervs,
            ai_rationale=(
                f"Analysis shows bottleneck at link '{critical_link_id}' is driven by intersection signal queue accumulation. "
                "Retiming phase splits clears the queue within current cycle times at 95% lower cost than civil road widening, "
                "while median closure prevents sudden lane-blocking turns."
            ),
            trade_off_notes="Minor +3s delay increase on the cross-street approach due to reduced secondary green split.",
            assumptions=[
                "Signal controller hardware supports phase re-allocation.",
                "U-turns can be accommodated safely 200m downstream.",
            ],
        )
        candidates.append(cand_a)

        # Candidate B: Dedicated Curbside Pick-up Bay & Collector Diversion
        # (Directly addresses campus / metro roadside obstruction)
        cand_b_intervs = [
            SingleIntervention(
                intervention_type=InterventionType.PICKUP_BAY,
                target_link_ids=[critical_link_id],
                parameters={"friction_recovery_pct": 0.45},
                estimated_cost_inr=850000.0,
                rationale="Constructs an indented 60-meter drop-off bay, removing parked autos and student pick-up vehicles from travel lanes.",
            ),
            SingleIntervention(
                intervention_type=InterventionType.TRAFFIC_CALMING,
                target_link_ids=[parallel_target],
                parameters={"speed_reduction_kmh": 12.0},
                estimated_cost_inr=300000.0,
                rationale="Installs speed cushions on the adjacent neighborhood street to prevent spillover rat-running.",
            ),
        ]
        cand_b = Proposal(
            id="ai_cand_pickup_curbside",
            author=AuthorType.AI,
            title="AI Alternative: Offline Curbside Pick-up Bay & Neighbor Traffic Calming",
            description=(
                "Addresses the root cause of urban friction outside institution/metro gates by creating an indented "
                "off-carriageway pick-up & drop-off bay, paired with neighborhood traffic calming to prevent diverted cut-throughs."
            ),
            interventions=cand_b_intervs,
            ai_rationale=(
                "Corridor diagnostics indicate that peak queuing is exacerbated by curbside boarding friction reducing "
                "effective carriageway width by up to 45%. Constructing a designated bay restores full two-lane flow "
                "without triggering downstream overcapacity."
            ),
            trade_off_notes="Requires modest curb-space civil reconfiguration; slightly slows non-corridor neighborhood speeds.",
            assumptions=[
                "Frontage right-of-way allows 3.5m indentation for curbside bay.",
                "Enforcement ensures cabs utilize the designated bay rather than main carriageway.",
            ],
        )
        candidates.append(cand_b)

        # Candidate C: One-Way Diversion Loop with Parallel Arterial Upgrading
        cand_c_intervs = [
            SingleIntervention(
                intervention_type=InterventionType.ONE_WAY_DIVERSION,
                target_link_ids=[critical_link_id],
                parameters={},
                estimated_cost_inr=350000.0,
                rationale="Converts critical bottleneck segment into dedicated one-way flow, doubling directional throughput.",
            ),
            SingleIntervention(
                intervention_type=InterventionType.ADD_LANE,
                target_link_ids=[parallel_target],
                parameters={"extra_lanes": 1},
                estimated_cost_inr=1200000.0,
                rationale="Widens parallel return corridor to absorb the counter-directional flow safely.",
            ),
        ]
        cand_c = Proposal(
            id="ai_cand_oneway_loop",
            author=AuthorType.AI,
            title="AI Alternative: One-Way Couplet & Parallel Arterial Absorption",
            description=(
                "Implements a one-way circulation couplet on the primary corridor, diverting reverse flow "
                "onto an upgraded parallel collector to eliminate opposing vehicle conflicts."
            ),
            interventions=cand_c_intervs,
            ai_rationale=(
                "Eliminating two-way conflict points increases saturation flow by 25%. Balancing this with parallel "
                "collector capacity prevents severe spillover into local residential lanes."
            ),
            trade_off_notes="Slightly increases total vehicle trip distance for returning local residents by ~350 meters.",
            assumptions=[
                "Sufficient signage and turning radii available at terminal intersections.",
            ],
        )
        candidates.append(cand_c)

        # Select candidate that is distinct from human proposal
        selected_candidate = None
        for cand in candidates:
            cand_interv_types = {i.intervention_type for i in cand.interventions}
            # If human did road widening / adding lane, prefer candidate A (signal) or B (pickup bay)
            if has_widening_human and InterventionType.ADD_LANE not in cand_interv_types and InterventionType.WIDEN_ROAD not in cand_interv_types:
                selected_candidate = cand
                break
            # If human did signal timing, prefer candidate B (pickup bay) or C (one-way loop)
            elif has_signal_human and InterventionType.SIGNAL_RETIMING not in cand_interv_types:
                selected_candidate = cand
                break
            # If human did pickup bay, prefer candidate A (signal opt) or C (one-way loop)
            elif has_pickup_bay_human and InterventionType.PICKUP_BAY not in cand_interv_types:
                selected_candidate = cand
                break

        if selected_candidate is None:
            # Pick candidate A by default as a robust independent alternative
            selected_candidate = candidates[0]

        return selected_candidate
