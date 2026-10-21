"""End-to-end admin lifecycle: register -> blocked -> approve -> sign in -> delete -> access revoked."""
import pytest
from app import create_app
from app.extensions import db


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


def _headers(client, email, password):
    res = client.post('/api/auth/login', json={"email": email, "password": password})
    return {"Authorization": f"Bearer {res.get_json()['access_token']}"}


@pytest.fixture
def admin_headers(client):
    return _headers(client, "admin@smartroute.pro", "Admin@123456")


@pytest.fixture
def dispatcher_headers(client):
    return _headers(client, "dispatcher@smartroute.pro", "Dispatch@123456")


def _register(client, name, email, account_type):
    res = client.post('/api/auth/register', json={
        "name": name, "email": email, "password": "Strong123pass", "account_type": account_type
    })
    assert res.status_code == 201
    return res.get_json()["user"]["id"]


def _login(client, email):
    return client.post('/api/auth/login', json={"email": email, "password": "Strong123pass"})


@pytest.mark.parametrize("account_type", ["VIEWER", "DISPATCHER"])
def test_register_approve_login_then_delete(client, admin_headers, account_type):
    email = f"new_{account_type.lower()}@example.com"
    user_id = _register(client, "New Person", email, account_type)

    # Pending users cannot sign in
    assert _login(client, email).status_code == 403

    # Pending user appears in the admin's pending list
    res = client.get('/api/auth/users?approval_status=pending', headers=admin_headers)
    assert any(u["id"] == user_id for u in res.get_json()["users"])

    # Admin approves -> role becomes the requested role
    res = client.post(f'/api/auth/users/{user_id}/approve', headers=admin_headers)
    assert res.status_code == 200
    assert res.get_json()["user"]["role"] == account_type
    assert res.get_json()["user"]["approval_status"] == "approved"

    # Approved user can now sign in
    login = _login(client, email)
    assert login.status_code == 200
    user_headers = {"Authorization": f"Bearer {login.get_json()['access_token']}"}
    assert client.get('/api/auth/me', headers=user_headers).status_code == 200

    # Admin deletes the account at any time
    res = client.delete(f'/api/auth/users/{user_id}', headers=admin_headers)
    assert res.status_code == 200

    # Deleted user's existing token no longer works, and they cannot sign in again
    assert client.get('/api/auth/me', headers=user_headers).status_code == 401
    assert _login(client, email).status_code == 401


def test_admin_can_delete_pending_and_rejected_users(client, admin_headers):
    pending_id = _register(client, "Pending Person", "pending@example.com", "VIEWER")
    rejected_id = _register(client, "Rejected Person", "rejected@example.com", "DISPATCHER")
    assert client.post(f'/api/auth/users/{rejected_id}/reject', headers=admin_headers).status_code == 200

    assert client.delete(f'/api/auth/users/{pending_id}', headers=admin_headers).status_code == 200
    assert client.delete(f'/api/auth/users/{rejected_id}', headers=admin_headers).status_code == 200

    ids = {u["id"] for u in client.get('/api/auth/users', headers=admin_headers).get_json()["users"]}
    assert pending_id not in ids and rejected_id not in ids


def test_non_admin_cannot_approve_or_delete(client, dispatcher_headers):
    user_id = _register(client, "Someone", "someone@example.com", "VIEWER")
    assert client.post(f'/api/auth/users/{user_id}/approve', headers=dispatcher_headers).status_code == 403
    assert client.delete(f'/api/auth/users/{user_id}', headers=dispatcher_headers).status_code == 403
