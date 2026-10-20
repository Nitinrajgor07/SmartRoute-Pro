import time
import datetime
from flask import Blueprint, jsonify, current_app
from sqlalchemy import text
from app.extensions import db

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def get_health():
    """Health check endpoint providing live system status, database connection validation, and latency."""
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    config = current_app.config
    
    # Live database connection validation probe
    start_time = time.perf_counter()
    db_connected = False
    db_error = None
    latency_ms = 0.0
    try:
        db.session.execute(text('SELECT 1'))
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        db_connected = True
    except Exception as e:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        db_connected = False
        db_error = str(e)
        current_app.logger.error(f"Database health check failed: {db_error}")

    from .cloud import get_live_db_info
    engine_name, engine_version = get_live_db_info(db_connected)

    return jsonify({
        "status": "healthy" if db_connected else "degraded",
        "latency_ms": latency_ms,
        "service": config.get('APP_NAME', 'SmartRoute Pro'),
        "version": config.get('VERSION', '8.0.0'),
        "timestamp": now,
        "environment": config.get('ENV') or os.getenv('FLASK_ENV', 'development'),
        "database": {
            "engine": engine_name,
            "version": engine_version,
            "status": "Connected & Operational" if db_connected else "Connection Failed / Standby",
            "connected": db_connected,
            "error": db_error if not db_connected else None,
            "note": "Active database storage with SQLAlchemy ORM and connection pooling."
        },
        "academic_modules": config.get('MODULES', {})
    }), 200
