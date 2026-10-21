import os
import pytest
from app import create_app
from app.config import ProductionConfig, get_database_uri

@pytest.fixture
def client():
    """Testing client running in isolated testing environment with admin authorization."""
    app = create_app('testing')
    with app.app_context():
        from flask_jwt_extended import create_access_token
        from app.models import User
        admin = User.query.filter_by(role='ADMIN').first()
        admin_id = str(admin.id) if admin else "1"
        token = create_access_token(identity=admin_id, additional_claims={"role": "ADMIN", "email": "admin@smartroute.pro"})
    c = app.test_client()
    c.environ_base['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    return c

def test_1_cloud_health_endpoint(client):
    """Test GET /api/cloud/health returns valid schema, service name, and 200 OK."""
    response = client.get('/api/cloud/health')
    assert response.status_code == 200
    data = response.get_json()
    
    assert data['status'] in ['healthy', 'degraded']
    assert data['service'] == 'SmartRoute Pro'
    assert data['version'] in ['5.0.0', '6.0.0', '7.0.0', '8.0.0']
    assert 'database' in data
    assert 'total_latency_ms' in data
    assert 'academic_modules' in data
    assert 'CC' in data['academic_modules']

def test_2_database_connectivity_status(client):
    """Test that database connectivity is verified and ping latency is reported."""
    response = client.get('/api/cloud/health')
    assert response.status_code == 200
    data = response.get_json()
    
    db_info = data['database']
    assert db_info['connected'] is True
    assert db_info['latency_ms'] is not None
    assert db_info['latency_ms'] >= 0
    assert db_info['pool_pre_ping'] is True

def test_3_production_config_validation():
    """Test ProductionConfig parameters and connection pool settings."""
    prod_cfg = ProductionConfig()
    assert prod_cfg.DEBUG is False
    assert prod_cfg.ENV == 'production'
    
    # Engine pool options
    pool_options = prod_cfg.SQLALCHEMY_ENGINE_OPTIONS
    assert pool_options['pool_pre_ping'] is True
    assert pool_options['pool_recycle'] == 1800
    assert pool_options['pool_size'] == 10
    assert pool_options['max_overflow'] == 20

def test_4_no_sqlite_fallback_in_production(monkeypatch):
    """Verify create_app('production') strictly prohibits SQLite fallback and raises RuntimeError."""
    monkeypatch.setenv('FLASK_ENV', 'production')
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///instance/smartroute_dev.db')
    
    with pytest.raises(RuntimeError) as excinfo:
        create_app('production')
    assert 'strictly forbidden in production' in str(excinfo.value)

def test_5_unreachable_postgres_fails_in_production(monkeypatch):
    """Verify create_app('production') aborts if PostgreSQL host is completely unreachable."""
    monkeypatch.setenv('FLASK_ENV', 'production')
    # Non-existent PostgreSQL host with short timeout
    monkeypatch.setenv('DATABASE_URL', 'postgresql://user:pass@127.0.0.99:9999/dummy_db')
    
    with pytest.raises(RuntimeError) as excinfo:
        create_app('production')
    assert 'Configured PostgreSQL database is not reachable' in str(excinfo.value)

def test_6_no_secret_leakage(client):
    """Verify that none of the cloud operational endpoints leak database passwords or secret keys."""
    endpoints = [
        '/api/cloud/health',
        '/api/cloud/services',
        '/api/cloud/deployment',
        '/api/cloud/metrics'
    ]
    
    for ep in endpoints:
        resp = client.get(ep)
        assert resp.status_code == 200
        raw_text = resp.get_data(as_text=True)
        # Sensitive credentials must never appear in responses
        assert 'postgres_local_dev_secret' not in raw_text
        assert 'smart-route-pro-default-dev-secret-key-2026' not in raw_text
        assert 'smartroute-docker-compose-secret-key-2026' not in raw_text
        assert ':5432/' not in raw_text or '***' in raw_text or 'localhost' in raw_text

def test_7_cloud_services_status_responses(client):
    """Test GET /api/cloud/services returns components and marks unconfigured services accurately."""
    response = client.get('/api/cloud/services')
    assert response.status_code == 200
    data = response.get_json()
    
    assert 'services' in data
    assert 'total_services' in data
    assert 'operational_count' in data
    
    srv_ids = [s['id'] for s in data['services']]
    assert 'srv-frontend' in srv_ids
    assert 'srv-backend' in srv_ids
    assert 'srv-database' in srv_ids
    assert 'srv-ada' in srv_ids
    assert 'srv-sda' in srv_ids
    
    # Third party unconfigured services must be marked 'Not Configured', never falsely 'Operational'
    unconfigured = [s for s in data['services'] if s['id'] in ['srv-object-storage', 'srv-cache-queue']]
    for u in unconfigured:
        assert u['status'] == 'Not Configured'
        assert u['is_measured'] is False

def test_8_cloud_deployment_metadata(client):
    """Test GET /api/cloud/deployment returns clean metadata, git commit, and CI/CD stages."""
    response = client.get('/api/cloud/deployment')
    assert response.status_code == 200
    data = response.get_json()
    
    assert data['version'] in ['5.0.0', '6.0.0', '7.0.0', '8.0.0']
    assert 'git_commit' in data
    assert 'backend_url' in data
    assert 'frontend_url' in data
    assert 'ci_cd_pipeline' in data
    assert data['ci_cd_pipeline']['platform'] == 'GitHub Actions'
    assert len(data['ci_cd_pipeline']['stages']) >= 3

def test_9_cloud_metrics_handling(client):
    """Test GET /api/cloud/metrics returns real process uptime and database entity counts."""
    response = client.get('/api/cloud/metrics')
    assert response.status_code == 200
    data = response.get_json()
    
    assert 'process_metrics' in data
    assert data['process_metrics']['uptime_seconds'] >= 0
    assert 'pid' in data['process_metrics']
    
    assert 'database_metrics' in data
    db_metrics = data['database_metrics']
    assert 'total_deliveries' in db_metrics
    assert 'total_locations' in db_metrics
    assert 'total_active_roads' in db_metrics
    
    assert 'metric_transparency' in data
    assert data['metric_transparency']['uptime'] == 'measured'

def test_10_security_headers_present(client):
    """Verify security headers are attached to every response via after_request middleware."""
    response = client.get('/api/cloud/health')
    assert response.headers.get('X-Content-Type-Options') == 'nosniff'
    assert response.headers.get('X-Frame-Options') == 'DENY'
    assert response.headers.get('X-XSS-Protection') == '1; mode=block'
    assert response.headers.get('Referrer-Policy') == 'strict-origin-when-cross-origin'

def test_11_mutation_protection_when_enabled(monkeypatch):
    """Verify that when REQUIRE_API_KEY_FOR_MUTATIONS is True, unauthorized mutations are rejected."""
    app = create_app('testing')
    app.config['REQUIRE_API_KEY_FOR_MUTATIONS'] = True
    app.config['SMARTROUTE_API_KEY'] = 'test-secret-key-123'
    
    with app.test_client() as c:
        # Mutation without key must be 401
        res = c.post('/api/deliveries', json={'test': 123})
        assert res.status_code == 401
        assert res.get_json()['error'] == 'Unauthorized'
        
        # Public health/cloud endpoints must still be accessible
        health_res = c.get('/api/cloud/health')
        assert health_res.status_code == 200
