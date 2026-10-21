from __future__ import annotations
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func
from app.extensions import db, limiter
from app.models import Delivery, User, Location
from app.utils.permissions import permission_required
from app.services.pricing import calculate_parcel_price, PARCEL_RATES_PER_KG

my_bp = Blueprint('my', __name__, url_prefix='/my')

def get_current_caller_email() -> str | None:
    """Retrieve lowercase email of currently authenticated JWT caller."""
    try:
        identity = get_jwt_identity()
        user_id = int(identity)
        user = db.session.get(User, user_id)
        if user and user.email:
            return user.email.strip().lower()
    except Exception:
        pass
    return None

@my_bp.route('/parcels', methods=['GET'])
@permission_required('parcels:own')
def get_my_parcels():
    """Retrieve parcels addressed to the current logged-in customer."""
    email = get_current_caller_email()
    if not email:
        return jsonify({"parcels": [], "count": 0}), 200

    search = request.args.get('search', '').strip()
    query = Delivery.query.filter(func.lower(Delivery.customer_email) == email)
    if search:
        query = query.filter(Delivery.tracking_number.ilike(f'%{search}%'))

    parcels = query.order_by(Delivery.created_at.desc()).all()
    return jsonify({
        "parcels": [p.to_customer_dict() for p in parcels],
        "count": len(parcels)
    }), 200

@my_bp.route('/parcels/<string:tracking_number>', methods=['GET'])
@permission_required('parcels:own')
def get_my_parcel_by_tracking(tracking_number):
    """
    Retrieve single customer parcel by tracking number.
    Returns 404 (not 403) for nonexistent parcels or parcels not belonging to caller.
    """
    email = get_current_caller_email()
    if not email:
        return jsonify({
            "error": "Not Found",
            "message": f"Parcel '{tracking_number}' not found",
            "status_code": 404
        }), 404

    parcel = Delivery.query.filter(
        Delivery.tracking_number == tracking_number.strip(),
        func.lower(Delivery.customer_email) == email
    ).first()

    if not parcel:
        # Return 404 (not 403) for parcels that are not theirs
        return jsonify({
            "error": "Not Found",
            "message": f"Parcel '{tracking_number}' not found",
            "status_code": 404
        }), 404

    return jsonify({"parcel": parcel.to_customer_dict()}), 200


# ------------------------------------------------------------------------------
# Viewer self-service: book a new parcel
# ------------------------------------------------------------------------------
PARCEL_PRIORITIES = tuple(PARCEL_RATES_PER_KG)
MAX_PARCEL_WEIGHT_KG = 50.0


@my_bp.route('/hubs', methods=['GET'])
@permission_required('parcels:own')
def get_booking_hubs():
    """Minimal hub list (id, name, address) so a viewer can choose pickup and drop-off."""
    hubs = Location.query.order_by(Location.name.asc()).all()
    return jsonify({
        "hubs": [{"id": h.id, "name": h.name, "address": h.address} for h in hubs]
    }), 200


@my_bp.route('/parcels', methods=['POST'])
@permission_required('parcels:create')
@limiter.limit("20 per hour")
def create_my_parcel():
    """
    Book a parcel for the logged-in viewer.
    The server decides status (Pending), driver (Unassigned), tracking number,
    distance and owner email, so a viewer cannot set operational fields.
    """
    from app.api.deliveries import haversine_distance, generate_unique_tracking_number

    email = get_current_caller_email()
    user = db.session.get(User, int(get_jwt_identity()))
    if not email or not user:
        return jsonify({"error": "Unauthorized", "message": "Please sign in again.", "status_code": 401}), 401

    data = request.get_json() or {}
    errors = []

    def as_int(value):
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    pickup_id = as_int(data.get('pickup_location_id'))
    dest_id = as_int(data.get('destination_location_id'))
    pickup = db.session.get(Location, pickup_id) if pickup_id else None
    dest = db.session.get(Location, dest_id) if dest_id else None
    if not pickup:
        errors.append("Please choose a valid pickup place.")
    if not dest:
        errors.append("Please choose a valid drop-off place.")
    if pickup and dest and pickup.id == dest.id:
        errors.append("Pickup and drop-off must be different places.")

    try:
        weight = float(data.get('package_weight_kg', 1.0))
    except (TypeError, ValueError):
        weight = -1
    if not (0.1 <= weight <= MAX_PARCEL_WEIGHT_KG):
        errors.append(f"Weight must be between 0.1 and {int(MAX_PARCEL_WEIGHT_KG)} kg.")

    priority = str(data.get('priority', 'Standard')).strip().title()
    if priority not in PARCEL_PRIORITIES:
        errors.append("Priority must be Standard, Express or Urgent.")

    recipient = str(data.get('recipient_name') or user.name or '').strip()[:150]
    if len(recipient) < 2:
        errors.append("Recipient name must be at least 2 characters.")

    if errors:
        return jsonify({
            "error": "Bad Request",
            "message": errors[0],
            "details": errors,
            "status_code": 400
        }), 400

    parcel = Delivery(
        tracking_number=generate_unique_tracking_number(),
        customer_name=recipient,
        customer_email=email,
        pickup_location_id=pickup.id,
        destination_location_id=dest.id,
        priority=priority,
        status='Pending',
        distance_km=haversine_distance(pickup.latitude, pickup.longitude, dest.latitude, dest.longitude),
        package_weight_kg=round(weight, 2),
        price=calculate_parcel_price(weight, priority),
        assigned_driver='Unassigned'
    )
    db.session.add(parcel)
    db.session.commit()

    return jsonify({
        "message": f"Parcel booked. Your tracking number is {parcel.tracking_number}.",
        "parcel": parcel.to_customer_dict()
    }), 201
