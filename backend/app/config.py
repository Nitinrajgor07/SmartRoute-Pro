import os
import datetime
from dotenv import load_dotenv

load_dotenv()

def get_database_uri():
    """Retrieve and normalize database URI for PostgreSQL / SQLAlchemy."""
    raw_uri = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/smartroute_db')
    if raw_uri.startswith('postgres://'):
        raw_uri = raw_uri.replace('postgres://', 'postgresql://', 1)
    return raw_uri

class Config:
    """Base configuration settings for SmartRoute Pro."""
    SECRET_KEY = os.getenv('SECRET_KEY', 'smart-route-pro-default-dev-secret-key-2026')
    APP_NAME = "SmartRoute Pro"
    VERSION = "8.0.0"
    
    # Deployment & Operational Metadata
    GIT_COMMIT_SHA = os.getenv('RENDER_GIT_COMMIT', os.getenv('GIT_COMMIT', os.getenv('GIT_COMMIT_SHA', 'local-git')))
    DEPLOYMENT_TIMESTAMP = os.getenv('DEPLOYMENT_TIMESTAMP')
    BACKEND_PUBLIC_URL = os.getenv('BACKEND_PUBLIC_URL', 'http://127.0.0.1:5000')
    HOSTING_PLATFORM = os.getenv('HOSTING_PLATFORM', 'Local Workstation / Cloud Ready Host')
    
    # Security & JWT Configuration
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # 16 MB request limit
    SMARTROUTE_API_KEY = os.getenv('SMARTROUTE_API_KEY', '')
    REQUIRE_API_KEY_FOR_MUTATIONS = os.getenv('REQUIRE_API_KEY_FOR_MUTATIONS', 'false').lower() == 'true'
    
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'smart-route-pro-jwt-secret-key-2026-enterprise')
    JWT_ACCESS_TOKEN_EXPIRES = datetime.timedelta(hours=int(os.getenv('JWT_ACCESS_EXPIRES_HOURS', 2)))
    JWT_REFRESH_TOKEN_EXPIRES = datetime.timedelta(days=int(os.getenv('JWT_REFRESH_EXPIRES_DAYS', 30)))
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'
    JWT_ERROR_MESSAGE_KEY = 'message'

    # Admin Bootstrap Settings
    ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin@smartroute.pro')
    INITIAL_ADMIN_PASSWORD = os.getenv('INITIAL_ADMIN_PASSWORD')

    # Approval Workflow Roles
    APPROVAL_REQUIRED_ROLES = ['VIEWER', 'DISPATCHER']

    # CORS Settings
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:80,http://127.0.0.1:80').split(',')
    
    # Database Configuration
    SQLALCHEMY_DATABASE_URI = get_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': int(os.getenv('DB_POOL_RECYCLE', 1800))
    }
    
    # Core Modules Information
    MODULES = {
        "ADA": {
            "title": "Analysis and Design of Algorithms",
            "scope": "Route Optimization (Graph Theory, Dijkstra Min-Priority Queue, Execution Tracing)",
            "status": "Operational: Dijkstra Min-Heap O((V+E)log V) & Step Tracing Active"
        },
        "SDA": {
            "title": "Statistical Data Analysis",
            "scope": "Spatial Cluster Analysis & Statistics (K-Means, Metric Projection, Silhouette Scoring, OLS Regression)",
            "status": "Operational: K-Means Spatial Clustering, Silhouette Analysis & OLS Regression Active"
        },
        "CC": {
            "title": "Cloud Computing",
            "scope": "Docker Containerization, Managed PostgreSQL, Health Probes, Cloud Deployment & CI/CD Pipeline",
            "status": "Operational: Multi-Stage Docker, Gunicorn WSGI, Operational Telemetry & CI/CD Active"
        }
    }

class DevelopmentConfig(Config):
    """Development environment configuration."""
    DEBUG = True
    ENV = 'development'

class TestingConfig(Config):
    """Testing environment configuration with isolated in-memory database."""
    TESTING = True
    DEBUG = True
    ENV = 'testing'
    RATELIMIT_ENABLED = False
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True
    }

class ProductionConfig(Config):
    """Production environment configuration with strict PostgreSQL enforcement and connection pooling."""
    DEBUG = False
    ENV = 'production'
    SECRET_KEY = os.getenv('SECRET_KEY')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    INITIAL_ADMIN_PASSWORD = os.getenv('INITIAL_ADMIN_PASSWORD')
    
    # Production connection pool parameters
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': int(os.getenv('DB_POOL_SIZE', 10)),
        'max_overflow': int(os.getenv('DB_MAX_OVERFLOW', 20)),
        'pool_recycle': int(os.getenv('DB_POOL_RECYCLE', 1800)),
        'pool_pre_ping': True,
        'pool_timeout': int(os.getenv('DB_POOL_TIMEOUT', 30))
    }

config_by_name = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
