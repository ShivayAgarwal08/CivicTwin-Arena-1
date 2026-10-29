import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from ..models.schemas import (
    NetworkNode,
    NetworkLink,
    TrafficDemandScenario,
    LocationPresetSummary,
)

PRESETS_DIR = Path(__file__).parent / "presets"


class PresetRepository:
    _cache: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def _load_all(cls):
        if not cls._cache:
            for filepath in PRESETS_DIR.glob("*.json"):
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        pid = data.get("preset_id")
                        if pid:
                            cls._cache[pid] = data
                except Exception as e:
                    print(f"Error loading preset {filepath}: {e}")

    @classmethod
    def list_presets(cls) -> List[LocationPresetSummary]:
        cls._load_all()
        summaries = []
        for pid, data in cls._cache.items():
            summaries.append(
                LocationPresetSummary(
                    id=pid,
                    name=data.get("name", pid),
                    city=data.get("city", "Noida, India"),
                    description=data.get("description", ""),
                    center_lat=data.get("center", [28.5, 77.3])[0],
                    center_lon=data.get("center", [28.5, 77.3])[1],
                    default_zoom=data.get("zoom", 16),
                    problem_statement=data.get("problem_statement", ""),
                    objective=data.get("objective", ""),
                    is_real_osm=True,
                )
            )
        return summaries

    @classmethod
    def get_preset(
        cls, preset_id: str
    ) -> Optional[Tuple[List[NetworkNode], List[NetworkLink], TrafficDemandScenario, Dict[str, Any]]]:
        cls._load_all()
        data = cls._cache.get(preset_id)
        if not data:
            return None

        nodes = [NetworkNode(**n) for n in data["nodes"]]
        links = [NetworkLink(**l) for l in data["links"]]
        demand = TrafficDemandScenario(**data["demand_scenario"])
        metadata = {
            "name": data.get("name"),
            "city": data.get("city"),
            "description": data.get("description"),
            "center": data.get("center"),
            "zoom": data.get("zoom", 16),
            "problem_statement": data.get("problem_statement"),
            "objective": data.get("objective"),
        }
        return nodes, links, demand, metadata

