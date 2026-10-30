import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

def get(endpoint):
    req = urllib.request.Request(f"{BASE_URL}{endpoint}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def post(endpoint, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        data=body,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def run_preset_audit(preset_id: str):
    print(f"\n=======================================================")
    print(f"AUDITING PRESET: {preset_id}")
    print(f"=======================================================")

    # 1. Fetch preset details
    preset_data = get(f"/api/presets/{preset_id}")
    meta = preset_data.get("metadata", {})
    location = meta.get("name", preset_id)
    links_count = len(preset_data["links"])
    default_human = preset_data.get("default_human_proposal")
    if not default_human:
        # Fallback to an empty proposal if preset doesn't have default
        default_human = {
            "id": "h_default",
            "author": "HUMAN",
            "title": f"Intervention for {location}",
            "description": "Corridor improvement",
            "interventions": []
        }
    print(f"Location: {location} | Active links: {links_count}")
    print(f"Default proposal: {default_human['title']}")

    # 2. Run live comparison
    rep = post("/api/compare", {
        "preset_id": preset_id,
        "human_proposal": default_human
    })

    # Check vehicle conservation across all three alternatives
    for alt_name, alt_data in [
        ("Baseline", rep["baseline"]),
        ("Human Proposal", rep["human_proposal"]),
        ("AI Proposal", rep["ai_proposal"])
    ]:
        m = alt_data["metrics"]
        demand_veh = m.get("total_demand_vehicles")
        served_veh = m.get("served_vehicles")
        queued_veh = m.get("queued_vehicles")
        unserved_veh = m.get("unserved_vehicles")
        th_vph = m["network_throughput_vph"]
        delay_sec = m["avg_vehicle_delay_sec"]
        score = m["score_breakdown"]["total_score"]

        print(f"\n  [{alt_name}] Score: {score:.1f}/100 | Avg Delay: {delay_sec:.1f}s | Throughput: {th_vph:.0f} vph")
        print(f"    Conservation: Demand={demand_veh} veh = Served({served_veh}) + Queued({queued_veh}) + Unserved({unserved_veh})")

        # Verify conservation:
        calc_sum = round(served_veh + queued_veh + unserved_veh, 1)
        assert abs(demand_veh - calc_sum) <= 1.0, f"Vehicle conservation violated for {alt_name}!"

    winner = rep["preferred_winner"]
    headline = rep["winner_headline"]
    print(f"\n  >>> PREFERRED WINNER: {winner}")
    print(f"  >>> HEADLINE: {headline}")

    # Confirm limitations explicitly present
    limitations = rep.get("limitations_and_assumptions", [])
    assert len(limitations) >= 4, "Limitations missing or truncated"
    print(f"  >>> Limitations labeled: {len(limitations)} engineering disclaimers documented.")
    return rep

if __name__ == "__main__":
    presets = ["jiit_sec128_noida", "botanical_garden_noida", "sec62_electronic_city_noida"]
    for p in presets:
        run_preset_audit(p)
    print("\nALL THREE PRESETS COMPARED LIVE VIA REST API SUCCESSFULLY!")
