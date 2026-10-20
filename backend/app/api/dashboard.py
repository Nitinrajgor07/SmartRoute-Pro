import datetime
from flask import Blueprint, jsonify
from sqlalchemy import func
from app.extensions import db
from flask_jwt_extended import get_jwt_identity
from app.models import Delivery, RouteRun, ClusterRun, User
from app.utils.permissions import permission_required

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/dashboard')

@dashboard_bp.route('/summary', methods=['GET'])
@permission_required('dashboard:read')
def get_dashboard_summary():
    """Compute real-time operational KPI metrics and chart distributions scoped to the caller."""
    identity = get_jwt_identity()
    caller_user = None
    if identity:
        try:
            caller_user = db.session.get(User, int(identity))
        except Exception:
            caller_user = None

    is_viewer = caller_user is not None and (caller_user.role or '').strip().upper() == 'VIEWER'

    # Customer View (VIEWER role): scoped strictly to their own parcels
    if is_viewer:
        caller_email = (caller_user.email or '').strip().lower()
        viewer_query = Delivery.query.filter(func.lower(Delivery.customer_email) == caller_email)
        total_deliveries = viewer_query.count()
        completed_deliveries = viewer_query.filter_by(status='Delivered').count()
        delayed_deliveries = viewer_query.filter_by(status='Delayed').count()
        in_transit_deliveries = viewer_query.filter_by(status='In Transit').count()
        pending_deliveries = viewer_query.filter_by(status='Pending').count()

        my_parcels = viewer_query.order_by(Delivery.created_at.desc()).all()
        status_distribution = [
            {"name": "Delivered", "value": completed_deliveries, "color": "#10b981"},
            {"name": "In Transit", "value": in_transit_deliveries, "color": "#3b82f6"},
            {"name": "Pending", "value": pending_deliveries, "color": "#f59e0b"},
            {"name": "Delayed", "value": delayed_deliveries, "color": "#ef4444"},
        ]

        return jsonify({
            "metrics": {
                "total_deliveries": total_deliveries,
                "completed_deliveries": completed_deliveries,
                "delayed_deliveries": delayed_deliveries,
                "in_transit_deliveries": in_transit_deliveries,
                "pending_deliveries": pending_deliveries,
                "has_sufficient_data": total_deliveries > 0
            },
            "status_distribution": status_distribution,
            "parcels": [p.to_customer_dict() for p in my_parcels],
            "is_customer_view": True,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }), 200

    # Aggregate View (ADMIN and DISPATCHER roles)
    total_deliveries = Delivery.query.count()
    active_deliveries = Delivery.query.filter(Delivery.status.in_(['In Transit', 'Pending'])).count()
    completed_deliveries = Delivery.query.filter_by(status='Delivered').count()
    delayed_deliveries = Delivery.query.filter_by(status='Delayed').count()
    in_transit_deliveries = Delivery.query.filter_by(status='In Transit').count()
    pending_deliveries = Delivery.query.filter_by(status='Pending').count()

    # Average distance calculation
    if total_deliveries > 0:
        avg_dist = db.session.query(func.avg(Delivery.distance_km)).scalar()
        avg_distance_km = round(float(avg_dist), 1) if avg_dist is not None else 0.0
    else:
        avg_distance_km = None

    # On-time delivery calculation based on evaluated deliveries
    evaluated_orders = completed_deliveries + delayed_deliveries
    if evaluated_orders > 0:
        on_time_rate = round((completed_deliveries / evaluated_orders) * 100.0, 1)
    elif total_deliveries > 0:
        on_time_rate = 100.0  # None delayed yet
    else:
        on_time_rate = None

    # Status distribution for Recharts Pie/Doughnut
    status_distribution = [
        {"name": "Delivered", "value": completed_deliveries, "color": "#10b981"},
        {"name": "In Transit", "value": in_transit_deliveries, "color": "#3b82f6"},
        {"name": "Pending", "value": pending_deliveries, "color": "#f59e0b"},
        {"name": "Delayed", "value": delayed_deliveries, "color": "#ef4444"},
    ]

    # Performance trend aggregated across days of the week from database records
    days_map = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    weekday_counts = {day: 0 for day in days_map}
    weekday_completed = {day: 0 for day in days_map}

    all_deliveries = Delivery.query.all()
    for d in all_deliveries:
        if d.created_at:
            day_name = days_map[d.created_at.weekday()]
            weekday_counts[day_name] += 1
            if d.status == 'Delivered':
                weekday_completed[day_name] += 1

    performance_trend = []
    for day in days_map:
        count = weekday_counts[day]
        comp = weekday_completed[day]
        rate = round((comp / count) * 100, 1) if count > 0 else None
        performance_trend.append({
            "day": day,
            "deliveries": count,
            "onTimeRate": rate,
            "target": 95.0
        })

    # ADA Algorithm (RouteRun) metrics
    total_route_calculations = RouteRun.query.count()
    if total_route_calculations > 0:
        avg_path_res = db.session.query(func.avg(RouteRun.total_distance_km)).scalar()
        avg_shortest_path_km = round(float(avg_path_res), 2) if avg_path_res is not None else 0.0
        avg_time_res = db.session.query(func.avg(RouteRun.execution_time_ms)).scalar()
        avg_dijkstra_runtime_ms = round(float(avg_time_res), 3) if avg_time_res is not None else 0.0
    else:
        avg_shortest_path_km = None
        avg_dijkstra_runtime_ms = None

    # SDA Clustering metrics
    total_clustering_runs = ClusterRun.query.count()
    latest_run = ClusterRun.query.order_by(ClusterRun.created_at.desc()).first()
    latest_k = latest_run.k if latest_run else None
    latest_silhouette = round(latest_run.silhouette_score, 4) if (latest_run and latest_run.silhouette_score is not None) else None

    # Users counts for Admin dashboard
    user_counts = {
        "total": User.query.count(),
        "admin": User.query.filter_by(role='ADMIN').count(),
        "dispatcher": User.query.filter_by(role='DISPATCHER').count(),
        "viewer": User.query.filter_by(role='VIEWER').count()
    }

    return jsonify({
        "metrics": {
            "total_deliveries": total_deliveries,
            "active_deliveries": active_deliveries,
            "completed_deliveries": completed_deliveries,
            "delayed_deliveries": delayed_deliveries,
            "in_transit_deliveries": in_transit_deliveries,
            "pending_deliveries": pending_deliveries,
            "avg_distance_km": avg_distance_km,
            "on_time_rate": on_time_rate,
            "has_sufficient_data": total_deliveries > 0,
            "total_route_calculations": total_route_calculations,
            "avg_shortest_path_km": avg_shortest_path_km,
            "avg_dijkstra_runtime_ms": avg_dijkstra_runtime_ms,
            "total_clustering_runs": total_clustering_runs,
            "latest_k": latest_k,
            "latest_silhouette_score": latest_silhouette
        },
        "user_counts": user_counts,
        "status_distribution": status_distribution,
        "performance_trend": performance_trend,
        "is_customer_view": False,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }), 200


@dashboard_bp.route('/recent-deliveries', methods=['GET'])
@permission_required('deliveries:read')
def get_recent_deliveries():
    """Fetch the latest delivery consignments directly from the database."""
    recent = Delivery.query.order_by(Delivery.created_at.desc(), Delivery.id.desc()).limit(8).all()
    return jsonify({
        "deliveries": [d.to_dict() for d in recent],
        "count": len(recent)
    }), 200
