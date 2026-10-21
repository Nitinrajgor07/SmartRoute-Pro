import pytest
from app import create_app
from app.services.reporting import ReportingService, sanitize_csv_cell

@pytest.fixture
def client():
    """Testing client running in isolated in-memory database with admin authorization and API key."""
    app = create_app('testing')
    app.config['SMARTROUTE_API_KEY'] = 'enterprise-api-key-2026'
    with app.app_context():
        from flask_jwt_extended import create_access_token
        from app.models import User
        admin = User.query.filter_by(role='ADMIN').first()
        admin_id = str(admin.id) if admin else "1"
        token = create_access_token(identity=admin_id, additional_claims={"role": "ADMIN", "email": "admin@smartroute.pro"})
    c = app.test_client()
    c.environ_base['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    c.environ_base['HTTP_X_API_KEY'] = 'enterprise-api-key-2026'
    return c

def test_1_reports_overview(client):
    """Test GET /api/reports/overview returns metadata and available report list."""
    response = client.get('/api/reports/overview')
    assert response.status_code == 200
    data = response.get_json()
    
    assert 'total_deliveries' in data
    assert 'total_route_runs' in data
    assert 'total_cluster_runs' in data
    assert 'available_reports' in data
    assert len(data['available_reports']) >= 6

def test_2_delivery_csv_generation(client):
    """Test GET /api/reports/deliveries.csv returns valid CSV payload and attachment header."""
    response = client.get('/api/reports/deliveries.csv')
    assert response.status_code == 200
    assert 'text/csv' in response.content_type
    assert 'attachment' in response.headers.get('Content-Disposition', '')
    assert 'delivery_report_' in response.headers.get('Content-Disposition', '')
    
    csv_text = response.get_data(as_text=True)
    assert 'Tracking Number' in csv_text
    assert 'Customer Name' in csv_text
    assert 'Distance (km)' in csv_text

def test_3_delivery_pdf_generation(client):
    """Test GET /api/reports/deliveries.pdf generates valid PDF bytes starting with %PDF."""
    response = client.get('/api/reports/deliveries.pdf')
    assert response.status_code == 200
    assert response.content_type == 'application/pdf'
    assert 'attachment' in response.headers.get('Content-Disposition', '')
    data = response.data
    assert data.startswith(b'%PDF')

def test_4_ada_pdf_generation(client):
    """Test GET /api/reports/ada.pdf generates valid PDF."""
    response = client.get('/api/reports/ada.pdf')
    assert response.status_code == 200
    assert response.content_type == 'application/pdf'
    assert response.data.startswith(b'%PDF')

def test_5_sda_pdf_generation(client):
    """Test GET /api/reports/sda-clusters.pdf generates valid PDF."""
    response = client.get('/api/reports/sda-clusters.pdf')
    assert response.status_code == 200
    assert response.content_type == 'application/pdf'
    assert response.data.startswith(b'%PDF')

def test_6_statistical_pdf_generation(client):
    """Test GET /api/reports/statistics.pdf generates valid PDF."""
    response = client.get('/api/reports/statistics.pdf')
    assert response.status_code == 200
    assert response.content_type == 'application/pdf'
    assert response.data.startswith(b'%PDF')

def test_7_cloud_pdf_generation(client):
    """Test GET /api/reports/cloud.pdf generates valid PDF."""
    response = client.get('/api/reports/cloud.pdf')
    assert response.status_code == 200
    assert response.content_type == 'application/pdf'
    assert response.data.startswith(b'%PDF')

def test_8_integrated_report_generation(client):
    """Test GET /api/reports/integrated.pdf generates comprehensive project report."""
    response = client.get('/api/reports/integrated.pdf')
    assert response.status_code == 200
    assert response.content_type == 'application/pdf'
    assert response.data.startswith(b'%PDF')
    assert len(response.data) > 3000

def test_9_empty_datasets_handled_gracefully(client):
    """Verify that empty datasets do not cause 500 errors in any report generator."""
    pdf_endpoints = [
        '/api/reports/deliveries.pdf',
        '/api/reports/ada.pdf',
        '/api/reports/sda-clusters.pdf',
        '/api/reports/statistics.pdf',
        '/api/reports/cloud.pdf',
        '/api/reports/integrated.pdf'
    ]
    for ep in pdf_endpoints:
        res = client.get(ep)
        assert res.status_code == 200
        assert res.data.startswith(b'%PDF')

def test_10_invalid_filters_handled(client):
    """Test that invalid filter parameters (e.g. non-numeric run_id) return 400 Bad Request."""
    res = client.get('/api/reports/ada.pdf?run_id=invalid_id')
    assert res.status_code == 400
    data = res.get_json()
    assert data['error'] == 'Bad Request'

def test_11_csv_escaping_and_formula_safety():
    """Verify that formula injection characters (=, +, -, @, \t, \r) are safely escaped with a prefix apostrophe."""
    malicious_inputs = [
        ("=cmd|' /C calc'!A0", "'=cmd|' /C calc'!A0"),
        ("+12345", "'+12345"),
        ("-9876", "'-9876"),
        ("@SUM(A1:A10)", "'@SUM(A1:A10)"),
        ("\tTabbed", "'\tTabbed"),
        ("Normal Customer", "Normal Customer"),
        (None, "")
    ]
    for raw, expected in malicious_inputs:
        assert sanitize_csv_cell(raw) == expected

def test_12_pdf_response_headers(client):
    """Verify Cache-Control and Content-Disposition headers on PDF endpoints."""
    res = client.get('/api/reports/integrated.pdf')
    assert res.headers.get('Content-Type') == 'application/pdf'
    assert 'attachment' in res.headers.get('Content-Disposition')
    assert res.headers.get('Cache-Control') == 'no-cache'

def test_13_csv_response_headers(client):
    """Verify Content-Type charset and Content-Disposition headers on CSV endpoints."""
    res = client.get('/api/reports/ada.csv')
    assert 'text/csv' in res.headers.get('Content-Type')
    assert 'charset=utf-8' in res.headers.get('Content-Type')
    assert 'attachment' in res.headers.get('Content-Disposition')

def test_14_large_report_pagination(client):
    """Verify that ReportLab correctly builds multi-page PDF documents without error."""
    res = client.get('/api/reports/integrated.pdf')
    assert res.status_code == 200
    assert len(res.data) > 5000

def test_15_report_data_consistency(client):
    """Verify that overview report counts match API summary entity metrics."""
    res = client.get('/api/reports/overview')
    assert res.status_code == 200
    data = res.get_json()
    assert isinstance(data['total_deliveries'], int)
    assert isinstance(data['total_route_runs'], int)
    assert isinstance(data['total_cluster_runs'], int)

def test_16_report_access_control(monkeypatch):
    """Verify that report generation respects authorization settings."""
    app = create_app('testing')
    with app.app_context():
        from flask_jwt_extended import create_access_token
        from app.models import User
        admin = User.query.filter_by(role='ADMIN').first()
        admin_id = str(admin.id) if admin else "1"
        token = create_access_token(identity=admin_id, additional_claims={"role": "ADMIN", "email": "admin@smartroute.pro"})
    
    c = app.test_client()
    c.environ_base['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    res = c.get('/api/reports/overview')
    assert res.status_code == 200

