from datetime import timedelta

from app.core.time_utils import now, parse_date, today_str


def next_weekdays(count: int = 14) -> list[str]:
    """Next `count` weekday (Mon-Fri) date strings starting tomorrow."""
    days = []
    cur = now() + timedelta(days=1)
    while len(days) < count:
        if cur.weekday() < 5:
            days.append(cur.strftime("%Y-%m-%d"))
        cur += timedelta(days=1)
    return days


def dates_for_repeat(weekdays: list[int], from_date: str, to_date: str) -> list[str]:
    """weekdays: ISO weekday numbers 1=Mon..5=Fri (per spec)."""
    start = parse_date(from_date)
    end = parse_date(to_date)
    result = []
    cur = start
    while cur <= end:
        iso_wd = cur.isoweekday()
        if iso_wd in weekdays:
            result.append(cur.strftime("%Y-%m-%d"))
        cur += timedelta(days=1)
    return result


def default_repeat_range() -> tuple[str, str]:
    start = now() + timedelta(days=1)
    end = start + timedelta(weeks=2)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
