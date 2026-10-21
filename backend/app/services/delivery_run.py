"""
Delivery Run Multi-Stop Route Optimization Service.

Curricular Alignment:
- Subject: Analysis & Design of Algorithms (ADA)
- Problem: Multi-Stop Vehicle Routing / Traveling Salesperson Problem (TSP) with Fixed Depot
- Computational Complexity: NP-Hard Combinatorial Optimization
- Methods:
    1. Exact Method: Exhaustive Permutation Search
       - Time Complexity: O((n - 1)! * n) where n is the number of stops plus depot
       - Growth: Factorial time explosion (e.g. 4 stops = 24 permutations, 8 stops = 40,320 permutations)
       - Optimality: Guaranteed global minimum
    2. Fast Approximation Method: Greedy Nearest Neighbor + 2-Opt Local Search
       - Nearest Neighbor: O(n^2) greedy construction
       - 2-Opt Optimization: O(k * n^2) iterative edge-exchange local search heuristic
       - Optimality: Sub-optimal / near-optimal polynomial-time approximation
"""

import time
import math
import itertools
from typing import Dict, List, Tuple, Any, Callable, Optional
from .dijkstra import DijkstraRouter

# Fallback city speed used only when a road segment has no stored duration.
AVERAGE_CITY_SPEED_KMH = 22.0


def build_matrix(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    hub_ids: List[int]
) -> Tuple[Dict[int, Dict[int, float]], Callable[[int, int], List[int]]]:
    """
    Construct all-pairs shortest path distance matrix for the specified subset of hubs
    using repeated Single-Source Dijkstra executions (one per hub).

    Complexity: O(|H| * (V + E) log V) where |H| is len(hub_ids).
    Supports directed/asymmetric road network topologies.

    Returns:
        matrix: Dict[u, Dict[v, distance_km]]
        reconstruct_path: Callable(u, v) -> List[int] returning node path along road network
    """
    node_lookup = {n['id']: n for n in nodes}
    unique_hubs = sorted(list(dict.fromkeys(hub_ids)))

    matrix: Dict[int, Dict[int, float]] = {u: {} for u in unique_hubs}
    predecessors_table: Dict[int, Dict[int, Optional[int]]] = {}

    for u in unique_hubs:
        distances, predecessors = DijkstraRouter.distances_from(nodes, edges, u)
        predecessors_table[u] = predecessors
        for v in unique_hubs:
            matrix[u][v] = distances.get(v, float('inf'))

    # Validate reachability between every required pair
    for u in unique_hubs:
        for v in unique_hubs:
            if u != v:
                d = matrix[u][v]
                if d == float('inf') or math.isinf(d):
                    u_name = node_lookup.get(u, {}).get('name', f"Hub #{u}")
                    v_name = node_lookup.get(v, {}).get('name', f"Hub #{v}")
                    raise ValueError(f"No connected road route exists between {u_name} and {v_name}.")

    def reconstruct_path(u: int, v: int) -> List[int]:
        """Reconstruct the sequence of vertex IDs along the shortest road path from u to v."""
        if u == v:
            return [u]
        pred_map = predecessors_table.get(u, {})
        curr: Optional[int] = v
        segment: List[int] = []
        visited_nodes = set()

        while curr is not None:
            if curr in visited_nodes:
                raise ValueError(f"Cycle detected while reconstructing path from hub {u} to {v}.")
            visited_nodes.add(curr)
            segment.append(curr)
            if curr == u:
                break
            curr = pred_map.get(curr)

        segment.reverse()
        if not segment or segment[0] != u:
            u_name = node_lookup.get(u, {}).get('name', f"Hub #{u}")
            v_name = node_lookup.get(v, {}).get('name', f"Hub #{v}")
            raise ValueError(f"Path reconstruction failed between {u_name} and {v_name}.")
        return segment

    return matrix, reconstruct_path


def route_cost(order: List[int], matrix: Dict[int, Dict[int, float]], return_to_depot: bool = True) -> float:
    """
    Calculate the total road distance for a specific visiting sequence of hub IDs.

    Parameters:
        order: Ordered sequence of hub IDs starting with depot [depot, stop_1, ..., stop_k]
        matrix: Asymmetric road distance matrix
        return_to_depot: When True, adds the closing leg from order[-1] back to order[0]

    Returns:
        total_distance_km: float
    """
    if len(order) < 2:
        return 0.0

    cost = 0.0
    for i in range(len(order) - 1):
        u = order[i]
        v = order[i + 1]
        cost += matrix[u][v]

    if return_to_depot:
        cost += matrix[order[-1]][order[0]]

    return cost


def fast_method(
    depot_id: int,
    stop_ids: List[int],
    matrix: Dict[int, Dict[int, float]],
    return_to_depot: bool = True
) -> Tuple[List[int], float]:
    """
    Fast heuristic solver:
    1. Greedy Nearest Neighbor constructive heuristic (ties broken by lowest hub ID).
    2. 2-Opt local search improvement re-evaluating cost via route_cost to support
       asymmetric road topologies and open/closed routes.

    Curricular Complexity:
    - Nearest Neighbor: O(n^2)
    - 2-Opt Iterations: O(k * n^2) where k is number of improvement passes
    """
    # 1. Nearest Neighbor Initialization
    unvisited = set(stop_ids)
    order = [depot_id]
    current = depot_id

    while unvisited:
        # Pick unvisited stop with minimum distance from current (ties broken by lowest hub id)
        next_stop = min(unvisited, key=lambda sid: (matrix[current][sid], sid))
        order.append(next_stop)
        unvisited.remove(next_stop)
        current = next_stop

    best_cost = route_cost(order, matrix, return_to_depot)

    # 2. 2-Opt Local Search Improvement
    # Keep depot at order[0] fixed; reverse interior segments [i : j]
    improved = True
    iterations = 0
    max_iterations = 200

    while improved and iterations < max_iterations:
        improved = False
        iterations += 1
        n = len(order)

        for i in range(1, n - 1):
            for j in range(i + 1, n):
                # Reverse segment between i and j inclusive
                candidate_order = order[:i] + list(reversed(order[i:j + 1])) + order[j + 1:]
                candidate_cost = route_cost(candidate_order, matrix, return_to_depot)

                # Strictly improve to avoid infinite loops on neutral swaps
                if candidate_cost < best_cost - 1e-9:
                    order = candidate_order
                    best_cost = candidate_cost
                    improved = True
                    break
            if improved:
                break

    return order, best_cost


def exact_method(
    depot_id: int,
    stop_ids: List[int],
    matrix: Dict[int, Dict[int, float]],
    return_to_depot: bool = True
) -> Tuple[List[int], float]:
    """
    Exact brute-force permutation solver:
    Exhaustively searches all permutations of stops with the depot fixed at index 0.

    Curricular Complexity:
    - O((n - 1)! * n) where n is the number of stops + 1 (depot).
    - Capped at 8 stops (maximum 8! = 40,320 permutations).
    """
    if len(stop_ids) > 8:
        raise ValueError("Exact method is capped at 8 stops due to factorial growth O((n-1)!).")

    best_order: Optional[List[int]] = None
    min_cost = float('inf')

    # Sort stop_ids for deterministic lexicographical iteration
    sorted_stops = sorted(stop_ids)

    for perm in itertools.permutations(sorted_stops):
        candidate_order = [depot_id] + list(perm)
        cost = route_cost(candidate_order, matrix, return_to_depot)

        if cost < min_cost - 1e-9:
            min_cost = cost
            best_order = candidate_order
        elif abs(cost - min_cost) <= 1e-9:
            # Deterministic tie breaking: lexicographically smaller stop sequence
            if best_order is None or tuple(candidate_order[1:]) < tuple(best_order[1:]):
                min_cost = cost
                best_order = candidate_order

    return best_order or ([depot_id] + sorted_stops), min_cost


def plan_run(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    depot_id: int,
    stop_ids: List[int],
    return_to_depot: bool = True,
    include_exact: bool = True
) -> Dict[str, Any]:
    """
    Plan the optimal multi-stop delivery run using shortest road distances between hubs.

    Parameters:
        nodes: Graph vertices with id, name, coordinates
        edges: Graph directed edges with source, destination, distance_km, is_active
        depot_id: Origin hub ID
        stop_ids: Destination hub IDs for stops
        return_to_depot: Whether the driver returns to the depot after the final stop
        include_exact: Whether to compute the exact global minimum via exhaustive search

    Returns:
        Structured delivery run execution plan with distance comparisons, savings, and road path.
    """
    node_lookup = {n['id']: n for n in nodes}
    if depot_id not in node_lookup:
        raise ValueError(f"Depot location ID {depot_id} not found in active road network.")

    # 1. De-duplicate stops and drop depot if present
    unique_stops: List[int] = []
    for sid in stop_ids:
        if sid == depot_id:
            continue
        if sid not in unique_stops:
            if sid not in node_lookup:
                raise ValueError(f"Stop location ID {sid} not found in active road network.")
            unique_stops.append(sid)

    # 2. Validate stop count constraint (2 to 8 stops)
    if len(unique_stops) < 2:
        raise ValueError("Delivery run requires at least 2 distinct delivery stops.")
    if len(unique_stops) > 8:
        raise ValueError("Delivery run allows a maximum of 8 stops per run.")

    all_hubs = [depot_id] + unique_stops

    # 3. Build distance matrix and road path reconstruction function
    t_matrix_start = time.perf_counter()
    matrix, reconstruct_path = build_matrix(nodes, edges, all_hubs)

    # 4. As-listed baseline cost
    listed_order = [depot_id] + unique_stops
    listed_cost = route_cost(listed_order, matrix, return_to_depot)

    # 5. Fast Heuristic Method
    t_fast_start = time.perf_counter()
    fast_order, fast_cost = fast_method(depot_id, unique_stops, matrix, return_to_depot)
    fast_time_ms = round((time.perf_counter() - t_fast_start) * 1000, 3)

    # 6. Exact Method (Optional)
    exact_order: Optional[List[int]] = None
    exact_cost: Optional[float] = None
    exact_time_ms: Optional[float] = None
    gap_percent: Optional[float] = None

    if include_exact:
        t_exact_start = time.perf_counter()
        exact_order, exact_cost = exact_method(depot_id, unique_stops, matrix, return_to_depot)
        exact_time_ms = round((time.perf_counter() - t_exact_start) * 1000, 3)

        if exact_cost > 0:
            gap_percent = round(((fast_cost - exact_cost) / exact_cost) * 100, 2)
        else:
            gap_percent = 0.0

    # Recommended Order: exact when computed, otherwise fast
    recommended_order = exact_order if (include_exact and exact_order is not None) else fast_order
    recommended_cost = exact_cost if (include_exact and exact_cost is not None) else fast_cost

    saved_km = round(max(0.0, listed_cost - recommended_cost), 2)
    saved_percent = round((saved_km / listed_cost) * 100, 2) if listed_cost > 0 else 0.0

    total_time_ms = round((time.perf_counter() - t_matrix_start) * 1000, 3)

    # 7. Construct leg details and expanded continuous road path
    # Edge lookup (shortest edge per directed pair) so each leg can report drive time.
    edge_lookup: Dict[Tuple[int, int], Dict[str, Any]] = {}
    for e in edges:
        if not e.get('is_active', True):
            continue
        key = (e['source_location_id'], e['destination_location_id'])
        if key not in edge_lookup or e['distance_km'] < edge_lookup[key]['distance_km']:
            edge_lookup[key] = e

    def segment_duration(path: List[int]) -> float:
        total = 0.0
        for a_id, b_id in zip(path, path[1:]):
            e = edge_lookup.get((a_id, b_id))
            dur = e.get('estimated_duration_minutes') if e else None
            if dur is None:
                dist = e['distance_km'] if e else matrix[a_id][b_id]
                dur = dist / AVERAGE_CITY_SPEED_KMH * 60.0
            total += float(dur)
        return total

    legs: List[Dict[str, Any]] = []
    total_duration_min = 0.0
    expanded_node_path: List[int] = []

    leg_pairs = []
    for i in range(len(recommended_order) - 1):
        leg_pairs.append((recommended_order[i], recommended_order[i + 1]))
    if return_to_depot:
        leg_pairs.append((recommended_order[-1], recommended_order[0]))

    for leg_idx, (u, v) in enumerate(leg_pairs, start=1):
        leg_dist = round(matrix[u][v], 2)
        u_node = node_lookup.get(u, {})
        v_node = node_lookup.get(v, {})
        sub_path = reconstruct_path(u, v)
        leg_duration = segment_duration(sub_path)
        total_duration_min += leg_duration
        legs.append({
            "leg_index": leg_idx,
            "from_hub_id": u,
            "to_hub_id": v,
            "from_name": u_node.get('name', f"Hub #{u}"),
            "to_name": v_node.get('name', f"Hub #{v}"),
            "distance_km": leg_dist,
            "duration_min": round(leg_duration, 1),
            "road_path": sub_path,
            "via_names": [node_lookup.get(x, {}).get('name', f"Hub #{x}") for x in sub_path[1:-1]]
        })

        if not expanded_node_path:
            expanded_node_path.extend(sub_path)
        else:
            expanded_node_path.extend(sub_path[1:])

    # 8. Compute service minutes and strictly increasing arrival offsets
    service_minutes_per_stop = 5
    arrival_offsets_min: List[float] = []
    cumulative_driving_min = 0.0
    for idx, leg in enumerate(legs):
        leg_min = leg.get("duration_min")
        if leg_min is None:
            leg_min = round(leg["distance_km"] / AVERAGE_CITY_SPEED_KMH * 60.0, 1)
        cumulative_driving_min += leg_min
        service_before = idx * service_minutes_per_stop
        arrival_offsets_min.append(round(cumulative_driving_min + service_before, 1))

    return {
        "depot_id": depot_id,
        "depot_name": node_lookup.get(depot_id, {}).get('name', f"Hub #{depot_id}"),
        "stops": unique_stops,
        "stop_count": len(unique_stops),
        "return_to_depot": return_to_depot,
        "recommended_order": recommended_order,
        "recommended_distance_km": round(recommended_cost, 2),
        "as_listed": {
            "order": listed_order,
            "order_names": [node_lookup.get(x, {}).get('name', f"Hub #{x}") for x in listed_order],
            "distance_km": round(listed_cost, 2)
        },
        "recommended_order_names": [node_lookup.get(x, {}).get('name', f"Hub #{x}") for x in recommended_order],
        "recommended_duration_min": round(total_duration_min, 1),
        "service_minutes_per_stop": service_minutes_per_stop,
        "arrival_offsets_min": arrival_offsets_min,
        "hubs_in_matrix": len(all_hubs),
        "pairs_computed": len(all_hubs) * (len(all_hubs) - 1),
        "orders_checked_exact": math.factorial(len(unique_stops)) if include_exact else None,
        "savings": {
            "saved_km": saved_km,
            "saved_percent": saved_percent
        },
        "fast_method": {
            "order": fast_order,
            "distance_km": round(fast_cost, 2),
            "execution_time_ms": fast_time_ms
        },
        "exact_method": {
            "order": exact_order,
            "distance_km": round(exact_cost, 2) if exact_cost is not None else None,
            "execution_time_ms": exact_time_ms
        } if include_exact else None,
        "gap_percent": gap_percent,
        "legs": legs,
        "expanded_node_path": expanded_node_path,
        "total_execution_time_ms": total_time_ms
    }
