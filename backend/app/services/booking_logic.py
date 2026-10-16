from app.core.errors import bad_request, conflict
from app.core.time_utils import is_before_cutoff
from app.services.matching import booking_segment, compute_peak_load, direction_stop_order, stop_index_map
from app.services.notifications import notify
from app.services.pricing import compute_fare, compute_savings_pct, compute_solo_estimate


def get_settings(repos) -> dict:
    all_settings = repos.settings.all()
    return all_settings[0] if all_settings else {}


def build_fare_snapshot(pickup_stop: dict, drop_stop: dict, settings: dict) -> dict:
    passenger_km = abs(drop_stop.get("km_from_start", 0) - pickup_stop.get("km_from_start", 0))
    breakdown = compute_fare(
        passenger_km,
        settings.get("rate_per_km_van_lkr", 18),
        settings.get("booking_fee_lkr", 20),
        settings.get("minimum_fare_lkr", 150),
    )
    solo_estimate = compute_solo_estimate(passenger_km, settings.get("solo_ride_rate_per_km_lkr", 100))
    savings_pct = compute_savings_pct(breakdown.fare, solo_estimate)
    return {
        "passenger_km": round(passenger_km, 2),
        "rate_per_km": breakdown.rate_per_km,
        "booking_fee": breakdown.booking_fee,
        "distance_fare": breakdown.distance_fare,
        "fare": breakdown.fare,
        "solo_estimate": solo_estimate,
        "savings_pct": savings_pct,
    }


def check_overlap(repos, passenger_id: str, date: str, direction: str, corridor_id: str, slot_id: str) -> None:
    existing = [
        b
        for b in repos.bookings.find(passenger_id=passenger_id, date=date, direction=direction)
        if b["status"] in ("pending", "confirmed")
    ]
    for b in existing:
        if b["slot_id"] == slot_id and b["corridor_id"] == corridor_id:
            raise conflict("DUPLICATE_BOOKING", "You already have a booking for this date, direction and time.")


def charge_wallet(repos, user: dict, amount: float, booking_id: str, note: str) -> None:
    if user["wallet_balance_lkr"] < amount:
        raise bad_request("INSUFFICIENT_BALANCE", "Insufficient wallet balance. Please top up.")
    repos.users.update(user["id"], {"wallet_balance_lkr": user["wallet_balance_lkr"] - amount})
    repos.transactions.insert(
        {
            "user_id": user["id"],
            "type": "fare_charge",
            "amount_lkr": amount,
            "booking_id": booking_id,
            "status": "completed",
            "note": note,
        }
    )


def create_scheduled_booking(
    repos,
    user: dict,
    corridor_id: str,
    direction: str,
    slot_id: str,
    pickup_stop_id: str,
    drop_stop_id: str,
    origin: dict,
    destination: dict,
    date: str,
    booking_type: str,
    repeat_group_id: str | None,
    settings: dict,
) -> dict:
    if not is_before_cutoff(date, settings.get("cutoff_time", "21:00")):
        raise bad_request("PAST_CUTOFF", f"Booking for {date} closed at {settings.get('cutoff_time', '21:00')} the day before.")

    check_overlap(repos, user["id"], date, direction, corridor_id, slot_id)

    pickup_stop = repos.stops.get(pickup_stop_id)
    drop_stop = repos.stops.get(drop_stop_id)
    if not pickup_stop or not drop_stop:
        raise bad_request("INVALID_STOP", "Pickup or drop-off stop not found")

    fare_snapshot = build_fare_snapshot(pickup_stop, drop_stop, settings)

    fresh_user = repos.users.get(user["id"])
    charge_wallet(repos, fresh_user, fare_snapshot["fare"], "", f"Fare for {date} ride")

    booking = repos.bookings.insert(
        {
            "passenger_id": user["id"],
            "corridor_id": corridor_id,
            "direction": direction,
            "date": date,
            "slot_id": slot_id,
            "pickup_stop_id": pickup_stop_id,
            "drop_stop_id": drop_stop_id,
            "origin": origin,
            "destination": destination,
            "walk_to_pickup_m": 0,
            "walk_from_drop_m": 0,
            "fare_snapshot": fare_snapshot,
            "status": "pending",
            "trip_id": None,
            "booking_type": booking_type,
            "repeat_group_id": repeat_group_id,
        }
    )
    return booking


def cancel_booking(repos, booking: dict, user: dict, settings: dict) -> dict:
    if booking["status"] not in ("pending", "confirmed"):
        raise bad_request("CANNOT_CANCEL", "This booking can no longer be cancelled")

    before_cutoff = is_before_cutoff(booking["date"], settings.get("cutoff_time", "21:00"))
    updated = repos.bookings.update(booking["id"], {"status": "cancelled", "trip_id": None})

    if before_cutoff:
        fresh_user = repos.users.get(user["id"])
        repos.users.update(user["id"], {"wallet_balance_lkr": fresh_user["wallet_balance_lkr"] + booking["fare_snapshot"]["fare"]})
        repos.transactions.insert(
            {
                "user_id": user["id"],
                "type": "refund",
                "amount_lkr": booking["fare_snapshot"]["fare"],
                "booking_id": booking["id"],
                "status": "completed",
                "note": "Refund for cancelled booking (before cut-off)",
            }
        )
    return updated
