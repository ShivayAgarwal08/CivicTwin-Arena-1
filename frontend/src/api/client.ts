import type {
  LocationPresetSummary,
  Proposal,
  ComparisonReport,
  NetworkNode,
  NetworkLink,
  TrafficDemandScenario,
  AlternativeResult,
} from '../types/traffic';

const API_BASE = 'http://localhost:8000/api';

export async function fetchPresets(): Promise<LocationPresetSummary[]> {
  const res = await fetch(`${API_BASE}/presets`);
  if (!res.ok) throw new Error('Failed to load presets');
  return res.json();
}

export interface PresetDetailResponse {
  metadata: Record<string, any>;
  nodes: NetworkNode[];
  links: NetworkLink[];
  demand: TrafficDemandScenario;
  baseline_result: AlternativeResult;
}

export async function fetchPresetDetail(presetId: string): Promise<PresetDetailResponse> {
  const res = await fetch(`${API_BASE}/presets/${presetId}`);
  if (!res.ok) throw new Error(`Failed to load preset ${presetId}`);
  return res.json();
}

export async function generateAIProposal(
  presetId: string,
  humanProposal: Proposal,
  userObjective: string,
  customNodes?: NetworkNode[],
  customLinks?: NetworkLink[],
  customDemand?: TrafficDemandScenario
): Promise<Proposal> {
  const res = await fetch(`${API_BASE}/generate-ai-proposal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      preset_id: presetId,
      human_proposal: humanProposal,
      user_objective: userObjective,
      custom_nodes: customNodes,
      custom_links: customLinks,
      custom_demand: customDemand,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to generate AI proposal' }));
    throw new Error(err.detail || 'Failed to generate AI proposal');
  }
  return res.json();
}

export async function compareThreeAlternatives(params: {
  presetId?: string;
  humanProposal: Proposal;
  aiProposal?: Proposal;
  locationName?: string;
  problemStatement?: string;
  objective?: string;
  customNodes?: NetworkNode[];
  customLinks?: NetworkLink[];
  customDemand?: TrafficDemandScenario;
}): Promise<ComparisonReport> {
  const res = await fetch(`${API_BASE}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      preset_id: params.presetId,
      human_proposal: params.humanProposal,
      ai_proposal: params.aiProposal,
      location_name: params.locationName,
      problem_statement: params.problemStatement,
      objective: params.objective,
      custom_nodes: params.customNodes,
      custom_links: params.customLinks,
      custom_demand: params.customDemand,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Comparison run failed' }));
    throw new Error(err.detail || 'Comparison run failed');
  }
  return res.json();
}

export async function searchOSMLocation(query: string) {
  const res = await fetch(`${API_BASE}/search-osm?q=${encodeURIComponent(query)}`);
  if (!res.ok) return { results: [] };
  return res.json();
}
