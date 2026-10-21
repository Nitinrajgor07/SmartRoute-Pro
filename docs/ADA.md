# Analysis and Design of Algorithms (ADA)

## Graph Model

The road transportation network is modeled as a directed weighted graph $G = (V, E, w)$:
- Vertices ($V$): Geographic locations representing logistics depots, fulfillment centers, retail hubs, and customer delivery waypoints. The seeded dataset contains $|V| = 24$ hubs.
- Edges ($E$): Directed road segments between pairs of locations. The seeded dataset contains $|E| = 83$ active road segments.
- Weights ($w$): Strictly non-negative floating-point values representing road distances in kilometers ($w(u, v) > 0$). Estimated traversal duration is computed alongside distance.

The graph is represented in memory using an adjacency list:
$$\text{adj}[u] = \{(v, w(u, v)) \mid (u, v) \in E\}$$

---

## Shortest-Route Algorithm

Single-source shortest paths between origin and destination hubs are computed using Dijkstra's algorithm.

### Implementation Details
- Uses Python's `heapq` module implementing a binary min-heap priority queue.
- Elements in the min-heap are tuples `(distance, node_id)`.
- Maintained arrays:
  - `dist[v]`: Tentative shortest distance from source to node $v$, initialized to $\infty$, with `dist[source] = 0`.
  - `predecessor[v]`: Preceding vertex on the optimal path from source to $v$.
  - `visited`: Set of vertices whose shortest distances have been finalized.
- When `dist[u] + w(u, v) < dist[v]`, `dist[v]` is updated and `(dist[v], v)` is pushed to the heap (relaxation step).
- Inactive roads (`is_active = False`) are filtered out during graph initialization.

### Correctness Argument
Dijkstra's algorithm relies on the greedy choice property and optimal substructure:
1. Base case: At initialization, the source node has `dist[source] = 0`, which is trivially optimal since all edge weights $w \ge 0$.
2. Inductive step: Assume all nodes in `visited` have their optimal shortest distances. When node $u \notin \text{visited}$ with minimal tentative distance is extracted from the min-heap, any alternative path from the source to $u$ must pass through some unvisited node $x$. Because all edge weights are non-negative, the length of that alternative path is at least `dist[x] >= dist[u]`. Thus, no shorter path to $u$ can exist, and `dist[u]` is optimal.
3. Path reconstruction: Tracing `predecessor` pointers backward from destination to source recovers the exact optimal sequence of road segments.

### Complexity
- Graph construction: $\mathcal{O}(V + E)$
- Priority queue operations: At most $|V|$ extractions ($\mathcal{O}(V \log V)$) and at most $|E|$ decrease-key insertions ($\mathcal{O}(E \log V)$)
- Total Time Complexity: $\mathcal{O}((V + E) \log V)$
- Space Complexity: $\mathcal{O}(V + E)$

---

## Delivery Run (Multi-Stop Visiting Order)

When a driver visits multiple customer delivery hubs and returns to the depot, the task is modeled as the Travelling Salesperson Problem (TSP) on the metric closure of the selected hubs. TSP is NP-hard.

### Problem Formulation
Given depot $h_0$ and delivery stops $\{h_1, h_2, \dots, h_{k-1}\}$, find an ordering $\pi$ of $\{h_1, \dots, h_{k-1}\}$ that minimizes total road travel distance:
$$D(\pi) = d(h_0, \pi(1)) + \sum_{i=1}^{k-2} d(\pi(i), \pi(i+1)) + d(\pi(k-1), h_0)$$
where $d(u, v)$ is the shortest road distance computed via Dijkstra.

### Matrix Construction
To compute distances between all pairs of selected stops without redundant graph traversals, Dijkstra is executed once from each stop:
- `distances_from(nodes, edges, source_id)` runs one single-source Dijkstra returning all destination distances and predecessor trees in $\mathcal{O}((V + E) \log V)$.
- Total matrix preparation for $k$ stops takes $\mathcal{O}(k \cdot (V + E) \log V)$ time.

### Exact Method vs Fast Heuristic

| Characteristic | Exact Method (Brute Force) | Fast Method (Nearest Neighbour + 2-Opt) |
|---|---|---|
| Strategy | Evaluates all $(k-1)!$ permutations | Greedy Nearest Neighbour followed by 2-Opt local search |
| Time Complexity | $\mathcal{O}(k! \cdot k)$ | $\mathcal{O}(k^2)$ |
| Space Complexity | $\mathcal{O}(k)$ | $\mathcal{O}(k)$ |
| Optimality | Guaranteed global minimum | Near-optimal approximation (typically within 0-5% of optimal) |
| Stop Limit | Practical up to $k \le 8$ | Efficient up to $k \ge 50$ |

#### 2-Opt Local Search Mechanism
1. Begin with the tour produced by the Nearest Neighbour heuristic.
2. For every pair of non-adjacent edges $(i, i+1)$ and $(j, j+1)$, evaluate if reversing the segment from $i+1$ to $j$ reduces the total tour distance:
   $$\Delta = d(v_i, v_j) + d(v_{i+1}, v_{j+1}) - (d(v_i, v_{i+1}) + d(v_j, v_{j+1}))$$
3. If $\Delta < 0$, apply the reversal and restart the scan.
4. Terminate when no pairwise swap yields a reduction (local optimum reached).

---

## Empirical Benchmark Results

Measured on the running system using `backend/run_benchmarks.py` with $|V| = 24$, $|E| = 83$:

### Dijkstra Shortest Path Engine
- Minimum latency: 2.172 ms
- Average latency: 3.285 ms
- 50th percentile (p50): 3.025 ms
- 95th percentile (p95): 4.101 ms

### Delivery Run Factorial Growth Comparison

| Stops ($k$) | Candidate Permutations ($k!$) | Fast Heuristic (ms) | Exact Method (ms) | Optimality Gap (%) |
|---|---|---|---|---|
| 4 | 24 | 0.040 ms | 0.031 ms | 5.00% |
| 5 | 120 | 0.035 ms | 0.114 ms | 5.00% |
| 6 | 720 | 0.043 ms | 0.690 ms | 5.00% |
| 7 | 5,040 | 0.044 ms | 6.103 ms | 0.00% |
| 8 | 40,320 | 0.107 ms | 49.116 ms | 0.00% |

The empirical results validate the theoretical curves: the Exact method displays factorial runtime growth $\mathcal{O}(k!)$, increasing by roughly $8\times$ between 7 and 8 stops, while the Fast method remains flat under 0.11 ms.

---

## Test Coverage

- Unit tests (`backend/tests/test_dijkstra.py`): Graph construction, direct paths, multi-hop shortest paths, disconnected graphs, priority queue ordering, and edge deactivations.
- Delivery run tests (`backend/tests/test_delivery_run.py`): Matrix symmetry/asymmetry, nearest neighbour tour validity, 2-Opt improvement assertions, exact vs. heuristic gap, and sub-second execution.
- End-to-end browser tests (`frontend/e2e/route_planning.spec.ts`, `frontend/e2e/delivery_run.spec.ts`): Verification of route calculation, multi-stop visiting order selection, map polyline updates, and role-based access restrictions.

---

## Limitations

1. Non-negative weight requirement: Dijkstra's algorithm cannot handle negative edge weights. In physical road networks, distances are strictly positive, so this is not a practical issue.
2. Static edge costs: Road distances and estimated travel times are static and do not adapt to real-time traffic congestion or road closures.
3. Scalability of exact TSP: The exact method is bounded to $k \le 8$ stops. Beyond 8 stops, factorial growth renders exhaustive evaluation prohibitive.
4. Planar projection assumption: Distance calculations assume Euclidean or equirectangular geometry suitable for local metropolitan hubs rather than continental routing.

---

## Viva Questions and Answers

### 1. Why is Dijkstra's algorithm chosen over Bellman-Ford for single-source shortest paths?
Dijkstra's algorithm runs in $\mathcal{O}((V + E) \log V)$ using a binary min-heap, whereas Bellman-Ford runs in $\mathcal{O}(V \cdot E)$. Since road distances are strictly positive, Bellman-Ford's ability to handle negative weights is unnecessary, making Dijkstra substantially faster.

### 2. What data structure implements the priority queue in Dijkstra, and what are its operation costs?
A binary min-heap via Python's `heapq` module. Extracting the minimum-distance vertex takes $\mathcal{O}(\log V)$, and inserting relaxed neighbours takes $\mathcal{O}(\log V)$.

### 3. Why does Dijkstra's algorithm fail if a graph contains negative edge weights?
Dijkstra permanently marks a vertex as visited when extracted from the heap, assuming its distance is finalized. A negative edge encountered later could provide a shorter path to an already-visited vertex, which Dijkstra will not revisit.

### 4. Why is multi-stop delivery run optimization NP-hard?
The problem reduces directly to the Travelling Salesperson Problem (TSP). Finding an ordering that minimizes total tour cost requires exploring an exponentially growing permutation space with no known polynomial-time exact algorithm.

### 5. What is the difference between the Exact and Fast methods in the delivery run solver?
The Exact method evaluates all $(k-1)!$ stop permutations to guarantee the absolute minimum distance. The Fast method constructs a greedy tour via Nearest Neighbour and refines it with 2-Opt edge swaps in $\mathcal{O}(k^2)$ time.

### 6. How does the 2-Opt algorithm improve an initial tour?
2-Opt examines pairs of non-adjacent edges in the tour. If replacing those two edges with crossed alternative edges reduces the total distance, the intermediate tour segment is reversed. This process repeats until no further distance reduction is possible.

### 7. How is the distance matrix built before solving TSP?
By executing Dijkstra's algorithm once from each unique stop in the tour: `distances_from(nodes, edges, source)`. For $k$ stops, $k$ Dijkstra runs yield all pairwise road distances and path predecessor maps in $\mathcal{O}(k \cdot (V + E) \log V)$.

### 8. What is the total time complexity of the delivery run calculation?
Constructing the $k \times k$ distance matrix takes $\mathcal{O}(k \cdot (V + E) \log V)$. Solving TSP takes $\mathcal{O}(k^2)$ for the Fast heuristic or $\mathcal{O}(k! \cdot k)$ for the Exact method. Reconstructing the full road path takes $\mathcal{O}(k \cdot V)$.
