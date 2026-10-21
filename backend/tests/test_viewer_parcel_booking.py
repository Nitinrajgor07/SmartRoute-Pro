"""Viewer self-service parcel booking: POST /api/my/parcels and GET /api/my/hubs."""
import pytest
from app import create_app
from app.extensions import db
from app.models import Location, Delivery


@pytest.fixture
def app():
    test_app = create_app('testing')
    with test_app.app_context():
        db.create_all()
        db.session.add_all([
            Location(name="Majestic Depot", address="Gandhi Nagar", latitude=12.9767, longitude=77.5713),
            Location(name="Whitefield", address="ITPL Main Rd", latitude=12.9698, longitude=77.7500),
        ])
        db.session.commit()
        yield test_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def _headers(client, email, password):
    res = client.post('/api/auth/login', json={"email": email, "password": password})
    return {"Authorization": f"Bearer {res.get_json()['access_token']}"}


@pytest.fixture
def viewer_headers(client):
    return _headers(client, "viewer@smartroute.pro", "Viewer@123456")


@pytest.fixture
def dispatcher_headers(client):
    return _headers(client, "dispatcher@smartroute.pro", "Dispatch@123456")


def _hub_ids(app):
    with app.app_context():
        return {l.name: l.id for l in Location.query.all()}


def test_viewer_can_list_hubs(client, viewer_headers):
    res = client.get('/api/my/hubs', headers=viewer_headers)
    assert res.status_code == 200
    hubs = res.get_json()["hubs"]
    assert {h["name"] for h in hubs} == {"Majestic Depot", "Whitefield"}
    assert set(hubs[0].keys()) == {"id", "name", "address"}  # no internal fields


def test_viewer_books_parcel_and_sees_it(app, client, viewer_headers):
    ids = _hub_ids(app)
    res = client.post('/api/my/parcels', headers=viewer_headers, json={
        "pickup_location_id": ids["Majestic Depot"],
        "destination_location_id": ids["Whitefield"],
        "package_weight_kg": 2.5,
        "priority": "Express",
        "recipient_name": "Ravi Kumar",
        # Fields a viewer must NOT be able to control:
        "status": "Delivered",
        "assigned_driver": "Hacker",
        "customer_email": "someone.else@example.com",
    })
    assert res.status_code == 201
    tracking = res.get_json()["parcel"]["tracking_number"]

    with app.app_context():
        d = Delivery.query.filter_by(tracking_number=tracking).first()
        assert d.status == "Pending"
        assert d.assigned_driver == "Unassigned"
        assert d.customer_email == "viewer@smartroute.pro"
        assert d.priority == "Express"
        assert d.distance_km > 15  # Majestic -> Whitefield is ~19 km straight line

    mine = client.get('/api/my/parcels', headers=viewer_headers).get_json()["parcels"]
    assert any(p["tracking_number"] == tracking for p in mine)


@pytest.mark.parametrize("payload, message_part", [
    ({"destination_location_id": 2}, "pickup"),
    ({"pickup_location_id": 1, "destination_location_id": 1}, "different"),
    ({"pickup_location_id": 1, "destination_location_id": 2, "package_weight_kg": 500}, "Weight"),
    ({"pickup_location_id": 1, "destination_location_id": 2, "priority": "Rocket"}, "Priority"),
])
def test_invalid_bookings_are_rejected(client, viewer_headers, payload, message_part):
    res = client.post('/api/my/parcels', headers=viewer_headers, json=payload)
    assert res.status_code == 400
    assert message_part.lower() in res.get_json()["message"].lower()


def test_only_viewers_can_book(app, client, dispatcher_headers):
    ids = _hub_ids(app)
    res = client.post('/api/my/parcels', headers=dispatcher_headers, json={
        "pickup_location_id": ids["Majestic Depot"], "destination_location_id": ids["Whitefield"]
    })
    assert res.status_code == 403


def test_anonymous_cannot_book(client):
    assert client.post('/api/my/parcels', json={}).status_code == 401
