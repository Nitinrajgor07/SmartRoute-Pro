# SmartRoute Pro

SmartRoute Pro is a web-based logistics route planning and data analytics platform for managing hubs, road networks, and package deliveries.

## Role Features

- Admin: Manages user accounts and approval statuses, inspects cloud system telemetry, and downloads system-level audit reports.
- Dispatcher: Calculates single and multi-stop delivery routes, performs spatial clustering on hubs, manages consignment records, and exports operational reports.
- Viewer: Inspects personal consigned packages by tracking number or email and downloads personal parcel summary reports.

## Technology Stack

### Backend
- Python 3.11
- Flask >= 3.0.0
- Flask-SQLAlchemy >= 3.1.0
- Flask-Migrate >= 4.1.0
- Flask-JWT-Extended >= 4.6.0
- Flask-Limiter >= 3.5.0
- psycopg2-binary >= 2.9.0
- pandas >= 2.1.0
- numpy >= 1.26.0
- scikit-learn >= 1.4.0
- scipy >= 1.12.0
- reportlab >= 4.0.0
- gunicorn >= 21.2.0
- pytest >= 8.0.0

### Frontend
- React 19.2.8
- TypeScript 6.0.2
- Vite 8.3.0
- Tailwind CSS 3.4.19
- React Router 7.18.4
- Recharts 3.10.1
- Leaflet 1.9.4
- Axios 1.20.0
- Playwright 1.64.1

## Quick Start (Local)

### Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
flask seed-demo
python run.py
```
The backend API starts at `http://127.0.0.1:5000`.

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The frontend interface opens at `http://localhost:5173`.

## Run with Docker

Run the entire SmartRoute Pro stack (PostgreSQL, Flask Gunicorn API, and React/Nginx SPA) with pre-seeded data:

```bash
# 1. Copy template environment variables
cp .env.example .env

# 2. Start the container stack in detached mode
docker compose up --build -d

# 3. Access applications:
# Frontend: http://localhost:8080 | Backend: http://localhost:5000
```

## Demo Accounts

Demo accounts are provided for local development and evaluation:

| Role | Email | Password | Scope |
| --- | --- | --- | --- |
| Administrator | admin@smartroute.pro | Admin@123456 | User management, system status, system reports |
| Dispatcher | dispatcher@smartroute.pro | Dispatch@123456 | Deliveries CRUD, route solver, clustering, operational reports |
| Viewer | viewer@smartroute.pro | Viewer@123456 | Personal parcel tracking and parcel reports |

In development mode (`import.meta.env.DEV`), the login page displays demo buttons that pre-populate form credentials directly in React state. The accounts are created during database seeding (`flask seed-demo` or `backend/seed.py`). In production environments without development flags, these buttons are not rendered.

## Automated Tests

### Backend Unit and Integration Tests
```bash
cd backend
pytest
```
Measured test result: 182 passed in 170.67s.

### Frontend End-to-End Tests
```bash
cd frontend
npx playwright test
```
Measured test result: 44 passed in 1.7m across Chromium suites.

## Repository Structure

```
smart-route-pro/
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers (auth, deliveries, routes, sda, reports, cloud)
│   │   ├── models/       # SQLAlchemy models (User, Location, Road, Delivery, RouteRun, ClusterRun)
│   │   ├── services/     # Pure algorithms (dijkstra, delivery_run, clustering, statistics, inference)
│   │   └── utils/        # Permissions, decorators, and JWT helpers
│   ├── migrations/       # Alembic schema migrations
│   ├── tests/            # Pytest test suite
│   ├── requirements.txt  # Python package specifications
│   └── seed.py           # Database initialisation script
├── frontend/
│   ├── e2e/              # Playwright browser automation tests
│   ├── src/
│   │   ├── app/          # Auth context and route guards
│   │   ├── components/   # Shared UI components
│   │   ├── pages/        # Dashboard, Deliveries, Route, Analytics, Settings, Login, Register
│   │   └── services/     # API client and service endpoints
│   └── package.json      # Frontend package configuration
├── docs/                 # System documentation and academic reports
└── docker-compose.yml    # Container orchestration file
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): System architecture, database schema, and permission matrix.
- [API Reference](docs/API.md): Complete list of HTTP endpoints and required permissions.
- [Algorithms (ADA)](docs/ADA.md): Graph model, Dijkstra, TSP delivery run, and benchmarks.
- [Statistical Analysis (SDA)](docs/SDA.md): Seeded dataset, descriptive statistics, OLS regression, clustering, and hypothesis tests.
- [Cloud and Deployment (CC)](docs/CC.md): Architecture tiers, Docker setup, security, CI pipeline, and system telemetry.
- [Demonstration Guide](docs/DEMO.md): 10-minute presentation guide covering all three user roles.
