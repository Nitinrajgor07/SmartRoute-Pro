import json
from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import Location, Road, RouteRun
from app.services.dijkstra import DijkstraRouter
from app.utils.permissions import permission_required

routes_bp = Blueprint('routes', __name__, url_prefix='/routes')
graph_bp = Blueprint('graph', __name__, url_prefix='/graph')

def get_graph_data():
    """Helper to query and format active locations and roads."""
    locations = Location.query.order_by(Location.id.asc()).all()
    roads = Road.query.filter_by(is_active=True).all()
    
    nodes_data = [loc.to_dict() for loc in locations]
    edges_data = [road.to_dict() for road in roads]
    
    return nodes_data, edges_data


@graph_bp.route('', methods=['GET'])
@permission_required('routes:read')
def get_graph():
    """
    GET /api/graph
    Returns active road-network nodes, active directed edges, coordinates, and road distances.
    """
    try:
        nodes_data, edges_data = get_graph_data()
        return jsonify({
            "nodes": nodes_data,
            "edges": edges_data,
            "total_nodes": len(nodes_data),
            "total_edges": len(edges_data),
            "description": "Active road network topology loaded from database."
        }), 200
    except Exception as e:
        return jsonify({
            "error": "Failed to retrieve graph topology",
            "message": str(e)
        }), 500


@routes_bp.route('/graph', methods=['GET'])
@permission_required('routes:read')
def get_routes_graph_alias():
    """Alias for GET /api/routes/graph -> delegates to get_graph."""
    return get_graph()


@routes_bp.route('/roads', methods=['GET'])
@permission_required('routes:read')
def get_routes_roads():
    """List all roads / graph edges."""
    roads = Road.query.all()
    return jsonify({
        "roads": [r.to_dict() for r in roads],
        "total": len(roads),
        "count": len(roads)
    }), 200


@routes_bp.route('/shortest-path', methods=['POST'])
@permission_required('routes:calculate')
def calculate_shortest_path():
    """
    POST /api/routes/shortest-path
    Calculates single-source shortest path using Dijkstra's Algorithm with Python heapq.
    Request body:
    {
        "source_location_id": 1,
        "destination_location_id": 5,
        "include_steps": true
    }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({
            "error": "Bad Request",
            "message": "JSON body is required with source_location_id and destination_location_id."
        }), 400

    source_id = data.get('source_location_id')
    destination_id = data.get('destination_location_id')
    include_steps = bool(data.get('include_steps', False))

    if source_id is None or destination_id is None:
        return jsonify({
            "error": "Validation Error",
            "message": "Both 'source_location_id' and 'destination_location_id' are required integers."
        }), 400

    try:
        source_id = int(source_id)
        destination_id = int(destination_id)
    except (ValueError, TypeError):
        return jsonify({
            "error": "Validation Error",
            "message": "Location IDs must be valid integers."
        }), 400

    # Verify locations exist in database
    source_loc = db.session.get(Location, source_id)
    dest_loc = db.session.get(Location, destination_id)

    if not source_loc:
        return jsonify({
            "error": "Not Found",
            "message": f"Source location with ID {source_id} does not exist."
        }), 404

    if not dest_loc:
        return jsonify({
            "error": "Not Found",
            "message": f"Destination location with ID {destination_id} does not exist."
        }), 404

    try:
        # Load active graph nodes and road edges
        nodes_data, edges_data = get_graph_data()

        # Run Dijkstra + Yen's K-Shortest Paths algorithm
        result = DijkstraRouter.solve_k_shortest_paths(
            nodes=nodes_data,
            edges=edges_data,
            source_id=source_id,
            destination_id=destination_id,
            k=3,
            include_steps=include_steps
        )

        route_run_id = None
        # Persist successful route run audit record to database
        if result['has_route']:
            route_run = RouteRun(
                source_location_id=source_id,
                destination_location_id=destination_id,
                algorithm="Dijkstra",
                total_distance_km=result['total_distance_km'],
                path_json=json.dumps(result['path']),
                execution_time_ms=result['execution_time_ms']
            )
            db.session.add(route_run)
            db.session.commit()
            route_run_id = route_run.id

        # Map path node IDs to full location objects for UI rendering convenience
        locations_lookup = {loc['id']: loc for loc in nodes_data}
        path_nodes = [locations_lookup[nid] for nid in result['path'] if nid in locations_lookup]

        # Identify edges used in primary path
        path_edges = []
        if len(result['path']) > 1:
            for i in range(len(result['path']) - 1):
                u = result['path'][i]
                v = result['path'][i + 1]
                for edge in edges_data:
                    if edge['source_location_id'] == u and edge['destination_location_id'] == v:
                        path_edges.append(edge)
                        break

        # Enrich all alternative routes with path_nodes and path_edges
        enriched_routes = []
        for r in result.get('routes', []):
            r_path = r.get('path', [])
            r_nodes = [locations_lookup[nid] for nid in r_path if nid in locations_lookup]
            r_edges = []
            if len(r_path) > 1:
                for i in range(len(r_path) - 1):
                    ru = r_path[i]
                    rv = r_path[i + 1]
                    for edge in edges_data:
                        if edge['source_location_id'] == ru and edge['destination_location_id'] == rv:
                            r_edges.append(edge)
                            break
            enriched_routes.append({
                **r,
                "path_nodes": r_nodes,
                "path_edges": r_edges
            })

        response_payload = {
            "source_location_id": source_id,
            "destination_location_id": destination_id,
            "source_location": source_loc.to_dict(),
            "destination_location": dest_loc.to_dict(),
            "algorithm": result['algorithm'],
            "has_route": result['has_route'],
            "total_distance_km": result['total_distance_km'],
            "path": result['path'],
            "path_nodes": path_nodes,
            "path_edges": path_edges,
            "routes": enriched_routes,
            "execution_time_ms": result['execution_time_ms'],
            "visited_nodes_count": result['visited_nodes_count'],
            "total_nodes_in_graph": result['total_nodes_in_graph'],
            "trace": result['trace'],
            "route_run_id": route_run_id,
            "message": "Optimal shortest path computed successfully." if result['has_route'] else "No connected road route exists between the selected locations."
        }

        return jsonify(response_payload), 200

    except ValueError as ve:
        return jsonify({
            "error": "Algorithm Error",
            "message": str(ve)
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Internal Server Error",
            "message": f"Failed to compute route: {str(e)}"
        }), 500


@routes_bp.route('/history', methods=['GET'])
@permission_required('routes:read')
def get_routes_history():
    """
    GET /api/routes/history
    Returns paginated historical route calculations saved in RouteRun table.
    Query parameters:
    - page: int (default 1)
    - per_page: int (default 10)
    - algorithm: str (optional filter, e.g. 'Dijkstra')
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        algo_filter = request.args.get('algorithm', None, type=str)

        query = RouteRun.query
        if algo_filter:
            query = query.filter(RouteRun.algorithm.ilike(f"%{algo_filter}%"))

        query = query.order_by(RouteRun.created_at.desc())
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)

        items = [item.to_dict() for item in paginated.items]

        return jsonify({
            "routes": items,
            "total": paginated.total,
            "page": paginated.page,
            "per_page": paginated.per_page,
            "total_pages": paginated.pages
        }), 200
    except Exception as e:
        return jsonify({
            "error": "Failed to fetch route history",
            "message": str(e)
        }), 500


@routes_bp.route('/history/<int:route_id>', methods=['GET'])
@permission_required('routes:read')
def get_route_history_detail(route_id):
    """
    GET /api/routes/history/:id
    Returns a specific saved RouteRun calculation record by ID.
    """
    try:
        run = db.session.get(RouteRun, route_id)
        if not run:
            return jsonify({
                "error": "Not Found",
                "message": f"Route calculation with ID {route_id} was not found."
            }), 404

        data = run.to_dict()

        # Augment with full location objects for path if possible
        if isinstance(data.get('path'), list):
            path_loc_ids = data['path']
            locations = Location.query.filter(Location.id.in_(path_loc_ids)).all()
            loc_map = {loc.id: loc.to_dict() for loc in locations}
            data['path_nodes'] = [loc_map[nid] for nid in path_loc_ids if nid in loc_map]
        else:
            data['path_nodes'] = []

        return jsonify({
            "route": data
        }), 200
    except Exception as e:
        return jsonify({
            "error": "Failed to fetch route detail",
            "message": str(e)
        }), 500


@routes_bp.route('/delivery-run', methods=['POST'])
@permission_required('routes:calculate')
def calculate_delivery_run():
    """
    POST /api/routes/delivery-run
    Plan optimal multi-stop delivery run visiting order from depot to multiple stops.
    """
    payload = request.get_json(silent=True)
    if not payload or not isinstance(payload, dict):
        return jsonify({
            "error": "Bad Request",
            "message": "Invalid or missing JSON payload in request body.",
            "status_code": 400
        }), 400

    depot_location_id = payload.get('depot_location_id')
    if depot_location_id is None or not isinstance(depot_location_id, int):
        return jsonify({
            "error": "Bad Request",
            "message": "depot_location_id is required and must be an integer.",
            "status_code": 400
        }), 400

    depot = db.session.get(Location, depot_location_id)
    if not depot:
        return jsonify({
            "error": "Not Found",
            "message": f"Depot location with ID {depot_location_id} not found.",
            "status_code": 404
        }), 404

    # Resolve destination stops from delivery_ids or stop_location_ids
    delivery_ids = payload.get('delivery_ids')
    stop_location_ids = payload.get('stop_location_ids')

    from app.models import Delivery
    stop_hubs: List[int] = []

    if delivery_ids is not None:
        if not isinstance(delivery_ids, list):
            return jsonify({
                "error": "Bad Request",
                "message": "delivery_ids must be a list of integers.",
                "status_code": 400
            }), 400
        if len(delivery_ids) == 0:
            return jsonify({
                "error": "Bad Request",
                "message": "delivery_ids cannot be empty.",
                "status_code": 400
            }), 400

        for did in delivery_ids:
            if not isinstance(did, int):
                return jsonify({
                    "error": "Bad Request",
                    "message": "delivery_ids must contain only integers.",
                    "status_code": 400
                }), 400

        # Query deliveries in database
        deliveries = Delivery.query.filter(Delivery.id.in_(delivery_ids)).all()
        found_ids = {d.id for d in deliveries}
        for did in delivery_ids:
            if did not in found_ids:
                return jsonify({
                    "error": "Not Found",
                    "message": f"Delivery with ID {did} not found.",
                    "status_code": 404
                }), 404

        # Validate delivery status (only non-Delivered deliveries permitted)
        for d in deliveries:
            if d.status == 'Delivered':
                return jsonify({
                    "error": "Bad Request",
                    "message": f"Delivery {d.tracking_number} has already been delivered.",
                    "status_code": 400
                }), 400

        # Extract destination hubs and de-duplicate
        for d in deliveries:
            hub_id = d.destination_location_id
            if hub_id != depot_location_id and hub_id not in stop_hubs:
                stop_hubs.append(hub_id)

    elif stop_location_ids is not None:
        if not isinstance(stop_location_ids, list):
            return jsonify({
                "error": "Bad Request",
                "message": "stop_location_ids must be a list of integers.",
                "status_code": 400
            }), 400

        for sid in stop_location_ids:
            if not isinstance(sid, int):
                return jsonify({
                    "error": "Bad Request",
                    "message": "stop_location_ids must contain only integers.",
                    "status_code": 400
                }), 400

        # Merge duplicates and drop depot if included
        for sid in stop_location_ids:
            if sid != depot_location_id and sid not in stop_hubs:
                stop_hubs.append(sid)
    else:
        return jsonify({
            "error": "Bad Request",
            "message": "Either stop_location_ids or delivery_ids must be provided.",
            "status_code": 400
        }), 400

    # Validate stop count constraint (2 to 8 stops)
    if len(stop_hubs) < 2 or len(stop_hubs) > 8:
        return jsonify({
            "error": "Bad Request",
            "message": f"Delivery run requires between 2 and 8 distinct stops (received {len(stop_hubs)}).",
            "status_code": 400
        }), 400

    # Ensure all stop hubs exist in Location database
    existing_stops = Location.query.filter(Location.id.in_(stop_hubs)).all()
    existing_stop_ids = {loc.id for loc in existing_stops}
    for sid in stop_hubs:
        if sid not in existing_stop_ids:
            return jsonify({
                "error": "Not Found",
                "message": f"Stop location with ID {sid} not found.",
                "status_code": 404
            }), 404

    return_to_depot = payload.get('return_to_depot', True)
    if not isinstance(return_to_depot, bool):
        return jsonify({
            "error": "Bad Request",
            "message": "return_to_depot must be a boolean.",
            "status_code": 400
        }), 400

    include_exact = payload.get('include_exact', True)
    if not isinstance(include_exact, bool):
        return jsonify({
            "error": "Bad Request",
            "message": "include_exact must be a boolean.",
            "status_code": 400
        }), 400

    # Retrieve graph topology
    nodes_data, edges_data = get_graph_data()

    try:
        from app.services.delivery_run import plan_run
        result = plan_run(
            nodes=nodes_data,
            edges=edges_data,
            depot_id=depot_location_id,
            stop_ids=stop_hubs,
            return_to_depot=return_to_depot,
            include_exact=include_exact
        )
    except ValueError as e:
        err_msg = str(e)
        if "No connected road route exists" in err_msg or "unreachable" in err_msg.lower():
            return jsonify({
                "error": "Unprocessable Entity",
                "message": err_msg,
                "status_code": 422
            }), 422
        return jsonify({
            "error": "Bad Request",
            "message": err_msg,
            "status_code": 400
        }), 400

    # Persist ONE RouteRun audit record
    try:
        rec_dest_id = depot_location_id if return_to_depot else result['recommended_order'][-1]
        route_run = RouteRun(
            source_location_id=depot_location_id,
            destination_location_id=rec_dest_id,
            algorithm="TSP",
            total_distance_km=result['recommended_distance_km'],
            path_json=json.dumps({
                "kind": "run",
                "stop_count": result['stop_count'],
                "stops": result['recommended_order'],
                "path": result['expanded_node_path']
            }),
            execution_time_ms=result['total_execution_time_ms']
        )
        db.session.add(route_run)
        db.session.commit()
        result['route_run_id'] = route_run.id
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Failed to persist RouteRun for delivery run: {e}")

    return jsonify(result), 200
