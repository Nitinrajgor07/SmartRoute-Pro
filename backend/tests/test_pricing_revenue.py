import datetime

from app import create_app
from app.extensions import db
from app.models import Delivery, Location


def _login(client, email, password):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {response.get_json()['access_token']}"}


def _app():
    application = create_app("testing")
    with application.app_context():
        db.create_all()
        db.session.add_all([
            Location(name="Price Depot", address="A", latitude=12.0, longitude=77.0),
            Location(name="Price Destination", address="B", latitude=12.1, longitude=77.1),
        ])
        db.session.commit()
    return application


def test_backend_calculates_and_persists_standard_and_express_prices():
    application = _app()
    client = application.test_client()
    headers = _login(client, "viewer@smartroute.pro", "Viewer@123456")
    with application.app_context():
        locations = Location.query.order_by(Location.id).all()
        payload = {
            "pickup_location_id": locations[0].id,
            "destination_location_id": locations[1].id,
            "package_weight_kg": 2,
            "priority": "Standard",
            "price": 1,
        }
    response = client.post("/api/my/parcels", headers=headers, json=payload)
    assert response.status_code == 201
    with application.app_context():
        parcel = Delivery.query.order_by(Delivery.id.desc()).first()
        assert parcel.price == 100.0

    with application.app_context():
        locations = Location.query.order_by(Location.id).all()
        payload.update({
            "pickup_location_id": locations[0].id,
            "destination_location_id": locations[1].id,
            "package_weight_kg": 1,
            "priority": "Express",
        })
    assert client.post("/api/my/parcels", headers=headers, json=payload).status_code == 201
    with application.app_context():
        assert Delivery.query.order_by(Delivery.id.desc()).first().price == 75.0


def test_revenue_periods_exclude_cancelled_and_viewers():
    application = _app()
    client = application.test_client()
    with application.app_context():
        locations = Location.query.order_by(Location.id).all()
        now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        db.session.add_all([
            Delivery(tracking_number="REV-1", customer_name="A", pickup_location_id=locations[0].id,
                     destination_location_id=locations[1].id, package_weight_kg=1, priority="Standard",
                     price=50, status="Delivered", created_at=now),
            Delivery(tracking_number="REV-2", customer_name="B", pickup_location_id=locations[0].id,
                     destination_location_id=locations[1].id, package_weight_kg=2, priority="Express",
                     price=150, status="Cancelled", created_at=now),
        ])
        db.session.commit()

    admin = _login(client, "admin@smartroute.pro", "Admin@123456")
    dispatcher = _login(client, "dispatcher@smartroute.pro", "Dispatch@123456")
    viewer = _login(client, "viewer@smartroute.pro", "Viewer@123456")
    assert client.get("/api/dashboard/revenue", headers=admin).get_json()["today"] == 50.0
    assert client.get("/api/dashboard/revenue", headers=dispatcher).get_json()["today"] == 50.0
    assert client.get("/api/dashboard/revenue", headers=viewer).status_code == 403
