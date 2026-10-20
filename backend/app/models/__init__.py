import datetime
import json
from werkzeug.security import generate_password_hash, check_password_hash
import hashlib

# scrypt is Werkzeug's default, but some Python builds (e.g. Apple's built-in
# Python on macOS) ship without hashlib.scrypt. Fall back to PBKDF2-SHA256 there.
# check_password_hash reads the method from the stored hash, so both kinds verify.
PASSWORD_HASH_METHOD = "scrypt" if hasattr(hashlib, "scrypt") else "pbkdf2:sha256"
from app.extensions import db

def utc_now():
    """Return timezone-aware current UTC datetime."""
    return datetime.datetime.now(datetime.timezone.utc)

class User(db.Model):
    """User account entity for authentication and role-based access control (RBAC)."""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default='VIEWER', nullable=False)  # 'ADMIN', 'DISPATCHER', 'VIEWER'
    approval_status = db.Column(db.String(20), default='approved', server_default='approved', nullable=False, index=True)  # 'pending', 'approved', 'rejected'
    requested_role = db.Column(db.String(50), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    @property
    def can_sign_in(self):
        """User can sign in only when active and approval_status is 'approved'."""
        return bool(self.is_active and self.approval_status == 'approved')

    def set_password(self, password):
        """Hash and store password securely."""
        self.password_hash = generate_password_hash(password, method=PASSWORD_HASH_METHOD)

    def check_password(self, password):
        """Verify plain-text password against stored password hash."""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """Serialize user data safely - NEVER expose password_hash."""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "approval_status": self.approval_status,
            "requested_role": self.requested_role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class TokenBlocklist(db.Model):
    """Stores revoked JWT jti identifiers to enforce server-side logout."""
    __tablename__ = 'token_blocklist'

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), nullable=False, index=True)
    token_type = db.Column(db.String(10), default='access', nullable=False)
    user_id = db.Column(db.Integer, nullable=True)
    revoked_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "jti": self.jti,
            "token_type": self.token_type,
            "user_id": self.user_id,
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None
        }


class Location(db.Model):
    """Physical geographic hub, warehouse, depot, or customer delivery waypoint."""
    __tablename__ = 'locations'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False, index=True)
    address = db.Column(db.String(255), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)

    # Relationships
    pickups = db.relationship('Delivery', foreign_keys='Delivery.pickup_location_id', backref='pickup_location', lazy='dynamic')
    dropoffs = db.relationship('Delivery', foreign_keys='Delivery.destination_location_id', backref='destination_location', lazy='dynamic')
    outgoing_roads = db.relationship('Road', foreign_keys='Road.source_location_id', backref='source_location', lazy='dynamic', cascade='all, delete-orphan')
    incoming_roads = db.relationship('Road', foreign_keys='Road.destination_location_id', backref='destination_location', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "address": self.address,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Road(db.Model):
    """Network connection between two locations representing a road segment."""
    __tablename__ = 'roads'
    __table_args__ = (
        db.UniqueConstraint('source_location_id', 'destination_location_id', name='uq_source_destination'),
    )

    id = db.Column(db.Integer, primary_key=True)
    source_location_id = db.Column(db.Integer, db.ForeignKey('locations.id', ondelete='CASCADE'), nullable=False, index=True)
    destination_location_id = db.Column(db.Integer, db.ForeignKey('locations.id', ondelete='CASCADE'), nullable=False, index=True)
    distance_km = db.Column(db.Float, nullable=False)
    estimated_duration_minutes = db.Column(db.Float, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "source_location_id": self.source_location_id,
            "destination_location_id": self.destination_location_id,
            "source_name": self.source_location.name if self.source_location else None,
            "destination_name": self.destination_location.name if self.destination_location else None,
            "distance_km": self.distance_km,
            "estimated_duration_minutes": self.estimated_duration_minutes,
            "is_active": self.is_active
        }


class Delivery(db.Model):
    """Consignment delivery order tracked through dispatch lifecycle."""
    __tablename__ = 'deliveries'

    id = db.Column(db.Integer, primary_key=True)
    tracking_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    customer_name = db.Column(db.String(150), nullable=False, index=True)
    customer_email = db.Column(db.String(120), nullable=True, index=True)
    pickup_location_id = db.Column(db.Integer, db.ForeignKey('locations.id', ondelete='RESTRICT'), nullable=False, index=True)
    destination_location_id = db.Column(db.Integer, db.ForeignKey('locations.id', ondelete='RESTRICT'), nullable=False, index=True)
    delivery_date = db.Column(db.Date, nullable=False, default=datetime.date.today)
    priority = db.Column(db.String(20), default='Standard', nullable=False)  # 'Standard', 'Express', 'Urgent'
    status = db.Column(db.String(20), default='Pending', nullable=False)      # 'Pending', 'In Transit', 'Delivered', 'Delayed'
    distance_km = db.Column(db.Float, default=0.0, nullable=False)
    package_weight_kg = db.Column(db.Float, default=1.0, nullable=False)
    estimated_delivery_time = db.Column(db.String(50), nullable=True, default='02:00 PM')
    assigned_driver = db.Column(db.String(100), nullable=True)
    delivered_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    def to_dict(self):
        """Serialize delivery entity with nested location metadata for API & UI compatibility."""
        pickup = self.pickup_location
        destination = self.destination_location
        
        return {
            "id": self.id,
            "tracking_number": self.tracking_number,
            "customer_name": self.customer_name,
            "customer_email": self.customer_email,
            "customerEmail": self.customer_email,
            # Frontend compatibility aliases
            "trackingNumber": self.tracking_number,
            "recipientName": self.customer_name,
            "pickup_location_id": self.pickup_location_id,
            "destination_location_id": self.destination_location_id,
            "pickup_location": pickup.to_dict() if pickup else None,
            "destination_location": destination.to_dict() if destination else None,
            "destinationAddress": destination.address if destination else "Unknown Destination",
            "lat": destination.latitude if destination else 0.0,
            "lng": destination.longitude if destination else 0.0,
            "delivery_date": self.delivery_date.isoformat() if self.delivery_date else None,
            "priority": self.priority,
            "status": self.status,
            "distance_km": round(self.distance_km, 2),
            "distanceKm": round(self.distance_km, 2),
            "package_weight_kg": round(self.package_weight_kg, 2),
            "packageWeightKg": round(self.package_weight_kg, 2),
            "estimated_delivery_time": self.estimated_delivery_time,
            "estimatedDeliveryTime": self.estimated_delivery_time or "02:00 PM",
            "assigned_driver": self.assigned_driver,
            "assignedDriver": self.assigned_driver or "Unassigned",
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "deliveredAt": self.delivered_at.strftime('%Y-%m-%d %H:%M') if self.delivered_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "createdAt": self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    def to_customer_dict(self):
        """Customer-safe dictionary for parcel tracking without internal driver, weight, or distance metrics."""
        pickup = self.pickup_location
        destination = self.destination_location
        return {
            "tracking_number": self.tracking_number,
            "status": self.status,
            "from": pickup.name if pickup else "Origin Hub",
            "to": destination.name if destination else "Destination Hub",
            "estimated_delivery_time": self.estimated_delivery_time or "02:00 PM",
            "last_updated": self.updated_at.isoformat() if self.updated_at else (self.created_at.isoformat() if self.created_at else None),
            "created_date": self.created_at.isoformat() if self.created_at else None
        }


class RouteRun(db.Model):
    """Historical audit of algorithm path calculations for ADA performance comparisons."""
    __tablename__ = 'route_runs'

    id = db.Column(db.Integer, primary_key=True)
    source_location_id = db.Column(db.Integer, db.ForeignKey('locations.id', ondelete='SET NULL'), nullable=True)
    destination_location_id = db.Column(db.Integer, db.ForeignKey('locations.id', ondelete='SET NULL'), nullable=True)
    algorithm = db.Column(db.String(50), nullable=False)  # e.g. 'Dijkstra', 'Bellman-Ford', 'A*', 'TSP'
    total_distance_km = db.Column(db.Float, nullable=False)
    path_json = db.Column(db.Text, nullable=False)  # JSON-encoded array of node IDs or coordinates
    execution_time_ms = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)

    source = db.relationship('Location', foreign_keys=[source_location_id])
    destination = db.relationship('Location', foreign_keys=[destination_location_id])

    def to_dict(self):
        try:
            parsed_path = json.loads(self.path_json)
        except Exception:
            parsed_path = self.path_json

        is_run = self.algorithm == 'TSP' or (isinstance(parsed_path, dict) and parsed_path.get("kind") == "run")
        kind = 'run' if is_run else 'single'

        if isinstance(parsed_path, dict):
            stop_count = parsed_path.get("stop_count") or (len(parsed_path.get("stops", [])) - 1 if parsed_path.get("stops") else 1)
            actual_path = parsed_path.get("path", [])
        else:
            stop_count = 1
            actual_path = parsed_path

        return {
            "id": self.id,
            "source_location_id": self.source_location_id,
            "destination_location_id": self.destination_location_id,
            "source_name": self.source.name if self.source else None,
            "destination_name": self.destination.name if self.destination else None,
            "algorithm": self.algorithm,
            "kind": kind,
            "stop_count": stop_count,
            "total_distance_km": self.total_distance_km,
            "path": actual_path,
            "execution_time_ms": self.execution_time_ms,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ClusterRun(db.Model):
    """Historical audit of SDA K-Means spatial clustering runs."""
    __tablename__ = 'cluster_runs'

    id = db.Column(db.Integer, primary_key=True)
    k = db.Column(db.Integer, nullable=False)
    max_iterations = db.Column(db.Integer, default=300, nullable=False)
    random_state = db.Column(db.Integer, default=42, nullable=False)
    inertia = db.Column(db.Float, nullable=False)  # Within-Cluster Sum of Squares (WCSS)
    silhouette_score = db.Column(db.Float, nullable=True)  # Nullable if K=1 or invalid
    iterations_run = db.Column(db.Integer, nullable=False)
    total_locations = db.Column(db.Integer, nullable=False)
    centroids_json = db.Column(db.Text, nullable=False)  # JSON array of centroid coordinates & cluster sizes
    execution_time_ms = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)

    assignments = db.relationship('ClusterAssignment', backref='cluster_run', cascade='all, delete-orphan', lazy='dynamic')

    def to_dict(self):
        try:
            centroids = json.loads(self.centroids_json)
        except Exception:
            centroids = []

        return {
            "id": self.id,
            "k": self.k,
            "max_iterations": self.max_iterations,
            "random_state": self.random_state,
            "inertia": round(self.inertia, 4) if self.inertia is not None else None,
            "silhouette_score": round(self.silhouette_score, 4) if self.silhouette_score is not None else None,
            "iterations_run": self.iterations_run,
            "total_locations": self.total_locations,
            "centroids": centroids,
            "execution_time_ms": round(self.execution_time_ms, 3) if self.execution_time_ms is not None else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class ClusterAssignment(db.Model):
    """Individual waypoint assignment mapping a location to a cluster centroid."""
    __tablename__ = 'cluster_assignments'

    id = db.Column(db.Integer, primary_key=True)
    cluster_run_id = db.Column(db.Integer, db.ForeignKey('cluster_runs.id', ondelete='CASCADE'), nullable=False, index=True)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id', ondelete='CASCADE'), nullable=False, index=True)
    cluster_id = db.Column(db.Integer, nullable=False)
    distance_to_centroid_km = db.Column(db.Float, nullable=False)

    location = db.relationship('Location')

    def to_dict(self):
        return {
            "id": self.id,
            "cluster_run_id": self.cluster_run_id,
            "location_id": self.location_id,
            "location_name": self.location.name if self.location else None,
            "address": self.location.address if self.location else None,
            "latitude": self.location.latitude if self.location else None,
            "longitude": self.location.longitude if self.location else None,
            "cluster_id": self.cluster_id,
            "distance_to_centroid_km": round(self.distance_to_centroid_km, 3) if self.distance_to_centroid_km is not None else None
        }
