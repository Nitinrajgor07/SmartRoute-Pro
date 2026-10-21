import datetime
import pytest
from app import create_app
from app.extensions import db
from app.models import User, TokenBlocklist
from flask_jwt_extended import create_access_token

@pytest.fixture
def app():
    test_app = create_app('testing')
    with test_app.app_context():
        db.create_all()
        yield test_app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

# ------------------------------------------------------------------------------
# Test 1: User Registration
# ------------------------------------------------------------------------------
def test_1_user_registration(client):
    """Test POST /api/auth/register with valid payload creates a pending user with VIEWER role and no tokens."""
    res = client.post('/api/auth/register', json={
        "name": "Jane Dispatcher",
        "email": "jane@smartroute.pro",
        "password": "Password123!",
        "account_type": "DISPATCHER"
    })
    assert res.status_code == 201
    data = res.get_json()
    assert "user" in data
    assert data["user"]["email"] == "jane@smartroute.pro"
    assert data["user"]["role"] == "VIEWER"
    assert data["user"]["requested_role"] == "DISPATCHER"
    assert data["user"]["approval_status"] == "pending"
    assert "access_token" not in data
    assert "refresh_token" not in data
    assert "password_hash" not in data["user"]

def test_register_role_admin_rejected_400(client):
    """Ensure posting account_type/role=ADMIN to /api/auth/register returns 400 Bad Request."""
    res = client.post('/api/auth/register', json={
        "name": "Malicious Admin",
        "email": "fakeadmin@smartroute.pro",
        "password": "SecurePassword123!",
        "account_type": "ADMIN"
    })
    assert res.status_code == 400
    assert "Invalid account type" in res.get_json()["message"]

def test_register_password_rules_validation(client):
    """Ensure password rules (min 8 chars, one letter, one number) are enforced."""
    # Too short (< 8 chars)
    res1 = client.post('/api/auth/register', json={
        "name": "Short Pass",
        "email": "short@smartroute.pro",
        "password": "Pass1"
    })
    assert res1.status_code == 400
    assert "at least 8 characters" in res1.get_json()["message"]

    # Missing number
    res2 = client.post('/api/auth/register', json={
        "name": "No Number",
        "email": "nonumber@smartroute.pro",
        "password": "PasswordOnly!"
    })
    assert res2.status_code == 400
    assert "one letter and one number" in res2.get_json()["message"]

    # Missing letter
    res3 = client.post('/api/auth/register', json={
        "name": "No Letter",
        "email": "noletter@smartroute.pro",
        "password": "1234567890!"
    })
    assert res3.status_code == 400
    assert "one letter and one number" in res3.get_json()["message"]

# ------------------------------------------------------------------------------
# Test 2: Duplicate Email Rejection
# ------------------------------------------------------------------------------
def test_2_duplicate_email(client):
    """Test duplicate registration attempts are rejected with 409 Conflict."""
    client.post('/api/auth/register', json={
        "name": "User One",
        "email": "duplicate@smartroute.pro",
        "password": "Password123!"
    })
    res = client.post('/api/auth/register', json={
        "name": "User Two",
        "email": "duplicate@smartroute.pro",
        "password": "Password123!"
    })
    assert res.status_code == 409
    assert res.get_json()["error"] == "Conflict"

# ------------------------------------------------------------------------------
# Test 3: Password Hashing Integrity
# ------------------------------------------------------------------------------
def test_3_password_hashing(app):
    """Ensure plain passwords are never stored in the database."""
    with app.app_context():
        user = User(name="Hash Test", email="hash@smartroute.pro", role="VIEWER")
        raw_password = "PlainSecretPassword!"
        user.set_password(raw_password)
        db.session.add(user)
        db.session.commit()

        assert user.password_hash != raw_password
        assert user.password_hash.startswith("scrypt:") or user.password_hash.startswith("pbkdf2:")
        assert user.check_password(raw_password) is True
        assert user.check_password("WrongPassword") is False

# ------------------------------------------------------------------------------
# Test 4: Valid Login
# ------------------------------------------------------------------------------
def test_4_valid_login(client, app):
    """Test successful credential login returning JWT tokens for approved user."""
    with app.app_context():
        user = User(
            name="Login User",
            email="login@smartroute.pro",
            role="VIEWER",
            approval_status="approved",
            is_active=True
        )
        user.set_password("CorrectPassword123!")
        db.session.add(user)
        db.session.commit()

    res = client.post('/api/auth/login', json={
        "email": "login@smartroute.pro",
        "password": "CorrectPassword123!"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "login@smartroute.pro"

# ------------------------------------------------------------------------------
# Test 5: Invalid Login
# ------------------------------------------------------------------------------
def test_5_invalid_login(client):
    """Test login rejection on incorrect credentials."""
    client.post('/api/auth/register', json={
        "name": "Login User",
        "email": "login2@smartroute.pro",
        "password": "CorrectPassword123!"
    })
    res = client.post('/api/auth/login', json={
        "email": "login2@smartroute.pro",
        "password": "WrongPassword!"
    })
    assert res.status_code == 401
    assert res.get_json()["error"] == "Unauthorized"

# ------------------------------------------------------------------------------
# Test 6: Disabled User Blocked from Login
# ------------------------------------------------------------------------------
def test_6_disabled_user(client, app):
    """Test that inactive users cannot log in."""
    with app.app_context():
        disabled = User(
            name="Disabled User",
            email="disabled@smartroute.pro",
            role="VIEWER",
            is_active=False
        )
        disabled.set_password("Secret123!")
        db.session.add(disabled)
        db.session.commit()

    res = client.post('/api/auth/login', json={
        "email": "disabled@smartroute.pro",
        "password": "Secret123!"
    })
    assert res.status_code == 403
    assert res.get_json()["error"] == "Forbidden"

# ------------------------------------------------------------------------------
# Test 7: JWT Expiration Handling
# ------------------------------------------------------------------------------
def test_7_jwt_expiration(client, app):
    """Test that expired JWT access tokens are rejected with 401."""
    with app.app_context():
        # Create an expired token (negative delta)
        expired_token = create_access_token(
            identity="1",
            expires_delta=datetime.timedelta(seconds=-10),
            additional_claims={"role": "DISPATCHER", "email": "exp@smartroute.pro"}
        )

    res = client.get('/api/auth/me', headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    data = res.get_json()
    assert data["error"] == "Unauthorized"
    assert "expired" in data["message"].lower()

# ------------------------------------------------------------------------------
# Test 8: Refresh Token Behavior
# ------------------------------------------------------------------------------
def test_8_refresh_token_behavior(client, app):
    """Test POST /api/auth/refresh yields a new access token."""
    with app.app_context():
        user = User(
            name="Refresh Tester",
            email="refresh@smartroute.pro",
            role="VIEWER",
            approval_status="approved",
            is_active=True
        )
        user.set_password("SecretPassword123!")
        db.session.add(user)
        db.session.commit()

    login_res = client.post('/api/auth/login', json={
        "email": "refresh@smartroute.pro",
        "password": "SecretPassword123!"
    })
    refresh_token = login_res.get_json()["refresh_token"]

    res = client.post('/api/auth/refresh', headers={"Authorization": f"Bearer {refresh_token}"})
    assert res.status_code == 200
    data = res.get_json()
    assert "access_token" in data

# ------------------------------------------------------------------------------
# Test 9: Logout & Token Revocation
# ------------------------------------------------------------------------------
def test_9_logout_and_revocation(client, app):
    """Test that logout revokes token and blocks subsequent access."""
    login_res = client.post('/api/auth/login', json={
        "email": "admin@smartroute.pro",
        "password": "Admin@123456"
    })
    tokens = login_res.get_json()
    token = tokens["access_token"]
    refresh_tok = tokens["refresh_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify token works initially
    me_res = client.get('/api/auth/me', headers=headers)
    assert me_res.status_code == 200

    # Logout with refresh_token in payload
    logout_res = client.post('/api/auth/logout', headers=headers, json={"refresh_token": refresh_tok})
    assert logout_res.status_code == 200

    # Verify token is now revoked
    me_after = client.get('/api/auth/me', headers=headers)
    assert me_after.status_code == 401
    assert "revoked" in me_after.get_json()["message"].lower()

# ------------------------------------------------------------------------------
# Test 10: Current User Endpoint
# ------------------------------------------------------------------------------
def test_10_current_user_endpoint(client):
    """Test GET /api/auth/me retrieves authenticated user profile."""
    login_res = client.post('/api/auth/login', json={
        "email": "dispatcher@smartroute.pro",
        "password": "Dispatch@123456"
    })
    token = login_res.get_json()["access_token"]

    res = client.get('/api/auth/me', headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["user"]["email"] == "dispatcher@smartroute.pro"
    assert data["user"]["role"] == "DISPATCHER"

# ------------------------------------------------------------------------------
# Test 11: Profile Update
# ------------------------------------------------------------------------------
def test_11_profile_update(client):
    """Test PUT /api/auth/profile modifies name and email."""
    login_res = client.post('/api/auth/login', json={
        "email": "viewer@smartroute.pro",
        "password": "Viewer@123456"
    })
    token = login_res.get_json()["access_token"]

    res = client.put('/api/auth/profile', headers={"Authorization": f"Bearer {token}"}, json={
        "name": "Updated Auditor Name",
        "email": "viewer_updated@smartroute.pro"
    })
    assert res.status_code == 200
    assert res.get_json()["user"]["name"] == "Updated Auditor Name"
    assert res.get_json()["user"]["email"] == "viewer_updated@smartroute.pro"

# ------------------------------------------------------------------------------
# Test 12: Password Change
# ------------------------------------------------------------------------------
def test_12_password_change(client, app):
    """Test PUT /api/auth/change-password validates current and updates password."""
    with app.app_context():
        user = User(
            name="Password Changer",
            email="changer@smartroute.pro",
            role="VIEWER",
            approval_status="approved",
            is_active=True
        )
        user.set_password("OldPassword123!")
        db.session.add(user)
        db.session.commit()

    login_res = client.post('/api/auth/login', json={
        "email": "changer@smartroute.pro",
        "password": "OldPassword123!"
    })
    token = login_res.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Wrong current password
    fail_res = client.put('/api/auth/change-password', headers=headers, json={
        "current_password": "WrongPassword!",
        "new_password": "NewPassword123!"
    })
    assert fail_res.status_code == 401

    # Correct current password
    ok_res = client.put('/api/auth/change-password', headers=headers, json={
        "current_password": "OldPassword123!",
        "new_password": "NewPassword123!"
    })
    assert ok_res.status_code == 200

    # Verify old session token was revoked on password update
    old_token_check = client.get('/api/auth/me', headers=headers)
    assert old_token_check.status_code == 401

    # Verify new password works on login
    login_new = client.post('/api/auth/login', json={
        "email": "changer@smartroute.pro",
        "password": "NewPassword123!"
    })
    assert login_new.status_code == 200
