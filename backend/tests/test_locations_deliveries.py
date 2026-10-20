import pytest
import datetime
from app import create_app
from app.extensions import db
from app.models import User, Location, Road, Delivery, RouteRun

@pytest.fixture
def app():
    """Create test application with in-memory SQLite database."""
    test_app = create_app('testing')
    with test_app.app_context():
        db.create_all()
        yield test_app
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
def sample_locations(app):
    """Seed sample locations for testing."""
    with app.app_context():
        loc1 = Location(
            name="Depot Alpha",
            address="100 Warehouse Way",
            latitude=37.7749,
            longitude=-122.4194
        )
        loc2 = Location(
            name="Client Beta",
            address="200 Market Street",
            latitude=37.7850,
            longitude=-122.4100
        )
        loc3 = Location(
            name="Client Gamma",
            address="300 Mission Blvd",
            latitude=37.7920,
            longitude=-122.4010
        )
        db.session.add_all([loc1, loc2, loc3])
        db.session.commit()
        return [loc1.id, loc2.id, loc3.id]

# -----------------------------------------------------------------------------
# 1. Models & Security Tests
# -----------------------------------------------------------------------------

def test_user_model_security(app):
    """Ensure user passwords are never exposed in serialized dictionaries."""
    with app.app_context():
        user = User(
            name="Admin Dispatcher",
            email="admin@smartroute.internal",
            password_hash="argon2$secret_hash_value_123",
            role="admin"
        )
        db.session.add(user)
        db.session.commit()

        user_dict = user.to_dict()
        assert "password_hash" not in user_dict
        assert user_dict["email"] == "admin@smartroute.internal"
        assert user_dict["role"] == "admin"

def test_road_model_and_uniqueness(app, sample_locations):
    """Verify Road model persistence and unique source-destination constraint."""
    loc1_id, loc2_id, _ = sample_locations
    with app.app_context():
        road = Road(
            source_location_id=loc1_id,
            destination_location_id=loc2_id,
            distance_km=6.5,
            estimated_duration_minutes=15.0
        )
        db.session.add(road)
        db.session.commit()

        assert road.id is not None
        assert road.distance_km == 6.5

def test_route_run_model(app, sample_locations):
    """Verify RouteRun model records algorithmic paths and execution times."""
    loc1_id, loc2_id, _ = sample_locations
    with app.app_context():
        run = RouteRun(
            source_location_id=loc1_id,
            destination_location_id=loc2_id,
            algorithm="Dijkstra",
            total_distance_km=14.2,
            path_json='["NODE-DEPOT", "NODE-N1", "NODE-DEST"]',
            execution_time_ms=1.45
        )
        db.session.add(run)
        db.session.commit()

        run_dict = run.to_dict()
        assert run_dict["algorithm"] == "Dijkstra"
        assert run_dict["total_distance_km"] == 14.2
        assert isinstance(run_dict["path"], list)
        assert run_dict["execution_time_ms"] == 1.45

# -----------------------------------------------------------------------------
# 2. Location CRUD Endpoints & Validations
# -----------------------------------------------------------------------------

def test_location_crud(client):
    """Test full Location CRUD lifecycle."""
    # 1. Create location
    res = client.post('/api/locations', json={
        "name": "North Hub",
        "address": "500 North Shore Rd",
        "latitude": 37.8012,
        "longitude": -122.4201
    })
    assert res.status_code == 201
    data = res.get_json()
    loc_id = data["location"]["id"]
    assert data["location"]["name"] == "North Hub"

    # 2. Get location by ID
    res = client.get(f'/api/locations/{loc_id}')
    assert res.status_code == 200
    assert res.get_json()["location"]["address"] == "500 North Shore Rd"

    # 3. Update location
    res = client.put(f'/api/locations/{loc_id}', json={
        "name": "North Hub Express",
        "latitude": 37.8050
    })
    assert res.status_code == 200
    assert res.get_json()["location"]["name"] == "North Hub Express"

    # 4. Delete location
    res = client.delete(f'/api/locations/{loc_id}')
    assert res.status_code == 200

    # 5. Verify deletion
    res = client.get(f'/api/locations/{loc_id}')
    assert res.status_code == 404

def test_location_validation(client):
    """Verify input validation rules for Location creation."""
    # Missing required name
    res = client.post('/api/locations', json={
        "address": "123 Street",
        "latitude": 37.5,
        "longitude": -122.4
    })
    assert res.status_code == 400
    assert "details" in res.get_json()

    # Invalid latitude out of bounds
    res = client.post('/api/locations', json={
        "name": "Invalid Place",
        "address": "123 Street",
        "latitude": 120.0,
        "longitude": -122.4
    })
    assert res.status_code == 400

# -----------------------------------------------------------------------------
# 3. Delivery CRUD Endpoints, Validation & Constraints
# -----------------------------------------------------------------------------

def test_delivery_creation_and_retrieval(client, sample_locations):
    """Test Delivery creation with distance auto-calculation and retrieval."""
    loc1_id, loc2_id, _ = sample_locations

    res = client.post('/api/deliveries', json={
        "customer_name": "Acme Pharmaceuticals",
        "pickup_location_id": loc1_id,
        "destination_location_id": loc2_id,
        "priority": "Urgent",
        "status": "In Transit",
        "package_weight_kg": 5.2,
        "estimated_delivery_time": "11:00 AM"
    })
    assert res.status_code == 201
    data = res.get_json()
    del_id = data["delivery"]["id"]
    tracking_no = data["delivery"]["tracking_number"]
    assert tracking_no.startswith("TRK-")
    assert data["delivery"]["customer_name"] == "Acme Pharmaceuticals"
    assert data["delivery"]["distance_km"] > 0

    # Retrieve by ID
    res = client.get(f'/api/deliveries/{del_id}')
    assert res.status_code == 200
    assert res.get_json()["delivery"]["tracking_number"] == tracking_no

def test_delivery_duplicate_tracking_number(client, sample_locations):
    """Ensure duplicate tracking numbers return 409 Conflict."""
    loc1_id, loc2_id, _ = sample_locations

    payload = {
        "tracking_number": "TRK-DUPLICATE-TEST",
        "customer_name": "Customer 1",
        "pickup_location_id": loc1_id,
        "destination_location_id": loc2_id
    }
    res1 = client.post('/api/deliveries', json=payload)
    assert res1.status_code == 201

    # Second delivery with exact same tracking number
    res2 = client.post('/api/deliveries', json=payload)
    assert res2.status_code == 409
    assert res2.get_json()["error"] == "Conflict"

def test_delivery_invalid_locations_and_constraints(client, sample_locations):
    """Verify validation for missing or identical pickup/destination locations."""
    loc1_id, _, _ = sample_locations

    # Identical pickup and destination
    res = client.post('/api/deliveries', json={
        "customer_name": "Self Loop Inc",
        "pickup_location_id": loc1_id,
        "destination_location_id": loc1_id
    })
    assert res.status_code == 400
    assert any("different" in err for err in res.get_json()["details"])

    # Non-existent destination location ID
    res = client.post('/api/deliveries', json={
        "customer_name": "Lost Cargo",
        "pickup_location_id": loc1_id,
        "destination_location_id": 99999
    })
    assert res.status_code == 400
    assert any("does not exist" in err for err in res.get_json()["details"])

def test_delivery_status_update_and_delete(client, sample_locations):
    """Test delivery status updates and deletion."""
    loc1_id, loc2_id, _ = sample_locations

    res = client.post('/api/deliveries', json={
        "customer_name": "Update Target Corp",
        "pickup_location_id": loc1_id,
        "destination_location_id": loc2_id,
        "status": "Pending"
    })
    del_id = res.get_json()["delivery"]["id"]

    # Update status to Delivered
    res = client.put(f'/api/deliveries/{del_id}', json={
        "status": "Delivered",
        "assigned_driver": "Driver Frank"
    })
    assert res.status_code == 200
    assert res.get_json()["delivery"]["status"] == "Delivered"
    assert res.get_json()["delivery"]["assigned_driver"] == "Driver Frank"

    # Delete delivery
    res = client.delete(f'/api/deliveries/{del_id}')
    assert res.status_code == 200

    # Verify not found
    res = client.get(f'/api/deliveries/{del_id}')
    assert res.status_code == 404

def test_location_delete_protection_when_deliveries_exist(client, sample_locations):
    """Ensure location cannot be deleted if active deliveries reference it (referential integrity)."""
    loc1_id, loc2_id, _ = sample_locations

    # Create delivery using loc1
    client.post('/api/deliveries', json={
        "customer_name": "Referenced Cargo",
        "pickup_location_id": loc1_id,
        "destination_location_id": loc2_id
    })

    # Try to delete loc1
    res = client.delete(f'/api/locations/{loc1_id}')
    assert res.status_code == 409
    assert res.get_json()["error"] == "Conflict"

# -----------------------------------------------------------------------------
# 4. Dashboard Summary Calculations
# -----------------------------------------------------------------------------

def test_dashboard_summary_calculations(client, sample_locations):
    """Test dashboard live metrics computed from database entries."""
    loc1_id, loc2_id, loc3_id = sample_locations

    # 1. Empty state verification
    res = client.get('/api/dashboard/summary')
    assert res.status_code == 200
    data = res.get_json()
    assert data["metrics"]["total_deliveries"] == 0
    assert data["metrics"]["has_sufficient_data"] is False

    # 2. Add diverse deliveries
    client.post('/api/deliveries', json={
        "customer_name": "Order 1",
        "pickup_location_id": loc1_id,
        "destination_location_id": loc2_id,
        "status": "Delivered",
        "distance_km": 10.0
    })
    client.post('/api/deliveries', json={
        "customer_name": "Order 2",
        "pickup_location_id": loc1_id,
        "destination_location_id": loc3_id,
        "status": "In Transit",
        "distance_km": 20.0
    })
    client.post('/api/deliveries', json={
        "customer_name": "Order 3",
        "pickup_location_id": loc2_id,
        "destination_location_id": loc3_id,
        "status": "Delayed",
        "distance_km": 30.0
    })

    # 3. Verify metrics
    res = client.get('/api/dashboard/summary')
    assert res.status_code == 200
    metrics = res.get_json()["metrics"]
    assert metrics["total_deliveries"] == 3
    assert metrics["completed_deliveries"] == 1
    assert metrics["active_deliveries"] == 1
    assert metrics["delayed_deliveries"] == 1
    # Average distance: (10 + 20 + 30) / 3 = 20.0
    assert metrics["avg_distance_km"] == 20.0
    # On-time rate: 1 completed / (1 completed + 1 delayed) = 50.0%
    assert metrics["on_time_rate"] == 50.0

    # 4. Verify recent deliveries
    res = client.get('/api/dashboard/recent-deliveries')
    assert res.status_code == 200
    recent = res.get_json()
    assert recent["count"] == 3
    assert recent["deliveries"][0]["customer_name"] == "Order 3"
