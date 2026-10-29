import math
from typing import Dict, Any, Tuple


class BPRTrafficEngine:
    """
    Standard calibrated Bureau of Public Roads (BPR) link performance function
    enhanced with Webster intersection delay and physical queue accumulation dynamics.
    
    References:
    - Highway Capacity Manual (HCM 2010 / 2022)
    - Bureau of Public Roads (BPR) Formulation: t = t0 * (1 + alpha * (V/C)^beta)
    - Webster (1958) delay equation for signalized intersections
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
        Calculates travel time, delay, V/C ratio, queue length, and waiting time.
        """
        # Free-flow time in seconds
        free_speed_mps = max(5.0, free_flow_speed_kmh / 3.6)
        t0_sec = length_m / free_speed_mps

        # Safe capacity boundary
        safe_capacity = max(50.0, capacity_vph)
        safe_volume = max(0.0, volume_vph)
        vc_ratio = safe_volume / safe_capacity

        # Basic BPR travel time
        if is_signalized:
            cur_alpha = self.signal_alpha
            cur_beta = self.signal_beta
        else:
            cur_alpha = self.alpha
            cur_beta = self.beta

        # BPR exponential delay: when oversaturated (V/C > 1), time grows sharply
        if vc_ratio <= 1.0:
            bpr_time_sec = t0_sec * (1.0 + cur_alpha * (vc_ratio ** cur_beta))
        else:
            # Linearized tangent continuation above V/C=1 to avoid unphysical infinities
            base_at_1 = t0_sec * (1.0 + cur_alpha)
            slope_at_1 = t0_sec * cur_alpha * cur_beta
            bpr_time_sec = base_at_1 + slope_at_1 * (vc_ratio - 1.0)

        # Intersection signal delay (Webster formulation) if signalized
        signal_delay_sec = 0.0
        if is_signalized and cycle_sec > 0 and 0.05 <= green_split <= 0.95:
            # Degree of saturation x on the approach
            approach_saturation = min(0.98, vc_ratio)
            # Uniform delay term: cycle * (1 - lambda)^2 / (2 * (1 - lambda * x))
            lambda_val = green_split
            d1_num = cycle_sec * ((1.0 - lambda_val) ** 2)
            d1_denom = 2.0 * max(0.02, 1.0 - lambda_val * approach_saturation)
            uniform_delay = d1_num / d1_denom
            
            # Incremental delay term
            d2 = (approach_saturation ** 2) / (2.0 * max(1.0, safe_volume) * max(0.02, 1.0 - approach_saturation)) * 3600.0
            signal_delay_sec = min(180.0, uniform_delay + min(60.0, d2))

        # Queue buildup when demand exceeds capacity during the peak duration
        queue_vehicles = 0.0
        queue_delay_sec = 0.0
        if safe_volume > safe_capacity:
            # Excess vehicles per hour
            excess_rate = safe_volume - safe_capacity
            # Peak accumulation over duration (min to hours)
            duration_hr = peak_duration_min / 60.0
            queue_vehicles = excess_rate * duration_hr
            # Average waiting time in queue across peak
            # By deterministic queuing: average delay = (excess_rate * T) / (2 * capacity) * 3600
            queue_delay_sec = (queue_vehicles / (2.0 * safe_capacity)) * 3600.0

        # Total actual travel time
        total_time_sec = bpr_time_sec + signal_delay_sec + queue_delay_sec
        delay_sec = max(0.0, total_time_sec - t0_sec)
        
        # Effective average operating speed
        effective_speed_mps = length_m / max(1.0, total_time_sec)
        effective_speed_kmh = max(2.0, min(free_flow_speed_kmh, effective_speed_mps * 3.6))

        # Physical queue length in meters
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
