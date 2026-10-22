import math
import random
import datetime
from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import Delivery, Location
from app.utils.permissions import permission_required
from app.services.pricing import calculate_parcel_price

deliveries_bp = Blueprint('deliveries', __name__, url_prefix='/deliveries')

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate geographical distance in km using the haversine formula."""
    try:
        R = 6371.0  # Earth's mean radius in km
        dlat = math.radians(float(lat2) - float(lat1))
        dlon = math.radians(float(lon2) - float(lon1))
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(float(lat1))) *
             math.cos(math.radians(float(lat2))) *
             math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        dist = R * c
        return max(round(dist, 1), 0.5)  # minimum 0.5 km for urban deliveries
    except Exception:
        return 5.0

def generate_unique_tracking_number():
    """Generate a unique tracking number in the format TRK-XXXXXX-US."""
    for _ in range(10):
        code = f"TRK-{random.randint(100000, 999999)}-US"
        if not Delivery.query.filter_by(tracking_number=code).first():
            return code
    # Fallback timestamp code
    return f"TRK-{int(datetime.datetime.now(datetime.timezone.utc).timestamp())}-US"

@deliveries_bp.route('', methods=['GET'])
@permission_required('deliveries:read')
def get_deliveries():
    """Retrieve deliveries with search, status/priority filtering, and pagination."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    status_filter = request.args.get('status', 'ALL').strip()
    priority_filter = request.args.get('priority', 'ALL').strip()
    search = request.args.get('search', '').strip()

    # Join location for searching destination address/name
    query = Delivery.query.join(Location, Delivery.destination_location_id == Location.id)

    # Search filter
    if search:
        query = query.filter(
            Delivery.tracking_number.ilike(f'%{search}%') |
            Delivery.customer_name.ilike(f'%{search}%') |
            Location.address.ilike(f'%{search}%') |
            Location.name.ilike(f'%{search}%')
        )

    # Status filter
    if status_filter and status_filter.upper() != 'ALL':
        query = query.filter(Delivery.status == status_filter)

    # Priority filter
    if priority_filter and priority_filter.upper() != 'ALL':
        query = query.filter(Delivery.priority == priority_filter)

    query = query.order_by(Delivery.created_at.desc())

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "deliveries": [d.to_dict() for d in paginated.items],
        "total": paginated.total,
        "page": paginated.page,
        "per_page": paginated.per_page,
        "total_pages": paginated.pages
    }), 200


@deliveries_bp.route('/<int:id>', methods=['GET'])
@permission_required('deliveries:read')
def get_delivery(id):
    """Retrieve single delivery order by ID."""
    delivery = db.session.get(Delivery, id)
    if not delivery:
        return jsonify({
            "error": "Not Found",
            "message": f"Delivery with ID {id} not found",
            "status_code": 404
        }), 404
    return jsonify({"delivery": delivery.to_dict()}), 200


@deliveries_bp.route('', methods=['POST'])
@permission_required('deliveries:write')
def create_delivery():
    """Create a new delivery record with relational validation and distance computation."""
    data = request.get_json() or {}

    customer_name = (data.get('customer_name') or data.get('recipientName') or '').strip()
    customer_email = (data.get('customer_email') or data.get('customerEmail') or '').strip().lower() or None
    pickup_id = data.get('pickup_location_id') or data.get('pickupLocationId')
    destination_id = data.get('destination_location_id') or data.get('destinationLocationId')
    priority = data.get('priority', 'Standard')
    status = data.get('status', 'Pending')
    delivery_date_raw = data.get('delivery_date') or data.get('deliveryDate')
    distance_km = data.get('distance_km') or data.get('distanceKm')
    package_weight_kg = data.get('package_weight_kg')
    if package_weight_kg is None:
        package_weight_kg = data.get('packageWeightKg')
    if package_weight_kg is None:
        package_weight_kg = 1.0
    estimated_delivery_time = data.get('estimated_delivery_time') or data.get('estimatedDeliveryTime') or '02:00 PM'
    assigned_driver = data.get('assigned_driver') or data.get('assignedDriver')
    tracking_number = (data.get('tracking_number') or data.get('trackingNumber') or '').strip()

    # Validations
    errors = []
    if not customer_name:
        errors.append("Field 'customer_name' (recipient name) is required.")

    if customer_email:
        import re
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", customer_email):
            errors.append("Invalid 'customer_email' format.")

    if not pickup_id:
        errors.append("Field 'pickup_location_id' is required.")
    else:
        pickup_loc = db.session.get(Location, pickup_id)
        if not pickup_loc:
            errors.append(f"Pickup location with ID {pickup_id} does not exist.")

    if not destination_id:
        errors.append("Field 'destination_location_id' is required.")
    else:
        dest_loc = db.session.get(Location, destination_id)
        if not dest_loc:
            errors.append(f"Destination location with ID {destination_id} does not exist.")

    if pickup_id and destination_id and pickup_id == destination_id:
        errors.append("Pickup and destination locations must be different.")

    valid_priorities = ['Standard', 'Express', 'Urgent']
    if priority not in valid_priorities:
        errors.append(f"Invalid priority '{priority}'. Allowed values: {valid_priorities}")

    try:
        package_weight_kg = float(package_weight_kg)
        if not math.isfinite(package_weight_kg) or package_weight_kg <= 0:
            errors.append("Package weight must be greater than zero.")
    except (TypeError, ValueError):
        errors.append("Package weight must be a valid number.")

    valid_statuses = ['Pending', 'In Transit', 'Delivered', 'Delayed']
    if status not in valid_statuses:
        errors.append(f"Invalid status '{status}'. Allowed values: {valid_statuses}")

    # Check tracking number uniqueness if manually provided
    if tracking_number:
        existing = Delivery.query.filter_by(tracking_number=tracking_number).first()
        if existing:
            return jsonify({
                "error": "Conflict",
                "message": f"Tracking number '{tracking_number}' already exists.",
                "status_code": 409
            }), 409
    else:
        tracking_number = generate_unique_tracking_number()

    # Parse delivery date
    if delivery_date_raw:
        try:
            if isinstance(delivery_date_raw, str):
                delivery_date = datetime.date.fromisoformat(delivery_date_raw[:10])
            else:
                delivery_date = datetime.date.today()
        except ValueError:
            errors.append("Invalid 'delivery_date' format. Expected YYYY-MM-DD.")
    else:
        delivery_date = datetime.date.today()

    if errors:
        return jsonify({
            "error": "Bad Request",
            "message": "Delivery validation failed",
            "details": errors,
            "status_code": 400
        }), 400

    # Auto-calculate distance if not provided or 0
    if not distance_km or float(distance_km) <= 0:
        pickup_loc = db.session.get(Location, pickup_id)
        dest_loc = db.session.get(Location, destination_id)
        if pickup_loc and dest_loc:
            distance_km = haversine_distance(
                pickup_loc.latitude, pickup_loc.longitude,
                dest_loc.latitude, dest_loc.longitude
            )
        else:
            distance_km = 6.0
    else:
        distance_km = float(distance_km)

    delivered_at = datetime.datetime.now(datetime.timezone.utc) if status == 'Delivered' else None

    try:
        delivery = Delivery(
            tracking_number=tracking_number,
            customer_name=customer_name,
            pickup_location_id=pickup_id,
            destination_location_id=destination_id,
            delivery_date=delivery_date,
            priority=priority,
            status=status,
            distance_km=distance_km,
            package_weight_kg=float(package_weight_kg),
            price=calculate_parcel_price(float(package_weight_kg), priority),
            estimated_delivery_time=estimated_delivery_time,
            assigned_driver=assigned_driver,
            customer_email=customer_email,
            delivered_at=delivered_at
        )
        db.session.add(delivery)
        db.session.commit()

        return jsonify({
            "message": "Delivery created successfully",
            "delivery": delivery.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Internal Server Error",
            "message": f"Failed to persist delivery: {str(e)}",
            "status_code": 500
        }), 500


@deliveries_bp.route('/<int:id>', methods=['PUT'])
@permission_required('deliveries:write')
def update_delivery(id):
    """Update delivery attributes, status, or assignment."""
    delivery = db.session.get(Delivery, id)
    if not delivery:
        return jsonify({
            "error": "Not Found",
            "message": f"Delivery with ID {id} not found",
            "status_code": 404
        }), 404

    data = request.get_json() or {}
    weight_or_priority_changed = False

    # Check status update
    if 'status' in data:
        status = data['status']
        valid_statuses = ['Pending', 'In Transit', 'Delivered', 'Delayed']
        if status not in valid_statuses:
            return jsonify({
                "error": "Bad Request",
                "message": f"Invalid status '{status}'. Allowed: {valid_statuses}",
                "status_code": 400
            }), 400
        delivery.status = status

        if status == 'Delivered':
            if not delivery.delivered_at:
                delivery.delivered_at = datetime.datetime.now(datetime.timezone.utc)
        else:
            delivery.delivered_at = None

    # Check priority update
    if 'priority' in data:
        priority = data['priority']
        valid_priorities = ['Standard', 'Express', 'Urgent']
        if priority not in valid_priorities:
            return jsonify({
                "error": "Bad Request",
                "message": f"Invalid priority '{priority}'. Allowed: {valid_priorities}",
                "status_code": 400
            }), 400
        if delivery.priority != priority:
            delivery.priority = priority
            weight_or_priority_changed = True

    if 'customer_name' in data or 'recipientName' in data:
        name = (data.get('customer_name') or data.get('recipientName') or '').strip()
        if not name:
            return jsonify({"error": "Bad Request", "message": "Customer name cannot be empty", "status_code": 400}), 400
        delivery.customer_name = name

    if 'customer_email' in data or 'customerEmail' in data:
        raw_email = (data.get('customer_email') or data.get('customerEmail') or '').strip().lower() or None
        if raw_email:
            import re
            if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", raw_email):
                return jsonify({"error": "Bad Request", "message": "Invalid 'customer_email' format.", "status_code": 400}), 400
            delivery.customer_email = raw_email
        else:
            delivery.customer_email = None

    if 'pickup_location_id' in data:
        pid = data['pickup_location_id']
        if not db.session.get(Location, pid):
            return jsonify({"error": "Bad Request", "message": f"Pickup location {pid} does not exist", "status_code": 400}), 400
        delivery.pickup_location_id = pid

    if 'destination_location_id' in data:
        did = data['destination_location_id']
        if not db.session.get(Location, did):
            return jsonify({"error": "Bad Request", "message": f"Destination location {did} does not exist", "status_code": 400}), 400
        delivery.destination_location_id = did

    if 'assigned_driver' in data or 'assignedDriver' in data:
        delivery.assigned_driver = data.get('assigned_driver') or data.get('assignedDriver')

    if 'estimated_delivery_time' in data or 'estimatedDeliveryTime' in data:
        delivery.estimated_delivery_time = data.get('estimated_delivery_time') or data.get('estimatedDeliveryTime')

    if 'package_weight_kg' in data or 'packageWeightKg' in data:
        try:
            new_weight = float(data.get('package_weight_kg') or data.get('packageWeightKg'))
            if delivery.package_weight_kg != new_weight:
                delivery.package_weight_kg = new_weight
                weight_or_priority_changed = True
        except (ValueError, TypeError):
            pass

    if 'distance_km' in data or 'distanceKm' in data:
        try:
            delivery.distance_km = float(data.get('distance_km') or data.get('distanceKm'))
        except (ValueError, TypeError):
            pass

    if weight_or_priority_changed and delivery.status != 'Delivered':
        delivery.price = calculate_parcel_price(delivery.package_weight_kg, delivery.priority)

    try:
        db.session.commit()
        return jsonify({
            "message": "Delivery updated successfully",
            "delivery": delivery.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Internal Server Error",
            "message": f"Failed to update delivery: {str(e)}",
            "status_code": 500
        }), 500


@deliveries_bp.route('/<int:id>', methods=['DELETE'])
@permission_required('deliveries:write')
def delete_delivery(id):
    """Delete a delivery order from the database."""
    delivery = db.session.get(Delivery, id)
    if not delivery:
        return jsonify({
            "error": "Not Found",
            "message": f"Delivery with ID {id} not found",
            "status_code": 404
        }), 404

    try:
        code = delivery.tracking_number
        db.session.delete(delivery)
        db.session.commit()
        return jsonify({"message": f"Delivery #{code} deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Internal Server Error",
            "message": f"Failed to delete delivery: {str(e)}",
            "status_code": 500
        }), 500
