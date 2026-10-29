import math
import requests
from typing import Dict, List, Any, Optional, Tuple
from ..models.schemas import NetworkNode, NetworkLink, ODDemand, TrafficDemandScenario


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points on Earth in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def compute_linestring_length_m(coords: List[List[float]]) -> float:
    """Computes total length of GeoJSON [[lon, lat], ...] line in meters."""
    if len(coords) < 2:
        return 50.0
    total = 0.0
    for i in range(len(coords) - 1):
        total += haversine_distance_m(
            coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]
        )
    return max(30.0, total)


class OSMLoader:
    """
    Fetches real road networks from OpenStreetMap Overpass API,
    converts them into directed traffic simulation graphs with true geometry.
    """

    OVERPASS_SERVERS = [
        "https://overpass-api.de/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]

    @staticmethod
    def fetch_bbox_from_overpass(
        south: float, west: float, north: float, east: float, timeout_sec: int = 10
    ) -> Optional[Dict[str, Any]]:
        """
        Queries Overpass API for real driveable highway elements within bounding box.
        """
        query = f"""
        [out:json][timeout:{timeout_sec}];
        (
          way["highway"~"primary|secondary|tertiary|residential|service"]({south},{west},{north},{east});
        );
        out body geom;
        >;
        out skel qt;
        """
        for server in OSMLoader.OVERPASS_SERVERS:
            try:
                resp = requests.post(server, data={"data": query}, timeout=timeout_sec)
                if resp.status_code == 200:
                    return resp.json()
            except Exception:
                continue
        return None

    @staticmethod
    def convert_overpass_to_network(
        osm_data: Dict[str, Any], location_prefix: str = "osm"
    ) -> Tuple[List[NetworkNode], List[NetworkLink]]:
        elements = osm_data.get("elements", [])
        nodes_dict: Dict[int, NetworkNode] = {}
        links: List[NetworkLink] = []

        # 1. Parse nodes
        for el in elements:
            if el.get("type") == "node":
                nid = el["id"]
                lat = el["lat"]
                lon = el["lon"]
                nodes_dict[nid] = NetworkNode(
                    id=f"{location_prefix}_node_{nid}",
                    name=f"Intersection {nid}",
                    lat=lat,
                    lon=lon,
                    is_signalized=False,
                )

        # 2. Parse ways into links
        way_counter = 0
        for el in elements:
            if el.get("type") == "way" and "tags" in el:
                tags = el["tags"]
                highway = tags.get("highway", "residential")
                name = tags.get("name", f"Road {highway.capitalize()}")
                nodes_in_way = el.get("nodes", [])
                geometry = el.get("geometry", [])

                if len(nodes_in_way) < 2:
                    continue

                # Coordinates [[lon, lat], ...]
                if geometry:
                    coords = [[pt["lon"], pt["lat"]] for pt in geometry]
                else:
                    coords = [
                        [nodes_dict[n].lon, nodes_dict[n].lat]
                        for n in nodes_in_way
                        if n in nodes_dict
                    ]

                if len(coords) < 2:
                    continue

                # Ensure endpoints are registered nodes
                from_id_raw = nodes_in_way[0]
                to_id_raw = nodes_in_way[-1]

                if from_id_raw not in nodes_dict:
                    nodes_dict[from_id_raw] = NetworkNode(
                        id=f"{location_prefix}_node_{from_id_raw}",
                        name=f"Node {from_id_raw}",
                        lat=coords[0][1],
                        lon=coords[0][0],
                    )
                if to_id_raw not in nodes_dict:
                    nodes_dict[to_id_raw] = NetworkNode(
                        id=f"{location_prefix}_node_{to_id_raw}",
                        name=f"Node {to_id_raw}",
                        lat=coords[-1][1],
                        lon=coords[-1][0],
                    )

                from_node_id = f"{location_prefix}_node_{from_id_raw}"
                to_node_id = f"{location_prefix}_node_{to_id_raw}"

                length_m = compute_linestring_length_m(coords)
                
                # Highway characteristics
                lanes = 2
                try:
                    lanes = int(tags.get("lanes", 2))
                except Exception:
                    lanes = 2

                speed = 50.0
                if "maxspeed" in tags:
                    try:
                        speed = float(tags["maxspeed"].replace("km/h", "").strip())
                    except Exception:
                        speed = 50.0
                elif highway in ["primary", "secondary"]:
                    speed = 50.0
                elif highway in ["residential", "service"]:
                    speed = 30.0

                capacity = lanes * (1200.0 if highway in ["primary", "trunk"] else 850.0)

                way_counter += 1
                link_id = f"{location_prefix}_link_{el['id']}_{way_counter}"

                links.append(
                    NetworkLink(
                        id=link_id,
                        name=name,
                        from_node=from_node_id,
                        to_node=to_node_id,
                        highway_type=highway,
                        length_m=round(length_m, 1),
                        lanes=lanes,
                        free_flow_speed_kmh=speed,
                        base_capacity_vph=capacity,
                        effective_capacity_vph=capacity,
                        coordinates=coords,
                        is_oneway=tags.get("oneway", "no") == "yes",
                    )
                )

        return list(nodes_dict.values()), links
