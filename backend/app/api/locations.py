from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import Location, Delivery
from app.utils.permissions import permission_required

locations_bp = Blueprint('locations', __name__, url_prefix='/locations')

@locations_bp.route('', methods=['GET'])
@permission_required('routes:read')
def get_locations():
    """List all locations with optional search and pagination."""
    search = request.args.get('search', '').strip()
    page = request.args.get('page', type=int)
    per_page = request.args.get('per_page', type=int)

    query = Location.query
    if search:
        query = query.filter(Location.name.ilike(f'%{search}%') | Location.address.ilike(f'%{search}%'))

    query = query.order_by(Location.name.asc())

    if page and per_page:
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({
            "locations": [loc.to_dict() for loc in paginated.items],
            "total": paginated.total,
            "page": paginated.page,
            "per_page": paginated.per_page,
            "total_pages": paginated.pages
        }), 200

    locations = query.all()
    return jsonify({
        "locations": [loc.to_dict() for loc in locations],
        "total": len(locations)
    }), 200


@locations_bp.route('/<int:id>', methods=['GET'])
@permission_required('routes:read')
def get_location(id):
    """Retrieve single location by ID."""
    location = db.session.get(Location, id)
    if not location:
        return jsonify({
            "error": "Not Found",
            "message": f"Location with ID {id} not found",
            "status_code": 404
        }), 404
    return jsonify({"location": location.to_dict()}), 200


@locations_bp.route('', methods=['POST'])
@permission_required('deliveries:write')
def create_location():
    """Create a new geographic hub or waypoint."""
    data = request.get_json() or {}
    
    name = (data.get('name') or '').strip()
    address = (data.get('address') or '').strip()
    latitude = data.get('latitude')
    longitude = data.get('longitude')

    # Input validation
    errors = []
    if not name:
        errors.append("Field 'name' is required.")
    if not address:
        errors.append("Field 'address' is required.")
    if latitude is None:
        errors.append("Field 'latitude' is required.")
    else:
        try:
            latitude = float(latitude)
            if not (-90.0 <= latitude <= 90.0):
                errors.append("Latitude must be between -90 and 90.")
        except (ValueError, TypeError):
            errors.append("Latitude must be a valid float.")

    if longitude is None:
        errors.append("Field 'longitude' is required.")
    else:
        try:
            longitude = float(longitude)
            if not (-180.0 <= longitude <= 180.0):
                errors.append("Longitude must be between -180 and 180.")
        except (ValueError, TypeError):
            errors.append("Longitude must be a valid float.")

    if errors:
        return jsonify({
            "error": "Bad Request",
            "message": "Validation failed",
            "details": errors,
            "status_code": 400
        }), 400

    try:
        location = Location(
            name=name,
            address=address,
            latitude=latitude,
            longitude=longitude
        )
        db.session.add(location)
        db.session.commit()
        return jsonify({
            "message": "Location created successfully",
            "location": location.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Internal Server Error",
            "message": f"Failed to persist location: {str(e)}",
            "status_code": 500
        }), 500


@locations_bp.route('/<int:id>', methods=['PUT'])
@permission_required('deliveries:write')
def update_location(id):
    """Update location attributes."""
    location = db.session.get(Location, id)
    if not location:
        return jsonify({
            "error": "Not Found",
            "message": f"Location with ID {id} not found",
            "status_code": 404
        }), 404

    data = request.get_json() or {}
    
    if 'name' in data:
        name = (data['name'] or '').strip()
        if not name:
            return jsonify({"error": "Bad Request", "message": "Location name cannot be empty", "status_code": 400}), 400
        location.name = name

    if 'address' in data:
        address = (data['address'] or '').strip()
        if not address:
            return jsonify({"error": "Bad Request", "message": "Address cannot be empty", "status_code": 400}), 400
        location.address = address

    if 'latitude' in data:
        try:
            lat = float(data['latitude'])
            if not (-90.0 <= lat <= 90.0):
                return jsonify({"error": "Bad Request", "message": "Latitude must be between -90 and 90", "status_code": 400}), 400
            location.latitude = lat
        except (ValueError, TypeError):
            return jsonify({"error": "Bad Request", "message": "Latitude must be a valid float", "status_code": 400}), 400

    if 'longitude' in data:
        try:
            lng = float(data['longitude'])
            if not (-180.0 <= lng <= 180.0):
                return jsonify({"error": "Bad Request", "message": "Longitude must be between -180 and 180", "status_code": 400}), 400
            location.longitude = lng
        except (ValueError, TypeError):
            return jsonify({"error": "Bad Request", "message": "Longitude must be a valid float", "status_code": 400}), 400

    try:
        db.session.commit()
        return jsonify({
            "message": "Location updated successfully",
            "location": location.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Internal Server Error",
            "message": f"Failed to update location: {str(e)}",
            "status_code": 500
        }), 500


@locations_bp.route('/<int:id>', methods=['DELETE'])
@permission_required('deliveries:write')
def delete_location(id):
    """Delete a location ensuring referential integrity."""
    location = db.session.get(Location, id)
    if not location:
        return jsonify({
            "error": "Not Found",
            "message": f"Location with ID {id} not found",
            "status_code": 404
        }), 404

    # Check for foreign key usage in deliveries
    active_deliveries = Delivery.query.filter(
        (Delivery.pickup_location_id == id) | (Delivery.destination_location_id == id)
    ).count()

    if active_deliveries > 0:
        return jsonify({
            "error": "Conflict",
            "message": f"Cannot delete location '{location.name}': {active_deliveries} delivery order(s) reference this location.",
            "status_code": 409
        }), 409

    try:
        db.session.delete(location)
        db.session.commit()
        return jsonify({"message": f"Location '{location.name}' deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Internal Server Error",
            "message": f"Failed to delete location: {str(e)}",
            "status_code": 500
        }), 500
