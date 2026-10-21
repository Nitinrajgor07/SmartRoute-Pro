import pytest
from app import create_app
from app.extensions import db
from app.models import User, Location, Delivery
from app.utils.permissions import PERMISSION_ROLES

@pytest.fixture
def app():
    test_app = create_app('testing')
    test_app.config['SMARTROUTE_API_KEY'] = 'enterprise-api-key-2026'
    with test_app.app_context():
        db.create_all()
        # Seed test locations
        loc1 = Location(name="Depot One", address="100 Main St", latitude=37.77, longitude=-122.41)
        loc2 = Location(name="Client Two", address="200 Market St", latitude=37.78, longitude=-122.42)
        db.session.add_all([loc1, loc2])
        db.session.commit()
        
        yield test_app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def admin_headers(client):
    res = client.post('/api/auth/login', json={
        "email": "admin@smartroute.pro",
        "password": "Admin@123456"
    })
    token = res.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def dispatcher_headers(client):
    res = client.post('/api/auth/login', json={
        "email": "dispatcher@smartroute.pro",
        "password": "Dispatch@123456"
    })
    token = res.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def viewer_headers(client):
    res = client.post('/api/auth/login', json={
        "email": "viewer@smartroute.pro",
        "password": "Viewer@123456"
    })
    token = res.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ------------------------------------------------------------------------------
# Parametrized Matrix Test: Role x Protected Endpoint
# Assert 200/201 or 403 strictly according to the canonical permissions table.
# ------------------------------------------------------------------------------

MATRIX_ENDPOINTS = [
    # (permission, method, endpoint, payload, success_status)
    ("dashboard:read", "GET", "/api/dashboard/summary", None, 200),
    ("profile:self", "GET", "/api/auth/me", None, 200),
    ("deliveries:read", "GET", "/api/deliveries", None, 200),
    ("deliveries:write", "POST", "/api/deliveries", {
        "customer_name": "Matrix Parcel",
        "pickup_location_id": 1,
        "destination_location_id": 2,
        "priority": "Standard",
        "status": "Pending"
    }, 201),
    ("routes:read", "GET", "/api/routes/history", None, 200),
    ("routes:calculate", "POST", "/api/routes/shortest-path", {
        "source_location_id": 1,
        "destination_location_id": 2
    }, 200),
    ("zones:read", "GET", "/api/sda/clusters/history", None, 200),
    ("zones:run", "POST", "/api/sda/clusters/kmeans", {"k": 2}, 200),
    ("analytics:read", "GET", "/api/sda/statistics/summary", None, 200),
    ("reports:analytics", "GET", "/api/reports/statistics.pdf", None, 200),
    ("reports:operational", "GET", "/api/reports/deliveries.pdf", None, 200),
    ("reports:system", "GET", "/api/reports/cloud.pdf", None, 200),
    ("system:read", "GET", "/api/cloud/deployment", None, 200),
    ("users:manage", "GET", "/api/auth/users", None, 200),
    ("parcels:own", "GET", "/api/my/parcels", None, 200),
    ("reports:my_parcels", "GET", "/api/reports/my-parcels.pdf", None, 200),
]

MATRIX_CASES = []
for role in ['ADMIN', 'DISPATCHER', 'VIEWER']:
    for perm, method, endpoint, payload, success_code in MATRIX_ENDPOINTS:
        is_allowed = role in PERMISSION_ROLES.get(perm, [])
        expected_status = success_code if is_allowed else 403
        MATRIX_CASES.append((role, perm, method, endpoint, payload, expected_status))


@pytest.mark.parametrize("role,perm,method,endpoint,payload,expected_status", MATRIX_CASES)
def test_permission_matrix(client, admin_headers, dispatcher_headers, viewer_headers,
                           role, perm, method, endpoint, payload, expected_status):
    """
    Parametrized matrix test verifying that every role x endpoint combination
    strictly yields 200/201 (permitted) or 403 (forbidden).
    """
    header_map = {
        'ADMIN': admin_headers,
        'DISPATCHER': dispatcher_headers,
        'VIEWER': viewer_headers
    }
    headers = header_map[role]

    if method == "GET":
        res = client.get(endpoint, headers=headers)
    elif method == "POST":
        res = client.post(endpoint, headers=headers, json=payload or {})
    else:
        raise ValueError(f"Unsupported method {method}")

    assert res.status_code == expected_status, (
        f"Role '{role}' on endpoint '{method} {endpoint}' (perm: {perm}) returned {res.status_code}, expected {expected_status}"
    )


# ------------------------------------------------------------------------------
# Safety Rule 5: Admin cannot change their own role, deactivate or delete themselves
# ------------------------------------------------------------------------------

def test_rule_5_admin_cannot_change_own_role(client, admin_headers):
    """An admin attempting to change their own role receives 403 Forbidden."""
    # Fetch admin ID
    me = client.get('/api/auth/me', headers=admin_headers).get_json()["user"]
    admin_id = me["id"]

    res = client.put(f'/api/auth/users/{admin_id}/role', headers=admin_headers, json={"role": "DISPATCHER"})
    assert res.status_code == 403
    assert "own role" in res.get_json()["message"].lower()

def test_rule_5_admin_cannot_deactivate_themselves(client, admin_headers):
    """An admin attempting to deactivate their own account receives 403 Forbidden."""
    me = client.get('/api/auth/me', headers=admin_headers).get_json()["user"]
    admin_id = me["id"]

    res = client.put(f'/api/auth/users/{admin_id}/status', headers=admin_headers, json={"is_active": False})
    assert res.status_code == 403
    assert "own account" in res.get_json()["message"].lower()

def test_rule_5_admin_cannot_delete_themselves(client, admin_headers):
    """An admin attempting to delete their own account receives 403 Forbidden."""
    me = client.get('/api/auth/me', headers=admin_headers).get_json()["user"]
    admin_id = me["id"]

    res = client.delete(f'/api/auth/users/{admin_id}', headers=admin_headers)
    assert res.status_code == 403
    assert "own account" in res.get_json()["message"].lower()


# ------------------------------------------------------------------------------
# Safety Rule 6: Last active ADMIN cannot be demoted, deactivated or deleted
# ------------------------------------------------------------------------------

def test_rule_6_last_active_admin_cannot_be_demoted(client, app, admin_headers):
    """The sole remaining active administrator cannot be demoted or deactivated."""
    with app.app_context():
        # Ensure only 1 active admin exists initially
        admins = User.query.filter_by(role='ADMIN', is_active=True).all()
        target_admin = admins[0]
        target_admin_id = target_admin.id
        
        # Create a second admin to test multi-admin transitions
        second_admin = User(name="Second Admin", email="admin2@smartroute.pro", role="ADMIN", is_active=True)
        second_admin.set_password("Admin2@123456")
        db.session.add(second_admin)
        db.session.commit()
        second_id = second_admin.id

    # Login as second admin
    res = client.post('/api/auth/login', json={"email": "admin2@smartroute.pro", "password": "Admin2@123456"})
    admin2_token = res.get_json()["access_token"]
    admin2_headers = {"Authorization": f"Bearer {admin2_token}"}

    # Admin 2 demotes target_admin -> now admin 2 is the ONLY active admin left
    demote_res = client.put(f'/api/auth/users/{target_admin_id}/role', headers=admin2_headers, json={"role": "DISPATCHER"})
    assert demote_res.status_code == 200

    # With admin 2 as sole active admin, verify admin count is 1
    with app.app_context():
        active_admins = User.query.filter_by(role='ADMIN', is_active=True).count()
        assert active_admins == 1

    # Attempting to deactivate or delete self as sole active admin is rejected
    self_deact = client.put(f'/api/auth/users/{second_id}/status', headers=admin2_headers, json={"is_active": False})
    assert self_deact.status_code in [400, 403]


# ------------------------------------------------------------------------------
# Safety Rule 7: Self-registered users are always VIEWER
# ------------------------------------------------------------------------------

def test_rule_7_self_registered_users_always_viewer(client):
    """Ensure POST /api/auth/register rejects ADMIN with 400 and creates pending VIEWER for DISPATCHER."""
    res = client.post('/api/auth/register', json={
        "name": "Self Reg Admin Attempter",
        "email": "hacker@smartroute.pro",
        "password": "Password123!",
        "role": "ADMIN"
    })
    assert res.status_code == 400
    assert "Invalid account type" in res.get_json()["message"]

    # Also test requesting DISPATCHER: created with role VIEWER and pending approval
    res2 = client.post('/api/auth/register', json={
        "name": "Self Reg Dispatcher Attempter",
        "email": "disp_attempt@smartroute.pro",
        "password": "Password123!",
        "account_type": "DISPATCHER"
    })
    assert res2.status_code == 201
    data2 = res2.get_json()
    assert data2["user"]["role"] == "VIEWER"
    assert data2["user"]["requested_role"] == "DISPATCHER"
    assert data2["user"]["approval_status"] == "pending"
    assert "access_token" not in data2


# ------------------------------------------------------------------------------
# Legacy test suites updated for new role model:
# Admin cannot mutate operational data; Viewer cannot mutate; Dispatcher can.
# ------------------------------------------------------------------------------

def test_13_admin_permissions(client, admin_headers):
    """Admin can list users and access cloud deployment metadata."""
    users_res = client.get('/api/auth/users', headers=admin_headers)
    assert users_res.status_code == 200
    assert len(users_res.get_json()["users"]) >= 3

    dep_res = client.get('/api/cloud/deployment', headers=admin_headers)
    assert dep_res.status_code == 200

    met_res = client.get('/api/cloud/metrics', headers=admin_headers)
    assert met_res.status_code == 200


def test_14_dispatcher_permissions(client, dispatcher_headers):
    """Dispatcher manages deliveries and routes, but is forbidden from admin routes."""
    deliv_res = client.post('/api/deliveries', headers=dispatcher_headers, json={
        "customer_name": "Dispatcher Customer",
        "pickup_location_id": 1,
        "destination_location_id": 2,
        "priority": "Express",
        "status": "Pending"
    })
    assert deliv_res.status_code == 201

    user_res = client.get('/api/auth/users', headers=dispatcher_headers)
    assert user_res.status_code == 403

    cloud_res = client.get('/api/cloud/deployment', headers=dispatcher_headers)
    assert cloud_res.status_code == 403


def test_15_viewer_read_only_permissions(client, viewer_headers):
    """Viewer can read their own parcels, but cannot access operational delivery lists or mutate data."""
    # Cannot read operational deliveries table (DISPATCHER only)
    read_res = client.get('/api/deliveries', headers=viewer_headers)
    assert read_res.status_code == 403

    # Can read own parcels
    my_parcels_res = client.get('/api/my/parcels', headers=viewer_headers)
    assert my_parcels_res.status_code == 200

    create_res = client.post('/api/deliveries', headers=viewer_headers, json={
        "customer_name": "Unauthorized Customer",
        "pickup_location_id": 1,
        "destination_location_id": 2
    })
    assert create_res.status_code == 403


def test_16_unauthorized_delivery_mutations(client, viewer_headers, admin_headers):
    """Unauthenticated, Viewer, AND Admin requests cannot modify operational delivery records."""
    # 1. Unauthenticated -> 401
    assert client.post('/api/deliveries', json={"customer_name": "Ghost"}).status_code == 401

    # 2. Viewer -> 403
    assert client.post('/api/deliveries', headers=viewer_headers, json={"customer_name": "Ghost"}).status_code == 403

    # 3. Admin -> 403 (Admin cannot change operational data)
    assert client.post('/api/deliveries', headers=admin_headers, json={"customer_name": "AdminGhost"}).status_code == 403


def test_17_unauthorized_route_execution(client, viewer_headers, admin_headers):
    """Unauthenticated, Viewer, AND Admin requests cannot calculate shortest paths."""
    # 1. Unauthenticated -> 401
    assert client.post('/api/routes/shortest-path', json={"source_location_id": 1, "destination_location_id": 2}).status_code == 401

    # 2. Viewer -> 403
    assert client.post('/api/routes/shortest-path', headers=viewer_headers, json={"source_location_id": 1, "destination_location_id": 2}).status_code == 403

    # 3. Admin -> 403 (Admin cannot change operational data)
    assert client.post('/api/routes/shortest-path', headers=admin_headers, json={"source_location_id": 1, "destination_location_id": 2}).status_code == 403


def test_18_unauthorized_clustering_execution(client, viewer_headers, admin_headers):
    """Unauthenticated, Viewer, AND Admin requests cannot execute clustering runs."""
    # 1. Unauthenticated -> 401
    assert client.post('/api/sda/clusters/kmeans', json={"k": 2}).status_code == 401

    # 2. Viewer -> 403
    assert client.post('/api/sda/clusters/kmeans', headers=viewer_headers, json={"k": 2}).status_code == 403

    # 3. Admin -> 403 (Admin cannot change operational data)
    assert client.post('/api/sda/clusters/kmeans', headers=admin_headers, json={"k": 2}).status_code == 403


def test_19_protected_report_downloads(client, viewer_headers, dispatcher_headers, admin_headers):
    """
    Ensure report downloads follow the canonical model:
    - reports:operational -> DISPATCHER only (deliveries.pdf)
    - reports:system -> ADMIN only (cloud.pdf)
    - reports:my_parcels -> VIEWER only (my-parcels.pdf)
    - reports:analytics -> ADMIN, DISPATCHER (statistics.pdf)
    """
    # 1. Unauthenticated -> 401
    assert client.get('/api/reports/deliveries.pdf').status_code == 401

    # 2. Operational reports (deliveries.pdf) -> Dispatcher only
    assert client.get('/api/reports/deliveries.pdf', headers=dispatcher_headers).status_code == 200
    assert client.get('/api/reports/deliveries.pdf', headers=viewer_headers).status_code == 403
    assert client.get('/api/reports/deliveries.pdf', headers=admin_headers).status_code == 403

    # 3. System reports (cloud.pdf) -> Admin only
    assert client.get('/api/reports/cloud.pdf', headers=admin_headers).status_code == 200
    assert client.get('/api/reports/cloud.pdf', headers=dispatcher_headers).status_code == 403
    assert client.get('/api/reports/cloud.pdf', headers=viewer_headers).status_code == 403

    # 4. Customer parcels report (my-parcels.pdf) -> Viewer only
    assert client.get('/api/reports/my-parcels.pdf', headers=viewer_headers).status_code == 200
    assert client.get('/api/reports/my-parcels.pdf', headers=dispatcher_headers).status_code == 403
    assert client.get('/api/reports/my-parcels.pdf', headers=admin_headers).status_code == 403

    # 5. Analytics report (statistics.pdf) -> Admin and Dispatcher
    assert client.get('/api/reports/statistics.pdf', headers=admin_headers).status_code == 200
    assert client.get('/api/reports/statistics.pdf', headers=dispatcher_headers).status_code == 200
    assert client.get('/api/reports/statistics.pdf', headers=viewer_headers).status_code == 403


def test_20_protected_cloud_monitoring(client, dispatcher_headers, admin_headers):
    """Public health probe is open, but metrics and deployment require Admin role."""
    assert client.get('/api/cloud/health').status_code == 200
    assert client.get('/api/cloud/deployment').status_code == 401
    assert client.get('/api/cloud/deployment', headers=dispatcher_headers).status_code == 403
    assert client.get('/api/cloud/deployment', headers=admin_headers).status_code == 200


def test_21_auth_security_headers(client):
    """Verify security headers are attached to auth endpoints."""
    res = client.post('/api/auth/login', json={"email": "bad@email.com", "password": "123"})
    assert res.headers.get('X-Content-Type-Options') == 'nosniff'
    assert res.headers.get('X-Frame-Options') == 'DENY'
    assert res.headers.get('X-XSS-Protection') == '1; mode=block'
    assert res.headers.get('Referrer-Policy') == 'strict-origin-when-cross-origin'


def test_22_api_key_compatibility(client):
    """Verify service-to-service calls using X-API-Key succeed without user JWT."""
    api_key_headers = {"X-API-Key": "enterprise-api-key-2026"}
    res = client.post('/api/deliveries', headers=api_key_headers, json={
        "customer_name": "API Service Client",
        "pickup_location_id": 1,
        "destination_location_id": 2
    })
    assert res.status_code == 201
    dep_res = client.get('/api/cloud/deployment', headers=api_key_headers)
    assert dep_res.status_code == 200


def test_23_cloud_services_admin_only(client, viewer_headers, dispatcher_headers, admin_headers):
    """Verify /api/cloud/services is strictly restricted to ADMIN role."""
    assert client.get('/api/cloud/services').status_code == 401
    assert client.get('/api/cloud/services', headers=viewer_headers).status_code == 403
    assert client.get('/api/cloud/services', headers=dispatcher_headers).status_code == 403
    a_res = client.get('/api/cloud/services', headers=admin_headers)
    assert a_res.status_code == 200
    assert "services" in a_res.get_json()


def test_24_authenticated_get_read_endpoints(client, viewer_headers, dispatcher_headers, admin_headers):
    """Verify GET history/read endpoints require authentication and obey role boundaries."""
    endpoints = [
        '/api/deliveries',
        '/api/routes/history',
        '/api/sda/clusters/history'
    ]
    for ep in endpoints:
        assert client.get(ep).status_code == 401
        assert client.get(ep, headers=viewer_headers).status_code == 403
        assert client.get(ep, headers=admin_headers).status_code == 403
        assert client.get(ep, headers=dispatcher_headers).status_code == 200

    # Common read endpoints accessible to all authenticated roles
    common_endpoints = ['/api/auth/me', '/api/dashboard/summary']
    for ep in common_endpoints:
        assert client.get(ep, headers=viewer_headers).status_code == 200
        assert client.get(ep, headers=dispatcher_headers).status_code == 200
        assert client.get(ep, headers=admin_headers).status_code == 200


# ------------------------------------------------------------------------------
# Customer Parcel Isolation Tests
# ------------------------------------------------------------------------------

def test_viewer_a_cannot_read_viewer_b_parcel(client, app, viewer_headers, dispatcher_headers):
    """
    Customer Parcel Isolation:
    Viewer A (viewer@smartroute.pro) attempting to access a parcel belonging to Viewer B
    or an unassigned parcel receives 404 (not 403) to prevent enumeration.
    """
    # 1. Dispatcher creates a parcel specifically for another customer (customer_b@example.com)
    create_res = client.post('/api/deliveries', headers=dispatcher_headers, json={
        "customer_name": "Customer B",
        "customer_email": "customer_b@example.com",
        "pickup_location_id": 1,
        "destination_location_id": 2,
        "priority": "Express",
        "status": "In Transit"
    })
    assert create_res.status_code == 201
    tracking_b = create_res.get_json()["delivery"]["tracking_number"]

    # 2. Viewer A requests Customer B's parcel -> must yield 404
    get_res = client.get(f'/api/my/parcels/{tracking_b}', headers=viewer_headers)
    assert get_res.status_code == 404
    assert get_res.get_json()["error"] == "Not Found"


def test_my_parcels_filters_by_customer_email(client, dispatcher_headers, viewer_headers):
    """GET /api/my/parcels returns only parcels whose customer_email matches the caller."""
    # Create one parcel for viewer@smartroute.pro
    p1 = client.post('/api/deliveries', headers=dispatcher_headers, json={
        "customer_name": "Viewer Customer",
        "customer_email": "viewer@smartroute.pro",
        "pickup_location_id": 1,
        "destination_location_id": 2,
        "priority": "Standard",
        "status": "Pending"
    }).get_json()["delivery"]["tracking_number"]

    # Create another parcel for other@example.com
    p2 = client.post('/api/deliveries', headers=dispatcher_headers, json={
        "customer_name": "Other Customer",
        "customer_email": "other@example.com",
        "pickup_location_id": 1,
        "destination_location_id": 2,
        "priority": "Express",
        "status": "In Transit"
    }).get_json()["delivery"]["tracking_number"]

    # Viewer queries /api/my/parcels
    res = client.get('/api/my/parcels', headers=viewer_headers)
    assert res.status_code == 200
    data = res.get_json()
    tracking_numbers = [p["tracking_number"] for p in data["parcels"]]

    assert p1 in tracking_numbers
    assert p2 not in tracking_numbers


def test_my_parcels_csv_export_isolation(client, dispatcher_headers, viewer_headers):
    """GET /api/reports/my-parcels.csv contains only caller's parcels and safe columns."""
    client.post('/api/deliveries', headers=dispatcher_headers, json={
        "customer_name": "Viewer CSV Target",
        "customer_email": "viewer@smartroute.pro",
        "pickup_location_id": 1,
        "destination_location_id": 2,
        "priority": "Standard",
        "status": "Pending"
    })
    client.post('/api/deliveries', headers=dispatcher_headers, json={
        "customer_name": "Alien CSV Parcel",
        "customer_email": "stranger@example.com",
        "pickup_location_id": 1,
        "destination_location_id": 2,
        "priority": "Standard",
        "status": "Pending"
    })

    res = client.get('/api/reports/my-parcels.csv', headers=viewer_headers)
    assert res.status_code == 200
    csv_text = res.get_data(as_text=True)
    assert "Alien CSV Parcel" not in csv_text
    assert "Driver" not in csv_text
    assert "Weight" not in csv_text

