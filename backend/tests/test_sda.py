import pytest
import numpy as np
from app import create_app
from app.extensions import db
from app.models import Location, Delivery, Road, ClusterRun, ClusterAssignment
from app.services.clustering import KMeansClusterEngine, SpatialProjection
from app.services.statistics import DescriptiveStatisticsEngine

@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    with app.app_context():
        from flask_jwt_extended import create_access_token
        from app.models import User
        disp = User.query.filter_by(role='DISPATCHER').first()
        disp_id = str(disp.id) if disp else "2"
        token = create_access_token(identity=disp_id, additional_claims={"role": "DISPATCHER", "email": "dispatcher@smartroute.pro"})
    c = app.test_client()
    c.environ_base['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    return c

@pytest.fixture
def sample_locations():
    return [
        {"id": 1, "name": "Hub 1", "latitude": 37.77, "longitude": -122.41},
        {"id": 2, "name": "Hub 2", "latitude": 37.78, "longitude": -122.42},
        {"id": 3, "name": "Hub 3", "latitude": 37.75, "longitude": -122.40},
        {"id": 4, "name": "Hub 4", "latitude": 37.76, "longitude": -122.43},
        {"id": 5, "name": "Hub 5", "latitude": 37.79, "longitude": -122.39},
        {"id": 6, "name": "Hub 6", "latitude": 37.74, "longitude": -122.45}
    ]

# 1. Basic K-Means clustering
def test_1_basic_kmeans(sample_locations):
    res = KMeansClusterEngine.fit(sample_locations, k=2, random_state=42)
    assert res["k"] == 2
    assert len(res["centroids"]) == 2
    assert len(res["assignments"]) == 6
    assert res["inertia"] > 0
    assert "execution_time_ms" in res

# 2. Reproducibility with random_state
def test_2_reproducibility(sample_locations):
    run1 = KMeansClusterEngine.fit(sample_locations, k=3, random_state=101)
    run2 = KMeansClusterEngine.fit(sample_locations, k=3, random_state=101)
    assert run1["inertia"] == run2["inertia"]
    labels1 = [a["cluster_id"] for a in run1["assignments"]]
    labels2 = [a["cluster_id"] for a in run2["assignments"]]
    assert labels1 == labels2

# 3. Correct cluster counts
def test_3_correct_cluster_counts(sample_locations):
    for k_val in [1, 2, 3, 4]:
        res = KMeansClusterEngine.fit(sample_locations, k=k_val, random_state=42)
        assert len(res["centroids"]) == k_val
        total_assigned = sum(c["size"] for c in res["centroids"])
        assert total_assigned == len(sample_locations)

# 4. Invalid K handling
def test_4_invalid_k(sample_locations):
    with pytest.raises(ValueError):
        KMeansClusterEngine.fit(sample_locations, k=0)
    with pytest.raises(ValueError):
        KMeansClusterEngine.fit(sample_locations, k=-2)
    with pytest.raises(ValueError):
        KMeansClusterEngine.fit(sample_locations, k=10) # 10 > 6 points

# 5. Duplicate coordinates handling
def test_5_duplicate_coordinates():
    dupes = [
        {"id": 1, "latitude": 37.77, "longitude": -122.41},
        {"id": 2, "latitude": 37.77, "longitude": -122.41},
        {"id": 3, "latitude": 37.78, "longitude": -122.42}
    ]
    res = KMeansClusterEngine.fit(dupes, k=2, random_state=42)
    assert res["k"] == 2
    assert len(res["assignments"]) == 3

# 6. Insufficient data
def test_6_insufficient_data():
    single = [{"id": 1, "latitude": 37.77, "longitude": -122.41}]
    with pytest.raises(ValueError):
        KMeansClusterEngine.fit(single, k=2)

# 7. Empty dataset
def test_7_empty_dataset():
    with pytest.raises(ValueError):
        KMeansClusterEngine.fit([], k=1)

# 8. Elbow Method results
def test_8_elbow_method(sample_locations):
    elbow = KMeansClusterEngine.compute_elbow(sample_locations, max_k=4, random_state=42)
    assert len(elbow) == 4
    assert elbow[0]["k"] == 1
    assert elbow[3]["k"] == 4
    # Inertia must be monotonically non-increasing as K increases
    inertias = [pt["wcss"] for pt in elbow]
    for i in range(len(inertias) - 1):
        assert inertias[i] >= inertias[i + 1]

# 9. Silhouette Score validity
def test_9_silhouette_score_validity(sample_locations):
    # K=1 cannot have silhouette score (undefined)
    res_k1 = KMeansClusterEngine.fit(sample_locations, k=1, random_state=42)
    assert res_k1["silhouette_score"] is None

    # K=N cannot have silhouette score (undefined)
    res_kn = KMeansClusterEngine.fit(sample_locations, k=len(sample_locations), random_state=42)
    assert res_kn["silhouette_score"] is None

    # 2 <= K < N produces a valid score in [-1, 1]
    res_k2 = KMeansClusterEngine.fit(sample_locations, k=2, random_state=42)
    assert res_k2["silhouette_score"] is not None
    assert -1.0 <= res_k2["silhouette_score"] <= 1.0

# 10. Mean and median calculations
def test_10_mean_and_median():
    vals = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]
    stats_res = DescriptiveStatisticsEngine.compute_univariate_metrics(vals, "Test")
    assert stats_res["count"] == 8
    assert stats_res["mean"] == 5.0
    assert stats_res["median"] == 4.5
    assert stats_res["min"] == 2.0
    assert stats_res["max"] == 9.0
    assert stats_res["range"] == 7.0

# 11. Variance and standard deviation
def test_11_variance_and_std_dev():
    vals = [10.0, 12.0, 23.0, 23.0, 16.0, 23.0, 21.0, 16.0]
    stats_res = DescriptiveStatisticsEngine.compute_univariate_metrics(vals, "Dispersion")
    np_var = float(np.var(vals, ddof=1))
    np_std = float(np.std(vals, ddof=1))
    assert abs(stats_res["variance"] - round(np_var, 3)) < 0.001
    assert abs(stats_res["std_dev"] - round(np_std, 3)) < 0.001

# 12. Pearson correlation
def test_12_pearson_correlation():
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    y = [2.0, 4.0, 6.0, 8.0, 10.0]
    res = DescriptiveStatisticsEngine.compute_bivariate_regression(x, y)
    assert res["has_sufficient_data"] is True
    assert res["correlation"] == 1.0
    assert res["r_squared"] == 1.0
    assert res["slope"] == 2.0
    assert res["intercept"] == 0.0

# 13. Linear regression
def test_13_linear_regression():
    x = [2.0, 4.0, 6.0, 8.0]
    y = [3.0, 5.0, 7.0, 9.0]
    res = DescriptiveStatisticsEngine.compute_bivariate_regression(x, y)
    assert res["slope"] == 1.0
    assert res["intercept"] == 1.0
    assert "y = 1.0x + 1.0" in res["equation"]

# 14. Missing-value handling
def test_14_missing_values():
    vals_with_none = [10.0, None, 20.0, float('nan'), 30.0]
    stats_res = DescriptiveStatisticsEngine.compute_univariate_metrics(vals_with_none)
    assert stats_res["count"] == 3
    assert stats_res["mean"] == 20.0

    # Insufficient data for regression (<3 pairs)
    reg = DescriptiveStatisticsEngine.compute_bivariate_regression([1.0], [2.0])
    assert reg["has_sufficient_data"] is False

# 15. API input validation
def test_15_api_validation(client):
    # Empty DB gives 400 for clustering
    res = client.post('/api/sda/clusters/kmeans', json={"k": 2})
    assert res.status_code == 400

    # Non-integer K
    res = client.post('/api/sda/clusters/kmeans', json={"k": "three"})
    assert res.status_code == 400

# 16. Cluster history persistence
def test_16_cluster_history_persistence(client):
    # Add test locations
    for i in range(4):
        loc = Location(name=f"Hub {i}", address=f"Address {i}", latitude=37.7 + i*0.01, longitude=-122.4 - i*0.01)
        db.session.add(loc)
    db.session.commit()

    res = client.post('/api/sda/clusters/kmeans', json={"k": 2, "random_state": 42})
    assert res.status_code == 200
    run_id = res.get_json()["cluster_run_id"]
    assert run_id is not None

    # Check history endpoint
    hist_res = client.get('/api/sda/clusters/history')
    assert hist_res.status_code == 200
    assert hist_res.get_json()["total"] >= 1

    # Check detail endpoint
    det_res = client.get(f'/api/sda/clusters/history/{run_id}')
    assert det_res.status_code == 200
    assert len(det_res.get_json()["cluster_run"]["assignments"]) == 4

# 17. Distribution endpoint bins validation and numeric counts
def test_17_distribution_endpoint(client):
    # Add test locations
    loc1 = Location(name="Distribution Hub A", address="100 Main St", latitude=37.77, longitude=-122.41)
    loc2 = Location(name="Distribution Hub B", address="200 Market St", latitude=37.78, longitude=-122.42)
    db.session.add_all([loc1, loc2])
    db.session.flush()

    # Add test deliveries
    for i in range(10):
        d = Delivery(
            tracking_number=f"TRK-DIST-{i}",
            customer_name=f"Customer {i}",
            pickup_location_id=loc1.id,
            destination_location_id=loc2.id,
            distance_km=float(2.0 + i * 3.5),
            package_weight_kg=float(1.0 + i * 2.0),
            status="Delivered",
            priority="Standard"
        )
        db.session.add(d)
    db.session.commit()

    # Verify bins=3, 5, 7 return numeric counts and correct structure
    for b in [3, 5, 7]:
        res = client.get(f'/api/sda/statistics/distribution?bins={b}')
        assert res.status_code == 200
        data = res.get_json()
        assert "distance_distribution" in data
        assert "weight_distribution" in data
        assert len(data["distance_distribution"]) >= 1
        for item in data["distance_distribution"]:
            assert isinstance(item["count"], int)
            assert isinstance(item["frequency"], (int, float))
            assert isinstance(item["min"], (int, float))
            assert isinstance(item["max"], (int, float))
            assert isinstance(item["range"], str)
        for item in data["weight_distribution"]:
            assert isinstance(item["count"], int)
            assert isinstance(item["frequency"], (int, float))

    # Verify bins=0 and bins=abc return 400
    res_zero = client.get('/api/sda/statistics/distribution?bins=0')
    assert res_zero.status_code == 400

    res_abc = client.get('/api/sda/statistics/distribution?bins=abc')
    assert res_abc.status_code == 400
