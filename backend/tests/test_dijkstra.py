import json
import pytest
from app import create_app
from app.extensions import db
from app.models import Location, Road, RouteRun
from app.services.dijkstra import DijkstraRouter

@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    with app.app_context():
        from flask_jwt_extended import create_access_token
        from app.models import User
        disp = User.query.filter_by(role='DISPATCHER').first()
        disp_id = str(disp.id) if disp else "2"
        token = create_access_token(identity=disp_id, additional_claims={"role": "DISPATCHER", "email": "dispatcher@smartroute.pro"})
    c = app.test_client()
    c.environ_base['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    return c

@pytest.fixture
def sample_graph_data():
    """Build in-memory graph representation for pure algorithm unit tests."""
    nodes = [
        {"id": 1, "name": "Hub A"},
        {"id": 2, "name": "Hub B"},
        {"id": 3, "name": "Hub C"},
        {"id": 4, "name": "Hub D"},
        {"id": 5, "name": "Isolated Hub E"}
    ]
    edges = [
        {"source_location_id": 1, "destination_location_id": 2, "distance_km": 4.0, "is_active": True},
        {"source_location_id": 1, "destination_location_id": 3, "distance_km": 2.0, "is_active": True},
        {"source_location_id": 3, "destination_location_id": 2, "distance_km": 1.5, "is_active": True},
        {"source_location_id": 2, "destination_location_id": 4, "distance_km": 5.0, "is_active": True},
        {"source_location_id": 3, "destination_location_id": 4, "distance_km": 8.0, "is_active": True},
        {"source_location_id": 4, "destination_location_id": 5, "distance_km": 10.0, "is_active": False} # Inactive road
    ]
    return nodes, edges

# 1. Simple connected graph test
def test_1_simple_connected_graph():
    nodes = [{"id": 1, "name": "A"}, {"id": 2, "name": "B"}]
    edges = [{"source_location_id": 1, "destination_location_id": 2, "distance_km": 5.5, "is_active": True}]
    result = DijkstraRouter.solve(nodes, edges, source_id=1, destination_id=2)
    assert result["has_route"] is True
    assert result["total_distance_km"] == 5.5
    assert result["path"] == [1, 2]

# 2 & 3. Multiple possible routes and shortest path selection
def test_2_and_3_multiple_routes_and_shortest_path_selection(sample_graph_data):
    nodes, edges = sample_graph_data
    # From 1 to 4:
    # Route 1: 1 -> 2 -> 4 = 4.0 + 5.0 = 9.0
    # Route 2: 1 -> 3 -> 2 -> 4 = 2.0 + 1.5 + 5.0 = 8.5 (SHORTEST)
    # Route 3: 1 -> 3 -> 4 = 2.0 + 8.0 = 10.0
    result = DijkstraRouter.solve(nodes, edges, source_id=1, destination_id=4)
    assert result["has_route"] is True
    assert result["total_distance_km"] == 8.5
    assert result["path"] == [1, 3, 2, 4]

# 4. Source equals destination
def test_4_source_equals_destination(sample_graph_data):
    nodes, edges = sample_graph_data
    result = DijkstraRouter.solve(nodes, edges, source_id=2, destination_id=2)
    assert result["has_route"] is True
    assert result["total_distance_km"] == 0.0
    assert result["path"] == [2]
    assert result["visited_nodes_count"] == 1

# 5. Disconnected destination
def test_5_disconnected_destination(sample_graph_data):
    nodes, edges = sample_graph_data
    # Hub 5 is only connected via an inactive road
    result = DijkstraRouter.solve(nodes, edges, source_id=1, destination_id=5)
    assert result["has_route"] is False
    assert result["total_distance_km"] is None
    assert result["path"] == []

# 6. Invalid source ID
def test_6_invalid_source_id(sample_graph_data):
    nodes, edges = sample_graph_data
    with pytest.raises(ValueError) as exc:
        DijkstraRouter.solve(nodes, edges, source_id=999, destination_id=2)
    assert "Source location ID 999 not found" in str(exc.value)

# 7. Invalid destination ID
def test_7_invalid_destination_id(sample_graph_data):
    nodes, edges = sample_graph_data
    with pytest.raises(ValueError) as exc:
        DijkstraRouter.solve(nodes, edges, source_id=1, destination_id=888)
    assert "Destination location ID 888 not found" in str(exc.value)

# 8. Zero or negative weights rejection
def test_8_zero_or_negative_weights():
    nodes = [{"id": 1, "name": "A"}, {"id": 2, "name": "B"}]
    negative_edges = [{"source_location_id": 1, "destination_location_id": 2, "distance_km": -3.0, "is_active": True}]
    with pytest.raises(ValueError) as exc1:
        DijkstraRouter.solve(nodes, negative_edges, source_id=1, destination_id=2)
    assert "Invalid edge weight" in str(exc1.value)

    zero_edges = [{"source_location_id": 1, "destination_location_id": 2, "distance_km": 0.0, "is_active": True}]
    with pytest.raises(ValueError) as exc2:
        DijkstraRouter.solve(nodes, zero_edges, source_id=1, destination_id=2)
    assert "Invalid edge weight" in str(exc2.value)

# 9. Directed road behavior
def test_9_directed_road_behavior(sample_graph_data):
    nodes, edges = sample_graph_data
    # Road exists 1 -> 2, but no road exists 4 -> 1
    result = DijkstraRouter.solve(nodes, edges, source_id=4, destination_id=1)
    assert result["has_route"] is False
    assert result["path"] == []

# 10. Inactive road exclusion
def test_10_inactive_road_exclusion():
    nodes = [{"id": 1, "name": "A"}, {"id": 2, "name": "B"}]
    edges = [{"source_location_id": 1, "destination_location_id": 2, "distance_km": 4.0, "is_active": False}]
    result = DijkstraRouter.solve(nodes, edges, source_id=1, destination_id=2)
    assert result["has_route"] is False
    assert result["path"] == []

# 11. Correct predecessor reconstruction
def test_11_predecessor_reconstruction(sample_graph_data):
    nodes, edges = sample_graph_data
    result = DijkstraRouter.solve(nodes, edges, source_id=1, destination_id=4, include_steps=True)
    assert result["path"] == [1, 3, 2, 4]
    # Check trace has PATH_RECONSTRUCTED
    actions = [s["action"] for s in result["trace"]]
    assert "PATH_RECONSTRUCTED" in actions
    final_step = result["trace"][-1]
    assert final_step["final_path"] == [1, 3, 2, 4]

# 12. Priority queue stale entries handling
def test_12_priority_queue_stale_entries():
    # Construct diamond where shorter path arrives later in heap
    nodes = [{"id": 1}, {"id": 2}, {"id": 3}, {"id": 4}]
    edges = [
        {"source_location_id": 1, "destination_location_id": 2, "distance_km": 10.0, "is_active": True},
        {"source_location_id": 1, "destination_location_id": 3, "distance_km": 1.0, "is_active": True},
        {"source_location_id": 3, "destination_location_id": 2, "distance_km": 2.0, "is_active": True},
        {"source_location_id": 2, "destination_location_id": 4, "distance_km": 1.0, "is_active": True}
    ]
    # Node 2 first receives tentative distance 10.0, then relaxed to 3.0 via node 3
    result = DijkstraRouter.solve(nodes, edges, source_id=1, destination_id=4, include_steps=True)
    assert result["has_route"] is True
    assert result["total_distance_km"] == 4.0
    assert result["path"] == [1, 3, 2, 4]
    actions = [s["action"] for s in result["trace"]]
    assert "SELECT_MIN_NODE" in actions

# 13. Route API validation
def test_13_route_api_validation(client):
    # Missing body
    res = client.post('/api/routes/shortest-path', json={})
    assert res.status_code == 400

    # Non-integer IDs
    res = client.post('/api/routes/shortest-path', json={"source_location_id": "abc", "destination_location_id": 2})
    assert res.status_code == 400

    # Non-existent locations
    res = client.post('/api/routes/shortest-path', json={"source_location_id": 999, "destination_location_id": 888})
    assert res.status_code == 404

# 14. Route history persistence
def test_14_route_history_persistence(client):
    # Create test locations and roads in DB
    loc1 = Location(name="Depot Alpha", address="Alpha Street", latitude=37.77, longitude=-122.41)
    loc2 = Location(name="Waypoint Beta", address="Beta Road", latitude=37.78, longitude=-122.42)
    db.session.add_all([loc1, loc2])
    db.session.commit()

    road = Road(source_location_id=loc1.id, destination_location_id=loc2.id, distance_km=7.2, estimated_duration_minutes=15.0, is_active=True)
    db.session.add(road)
    db.session.commit()

    res = client.post('/api/routes/shortest-path', json={
        "source_location_id": loc1.id,
        "destination_location_id": loc2.id,
        "include_steps": True
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["has_route"] is True
    assert data["route_run_id"] is not None

    # Check /api/routes/history
    hist_res = client.get('/api/routes/history')
    assert hist_res.status_code == 200
    hist_data = hist_res.get_json()
    assert hist_data["total"] >= 1
    assert hist_data["routes"][0]["id"] == data["route_run_id"]

    # Check /api/routes/history/:id
    single_res = client.get(f'/api/routes/history/{data["route_run_id"]}')
    assert single_res.status_code == 200
    single_data = single_res.get_json()["route"]
    assert single_data["algorithm"] == "Dijkstra"
    assert single_data["total_distance_km"] == 7.2

# 15. Algorithm trace consistency
def test_15_algorithm_trace_consistency(sample_graph_data):
    nodes, edges = sample_graph_data
    result = DijkstraRouter.solve(nodes, edges, source_id=1, destination_id=4, include_steps=True)
    trace = result["trace"]
    assert trace is not None
    assert len(trace) > 0

    # Ensure each step has the required schema
    for step in trace:
        assert "step" in step
        assert "action" in step
        assert "pq_snapshot" in step
        assert "visited_nodes" in step
        assert "distances" in step
        assert "description" in step

# 16. Yen's K-Shortest Loopless Paths Algorithm Test
def test_16_yen_k_shortest_paths_alternatives(sample_graph_data):
    nodes, edges = sample_graph_data
    # 1 -> 4 has 3 distinct paths:
    # 1 -> 3 -> 2 -> 4 = 8.5 km
    # 1 -> 2 -> 4 = 9.0 km
    # 1 -> 3 -> 4 = 10.0 km
    k_res = DijkstraRouter.solve_k_shortest_paths(nodes, edges, source_id=1, destination_id=4, k=3)
    assert k_res["has_route"] is True
    assert k_res["total_distance_km"] == 8.5
    assert len(k_res["routes"]) == 3

    # Route 1: Shortest
    r1 = k_res["routes"][0]
    assert r1["route_index"] == 1
    assert r1["is_primary"] is True
    assert r1["path"] == [1, 3, 2, 4]
    assert r1["total_distance_km"] == 8.5

    # Route 2: Alternative 1
    r2 = k_res["routes"][1]
    assert r2["route_index"] == 2
    assert r2["is_primary"] is False
    assert r2["path"] == [1, 2, 4]
    assert r2["total_distance_km"] == 9.0

    # Route 3: Alternative 2
    r3 = k_res["routes"][2]
    assert r3["route_index"] == 3
    assert r3["is_primary"] is False
    assert r3["path"] == [1, 3, 4]
    assert r3["total_distance_km"] == 10.0

# 17. Routes API returns enriched alternative routes array
def test_17_api_returns_alternative_routes(client, app):
    with app.app_context():
        l1 = Location(name="Alpha Hub", address="A1", latitude=37.77, longitude=-122.42)
        l2 = Location(name="Beta Hub", address="B1", latitude=37.78, longitude=-122.41)
        l3 = Location(name="Gamma Hub", address="C1", latitude=37.76, longitude=-122.43)
        l4 = Location(name="Delta Hub", address="D1", latitude=37.79, longitude=-122.40)
        db.session.add_all([l1, l2, l3, l4])
        db.session.commit()

        # Route 1: l1 -> l2 -> l4 = 5.0 + 4.0 = 9.0
        # Route 2: l1 -> l3 -> l4 = 3.0 + 7.0 = 10.0
        r1 = Road(source_location_id=l1.id, destination_location_id=l2.id, distance_km=5.0, estimated_duration_minutes=10.0)
        r2 = Road(source_location_id=l2.id, destination_location_id=l4.id, distance_km=4.0, estimated_duration_minutes=8.0)
        r3 = Road(source_location_id=l1.id, destination_location_id=l3.id, distance_km=3.0, estimated_duration_minutes=6.0)
        r4 = Road(source_location_id=l3.id, destination_location_id=l4.id, distance_km=7.0, estimated_duration_minutes=14.0)
        db.session.add_all([r1, r2, r3, r4])
        db.session.commit()

        req_body = {
            "source_location_id": l1.id,
            "destination_location_id": l4.id
        }
        res = client.post('/api/routes/shortest-path', json=req_body)
        assert res.status_code == 200
        data = res.get_json()
        assert data["has_route"] is True
        assert "routes" in data
        assert len(data["routes"]) == 2
        assert data["routes"][0]["is_primary"] is True
        assert data["routes"][0]["total_distance_km"] == 9.0
        assert data["routes"][1]["is_primary"] is False
        assert data["routes"][1]["total_distance_km"] == 10.0
        assert len(data["routes"][0]["path_nodes"]) == 3

