import heapq
import math
from typing import Dict, List, Tuple, Set, Optional
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
        k: int = 3,
    ) -> List[List[str]]:
        """
        Finds up to k alternative paths (as list of link IDs) from origin to destination
        using Yen's algorithm / modified Dijkstra.
        """
        if origin not in self.adj or destination not in self.adj:
            return []

        def dijkstra(
            disabled_nodes: Set[str], disabled_links: Set[str]
        ) -> Optional[Tuple[float, List[str]]]:
            # Priority queue holds (cost, current_node, path_links)
            pq = [(0.0, origin, [])]
            visited = {}

            while pq:
                cost, u, path = heapq.heappop(pq)
                if u in visited and visited[u] <= cost:
                    continue
                visited[u] = cost

                if u == destination:
                    return cost, path

                for v, link_id in self.adj.get(u, []):
                    if v in disabled_nodes or link_id in disabled_links:
                        continue
                    edge_cost = link_costs.get(link_id, 10.0)
                    heapq.heappush(pq, (cost + edge_cost, v, path + [link_id]))

            return None

        # Find first shortest path
        first = dijkstra(set(), set())
        if not first:
            return []

        A = [first[1]]  # list of link_id lists
        B = []          # candidate paths

        for i in range(1, k):
            prev_path = A[-1]
            for j in range(len(prev_path)):
                spur_link_id = prev_path[j]
                spur_link = self.links[spur_link_id]
                spur_node = spur_link.from_node
                root_path = prev_path[:j]

                disabled_links = set()
                for p in A:
                    if len(p) > j and p[:j] == root_path:
                        disabled_links.add(p[j])

                # Spur Dijkstra from spur_node to destination
                pq = [(0.0, spur_node, [])]
                visited = {}
                found_spur = None
                while pq:
                    cost, u, p = heapq.heappop(pq)
                    if u in visited and visited[u] <= cost:
                        continue
                    visited[u] = cost
                    if u == destination:
                        found_spur = p
                        break
                    for v, lid in self.adj.get(u, []):
                        if lid in disabled_links:
                            continue
                        edge_cost = link_costs.get(lid, 10.0)
                        heapq.heappush(pq, (cost + edge_cost, v, p + [lid]))

                if found_spur is not None:
                    total_candidate = root_path + found_spur
                    if total_candidate not in B and total_candidate not in A:
                        candidate_cost = sum(link_costs.get(lid, 10.0) for lid in total_candidate)
                        B.append((candidate_cost, total_candidate))

            if not B:
                break
            B.sort(key=lambda x: x[0])
            _, best_candidate = B.pop(0)
            A.append(best_candidate)

        return A


class TrafficAssignmentEngine:
    """
    Solves Stochastic User Equilibrium (Logit assignment) across paths,
    updating link costs via BPR travel times until demand is consistently distributed.
    """

    def __init__(self, dispersion_theta: float = 0.05, max_iterations: int = 4):
        self.theta = dispersion_theta
        self.max_iterations = max_iterations

    def assign_traffic(
        self,
        links: List[NetworkLink],
        nodes: List[NetworkNode],
        od_flows: List[ODDemand],
        effective_capacities: Dict[str, float],
        bpr_engine,
    ) -> Dict[str, float]:
        """
        Assigns OD vehicle flows to individual network links using multi-path Logit routing.
        Returns {link_id: assigned_volume_vph}.
        """
        graph = NetworkGraph(links, nodes)
        link_dict = {l.id: l for l in links}

        # Initialize costs with free-flow travel times
        current_costs = {}
        for l in links:
            cap = effective_capacities.get(l.id, l.base_capacity_vph)
            res = bpr_engine.compute_link_travel_time(
                length_m=l.length_m,
                free_flow_speed_kmh=l.free_flow_speed_kmh,
                volume_vph=0.0,
                capacity_vph=cap,
                is_signalized=False,
            )
            current_costs[l.id] = res["actual_travel_time_sec"]

        link_volumes = {l.id: 0.0 for l in links}

        for iteration in range(self.max_iterations):
            iter_volumes = {l.id: 0.0 for l in links}

            # Assign each OD demand
            for od in od_flows:
                if od.flow_vph <= 0:
                    continue

                paths = graph.find_k_shortest_paths(
                    od.origin_node, od.destination_node, current_costs, k=3
                )

                if not paths:
                    # Fallback direct or partial assignment
                    continue

                # Compute path costs
                path_costs = [
                    sum(current_costs.get(lid, 10.0) for lid in path) for path in paths
                ]

                # Logit probabilities
                min_cost = min(path_costs)
                # scale relative to min_cost for numerical stability
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
                        iter_volumes[link_id] += flow_on_path

            # Method of Successive Averages (MSA) weight
            step_size = 1.0 / (iteration + 1)
            for lid in link_volumes:
                link_volumes[lid] = (1.0 - step_size) * link_volumes[lid] + step_size * iter_volumes[lid]

            # Update link travel times with new volumes for next iteration
            for l in links:
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

        return {lid: round(vol, 1) for lid, vol in link_volumes.items()}


def nodes_dict_is_signalized(nodes: List[NetworkNode], node_id: str) -> bool:
    for n in nodes:
        if n.id == node_id:
            return n.is_signalized
    return False
