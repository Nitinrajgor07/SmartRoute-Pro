#!/usr/bin/env python3
"""
scripts/list_endpoints.py
Inspects the Flask URL map and view functions to generate an accurate Markdown table
of every HTTP endpoint, its supported methods, and required permissions.
"""
import os
import sys
import inspect
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app import create_app
from app.utils.permissions import PERMISSION_ROLES

def find_permission(fn):
    """Inspects a view function or its decorator chain to determine its required permission."""
    if not fn:
        return "Public"

    def search_closure(f):
        if not hasattr(f, "__closure__") or not f.__closure__:
            return None
        for cell in f.__closure__:
            val = cell.cell_contents
            if isinstance(val, str) and val in PERMISSION_ROLES:
                return val
            if callable(val) and hasattr(val, "__closure__"):
                nested = search_closure(val)
                if nested:
                    return nested
        return None

    perm = search_closure(fn)
    if perm:
        return perm

    # Source code analysis for auth decorators
    try:
        src = inspect.getsource(fn)
        if "jwt_required" in src or "verify_jwt_in_request" in src:
            if "refresh=True" in src:
                return "JWT Refresh Token"
            return "Authenticated (JWT)"
    except Exception:
        pass

    return "Public"

def generate_endpoint_table():
    app = create_app("testing")
    
    endpoints = []
    for rule in app.url_map.iter_rules():
        if rule.endpoint == "static":
            continue
        fn = app.view_functions.get(rule.endpoint)
        methods = sorted(list(rule.methods - {"HEAD", "OPTIONS"}))
        for m in methods:
            endpoints.append({
                "method": m,
                "path": rule.rule,
                "permission": find_permission(fn),
                "endpoint": rule.endpoint
            })

    # Sort by path, then method
    endpoints.sort(key=lambda x: (x["path"], x["method"]))

    lines = [
        "| Method | Path | Required Permission | Allowed Roles |",
        "|--------|------|---------------------|---------------|"
    ]

    for ep in endpoints:
        perm = ep["permission"]
        if perm in PERMISSION_ROLES:
            roles = ", ".join(PERMISSION_ROLES[perm])
        elif perm == "Public":
            roles = "Public (None)"
        else:
            roles = "Authenticated"
        lines.append(f"| {ep['method']} | `{ep['path']}` | `{perm}` | {roles} |")

    return "\n".join(lines)

if __name__ == "__main__":
    table = generate_endpoint_table()
    if len(sys.argv) > 1 and sys.argv[1] == "--write":
        target = Path(__file__).resolve().parent.parent / "docs" / "API.md"
        content = f"# API Reference\n\nGenerated automatically from the Flask URL map and permission rules by `scripts/list_endpoints.py`.\n\n{table}\n"
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Written API table to {target}")
    else:
        print(table)
