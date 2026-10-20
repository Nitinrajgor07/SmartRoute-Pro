import math
import numpy as np
import pandas as pd
from scipy import stats
from typing import List, Dict, Any, Optional

class DescriptiveStatisticsEngine:
    """
    SDA Module: Descriptive and Inferential Statistical Engine.
    
    Curricular Alignment:
    - Subject: Statistical Data Analysis (SDA)
    - Topics: Measures of Central Tendency, Dispersion, Bivariate Correlation, Linear Regression
    - Libraries: pandas, NumPy, SciPy
    """

    @staticmethod
    def compute_univariate_metrics(series: List[float], label: str = "Metric") -> Dict[str, Any]:
        """
        Compute complete univariate descriptive statistics for a numeric sequence.
        Formula references:
        - Mean: x_bar = sum(x_i) / n
        - Sample Variance: s^2 = sum((x_i - x_bar)^2) / (n - 1)
        - Sample Std Dev: s = sqrt(s^2)
        - IQR = Q3 - Q1
        """
        clean_series = [float(x) for x in series if x is not None and not math.isnan(float(x))]
        n = len(clean_series)

        if n == 0:
            return {
                "metric_name": label,
                "count": 0,
                "mean": None,
                "median": None,
                "min": None,
                "max": None,
                "range": None,
                "variance": None,
                "std_dev": None,
                "q1": None,
                "q3": None,
                "iqr": None,
                "p10": None,
                "p90": None,
                "status": "Insufficient Data (Empty Sample)"
            }

        arr = np.array(clean_series, dtype=float)
        mean_val = float(np.mean(arr))
        median_val = float(np.median(arr))
        min_val = float(np.min(arr))
        max_val = float(np.max(arr))
        range_val = max_val - min_val

        # Sample variance & standard deviation with degrees of freedom ddof=1
        if n > 1:
            variance_val = float(np.var(arr, ddof=1))
            std_val = float(np.std(arr, ddof=1))
        else:
            variance_val = 0.0
            std_val = 0.0

        q1_val = float(np.percentile(arr, 25))
        q3_val = float(np.percentile(arr, 75))
        iqr_val = q3_val - q1_val
        p10_val = float(np.percentile(arr, 10))
        p90_val = float(np.percentile(arr, 90))

        return {
            "metric_name": label,
            "count": n,
            "mean": round(mean_val, 3),
            "median": round(median_val, 3),
            "min": round(min_val, 3),
            "max": round(max_val, 3),
            "range": round(range_val, 3),
            "variance": round(variance_val, 3),
            "std_dev": round(std_val, 3),
            "q1": round(q1_val, 3),
            "q3": round(q3_val, 3),
            "iqr": round(iqr_val, 3),
            "p10": round(p10_val, 3),
            "p90": round(p90_val, 3),
            "status": "Valid Parametric Analysis"
        }

    @staticmethod
    def compute_bivariate_regression(
        x_values: List[float],
        y_values: List[float],
        x_label: str = "X",
        y_label: str = "Y"
    ) -> Dict[str, Any]:
        """
        Compute Pearson correlation and Ordinary Least Squares (OLS) Simple Linear Regression.
        
        Statistical Formulations:
        - Pearson r = sum((x_i - x_bar)(y_i - y_bar)) / (sqrt(sum(x_i - x_bar)^2) * sqrt(sum(y_i - y_bar)^2))
        - Slope m = r * (s_y / s_x)
        - Intercept b = y_bar - m * x_bar
        - Coefficient of Determination R^2 = r^2
        """
        pairs = []
        for x, y in zip(x_values, y_values):
            if x is not None and y is not None and not math.isnan(float(x)) and not math.isnan(float(y)):
                pairs.append((float(x), float(y)))

        n = len(pairs)
        if n < 3:
            return {
                "x_label": x_label,
                "y_label": y_label,
                "sample_size": n,
                "has_sufficient_data": False,
                "correlation": None,
                "p_value": None,
                "slope": None,
                "intercept": None,
                "r_squared": None,
                "equation": None,
                "message": f"Insufficient paired observations (n={n}). At least 3 valid observations required for inferential regression.",
                "disclaimer": "Correlation does not imply causation."
            }

        x_arr = np.array([p[0] for p in pairs], dtype=float)
        y_arr = np.array([p[1] for p in pairs], dtype=float)

        # Check for zero variance in either variable
        if np.std(x_arr) == 0 or np.std(y_arr) == 0:
            return {
                "x_label": x_label,
                "y_label": y_label,
                "sample_size": n,
                "has_sufficient_data": False,
                "correlation": 0.0,
                "p_value": 1.0,
                "slope": 0.0,
                "intercept": float(np.mean(y_arr)),
                "r_squared": 0.0,
                "equation": f"{y_label} = {round(float(np.mean(y_arr)), 2)}",
                "message": "Zero variance detected in sample series; regression slope is undefined.",
                "disclaimer": "Correlation does not imply causation."
            }

        # SciPy OLS Linear Regression
        res = stats.linregress(x_arr, y_arr)
        slope = float(res.slope)
        intercept = float(res.intercept)
        r_val = float(res.rvalue)
        r_sq = float(r_val ** 2)
        p_val = float(res.pvalue)

        # Formulate regression line equation
        sign = "+" if intercept >= 0 else "-"
        equation = f"y = {round(slope, 3)}x {sign} {round(abs(intercept), 3)}"

        # Prepare scatter plot points & regression line endpoints for UI charts
        scatter_points = [{"x": round(float(x), 2), "y": round(float(y), 2)} for x, y in pairs]
        min_x, max_x = float(np.min(x_arr)), float(np.max(x_arr))
        line_points = [
            {"x": round(min_x, 2), "y": round(slope * min_x + intercept, 2)},
            {"x": round(max_x, 2), "y": round(slope * max_x + intercept, 2)}
        ]

        # Strength interpretation
        abs_r = abs(r_val)
        if abs_r >= 0.7:
            strength = "Strong"
        elif abs_r >= 0.4:
            strength = "Moderate"
        else:
            strength = "Weak"
        direction = "Positive" if r_val >= 0 else "Negative"

        return {
            "x_label": x_label,
            "y_label": y_label,
            "sample_size": n,
            "has_sufficient_data": True,
            "correlation": round(r_val, 4),
            "p_value": round(p_val, 5),
            "slope": round(slope, 4),
            "intercept": round(intercept, 4),
            "r_squared": round(r_sq, 4),
            "equation": equation,
            "interpretation": f"{strength} {direction} linear relationship (R² = {round(r_sq * 100, 1)}% variance explained, p = {round(p_val, 4)})",
            "scatter_points": scatter_points,
            "line_points": line_points,
            "disclaimer": "Statistical Note: Correlation indicates statistical association but does NOT prove causation."
        }

    @staticmethod
    def compute_histogram(series: List[float], num_bins: int = 5, label: str = "Value") -> List[Dict[str, Any]]:
        """Compute frequency distribution histogram bins for UI bar charts."""
        clean = [float(x) for x in series if x is not None and not math.isnan(float(x))]
        if not clean:
            return []

        counts, bin_edges = np.histogram(clean, bins=min(num_bins, max(len(set(clean)), 1)))
        bins_data = []
        unit_suffix = f" {label}" if label and label not in ("Value", "") else ""

        for i in range(len(counts)):
            bin_start = round(float(bin_edges[i]), 1)
            bin_end = round(float(bin_edges[i + 1]), 1)
            bins_data.append({
                "range": f"{bin_start} - {bin_end}{unit_suffix}",
                "min": bin_start,
                "max": bin_end,
                "count": int(counts[i]),
                "frequency": round(int(counts[i]) / len(clean), 3)
            })

        return bins_data
