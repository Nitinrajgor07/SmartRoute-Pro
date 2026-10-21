import pytest
from app import create_app
from app.extensions import db
from app.models import Location, Road, Delivery, User


@pytest.fixture
def app():
    test_app = create_app('testing')
    with test_app.app_context():
        db.create_all()

        # Seed test locations: Central Depot (1), Hub Alpha (2), Hub Beta (3), Hub Gamma (4)
        locs = [
            Location(id=1, name="Central Depot", address="100 Main St", latitude=37.77, longitude=-122.41),
            Location(id=2, name="Hub Alpha", address="200 Market St", latitude=37.78, longitude=-122.40),
            Location(id=3, name="Hub Beta", address="300 Mission St", latitude=37.76, longitude=-122.42),
            Location(id=4, name="Hub Gamma", address="400 Howard St", latitude=37.79, longitude=-122.39),
        ]
        db.session.add_all(locs)

        # Seed bidirectional roads connecting 1, 2, 3, 4
        roads = [
            Road(source_location_id=1, destination_location_id=2, distance_km=2.0, estimated_duration_minutes=5.0, is_active=True),
            Road(source_location_id=2, destination_location_id=1, distance_km=2.0, estimated_duration_minutes=5.0, is_active=True),
            Road(source_location_id=2, destination_location_id=3, distance_km=3.0, estimated_duration_minutes=7.0, is_active=True),
            Road(source_location_id=3, destination_location_id=2, distance_km=3.0, estimated_duration_minutes=7.0, is_active=True),
            Road(source_location_id=3, destination_location_id=4, distance_km=4.0, estimated_duration_minutes=9.0, is_active=True),
            Road(source_location_id=4, destination_location_id=3, distance_km=4.0, estimated_duration_minutes=9.0, is_active=True),
            Road(source_location_id=4, destination_location_id=1, distance_km=5.0, estimated_duration_minutes=11.0, is_active=True),
            Road(source_location_id=1, destination_location_id=4, distance_km=5.0, estimated_duration_minutes=11.0, is_active=True),
        ]
        db.session.add_all(roads)

        # Seed deliveries including one belonging to viewer
        deliv1 = Delivery(
            id=201, tracking_number="DEL-UPGRADE-01", customer_name="Viewer User",
            customer_email="viewer@smartroute.pro",
            pickup_location_id=1, destination_location_id=2, status="Pending"
        )
        deliv2 = Delivery(
            id=202, tracking_number="DEL-UPGRADE-02", customer_name="Customer Two",
            customer_email="two@example.com",
            pickup_location_id=1, destination_location_id=3, status="Pending"
        )
        deliv3 = Delivery(
            id=203, tracking_number="DEL-UPGRADE-03", customer_name="Customer Three",
            customer_email="three@example.com",
            pickup_location_id=1, destination_location_id=4, status="Pending"
        )
        deliv_delivered = Delivery(
            id=204, tracking_number="DEL-UPGRADE-04", customer_name="Customer Four",
            customer_email="four@example.com",
            pickup_location_id=1, destination_location_id=4, status="Delivered"
        )
        # Extra deliveries for 8+ check
        extra_delivs = [
            Delivery(
                id=205 + i, tracking_number=f"DEL-EXTRA-{i}", customer_name=f"Customer {i}",
                pickup_location_id=1, destination_location_id=2, status="Pending"
            )
            for i in range(8)
        ]
        db.session.add_all([deliv1, deliv2, deliv3, deliv_delivered] + extra_delivs)
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


def test_arrival_offsets_min_strictly_increasing(client, dispatcher_headers):
    """arrival_offsets_min are strictly increasing and the last one equals total driving minutes plus service minutes."""
    res = client.post('/api/routes/delivery-run', json={
        "depot_location_id": 1,
        "stop_location_ids": [2, 3],
        "return_to_depot": True
    }, headers=dispatcher_headers)
    assert res.status_code == 200
    data = res.get_json()

    assert data.get('service_minutes_per_stop') == 5
    offsets = data.get('arrival_offsets_min')
    assert isinstance(offsets, list)
    assert len(offsets) == len(data['legs'])

    # Strictly increasing
    for i in range(len(offsets) - 1):
        assert offsets[i] < offsets[i + 1]

    # Total driving minutes across all legs
    total_driving = sum(leg['duration_min'] for leg in data['legs'])
    total_service = data['stop_count'] * 5
    assert offsets[-1] == round(total_driving + total_service, 1)


def test_dispatch_success_updates_status_and_driver(client, dispatcher_headers):
    """dispatch success updates status to 'In Transit' and driver for all deliveries."""
    payload = {
        "delivery_ids": [201, 202],
        "driver_name": "Marcus Vance"
    }
    res = client.post('/api/routes/delivery-run/dispatch', json=payload, headers=dispatcher_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "updated" in data
    assert len(data['updated']) == 2
    for item in data['updated']:
        assert item['status'] == 'In Transit'
        assert item['assigned_driver'] == 'Marcus Vance'

    # Verify directly from database
    with client.application.app_context():
        d1 = db.session.get(Delivery, 201)
        d2 = db.session.get(Delivery, 202)
        assert d1.status == 'In Transit'
        assert d1.assigned_driver == 'Marcus Vance'
        assert d2.status == 'In Transit'
        assert d2.assigned_driver == 'Marcus Vance'


def test_dispatch_one_non_pending_delivery_returns_409(client, dispatcher_headers):
    """one non-Pending delivery -> 409 and no delivery changed."""
    payload = {
        "delivery_ids": [203, 204],  # 204 is 'Delivered'
        "driver_name": "Alex Carter"
    }
    res = client.post('/api/routes/delivery-run/dispatch', json=payload, headers=dispatcher_headers)
    assert res.status_code == 409
    data = res.get_json()
    assert "DEL-UPGRADE-04" in data['message']

    # Verify that delivery 203 was NOT changed (atomic transaction)
    with client.application.app_context():
        d3 = db.session.get(Delivery, 203)
        assert d3.status == 'Pending'
        assert d3.assigned_driver is None


def test_dispatch_unknown_id_returns_404(client, dispatcher_headers):
    """unknown id -> 404."""
    payload = {
        "delivery_ids": [201, 99999],
        "driver_name": "Alex Carter"
    }
    res = client.post('/api/routes/delivery-run/dispatch', json=payload, headers=dispatcher_headers)
    assert res.status_code == 404


def test_dispatch_validation_errors_return_400(client, dispatcher_headers):
    """empty list, more than 8 ids, and a bad driver name -> 400."""
    # Empty list
    res = client.post('/api/routes/delivery-run/dispatch', json={
        "delivery_ids": [],
        "driver_name": "Valid Driver"
    }, headers=dispatcher_headers)
    assert res.status_code == 400

    # More than 8 ids (9 deliveries)
    nine_ids = [205 + i for i in range(9)]
    res = client.post('/api/routes/delivery-run/dispatch', json={
        "delivery_ids": nine_ids,
        "driver_name": "Valid Driver"
    }, headers=dispatcher_headers)
    assert res.status_code == 400

    # Bad driver name (empty or whitespace or single char)
    res = client.post('/api/routes/delivery-run/dispatch', json={
        "delivery_ids": [201],
        "driver_name": " "
    }, headers=dispatcher_headers)
    assert res.status_code == 400

    res = client.post('/api/routes/delivery-run/dispatch', json={
        "delivery_ids": [201],
        "driver_name": "A"
    }, headers=dispatcher_headers)
    assert res.status_code == 400

    # Too long driver name (>100 chars)
    res = client.post('/api/routes/delivery-run/dispatch', json={
        "delivery_ids": [201],
        "driver_name": "A" * 101
    }, headers=dispatcher_headers)
    assert res.status_code == 400


def test_dispatch_roles_permissions(client, admin_headers, viewer_headers, dispatcher_headers):
    """ADMIN, VIEWER and anonymous -> 403/401; DISPATCHER -> 200."""
    payload = {
        "delivery_ids": [202],
        "driver_name": "Sarah Connor"
    }
    # Anonymous -> 401
    res_anon = client.post('/api/routes/delivery-run/dispatch', json=payload)
    assert res_anon.status_code == 401

    # VIEWER -> 403
    res_viewer = client.post('/api/routes/delivery-run/dispatch', json=payload, headers=viewer_headers)
    assert res_viewer.status_code == 403

    # ADMIN -> 403 (deliveries:write is restricted to DISPATCHER)
    res_admin = client.post('/api/routes/delivery-run/dispatch', json=payload, headers=admin_headers)
    assert res_admin.status_code == 403

    # DISPATCHER -> 200
    res_disp = client.post('/api/routes/delivery-run/dispatch', json=payload, headers=dispatcher_headers)
    assert res_disp.status_code == 200


def test_viewer_own_parcels_shows_in_transit_after_dispatch(client, dispatcher_headers, viewer_headers):
    """after dispatch the VIEWER's own-parcels endpoint shows 'In Transit' for a parcel that belongs to that viewer."""
    # Before dispatch: deliv 201 belongs to viewer@smartroute.pro and is Pending
    res_before = client.get('/api/my/parcels', headers=viewer_headers)
    assert res_before.status_code == 200
    parcels_before = res_before.get_json()['parcels']
    my_p1 = next((p for p in parcels_before if p['tracking_number'] == 'DEL-UPGRADE-01'), None)
    assert my_p1 is not None
    assert my_p1['status'] == 'Pending'

    # Dispatch via DISPATCHER
    disp_res = client.post('/api/routes/delivery-run/dispatch', json={
        "delivery_ids": [201],
        "driver_name": "Officer Friendly"
    }, headers=dispatcher_headers)
    assert disp_res.status_code == 200

    # After dispatch: VIEWER calls own parcels
    res_after = client.get('/api/my/parcels', headers=viewer_headers)
    assert res_after.status_code == 200
    parcels_after = res_after.get_json()['parcels']
    my_p1_after = next((p for p in parcels_after if p['tracking_number'] == 'DEL-UPGRADE-01'), None)
    assert my_p1_after is not None
    assert my_p1_after['status'] == 'In Transit'
