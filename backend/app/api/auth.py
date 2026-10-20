import re
import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    jwt_required,
    get_jwt,
    get_jwt_identity
)
from app.extensions import db, limiter
from app.models import User, TokenBlocklist
from app.utils.auth import create_auth_tokens, get_user_block_reason, get_blocked_response
from app.utils.permissions import permission_required, get_user_permissions

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

EMAIL_REGEX = re.compile(r"^[\w\.-]+@([\w\.-]+\.)+[\w-]{2,4}$")

def validate_email_format(email):
    """Validate RFC 5322 compatible email address format."""
    return bool(email and EMAIL_REGEX.match(str(email).strip()))

# ------------------------------------------------------------------------------
# 1. Public Authentication Endpoints
# ------------------------------------------------------------------------------

@auth_bp.route('/register', methods=['POST'])
@limiter.limit("10 per hour")
def register():
    """Register a new user account with requested role pending admin approval."""
    data = request.get_json() or {}
    
    name = str(data.get('name', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))

    # Validation
    if not name or len(name) < 2:
        return jsonify({
            "error": "Bad Request",
            "message": "Full name is required (minimum 2 characters).",
            "status_code": 400
        }), 400

    if not validate_email_format(email):
        return jsonify({
            "error": "Bad Request",
            "message": "Please provide a valid email address.",
            "status_code": 400
        }), 400

    # Password validation: minimum 8 characters, at least one letter, and at least one number
    if len(password) < 8 or not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
        return jsonify({
            "error": "Bad Request",
            "message": "Password must be at least 8 characters long and contain at least one letter and one number.",
            "status_code": 400
        }), 400

    # Read account_type (fallback to role if account_type not provided, or default to VIEWER)
    raw_account_type = data.get('account_type') if 'account_type' in data else data.get('role')
    if raw_account_type is None or str(raw_account_type).strip() == '':
        account_type = 'VIEWER'
    else:
        account_type = str(raw_account_type).strip().upper()

    if account_type not in ('VIEWER', 'DISPATCHER'):
        return jsonify({
            "error": "Bad Request",
            "message": f"Invalid account type '{raw_account_type}'. Allowed account types are 'VIEWER' and 'DISPATCHER'.",
            "status_code": 400
        }), 400

    # Check for duplicate email
    if User.query.filter_by(email=email).first():
        return jsonify({
            "error": "Conflict",
            "message": "An account with this email address already exists.",
            "status_code": 409
        }), 409

    req_roles = current_app.config.get('APPROVAL_REQUIRED_ROLES', ['VIEWER', 'DISPATCHER'])
    approval_status = 'pending' if account_type in req_roles else 'approved'

    new_user = User(
        name=name,
        email=email,
        role='VIEWER',  # Always least privilege until approved
        requested_role=account_type,
        approval_status=approval_status,
        is_active=True
    )
    new_user.set_password(password)

    db.session.add(new_user)
    db.session.commit()

    return jsonify({
        "message": "Registration request submitted. An admin must approve your account before you can sign in.",
        "user": new_user.to_dict()
    }), 201


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("60 per minute")
def login():
    """Authenticate credentials and return JWT access and refresh tokens."""
    data = request.get_json() or {}
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))

    if not email or not password:
        return jsonify({
            "error": "Bad Request",
            "message": "Email and password are required.",
            "status_code": 400
        }), 400

    user = User.query.filter_by(email=email).first()

    # Password check first - avoid account status leaks
    if not user or not user.check_password(password):
        return jsonify({
            "error": "Unauthorized",
            "message": "Invalid email or password.",
            "status_code": 401
        }), 401

    block_reason = get_user_block_reason(user)
    if block_reason:
        return get_blocked_response(block_reason, context='login')

    access_token, refresh_token = create_auth_tokens(user)

    return jsonify({
        "message": "Login successful.",
        "user": user.to_dict(),
        "access_token": access_token,
        "refresh_token": refresh_token
    }), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh_token():
    """Exchange a valid refresh token for a fresh access token."""
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (ValueError, TypeError):
        user_id = identity

    user = db.session.get(User, user_id)
    block_reason = get_user_block_reason(user)
    if block_reason:
        return get_blocked_response(block_reason, context='auth')

    new_access_token, _ = create_auth_tokens(user)
    return jsonify({
        "access_token": new_access_token,
        "message": "Access token refreshed."
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@permission_required('profile:self')
def logout():
    """Revoke the current JWT access token and optional refresh token via token blocklist."""
    jwt_data = get_jwt()
    access_jti = jwt_data.get('jti')
    token_type = jwt_data.get('type', 'access')
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except Exception:
        user_id = None

    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. Revoke access token
    if access_jti:
        db.session.add(TokenBlocklist(
            jti=access_jti,
            token_type=token_type,
            user_id=user_id,
            revoked_at=now
        ))

    # 2. Revoke refresh token if supplied in JSON payload or X-Refresh-Token header
    payload = request.get_json(silent=True) or {}
    refresh_token_candidate = payload.get('refresh_token') or request.headers.get('X-Refresh-Token')
    if refresh_token_candidate:
        try:
            from flask_jwt_extended import decode_token
            decoded = decode_token(refresh_token_candidate)
            refresh_jti = decoded.get('jti')
            if refresh_jti:
                db.session.add(TokenBlocklist(
                    jti=refresh_jti,
                    token_type='refresh',
                    user_id=user_id,
                    revoked_at=now
                ))
        except Exception:
            pass

    db.session.commit()

    return jsonify({
        "message": "Successfully logged out. Session tokens have been revoked.",
        "status_code": 200
    }), 200


# ------------------------------------------------------------------------------
# 2. Authenticated Profile & Account Settings
# ------------------------------------------------------------------------------

@auth_bp.route('/me', methods=['GET'])
@permission_required('profile:self')
def get_current_user():
    """Retrieve profile and granted permissions for currently authenticated user."""
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (ValueError, TypeError):
        user_id = identity

    user = db.session.get(User, user_id)
    block_reason = get_user_block_reason(user)
    if block_reason:
        return get_blocked_response(block_reason, context='auth')

    permissions = get_user_permissions(user.role)

    return jsonify({
        "user": user.to_dict(),
        "permissions": permissions
    }), 200


@auth_bp.route('/profile', methods=['PUT'])
@permission_required('profile:self')
def update_profile():
    """Update profile information (name, email) for current user."""
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (ValueError, TypeError):
        user_id = identity

    user = db.session.get(User, user_id)
    block_reason = get_user_block_reason(user)
    if block_reason:
        return get_blocked_response(block_reason, context='auth')

    data = request.get_json() or {}
    new_name = str(data.get('name', '')).strip()
    new_email = str(data.get('email', '')).strip().lower()

    if new_name:
        if len(new_name) < 2:
            return jsonify({
                "error": "Bad Request",
                "message": "Name must be at least 2 characters.",
                "status_code": 400
            }), 400
        user.name = new_name

    if new_email and new_email != user.email:
        if not validate_email_format(new_email):
            return jsonify({
                "error": "Bad Request",
                "message": "Please provide a valid email address.",
                "status_code": 400
            }), 400
        
        existing = User.query.filter_by(email=new_email).first()
        if existing and existing.id != user.id:
            return jsonify({
                "error": "Conflict",
                "message": "Email is already taken by another account.",
                "status_code": 409
            }), 409
        user.email = new_email

    user.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.session.commit()

    return jsonify({
        "message": "Profile updated successfully.",
        "user": user.to_dict()
    }), 200


@auth_bp.route('/change-password', methods=['PUT'])
@permission_required('profile:self')
def change_password():
    """Safely update user password after verifying existing credentials."""
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (ValueError, TypeError):
        user_id = identity

    user = db.session.get(User, user_id)
    block_reason = get_user_block_reason(user)
    if block_reason:
        return get_blocked_response(block_reason, context='auth')

    data = request.get_json() or {}
    current_password = str(data.get('current_password', ''))
    new_password = str(data.get('new_password', ''))

    if not current_password or not new_password:
        return jsonify({
            "error": "Bad Request",
            "message": "Both current_password and new_password are required.",
            "status_code": 400
        }), 400

    if not user.check_password(current_password):
        return jsonify({
            "error": "Unauthorized",
            "message": "Current password is incorrect.",
            "status_code": 401
        }), 401

    if len(new_password) < 6:
        return jsonify({
            "error": "Bad Request",
            "message": "New password must be at least 6 characters in length.",
            "status_code": 400
        }), 400

    user.set_password(new_password)
    user.updated_at = datetime.datetime.now(datetime.timezone.utc)

    # Invalidate current session token so fresh credentials are required
    jwt_data = get_jwt()
    curr_jti = jwt_data.get('jti')
    if curr_jti:
        db.session.add(TokenBlocklist(
            jti=curr_jti,
            token_type='access',
            user_id=user.id,
            revoked_at=datetime.datetime.now(datetime.timezone.utc)
        ))

    db.session.commit()

    return jsonify({
        "message": "Password changed successfully. Please log in with your new password."
    }), 200


# ------------------------------------------------------------------------------
# 3. Administrative User Management Endpoints (ADMIN only)
# ------------------------------------------------------------------------------

@auth_bp.route('/users', methods=['GET'])
@permission_required('users:manage', allow_api_key=False)
def list_users():
    """List all registered system users with optional approval_status filter (Admin only)."""
    status_filter = request.args.get('approval_status')
    query = User.query
    if status_filter is not None:
        status_filter = status_filter.strip().lower()
        if status_filter not in ['pending', 'approved', 'rejected']:
            return jsonify({
                "error": "Bad Request",
                "message": "Invalid approval_status filter. Must be 'pending', 'approved', or 'rejected'.",
                "status_code": 400
            }), 400
        query = query.filter_by(approval_status=status_filter)

    users = query.order_by(User.created_at.asc()).all()
    return jsonify({
        "users": [u.to_dict() for u in users],
        "total": len(users)
    }), 200


@auth_bp.route('/users/<int:user_id>/role', methods=['PUT'])
@permission_required('users:manage', allow_api_key=False)
def update_user_role(user_id):
    """Modify role for a specific user (Admin only, safety rules enforced)."""
    identity = get_jwt_identity()
    try:
        current_admin_id = int(identity)
    except (ValueError, TypeError):
        current_admin_id = identity
    current_admin = db.session.get(User, current_admin_id)

    user = User.query.get_or_404(user_id)

    # Refuse role changes for pending users - approval is required first
    if user.approval_status == 'pending':
        return jsonify({
            "error": "Conflict",
            "message": "Cannot change role for a pending user. Approve the user account first.",
            "status_code": 409
        }), 409

    data = request.get_json() or {}
    new_role = str(data.get('role', '')).strip().upper()

    if new_role not in ['ADMIN', 'DISPATCHER', 'VIEWER']:
        return jsonify({
            "error": "Bad Request",
            "message": "Invalid role. Must be 'ADMIN', 'DISPATCHER', or 'VIEWER'.",
            "status_code": 400
        }), 400

    # Rule 5: An admin cannot change their own role
    if user.id == current_admin_id:
        return jsonify({
            "error": "Forbidden",
            "message": "Administrators cannot change their own role.",
            "status_code": 403
        }), 403

    # Rule 6: The last active ADMIN cannot be demoted
    if user.role == 'ADMIN' and new_role != 'ADMIN' and user.is_active:
        active_admin_count = User.query.filter_by(role='ADMIN', is_active=True).count()
        if active_admin_count <= 1:
            return jsonify({
                "error": "Bad Request",
                "message": "Cannot demote the last active administrator.",
                "status_code": 400
            }), 400

    old_role = user.role
    user.role = new_role
    user.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.session.commit()

    # Rule 8: Log role change with app.logger.info
    admin_ident = current_admin.email if current_admin else f"ID:{current_admin_id}"
    current_app.logger.info(
        f"Role change: admin={admin_ident} changed user={user.email} (ID:{user.id}) role from {old_role} to {new_role} at {datetime.datetime.now(datetime.timezone.utc).isoformat()}"
    )

    return jsonify({
        "message": f"User role updated to '{new_role}'.",
        "user": user.to_dict()
    }), 200


@auth_bp.route('/users/<int:user_id>/approve', methods=['POST'])
@permission_required('users:manage', allow_api_key=False)
def approve_user(user_id):
    """Approve a pending or rejected user registration request (Admin only)."""
    identity = get_jwt_identity()
    try:
        current_admin_id = int(identity)
    except (ValueError, TypeError):
        current_admin_id = identity
    current_admin = db.session.get(User, current_admin_id)
    admin_ident = current_admin.email if current_admin else f"ID:{current_admin_id}"

    user = User.query.get_or_404(user_id)

    # An admin cannot approve their own account
    if user.id == current_admin_id:
        return jsonify({
            "error": "Forbidden",
            "message": "Administrators cannot approve their own account.",
            "status_code": 403
        }), 403

    # Approving an already approved user returns 200 and changes nothing
    if user.approval_status == 'approved':
        return jsonify({
            "message": f"User '{user.email}' is already approved.",
            "user": user.to_dict()
        }), 200

    # Sets role = requested_role (only VIEWER or DISPATCHER, never ADMIN) and approval_status='approved'
    target_role = (user.requested_role or user.role or 'VIEWER').strip().upper()
    if target_role not in ('VIEWER', 'DISPATCHER'):
        target_role = 'VIEWER'

    user.role = target_role
    user.approval_status = 'approved'
    user.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.session.commit()

    current_app.logger.info(
        f"User approval: admin={admin_ident} approved target_id={user.id} ({user.email}) result=approved role={user.role}"
    )

    return jsonify({
        "message": f"User '{user.email}' has been approved with role '{user.role}'.",
        "user": user.to_dict()
    }), 200


@auth_bp.route('/users/<int:user_id>/reject', methods=['POST'])
@permission_required('users:manage', allow_api_key=False)
def reject_user(user_id):
    """Reject a pending user registration request (Admin only)."""
    identity = get_jwt_identity()
    try:
        current_admin_id = int(identity)
    except (ValueError, TypeError):
        current_admin_id = identity
    current_admin = db.session.get(User, current_admin_id)
    admin_ident = current_admin.email if current_admin else f"ID:{current_admin_id}"

    user = User.query.get_or_404(user_id)

    # An admin cannot reject their own account
    if user.id == current_admin_id:
        return jsonify({
            "error": "Forbidden",
            "message": "Administrators cannot reject their own account.",
            "status_code": 403
        }), 403

    # Rejecting an approved user -> 409 (use deactivate for that)
    if user.approval_status == 'approved':
        return jsonify({
            "error": "Conflict",
            "message": "Cannot reject an approved user. Use deactivate to disable an active account.",
            "status_code": 409
        }), 409

    user.approval_status = 'rejected'
    user.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.session.commit()

    current_app.logger.info(
        f"User rejection: admin={admin_ident} rejected target_id={user.id} ({user.email}) result=rejected"
    )

    return jsonify({
        "message": f"User '{user.email}' registration request has been rejected.",
        "user": user.to_dict()
    }), 200


@auth_bp.route('/users/<int:user_id>/status', methods=['PUT'])
@permission_required('users:manage', allow_api_key=False)
def toggle_user_status(user_id):
    """Toggle active state of a user (Admin only, safety rules enforced)."""
    identity = get_jwt_identity()
    try:
        current_admin_id = int(identity)
    except (ValueError, TypeError):
        current_admin_id = identity
    current_admin = db.session.get(User, current_admin_id)

    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    
    if 'is_active' in data:
        target_status = bool(data['is_active'])
    else:
        target_status = not user.is_active

    # Rule 5: An admin cannot deactivate themselves
    if user.id == current_admin_id and not target_status:
        return jsonify({
            "error": "Forbidden",
            "message": "Administrators cannot deactivate their own account.",
            "status_code": 403
        }), 403

    # Rule 6: The last active ADMIN cannot be deactivated
    if user.role == 'ADMIN' and not target_status and user.is_active:
        active_admin_count = User.query.filter_by(role='ADMIN', is_active=True).count()
        if active_admin_count <= 1:
            return jsonify({
                "error": "Bad Request",
                "message": "Cannot deactivate the last active administrator.",
                "status_code": 400
            }), 400

    old_status = user.is_active
    user.is_active = target_status
    user.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.session.commit()

    # Rule 8: Log status change with app.logger.info
    admin_ident = current_admin.email if current_admin else f"ID:{current_admin_id}"
    from flask import current_app
    current_app.logger.info(
        f"User status change: admin={admin_ident} changed user={user.email} (ID:{user.id}) active status from {old_status} to {target_status} at {datetime.datetime.now(datetime.timezone.utc).isoformat()}"
    )

    status_str = "activated" if user.is_active else "disabled"
    return jsonify({
        "message": f"User account has been {status_str}.",
        "user": user.to_dict()
    }), 200


@auth_bp.route('/users/<int:user_id>', methods=['DELETE'])
@permission_required('users:manage', allow_api_key=False)
def delete_user(user_id):
    """Delete a user account (Admin only, safety rules enforced)."""
    identity = get_jwt_identity()
    try:
        current_admin_id = int(identity)
    except (ValueError, TypeError):
        current_admin_id = identity
    current_admin = db.session.get(User, current_admin_id)

    user = User.query.get_or_404(user_id)

    # Rule 5: An admin cannot delete themselves
    if user.id == current_admin_id:
        return jsonify({
            "error": "Forbidden",
            "message": "Administrators cannot delete their own account.",
            "status_code": 403
        }), 403

    # Rule 6: The last active ADMIN cannot be deleted
    if user.role == 'ADMIN' and user.is_active:
        active_admin_count = User.query.filter_by(role='ADMIN', is_active=True).count()
        if active_admin_count <= 1:
            return jsonify({
                "error": "Bad Request",
                "message": "Cannot delete the last active administrator.",
                "status_code": 400
            }), 400

    email = user.email
    db.session.delete(user)
    db.session.commit()

    # Rule 8: Log deletion with app.logger.info
    admin_ident = current_admin.email if current_admin else f"ID:{current_admin_id}"
    from flask import current_app
    current_app.logger.info(
        f"User deletion: admin={admin_ident} deleted user={email} (ID:{user_id}) at {datetime.datetime.now(datetime.timezone.utc).isoformat()}"
    )

    return jsonify({
        "message": f"User '{email}' deleted successfully.",
        "status_code": 200
    }), 200

