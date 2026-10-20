import os
import sys
import time
import json
import numpy as np
from app import create_app
from app.extensions import db
from app.models import Location, Road, Delivery, RouteRun, ClusterRun, User
from app.services.reporting import ReportingService

def run_performance_benchmarks():
    print("==========================================================")
    print("SMARTROUTE PRO — EMPIRICAL PERFORMANCE BENCHMARKS")
    print("==========================================================")
    
    app = create_app('development')
    
    with app.app_context():
        # 1. Database & Location / Road baseline counts
        loc_count = Location.query.count()
        road_count = Road.query.filter_by(is_active=True).count()
        delivery_count = Delivery.query.count()
        
        print(f"\n[1] Database Records:")
        print(f"    - Locations (Nodes |V|): {loc_count}")
        print(f"    - Roads (Edges |E|):     {road_count}")
        print(f"    - Deliveries:            {delivery_count}")
        
        # 2. Database Ping Latency
        latencies = []
        for _ in range(50):
            t0 = time.perf_counter()
            db.session.execute(db.text('SELECT 1'))
            latencies.append((time.perf_counter() - t0) * 1000)
        db_p50 = np.percentile(latencies, 50)
        db_p95 = np.percentile(latencies, 95)
        db_avg = np.mean(latencies)
        print(f"\n[2] Database Ping Latency (50 iterations):")
        print(f"    - Avg: {db_avg:.3f} ms | p50: {db_p50:.3f} ms | p95: {db_p95:.3f} ms")

        # Create test client with admin JWT
        from flask_jwt_extended import create_access_token
        admin = User.query.filter_by(role='ADMIN').first()
        admin_id = str(admin.id) if admin else "1"
        admin_tok = create_access_token(identity=admin_id, additional_claims={"role": "ADMIN", "email": "admin@smartroute.pro"})
        headers = {"Authorization": f"Bearer {admin_tok}", "Content-Type": "application/json"}
        client = app.test_client()

        # 3. ADA: Dijkstra Shortest Path Benchmark
        locs = Location.query.limit(2).all()
        if len(locs) >= 2:
            src_id, dst_id = locs[0].id, locs[1].id
            dijkstra_times = []
            for _ in range(30):
                t0 = time.perf_counter()
                res = client.post('/api/routes/shortest-path', headers=headers, json={
                    "source_location_id": src_id,
                    "destination_location_id": dst_id,
                    "include_steps": True
                })
                dijkstra_times.append((time.perf_counter() - t0) * 1000)
            d_p50 = np.percentile(dijkstra_times, 50)
            d_p95 = np.percentile(dijkstra_times, 95)
            d_avg = np.mean(dijkstra_times)
            d_min = np.min(dijkstra_times)
            data = res.get_json()
            print(f"\n[3] ADA: Dijkstra Shortest Path Engine via API (30 iterations):")
            print(f"    - Min: {d_min:.3f} ms | Avg: {d_avg:.3f} ms | p50: {d_p50:.3f} ms | p95: {d_p95:.3f} ms")
            print(f"    - Path distance: {data.get('total_distance_km')} km | Alg Execution time: {data.get('execution_time_ms')} ms")
        
        # 4. SDA: K-Means Spatial Clustering Benchmark
        cluster_times = []
        for _ in range(20):
            t0 = time.perf_counter()
            c_res = client.post('/api/sda/clusters/kmeans', headers=headers, json={"k": 3, "max_iterations": 300, "random_state": 42})
            cluster_times.append((time.perf_counter() - t0) * 1000)
        c_p50 = np.percentile(cluster_times, 50)
        c_p95 = np.percentile(cluster_times, 95)
        c_avg = np.mean(cluster_times)
        c_min = np.min(cluster_times)
        c_data = c_res.get_json()
        print(f"\n[4] SDA: K-Means Spatial Clustering Engine via API (20 iterations, k=3):")
        print(f"    - Min: {c_min:.3f} ms | Avg: {c_avg:.3f} ms | p50: {c_p50:.3f} ms | p95: {c_p95:.3f} ms")
        print(f"    - Status: {c_res.status_code} | Silhouette Score: {c_data.get('silhouette_score', 'N/A')}")
        
        # 5. SDA: Statistical Analytics & OLS Benchmark
        stats_times = []
        for _ in range(20):
            t0 = time.perf_counter()
            s_res = client.get('/api/sda/statistics/summary', headers=headers)
            stats_times.append((time.perf_counter() - t0) * 1000)
        s_p50 = np.percentile(stats_times, 50)
        s_p95 = np.percentile(stats_times, 95)
        s_avg = np.mean(stats_times)
        print(f"\n[5] SDA: Statistical Analytics & OLS Engine via API (20 iterations):")
        print(f"    - Status: {s_res.status_code} | Avg: {s_avg:.3f} ms | p50: {s_p50:.3f} ms | p95: {s_p95:.3f} ms")
        
        # 6. Report Generation Benchmarks (PDF)
        pdf_benchmarks = [
            ("Deliveries PDF", lambda: ReportingService.generate_deliveries_pdf({'status': 'ALL', 'priority': 'ALL', 'search': ''})),
            ("ADA Dijkstra PDF", lambda: ReportingService.generate_ada_pdf()),
            ("SDA Clustering PDF", lambda: ReportingService.generate_sda_clusters_pdf()),
            ("Statistical Analytics PDF", lambda: ReportingService.generate_statistics_pdf()),
            ("Cloud Operations PDF", lambda: ReportingService.generate_cloud_pdf()),
            ("Integrated Academic PDF", lambda: ReportingService.generate_integrated_pdf()),
        ]
        print(f"\n[6] Reporting Engine (PDF Generation Runtimes):")
        for report_name, report_fn in pdf_benchmarks:
            r_times = []
            for _ in range(5):
                t0 = time.perf_counter()
                report_fn()
                r_times.append((time.perf_counter() - t0) * 1000)
            print(f"    - {report_name:28s} Avg: {np.mean(r_times):7.2f} ms | p95: {np.percentile(r_times, 95):7.2f} ms")

        # 7. API Endpoints Benchmarks
        api_endpoints = [
            ("GET /api/health", "/api/health", {}),
            ("GET /api/dashboard/summary", "/api/dashboard/summary", {}),
            ("GET /api/deliveries", "/api/deliveries", headers),
            ("GET /api/cloud/health", "/api/cloud/health", {}),
            ("GET /api/cloud/deployment", "/api/cloud/deployment", headers),
            ("GET /api/reports/overview", "/api/reports/overview", headers),
        ]
        print(f"\n[7] API REST Endpoints Latency (20 requests each):")
        for label, url, req_headers in api_endpoints:
            e_times = []
            for _ in range(20):
                t0 = time.perf_counter()
                r = client.get(url, headers=req_headers)
                e_times.append((time.perf_counter() - t0) * 1000)
            print(f"    - {label:32s} Status: {r.status_code} | Avg: {np.mean(e_times):6.2f} ms | p95: {np.percentile(e_times, 95):6.2f} ms")

        # 8. ADA: Delivery Run Multi-Stop Route Optimization Benchmark (Factorial Growth)
        from app.services.delivery_run import plan_run
        all_locs = Location.query.all()
        all_roads = Road.query.filter_by(is_active=True).all()
        nodes_data = [loc.to_dict() for loc in all_locs]
        edges_data = [road.to_dict() for road in all_roads]

        # Use fixed candidate stops from connected central urban hubs
        candidate_stops = [2, 3, 4, 5, 8, 9, 10, 11]

        print(f"\n[8] ADA: Delivery Run Factorial Growth Comparison (Exact vs Fast Heuristic):")
        print(f"    {'Stops':<7} | {'Orders (k!)':<12} | {'Fast (ms)':<10} | {'Exact (ms)':<11} | {'Gap (%)':<8}")
        print(f"    {'-'*7}-+-{'-'*12}-+-{'-'*10}-+-{'-'*11}-+-{'-'*8}")

        import math
        for k in [4, 5, 6, 7, 8]:
            selected_stops = candidate_stops[:k]
            res = plan_run(
                nodes=nodes_data,
                edges=edges_data,
                depot_id=1,
                stop_ids=selected_stops,
                return_to_depot=True,
                include_exact=True
            )
            perms = math.factorial(k)
            fast_ms = res['fast_method']['execution_time_ms']
            exact_ms = res['exact_method']['execution_time_ms']
            gap = res.get('gap_percent', 0.0)
            print(f"    {k:<7} | {perms:<12} | {fast_ms:<10.3f} | {exact_ms:<11.3f} | {gap:<8.2f}%")

if __name__ == '__main__':
    run_performance_benchmarks()
