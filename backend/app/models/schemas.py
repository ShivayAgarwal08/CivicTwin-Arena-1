from enum import Enum
from typing import List, Dict, Optional, Any, Tuple
from pydantic import BaseModel, Field


class InterventionType(str, Enum):
    ADD_LANE = "ADD_LANE"                    # Physical road widening / adding an extra travel lane
    WIDEN_ROAD = "WIDEN_ROAD"                # Road corridor capacity expansion
    SIGNAL_RETIMING = "SIGNAL_RETIMING"      # Reallocate green phase split at intersection
    PICKUP_BAY = "PICKUP_BAY"                # Dedicated off-line curbside pick-up/drop-off bay (curbside friction elimination)
    ROAD_CLOSURE = "ROAD_CLOSURE"            # Complete street or corridor closure / pedestrianization
    ONE_WAY_DIVERSION = "ONE_WAY_DIVERSION"  # Re-route flow direction, eliminate conflicting turns
    TRAFFIC_CALMING = "TRAFFIC_CALMING"      # Speed table / chicane to discourage residential rat-running
    MEDIAN_CLOSURE = "MEDIAN_CLOSURE"        # Restrict uncontrolled right-turns to prevent bottleneck friction


class SpilloverClassification(str, Enum):
    IMPROVED = "improved"                    # Delay decreased by >= 10%
    NEUTRAL = "neutral"                      # Delay within +/- 5%
    MODERATE = "moderate"                    # Delay increased by 5-20%
    DETERIORATED = "deteriorated"            # Delay increased by > 20%
    NEWLY_CONGESTED = "newly_congested"      # V/C jumped from < 0.85 to >= 0.95


class AuthorType(str, Enum):
    BASELINE = "BASELINE"
    HUMAN = "HUMAN"
    AI = "AI"


class WinnerType(str, Enum):
    BASELINE = "BASELINE"
    HUMAN = "HUMAN"
    AI = "AI"
    TIE = "TIE"


class NetworkNode(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    is_signalized: bool = False
    cycle_length_sec: Optional[float] = 90.0
    green_split: Optional[float] = 0.5  # Effective green ratio for main approach


class NetworkLink(BaseModel):
    id: str
    name: str
    from_node: str
    to_node: str
    highway_type: str = "primary"            # primary, secondary, tertiary, residential, service
    length_m: float
    lanes: int = 2
    free_flow_speed_kmh: float = 50.0
    base_capacity_vph: float                 # saturation capacity in veh/hr
    effective_capacity_vph: Optional[float] = None
    coordinates: List[List[float]] = []      # [[lon, lat], ...] GeoJSON order
    is_oneway: bool = True
    has_curbside_friction: bool = False      # true if prone to double parking / pickup queues


class ODDemand(BaseModel):
    origin_node: str
    destination_node: str
    flow_vph: float                          # vehicles per hour during peak hour
    description: Optional[str] = None


class TrafficDemandScenario(BaseModel):
    scenario_id: str
    name: str
    peak_duration_min: float = 60.0          # analysis period duration in minutes (e.g. 60 min)
    od_flows: List[ODDemand]
    observed_vs_modeled_note: str = (
        "Demand reflects calibrated modeled evening peak flow (3:00 PM - 7:00 PM) based on regional traffic studies."
    )


class SingleIntervention(BaseModel):
    intervention_type: InterventionType
    target_link_ids: List[str] = Field(default_factory=list)
    target_node_id: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    # Examples:
    # {"extra_lanes": 1}
    # {"green_split_delta": 0.15} (e.g., +15% green time to main corridor)
    # {"curbside_recovery_ratio": 0.40} (removes 40% friction block)
    # {"reverse_flow": False, "divert_fraction": 0.5}
    estimated_cost_inr: float = 0.0          # in Indian Rupees (INR Lakhs or standard currency)
    rationale: str = ""


class Proposal(BaseModel):
    id: str
    author: AuthorType
    title: str
    description: str
    interventions: List[SingleIntervention] = Field(default_factory=list)
    ai_rationale: Optional[str] = None
    trade_off_notes: Optional[str] = None
    assumptions: List[str] = Field(default_factory=list)


class LinkPerformanceResult(BaseModel):
    link_id: str
    link_name: str
    highway_type: str
    volume_vph: float
    capacity_vph: float
    vc_ratio: float
    free_flow_time_sec: float
    actual_travel_time_sec: float
    speed_kmh: float
    delay_sec_per_veh: float
    queue_length_m: float
    queue_vehicles: float
    is_directly_modified: bool = False
    intervention_label: Optional[str] = None
    spillover_status: SpilloverClassification = SpilloverClassification.NEUTRAL
    spillover_delta_delay_sec: float = 0.0
    spillover_explanation: str = ""
    coordinates: List[List[float]] = []


class ScoreBreakdown(BaseModel):
    delay_component: float       # 0 to 35
    queue_component: float       # 0 to 25
    spillover_penalty: float     # 0 to 25
    cost_penalty: float          # 0 to 15
    total_score: float           # 0 to 100
    formula_explanation: str


class AlternativeMetrics(BaseModel):
    avg_journey_time_min: float
    avg_vehicle_delay_sec: float
    avg_queue_waiting_time_sec: float
    max_queue_length_m: float
    network_throughput_vph: float
    total_network_delay_veh_hours: float
    congestion_duration_min: float
    avg_vc_ratio: float
    estimated_cost_inr_lakhs: float
    spillover_counts: Dict[str, int]
    score_breakdown: ScoreBreakdown
    total_demand_vehicles: Optional[float] = None
    served_vehicles: Optional[float] = None
    queued_vehicles: Optional[float] = None
    unserved_vehicles: Optional[float] = None


class AlternativeResult(BaseModel):
    proposal: Proposal
    metrics: AlternativeMetrics
    link_results: Dict[str, LinkPerformanceResult]


class TradeOffDetail(BaseModel):
    category: str
    baseline_value: str
    proposal_value: str
    impact: str                  # Positive, Neutral, Negative
    explanation: str


class ComparisonReport(BaseModel):
    scenario_id: str
    network_name: str
    location_name: str
    problem_statement: str
    objective_extracted: str
    baseline: AlternativeResult
    human_proposal: AlternativeResult
    ai_proposal: AlternativeResult
    preferred_winner: WinnerType
    winner_headline: str
    winner_rationale: str
    trade_offs_identified: List[TradeOffDetail]
    sensitivity_and_robustness: str
    limitations_and_assumptions: List[str]


class LocationPresetSummary(BaseModel):
    id: str
    name: str
    city: str
    description: str
    center_lat: float
    center_lon: float
    default_zoom: int
    problem_statement: str
    objective: str
    is_real_osm: bool = True


class RouteTurnInstruction(BaseModel):
    step_number: int
    instruction: str
    maneuver: str
    road_name: str
    junction_name: str
    distance_m: float
    travel_time_sec: float


class NetworkRoute(BaseModel):
    id: str
    name: str
    origin_node_id: str
    origin_name: str
    destination_node_id: str
    destination_name: str
    is_primary: bool = True
    link_ids: List[str]
    total_distance_m: float
    free_flow_time_sec: float
    modeled_travel_time_sec: float
    delay_sec: float
    critical_bottleneck_link_id: Optional[str] = None
    max_vc_ratio: float
    turn_instructions: List[RouteTurnInstruction]
    geometry: List[List[float]]  # [[lat, lon], ...]


class StudyAreaSearchRequest(BaseModel):
    query: str
    limit: int = 5


class FetchOSMStudyAreaRequest(BaseModel):
    south: float
    west: float
    north: float
    east: float
    area_name: str = "Custom Study Area"
    city: str = "Urban Center"
    problem_statement: Optional[str] = "Peak hour traffic congestion"
    objective: Optional[str] = "Reduce vehicle delay and spillover"


class FetchOSMStudyAreaResponse(BaseModel):
    status: str
    area_name: str
    city: str
    nodes: List[NetworkNode]
    links: List[NetworkLink]
    demand: TrafficDemandScenario
    warnings: List[str] = []
    node_count: int
    link_count: int
    is_connected: bool
    center: List[float]
    default_zoom: int = 16


class SaveStudyAreaRequest(BaseModel):
    id: str
    name: str
    city: str
    problem_statement: str
    objective: str
    nodes: List[NetworkNode]
    links: List[NetworkLink]
    demand: TrafficDemandScenario
    metadata: Dict[str, Any] = Field(default_factory=dict)



