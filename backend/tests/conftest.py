import os

# Set testing defaults so tests can run in isolated environments without an external .env file
os.environ.setdefault('INITIAL_ADMIN_PASSWORD', 'Admin@123456')
os.environ.setdefault('DEMO_DISPATCHER_PASSWORD', 'Dispatch@123456')
os.environ.setdefault('DEMO_VIEWER_PASSWORD', 'Viewer@123456')
os.environ.setdefault('SECRET_KEY', 'smartroute-test-secret-key-2026')
os.environ.setdefault('JWT_SECRET_KEY', 'smartroute-test-jwt-secret-key-2026')
