# Cloud Computing and DevOps (CC)

## Three-Tier Architecture

SmartRoute Pro is engineered as a decoupled three-tier system:

1. Web Presentation Tier:
   - React 19 single-page application built with Vite and TypeScript.
   - In containerized deployments, built assets are served as static files by an Nginx reverse proxy on port 8080.
   - Nginx forwards `/api` requests internally to the application backend.

2. Application Service Tier:
   - Python 3.11 REST API built with Flask.
   - In containerized deployments, served by Gunicorn (`gunicorn -w 4 -b 0.0.0.0:5000 run:app`) across prefork worker processes.
   - Implements authentication, access control, routing logic, clustering, and reporting.

3. Persistence Tier:
   - Relational database management system running PostgreSQL 16.
   - In local development, an automatic fallback to local persistent SQLite (`instance/smartroute_dev.db`) is supported if PostgreSQL is not active.

---

## Docker and PostgreSQL Orchestration

The container stack is orchestrated via `docker-compose.yml` defining three interdependent services:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-smartroute_db}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-smartroute_db}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "${FRONTEND_PORT:-8080}:80"
    depends_on:
      - backend
```

Security and isolation features:
- Database network isolation: The `db` service does not publish port 5432 to the host network; only services on the internal Docker bridge network (`backend`) can connect.
- Persistent volume: PostgreSQL data persists across container restarts in the named volume `postgres_data`.
- Entrypoint orchestration: `docker-entrypoint.sh` executes Alembic database migrations and runs `seed.py` before starting Gunicorn.

---

## Configuration and Secrets Management

Configuration variables are externalized into `.env` (derived from `.env.example`):

| Variable | Description | Default / Format |
|---|---|---|
| `FLASK_ENV` | Application environment mode | `development` / `production` |
| `DATABASE_URL` | SQLAlchemy connection string | `postgresql://user:pass@db:5432/smartroute_db` |
| `SECRET_KEY` | Flask session cookie cryptographic signing key | Strong random string |
| `JWT_SECRET_KEY` | HMAC-SHA256 signature key for JSON Web Tokens | Strong random string |
| `SMARTROUTE_API_KEY` | Service-to-service automation API key | Alphanumeric token |
| `BACKEND_PORT` | Host listening port for Flask API | `5000` |
| `FRONTEND_PORT` | Host listening port for Nginx SPA | `8080` |

---

## Authentication and Role-Based Access Control

- JWT Tokens (`Flask-JWT-Extended`):
  - Access tokens: Signed with HMAC-SHA256, carrying user identity and role claims, with a 60-minute validity window.
  - Refresh tokens: Stored securely and exchanged via `POST /api/auth/refresh` with a 30-day validity window.
- Token Revocation (`TokenBlocklist`):
  - On logout (`POST /api/auth/logout`) and password change (`PUT /api/auth/change-password`), the unique token identifier (`jti`) is persisted in `token_blocklist`.
  - Each incoming request is verified against this table to immediately invalidate revoked tokens.
- Role Hierarchy:
  - Three distinct roles: `ADMIN`, `DISPATCHER`, and `VIEWER`.
  - Enforced server-side with `@permission_required(permission_name)`:
    - `ADMIN`: User management, account approval/rejection, infrastructure metrics, and system audit reports.
    - `DISPATCHER`: Consignment management, route calculation, delivery run optimization, territorial clustering, and operational reports.
    - `VIEWER`: Read-only access to own parcels by tracking number and personal parcel reports.

---

## Continuous Integration (CI)

Automated testing is configured in `.github/workflows/ci.yml` running on Ubuntu runners:
- Backend Pipeline:
  - Sets up Python 3.11.
  - Installs dependencies from `backend/requirements.txt`.
  - Runs all 182 unit and integration tests via `pytest`.
- Frontend Pipeline:
  - Sets up Node.js 20.
  - Installs dependencies via `npm ci`.
  - Runs production bundle compilation with `npm run build` (`tsc -b && vite build`).
  - Installs Playwright Chromium binaries and executes the end-to-end browser test suite.

---

## System Status and Health Telemetry

- Public Probes:
  - `GET /api/health`: Returns API service status, server timestamp, and application version.
  - `GET /api/health/db`: Executes an active `SELECT 1` ping against the database and returns query latency in milliseconds.
- Protected Telemetry (`GET /api/cloud/deployment`, permission `system:read`):
  - Uses Python's `psutil` library to collect real-time host telemetry:
    - CPU utilization percentage
    - Memory usage (used, total, percentage)
    - Disk storage (used, total, percentage)
    - Active execution threads
    - Python runtime version
    - Hosting platform identifier
    - Database engine dialect and active connection status
- Front-End System Status (`/system-status`):
  - Accessible to Administrators to inspect real-time server resource utilization and database connectivity.

---

## Deployment Status

Hosted cloud deployment is not included in this repository. No public domain or cloud hosting URL is currently configured. The system is designed and packaged for local development and on-premises container deployment via Docker Compose.

---

## Limitations

1. Single-node architecture: The current Docker Compose setup runs on a single host without multi-node clustering or Kubernetes pod orchestration.
2. In-memory rate limiting: `Flask-Limiter` stores request counts in process memory rather than a shared Redis instance. In a multi-worker production cluster, rate limits are per-worker rather than global.
3. Fallback persistence: If PostgreSQL fails to start locally, the backend silently falls back to an SQLite database. While helpful in development, production setups should enforce strict PostgreSQL availability.
4. Static file serving: Nginx serves frontend assets directly from local disk rather than an external Content Delivery Network (CDN) or object store bucket (e.g., S3).

---

## Viva Questions and Answers

### 1. What are the advantages of containerizing the application with Docker?
Docker ensures consistent runtime environments across development, testing, and deployment. It encapsulates system libraries, Python/Node versions, and dependencies, eliminating "it works on my machine" inconsistencies.

### 2. How does the Docker Compose healthcheck prevent connection errors during startup?
The PostgreSQL container runs `pg_isready` at 5-second intervals. The backend service specifies `condition: service_healthy` under `depends_on`, ensuring Flask and Gunicorn start only after PostgreSQL is ready to accept connections.

### 3. How does stateless JWT authentication work, and how does the server support token revocation?
Clients send a signed JWT in the `Authorization: Bearer <token>` header with each request. Because the token is signed with a secret key, the server verifies it without querying user credentials. For revocation (logout), the server records the token's unique `jti` in a `TokenBlocklist` database table checked during request verification.

### 4. What is the role of Gunicorn in the backend tier?
Flask's built-in development server is single-threaded and not designed for concurrent production workloads. Gunicorn is a production WSGI HTTP server using a prefork worker model, spawning multiple worker processes to handle concurrent requests.

### 5. Why are database ports omitted from the host configuration in Docker Compose?
Removing the `ports` mapping for the `db` container prevents external access from the host network. PostgreSQL is accessible only to containers sharing the internal Docker network (`backend`), protecting the database from unauthorized direct connections.

### 6. How is Role-Based Access Control enforced on the backend?
The custom decorator `@permission_required(permission_name)` extracts the user's role from the verified JWT. It checks whether that role exists in `PERMISSION_ROLES` for the requested permission. If not, it halts processing and returns a 403 Forbidden response.

### 7. What metrics are exposed on the System Status page, and how are they collected?
The backend uses Python's `psutil` library to collect CPU percentage, virtual memory usage, available disk storage, active thread counts, and database ping latency.

### 8. What is the purpose of the GitHub Actions CI pipeline in this project?
The CI pipeline automatically runs on every push and pull request. It executes all 182 backend pytest tests, builds the React frontend production bundle, and runs all 44 Playwright browser automation tests, ensuring no regressions enter the codebase.
