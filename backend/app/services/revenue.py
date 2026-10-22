from __future__ import annotations

import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any


def _to_decimal(val: Any) -> Decimal:
    """Safely convert value to Decimal."""
    if val is None:
        return Decimal("0.00")
    try:
        return Decimal(str(val))
    except Exception:
        return Decimal("0.00")


def _quantize_currency(val: Decimal) -> float:
    """Round Decimal to 2 decimal places and return float."""
    return float(val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def calculate_revenue_periods(
    delivered_rows: list[dict[str, Any]],
    awaiting_rows: list[dict[str, Any]],
    now_app_dt: datetime.datetime,
    app_timezone: datetime.tzinfo | None = None
) -> dict[str, Any]:
    """
    Pure calculation of revenue periods from plain delivered and awaiting parcel rows.
    Dates are evaluated in the given app timezone.
    """
    today = now_app_dt.date()
    week_start = today - datetime.timedelta(days=today.weekday())
    week_end = week_start + datetime.timedelta(days=7)

    month_start = today.replace(day=1)
    if month_start.month == 12:
        next_month = month_start.replace(year=month_start.year + 1, month=1)
    else:
        next_month = month_start.replace(month=month_start.month + 1)

    today_rev = Decimal("0.00")
    week_rev = Decimal("0.00")
    month_rev = Decimal("0.00")
    all_time_rev = Decimal("0.00")

    today_count = 0
    week_count = 0
    month_count = 0
    all_time_count = 0

    for row in delivered_rows:
        price = _to_decimal(row.get("price"))
        all_time_rev += price
        all_time_count += 1

        del_at = row.get("delivered_at")
        if del_at is None:
            continue

        if del_at.tzinfo is None:
            del_at_utc = del_at.replace(tzinfo=datetime.timezone.utc)
        else:
            del_at_utc = del_at.astimezone(datetime.timezone.utc)

        del_at_app = del_at_utc.astimezone(app_timezone) if app_timezone else del_at_utc
        del_date = del_at_app.date()

        if del_date == today:
            today_rev += price
            today_count += 1

        if week_start <= del_date < week_end:
            week_rev += price
            week_count += 1

        if month_start <= del_date < next_month:
            month_rev += price
            month_count += 1

    awaiting_rev = Decimal("0.00")
    for row in awaiting_rows:
        awaiting_rev += _to_decimal(row.get("price"))

    return {
        "today": _quantize_currency(today_rev),
        "week": _quantize_currency(week_rev),
        "month": _quantize_currency(month_rev),
        "all_time": _quantize_currency(all_time_rev),
        "delivered_parcels": {
            "today": today_count,
            "week": week_count,
            "month": month_count,
            "all_time": all_time_count,
        },
        "awaiting_delivery": _quantize_currency(awaiting_rev),
        "currency": "INR",
    }


def calculate_revenue_breakdown(
    delivered_rows: list[dict[str, Any]],
    days: int,
    today_date: datetime.date,
    app_timezone: datetime.tzinfo | None = None
) -> dict[str, Any]:
    """
    Pure calculation of daily revenue series and priority table over N days.
    """
    start_date = today_date - datetime.timedelta(days=days - 1)
    end_date = today_date

    # Build chronological day map: start_date ... end_date
    daily_map: dict[datetime.date, dict[str, Any]] = {}
    curr = start_date
    while curr <= end_date:
        daily_map[curr] = {"date": curr.isoformat(), "revenue_dec": Decimal("0.00"), "parcels": 0}
        curr += datetime.timedelta(days=1)

    priority_map: dict[str, dict[str, Any]] = {
        "Urgent": {"parcels": 0, "revenue_dec": Decimal("0.00")},
        "Express": {"parcels": 0, "revenue_dec": Decimal("0.00")},
        "Standard": {"parcels": 0, "revenue_dec": Decimal("0.00")},
    }

    total_parcels = 0
    total_rev_dec = Decimal("0.00")

    for row in delivered_rows:
        del_at = row.get("delivered_at")
        if del_at is None:
            continue

        if del_at.tzinfo is None:
            del_at_utc = del_at.replace(tzinfo=datetime.timezone.utc)
        else:
            del_at_utc = del_at.astimezone(datetime.timezone.utc)

        del_at_app = del_at_utc.astimezone(app_timezone) if app_timezone else del_at_utc
        del_date = del_at_app.date()

        if start_date <= del_date <= end_date:
            price_dec = _to_decimal(row.get("price"))
            daily_map[del_date]["revenue_dec"] += price_dec
            daily_map[del_date]["parcels"] += 1

            prio = row.get("priority") or "Standard"
            if prio not in priority_map:
                priority_map[prio] = {"parcels": 0, "revenue_dec": Decimal("0.00")}

            priority_map[prio]["parcels"] += 1
            priority_map[prio]["revenue_dec"] += price_dec

            total_parcels += 1
            total_rev_dec += price_dec

    daily_list = [
        {
            "date": entry["date"],
            "revenue": _quantize_currency(entry["revenue_dec"]),
            "parcels": entry["parcels"]
        }
        for entry in daily_map.values()
    ]

    by_priority_list = []
    order = ["Urgent", "Express", "Standard"]
    # Ensure all order keys plus any extras
    keys = order + [k for k in priority_map.keys() if k not in order]
    for k in keys:
        if k in priority_map:
            p_data = priority_map[k]
            p_rev = _quantize_currency(p_data["revenue_dec"])
            p_count = p_data["parcels"]
            avg = round(p_rev / p_count, 2) if p_count > 0 else 0.0
            by_priority_list.append({
                "priority": k,
                "parcels": p_count,
                "revenue": p_rev,
                "average_per_parcel": avg
            })

    total_rev = _quantize_currency(total_rev_dec)
    total_avg = round(total_rev / total_parcels, 2) if total_parcels > 0 else 0.0

    return {
        "days": days,
        "currency": "INR",
        "daily": daily_list,
        "by_priority": by_priority_list,
        "totals": {
            "parcels": total_parcels,
            "revenue": total_rev,
            "average_per_parcel": total_avg
        }
    }
