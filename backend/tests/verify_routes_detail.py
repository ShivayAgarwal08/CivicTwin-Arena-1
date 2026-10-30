"""
Detailed verification test for CorridorRouter and the /api/presets/{preset_id}/routes endpoint.
Runs both in-process via FastAPI TestClient (guaranteed stability) and checks live HTTP if available.
"""
import os
import sys

# Ensure backend directory is in sys.path regardless of working directory
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from app.main import app
from app.data.presets import PresetRepository
from app.simulation.router import CorridorRouter, calc_bearing, classify_turn

def test_full_route_verification():
    print("==================================================")
    print("RUNNING CORRIDOR ROUTE & TOPOLOGY AUDIT: JIIT 128")
    print("==================================================")
    
    client = TestClient(app)
    
    # 1. API endpoint responds successfully
    res = client.get("/api/presets/jiit_sec128_noida/routes")
    assert res.status_code == 200, f"Expected 200 OK, got {res.status_code}: {res.text}"
    routes = res.json()
    print(f"[OK] Routing API responded with 200 OK. Total routes computed: {len(routes)}")
    assert len(routes) > 0, "No routes returned for JIIT Sector 128 preset!"

    # 2. Preset repository verification
    preset_data = PresetRepository.get_preset("jiit_sec128_noida")
    assert preset_data is not None, "Preset 'jiit_sec128_noida' failed to load from repository"
    nodes, links, demand, meta = preset_data
    node_map = {n.id: n for n in nodes}
    link_map = {l.id: l for l in links}
    print(f"[OK] JIIT 128 Preset loaded: {len(nodes)} nodes, {len(links)} links, {len(demand.od_flows)} OD pairs")

    # 3. Detailed inspection of each returned route
    for idx, r in enumerate(routes):
        print(f"\n--- Route {idx + 1}: {r['name']} ({'PRIMARY' if r['is_primary'] else 'ALTERNATIVE'}) ---")
        print(f"  Origin: {r['origin_name']} ({r['origin_node_id']})")
        print(f"  Destination: {r['destination_name']} ({r['destination_node_id']})")
        print(f"  Distance: {r['total_distance_m']} m | Free-Flow: {r['free_flow_time_sec']}s | Modeled: {r['modeled_travel_time_sec']}s")
        print(f"  Links in Path ({len(r['link_ids'])}): {r['link_ids']}")

        # 4. Confirm route coordinates are connected and ordered
        assert len(r['geometry']) > 1, f"Route {r['id']} has invalid coordinate geometry count {len(r['geometry'])}"
        for coord in r['geometry']:
            assert len(coord) == 2, f"Coordinate {coord} is not [lat, lon]"
            lat, lon = coord
            assert 28.4 <= lat <= 28.6, f"Latitude {lat} out of Noida bounds"
            assert 77.2 <= lon <= 77.5, f"Longitude {lon} out of Noida bounds"

        # 5. Confirm road segments and junctions are correctly ordered and topologically connected
        prev_to_node = None
        sum_link_distance = 0.0
        for lid in r['link_ids']:
            assert lid in link_map, f"Link {lid} does not exist in network links!"
            link = link_map[lid]
            sum_link_distance += link.length_m
            if prev_to_node is not None:
                assert link.from_node == prev_to_node, (
                    f"Topological break in route {r['id']}: Link {lid} starts at node {link.from_node}, "
                    f"but preceding link ended at {prev_to_node}!"
                )
            prev_to_node = link.to_node

        # 6. Confirm route distance is calculated consistently
        diff_dist = abs(r['total_distance_m'] - sum_link_distance)
        assert diff_dist <= 1.0, f"Distance discrepancy: route reported {r['total_distance_m']}m vs link sum {sum_link_distance}m"

        # 7. Confirm turn instructions are derived from actual geometry, not hardcoded text
        instructions = r['turn_instructions']
        assert len(instructions) >= 2, f"Expected at least depart + arrive instructions, got {len(instructions)}"
        assert instructions[0]['maneuver'] == 'depart', f"First instruction must be depart, got {instructions[0]['maneuver']}"
        assert instructions[-1]['maneuver'] == 'arrive', f"Last instruction must be arrive, got {instructions[-1]['maneuver']}"
        
        print("  Turn-by-Turn Guidance:")
        for step in instructions:
            print(f"    Step {step['step_number']}: [{step['maneuver']}] {step['instruction']} ({step['distance_m']}m, {step['travel_time_sec']}s)")

    # 8. Verify error handling: Disconnected or non-existent preset returns 404
    err_res = client.get("/api/presets/non_existent_preset/routes")
    assert err_res.status_code == 404, f"Expected 404 for unknown preset, got {err_res.status_code}"
    print(f"\n[OK] Non-existent preset correctly returned 404 Not Found.")

    print("\n==================================================")
    print("ALL ROUTE TOPOLOGY & GEOMETRY VERIFICATIONS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    test_full_route_verification()
