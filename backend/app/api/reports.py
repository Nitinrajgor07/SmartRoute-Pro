import datetime
from flask import Blueprint, request, jsonify, Response
from app.services.reporting import ReportingService
from app.utils.permissions import permission_required

reports_bp = Blueprint('reports', __name__, url_prefix='/reports')

@reports_bp.route('/overview', methods=['GET'])
@permission_required('reports:analytics')
def get_reports_overview():
    """Returns metadata and record counts for available reports."""
    data = ReportingService.get_overview_statistics()
    return jsonify(data), 200

# ------------------------------------------------------------------------------
# 1. Delivery Operations Reports
# ------------------------------------------------------------------------------

@reports_bp.route('/deliveries.csv', methods=['GET'])
@permission_required('reports:operational')
def export_deliveries_csv():
    """Exports delivery consignment records as a UTF-8 formula-safe CSV."""
    filters = {
        'status': request.args.get('status', 'ALL'),
        'priority': request.args.get('priority', 'ALL'),
        'search': request.args.get('search', '').strip()
    }
    csv_bytes = ReportingService.generate_deliveries_csv(filters)
    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"delivery_report_{date_str}.csv"
    
    return Response(
        csv_bytes,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

@reports_bp.route('/deliveries.pdf', methods=['GET'])
@permission_required('reports:operational')
def export_deliveries_pdf():
    """Exports delivery operations manifest as an A4 PDF document."""
    filters = {
        'status': request.args.get('status', 'ALL'),
        'priority': request.args.get('priority', 'ALL'),
        'search': request.args.get('search', '').strip()
    }
    pdf_bytes = ReportingService.generate_deliveries_pdf(filters)
    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"delivery_report_{date_str}.pdf"

    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

# ------------------------------------------------------------------------------
# 2. Route Planning Reports
# ------------------------------------------------------------------------------

@reports_bp.route('/ada.csv', methods=['GET'])
@permission_required('reports:operational')
def export_ada_csv():
    """Exports historical route plans to CSV."""
    csv_bytes = ReportingService.generate_ada_csv()
    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"route_report_{date_str}.csv"

    return Response(
        csv_bytes,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

@reports_bp.route('/ada.pdf', methods=['GET'])
@permission_required('reports:operational')
def export_ada_pdf():
    """Exports route planning report as PDF."""
    run_id = request.args.get('run_id')
    if run_id:
        try:
            run_id = int(run_id)
        except ValueError:
            return jsonify({"error": "Bad Request", "message": "Invalid run_id parameter", "status_code": 400}), 400

    pdf_bytes = ReportingService.generate_ada_pdf(run_id)
    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"route_report_{date_str}.pdf"

    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

# ------------------------------------------------------------------------------
# 3. Delivery Zones Reports
# ------------------------------------------------------------------------------

@reports_bp.route('/sda-clusters.csv', methods=['GET'])
@permission_required('reports:operational')
def export_sda_clusters_csv():
    """Exports delivery zone assignments as CSV."""
    run_id = request.args.get('run_id')
    if run_id:
        try:
            run_id = int(run_id)
        except ValueError:
            return jsonify({"error": "Bad Request", "message": "Invalid run_id parameter", "status_code": 400}), 400

    csv_bytes = ReportingService.generate_sda_clusters_csv(run_id)
    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"zones_report_{date_str}.csv"

    return Response(
        csv_bytes,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

@reports_bp.route('/sda-clusters.pdf', methods=['GET'])
@permission_required('reports:operational')
def export_sda_clusters_pdf():
    """Exports delivery zones report as PDF."""
    run_id = request.args.get('run_id')
    if run_id:
        try:
            run_id = int(run_id)
        except ValueError:
            return jsonify({"error": "Bad Request", "message": "Invalid run_id parameter", "status_code": 400}), 400

    pdf_bytes = ReportingService.generate_sda_clusters_pdf(run_id)
    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"zones_report_{date_str}.pdf"

    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

# ------------------------------------------------------------------------------
# 4. Analytics Report
# ------------------------------------------------------------------------------

@reports_bp.route('/statistics.pdf', methods=['GET'])
@permission_required('reports:analytics')
def export_statistics_pdf():
    """Exports operational analytics report as PDF."""
    pdf_bytes = ReportingService.generate_statistics_pdf()
    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"analytics_report_{date_str}.pdf"

    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

# ------------------------------------------------------------------------------
# 5. System Status Report
# ------------------------------------------------------------------------------

@reports_bp.route('/cloud.pdf', methods=['GET'])
@permission_required('reports:system')
def export_cloud_pdf():
    """Exports system infrastructure and security audit report as PDF."""
    pdf_bytes = ReportingService.generate_cloud_pdf()
    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"system_status_report_{date_str}.pdf"

    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

# ------------------------------------------------------------------------------
# 6. Full Summary Report
# ------------------------------------------------------------------------------

@reports_bp.route('/integrated.pdf', methods=['GET'])
@permission_required('reports:system')
def export_integrated_pdf():
    """Exports comprehensive operational summary report as PDF."""
    pdf_bytes = ReportingService.generate_integrated_pdf()
    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"full_summary_report_{date_str}.pdf"

    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

# ------------------------------------------------------------------------------
# 7. Customer Parcel Tracking Reports
# ------------------------------------------------------------------------------

@reports_bp.route('/my-parcels.csv', methods=['GET'])
@permission_required('reports:my_parcels')
def export_my_parcels_csv():
    """Exports customer's own delivery records to CSV."""
    from flask_jwt_extended import get_jwt_identity
    from app.models import User
    from app.extensions import db
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
        user = db.session.get(User, user_id)
        email = user.email if user else ""
    except Exception:
        email = ""
    csv_bytes = ReportingService.generate_my_parcels_csv(email)
    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"my_parcels_{date_str}.csv"

    return Response(
        csv_bytes,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

@reports_bp.route('/my-parcels.pdf', methods=['GET'])
@permission_required('reports:my_parcels')
def export_my_parcels_pdf():
    """Exports customer's own delivery tracking report to PDF."""
    from flask_jwt_extended import get_jwt_identity
    from app.models import User
    from app.extensions import db
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
        user = db.session.get(User, user_id)
        email = user.email if user else ""
    except Exception:
        email = ""
    pdf_bytes = ReportingService.generate_my_parcels_pdf(email)
    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"my_parcels_{date_str}.pdf"

    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )


