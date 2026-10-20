import heapq
import time
import math
from typing import Dict, List, Tuple, Any, Optional

class DijkstraRouter:
    """
    Dijkstra's Single-Source Shortest Path Algorithm implementation.
    
    Curricular Alignment:
    - Subject: Analysis & Design of Algorithms (ADA)
    - Paradigm: Greedy Algorithm with Min-Priority Queue (Binary Min-Heap)
    - Time Complexity: O((V + E) log V) where V = Vertices (Locations), E = Edges (Roads)
    - Space Complexity: O(V + E) for adjacency list, tentative distance table, and predecessor map.
    """

    @staticmethod
    def solve(
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        source_id: int,
        destination_id: int,
        include_steps: bool = False
    ) -> Dict[str, Any]:
        """
        Execute Dijkstra's algorithm from source_id to destination_id.
        
        Parameters:
            nodes: List of node dictionaries containing at least {"id": int, ...}
            edges: List of directed edge dictionaries with {"source_location_id": int, "destination_location_id": int, "distance_km": float, "is_active": bool}
            source_id: Node ID where the journey begins
            destination_id: Target node ID to reach
            include_steps: When True, records step-by-step execution trace
            
        Returns:
            Dictionary containing:
                - algorithm: "Dijkstra"
                - source_id: int
                - destination_id: int
                - has_route: bool
                - total_distance_km: Optional[float]
                - path: List[int] (ordered sequence of node IDs)
                - execution_time_ms: float (algorithm execution time in milliseconds)
                - visited_nodes_count: int
                - total_nodes_in_graph: int
                - trace: Optional[List[Dict[str, Any]]]
        """
        # Validate node existence
        valid_node_ids = {node['id'] for node in nodes}
        if source_id not in valid_node_ids:
            raise ValueError(f"Source location ID {source_id} not found in active graph.")
        if destination_id not in valid_node_ids:
            raise ValueError(f"Destination location ID {destination_id} not found in active graph.")

        # Build adjacency list: graph[u] = [(v, weight, edge_obj)]
        graph: Dict[int, List[Tuple[int, float, Dict[str, Any]]]] = {nid: [] for nid in valid_node_ids}
        
        for edge in edges:
            # Enforce active road segment constraint
            if not edge.get('is_active', True):
                continue

            u = edge.get('source_location_id')
            v = edge.get('destination_location_id')
            weight = edge.get('distance_km')

            # Ensure endpoints exist in graph
            if u not in graph or v not in graph:
                continue

            # Reject invalid edge weights (zero, negative, NaN, Inf)
            if weight is None or math.isnan(weight) or math.isinf(weight) or weight <= 0:
                raise ValueError(f"Invalid edge weight {weight} detected on road segment ({u} -> {v}). Dijkstra requires positive weights.")

            graph[u].append((v, float(weight), edge))

        # Trace collection container
        trace: List[Dict[str, Any]] = []
        step_counter = 0

        # High-resolution performance timer strictly measuring algorithm execution
        start_time = time.perf_counter()

        # Handle Source equals Destination edge case
        if source_id == destination_id:
            end_time = time.perf_counter()
            exec_ms = round((end_time - start_time) * 1000, 4)
            if include_steps:
                trace.append({
                    "step": 1,
                    "action": "SOURCE_EQUALS_DESTINATION",
                    "current_node": source_id,
                    "pq_snapshot": [(0.0, source_id)],
                    "visited_nodes": [source_id],
                    "distances": {nid: (0.0 if nid == source_id else None) for nid in valid_node_ids},
                    "predecessors": {source_id: None},
                    "description": f"Source node {source_id} is identical to destination node {destination_id}. Optimal distance is 0 km."
                })

            return {
                "algorithm": "Dijkstra",
                "source_location_id": source_id,
                "destination_location_id": destination_id,
                "has_route": True,
                "total_distance_km": 0.0,
                "path": [source_id],
                "execution_time_ms": max(exec_ms, 0.001),
                "visited_nodes_count": 1,
                "total_nodes_in_graph": len(valid_node_ids),
                "trace": trace if include_steps else None
            }

        # Priority Queue: stores tuples of (tentative_distance, node_id)
        pq: List[Tuple[float, int]] = []
        heapq.heappush(pq, (0.0, source_id))

        # Tentative distances table: initialized to infinity
        distances: Dict[int, float] = {nid: float('inf') for nid in valid_node_ids}
        distances[source_id] = 0.0

        # Predecessor map for path reconstruction
        predecessors: Dict[int, Optional[int]] = {nid: None for nid in valid_node_ids}

        # Set of finalized / visited vertices
        visited = set()

        if include_steps:
            step_counter += 1
            trace.append({
                "step": step_counter,
                "action": "INITIALIZATION",
                "current_node": None,
                "pq_snapshot": [(0.0, source_id)],
                "visited_nodes": [],
                "distances": {nid: (round(d, 2) if d != float('inf') else None) for nid, d in distances.items()},
                "predecessors": dict(predecessors),
                "description": f"Initialized tentative distance to 0 for source node {source_id} and infinity for all other {len(valid_node_ids) - 1} vertices."
            })

        destination_found = False

        while pq:
            current_dist, u = heapq.heappop(pq)

            # Skip stale entries in priority queue
            if current_dist > distances[u]:
                if include_steps:
                    step_counter += 1
                    trace.append({
                        "step": step_counter,
                        "action": "SKIP_STALE",
                        "current_node": u,
                        "pq_snapshot": [(round(d, 2), nid) for d, nid in pq],
                        "visited_nodes": list(visited),
                        "distances": {nid: (round(d, 2) if d != float('inf') else None) for nid, d in distances.items()},
                        "predecessors": dict(predecessors),
                        "description": f"Discarded stale priority queue entry for node {u} (popped distance {round(current_dist, 2)} > finalized {round(distances[u], 2)} km)."
                    })
                continue

            visited.add(u)

            if include_steps:
                step_counter += 1
                trace.append({
                    "step": step_counter,
                    "action": "SELECT_MIN_NODE",
                    "current_node": u,
                    "pq_snapshot": [(round(d, 2), nid) for d, nid in pq],
                    "visited_nodes": list(visited),
                    "distances": {nid: (round(d, 2) if d != float('inf') else None) for nid, d in distances.items()},
                    "predecessors": dict(predecessors),
                    "description": f"Extracted minimum distance node {u} from priority queue with finalized distance {round(current_dist, 2)} km."
                })

            # Early exit optimization: stop exploration if destination reached
            if u == destination_id:
                destination_found = True
                if include_steps:
                    step_counter += 1
                    trace.append({
                        "step": step_counter,
                        "action": "DESTINATION_REACHED",
                        "current_node": u,
                        "pq_snapshot": [(round(d, 2), nid) for d, nid in pq],
                        "visited_nodes": list(visited),
                        "distances": {nid: (round(d, 2) if d != float('inf') else None) for nid, d in distances.items()},
                        "predecessors": dict(predecessors),
                        "description": f"Destination node {destination_id} reached with optimal distance {round(current_dist, 2)} km. Terminating search."
                    })
                break

            # Edge relaxation: iterate through outgoing neighbors
            for v, weight, edge_obj in graph[u]:
                if v in visited:
                    continue

                new_dist = current_dist + weight

                if new_dist < distances[v]:
                    old_dist = distances[v]
                    distances[v] = new_dist
                    predecessors[v] = u
                    heapq.heappush(pq, (new_dist, v))

                    if include_steps:
                        step_counter += 1
                        trace.append({
                            "step": step_counter,
                            "action": "RELAX_EDGE",
                            "current_node": u,
                            "relaxed_edge": {
                                "source": u,
                                "target": v,
                                "weight_km": round(weight, 2),
                                "old_distance": round(old_dist, 2) if old_dist != float('inf') else None,
                                "new_distance": round(new_dist, 2)
                            },
                            "pq_snapshot": [(round(d, 2), nid) for d, nid in pq],
                            "visited_nodes": list(visited),
                            "distances": {nid: (round(d, 2) if d != float('inf') else None) for nid, d in distances.items()},
                            "predecessors": dict(predecessors),
                            "description": f"Relaxed edge ({u} -> {v}, weight {round(weight, 2)} km): updated tentative distance to {round(new_dist, 2)} km."
                        })

        end_time = time.perf_counter()
        exec_ms = round((end_time - start_time) * 1000, 4)

        # Path reconstruction
        if distances[destination_id] == float('inf'):
            if include_steps:
                step_counter += 1
                trace.append({
                    "step": step_counter,
                    "action": "NO_ROUTE_FOUND",
                    "current_node": None,
                    "pq_snapshot": [],
                    "visited_nodes": list(visited),
                    "distances": {nid: (round(d, 2) if d != float('inf') else None) for nid, d in distances.items()},
                    "predecessors": dict(predecessors),
                    "description": f"No directed path exists between node {source_id} and node {destination_id} in the active road network."
                })

            return {
                "algorithm": "Dijkstra",
                "source_location_id": source_id,
                "destination_location_id": destination_id,
                "has_route": False,
                "total_distance_km": None,
                "path": [],
                "execution_time_ms": max(exec_ms, 0.001),
                "visited_nodes_count": len(visited),
                "total_nodes_in_graph": len(valid_node_ids),
                "trace": trace if include_steps else None
            }

        # Reconstruct path using predecessor chain
        path = []
        curr = destination_id
        while curr is not None:
            path.append(curr)
            curr = predecessors[curr]
        path.reverse()

        if include_steps:
            step_counter += 1
            trace.append({
                "step": step_counter,
                "action": "PATH_RECONSTRUCTED",
                "current_node": destination_id,
                "pq_snapshot": [],
                "visited_nodes": list(visited),
                "distances": {nid: (round(d, 2) if d != float('inf') else None) for nid, d in distances.items()},
                "predecessors": dict(predecessors),
                "final_path": path,
                "description": f"Shortest path successfully reconstructed: {' -> '.join(str(n) for n in path)} with total distance {round(distances[destination_id], 2)} km."
            })

        return {
            "algorithm": "Dijkstra",
            "source_location_id": source_id,
            "destination_location_id": destination_id,
            "has_route": True,
            "total_distance_km": round(distances[destination_id], 2),
            "path": path,
            "execution_time_ms": max(exec_ms, 0.001),
            "visited_nodes_count": len(visited),
            "total_nodes_in_graph": len(valid_node_ids),
            "trace": trace if include_steps else None
        }

    @staticmethod
    def distances_from(
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        source_id: int
    ) -> Tuple[Dict[int, float], Dict[int, Optional[int]]]:
        """
        Execute Dijkstra's algorithm from source_id to compute shortest path distances to all vertices.
        
        Curricular Alignment:
        - Subject: Analysis & Design of Algorithms (ADA)
        - Paradigm: Single-Source Shortest Path (Dijkstra Min-Heap)
        - Complexity: O((V + E) log V) where V = vertices (locations), E = directed edges (roads).
        - Application: Computes distance matrix rows for Multi-Stop Vehicle Routing (Delivery Run).
        
        Parameters:
            nodes: List of node dictionaries containing at least {"id": int, ...}
            edges: List of directed edge dictionaries with {"source_location_id": int, "destination_location_id": int, "distance_km": float, "is_active": bool}
            source_id: Node ID where the journey begins
            
        Returns:
            Tuple of:
                - distances: Dict[node_id, distance_km] (float('inf') if unreachable)
                - predecessors: Dict[node_id, Optional[predecessor_node_id]] for path reconstruction
        """
        valid_node_ids = {node['id'] for node in nodes}
        if source_id not in valid_node_ids:
            raise ValueError(f"Source location ID {source_id} not found in active graph.")

        graph: Dict[int, List[Tuple[int, float]]] = {nid: [] for nid in valid_node_ids}
        for edge in edges:
            if not edge.get('is_active', True):
                continue

            u = edge.get('source_location_id')
            v = edge.get('destination_location_id')
            weight = edge.get('distance_km')

            if u not in graph or v not in graph:
                continue

            if weight is None or math.isnan(weight) or math.isinf(weight) or weight <= 0:
                raise ValueError(f"Invalid edge weight {weight} detected on road segment ({u} -> {v}). Dijkstra requires positive weights.")

            graph[u].append((v, float(weight)))

        pq: List[Tuple[float, int]] = []
        heapq.heappush(pq, (0.0, source_id))

        distances: Dict[int, float] = {nid: float('inf') for nid in valid_node_ids}
        distances[source_id] = 0.0

        predecessors: Dict[int, Optional[int]] = {nid: None for nid in valid_node_ids}
        visited = set()

        while pq:
            current_dist, u = heapq.heappop(pq)

            if current_dist > distances[u]:
                continue

            visited.add(u)

            for v, weight in graph[u]:
                if v in visited:
                    continue
                new_dist = current_dist + weight
                if new_dist < distances[v]:
                    distances[v] = new_dist
                    predecessors[v] = u
                    heapq.heappush(pq, (new_dist, v))

        return distances, predecessors

    @staticmethod
    def _compute_path_distance(path: List[int], edges: List[Dict[str, Any]]) -> float:
        """Compute the total road distance in kilometers for a sequence of vertex IDs."""
        if len(path) <= 1:
            return 0.0
        
        # Build lookup for active edges: (u, v) -> min distance
        edge_map: Dict[Tuple[int, int], float] = {}
        for e in edges:
            if not e.get('is_active', True):
                continue
            u = e.get('source_location_id')
            v = e.get('destination_location_id')
            dist = float(e.get('distance_km', 0.0))
            if u is not None and v is not None and dist > 0:
                key = (u, v)
                if key not in edge_map or dist < edge_map[key]:
                    edge_map[key] = dist

        total_dist = 0.0
        for i in range(len(path) - 1):
            key = (path[i], path[i + 1])
            if key in edge_map:
                total_dist += edge_map[key]
        return total_dist

    @staticmethod
    def _compute_path_duration(path: List[int], edges: List[Dict[str, Any]]) -> float:
        """Compute the total estimated transit duration in minutes for a sequence of vertex IDs."""
        if len(path) <= 1:
            return 0.0
        
        edge_map: Dict[Tuple[int, int], float] = {}
        for e in edges:
            if not e.get('is_active', True):
                continue
            u = e.get('source_location_id')
            v = e.get('destination_location_id')
            dur = e.get('estimated_duration_minutes')
            dist = float(e.get('distance_km', 0.0))
            # Fallback duration calculation if not explicitly provided
            duration_val = float(dur) if dur is not None else round(dist * 1.8, 1)
            if u is not None and v is not None and duration_val > 0:
                key = (u, v)
                if key not in edge_map or duration_val < edge_map[key]:
                    edge_map[key] = duration_val

        total_dur = 0.0
        for i in range(len(path) - 1):
            key = (path[i], path[i + 1])
            if key in edge_map:
                total_dur += edge_map[key]
        return total_dur

    @classmethod
    def solve_k_shortest_paths(
        cls,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        source_id: int,
        destination_id: int,
        k: int = 3,
        include_steps: bool = False
    ) -> Dict[str, Any]:
        """
        Calculates the primary shortest path using Dijkstra's Algorithm, followed by up to
        (k - 1) valid loopless alternative paths using Yen's K-Shortest Paths Algorithm.
        
        Guarantees:
        - Primary shortest path is guaranteed optimal via Dijkstra min-heap.
        - Alternative routes are valid, directed, loopless paths from the actual graph.
        - At most k routes are returned in strictly ascending order of distance cost.
        - If fewer than k paths exist in the network topology, returns only existing paths without fabrication.
        """
        # 1. Compute Primary Shortest Path via Dijkstra
        primary_result = cls.solve(
            nodes=nodes,
            edges=edges,
            source_id=source_id,
            destination_id=destination_id,
            include_steps=include_steps
        )

        if not primary_result.get('has_route') or source_id == destination_id or len(primary_result.get('path', [])) <= 1:
            single_route = {
                "route_index": 1,
                "label": "Shortest Route",
                "is_primary": True,
                "path": primary_result.get('path', []),
                "total_distance_km": primary_result.get('total_distance_km') or 0.0,
                "total_duration_minutes": cls._compute_path_duration(primary_result.get('path', []), edges) if primary_result.get('has_route') else 0.0
            }
            return {
                **primary_result,
                "routes": [single_route] if primary_result.get('has_route') else []
            }

        # 2. Yen's K-Shortest Loopless Paths Algorithm (Yen, 1971)
        A_paths: List[List[int]] = [primary_result['path']]
        A_costs: List[float] = [primary_result['total_distance_km']]
        B_candidates: List[Tuple[float, List[int]]] = []  # Min-heap of (cost, path)

        valid_node_map = {n['id']: n for n in nodes}

        for k_idx in range(1, k):
            prev_path = A_paths[-1]

            # The spur node ranges from the first node up to the second-to-last node of the previous path
            for i in range(len(prev_path) - 1):
                spur_node = prev_path[i]
                root_path = prev_path[:i + 1]  # Sequence from source up to spur node

                # Determine edges to temporarily remove:
                # Any edge that was used by any path in A that shares the exact same root path
                removed_edges = set()
                for p in A_paths:
                    if len(p) > i and p[:i + 1] == root_path:
                        removed_edges.add((p[i], p[i + 1]))

                # Nodes in the root path (except the spur node) cannot be revisited to ensure loopless paths
                removed_nodes = set(root_path[:-1])

                # Construct temporary subgraph excluding removed vertices and edges
                temp_edges = [
                    e for e in edges
                    if e.get('is_active', True)
                    and e.get('source_location_id') not in removed_nodes
                    and e.get('destination_location_id') not in removed_nodes
                    and (e.get('source_location_id'), e.get('destination_location_id')) not in removed_edges
                ]
                temp_nodes = [n for n in nodes if n['id'] not in removed_nodes]

                if spur_node not in valid_node_map or destination_id in removed_nodes:
                    continue

                try:
                    # Calculate shortest path from spur node to destination in modified graph
                    spur_result = cls.solve(
                        nodes=temp_nodes,
                        edges=temp_edges,
                        source_id=spur_node,
                        destination_id=destination_id,
                        include_steps=False
                    )

                    if spur_result.get('has_route') and spur_result.get('path'):
                        # Entire candidate path = root_path + spur_path (excluding duplicate spur node)
                        candidate_path = root_path[:-1] + spur_result['path']

                        # Validate that candidate is strictly loopless (no duplicate nodes)
                        if len(candidate_path) == len(set(candidate_path)):
                            candidate_cost = round(cls._compute_path_distance(candidate_path, edges), 2)
                            existing_candidate_paths = [c[1] for c in B_candidates]

                            if candidate_path not in A_paths and candidate_path not in existing_candidate_paths:
                                heapq.heappush(B_candidates, (candidate_cost, candidate_path))
                except Exception:
                    # Subgraph without path or disconnected component
                    continue

            if not B_candidates:
                # No more alternative paths exist in the network
                break

            # Pop the lowest-cost valid candidate
            while B_candidates:
                candidate_cost, candidate_path = heapq.heappop(B_candidates)
                if candidate_path not in A_paths:
                    A_paths.append(candidate_path)
                    A_costs.append(candidate_cost)
                    break

        # 3. Format structured route list for UI and API consumption
        routes_list: List[Dict[str, Any]] = []
        for idx, (p, dist) in enumerate(zip(A_paths, A_costs)):
            is_primary = (idx == 0)
            dur = cls._compute_path_duration(p, edges)
            routes_list.append({
                "route_index": idx + 1,
                "label": "Shortest Route" if is_primary else f"Alternative Route {idx}",
                "is_primary": is_primary,
                "path": p,
                "total_distance_km": round(dist, 2),
                "total_duration_minutes": round(dur, 1)
            })

        return {
            **primary_result,
            "routes": routes_list
        }

