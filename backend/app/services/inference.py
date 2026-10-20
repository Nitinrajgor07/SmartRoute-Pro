"""
SmartRoute Pro - Statistical Inference & Hypothesis Testing Engine
Curricular Subject: Statistical Data Analysis (SDA)

This module provides pure mathematical and statistical inference functions
independent of database models and network layers:
1. One-Sample Mean Confidence Interval using Student's t-distribution
2. Two-Sample Welch's t-test with Welch-Satterthwaite degrees of freedom and Cohen's d
3. Pearson's Chi-Square Test of Independence with Cramer's V effect size

Formulas:
- Mean: \\bar{x} = \\frac{1}{n} \\sum x_i
- Sample Standard Deviation: s = \\sqrt{\\frac{1}{n-1} \\sum (x_i - \\bar{x})^2}
- Standard Error: SE = \\frac{s}{\\sqrt{n}}
- Confidence Interval: \\bar{x} \\pm t_{\\alpha/2, n-1} \\cdot SE
- Welch's t: t = \\frac{\\bar{a} - \\bar{b}}{\\sqrt{s_a^2/n_a + s_b^2/n_b}}
- Welch-Satterthwaite df:
    df = \\frac{(s_a^2/n_a + s_b^2/n_b)^2}{\\frac{(s_a^2/n_a)^2}{n_a - 1} + \\frac{(s_b^2/n_b)^2}{n_b - 1}}
- Pooled Standard Deviation: s_{pooled} = \\sqrt{\\frac{(n_a-1)s_a^2 + (n_b-1)s_b^2}{n_a + n_b - 2}}
- Cohen's d: d = \\frac{\\bar{a} - \\bar{b}}{s_{pooled}}
- Expected Count: E_{ij} = \\frac{R_i \\cdot C_j}{N}
- Chi-Square Statistic: \\chi^2 = \\sum \\frac{(O_{ij} - E_{ij})^2}{E_{ij}}, \\quad df = (r-1)(c-1)
- Cramer's V: V = \\sqrt{\\frac{\\chi^2}{N \\cdot \\min(r-1, c-1)}}
"""

from typing import List, Sequence, Union, Dict, Any, Optional
import numpy as np
import scipy.stats as stats


def mean_confidence_interval(
    values: Sequence[Union[int, float]],
    confidence: float = 0.95
) -> Dict[str, Any]:
    """
    Computes Student's t confidence interval for the population mean.

    Subject: SDA - Estimation & Confidence Intervals.
    Formula:
        SE = s / sqrt(n)
        Margin of Error = t_{crit} * SE
        CI = [mean - ME, mean + ME]

    Parameters:
        values: Sequence of numeric values (requires n >= 2).
        confidence: Confidence level in (0, 1), typically 0.90, 0.95, or 0.99.

    Returns:
        dict containing mean, sample standard deviation, standard error,
        critical t value, lower and upper limits, and availability metadata.
    """
    clean_values = [float(v) for v in values if v is not None and not np.isnan(v)]
    n = len(clean_values)

    if n < 2:
        return {
            "available": False,
            "reason": "Not enough data (at least 2 observations required)."
        }

    arr = np.array(clean_values, dtype=float)
    mean_val = float(np.mean(arr))
    sample_sd = float(np.std(arr, ddof=1))
    se = float(sample_sd / np.sqrt(n))

    df = n - 1
    alpha = 1.0 - confidence
    critical_t = float(stats.t.ppf(1.0 - alpha / 2.0, df=df))
    margin_of_error = float(critical_t * se)

    lower_limit = float(mean_val - margin_of_error)
    upper_limit = float(mean_val + margin_of_error)

    return {
        "available": True,
        "n": n,
        "mean": mean_val,
        "sample_sd": sample_sd,
        "standard_error": se,
        "degrees_of_freedom": df,
        "confidence": confidence,
        "critical_t": critical_t,
        "margin_of_error": margin_of_error,
        "lower_limit": lower_limit,
        "upper_limit": upper_limit
    }


def welch_t_test(
    a: Sequence[Union[int, float]],
    b: Sequence[Union[int, float]]
) -> Dict[str, Any]:
    """
    Computes Welch's two-sample t-test for unequal population variances.

    Subject: SDA - Two-Sample Hypothesis Testing.
    Formulas:
        t = (\\bar{a} - \\bar{b}) / sqrt(s_a^2/n_a + s_b^2/n_b)
        Welch-Satterthwaite df:
            df = (s_a^2/n_a + s_b^2/n_b)^2 / [ (s_a^2/n_a)^2/(n_a-1) + (s_b^2/n_b)^2/(n_b-1) ]
        Two-sided p-value: 2 * scipy.stats.t.sf(|t|, df)
        Cohen's d: (\\bar{a} - \\bar{b}) / s_{pooled}

    Parameters:
        a: Observations for group A.
        b: Observations for group B.

    Returns:
        dict containing both sample sizes, sample means, difference of means with
        its 95% confidence interval, t-statistic, degrees of freedom, p-value,
        Cohen's d effect size, and small sample warning.
    """
    clean_a = [float(v) for v in a if v is not None and not np.isnan(v)]
    clean_b = [float(v) for v in b if v is not None and not np.isnan(v)]

    n_a = len(clean_a)
    n_b = len(clean_b)

    if n_a < 2 or n_b < 2:
        return {
            "available": False,
            "reason": "Not enough data (at least 2 observations required per group)."
        }

    arr_a = np.array(clean_a, dtype=float)
    arr_b = np.array(clean_b, dtype=float)

    mean_a = float(np.mean(arr_a))
    mean_b = float(np.mean(arr_b))

    var_a = float(np.var(arr_a, ddof=1))
    var_b = float(np.var(arr_b, ddof=1))

    if var_a == 0.0 and var_b == 0.0:
        return {
            "available": False,
            "reason": "Not enough data (both groups have zero variance)."
        }

    se_a_sq = var_a / n_a
    se_b_sq = var_b / n_b
    sum_se_sq = se_a_sq + se_b_sq
    se_diff = float(np.sqrt(sum_se_sq))

    # Welch t statistic
    t_stat = float((mean_a - mean_b) / se_diff)

    # Welch-Satterthwaite degrees of freedom
    denom = 0.0
    if n_a > 1 and se_a_sq > 0:
        denom += (se_a_sq ** 2) / (n_a - 1)
    if n_b > 1 and se_b_sq > 0:
        denom += (se_b_sq ** 2) / (n_b - 1)

    if denom > 0:
        df = float((sum_se_sq ** 2) / denom)
    else:
        df = float(n_a + n_b - 2)

    # Two-sided p-value via Student's t survival function
    p_value = float(2.0 * stats.t.sf(abs(t_stat), df))

    # 95% Confidence Interval for Difference of Means
    tc = float(stats.t.ppf(0.975, df=df))
    diff_means = float(mean_a - mean_b)
    ci_lower = float(diff_means - tc * se_diff)
    ci_upper = float(diff_means + tc * se_diff)

    # Cohen's d using pooled sample standard deviation
    denom_pooled = float(n_a + n_b - 2)
    pooled_var = ((n_a - 1) * var_a + (n_b - 1) * var_b) / denom_pooled if denom_pooled > 0 else 0.0
    s_pooled = float(np.sqrt(pooled_var)) if pooled_var > 0 else 0.0
    cohens_d = float(diff_means / s_pooled) if s_pooled > 0 else 0.0

    warning = "Small sample" if (n_a < 5 or n_b < 5) else None

    return {
        "available": True,
        "n_a": n_a,
        "n_b": n_b,
        "mean_a": mean_a,
        "mean_b": mean_b,
        "difference_of_means": diff_means,
        "ci_lower": ci_lower,
        "ci_upper": ci_upper,
        "t_statistic": t_stat,
        "degrees_of_freedom": df,
        "p_value": p_value,
        "cohens_d": cohens_d,
        "warning": warning
    }


def chi_square_independence(
    table: Sequence[Sequence[Union[int, float]]]
) -> Dict[str, Any]:
    """
    Computes Pearson's Chi-Square Test of Independence on a 2D contingency table.

    Subject: SDA - Categorical Association & Goodness of Fit.
    Formulas:
        Expected: E_{ij} = (R_i * C_j) / N
        Statistic: \\chi^2 = \\sum (O_{ij} - E_{ij})^2 / E_{ij}
        Degrees of freedom: df = (r - 1) * (c - 1)
        p-value: scipy.stats.chi2.sf(stat, df)
        Cramer's V: sqrt( \\chi^2 / (N * min(r - 1, c - 1)) )

    Reliability Rule:
        A test is deemed reliable if and only if:
        1. All expected counts >= 1.0
        2. No more than 20% of expected counts are < 5.0

    Parameters:
        table: 2D array-like containing non-negative observed counts.

    Returns:
        dict containing observed table, expected table, statistic, degrees of freedom,
        p-value, Cramer's V, smallest expected count, and reliability flag.
    """
    try:
        obs = np.array(table, dtype=float)
    except Exception:
        return {
            "available": False,
            "reason": "Not enough data (invalid contingency table)."
        }

    if obs.ndim != 2:
        return {
            "available": False,
            "reason": "Not enough data (table must be 2-dimensional)."
        }

    # Drop rows or columns with a zero total first
    row_mask = obs.sum(axis=1) > 0
    obs = obs[row_mask, :]
    if obs.size == 0:
        return {
            "available": False,
            "reason": "Not enough data (all rows had zero counts)."
        }

    col_mask = obs.sum(axis=0) > 0
    obs = obs[:, col_mask]
    if obs.size == 0:
        return {
            "available": False,
            "reason": "Not enough data (all columns had zero counts)."
        }

    r, c = obs.shape
    if r < 2 or c < 2:
        return {
            "available": False,
            "reason": "Not enough data (table smaller than 2x2 after dropping empty rows/columns)."
        }

    total_n = float(obs.sum())
    if total_n <= 0:
        return {
            "available": False,
            "reason": "Not enough data (total observations count is zero)."
        }

    r_sums = obs.sum(axis=1, keepdims=True)
    c_sums = obs.sum(axis=0, keepdims=True)
    expected = (r_sums * c_sums) / total_n

    # Check for expected cell zeros
    if np.any(expected == 0):
        return {
            "available": False,
            "reason": "Not enough data (expected count matrix contains zeros)."
        }

    chi2_stat = float(np.sum(((obs - expected) ** 2) / expected))
    df = (r - 1) * (c - 1)
    p_val = float(stats.chi2.sf(chi2_stat, df))

    min_dim = min(r - 1, c - 1)
    cramers_v = float(np.sqrt(chi2_stat / (total_n * min_dim))) if min_dim > 0 and total_n > 0 else 0.0

    smallest_expected = float(np.min(expected))
    cells_below_5 = int(np.sum(expected < 5.0))
    fraction_below_5 = float(cells_below_5 / expected.size)

    reliable = not (smallest_expected < 1.0 or fraction_below_5 > 0.20)

    return {
        "available": True,
        "n": total_n,
        "rows": r,
        "columns": c,
        "chi2_statistic": chi2_stat,
        "degrees_of_freedom": df,
        "p_value": p_val,
        "cramers_v": cramers_v,
        "smallest_expected": smallest_expected,
        "fraction_below_5": fraction_below_5,
        "reliable": reliable,
        "expected_counts": expected.tolist()
    }
