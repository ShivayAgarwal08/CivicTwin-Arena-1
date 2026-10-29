import urllib.request
import json

# 1. Health
health = json.loads(urllib.request.urlopen('http://127.0.0.1:8000/api/health').read().decode())
print(f"Health: {health}")

# 2. Presets
presets = json.loads(urllib.request.urlopen('http://127.0.0.1:8000/api/presets').read().decode())
print(f"Presets loaded: {[p['id'] for p in presets]}")

# 3. Catalog & ROAD_CLOSURE
cat = json.loads(urllib.request.urlopen('http://127.0.0.1:8000/api/catalog').read().decode())
print(f"Catalog items count: {len(cat)}, Includes ROAD_CLOSURE: {'ROAD_CLOSURE' in cat}")
assert 'ROAD_CLOSURE' in cat

# 4. Detail check for JIIT 128
detail = json.loads(urllib.request.urlopen('http://127.0.0.1:8000/api/presets/jiit_sec128_noida').read().decode())
print(f"JIIT 128 links count: {len(detail['links'])}, baseline delay: {detail['baseline_result']['metrics']['avg_vehicle_delay_sec']}s")

# 5. Botanical Garden comparison evaluation
prop = {
    'id': 'botanical_bay',
    'author': 'HUMAN',
    'title': 'Offline E-Rickshaw & Auto Bay at Metro Gate',
    'description': 'Construct indented bay to remove auto choke from Dadri Main Road',
    'interventions': [{
        'intervention_type': 'PICKUP_BAY',
        'target_link_ids': ['link_dadri_main_eastbound'],
        'parameters': {'friction_recovery_pct': 0.45},
        'estimated_cost_inr': 850000.0,
        'rationale': 'Clears Dadri road curbside auto queue'
    }]
}
body = json.dumps({'preset_id': 'botanical_garden_noida', 'human_proposal': prop}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/api/compare', data=body, headers={'Content-Type': 'application/json'})
rep = json.loads(urllib.request.urlopen(req).read().decode())

print(f"Botanical Garden Winner: {rep['preferred_winner']}")
print(f"Baseline Delay: {rep['baseline']['metrics']['avg_vehicle_delay_sec']}s | Score: {rep['baseline']['metrics']['score_breakdown']['total_score']}")
print(f"Human Delay: {rep['human_proposal']['metrics']['avg_vehicle_delay_sec']}s | Score: {rep['human_proposal']['metrics']['score_breakdown']['total_score']}")
print(f"AI Delay: {rep['ai_proposal']['metrics']['avg_vehicle_delay_sec']}s | Score: {rep['ai_proposal']['metrics']['score_breakdown']['total_score']}")
print(f"Human Spillover counts: {rep['human_proposal']['metrics']['spillover_counts']}")
print(f"AI Spillover counts: {rep['ai_proposal']['metrics']['spillover_counts']}")
print("All live API verifications passed successfully!")
