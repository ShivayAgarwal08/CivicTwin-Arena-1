import heapq
import math
from typing import Dict, List, Tuple, Set, Optional, Any
from ..models.schemas import NetworkLink, NetworkNode, ODDemand


class NetworkGraph:
    def __init__(self, links: List[NetworkLink], nodes: List[NetworkNode]):
        self.nodes = {n.id: n for n in nodes}
        self.links = {l.id: l for l in links}
        self.adj: Dict[str, List[Tuple[str, str]]] = {n.id: [] for n in nodes}
        for l in links:
            if l.from_node in self.adj:
                self.adj[l.from_node].append((l.to_node, l.id))

    def find_k_shortest_paths(
        self,
        origin: str,
        destination: str,
        link_costs: Dict[str, float],
        closed_links: Optional[Set[str]] = None,
        k: int = 3,
    ) -> List[List[str]]:
        """
        Finds up to k loopless shortest paths (as list of link IDs) from origin to destination
        using Yen's algorithm with node and link exclusion.
        """
        closed_set = closed_links or set()
        if origin not in self.adj or destination not in self.adj:
            return []

        def dijkstra(
            start_node: str,
            disabled_nodes: Set[str],
            disabled_links: Set[str],
        ) -> Optional[Tuple[float, List[str]]]:
            # Priority queue: (cost, current_node, path_links)
            pq = [(0.0, start_node, [])]
            visited = {}

            while pq:
                cost, u, path = heapq.heappop(pq)
                if u in visited and visited[u] <= cost:
                    continue
                visited[u] = cost

                if u == destination:
                    return cost, path

                for v, link_id in self.adj.get(u, []):
                    if v in disabled_nodes or link_id in disabled_links or link_id in closed_set:
                        continue
                    edge_cost = link_costs.get(link_id, 10.0)
                    heapq.heappush(pq, (cost + edge_cost, v, path + [link_id]))

            return None

        # 1. Find first shortest path
        first = dijkstra(origin, set(), set())
        if not first:
            return []

        A: List[List[str]] = [first[1]]  # List of k-shortest paths
        B: List[Tuple[float, List[str]]] = []  # Candidate heap/list

        # 2. Iterate to find subsequent shortest paths
        for i in range(1, k):
            prev_path = A[-1]

            for j in range(len(prev_path)):
                spur_link_id = prev_path[j]
                spur_link = self.links[spur_link_id]
                spur_node = spur_link.from_node
                root_path = prev_path[:j]

                # Identify nodes in root_path (excluding spur_node) to prevent loops
                root_nodes: Set[str] = set()
                curr = origin
                for r_lid in root_path:
                    root_nodes.add(curr)
                    curr = self.links[r_lid].to_node

                disabled_links: Set[str] = set()
                for p in A:
                    if len(p) > j and p[:j] == root_path:
                        disabled_links.add(p[j])

                # Spur Dijkstra from spur_node to destination
                spur_res = dijkstra(spur_node, root_nodes, disabled_links)

                if spur_res is not None:
                    _, spur_path = spur_res
                    candidate_path = root_path + spur_path
                    if candidate_path not in [p for _, p in B] and candidate_path not in A:
                        candidate_cost = sum(
                            link_costs.get(lid, 10.0) for lid in candidate_path
                        )
                        B.append((candidate_cost, candidate_path))

            if not B:
                break

            B.sort(key=lambda x: x[0])
            _, best_candidate = B.pop(0)
            A.append(best_candidate)

        return A


class TrafficAssignmentEngine:
    """
    Solves Stochastic User Equilibrium (Multi-Path Logit Assignment) via
    the Method of Successive Averages (MSA).

    Convergence:
    - Measured via Relative Gap of link flows: RelGap = sum(|V_k - V_{k-1}|) / sum(V_k)
    - Iterates until RelGap < tolerance or max_iterations reached.
    """

    def __init__(
        self,
        dispersion_theta: float = 0.05,
        max_iterations: int = 15,
        convergence_tolerance: float = 0.01,
    ):
        self.theta = dispersion_theta
        self.max_iterations = max_iterations
        self.tolerance = convergence_tolerance

    def assign_traffic(
        self,
        links: List[NetworkLink],
        nodes: List[NetworkNode],
        od_flows: List[ODDemand],
        effective_capacities: Dict[str, float],
        bpr_engine,
        closed_links: Optional[Set[str]] = None,
    ) -> Dict[str, Any]:
        """
        Assigns vehicle trips to network links.
        Returns a dict containing:
        - 'volumes': {link_id: assigned_vph}
        - 'converged': bool
        - 'iterations': int
        - 'relative_gap': float
        - 'unserved_demand_vph': float
        """
        closed_set = closed_links or set()
        # Also mark links with 0 capacity as closed
        for l in links:
            if effective_capacities.get(l.id, l.base_capacity_vph) <= 0.0:
                closed_set.add(l.id)

        graph = NetworkGraph(links, nodes)

        # 1. Initialize link travel times
        current_costs: Dict[str, float] = {}
        for l in links:
            if l.id in closed_set:
                current_costs[l.id] = 1e9
            else:
                cap = effective_capacities.get(l.id, l.base_capacity_vph)
                res = bpr_engine.compute_link_travel_time(
                    length_m=l.length_m,
                    free_flow_speed_kmh=l.free_flow_speed_kmh,
                    volume_vph=0.0,
                    capacity_vph=cap,
                    is_signalized=False,
                )
                current_costs[l.id] = res["actual_travel_time_sec"]

        link_volumes: Dict[str, float] = {l.id: 0.0 for l in links}
        converged = False
        rel_gap = 1.0
        actual_iterations = 0
        total_unserved_demand = 0.0

        for iteration in range(self.max_iterations):
            actual_iterations = iteration + 1
            iter_volumes: Dict[str, float] = {l.id: 0.0 for l in links}
            iter_unserved = 0.0

            # Assign each OD demand
            for od in od_flows:
                if od.flow_vph <= 0:
                    continue

                paths = graph.find_k_shortest_paths(
                    od.origin_node,
                    od.destination_node,
                    current_costs,
                    closed_links=closed_set,
                    k=3,
                )

                if not paths:
                    # No viable route between origin and destination
                    iter_unserved += od.flow_vph
                    continue

                # Compute path travel times
                path_costs = [
                    sum(current_costs.get(lid, 10.0) for lid in path) for path in paths
                ]

                # Logit probabilities
                min_cost = min(path_costs)
                exp_utilities = [
                    math.exp(-self.theta * max(0.0, c - min_cost)) for c in path_costs
                ]
                sum_exp = sum(exp_utilities)

                if sum_exp <= 0:
                    probs = [1.0 / len(paths)] * len(paths)
                else:
                    probs = [u / sum_exp for u in exp_utilities]

                for path, prob in zip(paths, probs):
                    flow_on_path = od.flow_vph * prob
                    for link_id in path:
                        if link_id not in closed_set:
                            iter_volumes[link_id] += flow_on_path

            total_unserved_demand = iter_unserved

            # Method of Successive Averages (MSA) update:
            step_size = 1.0 / (iteration + 1)
            prev_volumes = dict(link_volumes)

            for lid in link_volumes:
                if lid in closed_set:
                    link_volumes[lid] = 0.0
                else:
                    link_volumes[lid] = (
                        (1.0 - step_size) * link_volumes[lid] + step_size * iter_volumes[lid]
                    )

            # Check convergence via relative volume change
            if iteration > 0:
                tot_vol = max(1.0, sum(link_volumes.values()))
                vol_diff_sum = sum(abs(link_volumes[lid] - prev_volumes[lid]) for lid in link_volumes)
                rel_gap = vol_diff_sum / tot_vol
                if rel_gap < self.tolerance:
                    converged = True
                    break

            # Update link travel times with assigned volumes for next iteration
            for l in links:
                if l.id in closed_set:
                    current_costs[l.id] = 1e9
                else:
                    cap = effective_capacities.get(l.id, l.base_capacity_vph)
                    is_sig = nodes_dict_is_signalized(nodes, l.to_node)
                    res = bpr_engine.compute_link_travel_time(
                        length_m=l.length_m,
                        free_flow_speed_kmh=l.free_flow_speed_kmh,
                        volume_vph=link_volumes[l.id],
                        capacity_vph=cap,
                        is_signalized=is_sig,
                    )
                    current_costs[l.id] = res["actual_travel_time_sec"]

        final_volumes = {lid: round(vol, 1) for lid, vol in link_volumes.items()}

        return {
            "volumes": final_volumes,
            "converged": converged,
            "iterations": actual_iterations,
            "relative_gap": round(rel_gap, 4),
            "unserved_demand_vph": round(total_unserved_demand, 1),
        }


def nodes_dict_is_signalized(nodes: List[NetworkNode], node_id: str) -> bool:
    for n in nodes:
        if n.id == node_id:
            return n.is_signalized
    return False
