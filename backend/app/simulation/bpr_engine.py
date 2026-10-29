import math
from typing import Dict, Any, Tuple


class BPRTrafficEngine:
    """
    Traffic network link performance engine combining:
    1. Bureau of Public Roads (BPR) link travel time function (for undersaturated flow).
    2. Webster's (1958) delay formulation for signalized intersection approaches.
    3. Classical deterministic queuing theory for oversaturated bottlenecks (V > C).

    Mathematical Formulation:
    --------------------------
    - Free-flow travel time:
        t_0 = length_m / (free_flow_speed_kmh / 3.6)  [seconds]

    - Saturated link travel time (at V = C):
        t_sat = t_0 * (1.0 + alpha)  [seconds]

    - For V <= C:
        t_bpr = t_0 * (1.0 + alpha * (V / C)^beta)

    - For V > C (Oversaturated condition over peak duration T):
        Excess arrival rate = V - C  [veh/hr]
        Maximum residual queue accumulation:
            Q_max = (V - C) * (T / 60.0)  [vehicles]
        Average queue backlog over period T:
            Q_bar = Q_max / 2.0  [vehicles]
        Total vehicle-hours spent waiting in queue:
            W_total = 0.5 * (V - C) * (T / 60.0)^2  [veh-hours]
        Average queuing delay per arriving vehicle:
            d_queue = (W_total / (V * (T / 60.0))) * 3600 = (Q_max / (2.0 * V)) * 3600  [seconds]
        Link travel time in oversaturation:
            t_link = t_sat + d_queue

    - Signalized Intersection Approach Delay (Webster, 1958):
        Uniform delay d_1:
            d_1 = (cycle * (1 - lambda)^2) / (2 * (1 - lambda * x))
        where lambda = green_split (g/C), x = min(0.98, V/C)
        Incremental delay d_2:
            d_2 = (x^2 * 3600) / (2 * V * (1 - x))  (clamped to 60s for numerical stability)
        d_signal = d_1 + d_2

    - Physical Queue Length:
        queue_length_m = Q_max * vehicle_effective_length_m  [meters]
    """

    def __init__(
        self,
        alpha: float = 0.15,
        beta: float = 4.0,
        signal_alpha: float = 0.25,
        signal_beta: float = 3.5,
        vehicle_effective_length_m: float = 7.5,
    ):
        self.alpha = alpha
        self.beta = beta
        self.signal_alpha = signal_alpha
        self.signal_beta = signal_beta
        self.vehicle_effective_length_m = vehicle_effective_length_m

    def compute_link_travel_time(
        self,
        length_m: float,
        free_flow_speed_kmh: float,
        volume_vph: float,
        capacity_vph: float,
        is_signalized: bool = False,
        cycle_sec: float = 90.0,
        green_split: float = 0.5,
        peak_duration_min: float = 60.0,
    ) -> Dict[str, float]:
        """
        Calculates travel time, delay, V/C ratio, physical queue, and waiting time.
        """
        free_speed_mps = max(5.0, free_flow_speed_kmh / 3.6)
        t0_sec = length_m / free_speed_mps

        # If capacity is zero or closed
        if capacity_vph <= 0.0:
            return {
                "free_flow_time_sec": round(t0_sec, 2),
                "actual_travel_time_sec": 999999.0,
                "delay_sec_per_veh": 999999.0,
                "vc_ratio": 99.0 if volume_vph > 0 else 0.0,
                "speed_kmh": 0.0,
                "queue_vehicles": round(volume_vph * (peak_duration_min / 60.0), 1),
                "queue_length_m": round(volume_vph * (peak_duration_min / 60.0) * self.vehicle_effective_length_m, 1),
                "queue_delay_sec": 999999.0,
            }

        safe_capacity = max(1.0, capacity_vph)
        safe_volume = max(0.0, volume_vph)
        vc_ratio = safe_volume / safe_capacity

        cur_alpha = self.signal_alpha if is_signalized else self.alpha
        cur_beta = self.signal_beta if is_signalized else self.beta

        queue_vehicles = 0.0
        queue_delay_sec = 0.0

        if vc_ratio <= 1.0:
            # Undersaturated BPR curve
            link_travel_time_sec = t0_sec * (1.0 + cur_alpha * (vc_ratio ** cur_beta))
        else:
            # Oversaturated condition: link traverses at saturation speed + deterministic queuing delay
            t_sat_sec = t0_sec * (1.0 + cur_alpha)
            duration_hr = peak_duration_min / 60.0
            excess_rate = safe_volume - safe_capacity
            queue_vehicles = excess_rate * duration_hr

            # Exact deterministic queuing delay per arriving vehicle:
            # d_queue = (Q_max / (2.0 * V)) * 3600 seconds
            queue_delay_sec = (queue_vehicles / (2.0 * safe_volume)) * 3600.0
            link_travel_time_sec = t_sat_sec + queue_delay_sec

        # Intersection signal delay (Webster formulation)
        signal_delay_sec = 0.0
        if is_signalized and cycle_sec > 0 and 0.05 <= green_split <= 0.95 and safe_volume > 0:
            approach_saturation = min(0.98, vc_ratio)
            lambda_val = green_split
            d1_num = cycle_sec * ((1.0 - lambda_val) ** 2)
            d1_denom = 2.0 * max(0.02, 1.0 - lambda_val * approach_saturation)
            uniform_delay = d1_num / d1_denom

            # Incremental delay term (seconds)
            d2 = (
                (approach_saturation ** 2)
                / (2.0 * safe_volume * max(0.02, 1.0 - approach_saturation))
                * 3600.0
            )
            signal_delay_sec = min(180.0, uniform_delay + min(60.0, d2))

        total_time_sec = link_travel_time_sec + signal_delay_sec
        delay_sec = max(0.0, total_time_sec - t0_sec)

        effective_speed_mps = length_m / max(1.0, total_time_sec)
        effective_speed_kmh = max(1.0, min(free_flow_speed_kmh, effective_speed_mps * 3.6))

        queue_length_m = queue_vehicles * self.vehicle_effective_length_m

        return {
            "free_flow_time_sec": round(t0_sec, 2),
            "actual_travel_time_sec": round(total_time_sec, 2),
            "delay_sec_per_veh": round(delay_sec, 2),
            "vc_ratio": round(vc_ratio, 3),
            "speed_kmh": round(effective_speed_kmh, 1),
            "queue_vehicles": round(queue_vehicles, 1),
            "queue_length_m": round(queue_length_m, 1),
            "queue_delay_sec": round(queue_delay_sec, 2),
        }
