# API Reference

Generated automatically from the Flask URL map and permission rules by `scripts/list_endpoints.py`.

| Method | Path | Required Permission | Allowed Roles |
|--------|------|---------------------|---------------|
| GET | `/` | `Public` | Public (None) |
| PUT | `/api/auth/change-password` | `profile:self` | ADMIN, DISPATCHER, VIEWER |
| POST | `/api/auth/login` | `Public` | Public (None) |
| POST | `/api/auth/logout` | `profile:self` | ADMIN, DISPATCHER, VIEWER |
| GET | `/api/auth/me` | `profile:self` | ADMIN, DISPATCHER, VIEWER |
| PUT | `/api/auth/profile` | `profile:self` | ADMIN, DISPATCHER, VIEWER |
| POST | `/api/auth/refresh` | `JWT Refresh Token` | Authenticated |
| POST | `/api/auth/register` | `Public` | Public (None) |
| GET | `/api/auth/users` | `users:manage` | ADMIN |
| DELETE | `/api/auth/users/<int:user_id>` | `users:manage` | ADMIN |
| POST | `/api/auth/users/<int:user_id>/approve` | `users:manage` | ADMIN |
| POST | `/api/auth/users/<int:user_id>/reject` | `users:manage` | ADMIN |
| PUT | `/api/auth/users/<int:user_id>/role` | `users:manage` | ADMIN |
| PUT | `/api/auth/users/<int:user_id>/status` | `users:manage` | ADMIN |
| GET | `/api/cloud/deployment` | `system:read` | ADMIN |
| GET | `/api/cloud/health` | `Public` | Public (None) |
| GET | `/api/cloud/metrics` | `system:read` | ADMIN |
| GET | `/api/cloud/services` | `system:read` | ADMIN |
| GET | `/api/dashboard/recent-deliveries` | `deliveries:read` | DISPATCHER |
| GET | `/api/dashboard/summary` | `dashboard:read` | ADMIN, DISPATCHER, VIEWER |
| GET | `/api/deliveries` | `deliveries:read` | DISPATCHER |
| POST | `/api/deliveries` | `deliveries:write` | DISPATCHER |
| DELETE | `/api/deliveries/<int:id>` | `deliveries:write` | DISPATCHER |
| GET | `/api/deliveries/<int:id>` | `deliveries:read` | DISPATCHER |
| PUT | `/api/deliveries/<int:id>` | `deliveries:write` | DISPATCHER |
| GET | `/api/graph` | `routes:read` | DISPATCHER |
| GET | `/api/health` | `Public` | Public (None) |
| GET | `/api/locations` | `routes:read` | DISPATCHER |
| POST | `/api/locations` | `deliveries:write` | DISPATCHER |
| DELETE | `/api/locations/<int:id>` | `deliveries:write` | DISPATCHER |
| GET | `/api/locations/<int:id>` | `routes:read` | DISPATCHER |
| PUT | `/api/locations/<int:id>` | `deliveries:write` | DISPATCHER |
| GET | `/api/my/parcels` | `parcels:own` | VIEWER |
| GET | `/api/my/parcels/<string:tracking_number>` | `parcels:own` | VIEWER |
| GET | `/api/reports/ada.csv` | `reports:operational` | DISPATCHER |
| GET | `/api/reports/ada.pdf` | `reports:operational` | DISPATCHER |
| GET | `/api/reports/cloud.pdf` | `reports:system` | ADMIN |
| GET | `/api/reports/deliveries.csv` | `reports:operational` | DISPATCHER |
| GET | `/api/reports/deliveries.pdf` | `reports:operational` | DISPATCHER |
| GET | `/api/reports/integrated.pdf` | `reports:system` | ADMIN |
| GET | `/api/reports/my-parcels.csv` | `reports:my_parcels` | VIEWER |
| GET | `/api/reports/my-parcels.pdf` | `reports:my_parcels` | VIEWER |
| GET | `/api/reports/overview` | `reports:analytics` | ADMIN, DISPATCHER |
| GET | `/api/reports/sda-clusters.csv` | `reports:operational` | DISPATCHER |
| GET | `/api/reports/sda-clusters.pdf` | `reports:operational` | DISPATCHER |
| GET | `/api/reports/statistics.pdf` | `reports:analytics` | ADMIN, DISPATCHER |
| GET | `/api/roads` | `Public` | Public (None) |
| POST | `/api/routes/delivery-run` | `routes:calculate` | DISPATCHER |
| GET | `/api/routes/graph` | `routes:read` | DISPATCHER |
| GET | `/api/routes/history` | `routes:read` | DISPATCHER |
| GET | `/api/routes/history/<int:route_id>` | `routes:read` | DISPATCHER |
| GET | `/api/routes/roads` | `routes:read` | DISPATCHER |
| POST | `/api/routes/shortest-path` | `routes:calculate` | DISPATCHER |
| POST | `/api/sda/clusters/elbow` | `zones:run` | DISPATCHER |
| DELETE | `/api/sda/clusters/history` | `zones:run` | DISPATCHER |
| GET | `/api/sda/clusters/history` | `zones:read` | DISPATCHER |
| GET | `/api/sda/clusters/history/<int:run_id>` | `zones:read` | DISPATCHER |
| POST | `/api/sda/clusters/kmeans` | `zones:run` | DISPATCHER |
| GET | `/api/sda/dataset-summary` | `zones:read` | DISPATCHER |
| GET | `/api/sda/statistics/correlation` | `analytics:read` | ADMIN, DISPATCHER |
| GET | `/api/sda/statistics/distribution` | `analytics:read` | ADMIN, DISPATCHER |
| GET | `/api/sda/statistics/inference` | `analytics:read` | ADMIN, DISPATCHER |
| GET | `/api/sda/statistics/regression` | `analytics:read` | ADMIN, DISPATCHER |
| GET | `/api/sda/statistics/summary` | `analytics:read` | ADMIN, DISPATCHER |
| GET | `/api/sda/statistics/trends` | `analytics:read` | ADMIN, DISPATCHER |
