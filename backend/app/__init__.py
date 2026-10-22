import os
import datetime
from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy import text, create_engine
from .config import config_by_name
from .extensions import db, migrate

def is_database_reachable(uri):
    """Quick probe to test if database server is reachable."""
    if not uri or 'sqlite' in uri:
        return True
    try:
        test_engine = create_engine(uri, connect_args={'connect_timeout': 2} if 'postgres' in uri else {})
        with test_engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        test_engine.dispose()
        return True
    except Exception:
        return False

def create_app(config_name=None):
    """Application factory for SmartRoute Pro Flask API with database persistence and connection validation."""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
        
    application = Flask(__name__)
    cfg = config_by_name.get(config_name, config_by_name['default'])
    application.config.from_object(cfg)

    # Store exact process creation timestamp (UTC ISO format)
    start_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    application.config['DEPLOYED_AT'] = start_iso
    application.config['DEPLOYMENT_TIMESTAMP'] = start_iso
    
    # Configure CORS for frontend access
    cors_origins = application.config.get('CORS_ORIGINS', ['*'])
    CORS(application, resources={
        r"/api/*": {
            "origins": cors_origins if cors_origins != ['*'] else "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-API-Key"]
        }
    })

    # Validate database connection and enforce strict production rules
    env_db_url = os.getenv('DATABASE_URL')
    if env_db_url and not application.config.get('TESTING'):
        if env_db_url.startswith('postgres://'):
            env_db_url = env_db_url.replace('postgres://', 'postgresql://', 1)
        application.config['SQLALCHEMY_DATABASE_URI'] = env_db_url
    target_uri = application.config.get('SQLALCHEMY_DATABASE_URI', '')
    if application.config.get('ENV') == 'production':
        if not target_uri or 'sqlite' in target_uri or ('postgres' not in target_uri):
            raise RuntimeError(
                "Production mode configuration error: Valid PostgreSQL DATABASE_URL is required. "
                "Silent fallback to SQLite is strictly forbidden in production."
            )
        if not is_database_reachable(target_uri):
            raise RuntimeError(
                "Production mode database error: Configured PostgreSQL database is not reachable. "
                "Startup aborted to prevent silent fallback or data inconsistency."
            )
        missing_secrets = []
        if not application.config.get('SECRET_KEY'):
            missing_secrets.append('SECRET_KEY')
        if not application.config.get('JWT_SECRET_KEY'):
            missing_secrets.append('JWT_SECRET_KEY')
        if not application.config.get('INITIAL_ADMIN_PASSWORD'):
            missing_secrets.append('INITIAL_ADMIN_PASSWORD')
        if missing_secrets:
            raise RuntimeError(
                f"Production mode startup error: Missing required environment variable(s): {', '.join(missing_secrets)}. "
                "In production, SECRET_KEY, JWT_SECRET_KEY, and INITIAL_ADMIN_PASSWORD must be configured."
            )
        application.config['DB_CONNECTED'] = True
    elif application.config.get('ENV') == 'development' and 'postgres' in target_uri:
        if not is_database_reachable(target_uri):
            os.makedirs(application.instance_path, exist_ok=True)
            fallback_db_path = os.path.join(application.instance_path, 'smartroute_dev.db')
            fallback_uri = f'sqlite:///{fallback_db_path}'
            application.logger.warning(
                f"PostgreSQL connection to {target_uri} was not reachable. "
                f"Falling back to local persistent SQLite at {fallback_uri}. "
                f"To connect to PostgreSQL, start your PostgreSQL service and verify DATABASE_URL in .env"
            )
            application.config['SQLALCHEMY_DATABASE_URI'] = fallback_uri
            application.config['DB_CONNECTED'] = True
        else:
            application.config['DB_CONNECTED'] = True
    elif application.config.get('TESTING'):
        application.config['DB_CONNECTED'] = True
    else:
        application.config['DB_CONNECTED'] = is_database_reachable(target_uri)

    # Initialize SQLAlchemy, Flask-Migrate, Flask-JWT-Extended & Flask-Limiter
    db.init_app(application)
    migrate.init_app(application, db)
    from .extensions import jwt, limiter
    jwt.init_app(application)
    limiter.init_app(application)

    # Import models, ensure tables exist, and bootstrap initial users
    with application.app_context():
        from . import models  # noqa: F401
        from .models import User, TokenBlocklist
        try:
            db.create_all()
        except Exception as e:
            application.logger.error(f"Table creation error: {e}")

        # JWT Token Callbacks
        @jwt.token_in_blocklist_loader
        def check_if_token_revoked(jwt_header, jwt_payload):
            jti = jwt_payload["jti"]
            token = TokenBlocklist.query.filter_by(jti=jti).first()
            return token is not None

        @jwt.user_lookup_loader
        def user_lookup_callback(_jwt_header, jwt_data):
            identity = jwt_data["sub"]
            try:
                user_id = int(identity)
            except Exception:
                user_id = identity
            return db.session.get(User, user_id)

        @jwt.unauthorized_loader
        def missing_token_callback(reason):
            return jsonify({
                "error": "Unauthorized",
                "message": "Missing authorization token in request header.",
                "status_code": 401
            }), 401

        @jwt.expired_token_loader
        def expired_token_callback(jwt_header, jwt_payload):
            return jsonify({
                "error": "Unauthorized",
                "message": "Authorization token has expired. Please refresh your session or re-authenticate.",
                "status_code": 401
            }), 401

        @jwt.invalid_token_loader
        def invalid_token_callback(reason):
            return jsonify({
                "error": "Unauthorized",
                "message": f"Invalid authorization token: {reason}",
                "status_code": 401
            }), 401

        @jwt.revoked_token_loader
        def revoked_token_callback(jwt_header, jwt_payload):
            return jsonify({
                "error": "Unauthorized",
                "message": "This session token has been revoked.",
                "status_code": 401
            }), 401

        # Bootstrap Admin, Dispatcher, and Viewer accounts if absent
        from .utils.auth import bootstrap_initial_users
        bootstrap_initial_users(application)

    # Register API Blueprints
    from .api import api_bp
    application.register_blueprint(api_bp)
    
    # Root status endpoint
    @application.route('/', methods=['GET'])
    def root():
        return jsonify({
            "name": application.config.get('APP_NAME'),
            "version": application.config.get('VERSION'),
            "status": "online",
            "health_endpoint": "/api/health",
            "api_endpoints": {
                "auth": "/api/auth",
                "deliveries": "/api/deliveries",
                "locations": "/api/locations",
                "dashboard_summary": "/api/dashboard/summary",
                "dashboard_recent": "/api/dashboard/recent-deliveries"
            }
        }), 200

    # Security Headers Middleware
    @application.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response

    # Optional Mutation Authorization in Secured Mode
    @application.before_request
    def check_mutation_authorization():
        if application.config.get('REQUIRE_API_KEY_FOR_MUTATIONS'):
            from flask import request
            if request.method in ['POST', 'PUT', 'DELETE']:
                # Health, auth, and cloud probes bypass mutation check
                if (request.path.startswith('/api/auth/') or 
                    request.path.startswith('/api/cloud/') or 
                    request.path == '/api/health'):
                    return None

                expected_key = application.config.get('SMARTROUTE_API_KEY')
                provided_key = request.headers.get('X-API-Key')
                if expected_key and provided_key == expected_key:
                    return None

                # Check if valid JWT is present
                from flask_jwt_extended import verify_jwt_in_request
                try:
                    verify_jwt_in_request()
                    return None
                except Exception:
                    pass

                # Backward compatibility: Authorization header containing API key directly
                provided_auth = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
                if expected_key and provided_auth == expected_key:
                    return None

                return jsonify({
                    "error": "Unauthorized",
                    "message": "Mutation requests require a valid X-API-Key or Bearer token header in secured deployment mode.",
                    "status_code": 401
                }), 401
        return None

    # Consistent JSON Error Handlers
    @application.errorhandler(400)
    def bad_request(error):
        return jsonify({
            "error": "Bad Request",
            "message": str(error.description if hasattr(error, 'description') else "Invalid request payload"),
            "status_code": 400
        }), 400

    @application.errorhandler(404)
    def not_found(error):
        return jsonify({
            "error": "Not Found",
            "message": "The requested API endpoint was not found on this server.",
            "status_code": 404
        }), 404

    @application.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({
            "error": "Method Not Allowed",
            "message": "The HTTP method is not permitted for the requested endpoint.",
            "status_code": 405
        }), 405

    @application.errorhandler(409)
    def conflict(error):
        return jsonify({
            "error": "Conflict",
            "message": str(error.description if hasattr(error, 'description') else "Resource conflict or constraint violation"),
            "status_code": 409
        }), 409

    @application.errorhandler(413)
    def request_entity_too_large(error):
        return jsonify({
            "error": "Payload Too Large",
            "message": "Request payload exceeds maximum allowed size (16MB).",
            "status_code": 413
        }), 413

    @application.errorhandler(429)
    def ratelimit_exceeded(error):
        return jsonify({
            "error": "Too Many Requests",
            "message": "Rate limit exceeded. Please wait a moment before trying again.",
            "status_code": 429
        }), 429

    @application.errorhandler(500)
    def internal_server_error(error):
        return jsonify({
            "error": "Internal Server Error",
            "message": "An unexpected server error occurred. Please check backend logs.",
            "status_code": 500
        }), 500

    # Administrative CLI Commands
    import click

    @application.cli.command("create-admin")
    @click.option("--email", prompt=True, help="Admin user email address")
    @click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True, help="Admin user password")
    @click.option("--name", default="System Administrator", help="Admin user full name")
    def create_admin_cmd(email, password, name):
        """Create or promote a user to Administrator without hardcoded seeds."""
        from .models import User
        with application.app_context():
            user = User.query.filter_by(email=email.strip().lower()).first()
            if user:
                user.role = "ADMIN"
                user.set_password(password)
                user.is_active = True
                db.session.commit()
                click.echo(f"[+] Successfully promoted existing user {email} to ADMIN.")
            else:
                admin = User(name=name, email=email.strip().lower(), role="ADMIN", is_active=True)
                admin.set_password(password)
                db.session.add(admin)
                db.session.commit()
                click.echo(f"[+] Successfully created new ADMIN account: {email}")

    @application.cli.command("backfill-prices")
    def backfill_prices_cmd():
        """Set price for deliveries where price is NULL based on weight and priority."""
        from .models import Delivery
        from .services.pricing import calculate_parcel_price
        with application.app_context():
            unpriced = Delivery.query.filter(Delivery.price.is_(None)).all()
            changed = 0
            for delivery in unpriced:
                calculated = calculate_parcel_price(delivery.package_weight_kg, delivery.priority)
                if calculated is not None:
                    delivery.price = calculated
                    changed += 1
            if changed > 0:
                db.session.commit()
            click.echo(f"[+] Backfilled prices for {changed} deliveries.")

    @application.cli.command("seed-demo")
    def seed_demo_cmd():
        """Manually seed standard evaluation demo accounts."""
        from .utils.auth import seed_evaluation_accounts
        with application.app_context():
            seed_evaluation_accounts(application)
            click.echo("[+] Evaluation demo accounts initialized.")

    return application
