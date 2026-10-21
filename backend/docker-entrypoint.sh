#!/usr/bin/env bash
set -e

echo "=== Starting SmartRoute Pro Container Initialization ==="

# 1. Wait until PostgreSQL accepts connections
echo "[*] Waiting for PostgreSQL database connection..."
python - << 'EOF'
import os
import sys
import time
from sqlalchemy import create_engine, text

db_url = os.getenv('DATABASE_URL')
if not db_url:
    print("[-] Error: DATABASE_URL environment variable is not configured.", file=sys.stderr)
    sys.exit(1)

if db_url.startswith('postgres://'):
    db_url = db_url.replace('postgres://', 'postgresql://', 1)

if 'sqlite' in db_url:
    print("[*] SQLite database detected; skipping TCP connection wait.")
    sys.exit(0)

timeout = int(os.getenv('DB_WAIT_TIMEOUT', '45'))
start_time = time.time()
connected = False

while time.time() - start_time < timeout:
    try:
        engine = create_engine(db_url, connect_args={"connect_timeout": 3})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[+] PostgreSQL is ready and accepting connections.")
        connected = True
        break
    except Exception as e:
        elapsed = int(time.time() - start_time)
        print(f"[*] Waiting for PostgreSQL ({elapsed}s / {timeout}s)...")
        time.sleep(2)

if not connected:
    print(f"[-] FATAL: Timed out waiting for PostgreSQL connection after {timeout} seconds.", file=sys.stderr)
    sys.exit(1)
EOF

# 2. Create the schema on an empty database using db.create_all()
echo "[*] Initializing / verifying database schema..."
python - << 'EOF'
import os
import sys
from app import create_app
from app.extensions import db

env_name = os.getenv('FLASK_ENV', 'production')
app = create_app(env_name)
with app.app_context():
    try:
        db.create_all()
        print("[+] Full database schema created / verified successfully.")
    except Exception as e:
        print(f"[-] Schema initialization failed: {e}", file=sys.stderr)
        sys.exit(1)
EOF

# 3. Seed database if SEED_ON_START is true
SEED_ON_START_LOWER=$(echo "${SEED_ON_START:-false}" | tr '[:upper:]' '[:lower:]')
if [ "$SEED_ON_START_LOWER" = "true" ] || [ "$SEED_ON_START_LOWER" = "1" ] || [ "$SEED_ON_START_LOWER" = "yes" ]; then
    echo "[*] SEED_ON_START is enabled. Executing seed.py..."
    python seed.py
else
    echo "[*] SEED_ON_START is disabled. Skipping database seed."
fi

# 4. Hand off execution to CMD (defaults to Gunicorn WSGI)
if [ "$#" -eq 0 ]; then
    set -- gunicorn -c gunicorn.conf.py run:app
fi

echo "[*] Launching application command: $@"
exec "$@"
