import datetime
import pytest
import numpy as np
import scipy.stats as stats

from app import create_app
from app.extensions import db
from app.models import User, Location, Delivery
from app.services.inference import (
    mean_confidence_interval,
    welch_t_test,
    chi_square_independence
)


# ------------------------------------------------------------------------------
# 1. Pure Statistical Tests: Verification Against SciPy (to 6 decimals)
# ------------------------------------------------------------------------------

def test_confidence_interval_against_scipy():
    """Assert statistic, df, and p agree with scipy.stats.t.interval to 6 decimals."""
    data = [12.4, 15.1, 13.8, 16.2, 11.9, 14.5, 17.0, 13.2]
    confidence = 0.95
    res = mean_confidence_interval(data, confidence=confidence)

    assert res["available"] is True
    n = len(data)
    mean_val = np.mean(data)
    se = np.std(data, ddof=1) / np.sqrt(n)

    sci_lower, sci_upper = stats.t.interval(confidence, df=n - 1, loc=mean_val, scale=se)

    assert res["mean"] == pytest.approx(mean_val, abs=1e-6)
    assert res["degrees_of_freedom"] == n - 1
    assert res["lower_limit"] == pytest.approx(sci_lower, abs=1e-6)
    assert res["upper_limit"] == pytest.approx(sci_upper, abs=1e-6)


def test_welch_t_test_against_scipy():
    """Assert t-statistic, df, and p-value agree with scipy.stats.ttest_ind(equal_var=False) to 6 decimals."""
    group_a = [14.2, 16.5, 13.8, 17.1, 15.9, 18.2]
    group_b = [11.0, 12.5, 10.8, 13.1, 11.9]

    res = welch_t_test(group_a, group_b)
    assert res["available"] is True

    sci_res = stats.ttest_ind(group_a, group_b, equal_var=False)

    assert res["t_statistic"] == pytest.approx(sci_res.statistic, abs=1e-6)
    assert res["degrees_of_freedom"] == pytest.approx(sci_res.df, abs=1e-6)
    assert res["p_value"] == pytest.approx(sci_res.pvalue, abs=1e-6)


def test_chi_square_independence_against_scipy():
    """Assert chi-square statistic, df, and p-value agree with scipy.stats.chi2_contingency to 6 decimals."""
    table = [
        [25, 18, 12],
        [15, 22, 28]
    ]
    res = chi_square_independence(table)
    assert res["available"] is True

    sci_stat, sci_p, sci_df, sci_exp = stats.chi2_contingency(table, correction=False)

    assert res["chi2_statistic"] == pytest.approx(sci_stat, abs=1e-6)
    assert res["degrees_of_freedom"] == sci_df
    assert res["p_value"] == pytest.approx(sci_p, abs=1e-6)
    assert np.allclose(res["expected_counts"], sci_exp, atol=1e-6)


# ------------------------------------------------------------------------------
# 2. Textbook Examples with Known Answers
# ------------------------------------------------------------------------------

def test_textbook_known_answers():
    """Known analytical values from standard statistics curricula."""
    # Textbook CI example: 5 observations [10, 12, 14, 16, 18], mean=14.0, s=np.sqrt(10)=3.162277
    # t_crit for df=4 at 95% = 2.7764451, SE = 3.16227766 / sqrt(5) = 1.41421356
    # ME = 2.7764451 * 1.41421356 = 3.92641
    ci_known = mean_confidence_interval([10, 12, 14, 16, 18], confidence=0.95)
    assert ci_known["mean"] == pytest.approx(14.0, abs=1e-5)
    assert ci_known["degrees_of_freedom"] == 4
    assert ci_known["margin_of_error"] == pytest.approx(3.92641, abs=1e-4)
    assert ci_known["lower_limit"] == pytest.approx(10.07359, abs=1e-4)
    assert ci_known["upper_limit"] == pytest.approx(17.92641, abs=1e-4)

    # Textbook Chi-Square 2x2:
    # [[30, 20], [10, 40]]
    # Row totals: 50, 50; Col totals: 40, 60; Total: 100
    # Expected: [[20, 30], [20, 30]]
    # Chi2 = (10^2)/20 + (-10^2)/30 + (-10^2)/20 + (10^2)/30 = 5 + 3.3333 + 5 + 3.3333 = 16.66667
    chi_known = chi_square_independence([[30, 20], [10, 40]])
    assert chi_known["chi2_statistic"] == pytest.approx(16.666667, abs=1e-4)
    assert chi_known["degrees_of_freedom"] == 1
    assert chi_known["smallest_expected"] == 20.0
    assert chi_known["reliable"] is True


# ------------------------------------------------------------------------------
# 3. Edge Cases
# ------------------------------------------------------------------------------

def test_edge_cases():
    """Edge cases: constant data, small sample sizes, empty rows, small counts."""
    # 1. One value per group in CI (n < 2)
    ci_one = mean_confidence_interval([42.0])
    assert ci_one["available"] is False

    # 2. Constant data in both groups (variance = 0)
    tt_const = welch_t_test([5.0, 5.0, 5.0], [5.0, 5.0, 5.0])
    assert tt_const["available"] is False
    assert "zero variance" in tt_const["reason"]

    # 3. Small sample warning (n < 5 in one group)
    tt_small = welch_t_test([10.0, 12.0, 14.0], [9.0, 11.0, 13.0, 15.0, 17.0, 19.0])
    assert tt_small["available"] is True
    assert tt_small["warning"] == "Small sample"

    # 4. Empty row in contingency table
    table_empty_row = [
        [15, 20],
        [0, 0],
        [10, 25]
    ]
    chi_empty = chi_square_independence(table_empty_row)
    assert chi_empty["available"] is True
    assert chi_empty["rows"] == 2  # dropped empty row

    # 5. Small counts yielding reliable=False (cells < 5 or expected < 1)
    small_table = [
        [1, 2],
        [2, 1]
    ]
    chi_unreliable = chi_square_independence(small_table)
    assert chi_unreliable["available"] is True
    assert chi_unreliable["reliable"] is False


# ------------------------------------------------------------------------------
# 4. API Endpoint Integration & RBAC Tests
# ------------------------------------------------------------------------------

@pytest.fixture
def app_with_seed():
    """App fixture loaded with seeded deliveries and users for integration testing."""
    test_app = create_app('testing')
    with test_app.app_context():
        db.create_all()
        from seed import seed_database
        seed_database(test_app)
        yield test_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def test_client(app_with_seed):
    return app_with_seed.test_client()


def get_token(client, email, password):
    res = client.post('/api/auth/login', json={"email": email, "password": password})
    return res.get_json()["access_token"]


def test_api_roles_and_permissions(test_client):
    """ADMIN and DISPATCHER get 200, VIEWER gets 403, anonymous gets 401."""
    admin_token = get_token(test_client, "admin@smartroute.pro", "Admin@123456")
    disp_token = get_token(test_client, "dispatcher@smartroute.pro", "Dispatch@123456")
    viewer_token = get_token(test_client, "viewer@smartroute.pro", "Viewer@123456")

    # 1. Anonymous -> 401
    res_anon = test_client.get('/api/sda/statistics/inference')
    assert res_anon.status_code == 401

    # 2. Viewer -> 403
    res_viewer = test_client.get(
        '/api/sda/statistics/inference',
        headers={"Authorization": f"Bearer {viewer_token}"}
    )
    assert res_viewer.status_code == 403

    # 3. Dispatcher -> 200
    res_disp = test_client.get(
        '/api/sda/statistics/inference',
        headers={"Authorization": f"Bearer {disp_token}"}
    )
    assert res_disp.status_code == 200

    # 4. Admin -> 200
    res_admin = test_client.get(
        '/api/sda/statistics/inference',
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_admin.status_code == 200


def test_api_parameter_validation(test_client):
    """Bad query parameters return 400."""
    admin_token = get_token(test_client, "admin@smartroute.pro", "Admin@123456")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Bad metric
    res = test_client.get('/api/sda/statistics/inference?metric=invalid_metric', headers=headers)
    assert res.status_code == 400

    # Bad confidence
    res = test_client.get('/api/sda/statistics/inference?confidence=0.85', headers=headers)
    assert res.status_code == 400

    # Bad group_a
    res = test_client.get('/api/sda/statistics/inference?group_a=Unknown', headers=headers)
    assert res.status_code == 400

    # group_a equals group_b
    res = test_client.get('/api/sda/statistics/inference?group_a=Express&group_b=Express', headers=headers)
    assert res.status_code == 400


def test_api_seeded_database_results_and_idempotency(test_client):
    """Seeded database response has the three blocks, chi_square.collapsed is True, and two calls are identical."""
    admin_token = get_token(test_client, "admin@smartroute.pro", "Admin@123456")
    headers = {"Authorization": f"Bearer {admin_token}"}

    res1 = test_client.get('/api/sda/statistics/inference', headers=headers)
    assert res1.status_code == 200
    data1 = res1.get_json()

    assert data1["available"] is True
    assert "confidence_interval" in data1
    assert "t_test" in data1
    assert "chi_square" in data1

    assert data1["confidence_interval"]["available"] is True
    assert data1["t_test"]["available"] is True
    assert data1["chi_square"]["available"] is True
    assert data1["chi_square"]["collapsed"] is True

    # Check summary sentences present
    assert "between" in data1["confidence_interval"]["summary"].lower()
    assert ("significant" in data1["t_test"]["summary"].lower() or "no significant" in data1["t_test"]["summary"].lower())
    assert ("significant" in data1["chi_square"]["summary"].lower() or "no significant" in data1["chi_square"]["summary"].lower())

    # Call 2 -> Identical response (Idempotent)
    res2 = test_client.get('/api/sda/statistics/inference', headers=headers)
    assert res2.status_code == 200
    data2 = res2.get_json()

    assert data1 == data2
