import pytest
from app import create_app
from app.extensions import db
from app.models import User, Location

@pytest.fixture
def app():
    test_app = create_app('testing')
    test_app.config['SMARTROUTE_API_KEY'] = 'enterprise-api-key-2026'
    with test_app.app_context():
        db.create_all()
        # Seed minimal test locations for routes/deliveries
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
# Test 1: Register as VIEWER and as DISPATCHER
# ------------------------------------------------------------------------------
def test_register_as_viewer_and_dispatcher(client):
    """Register as VIEWER and DISPATCHER: 201, no tokens, approval_status 'pending', role 'VIEWER', requested_role set."""
    # 1. Register as VIEWER
    res_viewer = client.post('/api/auth/register', json={
        "name": "Pending Viewer",
        "email": "pending_viewer@smartroute.pro",
        "password": "Password123!",
        "account_type": "VIEWER"
    })
    assert res_viewer.status_code == 201
    data_v = res_viewer.get_json()
    assert "user" in data_v
    assert data_v["user"]["email"] == "pending_viewer@smartroute.pro"
    assert data_v["user"]["role"] == "VIEWER"
    assert data_v["user"]["requested_role"] == "VIEWER"
    assert data_v["user"]["approval_status"] == "pending"
    assert "access_token" not in data_v
    assert "refresh_token" not in data_v

    # 2. Register as DISPATCHER
    res_disp = client.post('/api/auth/register', json={
        "name": "Pending Dispatcher",
        "email": "pending_disp@smartroute.pro",
        "password": "Password123!",
        "account_type": "DISPATCHER"
    })
    assert res_disp.status_code == 201
    data_d = res_disp.get_json()
    assert "user" in data_d
    assert data_d["user"]["email"] == "pending_disp@smartroute.pro"
    assert data_d["user"]["role"] == "VIEWER"  # Least privilege
    assert data_d["user"]["requested_role"] == "DISPATCHER"
    assert data_d["user"]["approval_status"] == "pending"
    assert "access_token" not in data_d
    assert "refresh_token" not in data_d


# ------------------------------------------------------------------------------
# Test 2: Register with invalid and default account_types
# ------------------------------------------------------------------------------
def test_register_invalid_and_default_account_types(client):
    """Register with account_type ADMIN or 'banana': 400. Register with no account_type: pending viewer."""
    # ADMIN requested -> 400
    res_admin = client.post('/api/auth/register', json={
        "name": "Hacker Admin",
        "email": "hacker_admin@smartroute.pro",
        "password": "Password123!",
        "account_type": "ADMIN"
    })
    assert res_admin.status_code == 400
    assert "Invalid account type" in res_admin.get_json()["message"]

    # 'banana' requested -> 400
    res_banana = client.post('/api/auth/register', json={
        "name": "Banana User",
        "email": "banana@smartroute.pro",
        "password": "Password123!",
        "account_type": "banana"
    })
    assert res_banana.status_code == 400
    assert "Invalid account type" in res_banana.get_json()["message"]

    # Missing account_type -> defaults to pending VIEWER
    res_default = client.post('/api/auth/register', json={
        "name": "Default User",
        "email": "default_user@smartroute.pro",
        "password": "Password123!"
    })
    assert res_default.status_code == 201
    data_def = res_default.get_json()
    assert data_def["user"]["role"] == "VIEWER"
    assert data_def["user"]["requested_role"] == "VIEWER"
    assert data_def["user"]["approval_status"] == "pending"


# ------------------------------------------------------------------------------
# Test 3: Login while pending (leak protection)
# ------------------------------------------------------------------------------
def test_login_while_pending_and_leak_protection(client):
    """Login while pending: 403 with pending message (after correct password). Wrong password: 401."""
    client.post('/api/auth/register', json={
        "name": "Pending Account",
        "email": "pending_login@smartroute.pro",
        "password": "SecretPassword123!",
        "account_type": "VIEWER"
    })

    # Wrong password: 401 Unauthorized (must not reveal account approval state)
    res_wrong = client.post('/api/auth/login', json={
        "email": "pending_login@smartroute.pro",
        "password": "WrongPassword999!"
    })
    assert res_wrong.status_code == 401
    assert res_wrong.get_json()["message"] == "Invalid email or password."

    # Correct password: 403 Forbidden with exact pending message
    res_correct = client.post('/api/auth/login', json={
        "email": "pending_login@smartroute.pro",
        "password": "SecretPassword123!"
    })
    assert res_correct.status_code == 403
    assert res_correct.get_json()["message"] == "Your account is waiting for admin approval."


# ------------------------------------------------------------------------------
# Test 4: Admin lists users with approval_status filter
# ------------------------------------------------------------------------------
def test_admin_list_users_filter(client, admin_headers):
    """Admin lists ?approval_status=pending and sees the new user. Invalid filter: 400."""
    reg = client.post('/api/auth/register', json={
        "name": "Filter Test User",
        "email": "filter_test@smartroute.pro",
        "password": "Password123!",
        "account_type": "DISPATCHER"
    })
    new_user_id = reg.get_json()["user"]["id"]

    # Filter for pending users
    res_pending = client.get('/api/auth/users?approval_status=pending', headers=admin_headers)
    assert res_pending.status_code == 200
    pending_users = res_pending.get_json()["users"]
    pending_ids = [u["id"] for u in pending_users]
    assert new_user_id in pending_ids
    assert all(u["approval_status"] == 'pending' for u in pending_users)

    # Filter for approved users
    res_approved = client.get('/api/auth/users?approval_status=approved', headers=admin_headers)
    assert res_approved.status_code == 200
    approved_users = res_approved.get_json()["users"]
    assert new_user_id not in [u["id"] for u in approved_users]
    assert all(u["approval_status"] == 'approved' for u in approved_users)

    # Invalid filter -> 400
    res_invalid = client.get('/api/auth/users?approval_status=unknown_status', headers=admin_headers)
    assert res_invalid.status_code == 400
    assert "Invalid approval_status filter" in res_invalid.get_json()["message"]


# ------------------------------------------------------------------------------
# Test 5: Admin approves dispatcher request
# ------------------------------------------------------------------------------
def test_admin_approves_dispatcher_request(client, admin_headers):
    """Admin approves dispatcher request: user can sign in and gets DISPATCHER permissions from /api/auth/me."""
    reg = client.post('/api/auth/register', json={
        "name": "Future Dispatcher",
        "email": "future_disp@smartroute.pro",
        "password": "Password123!",
        "account_type": "DISPATCHER"
    })
    user_id = reg.get_json()["user"]["id"]

    # Approve user
    app_res = client.post(f'/api/auth/users/{user_id}/approve', headers=admin_headers)
    assert app_res.status_code == 200
    user_data = app_res.get_json()["user"]
    assert user_data["approval_status"] == "approved"
    assert user_data["role"] == "DISPATCHER"

    # Approving already approved user returns 200 and changes nothing
    app_res2 = client.post(f'/api/auth/users/{user_id}/approve', headers=admin_headers)
    assert app_res2.status_code == 200
    assert "already approved" in app_res2.get_json()["message"]

    # Now user can sign in
    login_res = client.post('/api/auth/login', json={
        "email": "future_disp@smartroute.pro",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    disp_token = login_res.get_json()["access_token"]

    # Verify permissions from /api/auth/me
    me_res = client.get('/api/auth/me', headers={"Authorization": f"Bearer {disp_token}"})
    assert me_res.status_code == 200
    me_data = me_res.get_json()
    assert me_data["user"]["role"] == "DISPATCHER"
    perms = me_data["permissions"]
    assert "deliveries:read" in perms
    assert "deliveries:write" in perms
    assert "routes:calculate" in perms


# ------------------------------------------------------------------------------
# Test 6: Admin rejects request and rejection behavior
# ------------------------------------------------------------------------------
def test_admin_rejects_and_rejection_behavior(client, admin_headers):
    """Admin rejects: login gives rejected message. Rejecting approved user: 409."""
    reg = client.post('/api/auth/register', json={
        "name": "Rejected Applicant",
        "email": "rejected_app@smartroute.pro",
        "password": "Password123!",
        "account_type": "VIEWER"
    })
    user_id = reg.get_json()["user"]["id"]

    # Admin rejects
    rej_res = client.post(f'/api/auth/users/{user_id}/reject', headers=admin_headers)
    assert rej_res.status_code == 200
    assert rej_res.get_json()["user"]["approval_status"] == "rejected"

    # Login gives rejected message
    login_res = client.post('/api/auth/login', json={
        "email": "rejected_app@smartroute.pro",
        "password": "Password123!"
    })
    assert login_res.status_code == 403
    assert login_res.get_json()["message"] == "Your request was rejected. Contact an administrator."

    # Rejecting an approved user (like dispatcher@smartroute.pro) -> 409
    disp_id = User.query.filter_by(email="dispatcher@smartroute.pro").first().id
    rej_approved = client.post(f'/api/auth/users/{disp_id}/reject', headers=admin_headers)
    assert rej_approved.status_code == 409
    assert "Cannot reject an approved user" in rej_approved.get_json()["message"]

    # Approving a rejected user is allowed
    re_app = client.post(f'/api/auth/users/{user_id}/approve', headers=admin_headers)
    assert re_app.status_code == 200
    assert re_app.get_json()["user"]["approval_status"] == "approved"


# ------------------------------------------------------------------------------
# Test 7: Non-admin calling approve, reject or filter gets 403
# ------------------------------------------------------------------------------
def test_non_admin_calling_approve_reject_filter(client, dispatcher_headers, viewer_headers):
    """Non-admin (dispatcher and viewer) calling approve, reject or the filter: 403."""
    reg = client.post('/api/auth/register', json={
        "name": "Target User",
        "email": "target_user@smartroute.pro",
        "password": "Password123!",
        "account_type": "VIEWER"
    })
    target_id = reg.get_json()["user"]["id"]

    # Dispatcher attempts
    assert client.get('/api/auth/users?approval_status=pending', headers=dispatcher_headers).status_code == 403
    assert client.post(f'/api/auth/users/{target_id}/approve', headers=dispatcher_headers).status_code == 403
    assert client.post(f'/api/auth/users/{target_id}/reject', headers=dispatcher_headers).status_code == 403

    # Viewer attempts
    assert client.get('/api/auth/users?approval_status=pending', headers=viewer_headers).status_code == 403
    assert client.post(f'/api/auth/users/{target_id}/approve', headers=viewer_headers).status_code == 403
    assert client.post(f'/api/auth/users/{target_id}/reject', headers=viewer_headers).status_code == 403


# ------------------------------------------------------------------------------
# Test 8: Token created before user was blocked is refused on /me & protected endpoint
# ------------------------------------------------------------------------------
def test_token_refused_after_user_blocked(client, app, admin_headers):
    """A token created before user was blocked is refused on /me and on protected endpoints after status change."""
    with app.app_context():
        user = User(
            name="Session Tester",
            email="session_tester@smartroute.pro",
            role="VIEWER",
            approval_status="approved",
            is_active=True
        )
        user.set_password("Secret123!")
        db.session.add(user)
        db.session.commit()
        user_id = user.id

    # User logs in and gets tokens
    login_res = client.post('/api/auth/login', json={
        "email": "session_tester@smartroute.pro",
        "password": "Secret123!"
    })
    assert login_res.status_code == 200
    token = login_res.get_json()["access_token"]
    user_headers = {"Authorization": f"Bearer {token}"}

    # Verify token works initially
    assert client.get('/api/auth/me', headers=user_headers).status_code == 200

    # 1. Block by setting to 'pending'
    u = db.session.get(User, user_id)
    u.approval_status = 'pending'
    db.session.commit()
    db.session.expire_all()

    me_pending = client.get('/api/auth/me', headers=user_headers)
    assert me_pending.status_code == 401
    assert me_pending.get_json()["message"] == "Your account is waiting for admin approval."

    parcels_pending = client.get('/api/my/parcels', headers=user_headers)
    assert parcels_pending.status_code == 401
    assert parcels_pending.get_json()["message"] == "Your account is waiting for admin approval."

    # 2. Block by setting to 'rejected'
    u = db.session.get(User, user_id)
    u.approval_status = 'rejected'
    db.session.commit()
    db.session.expire_all()

    me_rej = client.get('/api/auth/me', headers=user_headers)
    assert me_rej.status_code == 401
    assert me_rej.get_json()["message"] == "Your request was rejected. Contact an administrator."

    parcels_rej = client.get('/api/my/parcels', headers=user_headers)
    assert parcels_rej.status_code == 401
    assert parcels_rej.get_json()["message"] == "Your request was rejected. Contact an administrator."


# ------------------------------------------------------------------------------
# Test 9: Role-change endpoint refused on pending user
# ------------------------------------------------------------------------------
def test_role_change_refused_on_pending_user(client, admin_headers):
    """The existing role-change endpoint must refuse (409) users whose approval_status is 'pending'."""
    reg = client.post('/api/auth/register', json={
        "name": "Role Change Target",
        "email": "role_target@smartroute.pro",
        "password": "Password123!",
        "account_type": "DISPATCHER"
    })
    user_id = reg.get_json()["user"]["id"]

    # Admin tries to change role directly on pending user
    res = client.put(f'/api/auth/users/{user_id}/role', headers=admin_headers, json={
        "role": "DISPATCHER"
    })
    assert res.status_code == 409
    assert "Cannot change role for a pending user" in res.get_json()["message"]


# ------------------------------------------------------------------------------
# Test 10: Admin cannot approve or reject own account
# ------------------------------------------------------------------------------
def test_admin_cannot_approve_or_reject_self(client, admin_headers):
    """Admin cannot approve or reject their own account."""
    admin_id = User.query.filter_by(email="admin@smartroute.pro").first().id

    app_self = client.post(f'/api/auth/users/{admin_id}/approve', headers=admin_headers)
    assert app_self.status_code == 403
    assert "cannot approve their own account" in app_self.get_json()["message"].lower()

    rej_self = client.post(f'/api/auth/users/{admin_id}/reject', headers=admin_headers)
    assert rej_self.status_code == 403
    assert "cannot reject their own account" in rej_self.get_json()["message"].lower()
