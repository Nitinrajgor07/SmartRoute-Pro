import pytest
from app import create_app

@pytest.fixture
def client():
    app = create_app('testing')
    with app.test_client() as client:
        yield client

def test_root_endpoint(client):
    """Test the root endpoint response."""
    response = client.get('/')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'online'
    assert 'version' in data
    assert data['health_endpoint'] == '/api/health'
    assert 'api_endpoints' in data

def test_health_endpoint(client):
    """Test the GET /api/health endpoint structure and contents."""
    response = client.get('/api/health')
    assert response.status_code == 200
    data = response.get_json()
    
    # Assert core health indicators
    assert data['status'] == 'healthy'
    assert data['service'] == 'SmartRoute Pro'
    assert data['version'] in ['2.0.0', '3.0.0', '4.0.0', '5.0.0', '6.0.0', '7.0.0', '8.0.0']
    
    # Assert Academic Modules integration metadata
    modules = data['academic_modules']
    assert 'ADA' in modules
    assert 'SDA' in modules
    assert 'CC' in modules
    
    # Assert Database status specifies active connection
    assert 'database' in data
    assert data['database']['connected'] is True

def test_not_found_endpoint(client):
    """Test consistent JSON error responses on unknown routes."""
    response = client.get('/api/nonexistent-route')
    assert response.status_code == 404
    data = response.get_json()
    assert data['error'] == 'Not Found'
    assert data['status_code'] == 404
    assert 'message' in data
