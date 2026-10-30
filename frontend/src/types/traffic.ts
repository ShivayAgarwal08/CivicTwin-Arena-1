export type InterventionType =
  | 'ADD_LANE'
  | 'WIDEN_ROAD'
  | 'SIGNAL_RETIMING'
  | 'PICKUP_BAY'
  | 'ROAD_CLOSURE'
  | 'ONE_WAY_DIVERSION'
  | 'TRAFFIC_CALMING'
  | 'MEDIAN_CLOSURE';

export type SpilloverStatus =
  | 'improved'
  | 'neutral'
  | 'moderate'
  | 'deteriorated'
  | 'newly_congested';

export type AuthorType = 'BASELINE' | 'HUMAN' | 'AI';
export type WinnerType = 'BASELINE' | 'HUMAN' | 'AI' | 'TIE';

export interface NetworkNode {
  id: string;
  name: string;
  lat: float;
  lon: float;
  is_signalized?: boolean;
  cycle_length_sec?: number;
  green_split?: number;
}

export type float = number;

export interface NetworkLink {
  id: string;
  name: string;
  from_node: string;
  to_node: string;
  highway_type: string;
  length_m: number;
  lanes: number;
  free_flow_speed_kmh: number;
  base_capacity_vph: number;
  effective_capacity_vph?: number;
  coordinates: [number, number][]; // [[lon, lat], ...]
  is_oneway?: boolean;
  has_curbside_friction?: boolean;
}

export interface ODDemand {
  origin_node: string;
  destination_node: string;
  flow_vph: number;
  description?: string;
}

export interface TrafficDemandScenario {
  scenario_id: string;
  name: string;
  peak_duration_min: number;
  od_flows: ODDemand[];
  observed_vs_modeled_note: string;
}

export interface SingleIntervention {
  intervention_type: InterventionType;
  target_link_ids: string[];
  target_node_id?: string;
  parameters: Record<string, any>;
  estimated_cost_inr: number;
  rationale?: string;
}

export interface Proposal {
  id: string;
  author: AuthorType;
  title: string;
  description: string;
  interventions: SingleIntervention[];
  ai_rationale?: string;
  trade_off_notes?: string;
  assumptions?: string[];
}

export interface LinkPerformanceResult {
  link_id: string;
  link_name: string;
  highway_type: string;
  volume_vph: number;
  capacity_vph: number;
  vc_ratio: number;
  free_flow_time_sec: number;
  actual_travel_time_sec: number;
  speed_kmh: number;
  delay_sec_per_veh: number;
  queue_length_m: number;
  queue_vehicles: number;
  is_directly_modified: boolean;
  intervention_label?: string;
  spillover_status: SpilloverStatus;
  spillover_delta_delay_sec: number;
  spillover_explanation: string;
  coordinates: [number, number][];
}

export interface ScoreBreakdown {
  delay_component: number;
  queue_component: number;
  spillover_penalty: number;
  cost_penalty: number;
  total_score: number;
  formula_explanation: string;
}

export interface AlternativeMetrics {
  avg_journey_time_min: number;
  avg_vehicle_delay_sec: number;
  avg_queue_waiting_time_sec: number;
  max_queue_length_m: number;
  network_throughput_vph: number;
  total_network_delay_veh_hours: number;
  congestion_duration_min: number;
  avg_vc_ratio: number;
  estimated_cost_inr_lakhs: number;
  spillover_counts: Record<string, number>;
  score_breakdown: ScoreBreakdown;
}

export interface AlternativeResult {
  proposal: Proposal;
  metrics: AlternativeMetrics;
  link_results: Record<string, LinkPerformanceResult>;
}

export interface TradeOffDetail {
  category: string;
  baseline_value: string;
  proposal_value: string;
  impact: string;
  explanation: string;
}

export interface ComparisonReport {
  scenario_id: string;
  network_name: string;
  location_name: string;
  problem_statement: string;
  objective_extracted: string;
  baseline: AlternativeResult;
  human_proposal: AlternativeResult;
  ai_proposal: AlternativeResult;
  preferred_winner: WinnerType;
  winner_headline: string;
  winner_rationale: string;
  trade_offs_identified: TradeOffDetail[];
  sensitivity_and_robustness: string;
  limitations_and_assumptions: string[];
}

export interface LocationPresetSummary {
  id: string;
  name: string;
  city: string;
  description: string;
  center_lat: number;
  center_lon: number;
  default_zoom: number;
  problem_statement: string;
  objective: string;
  is_real_osm: boolean;
}

export interface RouteTurnInstruction {
  step_number: number;
  instruction: string;
  maneuver: string;
  road_name: string;
  junction_name: string;
  distance_m: number;
  travel_time_sec: number;
}

export interface NetworkRoute {
  id: string;
  name: string;
  origin_node_id: string;
  origin_name: string;
  destination_node_id: string;
  destination_name: string;
  is_primary: boolean;
  link_ids: string[];
  total_distance_m: number;
  free_flow_time_sec: number;
  modeled_travel_time_sec: number;
  delay_sec: number;
  critical_bottleneck_link_id?: string;
  max_vc_ratio: number;
  turn_instructions: RouteTurnInstruction[];
  geometry: [number, number][]; // [[lat, lon], ...]
}


