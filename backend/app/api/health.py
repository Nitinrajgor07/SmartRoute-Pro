from flask import Blueprint
from .cloud import cloud_health

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def get_health():
    """Health check endpoint providing live system status, database connection validation, and latency."""
    return cloud_health()
