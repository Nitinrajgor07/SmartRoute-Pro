import json
import datetime
from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import Location, Delivery, Road, RouteRun, ClusterRun, ClusterAssignment
from app.services.clustering import KMeansClusterEngine
from app.services.statistics import DescriptiveStatisticsEngine
from app.services.inference import mean_confidence_interval, welch_t_test, chi_square_independence
from app.utils.permissions import permission_required

sda_bp = Blueprint('sda', __name__, url_prefix='/sda')

# -----------------------------------------------------------------------------
# Part 1: Dataset Summary & K-Means Clustering APIs
# -----------------------------------------------------------------------------

@sda_bp.route('/dataset-summary', methods=['GET'])
@permission_required('zones:read')
def get_dataset_summary():
    """
    GET /api/sda/dataset-summary
    Overview of locations, valid coordinates, and deliveries available for SDA analysis.
    """
    try:
        locations = Location.query.all()
        total_locations = len(locations)
        valid_coords = sum(1 for loc in locations if loc.latitude is not None and loc.longitude is not None)
        total_deliveries = Delivery.query.count()
        total_roads = Road.query.filter_by(is_active=True).count()
        total_route_runs = RouteRun.query.count()
        total_cluster_runs = ClusterRun.query.count()

        if valid_coords > 0:
            lats = [loc.latitude for loc in locations if loc.latitude is not None]
            lons = [loc.longitude for loc in locations if loc.longitude is not None]
            bounding_box = {
                "min_latitude": round(min(lats), 6),
                "max_latitude": round(max(lats), 6),
                "min_longitude": round(min(lons), 6),
                "max_longitude": round(max(lons), 6),
                "center_latitude": round(sum(lats) / len(lats), 6),
                "center_longitude": round(sum(lons) / len(lons), 6)
            }
        else:
            bounding_box = None

        return jsonify({
            "total_locations": total_locations,
            "valid_coordinates": valid_coords,
            "total_deliveries": total_deliveries,
            "total_active_roads": total_roads,
            "total_route_runs": total_route_runs,
            "total_cluster_runs": total_cluster_runs,
            "bounding_box": bounding_box,
            "dataset_status": "Ready for K-Means and Statistical Analytics" if valid_coords >= 2 else "Insufficient Coordinate Points"
        }), 200
    except Exception as e:
        return jsonify({
            "error": "Failed to generate dataset summary",
            "message": str(e)
        }), 500


@sda_bp.route('/clusters/kmeans', methods=['POST'])
@permission_required('zones:run')
def run_kmeans_clustering():
    """
    POST /api/sda/clusters/kmeans
    Executes K-Means spatial clustering on locations loaded from the database.
    Request body:
    {
        "k": 3,
        "max_iterations": 300,
        "random_state": 42
    }
    """
    data = request.get_json(silent=True) or {}
    k = data.get('k', 3)
    max_iter = data.get('max_iterations', 300)
    random_state = data.get('random_state', 42)

    try:
        k = int(k)
        max_iter = int(max_iter)
        random_state = int(random_state)
    except (ValueError, TypeError):
        return jsonify({
            "error": "Validation Error",
            "message": "Parameters 'k', 'max_iterations', and 'random_state' must be integers."
        }), 400

    locations = Location.query.order_by(Location.id.asc()).all()
    loc_dicts = [loc.to_dict() for loc in locations]

    if not loc_dicts:
        return jsonify({
            "error": "Insufficient Data",
            "message": "No locations available in database for clustering."
        }), 400

    if k > len(loc_dicts):
        return jsonify({
            "error": "Invalid Parameter",
            "message": f"K ({k}) cannot exceed the number of available locations ({len(loc_dicts)})."
        }), 400

    try:
        result = KMeansClusterEngine.fit(
            locations=loc_dicts,
            k=k,
            max_iter=max_iter,
            random_state=random_state
        )

        # Deduplicate: do not save a new run if the same K, seed and data already exist; update timestamp instead
        existing_run = ClusterRun.query.filter_by(
            k=result['k'],
            random_state=result['random_state'],
            total_locations=result['total_locations']
        ).order_by(ClusterRun.created_at.desc()).first()

        if existing_run and abs((existing_run.inertia or 0) - result['inertia']) < 1e-4:
            existing_run.created_at = datetime.datetime.now(datetime.timezone.utc)
            db.session.commit()
            result['cluster_run_id'] = existing_run.id
            return jsonify(result), 200

        # Persist cluster run audit record in database
        cluster_run = ClusterRun(
            k=result['k'],
            max_iterations=result['max_iterations'],
            random_state=result['random_state'],
            inertia=result['inertia'],
            silhouette_score=result['silhouette_score'],
            iterations_run=result['iterations_run'],
            total_locations=result['total_locations'],
            centroids_json=json.dumps(result['centroids']),
            execution_time_ms=result['execution_time_ms']
        )
        db.session.add(cluster_run)
        db.session.flush()

        # Persist individual cluster assignments
        for item in result['assignments']:
            assignment = ClusterAssignment(
                cluster_run_id=cluster_run.id,
                location_id=item['location_id'],
                cluster_id=item['cluster_id'],
                distance_to_centroid_km=item['distance_to_centroid_km']
            )
            db.session.add(assignment)

        db.session.commit()
        result['cluster_run_id'] = cluster_run.id

        return jsonify(result), 200

    except ValueError as ve:
        db.session.rollback()
        return jsonify({
            "error": "Clustering Error",
            "message": str(ve)
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Internal Server Error",
            "message": f"Clustering computation failed: {str(e)}"
        }), 500


@sda_bp.route('/clusters/elbow', methods=['POST'])
@permission_required('zones:run')
def run_elbow_analysis():
    """
    POST /api/sda/clusters/elbow
    Executes K-Means across a range of K values to generate the Elbow Method curve.
    Request body:
    {
        "max_k": 6,
        "random_state": 42
    }
    """
    data = request.get_json(silent=True) or {}
    max_k = data.get('max_k', 6)
    random_state = data.get('random_state', 42)

    try:
        max_k = int(max_k)
        random_state = int(random_state)
    except (ValueError, TypeError):
        return jsonify({
            "error": "Validation Error",
            "message": "Parameters 'max_k' and 'random_state' must be integers."
        }), 400

    locations = Location.query.order_by(Location.id.asc()).all()
    loc_dicts = [loc.to_dict() for loc in locations]

    if not loc_dicts:
        return jsonify({
            "error": "Insufficient Data",
            "message": "No locations available in database for elbow analysis."
        }), 400

    try:
        elbow_points = KMeansClusterEngine.compute_elbow(
            locations=loc_dicts,
            max_k=max_k,
            random_state=random_state
        )

        return jsonify({
            "elbow_points": elbow_points,
            "total_points_evaluated": len(elbow_points),
            "max_k_requested": max_k,
            "interpretation_note": "The Elbow Method plots WCSS against K. The 'elbow' point indicates diminishing returns in variance reduction, but does not dictate a mathematically unique optimal K."
        }), 200

    except ValueError as ve:
        return jsonify({
            "error": "Elbow Analysis Error",
            "message": str(ve)
        }), 400
    except Exception as e:
        return jsonify({
            "error": "Internal Server Error",
            "message": f"Elbow analysis failed: {str(e)}"
        }), 500


@sda_bp.route('/clusters/history', methods=['GET'])
@permission_required('zones:read')
def get_cluster_history():
    """
    GET /api/sda/clusters/history
    Returns paginated list of previous K-Means clustering runs from the database.
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 5, type=int)

        paginated = ClusterRun.query.order_by(ClusterRun.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return jsonify({
            "cluster_runs": [run.to_dict() for run in paginated.items],
            "total": paginated.total,
            "page": paginated.page,
            "per_page": paginated.per_page,
            "total_pages": paginated.pages
        }), 200
    except Exception as e:
        return jsonify({
            "error": "Failed to fetch cluster history",
            "message": str(e)
        }), 500


@sda_bp.route('/clusters/history', methods=['DELETE'])
@permission_required('zones:run')
def clear_cluster_history():
    """
    DELETE /api/sda/clusters/history
    Deletes all previous cluster runs and cascade-deletes their assignments.
    """
    try:
        # Delete all cluster runs (cascade will delete assignments)
        runs = ClusterRun.query.all()
        count = len(runs)
        for r in runs:
            db.session.delete(r)
        db.session.commit()
        return jsonify({
            "message": "Cluster run history cleared successfully",
            "deleted_count": count
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Failed to clear cluster history",
            "message": str(e)
        }), 500


@sda_bp.route('/clusters/history/<int:run_id>', methods=['GET'])
@permission_required('zones:read')
def get_cluster_run_detail(run_id):
    """
    GET /api/sda/clusters/history/:id
    Returns complete cluster run details including all location assignments.
    """
    try:
        run = db.session.get(ClusterRun, run_id)
        if not run:
            return jsonify({
                "error": "Not Found",
                "message": f"Cluster run with ID {run_id} not found."
            }), 404

        run_dict = run.to_dict()
        assignments = [a.to_dict() for a in run.assignments.all()]
        run_dict['assignments'] = assignments

        return jsonify({
            "cluster_run": run_dict
        }), 200
    except Exception as e:
        return jsonify({
            "error": "Failed to fetch cluster run details",
            "message": str(e)
        }), 500


# -----------------------------------------------------------------------------
# Part 2: Descriptive & Inferential Statistical Analytics APIs
# -----------------------------------------------------------------------------

@sda_bp.route('/statistics/summary', methods=['GET'])
@permission_required('analytics:read')
def get_statistical_summary():
    """
    GET /api/sda/statistics/summary
    Comprehensive parametric descriptive statistics across deliveries, roads, and routes.
    """
    try:
        # 1. Delivery Haversine Distances & Package Weights
        deliveries = Delivery.query.all()
        delivery_distances = [d.distance_km for d in deliveries]
        delivery_weights = [d.package_weight_kg for d in deliveries]

        # 2. Road Network Distances & Estimated Durations
        roads = Road.query.filter_by(is_active=True).all()
        road_distances = [r.distance_km for r in roads]
        road_durations = [r.estimated_duration_minutes for r in roads]

        # 3. Dijkstra Route Distances (Optimal Paths)
        routes = RouteRun.query.all()
        route_distances = [rt.total_distance_km for rt in routes]

        # Univariate metrics calculation
        stats_delivery_dist = DescriptiveStatisticsEngine.compute_univariate_metrics(
            delivery_distances, "Consignment Delivery Distance (km)"
        )
        stats_delivery_weight = DescriptiveStatisticsEngine.compute_univariate_metrics(
            delivery_weights, "Package Weight (kg)"
        )
        stats_road_dist = DescriptiveStatisticsEngine.compute_univariate_metrics(
            road_distances, "Road Segment Length (km)"
        )
        stats_route_dist = DescriptiveStatisticsEngine.compute_univariate_metrics(
            route_distances, "Dijkstra Optimal Path Cost (km)"
        )

        return jsonify({
            "delivery_distances": stats_delivery_dist,
            "delivery_weights": stats_delivery_weight,
            "road_distances": stats_road_dist,
            "route_distances": stats_route_dist,
            "total_deliveries_analyzed": len(deliveries),
            "total_roads_analyzed": len(roads),
            "total_routes_analyzed": len(routes),
            "notes": {
                "distance_distinction": "Delivery distances represent point-to-point geodesic distances, whereas Road distances represent direct edge segments and Route distances represent Dijkstra multi-hop shortest paths."
            }
        }), 200
    except Exception as e:
        return jsonify({
            "error": "Failed to compute statistical summary",
            "message": str(e)
        }), 500


@sda_bp.route('/statistics/distribution', methods=['GET'])
@permission_required('analytics:read')
def get_distribution_histograms():
    """
    GET /api/sda/statistics/distribution
    Frequency distribution histogram bins for distance and package weight metrics.
    """
    try:
        bins_raw = request.args.get('bins', 5)
        try:
            num_bins = int(bins_raw)
        except (ValueError, TypeError):
            return jsonify({
                "error": "Validation Error",
                "message": "Parameter 'bins' must be an integer between 3 and 10."
            }), 400

        if num_bins < 3 or num_bins > 10:
            return jsonify({
                "error": "Validation Error",
                "message": "Parameter 'bins' must be between 3 and 10."
            }), 400

        deliveries = Delivery.query.all()
        delivery_distances = [d.distance_km for d in deliveries]
        delivery_weights = [d.package_weight_kg for d in deliveries]

        distance_bins = DescriptiveStatisticsEngine.compute_histogram(delivery_distances, num_bins=num_bins, label="km")
        weight_bins = DescriptiveStatisticsEngine.compute_histogram(delivery_weights, num_bins=num_bins, label="kg")

        return jsonify({
            "distance_distribution": distance_bins,
            "weight_distribution": weight_bins,
            "sample_size": len(deliveries)
        }), 200
    except Exception as e:
        return jsonify({
            "error": "Failed to compute distribution histogram",
            "message": str(e)
        }), 500


@sda_bp.route('/statistics/correlation', methods=['GET'])
@permission_required('analytics:read')
def get_correlation_analysis():
    """
    GET /api/sda/statistics/correlation
    Bivariate correlation metrics across operational variables.
    """
    try:
        # Pair 1: Delivery Distance vs Package Weight
        deliveries = Delivery.query.all()
        del_dist = [d.distance_km for d in deliveries]
        del_wt = [d.package_weight_kg for d in deliveries]
        pair_delivery = DescriptiveStatisticsEngine.compute_bivariate_regression(
            x_values=del_dist,
            y_values=del_wt,
            x_label="Delivery Distance (km)",
            y_label="Package Weight (kg)"
        )

        # Pair 2: Road Distance vs Road Duration
        roads = Road.query.filter_by(is_active=True).all()
        road_dist = [r.distance_km for r in roads]
        road_dur = [r.estimated_duration_minutes for r in roads]
        pair_road = DescriptiveStatisticsEngine.compute_bivariate_regression(
            x_values=road_dist,
            y_values=road_dur,
            x_label="Road Segment Distance (km)",
            y_label="Estimated Duration (minutes)"
        )

        return jsonify({
            "delivery_distance_vs_weight": pair_delivery,
            "road_distance_vs_duration": pair_road,
            "disclaimer": "Operational Note: Statistical correlation measures linear association strength between metrics without proving direct causality."
        }), 200
    except Exception as e:
        return jsonify({
            "error": "Failed to compute correlation analysis",
            "message": str(e)
        }), 500


@sda_bp.route('/statistics/regression', methods=['GET'])
@permission_required('analytics:read')
def get_regression_analysis():
    """
    GET /api/sda/statistics/regression
    Ordinary Least Squares (OLS) Linear Regression model with scatter data and fitted regression line.
    """
    try:
        target = request.args.get('target', 'road_transit')

        if target == 'delivery_weight':
            deliveries = Delivery.query.all()
            x_vals = [d.distance_km for d in deliveries]
            y_vals = [d.package_weight_kg for d in deliveries]
            x_label = "Trip Distance (km)"
            y_label = "Package Weight (kg)"
        else:
            # Default: Road network distance vs duration
            roads = Road.query.filter_by(is_active=True).all()
            x_vals = [r.distance_km for r in roads]
            y_vals = [r.estimated_duration_minutes for r in roads]
            x_label = "Segment Length (km)"
            y_label = "Travel Duration (minutes)"

        regression_result = DescriptiveStatisticsEngine.compute_bivariate_regression(
            x_values=x_vals,
            y_values=y_vals,
            x_label=x_label,
            y_label=y_label
        )

        return jsonify(regression_result), 200
    except Exception as e:
        return jsonify({
            "error": "Failed to compute regression model",
            "message": str(e)
        }), 500


@sda_bp.route('/statistics/trends', methods=['GET'])
@permission_required('analytics:read')
def get_delivery_trends():
    """
    GET /api/sda/statistics/trends
    Temporal trend analysis across weekdays and delivery statuses.
    """
    try:
        deliveries = Delivery.query.all()
        days_map = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        day_stats = {day: {"day": day, "count": 0, "total_km": 0.0, "delivered": 0} for day in days_map}

        for d in deliveries:
            if d.created_at:
                day_name = days_map[d.created_at.weekday()]
                day_stats[day_name]["count"] += 1
                day_stats[day_name]["total_km"] += (d.distance_km or 0.0)
                if d.status == 'Delivered':
                    day_stats[day_name]["delivered"] += 1

        trends_list = []
        for day in days_map:
            st = day_stats[day]
            c = st["count"]
            avg_km = round(st["total_km"] / c, 2) if c > 0 else 0.0
            sla_rate = round((st["delivered"] / c) * 100.0, 1) if c > 0 else 100.0
            trends_list.append({
                "day": day[:3],
                "full_day": day,
                "deliveries": c,
                "avg_distance_km": avg_km,
                "on_time_rate": sla_rate
            })

        return jsonify({
            "trends": trends_list,
            "total_deliveries_evaluated": len(deliveries)
        }), 200
    except Exception as e:
        return jsonify({
            "error": "Failed to compute delivery trends",
            "message": str(e)
        }), 500


def _format_p_value(p):
    if p is None:
        return "N/A"
    if p < 0.001:
        return "p < 0.001"
    elif p < 0.01:
        return f"p = {p:.3f}"
    else:
        return f"p = {p:.2f}"


@sda_bp.route('/statistics/inference', methods=['GET'])
@permission_required('analytics:read')
def get_statistical_inference():
    """
    GET /api/sda/statistics/inference
    Performs inferential hypothesis testing on delivery datasets:
    1. Confidence interval for population mean (distance or package weight)
    2. Welch's two-sample t-test comparing delivery duration by priority
    3. Pearson's chi-square test of independence between status and priority
    """
    # 1. Query parameter extraction & validation
    metric = request.args.get('metric', 'distance_km')
    if metric not in ('distance_km', 'package_weight_kg'):
        return jsonify({
            "error": "Bad Request",
            "message": f"Invalid metric '{metric}'. Allowed values: distance_km, package_weight_kg."
        }), 400

    conf_raw = request.args.get('confidence', '0.95')
    try:
        confidence = float(conf_raw)
        if not any(abs(confidence - allowed) < 1e-4 for allowed in (0.90, 0.95, 0.99)):
            raise ValueError()
    except Exception:
        return jsonify({
            "error": "Bad Request",
            "message": f"Invalid confidence '{conf_raw}'. Allowed values: 0.90, 0.95, 0.99."
        }), 400

    group_a = request.args.get('group_a', 'Express')
    if group_a not in ('Standard', 'Express', 'Urgent'):
        return jsonify({
            "error": "Bad Request",
            "message": f"Invalid group_a '{group_a}'. Allowed values: Standard, Express, Urgent."
        }), 400

    group_b = request.args.get('group_b', 'Standard')
    if group_b not in ('Standard', 'Express', 'Urgent'):
        return jsonify({
            "error": "Bad Request",
            "message": f"Invalid group_b '{group_b}'. Allowed values: Standard, Express, Urgent."
        }), 400

    if group_a == group_b:
        return jsonify({
            "error": "Bad Request",
            "message": f"group_a and group_b must be different (both were '{group_a}')."
        }), 400

    # 2. Query delivery records from database
    deliveries = Delivery.query.all()
    if not deliveries:
        return jsonify({
            "available": False,
            "reason": "No deliveries recorded in the database.",
            "metric": metric,
            "confidence_level": confidence,
            "group_a": group_a,
            "group_b": group_b,
            "confidence_interval": {
                "available": False,
                "summary": "No deliveries available to compute confidence interval."
            },
            "t_test": {
                "available": False,
                "summary": f"No deliveries available to compare {group_a} and {group_b}."
            },
            "chi_square": {
                "available": False,
                "summary": "No deliveries available to test independence between status and priority."
            }
        }), 200

    # 3. Block 1: Mean Confidence Interval
    unit = "km" if metric == "distance_km" else "kg"
    metric_label = "distance" if metric == "distance_km" else "package weight"
    values = [getattr(d, metric) for d in deliveries if getattr(d, metric) is not None]

    ci_raw = mean_confidence_interval(values, confidence=confidence)
    if ci_raw.get("available"):
        lower = round(ci_raw["lower_limit"], 1)
        upper = round(ci_raw["upper_limit"], 1)
        mean_val = round(ci_raw["mean"], 1)
        conf_pct = int(round(confidence * 100))
        ci_summary = f"Average {metric_label} is between {lower} {unit} and {upper} {unit} with {conf_pct}% confidence."

        ci_block = {
            "available": True,
            "metric": metric,
            "unit": unit,
            "confidence": confidence,
            "n": ci_raw["n"],
            "mean": mean_val,
            "sample_sd": round(ci_raw["sample_sd"], 2),
            "standard_error": round(ci_raw["standard_error"], 2),
            "degrees_of_freedom": ci_raw["degrees_of_freedom"],
            "critical_t": round(ci_raw["critical_t"], 3),
            "margin_of_error": round(ci_raw["margin_of_error"], 2),
            "lower_limit": lower,
            "upper_limit": upper,
            "summary": ci_summary,
            "details": {
                "test_name": "One-sample t confidence interval",
                "h0": "Population mean equals the hypothesized baseline value.",
                "h1": "Population mean differs from the hypothesized baseline value.",
                "significance_level": round(1.0 - confidence, 2),
                "statistic": mean_val,
                "statistic_label": "Sample mean",
                "degrees_of_freedom": ci_raw["degrees_of_freedom"],
                "p_value": None,
                "p_value_display": "N/A",
                "effect_size": round(ci_raw["margin_of_error"], 2),
                "effect_size_label": "Margin of error",
                "sample_sizes": f"n = {ci_raw['n']}"
            }
        }
    else:
        ci_block = {
            "available": False,
            "metric": metric,
            "unit": unit,
            "reason": ci_raw.get("reason", "Not enough data."),
            "summary": "Not enough delivery data to compute confidence interval."
        }

    # 4. Block 2: Welch's Two-Sample t-Test (Delivered only)
    delivered_list = [d for d in deliveries if d.status == 'Delivered']
    durations_a = []
    durations_b = []
    for d in delivered_list:
        if d.delivered_at and d.created_at and d.delivered_at >= d.created_at:
            dur_hrs = (d.delivered_at - d.created_at).total_seconds() / 3600.0
            if d.priority == group_a:
                durations_a.append(dur_hrs)
            elif d.priority == group_b:
                durations_b.append(dur_hrs)

    tt_raw = welch_t_test(durations_a, durations_b)
    if tt_raw.get("available"):
        p_val = tt_raw["p_value"]
        p_str = _format_p_value(p_val)
        is_sig = p_val < 0.05
        if is_sig:
            tt_summary = f"Significant difference in delivery time between {group_a} and {group_b} ({p_str})."
        else:
            tt_summary = f"No significant difference in delivery time between {group_a} and {group_b} ({p_str})."

        tt_block = {
            "available": True,
            "group_a": group_a,
            "group_b": group_b,
            "unit": "h",
            "n_a": tt_raw["n_a"],
            "n_b": tt_raw["n_b"],
            "mean_a": round(tt_raw["mean_a"], 1),
            "mean_b": round(tt_raw["mean_b"], 1),
            "difference_of_means": round(tt_raw["difference_of_means"], 2),
            "ci_lower": round(tt_raw["ci_lower"], 2),
            "ci_upper": round(tt_raw["ci_upper"], 2),
            "t_statistic": round(tt_raw["t_statistic"], 3),
            "degrees_of_freedom": round(tt_raw["degrees_of_freedom"], 1),
            "p_value": round(p_val, 4),
            "p_value_display": p_str,
            "is_significant": is_sig,
            "cohens_d": round(tt_raw["cohens_d"], 3),
            "warning": tt_raw.get("warning"),
            "summary": tt_summary,
            "details": {
                "test_name": "Welch's two-sample t-test",
                "h0": f"Mean delivery time is equal between {group_a} and {group_b}.",
                "h1": f"Mean delivery time differs between {group_a} and {group_b}.",
                "significance_level": 0.05,
                "statistic": round(tt_raw["t_statistic"], 3),
                "statistic_label": "t",
                "degrees_of_freedom": round(tt_raw["degrees_of_freedom"], 1),
                "p_value": round(p_val, 4),
                "p_value_display": p_str,
                "effect_size": round(tt_raw["cohens_d"], 3),
                "effect_size_label": "Cohen's d",
                "sample_sizes": f"{group_a} n = {tt_raw['n_a']}, {group_b} n = {tt_raw['n_b']}"
            }
        }
    else:
        tt_block = {
            "available": False,
            "group_a": group_a,
            "group_b": group_b,
            "reason": tt_raw.get("reason", "Not enough data."),
            "summary": f"Not enough delivered orders to compare {group_a} and {group_b}."
        }

    # 5. Block 3: Chi-Square Test of Independence (Status vs Priority)
    statuses = ['Delivered', 'In Transit', 'Pending', 'Delayed']
    priorities = ['Standard', 'Express', 'Urgent']

    counts = {}
    for d in deliveries:
        if d.status and d.priority:
            pair = (d.status, d.priority)
            counts[pair] = counts.get(pair, 0) + 1

    full_table = [[counts.get((s, p), 0) for p in priorities] for s in statuses]
    chi_raw = chi_square_independence(full_table)

    collapsed = False
    if not chi_raw.get("available") or not chi_raw.get("reliable"):
        row_del = [counts.get(('Delivered', p), 0) for p in priorities]
        row_not_del = [sum(counts.get((s, p), 0) for s in statuses if s != 'Delivered') for p in priorities]
        collapsed_table = [row_del, row_not_del]
        chi_col_raw = chi_square_independence(collapsed_table)
        if chi_col_raw.get("available"):
            chi_raw = chi_col_raw
            collapsed = True

    if chi_raw.get("available"):
        p_val = chi_raw["p_value"]
        p_str = _format_p_value(p_val)
        is_sig = p_val < 0.05
        if is_sig:
            chi_summary = f"Significant association between delivery status and priority ({p_str})."
        else:
            chi_summary = f"No significant association between delivery status and priority ({p_str})."

        chi_block = {
            "available": True,
            "variable_x": "Status",
            "variable_y": "Priority",
            "n": int(chi_raw["n"]),
            "chi2_statistic": round(chi_raw["chi2_statistic"], 3),
            "degrees_of_freedom": chi_raw["degrees_of_freedom"],
            "p_value": round(p_val, 4),
            "p_value_display": p_str,
            "is_significant": is_sig,
            "cramers_v": round(chi_raw["cramers_v"], 3),
            "smallest_expected": round(chi_raw["smallest_expected"], 2),
            "reliable": chi_raw["reliable"],
            "collapsed": collapsed,
            "summary": chi_summary,
            "details": {
                "test_name": "Pearson's chi-square test of independence",
                "h0": "Delivery status is independent of parcel priority.",
                "h1": "Delivery status is dependent on parcel priority.",
                "significance_level": 0.05,
                "statistic": round(chi_raw["chi2_statistic"], 3),
                "statistic_label": "Chi-square",
                "degrees_of_freedom": chi_raw["degrees_of_freedom"],
                "p_value": round(p_val, 4),
                "p_value_display": p_str,
                "effect_size": round(chi_raw["cramers_v"], 3),
                "effect_size_label": "Cramer's V",
                "sample_sizes": f"N = {int(chi_raw['n'])}"
            }
        }
    else:
        chi_block = {
            "available": False,
            "variable_x": "Status",
            "variable_y": "Priority",
            "reason": chi_raw.get("reason", "Not enough data."),
            "summary": "Not enough delivery data to test independence between status and priority."
        }

    return jsonify({
        "available": True,
        "metric": metric,
        "confidence_level": confidence,
        "group_a": group_a,
        "group_b": group_b,
        "confidence_interval": ci_block,
        "t_test": tt_block,
        "chi_square": chi_block
    }), 200
