from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.config import get_settings

TZ = ZoneInfo(get_settings().timezone)


def now() -> datetime:
    return datetime.now(TZ)


def now_iso() -> str:
    return now().isoformat()


def today_str() -> str:
    return now().strftime("%Y-%m-%d")


def parse_date(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=TZ)


def weekdays_between(start: datetime, end: datetime) -> list[str]:
    days = []
    cur = start
    while cur <= end:
        if cur.weekday() < 5:
            days.append(cur.strftime("%Y-%m-%d"))
        cur += timedelta(days=1)
    return days


def is_before_cutoff(target_date_str: str, cutoff_time: str = "21:00") -> bool:
    """Booking for target_date_str closes at cutoff_time on the day before it."""
    target = parse_date(target_date_str)
    hh, mm = cutoff_time.split(":")
    cutoff_dt = (target - timedelta(days=1)).replace(hour=int(hh), minute=int(mm), second=0, microsecond=0)
    return now() <= cutoff_dt
