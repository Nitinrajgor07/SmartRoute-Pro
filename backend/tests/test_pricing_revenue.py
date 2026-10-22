import datetime
from zoneinfo import ZoneInfo
from app import create_app
from app.extensions import db
from app.models import Delivery, Location, User
from app.services.pricing import calculate_parcel_price
from seed import seed_database


def _login(client, email, password):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {response.get_json()['access_token']}"}


def _app(env="testing", timezone="UTC"):
    application = create_app(env)
    application.config["APP_TIMEZONE"] = timezone
    with application.app_context():
        db.create_all()
        db.session.add_all([
            Location(name="Price Depot", address="A", latitude=12.0, longitude=77.0),
            Location(name="Price Destination", address="B", latitude=12.1, longitude=77.1),
        ])
        db.session.commit()
    return application


def test_pricing_for_all_priorities_and_unknown():
    assert calculate_parcel_price(2.0, "Standard") == 100.0
    assert calculate_parcel_price(2.0, "Express") == 150.0
    assert calculate_parcel_price(2.0, "Urgent") == 200.0
    assert calculate_parcel_price(2.0, "Unknown") is None
    assert calculate_parcel_price(2.0, "") is None


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
                     price=50, status="Delivered", delivered_at=now, created_at=now),
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


def test_seed_prices_all_60_parcels_deterministically():
    application = _app()
    with application.app_context():
        seed_database(application)
        total_deliveries = Delivery.query.count()
        assert total_deliveries == 60
        unpriced = Delivery.query.filter(Delivery.price.is_(None)).count()
        assert unpriced == 0

        # Snapshot prices
        prices_1 = [d.price for d in Delivery.query.order_by(Delivery.id).all()]
        assert all(p > 0 for p in prices_1)

        # Run seed again to verify determinism and idempotency
        seed_database(application)
        prices_2 = [d.price for d in Delivery.query.order_by(Delivery.id).all()]
        assert prices_1 == prices_2


def test_backfill_prices_cli_command():
    application = _app()
    runner = application.test_cli_runner()
    with application.app_context():
        locations = Location.query.order_by(Location.id).all()
        db.session.add_all([
            Delivery(tracking_number="BF-1", customer_name="X", pickup_location_id=locations[0].id,
                     destination_location_id=locations[1].id, package_weight_kg=2.0, priority="Standard",
                     status="Pending", price=None),
            Delivery(tracking_number="BF-2", customer_name="Y", pickup_location_id=locations[0].id,
                     destination_location_id=locations[1].id, package_weight_kg=1.0, priority="Urgent",
                     status="In Transit", price=None),
            Delivery(tracking_number="BF-3", customer_name="Z", pickup_location_id=locations[0].id,
                     destination_location_id=locations[1].id, package_weight_kg=3.0, priority="Express",
                     status="Delivered", price=225.0),
        ])
        db.session.commit()

    # First run backfills NULL prices
    result = runner.invoke(args=["backfill-prices"])
    assert result.exit_code == 0
    assert "Backfilled prices for 2 deliveries" in result.output

    with application.app_context():
        d1 = Delivery.query.filter_by(tracking_number="BF-1").first()
        d2 = Delivery.query.filter_by(tracking_number="BF-2").first()
        d3 = Delivery.query.filter_by(tracking_number="BF-3").first()
        assert d1.price == 100.0
        assert d2.price == 100.0
        assert d3.price == 225.0

    # Second run is idempotent (0 rows changed)
    result2 = runner.invoke(args=["backfill-prices"])
    assert result2.exit_code == 0
    assert "Backfilled prices for 0 deliveries" in result2.output


def test_delivered_at_lifecycle_and_price_recalculation():
    application = _app()
    client = application.test_client()
    dispatcher = _login(client, "dispatcher@smartroute.pro", "Dispatch@123456")

    with application.app_context():
        locations = Location.query.order_by(Location.id).all()
        loc0, loc1 = locations[0].id, locations[1].id

    # 1. Create parcel directly as Delivered sets delivered_at
    res1 = client.post("/api/deliveries", headers=dispatcher, json={
        "customer_name": "Direct Delivered",
        "pickup_location_id": loc0,
        "destination_location_id": loc1,
        "package_weight_kg": 2.0,
        "priority": "Urgent",
        "status": "Delivered"
    })
    assert res1.status_code == 201
    del1_id = res1.get_json()["delivery"]["id"]
    with application.app_context():
        d1 = db.session.get(Delivery, del1_id)
        assert d1.delivered_at is not None
        assert d1.price == 200.0

    # 2. Create parcel as Pending has delivered_at = None
    res2 = client.post("/api/deliveries", headers=dispatcher, json={
        "customer_name": "Pending Parcel",
        "pickup_location_id": loc0,
        "destination_location_id": loc1,
        "package_weight_kg": 2.0,
        "priority": "Standard",
        "status": "Pending"
    })
    assert res2.status_code == 201
    del2_id = res2.get_json()["delivery"]["id"]
    with application.app_context():
        d2 = db.session.get(Delivery, del2_id)
        assert d2.delivered_at is None
        assert d2.price == 100.0

    # 3. Update status to Delivered sets delivered_at
    res_del = client.put(f"/api/deliveries/{del2_id}", headers=dispatcher, json={"status": "Delivered"})
    assert res_del.status_code == 200
    with application.app_context():
        d2 = db.session.get(Delivery, del2_id)
        assert d2.delivered_at is not None
        saved_del_at = d2.delivered_at

    # 4. Status change away from Delivered clears delivered_at to None
    res_transit = client.put(f"/api/deliveries/{del2_id}", headers=dispatcher, json={"status": "In Transit"})
    assert res_transit.status_code == 200
    with application.app_context():
        d2 = db.session.get(Delivery, del2_id)
        assert d2.delivered_at is None

    # 5. Weight/priority update on non-Delivered parcel recalculates price
    res_recalc = client.put(f"/api/deliveries/{del2_id}", headers=dispatcher, json={
        "package_weight_kg": 3.0,
        "priority": "Express"
    })
    assert res_recalc.status_code == 200
    with application.app_context():
        d2 = db.session.get(Delivery, del2_id)
        assert d2.price == 225.0  # 3.0 * 75


def test_revenue_periods_breakdown_and_awaiting_delivery():
    application = _app()
    client = application.test_client()
    now_utc = datetime.datetime.now(datetime.timezone.utc)

    with application.app_context():
        locations = Location.query.order_by(Location.id).all()
        loc0, loc1 = locations[0].id, locations[1].id

        db.session.add_all([
            # Delivered today
            Delivery(tracking_number="REV-DEL-1", customer_name="D1", pickup_location_id=loc0,
                     destination_location_id=loc1, package_weight_kg=1.0, priority="Standard",
                     status="Delivered", price=50.0, delivered_at=now_utc, created_at=now_utc),
            Delivery(tracking_number="REV-DEL-2", customer_name="D2", pickup_location_id=loc0,
                     destination_location_id=loc1, package_weight_kg=2.0, priority="Express",
                     status="Delivered", price=150.0, delivered_at=now_utc, created_at=now_utc),
            # Pending (awaiting delivery)
            Delivery(tracking_number="REV-PEN-1", customer_name="P1", pickup_location_id=loc0,
                     destination_location_id=loc1, package_weight_kg=2.0, priority="Urgent",
                     status="Pending", price=200.0, created_at=now_utc),
            # In Transit (awaiting delivery)
            Delivery(tracking_number="REV-TRA-1", customer_name="T1", pickup_location_id=loc0,
                     destination_location_id=loc1, package_weight_kg=1.0, priority="Express",
                     status="In Transit", price=75.0, created_at=now_utc),
            # Cancelled (should NOT be counted in revenue or awaiting)
            Delivery(tracking_number="REV-CAN-1", customer_name="C1", pickup_location_id=loc0,
                     destination_location_id=loc1, package_weight_kg=1.0, priority="Standard",
                     status="Cancelled", price=50.0, created_at=now_utc),
        ])
        db.session.commit()

    admin = _login(client, "admin@smartroute.pro", "Admin@123456")

    # Check GET /api/dashboard/revenue
    rev_res = client.get("/api/dashboard/revenue", headers=admin)
    assert rev_res.status_code == 200
    rev_data = rev_res.get_json()
    assert rev_data["today"] == 200.0
    assert rev_data["all_time"] == 200.0
    assert rev_data["delivered_parcels"]["today"] == 2
    assert rev_data["delivered_parcels"]["all_time"] == 2
    assert rev_data["awaiting_delivery"] == 275.0  # 200 + 75
    assert rev_data["currency"] == "INR"

    # Check GET /api/dashboard/summary
    sum_res = client.get("/api/dashboard/summary", headers=admin)
    assert sum_res.status_code == 200
    sum_data = sum_res.get_json()
    assert sum_data["metrics"]["delivered_today"] == 2
    assert sum_data["metrics"]["revenue"]["all_time"] == 200.0
    assert sum_data["metrics"]["revenue"]["awaiting_delivery"] == 275.0


def test_period_boundaries_with_asia_kolkata():
    """Verify that a parcel delivered at 20:00 UTC counts as next calendar day in IST."""
    application = _app(timezone="Asia/Kolkata")
    client = application.test_client()

    # Fixed base date: 2026-10-20 20:00:00 UTC
    # In Asia/Kolkata (UTC+5:30), this is 2026-10-21 01:30:00 IST.
    dt_utc = datetime.datetime(2026, 10, 20, 20, 0, 0, tzinfo=datetime.timezone.utc)

    with application.app_context():
        locations = Location.query.order_by(Location.id).all()
        db.session.add(
            Delivery(tracking_number="IST-1", customer_name="IST Customer", pickup_location_id=locations[0].id,
                     destination_location_id=locations[1].id, package_weight_kg=2.0, priority="Urgent",
                     status="Delivered", price=200.0, delivered_at=dt_utc, created_at=dt_utc)
        )
        db.session.commit()

    admin = _login(client, "admin@smartroute.pro", "Admin@123456")

    # In pure calculation test:
    from app.services.revenue import calculate_revenue_periods
    tz_ist = ZoneInfo("Asia/Kolkata")

    # If today in IST is 2026-10-20:
    dt_ist_oct20 = datetime.datetime(2026, 10, 20, 15, 0, 0, tzinfo=tz_ist)
    res_oct20 = calculate_revenue_periods(
        delivered_rows=[{"price": 200.0, "delivered_at": dt_utc}],
        awaiting_rows=[],
        now_app_dt=dt_ist_oct20,
        app_timezone=tz_ist
    )
    # 20:00 UTC is Oct 21 in IST, so it does NOT count as Oct 20 today
    assert res_oct20["today"] == 0.0

    # If today in IST is 2026-10-21:
    dt_ist_oct21 = datetime.datetime(2026, 10, 21, 10, 0, 0, tzinfo=tz_ist)
    res_oct21 = calculate_revenue_periods(
        delivered_rows=[{"price": 200.0, "delivered_at": dt_utc}],
        awaiting_rows=[],
        now_app_dt=dt_ist_oct21,
        app_timezone=tz_ist
    )
    # Counts as today on Oct 21 in IST!
    assert res_oct21["today"] == 200.0
    assert res_oct21["delivered_parcels"]["today"] == 1


def test_revenue_breakdown_endpoint_validation_and_data():
    application = _app()
    client = application.test_client()
    admin = _login(client, "admin@smartroute.pro", "Admin@123456")
    now_utc = datetime.datetime.now(datetime.timezone.utc)

    with application.app_context():
        locations = Location.query.order_by(Location.id).all()
        db.session.add_all([
            Delivery(tracking_number="BK-1", customer_name="U1", pickup_location_id=locations[0].id,
                     destination_location_id=locations[1].id, package_weight_kg=1.0, priority="Urgent",
                     status="Delivered", price=100.0, delivered_at=now_utc, created_at=now_utc),
            Delivery(tracking_number="BK-2", customer_name="E1", pickup_location_id=locations[0].id,
                     destination_location_id=locations[1].id, package_weight_kg=2.0, priority="Express",
                     status="Delivered", price=150.0, delivered_at=now_utc, created_at=now_utc),
            Delivery(tracking_number="BK-3", customer_name="S1", pickup_location_id=locations[0].id,
                     destination_location_id=locations[1].id, package_weight_kg=2.0, priority="Standard",
                     status="Delivered", price=100.0, delivered_at=now_utc, created_at=now_utc),
        ])
        db.session.commit()

    # Valid breakdown
    res = client.get("/api/dashboard/revenue/breakdown?days=30", headers=admin)
    assert res.status_code == 200
    data = res.get_json()
    assert data["days"] == 30
    assert len(data["daily"]) == 30
    assert data["totals"]["parcels"] == 3
    assert data["totals"]["revenue"] == 350.0

    # Priority table check
    p_map = {item["priority"]: item for item in data["by_priority"]}
    assert p_map["Urgent"]["parcels"] == 1
    assert p_map["Urgent"]["revenue"] == 100.0
    assert p_map["Express"]["parcels"] == 1
    assert p_map["Express"]["revenue"] == 150.0
    assert p_map["Standard"]["parcels"] == 1
    assert p_map["Standard"]["revenue"] == 100.0

    # Validation: days must be 7 to 90
    assert client.get("/api/dashboard/revenue/breakdown?days=6", headers=admin).status_code == 400
    assert client.get("/api/dashboard/revenue/breakdown?days=91", headers=admin).status_code == 400
    assert client.get("/api/dashboard/revenue/breakdown?days=invalid", headers=admin).status_code == 400


def test_revenue_endpoints_rbac_permissions():
    application = _app()
    client = application.test_client()

    admin = _login(client, "admin@smartroute.pro", "Admin@123456")
    dispatcher = _login(client, "dispatcher@smartroute.pro", "Dispatch@123456")
    viewer = _login(client, "viewer@smartroute.pro", "Viewer@123456")

    # GET /api/dashboard/revenue
    assert client.get("/api/dashboard/revenue", headers=admin).status_code == 200
    assert client.get("/api/dashboard/revenue", headers=dispatcher).status_code == 200
    assert client.get("/api/dashboard/revenue", headers=viewer).status_code == 403
    assert client.get("/api/dashboard/revenue").status_code == 401

    # GET /api/dashboard/revenue/breakdown
    assert client.get("/api/dashboard/revenue/breakdown", headers=admin).status_code == 200
    assert client.get("/api/dashboard/revenue/breakdown", headers=dispatcher).status_code == 200
    assert client.get("/api/dashboard/revenue/breakdown", headers=viewer).status_code == 403
    assert client.get("/api/dashboard/revenue/breakdown").status_code == 401
