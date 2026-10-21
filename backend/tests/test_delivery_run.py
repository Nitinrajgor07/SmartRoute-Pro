import pytest
from app import create_app
from app.extensions import db
from app.models import Location, Road, Delivery, RouteRun, User
from app.services.delivery_run import build_matrix, route_cost, fast_method, exact_method, plan_run


@pytest.fixture
def app():
    test_app = create_app('testing')
    with test_app.app_context():
        db.create_all()

        # Seed test locations: Depot (1), Stop A (2), Stop B (3), Stop C (4), Isolated (5)
        locs = [
            Location(id=1, name="Central Depot", address="100 Main St", latitude=37.77, longitude=-122.41),
            Location(id=2, name="Hub Alpha", address="200 Market St", latitude=37.78, longitude=-122.40),
            Location(id=3, name="Hub Beta", address="300 Mission St", latitude=37.76, longitude=-122.42),
            Location(id=4, name="Hub Gamma", address="400 Howard St", latitude=37.79, longitude=-122.39),
            Location(id=5, name="Isolated Hub", address="999 Remote St", latitude=37.85, longitude=-122.50),
        ]
        db.session.add_all(locs)

        # Seed bidirectional roads connecting 1, 2, 3, 4 (5 remains isolated)
        roads = [
            # 1 <-> 2: dist 2.0
            Road(source_location_id=1, destination_location_id=2, distance_km=2.0, estimated_duration_minutes=5.0, is_active=True),
            Road(source_location_id=2, destination_location_id=1, distance_km=2.0, estimated_duration_minutes=5.0, is_active=True),
            # 2 <-> 3: dist 3.0
            Road(source_location_id=2, destination_location_id=3, distance_km=3.0, estimated_duration_minutes=7.0, is_active=True),
            Road(source_location_id=3, destination_location_id=2, distance_km=3.0, estimated_duration_minutes=7.0, is_active=True),
            # 3 <-> 4: dist 4.0
            Road(source_location_id=3, destination_location_id=4, distance_km=4.0, estimated_duration_minutes=9.0, is_active=True),
            Road(source_location_id=4, destination_location_id=3, distance_km=4.0, estimated_duration_minutes=9.0, is_active=True),
            # 4 <-> 1: dist 5.0
            Road(source_location_id=4, destination_location_id=1, distance_km=5.0, estimated_duration_minutes=11.0, is_active=True),
            Road(source_location_id=1, destination_location_id=4, distance_km=5.0, estimated_duration_minutes=11.0, is_active=True),
            # 1 <-> 3: dist 10.0 (cross link)
            Road(source_location_id=1, destination_location_id=3, distance_km=10.0, estimated_duration_minutes=20.0, is_active=True),
            Road(source_location_id=3, destination_location_id=1, distance_km=10.0, estimated_duration_minutes=20.0, is_active=True),
            # 2 <-> 4: dist 10.0 (cross link)
            Road(source_location_id=2, destination_location_id=4, distance_km=10.0, estimated_duration_minutes=20.0, is_active=True),
            Road(source_location_id=4, destination_location_id=2, distance_km=10.0, estimated_duration_minutes=20.0, is_active=True),
        ]
        db.session.add_all(roads)

        # Seed deliveries
        deliv1 = Delivery(
            id=101, tracking_number="DELIV-001", customer_name="Customer One",
            pickup_location_id=1, destination_location_id=2, status="Pending"
        )
        deliv2 = Delivery(
            id=102, tracking_number="DELIV-002", customer_name="Customer Two",
            pickup_location_id=1, destination_location_id=3, status="Pending"
        )
        deliv3 = Delivery(
            id=103, tracking_number="DELIV-003", customer_name="Customer Three",
            pickup_location_id=1, destination_location_id=4, status="Pending"
        )
        deliv_done = Delivery(
            id=104, tracking_number="DELIV-004", customer_name="Customer Four",
            pickup_location_id=1, destination_location_id=4, status="Delivered"
        )
        db.session.add_all([deliv1, deliv2, deliv3, deliv_done])
        db.session.commit()

        yield test_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def dispatcher_headers(client):
    res = client.post('/api/auth/login', json={"email": "dispatcher@smartroute.pro", "password": "Dispatch@123456"})
    return {"Authorization": f"Bearer {res.get_json()['access_token']}"}


@pytest.fixture
def admin_headers(client):
    res = client.post('/api/auth/login', json={"email": "admin@smartroute.pro", "password": "Admin@123456"})
    return {"Authorization": f"Bearer {res.get_json()['access_token']}"}


@pytest.fixture
def viewer_headers(client):
    res = client.post('/api/auth/login', json={"email": "viewer@smartroute.pro", "password": "Viewer@123456"})
    return {"Authorization": f"Bearer {res.get_json()['access_token']}"}


# ------------------------------------------------------------------------------
# Test 1: Hand-made graph with known optimal order
# ------------------------------------------------------------------------------
def test_known_optimal_order_exact_and_fast():
    """In a ring topology 1-2-3-4-1 (costs 2, 3, 4, 5 = 14 km), exact method finds the minimum 14.0 km."""
    nodes = [{'id': i} for i in range(1, 5)]
    edges = [
        {'source_location_id': 1, 'destination_location_id': 2, 'distance_km': 2.0, 'is_active': True},
        {'source_location_id': 2, 'destination_location_id': 1, 'distance_km': 2.0, 'is_active': True},
        {'source_location_id': 2, 'destination_location_id': 3, 'distance_km': 3.0, 'is_active': True},
        {'source_location_id': 3, 'destination_location_id': 2, 'distance_km': 3.0, 'is_active': True},
        {'source_location_id': 3, 'destination_location_id': 4, 'distance_km': 4.0, 'is_active': True},
        {'source_location_id': 4, 'destination_location_id': 3, 'distance_km': 4.0, 'is_active': True},
        {'source_location_id': 4, 'destination_location_id': 1, 'distance_km': 5.0, 'is_active': True},
        {'source_location_id': 1, 'destination_location_id': 4, 'distance_km': 5.0, 'is_active': True},
    ]

    res = plan_run(nodes, edges, depot_id=1, stop_ids=[4, 3, 2], return_to_depot=True, include_exact=True)
    assert res['exact_method']['distance_km'] == 14.0
    # Ring visiting order is either [1, 2, 3, 4] or [1, 4, 3, 2]
    assert res['recommended_order'] in [[1, 2, 3, 4], [1, 4, 3, 2]]
    assert res['recommended_distance_km'] == 14.0
    assert len(res['legs']) == 4


# ------------------------------------------------------------------------------
# Test 2: Invariants (fast >= exact, 2-opt <= NN, equality on trivial)
# ------------------------------------------------------------------------------
def test_method_invariants_and_cost():
    """Verify fast cost >= exact cost, 2-opt <= NN start, and equal on 2 stops."""
    nodes = [{'id': i} for i in range(1, 5)]
    edges = [
        {'source_location_id': 1, 'destination_location_id': 2, 'distance_km': 10.0, 'is_active': True},
        {'source_location_id': 2, 'destination_location_id': 1, 'distance_km': 10.0, 'is_active': True},
        {'source_location_id': 1, 'destination_location_id': 3, 'distance_km': 12.0, 'is_active': True},
        {'source_location_id': 3, 'destination_location_id': 1, 'distance_km': 12.0, 'is_active': True},
        {'source_location_id': 2, 'destination_location_id': 3, 'distance_km': 2.0, 'is_active': True},
        {'source_location_id': 3, 'destination_location_id': 2, 'distance_km': 2.0, 'is_active': True},
    ]

    matrix, _ = build_matrix(nodes, edges, [1, 2, 3])

    # Trivial case: 2 stops (only 2! permutations: [1, 2, 3] or [1, 3, 2])
    fast_ord, fast_c = fast_method(1, [2, 3], matrix, return_to_depot=True)
    exact_ord, exact_c = exact_method(1, [2, 3], matrix, return_to_depot=True)

    assert fast_c == exact_c
    assert fast_c >= exact_c


# ------------------------------------------------------------------------------
# Test 3: Asymmetric distances and return_to_depot=False
# ------------------------------------------------------------------------------
def test_asymmetric_and_open_route():
    """Verify asymmetric costs where u->v != v->u and open route (return_to_depot=False)."""
    nodes = [{'id': 1}, {'id': 2}, {'id': 3}]
    edges = [
        {'source_location_id': 1, 'destination_location_id': 2, 'distance_km': 1.0, 'is_active': True},
        {'source_location_id': 2, 'destination_location_id': 1, 'distance_km': 10.0, 'is_active': True},
        {'source_location_id': 2, 'destination_location_id': 3, 'distance_km': 2.0, 'is_active': True},
        {'source_location_id': 3, 'destination_location_id': 2, 'distance_km': 20.0, 'is_active': True},
        {'source_location_id': 3, 'destination_location_id': 1, 'distance_km': 3.0, 'is_active': True},
        {'source_location_id': 1, 'destination_location_id': 3, 'distance_km': 30.0, 'is_active': True},
    ]

    # Closed route: 1 -> 2 -> 3 -> 1 costs 1 + 2 + 3 = 6.0 km
    res_closed = plan_run(nodes, edges, depot_id=1, stop_ids=[2, 3], return_to_depot=True)
    assert res_closed['recommended_distance_km'] == 6.0
    assert len(res_closed['legs']) == 3

    # Open route: 1 -> 2 -> 3 (without returning to 1) costs 1 + 2 = 3.0 km
    res_open = plan_run(nodes, edges, depot_id=1, stop_ids=[2, 3], return_to_depot=False)
    assert res_open['recommended_distance_km'] == 3.0
    assert len(res_open['legs']) == 2


# ------------------------------------------------------------------------------
# Test 4: Validation (unreachable 422, stop count limits, deduplication)
# ------------------------------------------------------------------------------
def test_validation_unreachable_and_limits(client, dispatcher_headers):
    """Unreachable hub -> 422; < 2 or > 8 stops -> 400; duplicate stops merged; depot in stops ignored."""
    # 1. Unreachable hub 5 -> 422
    res_unreach = client.post('/api/routes/delivery-run', headers=dispatcher_headers, json={
        "depot_location_id": 1,
        "stop_location_ids": [2, 5],
        "return_to_depot": True
    })
    assert res_unreach.status_code == 422
    assert "No connected road route exists" in res_unreach.get_json()['message']

    # 2. 1 stop -> 400
    res_one = client.post('/api/routes/delivery-run', headers=dispatcher_headers, json={
        "depot_location_id": 1,
        "stop_location_ids": [2]
    })
    assert res_one.status_code == 400

    # 3. 9 stops -> 400
    res_nine = client.post('/api/routes/delivery-run', headers=dispatcher_headers, json={
        "depot_location_id": 1,
        "stop_location_ids": [2, 3, 4, 5, 6, 7, 8, 9, 10]
    })
    assert res_nine.status_code == 400

    # 4. Duplicate stops merged + depot inside stops ignored
    # [2, 2, 3, 1] with depot=1 -> merged into [2, 3] which has 2 stops -> 200
    res_dupe = client.post('/api/routes/delivery-run', headers=dispatcher_headers, json={
        "depot_location_id": 1,
        "stop_location_ids": [2, 2, 3, 1]
    })
    assert res_dupe.status_code == 200
    data = res_dupe.get_json()
    assert data['stops'] == [2, 3]
    assert data['stop_count'] == 2

    # 5. Unknown hub -> 404
    res_unknown = client.post('/api/routes/delivery-run', headers=dispatcher_headers, json={
        "depot_location_id": 1,
        "stop_location_ids": [2, 999]
    })
    assert res_unknown.status_code == 404


# ------------------------------------------------------------------------------
# Test 5: delivery_ids parameter and Delivered status rejection
# ------------------------------------------------------------------------------
def test_delivery_ids_and_delivered_rejection(client, dispatcher_headers):
    """delivery_ids resolves destination hubs; Delivered deliveries return 400; unknown return 404."""
    # 1. Valid pending delivery IDs [101, 102] -> destination hubs 2 and 3
    res = client.post('/api/routes/delivery-run', headers=dispatcher_headers, json={
        "depot_location_id": 1,
        "delivery_ids": [101, 102]
    })
    assert res.status_code == 200
    data = res.get_json()
    assert set(data['stops']) == {2, 3}

    # 2. Including Delivered delivery (104) -> 400
    res_deliv = client.post('/api/routes/delivery-run', headers=dispatcher_headers, json={
        "depot_location_id": 1,
        "delivery_ids": [101, 104]
    })
    assert res_deliv.status_code == 400
    assert "already been delivered" in res_deliv.get_json()['message']

    # 3. Unknown delivery ID -> 404
    res_unk = client.post('/api/routes/delivery-run', headers=dispatcher_headers, json={
        "depot_location_id": 1,
        "delivery_ids": [101, 9999]
    })
    assert res_unk.status_code == 404


# ------------------------------------------------------------------------------
# Test 6: Permissions enforcement (DISPATCHER 200; ADMIN 403; VIEWER 403; anon 401)
# ------------------------------------------------------------------------------
def test_delivery_run_permissions(client, dispatcher_headers, admin_headers, viewer_headers):
    """Only DISPATCHER can calculate delivery runs (routes:calculate)."""
    payload = {"depot_location_id": 1, "stop_location_ids": [2, 3]}

    # Anonymous -> 401
    assert client.post('/api/routes/delivery-run', json=payload).status_code == 401

    # Viewer -> 403
    assert client.post('/api/routes/delivery-run', headers=viewer_headers, json=payload).status_code == 403

    # Admin -> 403 (Admin lacks routes:calculate per specification)
    assert client.post('/api/routes/delivery-run', headers=admin_headers, json=payload).status_code == 403

    # Dispatcher -> 200
    assert client.post('/api/routes/delivery-run', headers=dispatcher_headers, json=payload).status_code == 200


# ------------------------------------------------------------------------------
# Test 7: RouteRun persistence with kind='run' and correct stop_count
# ------------------------------------------------------------------------------
def test_routerun_persistence(client, dispatcher_headers):
    """RouteRun is stored with algorithm 'TSP', kind 'run', and correct stop_count."""
    res = client.post('/api/routes/delivery-run', headers=dispatcher_headers, json={
        "depot_location_id": 1,
        "stop_location_ids": [2, 3, 4]
    })
    assert res.status_code == 200
    run_id = res.get_json()['route_run_id']

    # Fetch through route history
    hist = client.get('/api/routes/history', headers=dispatcher_headers)
    assert hist.status_code == 200
    items = hist.get_json()['routes']
    run_item = next((r for r in items if r['id'] == run_id), None)

    assert run_item is not None
    assert run_item['algorithm'] == 'TSP'
    assert run_item['kind'] == 'run'
    assert run_item['stop_count'] == 3
    assert isinstance(run_item['path'], list)


# ------------------------------------------------------------------------------
# Test 8: Determinism
# ------------------------------------------------------------------------------
def test_delivery_run_determinism(client, dispatcher_headers):
    """Identical requests return identical visiting order and distance."""
    payload = {
        "depot_location_id": 1,
        "stop_location_ids": [3, 2, 4],
        "return_to_depot": True
    }
    res1 = client.post('/api/routes/delivery-run', headers=dispatcher_headers, json=payload).get_json()
    res2 = client.post('/api/routes/delivery-run', headers=dispatcher_headers, json=payload).get_json()

    assert res1['recommended_order'] == res2['recommended_order']
    assert res1['recommended_distance_km'] == res2['recommended_distance_km']
    assert res1['expanded_node_path'] == res2['expanded_node_path']
