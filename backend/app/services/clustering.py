import time
import math
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

class SpatialProjection:
    """
    Equirectangular metric projection for local geographical coordinate conversion.
    
    Converts (latitude, longitude) in decimal degrees to planar (x, y) coordinates
    in real kilometers relative to the dataset centroid:
    - 1 deg latitude ≈ 110.574 km
    - 1 deg longitude ≈ 111.320 * cos(mean_latitude) km
    
    This ensures that scikit-learn's Euclidean distance metric in KMeans computes
    true spatial ground distances in kilometers rather than degree-distorted quantities.
    """

    @staticmethod
    def to_metric_planar(
        coords: np.ndarray,
        mean_lat: Optional[float] = None,
        mean_lon: Optional[float] = None
    ) -> Tuple[np.ndarray, float, float]:
        """Convert array of [lat, lon] to [x_km, y_km]."""
        if mean_lat is None:
            mean_lat = float(np.mean(coords[:, 0]))
        if mean_lon is None:
            mean_lon = float(np.mean(coords[:, 1]))

        lat_rad = math.radians(mean_lat)
        kx = 111.320 * math.cos(lat_rad)
        ky = 110.574

        # x: East-West displacement (km), y: North-South displacement (km)
        x_km = (coords[:, 1] - mean_lon) * kx
        y_km = (coords[:, 0] - mean_lat) * ky

        planar = np.column_stack((x_km, y_km))
        return planar, mean_lat, mean_lon

    @staticmethod
    def to_lat_lon(
        planar_centroids: np.ndarray,
        mean_lat: float,
        mean_lon: float
    ) -> np.ndarray:
        """Invert [x_km, y_km] back to [latitude, longitude]."""
        lat_rad = math.radians(mean_lat)
        kx = 111.320 * math.cos(lat_rad)
        ky = 110.574

        lon = mean_lon + (planar_centroids[:, 0] / (kx if kx != 0 else 1.0))
        lat = mean_lat + (planar_centroids[:, 1] / ky)

        return np.column_stack((lat, lon))


class KMeansClusterEngine:
    """
    SDA Module: Spatial K-Means Clustering Engine.
    
    Curricular Alignment:
    - Subject: Statistical Data Analysis (SDA)
    - Algorithm: Lloyd's K-Means with k-means++ centroid initialization
    - Metric: Projected Euclidean distance in Ground Kilometers
    - Quality Metric: Silhouette Analysis ([-1, 1]) and Within-Cluster Sum of Squares (Inertia)
    """

    @staticmethod
    def validate_input(
        locations: List[Dict[str, Any]],
        k: int,
        max_iter: int = 300
    ) -> np.ndarray:
        """Validate input points and parameters."""
        if not locations:
            raise ValueError("No location points available for clustering.")

        if not isinstance(k, int) or k < 1:
            raise ValueError("Parameter 'k' must be an integer greater than or equal to 1.")

        n_samples = len(locations)
        if k > n_samples:
            raise ValueError(f"Number of clusters K ({k}) cannot exceed the number of available locations ({n_samples}).")

        if max_iter < 1:
            raise ValueError("Parameter 'max_iter' must be greater than or equal to 1.")

        coords = []
        for loc in locations:
            lat = loc.get('latitude')
            lon = loc.get('longitude')
            if lat is None or lon is None or math.isnan(lat) or math.isnan(lon):
                raise ValueError(f"Invalid coordinate detected for location ID {loc.get('id')}.")
            if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
                raise ValueError(f"Coordinate out of geographical bounds for location ID {loc.get('id')}: ({lat}, {lon}).")
            coords.append([float(lat), float(lon)])

        return np.array(coords, dtype=float)

    @staticmethod
    def fit(
        locations: List[Dict[str, Any]],
        k: int,
        max_iter: int = 300,
        random_state: int = 42
    ) -> Dict[str, Any]:
        """
        Execute K-Means clustering on the given locations.
        """
        coords_lat_lon = KMeansClusterEngine.validate_input(locations, k, max_iter)
        n_samples = len(coords_lat_lon)

        start_time = time.perf_counter()

        # 1. Project lat/lon to planar metric coordinates (km)
        planar_coords, mean_lat, mean_lon = SpatialProjection.to_metric_planar(coords_lat_lon)

        # 2. Fit KMeans using scikit-learn
        # Note: n_init='auto' or 10 ensures robust initialization
        kmeans = KMeans(
            n_clusters=k,
            init='k-means++',
            n_init=10,
            max_iter=max_iter,
            random_state=random_state
        )
        labels = kmeans.fit_predict(planar_coords)
        planar_centroids = kmeans.cluster_centers_
        inertia = float(kmeans.inertia_)
        n_iter = int(kmeans.n_iter_)

        # 3. Convert planar centroids back to lat/lon
        lat_lon_centroids = SpatialProjection.to_lat_lon(planar_centroids, mean_lat, mean_lon)

        # 4. Calculate Silhouette Score when mathematically valid:
        # Requires 2 <= k <= n_samples - 1 and at least 2 unique labels
        unique_labels = set(labels)
        if 2 <= k < n_samples and len(unique_labels) > 1:
            try:
                sil_score = float(silhouette_score(planar_coords, labels))
            except Exception:
                sil_score = None
        else:
            sil_score = None

        end_time = time.perf_counter()
        exec_ms = round((end_time - start_time) * 1000, 3)

        # 5. Format centroids and calculate cluster sizes & radii
        centroids_result = []
        cluster_assignments = []

        for c_id in range(k):
            mask = (labels == c_id)
            c_points_planar = planar_coords[mask]
            size = int(np.sum(mask))

            if size > 0:
                # Distances from points to this centroid
                diffs = c_points_planar - planar_centroids[c_id]
                distances_km = np.sqrt(np.sum(diffs ** 2, axis=1))
                radius_km = float(np.max(distances_km))
                avg_dist_km = float(np.mean(distances_km))
            else:
                radius_km = 0.0
                avg_dist_km = 0.0

            centroids_result.append({
                "cluster_id": c_id,
                "latitude": round(float(lat_lon_centroids[c_id, 0]), 6),
                "longitude": round(float(lat_lon_centroids[c_id, 1]), 6),
                "size": size,
                "radius_km": round(radius_km, 3),
                "avg_distance_km": round(avg_dist_km, 3)
            })

        # 6. Format individual location assignments
        for idx, loc in enumerate(locations):
            assigned_c = int(labels[idx])
            # Distance from point to its centroid
            diff = planar_coords[idx] - planar_centroids[assigned_c]
            dist_km = float(np.sqrt(np.sum(diff ** 2)))

            cluster_assignments.append({
                "location_id": loc.get("id"),
                "location_name": loc.get("name"),
                "address": loc.get("address"),
                "latitude": float(loc.get("latitude")),
                "longitude": float(loc.get("longitude")),
                "cluster_id": assigned_c,
                "distance_to_centroid_km": round(dist_km, 3)
            })

        return {
            "k": k,
            "max_iterations": max_iter,
            "random_state": random_state,
            "total_locations": n_samples,
            "inertia": round(inertia, 4),
            "silhouette_score": round(sil_score, 4) if sil_score is not None else None,
            "iterations_run": n_iter,
            "execution_time_ms": max(exec_ms, 0.001),
            "centroids": centroids_result,
            "assignments": cluster_assignments,
            "projection": "Equirectangular Ground-Kilometer Projection"
        }

    @staticmethod
    def compute_elbow(
        locations: List[Dict[str, Any]],
        max_k: int = 6,
        random_state: int = 42
    ) -> List[Dict[str, Any]]:
        """
        Compute inertia (WCSS) for K = 1 .. min(max_k, n_samples).
        Used by the Elbow Method visualization to evaluate clustering variance reduction.
        """
        coords_lat_lon = KMeansClusterEngine.validate_input(locations, k=1)
        n_samples = len(coords_lat_lon)
        effective_max_k = min(max_k, n_samples)

        planar_coords, _, _ = SpatialProjection.to_metric_planar(coords_lat_lon)

        elbow_results = []
        for k in range(1, effective_max_k + 1):
            km = KMeans(
                n_clusters=k,
                init='k-means++',
                n_init=10,
                max_iter=300,
                random_state=random_state
            )
            km.fit(planar_coords)
            elbow_results.append({
                "k": k,
                "wcss": round(float(km.inertia_), 3),
                "inertia": round(float(km.inertia_), 3)
            })

        return elbow_results
