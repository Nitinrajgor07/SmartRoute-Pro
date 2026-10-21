from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP


PARCEL_RATES_PER_KG = {
    "Standard": Decimal("50"),
    "Express": Decimal("75"),
}


def calculate_parcel_price(weight_kg: float, priority: str) -> float | None:
    """Return the saved parcel price for priced speeds, or None for legacy speeds."""
    rate = PARCEL_RATES_PER_KG.get(priority)
    if rate is None:
        return None
    price = (Decimal(str(weight_kg)) * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return float(price)
