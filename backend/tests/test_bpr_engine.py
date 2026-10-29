import pytest
import math
from app.simulation.bpr_engine import BPRTrafficEngine


def test_bpr_free_flow_travel_time():
    """
    Test that when volume is zero (or very low), travel time equals free flow time:
    length = 1000m, speed = 60 km/h = 16.6667 m/s -> t0 = 60.0s.
    """
    engine = BPRTrafficEngine(alpha=0.15, beta=4.0)
    res = engine.compute_link_travel_time(
        length_m=1000.0,
        free_flow_speed_kmh=60.0,
        volume_vph=0.0,
        capacity_vph=1500.0,
        is_signalized=False,
    )

    assert math.isclose(res["free_flow_time_sec"], 60.0, abs_tol=0.1)
    assert math.isclose(res["actual_travel_time_sec"], 60.0, abs_tol=0.1)
    assert res["vc_ratio"] == 0.0
    assert res["delay_sec_per_veh"] == 0.0
    assert res["queue_vehicles"] == 0.0


def test_bpr_at_capacity():
    """
    At V/C = 1.0, BPR formula specifies t = t0 * (1 + alpha * 1^beta) = t0 * (1 + 0.15) = 1.15 * t0.
    For t0 = 60s, travel time must be exactly 69.0s.
    """
    engine = BPRTrafficEngine(alpha=0.15, beta=4.0)
    res = engine.compute_link_travel_time(
        length_m=1000.0,
        free_flow_speed_kmh=60.0,
        volume_vph=1500.0,
        capacity_vph=1500.0,
        is_signalized=False,
    )

    assert math.isclose(res["vc_ratio"], 1.0, abs_tol=0.001)
    assert math.isclose(res["actual_travel_time_sec"], 69.0, abs_tol=0.5)
    assert math.isclose(res["delay_sec_per_veh"], 9.0, abs_tol=0.5)


def test_oversaturation_queue_growth():
    """
    When volume exceeds capacity (e.g. 2000 vph vs 1500 capacity over 60 min),
    excess rate = 500 veh/hr, so queue vehicles = 500 veh.
    Physical queue length = 500 * 7.5m = 3750 meters.
    """
    engine = BPRTrafficEngine(alpha=0.15, beta=4.0, vehicle_effective_length_m=7.5)
    res = engine.compute_link_travel_time(
        length_m=1000.0,
        free_flow_speed_kmh=60.0,
        volume_vph=2000.0,
        capacity_vph=1500.0,
        is_signalized=False,
        peak_duration_min=60.0,
    )

    assert res["vc_ratio"] == 1.333
    assert math.isclose(res["queue_vehicles"], 500.0, abs_tol=1.0)
    assert math.isclose(res["queue_length_m"], 3750.0, abs_tol=5.0)
    assert res["queue_delay_sec"] > 0.0
