import json
import urllib.request
import sys

BASE_URL = "http://127.0.0.1:8000"

def get(path):
    with urllib.request.urlopen(f"{BASE_URL}{path}") as resp:
        return json.loads(resp.read().decode())

def post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def test_complete_user_journey():
    print("=" * 70)
    print("STARTING CIVICTWIN ARENA 9-STEP USER JOURNEY VERIFICATION")
    print("=" * 70)

    # 1. Step 1: Select Corridor & Fetch Catalog
    print("\n[STEP 1] Fetching Corridor Presets & Supported Intervention Catalog...")
    presets = get("/api/presets")
    catalog = get("/api/catalog")
    assert len(presets) >= 3, "Presets missing"
    assert "ADD_LANE" in catalog and "ROAD_CLOSURE" in catalog, "Catalog missing types"
    print(f" -> Found {len(presets)} corridors: {[p['name'] for p in presets]}")
    print(f" -> Found {len(catalog)} supported engineering intervention types in catalog.")

    for preset in presets:
        pid = preset["id"]
        pname = preset["name"]
        print(f"\n" + "-" * 60)
        print(f"RUNNING JOURNEY FOR CORRIDOR: {pname} ({pid})")
        print("-" * 60)

        # 2. Step 2: Inspect Baseline Network & Traffic
        print("[STEP 2] Inspecting baseline network geometry, nodes, and demand scenario...")
        pdetail = get(f"/api/presets/{pid}")
        links = pdetail["links"]
        nodes = pdetail["nodes"]
        demand = pdetail["demand"]
        baseline_res = pdetail["baseline_result"]
        base_metrics = baseline_res["metrics"]

        print(f" -> Active geometry: {len(links)} links, {len(nodes)} junctions.")
        print(f" -> Modeled Peak Demand: {sum(od['flow_vph'] for od in demand['od_flows'])} vph over {demand['peak_duration_min']} min peak.")
        print(f" -> Baseline Avg Delay: {base_metrics['avg_vehicle_delay_sec']}s | Max Queue: {base_metrics['max_queue_length_m']}m | Throughput: {base_metrics['network_throughput_vph']} vph")
        assert len(links) > 0 and len(nodes) > 0
        assert base_metrics["avg_vehicle_delay_sec"] > 0

        # 3. Step 3: Select Road Link for Intervention
        print("[STEP 3] Selecting candidate road link...")
        # Pick the link with highest V/C
        crit_link = sorted(links, key=lambda l: baseline_res["link_results"].get(l["id"], {}).get("vc_ratio", 0), reverse=True)[0]
        selected_lid = crit_link["id"]
        selected_lname = crit_link["name"]
        print(f" -> Selected target road: '{selected_lname}' ({selected_lid})")

        # 4. Step 4: Create Human Intervention
        print("[STEP 4] Configuring human intervention...")
        human_proposal = {
            "id": f"human_{pid}",
            "author": "HUMAN",
            "title": f"Targeted Improvement for {selected_lname}",
            "description": "Construct indented pick-up bay to recover curbside travel capacity.",
            "interventions": [
                {
                    "intervention_type": "PICKUP_BAY",
                    "target_link_ids": [selected_lid],
                    "parameters": {"friction_recovery_pct": 0.45},
                    "estimated_cost_inr": 850000.0,
                    "rationale": "Clears stopped cabs and auto-rickshaws outside gate."
                }
            ]
        }
        print(f" -> Configured: {human_proposal['title']} (Est. Cost: INR 8.5 Lakhs)")

        # 5. Step 5: Generate Independent AI Alternative
        print("[STEP 5] Generating independent AI alternative proposal...")
        ai_prop = post("/api/generate-ai-proposal", {
            "preset_id": pid,
            "human_proposal": human_proposal,
            "user_objective": pdetail.get("metadata", {}).get("objective", "Reduce delay without spillover")
        })
        print(f" -> AI Generated: '{ai_prop['title']}' (Interventions: {len(ai_prop['interventions'])})")
        print(f" -> AI Rationale: {ai_prop.get('ai_rationale')[:90]}...")
        assert len(ai_prop["interventions"]) > 0

        # 6. Step 6: Evaluate All 3 Alternatives under Identical Assumptions
        print("[STEP 6] Running 3-Alternative Simulation Comparison...")
        report = post("/api/compare", {
            "preset_id": pid,
            "human_proposal": human_proposal,
            "ai_proposal": ai_prop
        })

        b_res = report["baseline"]["metrics"]
        h_res = report["human_proposal"]["metrics"]
        a_res = report["ai_proposal"]["metrics"]

        # 7. Step 7: Compare Delay, Queue, Throughput, Congestion, and Spillover
        print("[STEP 7] Comparing predicted outcomes across all 3 alternatives:")
        print(f"   Metric                    Baseline       Human Proposal     AI Alternative")
        print(f"   --------------------------------------------------------------------------")
        print(f"   Avg Vehicle Delay (s)     {b_res['avg_vehicle_delay_sec']:>8.1f}s      {h_res['avg_vehicle_delay_sec']:>11.1f}s        {a_res['avg_vehicle_delay_sec']:>11.1f}s")
        print(f"   Max Queue Length (m)      {b_res['max_queue_length_m']:>8.0f}m      {h_res['max_queue_length_m']:>11.0f}m        {a_res['max_queue_length_m']:>11.0f}m")
        print(f"   Network Throughput (vph)  {b_res['network_throughput_vph']:>8.0f}        {h_res['network_throughput_vph']:>11.0f}          {a_res['network_throughput_vph']:>11.0f}")
        print(f"   Peak Duration (min)       {b_res['congestion_duration_min']:>8.0f}m      {h_res['congestion_duration_min']:>11.0f}m        {a_res['congestion_duration_min']:>11.0f}m")
        print(f"   New Spillover Chokes      {0:>8d}        {h_res['spillover_counts'].get('newly_congested', 0):>11d}          {a_res['spillover_counts'].get('newly_congested', 0):>11d}")
        print(f"   Capital Cost (INR Lakhs)  {0:>8.1f}L       {h_res['estimated_cost_inr_lakhs']:>10.1f}L         {a_res['estimated_cost_inr_lakhs']:>10.1f}L")
        print(f"   Total Balanced Score      {b_res['score_breakdown']['total_score']:>8.1f}        {h_res['score_breakdown']['total_score']:>11.1f}          {a_res['score_breakdown']['total_score']:>11.1f}")

        # 8. Step 8: Understand Scoring and Trade-offs
        print("[STEP 8] Scoring & Trade-offs Rationale:")
        print(f" -> Preferred Winner: {report['preferred_winner']}")
        print(f" -> Winner Headline: {report['winner_headline']}")
        print(f" -> Identified Trade-Offs: {len(report['trade_offs_identified'])} specific dimension comparisons.")

        # 9. Step 9: Printable Decision Report Verification
        print("[STEP 9] Printable Decision Report validation:")
        assert "winner_rationale" in report and len(report["winner_rationale"]) > 0
        assert "limitations_and_assumptions" in report and len(report["limitations_and_assumptions"]) >= 4
        print(f" -> Decision Brief contains {len(report['limitations_and_assumptions'])} engineering limitation disclaimers.")
        print(f" -> Sensitivity Analysis: {report['sensitivity_and_robustness'][:80]}...")
        print(f"PASS: Corridor {pname} completed full 9-step journey cleanly.")

    print("\n" + "=" * 70)
    print("ALL 3 CORRIDOR PRESETS SUCCESSFULLY VERIFIED END-TO-END!")
    print("=" * 70)

if __name__ == "__main__":
    test_complete_user_journey()
