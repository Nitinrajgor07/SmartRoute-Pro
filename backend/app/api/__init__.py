from flask import Blueprint

api_bp = Blueprint('api', __name__, url_prefix='/api')

from .health import health_bp
from .locations import locations_bp
from .deliveries import deliveries_bp
from .dashboard import dashboard_bp
from .routes import routes_bp, graph_bp
from .sda import sda_bp
from .cloud import cloud_bp
from .reports import reports_bp
from .auth import auth_bp
from .my import my_bp

api_bp.register_blueprint(health_bp)
api_bp.register_blueprint(locations_bp)
api_bp.register_blueprint(deliveries_bp)
api_bp.register_blueprint(dashboard_bp)
api_bp.register_blueprint(routes_bp)
api_bp.register_blueprint(graph_bp)
api_bp.register_blueprint(sda_bp)
api_bp.register_blueprint(cloud_bp)
api_bp.register_blueprint(reports_bp)
api_bp.register_blueprint(auth_bp)
api_bp.register_blueprint(my_bp)


@api_bp.route('/roads', methods=['GET'])
def get_api_roads():
    """Alias for /api/roads -> delegates to get_routes_roads."""
    from .routes import get_routes_roads
    return get_routes_roads()
