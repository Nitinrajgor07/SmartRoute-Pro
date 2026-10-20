from functools import wraps
from flask import request, jsonify, current_app
from flask_jwt_extended import (
    verify_jwt_in_request,
    get_jwt,
    get_jwt_identity,
    create_access_token,
    create_refresh_token
)
from app.models import User, TokenBlocklist
from app.extensions import db

def create_auth_tokens(user):
    """Generates short-lived access token and long-lived refresh token for user."""
    identity = str(user.id)
    claims = {
        "role": (user.role or "VIEWER").upper(),
        "email": user.email,
        "name": user.name
    }
    access_token = create_access_token(identity=identity, additional_claims=claims)
    refresh_token = create_refresh_token(identity=identity, additional_claims=claims)
    return access_token, refresh_token

def get_user_block_reason(user):
    """
    Returns the sign-in/access block reason for a user: 'disabled', 'pending', or 'rejected'.
    Returns None if the user is allowed to sign in and access the system.
    """
    if not user:
        return 'disabled'
    if not user.is_active:
        return 'disabled'
    approval_status = getattr(user, 'approval_status', 'approved')
    if approval_status == 'pending':
        return 'pending'
    if approval_status == 'rejected':
        return 'rejected'
    return None

def get_blocked_response(reason, context='auth'):
    """
    Generate JSON response and status code for blocked users.
    context: 'login' (403 for blocked accounts) or 'auth' (401 for JWT protected endpoints)
    """
    if reason == 'pending':
        status_code = 403 if context == 'login' else 401
        error_type = "Forbidden" if context == 'login' else "Unauthorized"
        return jsonify({
            "error": error_type,
            "message": "Your account is waiting for admin approval.",
            "status_code": status_code
        }), status_code

    if reason == 'rejected':
        status_code = 403 if context == 'login' else 401
        error_type = "Forbidden" if context == 'login' else "Unauthorized"
        return jsonify({
            "error": error_type,
            "message": "Your request was rejected. Contact an administrator.",
            "status_code": status_code
        }), status_code

    if reason == 'disabled':
        if context == 'login':
            return jsonify({
                "error": "Forbidden",
                "message": "Your user account is disabled. Please contact your system administrator.",
                "status_code": 403
            }), 403
        else:
            return jsonify({
                "error": "Unauthorized",
                "message": "User session is invalid or user account is disabled.",
                "status_code": 401
            }), 401

    return None

def role_required(allowed_roles, allow_api_key=True):
    """
    Decorator enforcing role-based access control.
    Accepts valid JWT Bearer token matching allowed_roles,
    OR a valid service-to-service X-API-Key header (when allow_api_key is True).
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # 1. Check for Service-to-Service API Key authorization (if allowed for route)
            if allow_api_key:
                expected_key = current_app.config.get('SMARTROUTE_API_KEY')
                provided_api_key = request.headers.get('X-API-Key')
                if expected_key and provided_api_key and provided_api_key == expected_key:
                    return fn(*args, **kwargs)

            # 2. Check for JWT Bearer authorization
            try:
                verify_jwt_in_request()
            except Exception:
                return jsonify({
                    "error": "Unauthorized",
                    "message": "Missing or invalid authorization token",
                    "status_code": 401
                }), 401

            identity = get_jwt_identity()
            try:
                user_id = int(identity)
            except (ValueError, TypeError):
                user_id = identity

            user = db.session.get(User, user_id)
            if not user:
                return jsonify({
                    "error": "Unauthorized",
                    "message": "User not found or session invalid",
                    "status_code": 401
                }), 401

            block_reason = get_user_block_reason(user)
            if block_reason:
                return get_blocked_response(block_reason, context='auth')

            user_role = (user.role or 'VIEWER').upper()
            normalized_allowed = [r.upper() for r in allowed_roles]

            if user_role not in normalized_allowed:
                return jsonify({
                    "error": "Forbidden",
                    "message": f"Operation requires one of roles: {', '.join(normalized_allowed)}. Your role is '{user_role}'.",
                    "status_code": 403
                }), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator

def admin_required(allow_api_key=False):
    """Restricted strictly to users with ADMIN role. API Key bypass disabled by default for user management."""
    return role_required(['ADMIN'], allow_api_key=allow_api_key)

def dispatcher_required(allow_api_key=True):
    """Permitted for DISPATCHER and ADMIN roles."""
    return role_required(['ADMIN', 'DISPATCHER'], allow_api_key=allow_api_key)

def authenticated_required(allow_api_key=True):
    """Permitted for any active authenticated user (ADMIN, DISPATCHER, VIEWER)."""
    return role_required(['ADMIN', 'DISPATCHER', 'VIEWER'], allow_api_key=allow_api_key)

def seed_evaluation_accounts(app):
    """Seeds or synchronizes the standard evaluation demo accounts."""
    import os
    with app.app_context():
        # 1. Administrator
        admin_email = os.getenv('ADMIN_EMAIL', app.config.get('ADMIN_EMAIL', 'admin@smartroute.pro')).strip().lower()
        admin_pwd = os.getenv('INITIAL_ADMIN_PASSWORD') or os.getenv('ADMIN_PASSWORD') or app.config.get('INITIAL_ADMIN_PASSWORD')
        admin = User.query.filter_by(email=admin_email).first()
        if not admin:
            if admin_pwd:
                admin = User(
                    name="System Administrator",
                    email=admin_email,
                    role="ADMIN",
                    approval_status="approved",
                    is_active=True
                )
                admin.set_password(admin_pwd)
                db.session.add(admin)
            else:
                app.logger.warning("INITIAL_ADMIN_PASSWORD is not set; skipping automatic creation of administrator account.")
        else:
            admin.role = "ADMIN"
            admin.approval_status = "approved"
            admin.is_active = True
            if admin_pwd:
                admin.set_password(admin_pwd)

        # 2. Dispatcher
        disp_email = os.getenv('DISPATCHER_EMAIL', 'dispatcher@smartroute.pro').strip().lower()
        disp_pwd = os.getenv('DEMO_DISPATCHER_PASSWORD') or os.getenv('DISPATCHER_PASSWORD')
        disp = User.query.filter_by(email=disp_email).first()
        if not disp:
            if disp_pwd:
                disp = User(
                    name="Senior Logistics Dispatcher",
                    email=disp_email,
                    role="DISPATCHER",
                    approval_status="approved",
                    is_active=True
                )
                disp.set_password(disp_pwd)
                db.session.add(disp)
        else:
            disp.role = "DISPATCHER"
            disp.approval_status = "approved"
            disp.is_active = True
            if disp_pwd:
                disp.set_password(disp_pwd)

        # 3. Viewer
        viewer_email = os.getenv('VIEWER_EMAIL', 'viewer@smartroute.pro').strip().lower()
        viewer_pwd = os.getenv('DEMO_VIEWER_PASSWORD') or os.getenv('VIEWER_PASSWORD')
        viewer = User.query.filter_by(email=viewer_email).first()
        if not viewer:
            if viewer_pwd:
                viewer = User(
                    name="Viewer User",
                    email=viewer_email,
                    role="VIEWER",
                    approval_status="approved",
                    is_active=True
                )
                viewer.set_password(viewer_pwd)
                db.session.add(viewer)
        else:
            viewer.name = "Viewer User"
            viewer.role = "VIEWER"
            viewer.approval_status = "approved"
            viewer.is_active = True
            if viewer_pwd:
                viewer.set_password(viewer_pwd)

        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error seeding evaluation users: {e}")

def bootstrap_initial_users(app):
    """
    Ensures operational accounts exist.
    In production: Never seeds demo accounts unless SEED_DEMO_USERS=true. Admin password from env.
    In development & testing: Seeds demo accounts for automated evaluation and quick testing.
    """
    import os
    env = app.config.get('ENV', 'development')
    if env == 'production':
        prod_admin_email = os.getenv('ADMIN_EMAIL', app.config.get('ADMIN_EMAIL', 'admin@smartroute.pro')).strip().lower()
        prod_admin_password = os.getenv('INITIAL_ADMIN_PASSWORD') or os.getenv('ADMIN_PASSWORD') or app.config.get('INITIAL_ADMIN_PASSWORD')
        if prod_admin_email and prod_admin_password:
            with app.app_context():
                admin = User.query.filter_by(email=prod_admin_email).first()
                if not admin:
                    admin = User(
                        name="System Administrator",
                        email=prod_admin_email,
                        role="ADMIN",
                        approval_status="approved",
                        is_active=True
                    )
                    admin.set_password(prod_admin_password)
                    db.session.add(admin)
                else:
                    admin.role = "ADMIN"
                    admin.approval_status = "approved"
                    admin.is_active = True
                    admin.set_password(prod_admin_password)
                try:
                    db.session.commit()
                    app.logger.info(f"Production admin bootstrapped from environment: {prod_admin_email}")
                except Exception as e:
                    db.session.rollback()
                    app.logger.error(f"Failed to bootstrap production admin: {e}")

        # Seed demo users in production only when explicitly requested
        if os.getenv('SEED_DEMO_USERS', '').lower() in ('true', '1', 'yes'):
            seed_evaluation_accounts(app)
        return

    # In development and testing: seed demo accounts
    seed_evaluation_accounts(app)

