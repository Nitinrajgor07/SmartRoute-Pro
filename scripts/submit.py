#!/usr/bin/env python3
"""
scripts/submit.py

Standard library script for submission packaging and verification:
1. Checks that the git working tree is clean.
2. Runs backend pytest tests and frontend npm build, stopping on failure.
3. Scans tracked files for leaked secrets and disallowed passwords.
4. Generates SmartRoute-Pro-submission.zip using git archive.
5. Verifies zip integrity, forbidden entries, size (< 15 MB), and prints summary statistics.
"""

import os
import sys
import subprocess
import zipfile
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Allowed paths for the three demo passwords:
# - backend/tests/*
# - frontend/e2e/*
# - frontend/src/pages/Login.tsx (development demo buttons)
# - README.md (demo-accounts evaluation table)
ALLOWED_PASSWORD_PATHS = {
    Path("README.md"),
    Path("frontend/src/pages/Login.tsx"),
    Path("scripts/submit.py"),
}

def is_allowed_for_demo_passwords(file_path: Path) -> bool:
    posix_path = file_path.as_posix()
    if file_path in ALLOWED_PASSWORD_PATHS:
        return True
    if posix_path.startswith("backend/tests/"):
        return True
    if posix_path.startswith("frontend/e2e/"):
        return True
    return False

def run_step(step_name: str):
    print(f"\n========================================================")
    print(f"[*] STEP: {step_name}")
    print(f"========================================================")

def step_1_check_git_status():
    run_step("1. Verifying Clean Working Tree")
    res = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True
    )
    uncommitted = res.stdout.strip()
    if uncommitted:
        print("[!] ERROR: Git working tree has uncommitted changes:\n")
        print(uncommitted)
        print("\nPlease commit or stash changes before running submit.py.")
        sys.exit(1)
    print("[OK] Git working tree is clean.")

def step_2_run_tests_and_build():
    run_step("2. Running Backend Tests & Frontend Production Build")
    
    # 2a. Backend pytest
    print("[*] Executing backend test suite (pytest)...")
    pytest_res = subprocess.run(
        [sys.executable, "-m", "pytest", "-q"],
        cwd=REPO_ROOT / "backend",
        check=False
    )
    if pytest_res.returncode != 0:
        print("[!] ERROR: Backend test suite failed.")
        sys.exit(1)
    print("[OK] Backend test suite passed.")

    # 2b. Frontend build
    print("[*] Executing frontend build (tsc -b && vite build)...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    build_res = subprocess.run(
        [npm_cmd, "run", "build"],
        cwd=REPO_ROOT / "frontend",
        check=False
    )
    if build_res.returncode != 0:
        print("[!] ERROR: Frontend build failed.")
        sys.exit(1)
    print("[OK] Frontend build succeeded.")

def step_3_scan_secrets():
    run_step("3. Scanning Tracked Files for Secrets & Passwords")
    
    # Get all tracked files
    res = subprocess.run(
        ["git", "ls-files"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True
    )
    tracked_files = [line.strip() for line in res.stdout.splitlines() if line.strip()]

    secret_key_pattern = re.compile(r'(SECRET_KEY|JWT_SECRET_KEY|PASSWORD)\s*=\s*(.+)', re.IGNORECASE)
    allowed_placeholders = {
        'change-me', '""', "''", 'null', 'none', 'ci_test_postgres_pw_2026',
        'ci_test_secret_key_2026', 'ci_test_jwt_secret_key_2026',
        'ciadmintestsecret987!', 'cidispatchtestsecret987!', 'civiewertestsecret987!'
    }

    demo_passwords = ["Admin@123456", "Dispatch@123456", "Viewer@123456"]
    violations = []

    for rel_path_str in tracked_files:
        file_path = REPO_ROOT / rel_path_str
        rel_path = Path(rel_path_str)

        # Skip binary files or snapshot images
        if rel_path.suffix.lower() in {".png", ".jpg", ".jpeg", ".ico", ".pdf", ".gz", ".woff", ".woff2"}:
            continue

        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception:
            continue

        # Check for private keys
        if rel_path != Path("scripts/submit.py") and "PRIVATE KEY-----" in content:
            violations.append(f"Private key detected in {rel_path_str}")

        # Check for demo passwords outside allowed locations
        if not is_allowed_for_demo_passwords(rel_path):
            for pwd in demo_passwords:
                if pwd in content:
                    violations.append(f"Demo password '{pwd}' detected outside allowed files in: {rel_path_str}")

        # Check env variable assignments for non-placeholders
        if rel_path.name in {".env.example", "docker-compose.yml"}:
            for line_no, line in enumerate(content.splitlines(), start=1):
                match = secret_key_pattern.search(line)
                if match:
                    val = match.group(2).strip().strip("'\"").lower()
                    if val and not any(ph in val for ph in allowed_placeholders) and not val.startswith("${"):
                        violations.append(f"Hardcoded secret value in {rel_path_str}:{line_no} -> {match.group(1)}={val}")

    if violations:
        print("[!] ERROR: Secret scanning failed with violations:")
        for v in violations:
            print(f"  - {v}")
        sys.exit(1)

    print(f"[OK] Scanned {len(tracked_files)} tracked files. No secret leaks or misplaced passwords detected.")

def step_4_create_archive() -> Path:
    run_step("4. Creating Submission Archive (git archive)")
    zip_name = "SmartRoute-Pro-submission.zip"
    zip_path = REPO_ROOT / zip_name

    if zip_path.exists():
        zip_path.unlink()

    cmd = ["git", "archive", "--format=zip", f"--output={zip_name}", "HEAD"]
    print(f"[*] Running: {' '.join(cmd)}")
    subprocess.run(cmd, cwd=REPO_ROOT, check=True)

    if not zip_path.exists():
        print(f"[!] ERROR: Expected archive {zip_path} was not created.")
        sys.exit(1)

    print(f"[OK] Successfully created {zip_name}.")
    return zip_path

def step_5_verify_archive(zip_path: Path):
    run_step("5. Verifying Submission Archive")
    
    file_size_bytes = zip_path.stat().st_size
    file_size_mb = file_size_bytes / (1024 * 1024)
    print(f"[*] Archive file size: {file_size_mb:.2f} MB ({file_size_bytes:,} bytes)")

    if file_size_mb >= 15.0:
        print(f"[!] ERROR: Archive size ({file_size_mb:.2f} MB) exceeds maximum allowed limit of 15 MB.")
        sys.exit(1)

    forbidden_patterns = [
        re.compile(r'(^|/)\.env$'),
        re.compile(r'(^|/)\.env\.(local|production|development)$'),
        re.compile(r'(^|/)node_modules/'),
        re.compile(r'(^|/)venv/'),
        re.compile(r'(^|/)\.git/'),
        re.compile(r'\.db$'),
        re.compile(r'(^|/)__pycache__/'),
    ]

    with zipfile.ZipFile(zip_path, "r") as zf:
        namelist = zf.namelist()
        file_count = len(namelist)
        top_level = set()

        violations = []
        for name in namelist:
            parts = name.split("/")
            if parts[0]:
                top_level.add(parts[0])

            for pattern in forbidden_patterns:
                if pattern.search(name):
                    violations.append(f"Forbidden entry found: {name}")

        if violations:
            print("[!] ERROR: Archive verification failed with forbidden entries:")
            for v in violations:
                print(f"  - {v}")
            sys.exit(1)

        print(f"[OK] Total files in archive: {file_count}")
        print(f"[OK] Top-level entries in archive: {sorted(list(top_level))}")
        print(f"[OK] No forbidden entries found (.env, node_modules, venv, .git, *.db, __pycache__).")
        print(f"\n========================================================")
        print(f"[SUCCESS] Submission archive validated and ready: {zip_path.name}")
        print(f"========================================================")

def main():
    step_1_check_git_status()
    step_2_run_tests_and_build()
    step_3_scan_secrets()
    zip_path = step_4_create_archive()
    step_5_verify_archive(zip_path)

if __name__ == "__main__":
    main()
