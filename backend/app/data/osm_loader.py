import math
import json
import os
import urllib.request
import urllib.parse
from typing import List, Dict, Any, Optional, Tuple
from ..models.schemas import NetworkNode, NetworkLink, TrafficDemandScenario, ODDemand


OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

SAVED_AREAS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "saved_study_areas"))
os.makedirs(SAVED_AREAS_DIR, exist_ok=True)


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates in meters."""
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def search_nominatim(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Searches Nominatim OpenStreetMap for location matches with bounding boxes."""
    encoded = urllib.parse.quote(query)
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={encoded}&limit={limit}&addressdetails=1"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "CivicTwinArena-UrbanTwin/2.0 (civictwin@planning.org)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8.0) as res:
            return json.loads(res.read().decode())
    except Exception as e:
        print(f"Nominatim search error for '{query}': {e}")
        return []


class OSMLoader:
    """
    Downloads, parses, and validates real road network geometry from OpenStreetMap Overpass API,
    constructing connected directed graphs calibrated with Indian Road Congress (IRC:106) parameters.
    """

    @staticmethod
    def query_overpass_bbox(
        south: float, west: float, north: float, east: float
    ) -> Optional[Dict[str, Any]]:
        """Queries Overpass API for vehicular highway ways within the bounding box."""
        query = f"""
        [out:json][timeout:25];
        (
          way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified"]({south:.5f},{west:.5f},{north:.5f},{east:.5f});
        );
        out body;
        >;
        out skel qt;
        """
        data = urllib.parse.urlencode({"data": query}).encode()

        for server in OVERPASS_SERVERS:
            try:
                req = urllib.request.Request(
                    server,
                    data=data,
                    headers={"User-Agent": "CivicTwinArena-OSMEngine/2.0"},
                )
                with urllib.request.urlopen(req, timeout=25.0) as resp:
                    raw = json.loads(resp.read().decode())
                    if "elements" in raw:
                        return raw
            except Exception as e:
                print(f"Overpass query warning on {server}: {e}")
                continue

        return None

    @classmethod
    def parse_osm_elements(
        cls, elements: List[Dict[str, Any]], area_name: str = "Custom Study Area"
    ) -> Tuple[List[NetworkNode], List[NetworkLink], List[str]]:
        """
        Parses raw OSM nodes and ways into strongly typed NetworkNode and NetworkLink collections.
        Prunes disconnected subgraphs and computes real segment lengths.
        """
        raw_nodes: Dict[int, Dict[str, float]] = {}
        raw_ways: List[Dict[str, Any]] = []
        warnings: List[str] = []

        for el in elements:
            if el["type"] == "node":
                raw_nodes[el["id"]] = {"lat": el["lat"], "lon": el["lon"]}
            elif el["type"] == "way":
                raw_ways.append(el)

        if not raw_ways:
            warnings.append("No vehicular road ways found in the selected study area.")
            return [], [], warnings

        # 1. Count node occurrences across ways to identify genuine intersections
        node_way_counts: Dict[int, int] = {}
        for w in raw_ways:
            nodes_seq = w.get("nodes", [])
            for nid in nodes_seq:
                node_way_counts[nid] = node_way_counts.get(nid, 0) + 1

        # Identify intersection nodes (endpoints of ways or junctions shared by >= 2 ways)
        junction_node_ids = set()
        for w in raw_ways:
            nodes_seq = w.get("nodes", [])
            if len(nodes_seq) >= 2:
                junction_node_ids.add(nodes_seq[0])
                junction_node_ids.add(nodes_seq[-1])
            for nid in nodes_seq:
                if node_way_counts.get(nid, 0) >= 2:
                    junction_node_ids.add(nid)

        # 2. Build parsed links split at junctions
        created_links: List[NetworkLink] = []
        node_id_map: Dict[int, str] = {}
        node_counter = 1

        def get_or_create_node_id(osm_nid: int) -> str:
            nonlocal node_counter
            if osm_nid not in node_id_map:
                node_id_map[osm_nid] = f"node_osm_{node_counter}"
                node_counter += 1
            return node_id_map[osm_nid]

        link_counter = 1
        for w in raw_ways:
            osm_way_id = w.get("id")
            tags = w.get("tags", {})
            hw_type = tags.get("highway", "residential")
            road_name = tags.get("name")
            is_oneway = tags.get("oneway") in ["yes", "1", "true"]

            # Derive IRC:106 speed and capacities
            lanes_tag = tags.get("lanes")
            try:
                lanes = int(lanes_tag) if lanes_tag else 2
            except ValueError:
                lanes = 2

            if hw_type in ["motorway", "trunk", "primary"]:
                cap_per_lane = 1600.0
                ff_speed = 50.0
                lanes = max(lanes, 2)
            elif hw_type == "secondary":
                cap_per_lane = 1300.0
                ff_speed = 40.0
                lanes = max(lanes, 2)
            elif hw_type == "tertiary":
                cap_per_lane = 1000.0
                ff_speed = 35.0
                lanes = max(lanes, 1)
            else:
                cap_per_lane = 750.0
                ff_speed = 30.0
                lanes = max(lanes, 1)

            total_capacity = cap_per_lane * lanes

            # Slice way into segments between junction nodes
            way_nodes = w.get("nodes", [])
            current_segment: List[int] = []

            for nid in way_nodes:
                if nid not in raw_nodes:
                    continue
                current_segment.append(nid)

                if len(current_segment) >= 2 and nid in junction_node_ids:
                    # Form link from current_segment
                    u_nid = current_segment[0]
                    v_nid = current_segment[-1]

                    if u_nid != v_nid:
                        # Compute polyline GeoJSON coords [[lon, lat], ...]
                        coords = [[raw_nodes[n]["lon"], raw_nodes[n]["lat"]] for n in current_segment]
                        
                        # Calculate length
                        seg_length = 0.0
                        for idx in range(len(coords) - 1):
                            seg_length += haversine_m(
                                coords[idx][1], coords[idx][0], coords[idx + 1][1], coords[idx + 1][0]
                            )
                        seg_length = max(30.0, round(seg_length, 1))

                        u_id = get_or_create_node_id(u_nid)
                        v_id = get_or_create_node_id(v_nid)

                        resolved_name = (
                            road_name
                            if road_name
                            else f"Unnamed {hw_type.capitalize()} Link #{osm_way_id}"
                        )

                        # Primary forward link
                        created_links.append(
                            NetworkLink(
                                id=f"link_osm_{link_counter}",
                                name=resolved_name,
                                from_node=u_id,
                                to_node=v_id,
                                length_m=seg_length,
                                free_flow_speed_kmh=ff_speed,
                                base_capacity_vph=total_capacity,
                                effective_capacity_vph=total_capacity,
                                lanes=lanes,
                                coordinates=coords,
                                highway_type=hw_type,
                                is_oneway=True,
                            )
                        )
                        link_counter += 1

                        # If two-way, create reverse link
                        if not is_oneway:
                            created_links.append(
                                NetworkLink(
                                    id=f"link_osm_{link_counter}",
                                    name=f"{resolved_name} (Opposite)",
                                    from_node=v_id,
                                    to_node=u_id,
                                    length_m=seg_length,
                                    free_flow_speed_kmh=ff_speed,
                                    base_capacity_vph=total_capacity,
                                    effective_capacity_vph=total_capacity,
                                    lanes=lanes,
                                    coordinates=list(reversed(coords)),
                                    highway_type=hw_type,
                                    is_oneway=True,
                                )
                            )
                            link_counter += 1

                    current_segment = [nid]

        # 3. Create NetworkNode instances
        used_node_ids = set()
        for l in created_links:
            used_node_ids.add(l.from_node)
            used_node_ids.add(l.to_node)

        created_nodes: List[NetworkNode] = []
        for osm_nid, nid_str in node_id_map.items():
            if nid_str in used_node_ids and osm_nid in raw_nodes:
                lat = raw_nodes[osm_nid]["lat"]
                lon = raw_nodes[osm_nid]["lon"]
                deg = sum(1 for l in created_links if l.from_node == nid_str or l.to_node == nid_str)
                label = f"Intersection {nid_str.replace('node_osm_', '#')} ({deg}-way)"
                created_nodes.append(
                    NetworkNode(
                        id=nid_str,
                        name=label,
                        lat=lat,
                        lon=lon,
                        is_signalized=(deg >= 3),
                    )
                )

        # 4. Connectivity Validation: Extract Giant Connected Component
        connected_nodes, connected_links, conn_warnings = cls._extract_giant_component(
            created_nodes, created_links
        )
        warnings.extend(conn_warnings)

        return connected_nodes, connected_links, warnings

    @classmethod
    def _extract_giant_component(
        cls, nodes: List[NetworkNode], links: List[NetworkLink]
    ) -> Tuple[List[NetworkNode], List[NetworkLink], List[str]]:
        """Filters network down to the largest weakly connected component to ensure route traversability."""
        if not nodes or not links:
            return [], [], ["Network graph has no nodes or links."]

        adj: Dict[str, set] = {n.id: set() for n in nodes}
        for l in links:
            if l.from_node in adj and l.to_node in adj:
                adj[l.from_node].add(l.to_node)
                adj[l.to_node].add(l.from_node)

        visited = set()
        components = []

        for n in nodes:
            if n.id not in visited:
                comp = set()
                queue = [n.id]
                visited.add(n.id)
                while queue:
                    curr = queue.pop(0)
                    comp.add(curr)
                    for nxt in adj.get(curr, []):
                        if nxt not in visited:
                            visited.add(nxt)
                            queue.append(nxt)
                components.append(comp)

        components.sort(key=len, reverse=True)
        giant_node_ids = components[0] if components else set()

        pruned_nodes = [n for n in nodes if n.id in giant_node_ids]
        pruned_links = [
            l for l in links if l.from_node in giant_node_ids and l.to_node in giant_node_ids
        ]

        warnings: List[str] = []
        if len(components) > 1:
            discarded = sum(len(c) for c in components[1:])
            warnings.append(
                f"Pruned {len(components) - 1} isolated disconnected subgraphs ({discarded} nodes) to maintain route integrity."
            )

        return pruned_nodes, pruned_links, warnings

    @staticmethod
    def synthesize_demand_for_network(
        nodes: List[NetworkNode], links: List[NetworkLink]
    ) -> TrafficDemandScenario:
        """
        Synthesizes realistic peak-hour baseline OD flows for dynamically ingested networks.
        Pairs peripheral entry nodes with central hubs based on link connectivity.
        """
        if len(nodes) < 2:
            return TrafficDemandScenario(scenario_id="demand_empty", name="Zero Demand", od_flows=[])

        # Find perimeter nodes (lowest degree or extremes) and central nodes
        lats = [n.lat for n in nodes]
        lons = [n.lon for n in nodes]
        mid_lat = (min(lats) + max(lats)) / 2.0
        mid_lon = (min(lons) + max(lons)) / 2.0

        # Sort nodes by distance from geographic center
        nodes_sorted = sorted(
            nodes,
            key=lambda n: math.hypot(n.lat - mid_lat, n.lon - mid_lon),
        )

        center_nodes = nodes_sorted[: max(1, len(nodes_sorted) // 3)]
        periph_nodes = nodes_sorted[max(1, len(nodes_sorted) // 3) :]

        od_flows: List[ODDemand] = []

        for p_node in periph_nodes[:4]:
            for c_node in center_nodes[:2]:
                if p_node.id != c_node.id:
                    # Inbound peak commute trips
                    od_flows.append(
                        ODDemand(
                            origin_node=p_node.id,
                            destination_node=c_node.id,
                            flow_vph=650.0,
                            description=f"Inbound Flow: {p_node.name} to {c_node.name}",
                        )
                    )
                    # Outbound return flow
                    od_flows.append(
                        ODDemand(
                            origin_node=c_node.id,
                            destination_node=p_node.id,
                            flow_vph=400.0,
                            description=f"Outbound Flow: {c_node.name} to {p_node.name}",
                        )
                    )

        return TrafficDemandScenario(
            scenario_id="dynamic_peak_demand",
            name="Synthesized Peak Hour Dispersal Demand",
            od_flows=od_flows,
        )

    @classmethod
    def save_study_area(
        cls,
        area_id: str,
        name: str,
        city: str,
        problem_statement: str,
        objective: str,
        nodes: List[NetworkNode],
        links: List[NetworkLink],
        demand: TrafficDemandScenario,
        metadata: Dict[str, Any],
    ) -> str:
        """Persists a verified study area to local storage."""
        fpath = os.path.join(SAVED_AREAS_DIR, f"{area_id}.json")
        payload = {
            "metadata": {
                "id": area_id,
                "name": name,
                "city": city,
                "problem_statement": problem_statement,
                "objective": objective,
                **metadata,
            },
            "nodes": [n.model_dump() for n in nodes],
            "links": [l.model_dump() for l in links],
            "demand": demand.model_dump(),
        }
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        return fpath

    @classmethod
    def load_study_area(cls, area_id: str) -> Optional[Tuple[List[NetworkNode], List[NetworkLink], TrafficDemandScenario, Dict[str, Any]]]:
        """Loads a persisted study area from disk."""
        fpath = os.path.join(SAVED_AREAS_DIR, f"{area_id}.json")
        if not os.path.exists(fpath):
            return None
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        nodes = [NetworkNode(**n) for n in data["nodes"]]
        links = [NetworkLink(**l) for l in data["links"]]
        demand = TrafficDemandScenario(**data["demand"])
        return nodes, links, demand, data["metadata"]

    @classmethod
    def list_saved_study_areas(cls) -> List[Dict[str, Any]]:
        """Lists all persisted custom study areas."""
        results = []
        if not os.path.exists(SAVED_AREAS_DIR):
            return results
        for fname in os.listdir(SAVED_AREAS_DIR):
            if fname.endswith(".json"):
                fpath = os.path.join(SAVED_AREAS_DIR, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        results.append(data.get("metadata", {}))
                except Exception:
                    continue
        return results
