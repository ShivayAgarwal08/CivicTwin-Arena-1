import urllib.request
import json

# 1. Presets
presets = json.loads(urllib.request.urlopen('http://127.0.0.1:8000/api/presets').read().decode())
print(f"Presets loaded: {[p['id'] for p in presets]}")

# 2. Detail
detail = json.loads(urllib.request.urlopen('http://127.0.0.1:8000/api/presets/jiit_sec128_noida').read().decode())
print(f"JIIT 128 links count: {len(detail['links'])}, baseline delay: {detail['baseline_result']['metrics']['avg_vehicle_delay_sec']}s")

# 3. Compare with Human Proposal
human_prop = {
    'id': 'h1',
    'author': 'HUMAN',
    'title': 'Offline Pick-up Bay',
    'description': 'Construct indented pick-up bay outside JIIT Gate 1',
    'interventions': [{
        'intervention_type': 'PICKUP_BAY',
        'target_link_ids': ['link_jiit_frontage_south'],
        'parameters': {'friction_recovery_pct': 0.45},
        'estimated_cost_inr': 850000.0,
        'rationale': 'Removes double parking outside campus'
    }]
}
req_data = json.dumps({'preset_id': 'jiit_sec128_noida', 'human_proposal': human_prop}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/api/compare', data=req_data, headers={'Content-Type': 'application/json'})
rep = json.loads(urllib.request.urlopen(req).read().decode())

print(f"Comparison evaluation succeeded! Winner: {rep['preferred_winner']}")
print(f"Baseline Score: {rep['baseline']['metrics']['score_breakdown']['total_score']}")
print(f"Human Proposal Score: {rep['human_proposal']['metrics']['score_breakdown']['total_score']}")
print(f"AI Proposal Score: {rep['ai_proposal']['metrics']['score_breakdown']['total_score']}")
print(f"Winner headline: {rep['winner_headline']}")
print(f"Trade-offs count: {len(rep['trade_offs_identified'])}")
