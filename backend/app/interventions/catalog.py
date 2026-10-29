from typing import Dict, Any, List
from ..models.schemas import InterventionType


INTERVENTION_CATALOG = {
    InterventionType.ADD_LANE: {
        "name": "Add Travel Lane (Widening)",
        "description": "Construct an additional travel lane along the designated road segment, increasing capacity by ~1,100 veh/hr.",
        "cost_rate_inr_per_meter": 12000.0,  # ~1.2 Crore per km (12k INR per m)
        "default_params": {"extra_lanes": 1},
        "applicable_to": "link",
    },
    InterventionType.WIDEN_ROAD: {
        "name": "Corridor Geometry Expansion",
        "description": "Comprehensive road cross-section widening, improving saturation flow and median buffer.",
        "cost_rate_inr_per_meter": 18000.0,
        "default_params": {"capacity_boost_factor": 0.40},
        "applicable_to": "link",
    },
    InterventionType.PICKUP_BAY: {
        "name": "Dedicated Curbside Pick-up / Drop-off Bay",
        "description": "Create an off-carriageway dedicated boarding bay to remove parked cabs, autos, and parents from blocking travel lanes outside college gates or metro stations.",
        "fixed_cost_inr": 850000.0,  # 8.5 Lakhs fixed per bay installation
        "default_params": {"friction_recovery_pct": 0.45},
        "applicable_to": "link",
    },
    InterventionType.ROAD_CLOSURE: {
        "name": "Street Closure / Pedestrianization",
        "description": "Close designated road segment to general motorized vehicular traffic, diverting trips to alternate corridors.",
        "fixed_cost_inr": 150000.0,  # 1.5 Lakhs for bollards, barricades, and detour signage
        "default_params": {},
        "applicable_to": "link",
    },
    InterventionType.SIGNAL_RETIMING: {
        "name": "Traffic Signal Optimization",
        "description": "Reallocate green cycle phase split at a critical intersection to relieve the heavily loaded approach.",
        "fixed_cost_inr": 120000.0,  # 1.2 Lakhs for controller firmware & signal timing study
        "default_params": {"green_split_delta": 0.15},
        "applicable_to": "node",
    },
    InterventionType.ONE_WAY_DIVERSION: {
        "name": "One-Way Reversal & Channelization",
        "description": "Convert corridor to one-way or re-channelize turning conflicts, routing reverse trips via an adjacent collector.",
        "fixed_cost_inr": 250000.0,  # 2.5 Lakhs for signage, delineators, and traffic police deployment
        "default_params": {},
        "applicable_to": "link",
    },
    InterventionType.TRAFFIC_CALMING: {
        "name": "Traffic Calming & Speed Tables",
        "description": "Install raised speed tables and chicanes to deter cut-through commuter traffic on residential streets.",
        "fixed_cost_inr": 350000.0,  # 3.5 Lakhs
        "default_params": {"speed_reduction_kmh": 15.0},
        "applicable_to": "link",
    },
    InterventionType.MEDIAN_CLOSURE: {
        "name": "Median Gap Closure (U-Turn Relocation)",
        "description": "Seal an uncontrolled median opening where right-turning vehicles block through-traffic.",
        "fixed_cost_inr": 180000.0,  # 1.8 Lakhs
        "default_params": {},
        "applicable_to": "link",
    },
}

