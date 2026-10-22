import logging
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

logger = logging.getLogger(__name__)


def get_app_timezone(tz_name: str | None = None) -> ZoneInfo:
    """Safe wrapper for ZoneInfo that logs a warning and falls back to UTC on invalid or missing timezone."""
    name = (tz_name or '').strip()
    if not name:
        return ZoneInfo('UTC')
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, Exception) as exc:
        logger.warning("Invalid or unavailable timezone '%s' (%s). Falling back to UTC.", name, exc)
        return ZoneInfo('UTC')
