#!/usr/bin/env python3
"""
SmartRoute Pro — Automated Docker Stack Smoke Test
Standard library only verification of running multi-container stack.
"""
import os
import sys
import json
import urllib.request
import urllib.error

def run_smoke_test():
    # 1. Base URLs and Credentials
    backend_port = os.environ.get('BACKEND_PORT', '5000')
    frontend_port = os.environ.get('FRONTEND_PORT', '8080')
    
    backend_url = os.environ.get('BACKEND_URL', f"http://localhost:{backend_port}").rstrip('/')
    frontend_url = os.environ.get('FRONTEND_URL', f"http://localhost:{frontend_port}").rstrip('/')
    
    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@smartroute.pro').strip().lower()
    admin_password = os.environ.get('INITIAL_ADMIN_PASSWORD') or os.environ.get('ADMIN_PASSWORD')
    
    disp_email = os.environ.get('DISPATCHER_EMAIL', 'dispatcher@smartroute.pro').strip().lower()
    disp_password = os.environ.get('DEMO_DISPATCHER_PASSWORD') or os.environ.get('DISPATCHER_PASSWORD')

    print("==================================================")
    print(" SmartRoute Pro -- Docker Stack Smoke Test")
    print(f" Target Backend:  {backend_url}")
    print(f" Target Frontend: {frontend_url}")
    print("==================================================")

    failures = 0

    def record_result(check_name, passed, detail=""):
        nonlocal failures
        status = "PASS" if passed else "FAIL"
        if not passed:
            failures += 1
        msg = f"[{status}] {check_name}"
        if detail:
            msg += f" - {detail}"
        print(msg)

    # --------------------------------------------------------------------------
    # Check 1: GET /api/health returns 200
    # --------------------------------------------------------------------------
    health_data = None
    try:
        req = urllib.request.Request(f"{backend_url}/api/health", headers={"User-Agent": "SmokeTest/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            status_code = resp.status
            body = resp.read().decode('utf-8')
            health_data = json.loads(body)
            record_result("GET /api/health returns 200", status_code == 200, f"Status: {status_code}")
    except Exception as e:
        record_result("GET /api/health returns 200", False, str(e))

    # --------------------------------------------------------------------------
    # Check 2: Admin login works (password from env)
    # --------------------------------------------------------------------------
    admin_token = None
    try:
        login_url = f"{backend_url}/api/auth/login"
        payload = json.dumps({"email": admin_email, "password": admin_password}).encode('utf-8')
        req = urllib.request.Request(
            login_url,
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": "SmokeTest/1.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            admin_token = data.get("access_token")
            record_result("Admin login works", resp.status == 200 and bool(admin_token), f"User: {admin_email}")
    except Exception as e:
        record_result("Admin login works", False, str(e))

    # --------------------------------------------------------------------------
    # Check 3: Database engine reported by System Status API contains "PostgreSQL"
    # --------------------------------------------------------------------------
    try:
        sys_status_data = None
        try:
            req = urllib.request.Request(f"{backend_url}/api/cloud/health", headers={"User-Agent": "SmokeTest/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                sys_status_data = json.loads(resp.read().decode('utf-8'))
        except Exception:
            sys_status_data = health_data

        db_engine = sys_status_data.get("database", {}).get("engine", "") if sys_status_data else ""
        is_postgres = "postgresql" in db_engine.lower()
        record_result("System Status database engine contains 'PostgreSQL'", is_postgres, f"Engine: {db_engine}")
    except Exception as e:
        record_result("System Status database engine contains 'PostgreSQL'", False, str(e))

    # --------------------------------------------------------------------------
    # Check 4: As seeded Dispatcher: locations (24), roads (>= 83), deliveries (60)
    # --------------------------------------------------------------------------
    try:
        # 4a. Login as Dispatcher
        disp_login_url = f"{backend_url}/api/auth/login"
        disp_payload = json.dumps({"email": disp_email, "password": disp_password}).encode('utf-8')
        req = urllib.request.Request(
            disp_login_url,
            data=disp_payload,
            headers={"Content-Type": "application/json", "User-Agent": "SmokeTest/1.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            disp_data = json.loads(resp.read().decode('utf-8'))
            disp_token = disp_data.get("access_token")

        disp_headers = {
            "Authorization": f"Bearer {disp_token}",
            "User-Agent": "SmokeTest/1.0"
        }

        # 4b. Locations endpoint returns 24 items
        req_loc = urllib.request.Request(f"{backend_url}/api/locations", headers=disp_headers)
        with urllib.request.urlopen(req_loc, timeout=10) as resp:
            loc_data = json.loads(resp.read().decode('utf-8'))
            loc_count = loc_data.get("total") or len(loc_data.get("locations", []))
            record_result("Dispatcher locations endpoint returns 24 items", loc_count == 24, f"Found: {loc_count}")

        # 4c. Roads endpoint returns at least 83 items
        roads_count = 0
        try:
            req_roads = urllib.request.Request(f"{backend_url}/api/roads", headers=disp_headers)
            with urllib.request.urlopen(req_roads, timeout=10) as resp:
                roads_data = json.loads(resp.read().decode('utf-8'))
                roads_count = roads_data.get("total") or roads_data.get("count") or len(roads_data.get("roads", []))
        except Exception:
            req_graph = urllib.request.Request(f"{backend_url}/api/graph", headers=disp_headers)
            with urllib.request.urlopen(req_graph, timeout=10) as resp:
                graph_data = json.loads(resp.read().decode('utf-8'))
                roads_count = graph_data.get("total_edges") or len(graph_data.get("edges", []))

        record_result("Dispatcher roads endpoint returns >= 83 items", roads_count >= 83, f"Found: {roads_count}")

        # 4d. Deliveries endpoint returns 60 items
        req_deliv = urllib.request.Request(f"{backend_url}/api/deliveries?per_page=100", headers=disp_headers)
        with urllib.request.urlopen(req_deliv, timeout=10) as resp:
            deliv_data = json.loads(resp.read().decode('utf-8'))
            deliv_count = deliv_data.get("total") or len(deliv_data.get("deliveries", []))
            record_result("Dispatcher deliveries endpoint returns 60 items", deliv_count == 60, f"Found: {deliv_count}")

    except Exception as e:
        record_result("Dispatcher authenticated endpoints check", False, str(e))

    # --------------------------------------------------------------------------
    # Check 5: Frontend URL returns 200
    # --------------------------------------------------------------------------
    try:
        req_front = urllib.request.Request(f"{frontend_url}/", headers={"User-Agent": "SmokeTest/1.0"})
        with urllib.request.urlopen(req_front, timeout=10) as resp:
            record_result("Frontend URL returns 200 OK", resp.status == 200, f"Status: {resp.status}")
    except Exception as e:
        record_result("Frontend URL returns 200 OK", False, str(e))

    print("==================================================")
    if failures == 0:
        print("[+] ALL CHECKS PASSED: SmartRoute Pro container stack is fully operational.")
        sys.exit(0)
    else:
        print(f"[-] SMOKE TEST FAILED: {failures} check(s) failed.")
        sys.exit(1)

if __name__ == '__main__':
    run_smoke_test()
