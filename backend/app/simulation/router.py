import math
from typing import List, Dict, Optional, Any, Tuple
from ..models.schemas import NetworkLink, NetworkNode, NetworkRoute, RouteTurnInstruction, ODDemand
from .assignment import NetworkGraph


def calc_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates initial bearing from point 1 to point 2 in degrees (0..360)."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def bearing_to_compass(bearing: float) -> str:
    """Converts bearing degrees to compass heading."""
    dirs = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"]
    ix = int((bearing + 22.5) // 45) % 8
    return dirs[ix]


def classify_turn(delta_deg: float) -> Tuple[str, str]:
    """
    Classifies a turn based on angular deflection between incoming and outgoing link bearings.
    Returns (maneuver_code, friendly_label).
    """
    diff = ((delta_deg + 180) % 360) - 180
    if abs(diff) <= 20:
        return "straight", "Continue straight"
    elif 20 < diff <= 60:
        return "slight_right", "Bear slight right"
    elif 60 < diff <= 125:
        return "right", "Turn right"
    elif 125 < diff <= 165:
        return "sharp_right", "Sharp right"
    elif -60 <= diff < -20:
        return "slight_left", "Bear slight left"
    elif -125 <= diff < -60:
        return "left", "Turn left"
    elif -165 <= diff < -125:
        return "sharp_left", "Sharp left"
    else:
        return "u_turn", "Make a U-turn"


class CorridorRouter:
    """
    Computes topological routes over connected OpenStreetMap network links using
    Yen's loopless k-shortest paths algorithm, deriving real turn instructions,
    geometry, and performance metrics from geometry and BPR link calculations.
    """

    @staticmethod
    def generate_routes_for_corridor(
        links: List[NetworkLink],
        nodes: List[NetworkNode],
        od_flows: List[ODDemand],
        link_performance: Optional[Dict[str, Any]] = None,
    ) -> List[NetworkRoute]:
        nodes_dict = {n.id: n for n in nodes}
        links_dict = {l.id: l for l in links}
        graph = NetworkGraph(links, nodes)

        # Edge impedance for routing: length in meters
        link_costs = {l.id: max(1.0, l.length_m) for l in links}

        routes: List[NetworkRoute] = []
        route_counter = 1

        for od in od_flows:
            paths = graph.find_k_shortest_paths(
                origin=od.origin_node,
                destination=od.destination_node,
                link_costs=link_costs,
                k=3,
            )

            origin_node = nodes_dict.get(od.origin_node)
            dest_node = nodes_dict.get(od.destination_node)
            origin_name = origin_node.name if origin_node else od.origin_node
            dest_name = dest_node.name if dest_node else od.destination_node

            for p_idx, path in enumerate(paths):
                if not path:
                    continue

                is_primary = (p_idx == 0)
                path_links = [links_dict[lid] for lid in path if lid in links_dict]
                total_dist = sum(l.length_m for l in path_links)

                # Compute cumulative times & identify critical bottleneck
                free_flow_sec = 0.0
                actual_sec = 0.0
                max_vc = 0.0
                crit_link_id = None

                for l in path_links:
                    l_res = link_performance.get(l.id) if link_performance else None
                    ff_time = l.length_m / max(5.0, l.free_flow_speed_kmh / 3.6)
                    act_time = l_res.actual_travel_time_sec if l_res else ff_time
                    vc = l_res.vc_ratio if l_res else 0.5

                    free_flow_sec += ff_time
                    actual_sec += act_time
                    if vc > max_vc:
                        max_vc = vc
                        crit_link_id = l.id

                delay_sec = max(0.0, actual_sec - free_flow_sec)

                # Compute Concatenated Geometry [[lat, lon], ...]
                route_coords: List[List[float]] = []
                for l in path_links:
                    for c in l.coordinates:
                        # GeoJSON is [lon, lat], Leaflet is [lat, lon]
                        pt = [c[1], c[0]]
                        if not route_coords or route_coords[-1] != pt:
                            route_coords.append(pt)

                # Compute Turn-by-Turn Navigation from actual geometry
                turn_instructions: List[RouteTurnInstruction] = []
                step_num = 1

                for i, l in enumerate(path_links):
                    coords = l.coordinates
                    b_in = calc_bearing(coords[0][1], coords[0][0], coords[1][1], coords[1][0])
                    seg_dist = l.length_m
                    seg_time = actual_sec * (l.length_m / max(1.0, total_dist))

                    if i == 0:
                        compass = bearing_to_compass(b_in)
                        instr = f"Depart {compass} on {l.name}"
                        turn_instructions.append(
                            RouteTurnInstruction(
                                step_number=step_num,
                                instruction=instr,
                                maneuver="depart",
                                road_name=l.name,
                                junction_name=origin_name,
                                distance_m=round(seg_dist, 0),
                                travel_time_sec=round(seg_time, 1),
                            )
                        )
                        step_num += 1
                    else:
                        prev_l = path_links[i - 1]
                        prev_coords = prev_l.coordinates
                        b_prev_out = calc_bearing(
                            prev_coords[-2][1], prev_coords[-2][0], prev_coords[-1][1], prev_coords[-1][0]
                        )
                        maneuver, label = classify_turn(b_in - b_prev_out)
                        junc_node = nodes_dict.get(l.from_node)
                        junc_name = junc_node.name if junc_node else f"Junction {l.from_node}"

                        instr = f"At {junc_name}, {label} onto {l.name}"
                        turn_instructions.append(
                            RouteTurnInstruction(
                                step_number=step_num,
                                instruction=instr,
                                maneuver=maneuver,
                                road_name=l.name,
                                junction_name=junc_name,
                                distance_m=round(seg_dist, 0),
                                travel_time_sec=round(seg_time, 1),
                            )
                        )
                        step_num += 1

                # Final arrival step
                turn_instructions.append(
                    RouteTurnInstruction(
                        step_number=step_num,
                        instruction=f"Arrive at destination: {dest_name}",
                        maneuver="arrive",
                        road_name=path_links[-1].name if path_links else "Destination",
                        junction_name=dest_name,
                        distance_m=0.0,
                        travel_time_sec=0.0,
                    )
                )

                route_type_label = "Primary Corridor" if is_primary else f"Alternative Route {p_idx + 1}"
                route_name = f"{route_type_label}: {origin_name.split()[0]} to {dest_name.split()[0]}"

                routes.append(
                    NetworkRoute(
                        id=f"route_{od.origin_node}_{od.destination_node}_{p_idx+1}",
                        name=route_name,
                        origin_node_id=od.origin_node,
                        origin_name=origin_name,
                        destination_node_id=od.destination_node,
                        destination_name=dest_name,
                        is_primary=is_primary,
                        link_ids=path,
                        total_distance_m=round(total_dist, 0),
                        free_flow_time_sec=round(free_flow_sec, 1),
                        modeled_travel_time_sec=round(actual_sec, 1),
                        delay_sec=round(delay_sec, 1),
                        critical_bottleneck_link_id=crit_link_id,
                        max_vc_ratio=round(max_vc, 2),
                        turn_instructions=turn_instructions,
                        geometry=route_coords,
                    )
                )
                route_counter += 1

        return routes

