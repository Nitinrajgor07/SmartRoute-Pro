from functools import wraps
from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from app.models import User
from app.extensions import db

# Single canonical permission table mapping permission names to allowed roles
PERMISSION_ROLES = {
    'dashboard:read': ['ADMIN', 'DISPATCHER', 'VIEWER'],
    'dashboard:revenue': ['ADMIN', 'DISPATCHER'],
    'profile:self': ['ADMIN', 'DISPATCHER', 'VIEWER'],
    'deliveries:read': ['DISPATCHER'],
    'deliveries:write': ['DISPATCHER'],
    'routes:read': ['DISPATCHER'],
    'routes:calculate': ['DISPATCHER'],
    'zones:read': ['DISPATCHER'],
    'zones:run': ['DISPATCHER'],
    'analytics:read': ['ADMIN', 'DISPATCHER'],
    'reports:analytics': ['ADMIN', 'DISPATCHER'],
    'reports:operational': ['DISPATCHER'],  # Delivery, Route, Zones reports
    'reports:system': ['ADMIN'],            # System Status report, Full Summary
    'system:read': ['ADMIN'],
    'users:manage': ['ADMIN'],
    'parcels:own': ['VIEWER'],
    'parcels:create': ['VIEWER'],
    'reports:my_parcels': ['VIEWER'],
}

def get_user_permissions(role: str) -> list[str]:
    """Returns the list of permissions granted to a given role name."""
    if not role:
        return []
    normalized_role = role.strip().upper()
    return [
        perm for perm, allowed_roles in PERMISSION_ROLES.items()
        if normalized_role in allowed_roles
    ]

def permission_required(permission_name: str, allow_api_key: bool = True):
    """
    Decorator enforcing fine-grained permission-based access control.
    Accepts:
    1. Valid service-to-service X-API-Key header (when allow_api_key is True).
    2. Valid JWT Bearer token whose user role is granted permission_name.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # 1. Check for Service-to-Service API Key authorization
            if allow_api_key:
                expected_key = current_app.config.get('SMARTROUTE_API_KEY')
                provided_api_key = request.headers.get('X-API-Key')
                if expected_key and provided_api_key and provided_api_key == expected_key:
                    return fn(*args, **kwargs)

            # 2. Check for JWT Bearer authorization
            import jwt as pyjwt
            from flask_jwt_extended.exceptions import JWTExtendedException
            try:
                verify_jwt_in_request()
            except (JWTExtendedException, pyjwt.PyJWTError):
                raise
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

            from app.utils.auth import get_user_block_reason, get_blocked_response
            block_reason = get_user_block_reason(user)
            if block_reason:
                return get_blocked_response(block_reason, context='auth')

            user_role = (user.role or 'VIEWER').strip().upper()
            allowed_roles = PERMISSION_ROLES.get(permission_name, [])

            if user_role not in allowed_roles:
                return jsonify({
                    "error": "Forbidden",
                    "message": f"Operation requires permission '{permission_name}'. Your role is '{user_role}'.",
                    "status_code": 403
                }), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator
