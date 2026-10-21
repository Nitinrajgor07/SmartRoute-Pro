# Demonstration Guide (10-Minute Walkthrough)

This guide provides a structured, step-by-step demonstration order across the three user roles in SmartRoute Pro.

---

## Preparation (1 Minute)

1. Ensure the backend and frontend servers are running:
   - Backend: `http://127.0.0.1:5000`
   - Frontend: `http://localhost:5173`
2. Open a clean browser window at `http://localhost:5173/login`.

---

## Part 1: Dispatcher Role (4 Minutes)

The Dispatcher manages delivery consignments, plans shortest routes, optimizes multi-stop runs, and analyzes delivery territories.

### Step 1: Sign in as Dispatcher
1. On the login page, click the **Dispatcher** demo button.
2. Click **Sign in**.
3. Expected view: Redirects to `/` (Dispatcher Operations Dashboard). Review the delivery metrics and quick shortcuts.

### Step 2: Consignment Management
1. Click **Deliveries** in the left sidebar navigation (`/deliveries`).
2. Type `Express` into the Priority filter dropdown to filter the consignment grid.
3. Click the **View** button (eye icon) on any delivery row to inspect consignment details, pickup hub, destination hub, and assigned driver.
4. Close the modal by clicking the **Close** button.

### Step 3: Single-Source Shortest Route (Dijkstra)
1. Click **Route Planner** in the sidebar navigation (`/routes`).
2. In the Route Form on the left:
   - Set **Origin Hub** to `Majestic Depot`.
   - Set **Destination Hub** to `Whitefield`.
3. Click **Calculate Route**.
4. Expected view: The interactive map displays the optimal road polyline. The results card shows total distance, estimated transit time, and individual step-by-step road segments.

### Step 4: Multi-Stop Delivery Run & Dispatch
1. On the Route Planner page, switch to the **Delivery Run** tab.
2. Select a territory from the **Zone** dropdown (e.g. `Zone 1`). Up to 8 pending parcels in that zone are automatically ticked by priority.
3. Review the live counter (`N parcels, M stops`) and set the **Start time** (defaults to next 5-min slot).
4. Click **Plan run** to calculate the optimal stop sequence and inspect live arrival times (`Arrive HH:MM`, `Back at depot HH:MM`). Changing the start time dynamically recalculates arrival times.
5. Click **Dispatch run**, enter the driver name (e.g. `Marcus Vance`), and confirm. The plan marks green with `Dispatched to Marcus Vance`, the button disables, and the dispatched parcels disappear from the pending list.

### Step 5: Spatial Territory Clustering
1. Click **Delivery Zones** in the sidebar navigation (`/clusters`).
2. Set cluster count $K = 3$.
3. Click **Run Clustering**.
4. Expected view: The map renders hubs colour-coded by their assigned zone with centroid markers. The table lists cluster sizes, inertia, and silhouette validation score ($0.4663$).

---

## Part 2: Administrator Role (3 Minutes)

The Administrator manages user accounts, registration approvals, system health, and audit reports.

### Step 1: Switch to Admin Account
1. Click the user profile button in the top right corner and select **Sign out**.
2. On `/login`, click the **Admin** demo button.
3. Click **Sign in**.
4. Expected view: Redirects to `/` (Administrator Dashboard).

### Step 2: User Governance and Account Approvals
1. Click **Settings** in the sidebar navigation (`/settings`).
2. Under the **User Management** section:
   - Inspect the list of registered users and their roles (`ADMIN`, `DISPATCHER`, `VIEWER`).
   - If any new self-registered account has status `pending`, click **Approve** or **Reject**.
   - Review the role assignment dropdown and account status badges.

### Step 3: Real-Time System Telemetry
1. Click **System Status** in the sidebar navigation (`/system-status`).
2. Review the live server metrics:
   - CPU utilization percentage
   - RAM memory usage and total capacity
   - Disk storage utilization
   - Active execution threads
   - Database connection status and ping latency (sub-millisecond)

### Step 4: Statistical Analytics and Hypothesis Tests
1. Click **Analytics** in the sidebar navigation (`/analytics`).
2. Review the descriptive statistics table and OLS bivariate regression chart ($R^2 = 0.973$).
3. Scroll down to the **Hypothesis Tests** section:
   - Inspect the **Average Distance** confidence interval card ($[11.2, 14.3]\text{ km}$).
   - Inspect the **Delivery Time Comparison** t-test card (Express vs Standard, $p = 0.27$).
   - Inspect the **Status vs Priority** chi-square card ($p = 0.53$).
   - Click the **Details** disclosure on any card to view statistical parameters ($t$-statistic, degrees of freedom, $p$-value, effect size).

---

## Part 3: Viewer Role (2 Minutes)

The Viewer represents a customer tracking their consigned parcel with restricted, read-only permissions.

### Step 1: Switch to Viewer Account
1. Click the top-right profile button and select **Sign out**.
2. On `/login`, click the **Viewer** demo button.
3. Click **Sign in**.
4. Expected view: Redirects to `/` (Viewer Parcel Overview).

### Step 2: Track Personal Consignments
1. Observe that internal operational tabs (Route Planner, Delivery Zones, System Status, User Management) are hidden from the sidebar.
2. In the parcel search box, enter tracking code `TRK-1001` or search by email.
3. Review consignment status: dispatched parcels now display `In Transit` with the assigned driver. Origin hub, destination hub, and live delivery updates are visible.
4. Click **Download Parcel Summary** to generate and inspect the personal parcel PDF summary.

---

## Conclusion (1 Minute)

1. Summarize the role separation:
   - Viewers can only view their own consigned parcels.
   - Dispatchers calculate routes, optimize delivery runs, cluster territories, and manage consignments.
   - Administrators oversee user registrations, inspect server telemetry, and review analytics.
2. Highlight algorithmic and statistical foundations:
   - Dijkstra shortest path ($\mathcal{O}((V+E)\log V)$).
   - TSP delivery run (Exact factorial vs Fast 2-Opt heuristic).
   - K-Means spatial clustering with equirectangular projection.
   - Inferential hypothesis tests with plain-English summaries.
